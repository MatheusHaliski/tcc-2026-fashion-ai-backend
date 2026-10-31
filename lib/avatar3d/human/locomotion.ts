/*
 * Avatar 3D — locomoção e gestos procedurais no esqueleto do corpo humano (MakeHuman, nomes do Mixamo), para cenas com
 * muita gente (MET Gala Heist v2). Nada de clipe gravado: cada quadro monta a pose a partir da pose de exibição
 * (pose.ts) com três ferramentas, todas sem alocar memória por quadro:
 *
 *  - rotações no espaço do modelo (como rotateWorld de pose.ts): "inclinar o tronco", "balançar o braço";
 *  - IK de dois ossos (coxa+canela, braço+antebraço): o pé vai aonde o passo manda e a mão vai aonde o gesto manda —
 *    é isso que deixa os pés plantados no chão (sem patinar) e as mãos no lugar certo (celular na orelha, bandeja no
 *    ombro, mãos na cabeça);
 *  - orientação absoluta de mão, pé e cabeça (pé chato no chão, palma para cima sob a bandeja, olhar estável).
 *
 * Eixos do modelo: x = esquerda da pessoa, y = para cima, z = para a frente (o corpo nasce olhando para +z). Na pose de
 * repouso do arquivo (pose "A") todas as rotações são identidade, então o eixo local de cada osso coincide com o do
 * modelo — as direções de repouso (J) valem nos dois.
 *
 * A marcha é o ciclo de dois passos: fase φ ∈ [0, 1), pé esquerdo toca o chão em φ = 0 e o direito em 0,5. O apoio dura
 * β do ciclo; durante o apoio o pé anda para trás exatamente na velocidade do corpo (alcance = β × comprimento do
 * ciclo), por isso ele fica parado no mundo. Velocidade → comprimento do passo e cadência (caminhada até ~1,9 m/s,
 * corrida a partir de ~2,8 m/s, mistura no meio).
 *
 * Poses deitadas (queda, nocaute, jogadora abatida, rastejar): o corpo é montado em pé ("quadro do corpo") e só no fim
 * o quadril gira e desce até o chão — os filhos acompanham.
 */
import * as THREE from "three";

/** Animações que o corpo sabe fazer (as mesmas de Anim em lib/heist/types.ts). */
export type Motion =
  | "idle" | "walk" | "run" | "sneak" | "crouch" | "discreet" | "tired" | "talk" | "phone" | "drink" | "photo" | "cheer"
  | "serve" | "guard" | "aim" | "shoot" | "reload" | "melee" | "stab" | "takedown" | "knockedOut" | "dead" | "downed"
  | "change" | "pickpocket" | "interact" | "climb" | "crawl" | "celebrate" | "dance" | "wave" | "sit" | "queue" | "look"
  | "point" | "cower" | "flee" | "play" | "dj" | "eat";
export const MOTIONS: readonly Motion[] = ["idle", "walk", "run", "sneak", "crouch", "discreet", "tired", "talk", "phone", "drink", "photo", "cheer",
  "serve", "guard", "aim", "shoot", "reload", "melee", "stab", "takedown", "knockedOut", "dead", "downed",
  "change", "pickpocket", "interact", "climb", "crawl", "celebrate", "dance", "wave", "sit", "queue", "look",
  "point", "cower", "flee", "play", "dj", "eat"];
/** Objeto na mão: muda a mão (punho fechado) e alguns gestos (taça → bebe, celular → orelha). */
export type Grip = "pistol" | "knife" | "camera" | "tray" | "phone" | "glass" | "flashlight" | "tablet" | "diamond" | "violin" | "plate" | "headphones" | null;

/** Duração de cada gesto com começo e fim (s); os outros repetem enquanto durarem. */
export const MOTION_DURATION: Partial<Record<Motion, number>> = {
  change: 2.6, takedown: 1.4, knockedOut: 1.6, dead: 1.0, melee: 0.55, stab: 0.6, reload: 1.3, pickpocket: 1.0, celebrate: 3.2, shoot: 0.25,
};
/** Fração da troca de roupa em que as peças trocam (corpo encolhido, braços cruzados na frente). */
export const CHANGE_SWAP_AT = 0.45;

const NAMES = ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head", "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "RightShoulder", "RightArm", "RightForeArm", "RightHand",
  "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase", "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase"] as const;
type Key = typeof NAMES[number];
const FINGERS = ["Index", "Middle", "Ring", "Pinky"] as const;
/** lado: 0 = esquerdo (+x), 1 = direito (−x) */
type Side = 0 | 1;
const SIGN = [1, -1] as const;

export interface Rig {
  bones: THREE.Bone[];
  parent: Int16Array;
  /** pose de exibição local de cada osso (vem de pose.ts: braços ao lado do corpo, dedos soltos) */
  base: THREE.Quaternion[];
  /** posição do quadril na pose de exibição (espaço do modelo) */
  hips0: THREE.Vector3;
  k: Record<Key, number>;
  /** falanges por mão: [dedo][1..3] e o polegar */
  fingers: [number[][], number[][]]; thumbs: [number[], number[]];
  /** juntas de repouso no espaço do modelo (x, y, z por osso) */
  J: Float32Array;
  /** orientação de modelo de cada osso na pose de exibição (pés, mãos, cabeça) */
  baseModel: THREE.Quaternion[];
  /** onde cada pé fica parado na pose de exibição (tornozelo, espaço do modelo) */
  footIdle: [THREE.Vector3, THREE.Vector3];
  /** mão em repouso (pose "A"): direção dos dedos, normal da palma e eixo da flexão dos dedos (local da mão) */
  hand: { f: [THREE.Vector3, THREE.Vector3]; n: [THREE.Vector3, THREE.Vector3]; curl: [THREE.Vector3, THREE.Vector3] };
  dim: { thigh: number; shin: number; upArm: number; foreArm: number; ankle: number; hipH: number; hipHalf: number; toe: number; palm: number; neck: number; head: number; chest: number; shoulderX: number; shoulderY: number };
}

/* ---------- temporários (um conjunto só: o JavaScript da cena roda numa thread) ---------- */
const Q1 = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), Q3 = new THREE.Quaternion(), Q4 = new THREE.Quaternion();
const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), V4 = new THREE.Vector3(), V5 = new THREE.Vector3(), V6 = new THREE.Vector3();
const M1 = new THREE.Matrix4(), M2 = new THREE.Matrix4();
const CHAIN = new Int16Array(24);
const D = Math.PI / 180;

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const hash = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
/** pulso 0→1→0 entre a e b (subida e descida suaves de largura e) */
const pulse = (a: number, b: number, e: number, x: number) => smooth(a, a + e, x) * (1 - smooth(b - e, b, x));

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

/* ---------- cinemática ---------- */
/** Volta à pose de exibição. */
export function reset(r: Rig) {
  for (let i = 0; i < r.bones.length; i++) r.bones[i].quaternion.copy(r.base[i]);
  r.bones[r.k.Hips].position.copy(r.hips0);
}
/** Orientação do osso no espaço do modelo. */
function modelQuat(r: Rig, i: number, out: THREE.Quaternion): THREE.Quaternion {
  let n = 0; for (let b = i; b >= 0; b = r.parent[b]) CHAIN[n++] = b;
  out.identity(); for (let m = n - 1; m >= 0; m--) out.multiply(r.bones[CHAIN[m]].quaternion);
  return out;
}
/** Posição da junta no espaço do modelo. */
function modelPos(r: Rig, i: number, out: THREE.Vector3): THREE.Vector3 {
  let n = 0; for (let b = i; b >= 0; b = r.parent[b]) CHAIN[n++] = b;
  const root = r.bones[CHAIN[n - 1]];
  out.copy(root.position); Q1.copy(root.quaternion);
  for (let m = n - 2; m >= 0; m--) { const b = r.bones[CHAIN[m]]; V6.copy(b.position).applyQuaternion(Q1); out.add(V6); Q1.multiply(b.quaternion); }
  return out;
}
/** Aplica `delta` (rotação no espaço do modelo) ao osso, depois das rotações dos pais. */
function rotQ(r: Rig, i: number, delta: THREE.Quaternion) {
  const p = r.parent[i];
  if (p < 0) { r.bones[i].quaternion.premultiply(delta); return; }
  modelQuat(r, p, Q2); Q3.copy(Q2).invert().multiply(delta).multiply(Q2);
  r.bones[i].quaternion.premultiply(Q3);
}
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
/** Gira o osso em torno de um eixo do modelo (rad). */
function rot(r: Rig, i: number, axis: THREE.Vector3, a: number) { if (a === 0) return; Q4.setFromAxisAngle(axis, a); rotQ(r, i, Q4); }
/** Tronco/cabeça: + inclina para a frente. */
const lean = (r: Rig, i: number, a: number) => rot(r, i, AX, a);
/** Membro pendurado (braço, perna): + balança para a frente. */
const swing = (r: Rig, i: number, a: number) => rot(r, i, AX, -a);
/** + gira para a esquerda da pessoa. */
const twist = (r: Rig, i: number, a: number) => rot(r, i, AY, a);
/** Tronco: + inclina para a direita da pessoa. */
const bank = (r: Rig, i: number, a: number) => rot(r, i, AZ, a);

/** Aponta o segmento i→filho para a direção `d` (espaço do modelo), com peso w. */
function aim(r: Rig, i: number, child: number, d: THREE.Vector3, w = 1) {
  modelQuat(r, i, Q1);
  V5.set(r.J[child * 3] - r.J[i * 3], r.J[child * 3 + 1] - r.J[i * 3 + 1], r.J[child * 3 + 2] - r.J[i * 3 + 2]).normalize().applyQuaternion(Q1);
  V6.copy(d).normalize();
  Q4.setFromUnitVectors(V5, V6); if (w < 1) Q4.slerp(Q1.identity(), 1 - w);
  rotQ(r, i, Q4);
}
/** Coloca o osso numa orientação de modelo `q` (com peso w). */
function orient(r: Rig, i: number, q: THREE.Quaternion, w = 1) {
  const p = r.parent[i];
  if (p >= 0) modelQuat(r, p, Q2); else Q2.identity();
  Q3.copy(Q2).invert().multiply(q);
  if (w >= 1) r.bones[i].quaternion.copy(Q3); else r.bones[i].quaternion.slerp(Q3, w);
}

const IKT = new THREE.Vector3(), IKS = new THREE.Vector3(), IKE = new THREE.Vector3(), IKU = new THREE.Vector3(), IKP = new THREE.Vector3();
/**
 * IK de dois ossos: a junta `c` (punho/tornozelo) vai para `target`; o cotovelo/joelho dobra para o lado de `pole`.
 * Alvo além do alcance: o membro estica na direção dele.
 */
function ik(r: Rig, a: number, b: number, c: number, target: THREE.Vector3, pole: THREE.Vector3) {
  const J = r.J;
  const la = Math.hypot(J[b * 3] - J[a * 3], J[b * 3 + 1] - J[a * 3 + 1], J[b * 3 + 2] - J[a * 3 + 2]);
  const lb = Math.hypot(J[c * 3] - J[b * 3], J[c * 3 + 1] - J[b * 3 + 1], J[c * 3 + 2] - J[b * 3 + 2]);
  modelPos(r, a, IKS);
  IKU.copy(target).sub(IKS); let d = IKU.length();
  if (d < 1e-5) return;
  IKU.multiplyScalar(1 / d);
  d = clamp(d, Math.abs(la - lb) + 1e-3, la + lb - 1e-4);
  IKP.copy(pole).addScaledVector(IKU, -pole.dot(IKU));
  if (IKP.lengthSq() < 1e-8) IKP.set(0, 0, 1).addScaledVector(IKU, -IKU.z);
  IKP.normalize();
  const cosA = clamp((la * la + d * d - lb * lb) / (2 * la * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  IKE.copy(IKS).addScaledVector(IKU, la * cosA).addScaledVector(IKP, la * sinA);
  IKT.copy(IKE).sub(IKS); aim(r, a, b, IKT);
  IKT.copy(IKS).addScaledVector(IKU, d).sub(IKE); aim(r, b, c, IKT);
}

const T1 = new THREE.Vector3(), T2 = new THREE.Vector3(), POLE = new THREE.Vector3();
const FOOTQ = new THREE.Quaternion();
/** Perna: tornozelo no alvo (espaço do modelo), joelho para a frente, pé com `pitch` (+ = ponta para baixo) e a ponta do
 * pé dobrando no apoio (o calcanhar sobe e os dedos ficam no chão). */
function leg(r: Rig, s: Side, x: number, y: number, z: number, pitch = 0, turn = 0, knee = 0) {
  const up = s ? r.k.RightUpLeg : r.k.LeftUpLeg, lg = s ? r.k.RightLeg : r.k.LeftLeg, ft = s ? r.k.RightFoot : r.k.LeftFoot, toe = s ? r.k.RightToeBase : r.k.LeftToeBase;
  T1.set(x, y, z); POLE.set(SIGN[s] * (0.12 + knee), 0, 1);
  ik(r, up, lg, ft, T1, POLE);
  FOOTQ.setFromAxisAngle(AX, pitch); if (turn) { Q4.setFromAxisAngle(AY, turn); FOOTQ.premultiply(Q4); }
  FOOTQ.multiply(r.baseModel[ft]);
  orient(r, ft, FOOTQ);
  if (pitch > 0) rot(r, toe, AX, -pitch * 0.85);
}
/** Braço: punho no alvo, cotovelo para o lado de `pole`. */
function arm(r: Rig, s: Side, target: THREE.Vector3, px: number, py: number, pz: number) {
  POLE.set(px, py, pz);
  if (s) ik(r, r.k.RightArm, r.k.RightForeArm, r.k.RightHand, target, POLE); else ik(r, r.k.LeftArm, r.k.LeftForeArm, r.k.LeftHand, target, POLE);
}
const HF = new THREE.Vector3(), HN = new THREE.Vector3(), HS = new THREE.Vector3(), HF0 = new THREE.Vector3(), HN0 = new THREE.Vector3(), HS0 = new THREE.Vector3();
/** Mão: dedos para `f` e palma para `n` (espaço do modelo). */
function handTo(r: Rig, s: Side, fx: number, fy: number, fz: number, nx: number, ny: number, nz: number, w = 1) {
  HF.set(fx, fy, fz).normalize(); HN.set(nx, ny, nz); HN.addScaledVector(HF, -HN.dot(HF));
  if (HN.lengthSq() < 1e-8) return; HN.normalize(); HS.crossVectors(HF, HN);
  HF0.copy(r.hand.f[s]); HN0.copy(r.hand.n[s]); HS0.crossVectors(HF0, HN0);
  M1.makeBasis(HF, HN, HS); M2.makeBasis(HF0, HN0, HS0).transpose(); M1.multiply(M2);
  Q1.setFromRotationMatrix(M1);
  orient(r, s ? r.k.RightHand : r.k.LeftHand, Q1, w);
}
/** Dedos: 0 = soltos (pose de exibição), 1 = punho fechado. O polegar fecha junto. */
function curl(r: Rig, s: Side, amount: number, thumb = amount) {
  if (amount <= 0 && thumb <= 0) return;
  const ax = r.hand.curl[s];
  for (let f = 0; f < 4; f++) for (let n = 0; n < 3; n++) {
    Q4.setFromAxisAngle(ax, amount * (n === 0 ? 62 : n === 1 ? 88 : 55) * D * (f === 3 ? 1.08 : 1));
    r.bones[r.fingers[s][f][n]].quaternion.multiply(Q4);
  }
  if (thumb > 0) for (let n = 0; n < 3; n++) { Q4.setFromAxisAngle(ax, thumb * (n === 0 ? 18 : 30) * D); r.bones[r.thumbs[s][n]].quaternion.multiply(Q4); }
}
/** Só o indicador esticado (apontar). */
function pointFinger(r: Rig, s: Side) {
  const ax = r.hand.curl[s];
  for (let f = 1; f < 4; f++) for (let n = 0; n < 3; n++) { Q4.setFromAxisAngle(ax, (n === 0 ? 70 : 90) * D); r.bones[r.fingers[s][f][n]].quaternion.multiply(Q4); }
  for (let n = 0; n < 3; n++) { Q4.setFromAxisAngle(ax, -4 * D); r.bones[r.fingers[s][0][n]].quaternion.multiply(Q4); }
}

/* ---------- pontos do corpo (seguem o tronco) ---------- */
const CP = new THREE.Vector3(), CQ = new THREE.Quaternion();
/** Ponto em relação ao peito (Spine2): x esquerda, y para cima, z para a frente — acompanha a inclinação do tronco. */
function chest(r: Rig, x: number, y: number, z: number, out: THREE.Vector3) {
  modelPos(r, r.k.Spine2, CP); modelQuat(r, r.k.Spine2, CQ);
  return out.set(x, y, z).applyQuaternion(CQ).add(CP);
}
/** Ponto em relação à cabeça (junta Head, base do crânio). */
function headPt(r: Rig, x: number, y: number, z: number, out: THREE.Vector3) {
  modelPos(r, r.k.Head, CP); modelQuat(r, r.k.Head, CQ);
  return out.set(x, y, z).applyQuaternion(CQ).add(CP);
}
/** Ponto em relação ao quadril (junta Hips). */
function pelvis(r: Rig, x: number, y: number, z: number, out: THREE.Vector3) {
  modelPos(r, r.k.Hips, CP); modelQuat(r, r.k.Hips, CQ);
  return out.set(x, y, z).applyQuaternion(CQ).add(CP);
}

/* ---------- estado por pessoa ---------- */
export interface MotionState {
  cur: Motion; prev: Motion; since: number; prevT: number; t: number;
  phase: number; speed: number; tired: number; lookYaw: number; lookPitch: number; hitAt: number;
  seed: number; blend: number;
  /** posições dos pés no idle (pequena variação por pessoa) */
  stance: number;
  bufA: Float32Array; bufB: Float32Array;
}
export function newMotionState(rig: Rig, seed = 0, anim: Motion = "idle"): MotionState {
  const n = rig.bones.length * 4 + 3;
  return { cur: anim, prev: anim, since: -10, prevT: 0, t: hash(seed) * 30, phase: hash(seed + 3), speed: 0, tired: 0, lookYaw: 0, lookPitch: 0, hitAt: -1,
    seed, blend: 0.22, stance: hash(seed + 11), bufA: new Float32Array(n), bufB: new Float32Array(n) };
}
export interface MotionInput {
  anim: Motion; animT: number; speed: number;
  /** inclinação da mira (rad, + para cima) */
  aimPitch?: number;
  /** cansaço 0–1 */
  tired?: number;
  /** instante do último tiro levado (no relógio `time`) e o relógio */
  hitAt?: number; time?: number;
  /** para onde olhar, no espaço do modelo (pés da pessoa na origem, olhando para +z); null = olhar livre */
  look?: THREE.Vector3 | null;
  grip?: Grip;
  /** sacar (out) ou guardar a arma da mão direita: segundos desde a troca; a mão passa pelo coldre no quadril */
  draw?: { t: number; out: boolean } | null;
}

function save(r: Rig, buf: Float32Array) {
  for (let i = 0; i < r.bones.length; i++) { const q = r.bones[i].quaternion; buf[i * 4] = q.x; buf[i * 4 + 1] = q.y; buf[i * 4 + 2] = q.z; buf[i * 4 + 3] = q.w; }
  const p = r.bones[r.k.Hips].position, o = r.bones.length * 4; buf[o] = p.x; buf[o + 1] = p.y; buf[o + 2] = p.z;
}
function blendInto(r: Rig, a: Float32Array, b: Float32Array, w: number) {
  for (let i = 0; i < r.bones.length; i++) {
    Q1.set(a[i * 4], a[i * 4 + 1], a[i * 4 + 2], a[i * 4 + 3]); Q2.set(b[i * 4], b[i * 4 + 1], b[i * 4 + 2], b[i * 4 + 3]);
    r.bones[i].quaternion.slerpQuaternions(Q1, Q2, w);
  }
  const o = r.bones.length * 4; r.bones[r.k.Hips].position.set(mix(a[o], b[o], w), mix(a[o + 1], b[o + 1], w), mix(a[o + 2], b[o + 2], w));
}

/** Gestos que deitam o corpo: não recebem olhar, recuo nem mistura com o cansaço. */
const LYING: ReadonlySet<Motion> = new Set(["knockedOut", "dead", "downed", "crawl"]);
/** Gestos que só mexem no tronco e nos braços: as pernas andam se houver velocidade. */
const UPPER: ReadonlySet<Motion> = new Set(["idle", "queue", "look", "talk", "phone", "drink", "photo", "cheer", "serve", "guard", "aim", "shoot", "reload", "point", "wave", "interact", "play", "walk", "run", "tired", "discreet", "flee"]);

/**
 * Um quadro de animação: mistura com o gesto anterior por ~0,2 s, depois olhar e recuo de tiro por cima.
 * `dt` em segundos (até 0,1: quem fica longe é atualizado com menos frequência e recebe o dt acumulado).
 */
export function animate(r: Rig, st: MotionState, inp: MotionInput, dt: number) {
  dt = clamp(dt, 0, 0.1);
  st.t += dt;
  st.speed += (inp.speed - st.speed) * (1 - Math.exp(-dt * 10));
  st.tired += ((inp.tired ?? 0) - st.tired) * (1 - Math.exp(-dt * 2.5));
  if (inp.anim !== st.cur) { st.prev = st.cur; st.prevT = Math.max(st.prevT, 0); st.cur = inp.anim; st.since = st.t; }
  st.prevT += dt;
  // fase da marcha: avança pela distância (pé parado no mundo); parada, a fase congela
  const g = gaitParams(st.cur, st.speed, st.tired);
  st.phase = (st.phase + (st.speed * dt) / g.cycle) % 1;
  const w = smooth(0, st.blend, st.t - st.since);
  if (w < 1) {
    pose(r, st, st.prev, st.prevT, inp); save(r, st.bufA);
    pose(r, st, st.cur, inp.animT, inp); save(r, st.bufB);
    blendInto(r, st.bufA, st.bufB, w);
  } else { pose(r, st, st.cur, inp.animT, inp); st.prevT = inp.animT; }
  if (!LYING.has(st.cur)) { if (inp.draw) drawOverlay(r, inp.draw); lookAt(r, st, inp, dt); flinch(r, st, inp); }
}

/* ---------- marcha ---------- */
interface Gait { cycle: number; beta: number; reach: number; lift: number; run: number; lean: number; crouch: number; armSwing: number; elbow: number; width: number; bob: number; toe: number }
const G: Gait = { cycle: 1, beta: 0.6, reach: 0.8, lift: 0.1, run: 0, lean: 0, crouch: 0, armSwing: 0, elbow: 0, width: 0.8, bob: 0, toe: 0.12 };
/** Parâmetros da passada para a velocidade (m/s) e o estilo. */
function gaitParams(m: Motion, v: number, tired: number): Gait {
  const run = m === "sneak" || m === "crouch" || m === "discreet" ? 0 : smooth(1.9, 2.9, v);
  const sneak = m === "sneak" || m === "crouch" || m === "cower" ? 1 : 0;
  const disc = m === "discreet" ? 1 : 0;
  const walkStep = clamp(0.28 + 0.25 * v, 0.28, 0.8) * (disc ? 0.82 : 1) * (sneak ? 0.72 : 1) * (1 - 0.15 * tired);
  const runStep = clamp(0.55 + 0.21 * v, 0.9, 1.65);
  const step = mix(walkStep, runStep, run);
  G.cycle = 2 * step; G.run = run;
  G.beta = mix(sneak ? 0.68 : 0.62, 0.36, run);
  G.reach = G.beta * G.cycle;
  G.lift = mix(sneak ? 0.07 : 0.085 + 0.02 * v, 0.24 + 0.03 * v, run) * (1 - 0.35 * tired);
  G.lean = mix(2 + 2 * v, 9 + 2 * v, run) * D + (sneak ? 24 * D : 0) + (disc ? 5 * D : 0) + tired * 9 * D;
  G.crouch = sneak ? 0.3 : 0;
  G.armSwing = mix(10 + 9 * v, 34, run) * D * (disc ? 0.2 : 1) * (sneak ? 0.5 : 1);
  G.elbow = mix(14 + 6 * v, 88, run) * D;
  G.width = mix(0.82, 0.55, run);
  G.bob = mix(0.012 + 0.008 * v, 0.045, run);
  return G;
}

const FT = new THREE.Vector3();
/** Pé no ciclo: z (frente, relativo ao quadril), altura do tornozelo acima do normal e inclinação. */
function footCycle(ph: number, g: Gait, out: THREE.Vector3): number {
  const b = g.beta, R = g.reach, back = 0.06 + 0.06 * g.run;
  let pitch: number;
  if (ph < b) {
    const u = ph / b;
    out.z = R * (0.5 - u) - back; out.y = 0;
    // calcanhar tocando (ponta para cima) → pé chato → calcanhar sobe empurrando (ponta para baixo)
    pitch = -14 * D * (1 - smooth(0, 0.18, u)) + 46 * D * smooth(0.6, 1, u) * (1 - 0.4 * g.run);
    out.y = Math.max(0, Math.sin(pitch)) * g.toe;                 // o calcanhar sobe girando sobre a ponta do pé
  } else {
    const u = (ph - b) / (1 - b), s = u - Math.sin(2 * Math.PI * u) / (2 * Math.PI);
    out.z = -R * 0.5 - back + R * s; out.y = g.lift * Math.sin(Math.PI * Math.min(1, u * 1.08)) + 0.035 * (1 - smooth(0, 0.3, u));
    pitch = mix(46 * D * (1 - 0.4 * g.run), -14 * D, smooth(0.15, 0.9, u)) + 25 * D * g.run * Math.sin(Math.PI * u);
  }
  return pitch;
}

/** Pernas e quadril (andando ou parada, de pé ou agachada); o tronco recebe inclinação e contra-rotação. */
function lower(r: Rig, st: MotionState, m: Motion, opts: { crouch?: number; wide?: number; still?: boolean } = {}) {
  const g = gaitParams(m, st.speed, st.tired), d = r.dim;
  const walking = opts.still ? 0 : smooth(0.06, 0.45, st.speed);
  const crouch = Math.max(g.crouch * smooth(0, 0.5, st.speed + 0.5), opts.crouch ?? 0);
  const ph = st.phase, L = d.thigh + d.shin, two = 2 * Math.PI;
  const tired = st.tired;
  // quadril: desce para o alcance da passada, balança de lado, sobe e desce (corrida: mais baixo no apoio)
  g.toe = d.toe * 1.05;
  const front = g.reach * 0.5 - 0.06;
  const reachDrop = 0.5 * walking * Math.max(0, d.hipH - d.ankle - Math.sqrt(Math.max(0.01, (0.99 * L) ** 2 - front * front)));
  const mid = ph - g.beta / 2;
  const bob = walking * g.bob * (g.run > 0.5 ? -Math.cos(4 * Math.PI * mid) : Math.cos(4 * Math.PI * mid));
  // mancar (cansaço): no apoio da perna direita o quadril afunda e o tronco pende para ela
  const rightStance = ph >= 0.5 && ph < 0.5 + g.beta ? Math.sin(Math.PI * (ph - 0.5) / g.beta) : 0;
  const limp = tired * walking * rightStance;
  const sway = walking * (0.022 - 0.012 * g.run) * Math.cos(two * mid);
  const idleShift = (1 - walking) * 0.011 * weightShift(st.t + st.seed * 7);
  const hp = r.bones[r.k.Hips].position;
  hp.set(r.hips0.x + sway + idleShift, r.hips0.y - reachDrop + bob - crouch * L - limp * 0.035 - tired * 0.02, r.hips0.z - crouch * 0.12);
  // rotações da pelve: giro com a perna que avança, queda do lado sem apoio
  twist(r, r.k.Hips, -walking * (5 - 2 * g.run) * D * Math.cos(two * ph));
  bank(r, r.k.Hips, -walking * 3 * D * Math.cos(two * mid) - (1 - walking) * 1.5 * D * weightShift(st.t + st.seed * 7));
  // tronco: inclinação, contra-rotação dos ombros, compensação lateral
  const lean0 = g.lean * mix(0.35, 1, walking) + crouch * 18 * D;
  lean(r, r.k.Spine, lean0 * 0.35); lean(r, r.k.Spine1, lean0 * 0.35); lean(r, r.k.Spine2, lean0 * 0.3);
  twist(r, r.k.Spine2, walking * (6 + 4 * g.run) * D * Math.cos(two * ph));
  bank(r, r.k.Spine, walking * 2 * D * Math.cos(two * mid) - limp * 6 * D);
  // pés: no ciclo andando; parados sob o quadril; mistura pela velocidade
  for (const s of [0, 1] as Side[]) {
    const idle = r.footIdle[s];
    let pitch = footCycle((ph + (s ? 0.5 : 0)) % 1, g, FT);
    const wide = opts.wide ?? 0;
    const x = mix(idle.x * (1 + wide), idle.x * g.width, walking);
    // parada: um pé um pouco à frente (por pessoa), o pé sem peso solto; agachada, os pés abrem e recuam
    const idleZ = idle.z + (s ? -1 : 1) * (st.stance - 0.5) * 0.12 - crouch * 0.05;
    const free = (1 - walking) * Math.max(0, (s ? 1 : -1) * weightShift(st.t + st.seed * 7));
    let z = mix(idleZ + free * 0.02, idle.z + FT.z, walking);
    let y = idle.y + walking * FT.y + free * 0.01;
    pitch = walking * pitch - free * 4 * D;
    // cansaço: a perna direita mal levanta (arrasta) e a esquerda dá um passo curto
    if (tired > 0 && s === 1) { y = mix(y, idle.y + FT.y * 0.45, tired * walking); pitch *= 1 - 0.5 * tired; }
    if (crouch > 0) z -= crouch * 0.02;
    leg(r, s, x + (crouch > 0 ? SIGN[s] * crouch * 0.06 : 0), y, z, pitch, SIGN[s] * (6 * D + crouch * 10 * D), crouch * 0.3);
  }
  return { walking, g };
}
/** Troca de apoio com pausa (pose.ts): −1…1 (+ = peso na perna esquerda). */
function weightShift(t: number): number {
  const w = (p: number, ph = 0) => Math.sin((2 * Math.PI * t) / p + ph);
  return Math.tanh(2.2 * (0.85 * w(13.5) + 0.15 * w(5.9, 1.3))) / Math.tanh(2.2);
}

/** Braços balançando na marcha (oposição às pernas) ou soltos parada. */
function armsFree(r: Rig, st: MotionState, walking: number, g: Gait, k = 1) {
  const ph = st.phase, c = Math.cos(2 * Math.PI * ph), br = Math.sin((2 * Math.PI * st.t) / 4.6);
  for (const s of [0, 1] as Side[]) {
    const sgn = s ? -1 : 1;                     // braço direito vai à frente com a perna esquerda (φ = 0)
    const sw = walking * g.armSwing * k * sgn * c;
    swing(r, s ? r.k.RightArm : r.k.LeftArm, sw + (1 - walking) * 1.2 * D * Math.sin((2 * Math.PI * st.t) / 10.5 + s * 2));
    rot(r, s ? r.k.RightArm : r.k.LeftArm, AZ, -SIGN[s] * (walking * g.run * 6 * D) + SIGN[s] * 0.5 * D * br);
    swing(r, s ? r.k.RightForeArm : r.k.LeftForeArm, walking * (g.elbow + Math.max(0, sw) * 0.6) + (1 - walking) * 2 * D);
    if (g.run > 0.3 && walking > 0.3) curl(r, s, 0.55 * g.run);
  }
}

/** Respiração e a cabeça olhando em volta (parada). */
function breathe(r: Rig, st: MotionState, amount = 1, heavy = 0) {
  const f = mix(4.6, 1.6, heavy), b = Math.sin((2 * Math.PI * st.t) / f);
  lean(r, r.k.Spine1, -(0.9 + heavy * 2.4) * D * b * amount); lean(r, r.k.Spine2, -(0.6 + heavy * 1.6) * D * b * amount);
  rot(r, r.k.LeftShoulder, AZ, (0.6 + heavy * 1.8) * D * b * amount); rot(r, r.k.RightShoulder, AZ, -(0.6 + heavy * 1.8) * D * b * amount);
}
function idleHead(r: Rig, st: MotionState, amount = 1) {
  const t = st.t + st.seed * 3.1;
  const look = 0.7 * Math.sin((2 * Math.PI * t) / 12.3 + 0.4) + 0.3 * Math.sin((2 * Math.PI * t) / 7.1 + 2.1);
  const P = 10.5, kk = Math.floor(t / P), ph = t - kk * P, on = smooth(0.6, 1.8, ph) * (1 - smooth(4.4, 5.8, ph));
  const gl = (hash(kk + st.seed) > 0.5 ? 1 : -1) * (8 + 14 * hash(kk + 7 + st.seed)) * on;
  twist(r, r.k.Neck, (2.5 * look + 0.4 * gl) * D * amount); twist(r, r.k.Head, (3 * look + 0.6 * gl) * D * amount);
  lean(r, r.k.Head, 1.2 * D * Math.sin((2 * Math.PI * t) / 8.7 + 0.9) * amount);
}
/** Cabeça estável: desfaz parte da inclinação do tronco (olhar no horizonte), + `pitch` (+ = olhar para baixo). */
function headLevel(r: Rig, pitch = 0, w = 0.75) {
  modelQuat(r, r.k.Head, Q1); V1.set(0, 0, 1).applyQuaternion(Q1);
  const cur = Math.asin(clamp(-V1.y, -1, 1));                   // + = olhando para baixo
  lean(r, r.k.Neck, (pitch - cur) * w * 0.4); lean(r, r.k.Head, (pitch - cur) * w * 0.6);
}

/* ---------- poses ---------- */
const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();

function pose(r: Rig, st: MotionState, m: Motion, t: number, inp: MotionInput) {
  reset(r);
  const grip = inp.grip ?? null;
  switch (m) {
    case "knockedOut": case "dead": fall(r, st, m, t); return;
    case "downed": downed(r, st, t); return;
    case "crawl": crawl(r, st, t); return;
    case "sit": sit(r, st, t, grip); return;
    case "climb": climb(r, st, t); return;
    case "change": change(r, st, t); return;
    case "celebrate": celebrate(r, st, t); return;
    case "dance": dance(r, st, t); return;
    case "takedown": takedown(r, st, t); return;
    case "cower": cower(r, st, t); return;
    case "crouch": case "sneak": { const { walking, g } = lower(r, st, "sneak", { crouch: m === "crouch" && st.speed < 0.2 ? 0.34 : 0 }); crouchArms(r, st, walking, g, grip); headLevel(r, 4 * D); return; }
    case "pickpocket": pickpocket(r, st, t); return;
    case "melee": case "stab": strike(r, st, m, t, grip); return;
    default: break;
  }
  if (!UPPER.has(m)) { stand(r, st, grip); return; }
  // pernas: andam com a velocidade; o estilo da passada vem do gesto
  const style: Motion = m === "discreet" || m === "flee" ? m : m === "tired" ? "walk" : st.speed > 2.4 ? "run" : "walk";
  const { walking, g } = lower(r, st, style, { wide: m === "guard" || m === "aim" || m === "shoot" ? 0.25 : 0 });
  const heavy = st.tired;
  breathe(r, st, 1 - walking * 0.5, heavy);
  switch (m) {
    case "aim": case "shoot": aimPose(r, st, m, t, inp); break;
    case "reload": reload(r, st, t); break;
    case "talk": armsFree(r, st, walking, g, 0.6); talk(r, st, t, walking); break;
    case "phone": armsFree(r, st, walking, g, 0.6); phone(r, st, t); break;
    case "drink": armsFree(r, st, walking, g, 0.7); drink(r, st, t); break;
    case "photo": photo(r, st, t); break;
    case "cheer": cheer(r, st, t, grip); break;
    case "serve": armsFree(r, st, walking, g, 0.7); serve(r, st); break;
    case "guard": guardHands(r, st, walking); break;
    case "point": armsFree(r, st, walking, g, 0.5); point(r, st, inp); break;
    case "wave": armsFree(r, st, walking, g, 0.5); wave(r, st, t); break;
    case "interact": interact(r, st, t); break;
    case "play": play(r, st, t); break;
    // provisórios até a animação própria: DJ mexendo no console (mãos à frente) e comer (mão à boca, como beber)
    case "dj": interact(r, st, t); break;
    case "eat": armsFree(r, st, walking, g, 0.7); drink(r, st, t); break;
    case "discreet": discreet(r, st, walking); break;
    case "flee": armsFree(r, st, walking, g, 1.25); twist(r, r.k.Neck, 28 * D * pulse(0.5, 1.5, 0.3, (st.t + st.seed) % 3.2)); break;
    default:
      armsFree(r, st, walking, g, 1);
      if (grip) holdIdle(r, st, grip, walking);
      if (walking < 0.5) idleHead(r, st, 1 - walking * 2);
  }
  if (heavy > 0.02 && m !== "aim" && m !== "shoot") tiredOverlay(r, st, walking, heavy);
  if (m !== "discreet") headLevel(r, (4 + st.tired * 10) * D, 0.65);
}

/** Parada sem gesto: pernas da pose de exibição com a troca de apoio, respiração e olhar em volta. */
function stand(r: Rig, st: MotionState, grip: Grip) {
  const { walking, g } = lower(r, st, "idle", { still: true });
  breathe(r, st, 1); armsFree(r, st, walking, g, 1); idleHead(r, st);
  if (grip) holdIdle(r, st, grip, 0);
  headLevel(r, 3 * D, 0.5);
}

/** Objeto na mão sem gesto próprio: taça e celular à frente do corpo, bandeja no ombro, pistola apontada para baixo. */
function holdIdle(r: Rig, st: MotionState, grip: Grip, walking: number) {
  switch (grip) {
    case "glass": drink(r, st, st.t + st.seed * 5); break;
    case "phone": case "tablet": textHold(r, st, grip); break;
    case "tray": serve(r, st); break;
    case "pistol": case "flashlight": lowReady(r, st, grip); break;
    case "knife": curl(r, 1, 0.9, 0.7); break;
    case "camera": chest(r, -0.06, -0.12, 0.26, A); arm(r, 1, A, -0.5, -1, -0.6); handTo(r, 1, -0.1, -0.3, 1, 0.8, 0, 0); curl(r, 1, 0.6, 0.4); break;
    case "diamond": chest(r, 0.08, 0.05, 0.3, A); arm(r, 0, A, 0.5, -1, -0.4); handTo(r, 0, -0.2, 0.3, 1, -0.3, 1, 0); curl(r, 0, 0.45, 0.3); break;
    case "violin": play(r, st, st.t); break;
    default: break;
  }
  void walking;
}
/** Celular/tablet na frente do peito, olhando para a tela. */
function textHold(r: Rig, st: MotionState, grip: Grip) {
  const tab = grip === "tablet";
  chest(r, -0.05, -0.14, 0.3, A); arm(r, 1, A, -0.6, -1, -0.5); handTo(r, 1, 0.15, 0.55, 0.8, 0.25, 0.6, -0.75); curl(r, 1, 0.55, 0.35);
  if (tab) { chest(r, 0.08, -0.16, 0.29, B); arm(r, 0, B, 0.6, -1, -0.5); handTo(r, 0, -0.15, 0.5, 0.8, -0.25, 0.6, -0.75); curl(r, 0, 0.5, 0.3); }
  lean(r, r.k.Neck, 10 * D); lean(r, r.k.Head, 14 * D);
  void st;
}
/** Pistola/lanterna baixa, junto ao corpo, cano para o chão à frente. */
function lowReady(r: Rig, st: MotionState, grip: Grip) {
  chest(r, -0.12, -0.32, 0.22, A); arm(r, 1, A, -0.6, -1, -0.3); handTo(r, 1, 0, -0.65, 0.75, 0.95, 0, 0); curl(r, 1, 0.85, 0.6);
  if (grip === "pistol") { chest(r, -0.04, -0.34, 0.2, B); arm(r, 0, B, 0.6, -1, -0.3); handTo(r, 0, -0.3, -0.6, 0.7, -0.9, -0.2, 0); curl(r, 0, 0.6, 0.4); }
  void st;
}

/** Agachada (parada ou andando): braços à frente, levemente dobrados, prontos. */
function crouchArms(r: Rig, st: MotionState, walking: number, g: Gait, grip: Grip) {
  armsFree(r, st, walking, g, 0.5);
  for (const s of [0, 1] as Side[]) { swing(r, s ? r.k.RightArm : r.k.LeftArm, 18 * D); swing(r, s ? r.k.RightForeArm : r.k.LeftForeArm, 28 * D); }
  if (grip === "pistol" || grip === "knife" || grip === "flashlight") lowReady(r, st, grip);
  breathe(r, st, 0.8);
}

/** Caminhada discreta: passo curto, cabeça baixa, ombros fechados, mãos juntas à frente. */
function discreet(r: Rig, st: MotionState, walking: number) {
  rot(r, r.k.LeftShoulder, AY, -5 * D); rot(r, r.k.RightShoulder, AY, 5 * D);
  rot(r, r.k.LeftShoulder, AZ, 3 * D); rot(r, r.k.RightShoulder, AZ, -3 * D);
  pelvis(r, 0.02, -0.08, 0.17, A); arm(r, 0, A, 0.6, -1, -0.8); handTo(r, 0, -0.6, -0.75, 0.25, -0.2, 0.1, -0.95); curl(r, 0, 0.45);
  pelvis(r, -0.03, -0.1, 0.16, B); arm(r, 1, B, -0.6, -1, -0.8); handTo(r, 1, 0.6, -0.75, 0.25, 0.2, 0.1, -0.95); curl(r, 1, 0.35);
  headLevel(r, (17 + 4 * walking) * D, 0.9);
  twist(r, r.k.Head, 6 * D * Math.sin((2 * Math.PI * (st.t + st.seed)) / 5.3));
}

/** Cansaço (vida baixa): tronco curvado, mão esquerda no flanco direito, ombros caídos, respiração pesada. Parada e
 * muito cansada, apoia as mãos nos joelhos. */
function tiredOverlay(r: Rig, st: MotionState, walking: number, k: number) {
  lean(r, r.k.Spine1, 8 * D * k); lean(r, r.k.Spine2, 6 * D * k); bank(r, r.k.Spine2, -5 * D * k);
  rot(r, r.k.LeftShoulder, AZ, -4 * D * k); rot(r, r.k.RightShoulder, AZ, 4 * D * k);
  const still = 1 - walking;
  if (k > 0.55 && still > 0.7) {
    // recuperando o fôlego: mãos nos joelhos
    const w = smooth(0.55, 0.85, k) * still;
    lean(r, r.k.Spine, 22 * D * w); lean(r, r.k.Spine1, 14 * D * w); r.bones[r.k.Hips].position.y -= 0.05 * w;
    for (const s of [0, 1] as Side[]) { modelPos(r, s ? r.k.RightLeg : r.k.LeftLeg, A); A.y += 0.06; A.z += 0.06; A.x += SIGN[s] * 0.02; arm(r, s, A, SIGN[s] * 0.6, -0.2, -1); handTo(r, s, 0, -1, 0.3, -SIGN[s] * 0.2, 0, -1, 0.8); curl(r, s, 0.35); }
    return;
  }
  chest(r, -0.11, -0.2, 0.11, A); arm(r, 0, A, 0.7, -0.6, -0.4); handTo(r, 0, -0.95, -0.2, 0.1, 0, 0, -1, 0.9); curl(r, 0, 0.25);
}

/** Mira com as duas mãos (pistola): braço direito estendido seguindo a inclinação, esquerda apoiando; recuo no tiro. */
function aimPose(r: Rig, st: MotionState, m: Motion, t: number, inp: MotionInput) {
  const p = clamp(inp.aimPitch ?? 0, -0.9, 0.9);
  const kick = m === "shoot" ? Math.exp(-t / 0.07) * (t < 0.4 ? 1 : 0) : 0;
  const sway = st.tired * 0.03;
  twist(r, r.k.Hips, 12 * D); twist(r, r.k.Spine1, -8 * D); twist(r, r.k.Spine2, -6 * D);
  lean(r, r.k.Spine2, -p * 0.25 - kick * 2 * D);
  const cp = Math.cos(p), sp = Math.sin(p);
  const reach = (r.dim.upArm + r.dim.foreArm) * 0.97 - kick * 0.05;
  modelPos(r, r.k.RightArm, A); modelPos(r, r.k.LeftArm, B); C.addVectors(A, B).multiplyScalar(0.5);
  const sx = Math.sin(st.t * 1.7 + st.seed) * sway, sy = Math.cos(st.t * 1.3) * sway;
  A.set(C.x - 0.02 + sx, C.y + sp * reach + sy + kick * 0.03, C.z + cp * reach);
  arm(r, 1, A, -0.5, -1, 0); handTo(r, 1, 0, sp + kick * 0.25, cp, 0.97, 0, 0); curl(r, 1, 0.92, 0.7);
  B.set(A.x + 0.05, A.y - 0.04, A.z - 0.05);
  arm(r, 0, B, 0.6, -1, 0); handTo(r, 0, -0.3, sp - 0.2, cp, -0.95, 0.1, 0); curl(r, 0, 0.75, 0.5);
  headLevel(r, -p * 0.7, 0.9);
}
/** Recarregar: pistola no peito, mão esquerda vai ao quadril (pente) e volta à coronha. */
function reload(r: Rig, st: MotionState, t: number) {
  chest(r, -0.05, -0.06, 0.32, A); arm(r, 1, A, -0.6, -1, -0.2); handTo(r, 1, 0.15, 0.35, 0.9, 0.9, 0, -0.2); curl(r, 1, 0.9, 0.7);
  const down = pulse(0.12, 0.62, 0.15, t), up = smooth(0.55, 0.85, t);
  chest(r, 0.0, -0.13 - 0.06 * up, 0.3, B);                    // coronha (embaixo da pistola)
  pelvis(r, 0.16, 0.0, 0.05, C);                               // pente no cinto
  A.copy(B).lerp(C, down);
  arm(r, 0, A, 0.6, -1, -0.4); handTo(r, 0, -0.4, 0.6 - down, 0.6, -0.8, 0, 0.2); curl(r, 0, 0.7, 0.5);
  lean(r, r.k.Head, 16 * D); twist(r, r.k.Spine2, -4 * D);
  void st;
}
/** Soco (mãos) e facada (faca): preparo, golpe rápido, volta; quadril e tronco giram junto. */
function strike(r: Rig, st: MotionState, m: Motion, t: number, grip: Grip) {
  const { walking, g } = lower(r, st, "walk", { wide: 0.35 });
  armsFree(r, st, walking, g, 0.4);
  const dur = MOTION_DURATION[m] ?? 0.55, u = t / dur;
  const wind = smooth(0, 0.25, u) * (1 - smooth(0.25, 0.4, u)), hit = smooth(0.25, 0.42, u) * (1 - smooth(0.6, 1, u));
  twist(r, r.k.Spine1, (12 * wind - 22 * hit) * D); twist(r, r.k.Hips, (-6 * wind + 10 * hit) * D); lean(r, r.k.Spine2, 8 * hit * D);
  if (m === "stab") {
    // faca: sobe acima do ombro e desce à frente, na altura do peito do outro
    chest(r, -0.18, 0.28, 0.05, A); chest(r, -0.05, 0.0, 0.55, B); A.lerp(B, hit);
    arm(r, 1, A, -0.7, -0.4, -0.6); handTo(r, 1, 0, mix(0.6, -0.2, hit), 1, 1, 0.2, 0); curl(r, 1, 0.95, 0.8);
  } else {
    // soco: punho junto ao queixo, cruzado à frente
    chest(r, -0.1, 0.12, 0.18, A); chest(r, 0.02, 0.14, 0.6, B); A.lerp(B, hit);
    arm(r, 1, A, -0.8, -0.6, -0.2); handTo(r, 1, 0, 0.05, 1, 0.9, 0, 0); curl(r, 1, 1, 0.9);
  }
  chest(r, 0.12, 0.13, 0.22, C); arm(r, 0, C, 0.8, -0.6, -0.2); handTo(r, 0, -0.2, 0.3, 0.9, -0.8, 0, 0); curl(r, 0, 1, 0.9);   // guarda
  headLevel(r, 2 * D, 0.8); void grip;
}

/** Conversa: gestos das mãos na altura da cintura/peito, de vez em quando um aceno de cabeça. */
function talk(r: Rig, st: MotionState, t: number, walking: number) {
  if (walking > 0.5) {
    // andando e conversando: a cabeça vira para o lado de quem acompanha e uma das mãos gesticula curto, de vez em quando
    const tt = st.t + st.seed * 2.3, side = hash(st.seed + 21) > 0.5 ? 1 : -1;
    twist(r, r.k.Spine2, side * 5 * D); twist(r, r.k.Neck, side * 12 * D); twist(r, r.k.Head, side * (14 + 6 * Math.sin(tt * 0.8)) * D);
    const gest = smooth(0.45, 0.85, Math.sin(tt * 1.1) * 0.5 + 0.5);
    if (gest > 0.01) { const s: Side = side > 0 ? 0 : 1; swing(r, s ? r.k.RightForeArm : r.k.LeftForeArm, 38 * D * gest); rot(r, s ? r.k.RightHand : r.k.LeftHand, AY, SIGN[s] * 25 * D * gest); }
    lean(r, r.k.Head, 3 * D * Math.sin(tt * 2.2) * gest);
    return;
  }
  const tt = st.t + st.seed * 2.3, burst = smooth(0.2, 0.6, Math.sin(tt * 0.9) * 0.5 + 0.5);
  const side: Side = hash(Math.floor(tt / 2.4) + st.seed) > 0.5 ? 1 : 0;
  const k = burst * (1 - walking);
  chest(r, SIGN[side] * 0.12, -0.2 + 0.06 * Math.sin(tt * 3.1), 0.27 + 0.04 * Math.sin(tt * 2.3), A);
  V1.copy(A); modelPos(r, side ? r.k.RightHand : r.k.LeftHand, A); A.lerp(V1, k);
  arm(r, side, A, SIGN[side] * 0.7, -1, -0.3);
  handTo(r, side, SIGN[side] * -0.1, 0.25, 1, SIGN[side] * -0.2, 0.9, 0, k * 0.9); curl(r, side, 0.2);
  lean(r, r.k.Head, 3 * D * Math.sin(tt * 2.2) * burst); twist(r, r.k.Head, 4 * D * Math.sin(tt * 0.7));
  void t;
}
/** Celular na orelha (falando) ou na mão (lendo), conforme a pessoa. */
function phone(r: Rig, st: MotionState, t: number) {
  if (hash(st.seed + 17) < 0.45) { textHold(r, st, "phone"); return; }
  headPt(r, -0.085, 0.04, 0.02, A); arm(r, 1, A, -0.4, -1, 0.2); handTo(r, 1, 0, 1, 0.2, 0.95, 0, 0.2); curl(r, 1, 0.55, 0.4);
  bank(r, r.k.Head, -4 * D); twist(r, r.k.Head, 5 * D * Math.sin((st.t + st.seed) * 0.5));
  void t;
}
/** Taça na mão esquerda, na altura do peito; um gole a cada ~7 s. */
function drink(r: Rig, st: MotionState, t: number) {
  const tt = (st.t + st.seed * 4.7) % 7, sip = pulse(0.3, 2.2, 0.5, tt);
  chest(r, 0.12, -0.18, 0.25, A); headPt(r, 0.01, 0.0, 0.13, B); A.lerp(B, sip * 0.92);
  arm(r, 0, A, 0.8, -1, -0.3); handTo(r, 0, -0.85, 0.2 + 0.4 * sip, 0.4, -0.25, 0, -0.95); curl(r, 0, 0.62, 0.45);
  lean(r, r.k.Head, -9 * D * sip);
  void t;
}
/** Fotógrafo: câmera no rosto com as duas mãos, cotovelos abertos; varre um pouco o tapete. */
function photo(r: Rig, st: MotionState, t: number) {
  const tt = st.t + st.seed;
  twist(r, r.k.Spine1, 10 * D * Math.sin(tt * 0.6)); twist(r, r.k.Spine2, 8 * D * Math.sin(tt * 0.6 + 0.3));
  headPt(r, -0.07, 0.03, 0.15, A); arm(r, 1, A, -1, -0.4, -0.2); handTo(r, 1, 0.1, 0.9, 0.3, 0.95, 0, -0.1); curl(r, 1, 0.6, 0.4);
  headPt(r, 0.06, -0.02, 0.17, B); arm(r, 0, B, 1, -0.6, -0.2); handTo(r, 0, -0.3, 0.2, 1, -0.2, 1, 0); curl(r, 0, 0.45, 0.2);
  lean(r, r.k.Head, 4 * D);
  void t;
}
/** Fã: celular no alto filmando (ou os dois braços acenando), pulinhos. */
function cheer(r: Rig, st: MotionState, t: number, grip: Grip) {
  const tt = st.t + st.seed * 1.7, bounce = Math.max(0, Math.sin(tt * 5.2));
  r.bones[r.k.Hips].position.y += 0.02 * bounce * (hash(st.seed + 5) > 0.5 ? 1 : 0.3);
  if (grip === "phone" || hash(st.seed + 9) < 0.5) {
    headPt(r, -0.12, 0.3 + 0.05 * Math.sin(tt * 1.3), 0.32, A); arm(r, 1, A, -1, 0, -0.4); handTo(r, 1, 0, 1, 0.1, 0.1, 0, -1); curl(r, 1, 0.55, 0.4);
    chest(r, 0.2, -0.25, 0.1, B); arm(r, 0, B, 0.6, -1, -0.3); curl(r, 0, 0.3);
  } else {
    for (const s of [0, 1] as Side[]) {
      headPt(r, SIGN[s] * (0.25 + 0.07 * Math.sin(tt * 4 + s * 2)), 0.42, 0.05, A); arm(r, s, A, SIGN[s], 0, -0.5); handTo(r, s, 0, 1, 0, 0, 0, 1); curl(r, s, 0.15);
    }
  }
  lean(r, r.k.Head, -6 * D);
  void t;
}
/** Garçom: bandeja na mão esquerda, palma para cima na altura do ombro; braço direito solto atrás. */
function serve(r: Rig, st: MotionState) {
  chest(r, 0.21, 0.04, 0.24, A); arm(r, 0, A, 0.7, -1, -0.4); handTo(r, 0, -0.35, 0, 0.94, 0, 1, 0); curl(r, 0, 0.12, 0);
  pelvis(r, -0.1, -0.02, -0.16, B); arm(r, 1, B, -0.5, -1, 0.3); handTo(r, 1, 0, -0.6, -0.8, 0, 0, -1, 0.6); curl(r, 1, 0.35);
  void st;
}
/** Segurança em posto: pés afastados, mãos cruzadas à frente da pelve, cabeça varrendo devagar. */
function guardHands(r: Rig, st: MotionState, walking: number) {
  if (walking > 0.5) { armsFree(r, st, walking, gaitParams("walk", st.speed, st.tired), 0.6); return; }
  pelvis(r, -0.015, -0.11, 0.16, A); arm(r, 1, A, -0.7, -1, -0.6); handTo(r, 1, 0.75, -0.55, 0.2, 0.2, 0.1, -0.95); curl(r, 1, 0.55);
  pelvis(r, 0.035, -0.09, 0.175, B); arm(r, 0, B, 0.7, -1, -0.6); handTo(r, 0, -0.75, -0.5, 0.25, -0.2, 0.05, -0.95); curl(r, 0, 0.25);
  const tt = st.t + st.seed * 3;
  twist(r, r.k.Neck, 14 * D * Math.sin(tt * 0.33)); twist(r, r.k.Head, 16 * D * Math.sin(tt * 0.33 + 0.4));
}
/** Apontar para o alvo de olhar (ou para a frente). */
function point(r: Rig, st: MotionState, inp: MotionInput) {
  modelPos(r, r.k.RightArm, A);
  if (inp.look) V1.copy(inp.look).sub(A).normalize(); else V1.set(-0.1, 0.05, 1).normalize();
  B.copy(A).addScaledVector(V1, r.dim.upArm + r.dim.foreArm - 0.03);
  arm(r, 1, B, -0.4, -1, 0); handTo(r, 1, V1.x, V1.y, V1.z, 0.2, 0, 0); pointFinger(r, 1);
  twist(r, r.k.Spine2, -8 * D);
  void st;
}
/** Aceno: braço direito no alto, antebraço indo e vindo. */
function wave(r: Rig, st: MotionState, t: number) {
  const tt = st.t * 6.5;
  chest(r, -0.38 - 0.06 * Math.sin(tt), 0.36, 0.12, A); arm(r, 1, A, -1, -0.6, -0.2); handTo(r, 1, -0.25 * Math.sin(tt), 1, 0.15, 0, 0, 1); curl(r, 1, 0.1);
  void t;
}
/** Mexer em painel/teclado/mesa: mãos à frente na altura do peito, dedos "digitando". */
function interact(r: Rig, st: MotionState, t: number) {
  const tt = st.t * 7;
  for (const s of [0, 1] as Side[]) {
    chest(r, SIGN[s] * 0.1, -0.12 + 0.015 * Math.sin(tt + s * 1.7), 0.38, A); arm(r, s, A, SIGN[s] * 0.7, -1, -0.3);
    handTo(r, s, -SIGN[s] * 0.2, -0.1, 1, 0, -0.3, 1, 0.9); curl(r, s, 0.25 + 0.1 * Math.sin(tt * 1.3 + s));
  }
  lean(r, r.k.Spine2, 6 * D); lean(r, r.k.Head, 12 * D);
  void t;
}
/** Violino: instrumento entre o ombro esquerdo e o queixo, mão esquerda no braço, direita arcando. */
function play(r: Rig, st: MotionState, t: number) {
  const tt = st.t + st.seed;
  bank(r, r.k.Head, 10 * D); twist(r, r.k.Head, 14 * D); lean(r, r.k.Head, 8 * D);
  chest(r, 0.18, 0.2, 0.42, A); arm(r, 0, A, 0.8, -1, 0); handTo(r, 0, -0.3, 0.6, 0.6, -0.6, 0, 0.4); curl(r, 0, 0.55, 0.3);
  const bow = Math.sin(tt * 2.6);
  chest(r, -0.08 + 0.2 * bow, 0.1 + 0.02 * bow, 0.3, B); arm(r, 1, B, -1, -0.6, -0.4); handTo(r, 1, 0.9, 0, 0.3, 0, -1, 0); curl(r, 1, 0.45, 0.4);
  twist(r, r.k.Spine2, 4 * D * bow);
  void t;
}

/** Bater carteira: mão direita alcança a bolsa de quem está à frente, tronco inclina, volta rápido. */
function pickpocket(r: Rig, st: MotionState, t: number) {
  const { walking, g } = lower(r, st, "sneak", { crouch: 0.08 });
  armsFree(r, st, walking, g, 0.3);
  const u = t / (MOTION_DURATION.pickpocket ?? 1), reach = smooth(0.05, 0.45, u) * (1 - smooth(0.62, 0.95, u));
  lean(r, r.k.Spine1, 12 * D * reach);
  pelvis(r, -0.12, 0.0, 0.12, A); pelvis(r, -0.06, 0.02, 0.55, B); A.lerp(B, reach);
  arm(r, 1, A, -0.6, -1, -0.3); handTo(r, 1, 0, -0.5, 1, 0.3, -0.2, 0.9); curl(r, 1, mix(0.2, 0.6, smooth(0.4, 0.6, u)), 0.5);
  twist(r, r.k.Head, 18 * D * Math.sin(u * 9)); headLevel(r, 12 * D, 0.8);
}

/**
 * Troca de roupa (2,6 s): olha em volta com timidez, agacha, cruza os braços no tronco (a peça troca em ~45 %, com o
 * corpo encolhido), ajeita a roupa subindo, ajeita o cabelo e se endireita.
 */
function change(r: Rig, st: MotionState, t: number) {
  const dur = MOTION_DURATION.change ?? 2.6, u = clamp(t / dur, 0, 1);
  const down = smooth(0.08, 0.32, u) * (1 - smooth(0.62, 0.86, u));
  lower(r, st, "idle", { still: true, crouch: 0.36 * down, wide: 0.1 * down });
  breathe(r, st, 1);
  // ombros sobem e fecham (timidez)
  const shy = smooth(0, 0.15, u) * (1 - smooth(0.85, 1, u));
  rot(r, r.k.LeftShoulder, AZ, 5 * D * shy); rot(r, r.k.RightShoulder, AZ, -5 * D * shy);
  rot(r, r.k.LeftShoulder, AY, -6 * D * shy); rot(r, r.k.RightShoulder, AY, 6 * D * shy);
  lean(r, r.k.Spine1, 16 * D * down); lean(r, r.k.Spine2, 12 * D * down);
  // braços: cruzam no peito (mãos nos ombros opostos) → descem alisando as laterais → uma mão ajeita o cabelo
  const cross = smooth(0.12, 0.3, u) * (1 - smooth(0.58, 0.7, u));
  const smoothSides = pulse(0.6, 0.84, 0.08, u), hair = pulse(0.8, 1, 0.07, u);
  for (const s of [0, 1] as Side[]) {
    chest(r, -SIGN[s] * 0.12, 0.08, 0.1, A);                                  // mão no ombro do outro lado
    pelvis(r, SIGN[s] * 0.17, -0.02 - 0.18 * smooth(0.6, 0.84, u), 0.02, B);  // alisa a lateral do quadril
    modelPos(r, s ? r.k.RightHand : r.k.LeftHand, C);
    C.lerp(A, cross); C.lerp(B, smoothSides);
    if (s === 1 && hair > 0) { headPt(r, -0.08, 0.16, -0.04, B); C.lerp(B, hair); }
    arm(r, s, C, SIGN[s] * 0.8, -1, -0.4);
    handTo(r, s, -SIGN[s], 0.2, 0.2, 0, 0, -1, cross * 0.8); curl(r, s, 0.25);
  }
  // cabeça: espia para os lados, baixa no meio
  const peek = Math.sin(u * Math.PI * 4.2) * (1 - down * 0.6);
  twist(r, r.k.Neck, 22 * D * peek * smooth(0, 0.1, u)); twist(r, r.k.Head, 18 * D * peek);
  lean(r, r.k.Head, 18 * D * down);
}

/** Comemorando com o diamante: antecipação, pulinho com o punho no ar, giro e um rebolado. */
function celebrate(r: Rig, st: MotionState, t: number) {
  const pre = pulse(0, 0.5, 0.2, t), jump = pulse(0.45, 0.95, 0.15, t), spin = smooth(1.0, 1.65, t), groove = smooth(1.6, 1.9, t);
  const { walking, g } = lower(r, st, "idle", { still: true, crouch: 0.12 * pre });
  void walking; void g;
  r.bones[r.k.Hips].position.y += 0.1 * jump;
  // giro de 360° (os pés giram junto: o giro entra no quadril e os pés, presos aos alvos, viram com ele)
  twist(r, r.k.Hips, spin * Math.PI * 2);
  const beat = Math.sin((t - 1.6) * Math.PI * 2.4) * groove;
  r.bones[r.k.Hips].position.x += 0.04 * beat; bank(r, r.k.Spine, -5 * D * beat); twist(r, r.k.Spine2, 8 * D * beat);
  // punho direito no alto (soquinho no ar no ritmo)
  const pump = 0.06 * Math.max(0, Math.sin((t - 0.4) * Math.PI * 3)) * smooth(0.4, 0.6, t);
  headPt(r, -0.2, 0.32 + pump, 0.05, A); arm(r, 1, A, -1, -0.3, -0.4); handTo(r, 1, 0, 1, 0.1, 0.3, 0, 1); curl(r, 1, 1, 0.9);
  // diamante na esquerda, perto do rosto, olhando para ele
  headPt(r, 0.1, 0.04, 0.3, B); arm(r, 0, B, 0.7, -1, -0.3); handTo(r, 0, -0.3, 0.6, 0.7, -0.4, 0.2, -0.8); curl(r, 0, 0.5, 0.35);
  twist(r, r.k.Head, 12 * D * (1 - groove)); lean(r, r.k.Head, -6 * D);
}
/** Dança na pista: passo de lado, quadril, braços para cima alternando. */
function dance(r: Rig, st: MotionState, t: number) {
  const tt = st.t * 2 * Math.PI * 1.05 + st.seed, s1 = Math.sin(tt);
  lower(r, st, "idle", { still: true, wide: 0.35 });
  r.bones[r.k.Hips].position.x += 0.05 * s1; r.bones[r.k.Hips].position.y -= 0.03 * Math.abs(Math.cos(tt));
  bank(r, r.k.Spine, -7 * D * s1); twist(r, r.k.Spine1, 8 * D * Math.sin(tt * 0.5));
  for (const s of [0, 1] as Side[]) {
    const up = 0.5 + 0.5 * Math.sin(tt + s * Math.PI);
    chest(r, SIGN[s] * 0.28, mix(-0.1, 0.45, up), 0.15, A); arm(r, s, A, SIGN[s], -0.4, -0.4); curl(r, s, 0.3);
  }
  lean(r, r.k.Head, 4 * D * Math.cos(tt));
  void t;
}
/** Abaixar e proteger a cabeça (pânico): agachada, mãos na nuca, tremendo. */
function cower(r: Rig, st: MotionState, t: number) {
  const k = smooth(0, 0.35, t);
  lower(r, st, "idle", { still: true, crouch: 0.4 * k, wide: 0.2 * k });
  lean(r, r.k.Spine1, 26 * D * k); lean(r, r.k.Spine2, 20 * D * k); lean(r, r.k.Head, 24 * D * k);
  const shake = 0.008 * Math.sin(st.t * 31) * k;
  for (const s of [0, 1] as Side[]) {
    headPt(r, SIGN[s] * 0.07, 0.16 + shake, -0.06, A); modelPos(r, s ? r.k.RightHand : r.k.LeftHand, B); B.lerp(A, k);
    arm(r, s, B, SIGN[s], 0.2, 0.6); handTo(r, s, -SIGN[s] * 0.6, 0.3, -0.6, 0, -1, 0, k * 0.8); curl(r, s, 0.35);
  }
}
/** Imobilização por trás: braços em volta do pescoço do outro, puxa para trás. */
function takedown(r: Rig, st: MotionState, t: number) {
  const k = smooth(0, 0.25, t), pull = smooth(0.35, 0.9, t) * (1 - smooth(1.1, 1.4, t));
  lower(r, st, "idle", { still: true, crouch: 0.1 * k, wide: 0.3 });
  lean(r, r.k.Spine1, (10 * k - 14 * pull) * D); lean(r, r.k.Spine2, 6 * k * D);
  chest(r, -0.04, 0.12, 0.36, A); arm(r, 1, A, -1, -0.3, 0); handTo(r, 1, 1, 0, 0.2, 0, 0, -1, 0.8); curl(r, 1, 0.7);
  chest(r, 0.12, 0.16, 0.3, B); arm(r, 0, B, 1, -0.3, 0); handTo(r, 0, -0.8, 0.4, 0.4, 0, 0, -1, 0.8); curl(r, 0, 0.9);
  twist(r, r.k.Head, 10 * D * pull);
  void st;
}

/* ---------- poses deitadas e sentadas ---------- */
/** Queda: nocaute (luta 0,6 s e cai de lado) ou abatido (cai de costas). Termina deitado, imóvel. */
function fall(r: Rig, st: MotionState, m: Motion, t: number) {
  const ko = m === "knockedOut", t0 = ko ? 0.65 : 0;
  // luta (nocaute): mãos no braço que estrangula, tronco sacudindo
  if (ko && t < t0 + 0.1) {
    const k = smooth(0, 0.2, t);
    lean(r, r.k.Spine1, -10 * D * k); lean(r, r.k.Head, -12 * D * k);
    for (const s of [0, 1] as Side[]) { headPt(r, SIGN[s] * 0.05, -0.06, 0.12, A); arm(r, s, A, SIGN[s], -0.5, 0); curl(r, s, 0.7); }
    twist(r, r.k.Spine2, 8 * D * Math.sin(t * 25));
  }
  const f = smooth(t0, t0 + 0.75, t), ff = f * f;
  // corpo no quadro dele: joelhos dobram e a queda vai juntando os membros
  const knees = (ko ? 40 : 25) * D * smooth(t0, t0 + 0.4, t);
  for (const s of [0, 1] as Side[]) {
    swing(r, s ? r.k.RightUpLeg : r.k.LeftUpLeg, knees * (s ? 0.6 : 1.1)); swing(r, s ? r.k.RightLeg : r.k.LeftLeg, -knees * (s ? 1.2 : 1.8));
    // de costas: braços abertos no chão; de lado: os dois braços caem à frente do corpo (nada entra no piso)
    if (ko) { swing(r, s ? r.k.RightArm : r.k.LeftArm, (s ? 70 : 45) * D * ff); swing(r, s ? r.k.RightForeArm : r.k.LeftForeArm, 50 * D * ff); }
    else if (ff > 0.3) { rot(r, s ? r.k.RightArm : r.k.LeftArm, AZ, SIGN[s] * 55 * D * ff); swing(r, s ? r.k.RightForeArm : r.k.LeftForeArm, 35 * D * ff); }
    curl(r, s, 0.3 * ff);
  }
  lean(r, r.k.Head, (ko ? 10 : -15) * D * ff); twist(r, r.k.Head, (hash(st.seed) > 0.5 ? 1 : -1) * 35 * D * ff);
  // o quadril cai: de lado (nocaute) ou de costas (tiro)
  const lie = 0.2;
  const hp = r.bones[r.k.Hips].position;
  // (o quadril vai para o lado da queda: os pés ficam perto de onde a pessoa estava)
  if (ko) { const side = hash(st.seed + 2) > 0.5 ? 1 : -1; hp.set(r.hips0.x - side * 0.62 * ff, mix(r.hips0.y, lie, ff), r.hips0.z); bank(r, r.k.Hips, side * 88 * D * ff); }
  else { hp.set(r.hips0.x, mix(r.hips0.y, lie - 0.04, ff), r.hips0.z - 0.55 * ff); lean(r, r.k.Hips, -86 * D * ff); }
}
/** Jogadora abatida: deitada de lado, joelhos dobrados, um braço sob a cabeça, respirando fraco. */
function downed(r: Rig, st: MotionState, t: number) {
  const f = smooth(0, 0.9, t), ff = f * f;
  const b = Math.sin(st.t * 2 * Math.PI / 3.2);
  lean(r, r.k.Spine1, (8 + 1.2 * b) * D * f); lean(r, r.k.Spine2, (6 + 0.8 * b) * D * f); lean(r, r.k.Head, 14 * D * f);
  swing(r, r.k.LeftUpLeg, 55 * D * f); swing(r, r.k.LeftLeg, -80 * D * f);
  swing(r, r.k.RightUpLeg, 25 * D * f); swing(r, r.k.RightLeg, -45 * D * f);
  // braço de baixo (direito) estendido acima da cabeça; o de cima (esquerdo) caído à frente do corpo
  swing(r, r.k.RightArm, 150 * D * f); rot(r, r.k.RightArm, AZ, -10 * D * f); swing(r, r.k.RightForeArm, 25 * D * f);
  swing(r, r.k.LeftArm, 55 * D * f); rot(r, r.k.LeftArm, AZ, -25 * D * f); swing(r, r.k.LeftForeArm, 40 * D * f);
  curl(r, 0, 0.35 + 0.05 * b); curl(r, 1, 0.25);
  const hp = r.bones[r.k.Hips].position;
  hp.set(r.hips0.x + 0.05 * ff, mix(r.hips0.y, 0.21, ff), r.hips0.z);
  bank(r, r.k.Hips, 86 * D * ff);                                    // deita sobre o lado direito (cabeça para −x)
}
/** Rastejar de bruços (duto): cotovelos e joelhos alternando. */
function crawl(r: Rig, st: MotionState, t: number) {
  const ph = (st.t * mix(0.5, 1.3, smooth(0, 0.6, st.speed))) * 2 * Math.PI, s1 = Math.sin(ph);
  lean(r, r.k.Head, -55 * D);
  for (const s of [0, 1] as Side[]) {
    const k = s ? -s1 : s1;
    swing(r, s ? r.k.RightArm : r.k.LeftArm, (150 + 18 * k) * D); rot(r, s ? r.k.RightArm : r.k.LeftArm, AZ, SIGN[s] * 20 * D);
    swing(r, s ? r.k.RightForeArm : r.k.LeftForeArm, (60 - 20 * k) * D);
    // perna "de sapo": a coxa abre de lado (de bruços, a flexão para a frente enfiaria o joelho no chão)
    const u = 0.5 + 0.5 * k;
    rot(r, s ? r.k.RightUpLeg : r.k.LeftUpLeg, AZ, SIGN[s] * (10 + 26 * u) * D); swing(r, s ? r.k.RightUpLeg : r.k.LeftUpLeg, -4 * D);
    swing(r, s ? r.k.RightLeg : r.k.LeftLeg, (-35 - 40 * u) * D);
    curl(r, s, 0.4);
  }
  r.bones[r.k.Hips].position.set(r.hips0.x + 0.03 * s1, 0.22, r.hips0.z);
  lean(r, r.k.Hips, 86 * D);
  void t;
}
/** Sentada (sofá do lounge, banco do terraço): quadril na altura do assento, pés no chão à frente, mãos nas coxas. */
function sit(r: Rig, st: MotionState, t: number, grip: Grip) {
  const hp = r.bones[r.k.Hips].position, seat = 0.46;
  hp.set(r.hips0.x, seat + 0.08, r.hips0.z - 0.18);
  lean(r, r.k.Spine, -6 * D); lean(r, r.k.Spine2, 4 * D);
  for (const s of [0, 1] as Side[]) leg(r, s, r.footIdle[s].x * 1.25, r.dim.ankle, 0.34 + (s ? 0.04 : -0.03) * (st.stance - 0.5), 0, SIGN[s] * 8 * D, 0.2);
  breathe(r, st, 1); idleHead(r, st);
  if (grip === "glass") drink(r, st, t);
  else for (const s of [0, 1] as Side[]) { modelPos(r, s ? r.k.RightLeg : r.k.LeftLeg, A); A.x -= SIGN[s] * 0.02; A.y += 0.08; A.z -= 0.1; arm(r, s, A, SIGN[s] * 0.5, -1, -0.5); handTo(r, s, 0, -0.2, 1, 0, -1, 0, 0.8); curl(r, s, 0.3); }
}
/** Escalada (escada de incêndio, janela): de frente para a parede, mãos e pés alternando nos degraus. */
function climb(r: Rig, st: MotionState, t: number) {
  const ph = t * 1.25 * 2 * Math.PI, s1 = Math.sin(ph);
  const hp = r.bones[r.k.Hips].position; hp.y = r.hips0.y - 0.06;
  lean(r, r.k.Spine1, 6 * D); lean(r, r.k.Head, -12 * D);
  for (const s of [0, 1] as Side[]) {
    const k = s ? -s1 : s1;
    const up = 0.5 + 0.5 * k;
    leg(r, s, r.footIdle[s].x, r.dim.ankle + 0.05 + 0.3 * up, 0.16 + 0.08 * up, -10 * D * up, 0, 0.1);
    headPt(r, SIGN[s] * 0.2, 0.32 + 0.22 * (1 - up), 0.26, A); arm(r, s, A, SIGN[s] * 0.7, -1, -0.4); handTo(r, s, 0, 0.3, 1, 0, -0.2, 1, 0.8); curl(r, s, 0.8, 0.5);
  }
}

/* ---------- camadas por cima ---------- */
/** Duração de sacar/guardar a arma (s). */
export const DRAW_TIME = 0.42;
const DQ = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
/**
 * Sacar a arma: a mão direita sai do coldre (quadril direito, um pouco atrás) e chega à pose do gesto; guardar: a mão
 * vai ao coldre e volta. A pose do gesto já está nos ossos; aqui só se mistura com a pose do coldre.
 */
function drawOverlay(r: Rig, d: { t: number; out: boolean }) {
  if (d.t < 0 || d.t > DRAW_TIME) return;
  const k = d.out ? smooth(0, DRAW_TIME, d.t) : 1 - pulse(0, DRAW_TIME, DRAW_TIME * 0.4, d.t);
  if (k >= 0.999) return;
  const ids = [r.k.RightArm, r.k.RightForeArm, r.k.RightHand];
  for (let i = 0; i < 3; i++) DQ[i].copy(r.bones[ids[i]].quaternion);
  pelvis(r, -0.19, -0.03, -0.05, A); arm(r, 1, A, -0.7, -1, 0.5); handTo(r, 1, 0.05, -1, 0.15, 0.95, 0, -0.2);
  for (let i = 0; i < 3; i++) r.bones[ids[i]].quaternion.slerp(DQ[i], k);
}

const LOOK = new THREE.Vector3();
/** Olhar para um ponto (cabeça, pescoço e um pouco do peito), com limite e suavização. */
function lookAt(r: Rig, st: MotionState, inp: MotionInput, dt: number) {
  let yaw = 0, pitch = 0;
  if (inp.look) {
    modelPos(r, r.k.Head, LOOK); LOOK.subVectors(inp.look, LOOK);
    yaw = clamp(Math.atan2(LOOK.x, LOOK.z), -80 * D, 80 * D); pitch = clamp(Math.atan2(-LOOK.y, Math.hypot(LOOK.x, LOOK.z)), -35 * D, 35 * D);
  }
  const k = 1 - Math.exp(-dt * 6);
  st.lookYaw += (yaw - st.lookYaw) * k; st.lookPitch += (pitch - st.lookPitch) * k;
  if (Math.abs(st.lookYaw) < 1e-3 && Math.abs(st.lookPitch) < 1e-3) return;
  twist(r, r.k.Spine2, st.lookYaw * 0.18); twist(r, r.k.Neck, st.lookYaw * 0.35); twist(r, r.k.Head, st.lookYaw * 0.47);
  lean(r, r.k.Neck, st.lookPitch * 0.4); lean(r, r.k.Head, st.lookPitch * 0.6);
}
/** Recuo ao levar um tiro: tronco para trás, ombros encolhem, cabeça sacode. */
function flinch(r: Rig, st: MotionState, inp: MotionInput) {
  if (inp.hitAt === undefined || inp.hitAt < 0 || inp.time === undefined) return;
  const e = inp.time - inp.hitAt; if (e < 0 || e > 0.6) return;
  const k = Math.exp(-e / 0.11) * (1 - smooth(0.4, 0.6, e));
  const side = hash(Math.floor(inp.hitAt * 13) + st.seed) > 0.5 ? 1 : -1;
  lean(r, r.k.Spine1, -9 * D * k); lean(r, r.k.Spine2, -6 * D * k); twist(r, r.k.Spine2, side * 9 * D * k);
  rot(r, r.k.LeftShoulder, AZ, 6 * D * k); rot(r, r.k.RightShoulder, AZ, -6 * D * k);
  lean(r, r.k.Head, -10 * D * k); bank(r, r.k.Head, side * 6 * D * k);
  // cambaleio: o corpo recua alguns centímetros, desce um pouco e pende para o lado do impacto
  const hp = r.bones[r.k.Hips].position; hp.z -= 0.045 * k; hp.y -= 0.025 * k; hp.x += side * 0.02 * k;
  bank(r, r.k.Spine1, -side * 4 * D * k);
}

/** Posição atual de uma junta pelo nome (testes e objetos na cena). */
export function jointPos(r: Rig, name: string, out = new THREE.Vector3()): THREE.Vector3 {
  const i = r.bones.findIndex((b) => bare(b.name) === name); if (i < 0) throw new Error(`osso ${name}`);
  return modelPos(r, i, out);
}
