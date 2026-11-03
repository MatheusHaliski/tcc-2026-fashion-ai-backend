/*
 * Avatar 3D — locomoção: construção do esqueleto animável (Rig) a partir dos ossos do corpo, clone para a multidão,
 * nova pose de exibição e consulta de juntas.
 */
import * as THREE from "three";
import { FINGERS, type Key, NAMES, type Rig, type Side } from "./locomotion-model";
import { modelPos, modelQuat, reset } from "./locomotion-kinematics";

/* ---------- construção ---------- */
const bare = (n: string) => n.replace("mixamorig:", "");

/**
 * Esqueleto pronto para animar. `joints`: juntas de repouso no espaço do modelo (Human.rest.joints, na ordem de
 * `bones`); `base`: pose de exibição de cada osso (PoseState.base); `hips0`: posição do quadril nela.
 */
export function makeRig(bones: THREE.Bone[], joints: ArrayLike<number>, base: (b: THREE.Bone) => THREE.Quaternion | undefined, hips0: THREE.Vector3): Rig {
  const idx = new Map(bones.map((b, i) => [bare(b.name), i]));
  const at = (n: string) => { const i = idx.get(n); if (i === undefined) throw new Error(`osso ${n}`); return i; };
  const k = Object.fromEntries(NAMES.map((n) => [n, at(n)])) as Record<Key, number>;
  const parent = new Int16Array(bones.length).map((_, i) => bones.indexOf(bones[i].parent as THREE.Bone));
  const J = Float32Array.from({ length: bones.length * 3 }, (_, i) => joints[i] ?? 0);
  const P = (i: number) => new THREE.Vector3(J[i * 3], J[i * 3 + 1], J[i * 3 + 2]);
  const fingers = ([0, 1] as Side[]).map((s) => FINGERS.map((f) => [1, 2, 3].map((n) => at(`${s ? "Right" : "Left"}Hand${f}${n}`)))) as [number[][], number[][]];
  const thumbs = ([0, 1] as Side[]).map((s) => [1, 2, 3].map((n) => at(`${s ? "Right" : "Left"}HandThumb${n}`))) as [number[], number[]];
  const hand = { f: [new THREE.Vector3(), new THREE.Vector3()] as [THREE.Vector3, THREE.Vector3], n: [new THREE.Vector3(), new THREE.Vector3()] as [THREE.Vector3, THREE.Vector3], curl: [new THREE.Vector3(), new THREE.Vector3()] as [THREE.Vector3, THREE.Vector3] };
  for (const s of [0, 1] as Side[]) {
    const S = s ? "Right" : "Left";
    const wrist = P(at(`${S}Hand`)), mid = P(at(`${S}HandMiddle1`)), ind = P(at(`${S}HandIndex1`)), pin = P(at(`${S}HandPinky1`));
    const f = mid.sub(wrist).normalize(); const a = ind.sub(pin); a.addScaledVector(f, -a.dot(f)).normalize();
    // palma: perpendicular aos dedos e ao eixo indicador→mínimo; na pose "A" do arquivo ela olha para baixo
    const n = new THREE.Vector3().crossVectors(f, a).normalize(); if (n.y > 0) n.negate();
    hand.f[s].copy(f); hand.n[s].copy(n);
    // flexão: gira os dedos da direção f para a palma n (eixo f × n), no quadro local da mão (= modelo no repouso)
    hand.curl[s].crossVectors(f, n).normalize();
  }
  const rig: Rig = {
    bones, parent, base: bones.map((b) => (base(b) ?? new THREE.Quaternion()).clone()), hips0: hips0.clone(), k, fingers, thumbs, J,
    baseModel: bones.map(() => new THREE.Quaternion()), footIdle: [new THREE.Vector3(), new THREE.Vector3()], hand,
    dim: {
      thigh: P(k.LeftLeg).distanceTo(P(k.LeftUpLeg)), shin: P(k.LeftFoot).distanceTo(P(k.LeftLeg)), upArm: P(k.LeftForeArm).distanceTo(P(k.LeftArm)),
      foreArm: P(k.LeftHand).distanceTo(P(k.LeftForeArm)), ankle: J[k.LeftFoot * 3 + 1], hipH: J[k.Hips * 3 + 1], hipHalf: Math.abs(J[k.LeftUpLeg * 3]),
      toe: Math.max(0.08, J[k.LeftToeBase * 3 + 2] - J[k.LeftFoot * 3 + 2]), palm: P(at("LeftHandMiddle1")).distanceTo(P(at("LeftHand"))),
      neck: J[k.Neck * 3 + 1], head: J[k.Head * 3 + 1], chest: J[k.Spine2 * 3 + 1], shoulderX: Math.abs(J[k.LeftArm * 3]), shoulderY: J[k.LeftArm * 3 + 1],
    },
  };
  // orientações de modelo e pés parados na pose de exibição
  reset(rig);
  for (let i = 0; i < bones.length; i++) modelQuat(rig, i, rig.baseModel[i]);
  for (const s of [0, 1] as Side[]) modelPos(rig, s ? k.RightFoot : k.LeftFoot, rig.footIdle[s]);
  return rig;
}

/** O mesmo esqueleto num clone (SkeletonUtils.clone): ossos do clone pelo nome; o resto é compartilhado. */
export function cloneRig(r: Rig, root: THREE.Object3D): Rig {
  const byName = new Map<string, THREE.Bone>();
  root.traverse((o) => { if ((o as THREE.Bone).isBone) byName.set(o.name, o as THREE.Bone); });
  const bones = r.bones.map((b) => { const c = byName.get(b.name); if (!c) throw new Error(`osso ${b.name} no clone`); return c; });
  return { ...r, bones };
}

/**
 * Refaz a pose de exibição do esqueleto (a roupa nova pode abrir os braços: saia rodada, casaco). A jogadora troca de
 * roupa no meio da partida; os clones da multidão nunca mudam de roupa e compartilham `base` com o modelo.
 */
export function syncBase(r: Rig, base: (b: THREE.Bone) => THREE.Quaternion | undefined) {
  for (let i = 0; i < r.bones.length; i++) { const q = base(r.bones[i]); if (q) r.base[i].copy(q); }
  reset(r);
  for (let i = 0; i < r.bones.length; i++) modelQuat(r, i, r.baseModel[i]);
  for (const s of [0, 1] as Side[]) modelPos(r, s ? r.k.RightFoot : r.k.LeftFoot, r.footIdle[s]);
}

/** Posição atual de uma junta pelo nome (testes e objetos na cena). */
export function jointPos(r: Rig, name: string, out = new THREE.Vector3()): THREE.Vector3 {
  const i = r.bones.findIndex((b) => bare(b.name) === name); if (i < 0) throw new Error(`osso ${name}`);
  return modelPos(r, i, out);
}
