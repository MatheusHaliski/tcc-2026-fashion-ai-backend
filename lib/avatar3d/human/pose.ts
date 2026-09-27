/*
 * Avatar 3D (RF40) — pose natural e movimento parado. O esqueleto nasce em pose "A" (braços abertos a ~45°); a pose
 * de exibição baixa os braços ao lado do corpo, com o cotovelo levemente dobrado, ombros relaxados e dedos soltos.
 * Sobre ela, o movimento parado ("idle") é a soma de ondas lentas de frequências que não se repetem juntas:
 * respiração (tórax e ombros), troca de apoio (quadril, com as pernas compensando para os pés não deslizarem),
 * cabeça olhando em volta e braços acompanhando. Amplitudes de poucos graus: vivo, sem parecer dança.
 * Tudo é rotação de osso — a pele, os olhos, o cabelo e as roupas presos ao mesmo esqueleto acompanham.
 */
import * as THREE from "three";
import type { Human } from "./three-human";

const D = Math.PI / 180;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function worldQuat(b: THREE.Object3D, stop: THREE.Object3D | null): THREE.Quaternion {
  const q = new THREE.Quaternion(); const chain: THREE.Object3D[] = [];
  for (let o: THREE.Object3D | null = b; o && o !== stop; o = o.parent) { if (!(o as THREE.Bone).isBone) break; chain.unshift(o); }
  for (const o of chain) q.multiply(o.quaternion);
  return q;
}
/** Aplica uma rotação dada no espaço do mundo (do avatar) a um osso, depois das rotações dos pais. */
function rotateWorld(b: THREE.Bone, delta: THREE.Quaternion) {
  const parentW = b.parent && (b.parent as THREE.Bone).isBone ? worldQuat(b.parent, null) : new THREE.Quaternion();
  const local = parentW.clone().invert().multiply(delta).multiply(parentW);
  b.quaternion.premultiply(local);
}

export interface PoseState { base: Map<THREE.Bone, THREE.Quaternion>; hips: THREE.Vector3; legLen: number }

const jp = (h: Human, n: string) => { const i = h.bones.indexOf(h.bone(n)); return V(h.rest.joints[i * 3], h.rest.joints[i * 3 + 1], h.rest.joints[i * 3 + 2]); };

/** Pose de exibição: braços ao longo do corpo. Devolve o estado de base para o movimento. */
export function applyRestPose(h: Human, opts: { armOut?: number } = {}): PoseState {
  const armOut = opts.armOut ?? 10;                     // graus entre o braço e o tronco (saia rodada pede mais)
  for (const b of h.bones) b.quaternion.identity();
  for (const [side, s] of [["Left", 1], ["Right", -1]] as const) {
    const S = jp(h, `${side}Arm`), E = jp(h, `${side}ForeArm`), W = jp(h, `${side}Hand`);
    // ombro (clavícula) um pouco para baixo: sem isso o trapézio fica "armado"
    rotateWorld(h.bone(`${side}Shoulder`), new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), -s * 4 * D));
    const up = h.bone(`${side}Arm`);
    const cur = E.clone().sub(S).normalize().applyQuaternion(worldQuat(h.bone(`${side}Shoulder`), null));
    const target = V(s * Math.sin(armOut * D), -Math.cos(armOut * D), 0.035).normalize();
    rotateWorld(up, new THREE.Quaternion().setFromUnitVectors(cur, target));
    // antebraço: cotovelo levemente dobrado para a frente
    const fore = h.bone(`${side}ForeArm`);
    const cf = W.clone().sub(E).normalize().applyQuaternion(worldQuat(up, null));
    const fwd = V(0, 0, 1).sub(target.clone().multiplyScalar(target.z)).normalize();
    const tf = target.clone().multiplyScalar(Math.cos(14 * D)).add(fwd.multiplyScalar(Math.sin(14 * D))).normalize();
    rotateWorld(fore, new THREE.Quaternion().setFromUnitVectors(cf, tf));
    // mão: palma virada para a coxa (giro em torno do antebraço) e punho neutro
    rotateWorld(h.bone(`${side}Hand`), new THREE.Quaternion().setFromAxisAngle(tf, s * 12 * D));
    // dedos soltos, levemente curvos (cada falange um pouco mais), o mínimo dobrando mais que o indicador
    const curlAxis = new THREE.Vector3().crossVectors(tf, V(s, 0, 0)).normalize();
    const FINGER: Record<string, number> = { Index: 0.7, Middle: 0.85, Ring: 1, Pinky: 1.15 };
    for (const f of Object.keys(FINGER)) for (let k = 1; k <= 3; k++) {
      rotateWorld(h.bone(`${side}Hand${f}${k}`), new THREE.Quaternion().setFromAxisAngle(curlAxis.lengthSq() > 0.5 ? curlAxis : V(0, 0, 1), -(3 + k * 3.5) * FINGER[f] * D));
    }
    // polegar junto do indicador (sem "garra")
    rotateWorld(h.bone(`${side}HandThumb1`), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), s * 14 * D));
  }
  // pernas: pés mais próximos (a pose "A" do modelo abre as pernas), pé plano no chão
  for (const [side, s] of [["Left", 1], ["Right", -1]] as const) {
    rotateWorld(h.bone(`${side}UpLeg`), new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), -s * 2.6 * D));
    rotateWorld(h.bone(`${side}Foot`), new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), s * 2.6 * D));
  }
  const base = new Map(h.bones.map((b) => [b, b.quaternion.clone()]));
  const hipJ = jp(h, "LeftUpLeg"), foot = jp(h, "LeftFoot");
  return { base, hips: h.bone("Hips").position.clone(), legLen: hipJ.y - foot.y };
}

/** Refaz a pose de exibição com outro afastamento dos braços (saia/vestido rodado: as mãos passam por fora da saia). */
export function setArmOut(h: Human, st: PoseState, deg: number) {
  const n = applyRestPose(h, { armOut: deg }); st.base.clear(); n.base.forEach((q, b) => st.base.set(b, q));
}

const wave = (t: number, period: number, phase = 0) => Math.sin((2 * Math.PI * t) / period + phase);

/** Movimento parado no instante t (s). `amount` 0 = estátua (reduzir movimento), 1 = normal. */
export function applyIdle(h: Human, st: PoseState, t: number, amount = 1) {
  for (const [b, q] of st.base) b.quaternion.copy(q);
  h.bone("Hips").position.copy(st.hips);
  if (amount <= 0) return;
  const k = amount;
  const breath = wave(t, 4.6);
  const sway = 0.8 * wave(t, 10.5) + 0.2 * wave(t, 5.9, 1.3);
  const look = 0.7 * wave(t, 12.3, 0.4) + 0.3 * wave(t, 7.1, 2.1);
  const nod = wave(t, 8.7, 0.9);
  const Q = (axis: THREE.Vector3, deg: number) => new THREE.Quaternion().setFromAxisAngle(axis, deg * D * k);
  // respiração: o tórax sobe e abre, os ombros acompanham
  rotateWorld(h.bone("Spine1"), Q(V(1, 0, 0), -0.7 * breath));
  rotateWorld(h.bone("Spine2"), Q(V(1, 0, 0), -0.5 * breath));
  rotateWorld(h.bone("LeftShoulder"), Q(V(0, 0, 1), 0.5 * breath));
  rotateWorld(h.bone("RightShoulder"), Q(V(0, 0, 1), -0.5 * breath));
  // troca de apoio: o quadril desliza e inclina; as pernas compensam para os pés ficarem no lugar
  const shift = 0.007 * sway * k; const tilt = 0.9 * sway;
  h.bone("Hips").position.x = st.hips.x + shift;
  rotateWorld(h.bone("Hips"), Q(V(0, 0, 1), tilt));
  rotateWorld(h.bone("Spine"), Q(V(0, 0, 1), -tilt * 0.8));
  const legComp = -tilt - (shift / Math.max(0.5, st.legLen)) / D / Math.max(k, 1e-3);
  rotateWorld(h.bone("LeftUpLeg"), Q(V(0, 0, 1), legComp));
  rotateWorld(h.bone("RightUpLeg"), Q(V(0, 0, 1), legComp));
  rotateWorld(h.bone("LeftFoot"), Q(V(0, 0, 1), -(legComp + tilt)));
  rotateWorld(h.bone("RightFoot"), Q(V(0, 0, 1), -(legComp + tilt)));
  // cabeça: olha em volta devagar e mantém o olhar na horizontal apesar do quadril
  rotateWorld(h.bone("Neck"), Q(V(0, 1, 0), 1.6 * look));
  rotateWorld(h.bone("Head"), Q(V(0, 1, 0), 2.4 * look));
  rotateWorld(h.bone("Head"), Q(V(1, 0, 0), 1.1 * nod));
  rotateWorld(h.bone("Neck"), Q(V(0, 0, 1), -tilt * 0.3));
  // braços: balanço mínimo, em oposição
  const arm = wave(t, 10.5, 0.9);
  rotateWorld(h.bone("LeftArm"), Q(V(1, 0, 0), 1.3 * arm + 0.3 * breath));
  rotateWorld(h.bone("RightArm"), Q(V(1, 0, 0), -1.3 * arm + 0.3 * breath));
  rotateWorld(h.bone("LeftArm"), Q(V(0, 0, 1), 0.5 * breath));
  rotateWorld(h.bone("RightArm"), Q(V(0, 0, 1), -0.5 * breath));
}

/** O mesmo movimento como AnimationClip (para exportar no GLB): `seconds` com `fps` quadros. */
export function idleClip(h: Human, st: PoseState, seconds = 21, fps = 15): THREE.AnimationClip {
  const n = Math.round(seconds * fps) + 1; const times = Float32Array.from({ length: n }, (_, i) => i / fps);
  const q: Record<string, number[]> = {}; const p: number[] = [];
  for (const b of h.bones) q[b.name] = [];
  for (let i = 0; i < n; i++) {
    applyIdle(h, st, times[i], 1);
    for (const b of h.bones) q[b.name].push(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    const hp = h.bone("Hips").position; p.push(hp.x, hp.y, hp.z);
  }
  applyIdle(h, st, 0, 0);
  // pelo uuid do osso: "mixamorig:Hips" tem ":", que o PropertyBinding do three.js reserva (a trilha se perderia)
  const tracks: THREE.KeyframeTrack[] = h.bones.map((b) => new THREE.QuaternionKeyframeTrack(`${b.uuid}.quaternion`, times, q[b.name]));
  tracks.push(new THREE.VectorKeyframeTrack(`${h.bone("Hips").uuid}.position`, times, p));
  return new THREE.AnimationClip("idle", seconds, tracks);
}
