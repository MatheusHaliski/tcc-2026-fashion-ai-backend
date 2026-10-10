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
const smooth = (a: number, b: number, x: number) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const hash = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/**
 * Olhada para o lado (gesto): a cada ~10,5 s a cabeça vira devagar para um lado (5–10°), fica ~2,5 s e volta. Sorteio
 * determinístico por ciclo. Devolve o giro (graus, + = esquerda da pessoa) e o quanto o gesto está ativo (0–1).
 */
export function glance(t: number): { yaw: number; on: number } {
  const P = 10.5; const k = Math.floor(t / P); const ph = t - k * P;
  const on = smooth(0.6, 1.8, ph) * (1 - smooth(4.4, 5.8, ph));
  return { yaw: (hash(k) > 0.5 ? 1 : -1) * (5 + 5 * hash(k + 7)) * on, on };
}

/**
 * Troca de apoio com pausa: o peso fica numa perna e passa para a outra (tanh de uma senoide: anda, para, anda),
 * em vez de balançar sem parar como um metrônomo. −1…1 (+ = peso na perna esquerda).
 */
export function weightShift(t: number): number {
  return Math.tanh(2.2 * (0.85 * wave(t, 13.5) + 0.15 * wave(t, 5.9, 1.3))) / Math.tanh(2.2);
}

/** Movimento parado no instante t (s). `amount` 0 = estátua (reduzir movimento), 1 = normal. */
export function applyIdle(h: Human, st: PoseState, t: number, amount = 1) {
  for (const [b, q] of st.base) b.quaternion.copy(q);
  h.bone("Hips").position.copy(st.hips);
  if (amount <= 0) return;
  const k = amount;
  const breath = wave(t, 4.6);
  const sway = weightShift(t);
  const look = 0.7 * wave(t, 12.3, 0.4) + 0.3 * wave(t, 7.1, 2.1);
  const nod = wave(t, 8.7, 0.9);
  const g = glance(t);
  const Q = (axis: THREE.Vector3, deg: number) => new THREE.Quaternion().setFromAxisAngle(axis, deg * D * k);
  // respiração: o tórax sobe e abre, os ombros acompanham
  rotateWorld(h.bone("Spine1"), Q(V(1, 0, 0), -0.9 * breath));
  rotateWorld(h.bone("Spine2"), Q(V(1, 0, 0), -0.6 * breath));
  rotateWorld(h.bone("LeftShoulder"), Q(V(0, 0, 1), 0.6 * breath));
  rotateWorld(h.bone("RightShoulder"), Q(V(0, 0, 1), -0.6 * breath));
  // troca de apoio: o quadril desliza para a perna de apoio, cai do lado livre e gira um pouco; o tronco compensa
  // (contraposto) e as pernas compensam para os pés ficarem no lugar; o joelho da perna livre relaxa
  const shift = 0.011 * sway * k; const tilt = 1.5 * sway;
  h.bone("Hips").position.x = st.hips.x + shift;
  rotateWorld(h.bone("Hips"), Q(V(0, 0, 1), tilt));
  rotateWorld(h.bone("Hips"), Q(V(0, 1, 0), 1.2 * sway));
  rotateWorld(h.bone("Spine"), Q(V(0, 0, 1), -tilt * 0.75));
  rotateWorld(h.bone("Spine2"), Q(V(0, 1, 0), -1.4 * sway));
  const legComp = -tilt - (shift / Math.max(0.5, st.legLen)) / D / Math.max(k, 1e-3);
  rotateWorld(h.bone("LeftUpLeg"), Q(V(0, 0, 1), legComp));
  rotateWorld(h.bone("RightUpLeg"), Q(V(0, 0, 1), legComp));
  rotateWorld(h.bone("LeftFoot"), Q(V(0, 0, 1), -(legComp + tilt)));
  rotateWorld(h.bone("RightFoot"), Q(V(0, 0, 1), -(legComp + tilt)));
  // perna sem peso: joelho solto — a coxa vem um pouco à frente e a canela volta o dobro, então o pé fica no lugar (só
  // o calcanhar sobe); dobrar só o joelho arrastava o pé ~4 cm para trás (patinando)
  const freeL = Math.max(0, -sway), freeR = Math.max(0, sway);
  for (const [side, f] of [["Left", freeL], ["Right", freeR]] as const) {
    rotateWorld(h.bone(`${side}UpLeg`), Q(V(1, 0, 0), -2.6 * f));
    rotateWorld(h.bone(`${side}Leg`), Q(V(1, 0, 0), 5.2 * f));
    rotateWorld(h.bone(`${side}Foot`), Q(V(1, 0, 0), -2.6 * f));
  }
  // cabeça: olha em volta devagar, de vez em quando vira para um lado (o cabelo atrasa e volta: hair-motion.ts) e
  // mantém o olhar na horizontal apesar do quadril
  rotateWorld(h.bone("Neck"), Q(V(0, 1, 0), 1.6 * look + 0.4 * g.yaw));
  rotateWorld(h.bone("Head"), Q(V(0, 1, 0), 2.4 * look + 0.6 * g.yaw));
  rotateWorld(h.bone("Head"), Q(V(1, 0, 0), 1.1 * nod));
  rotateWorld(h.bone("Head"), Q(V(0, 0, 1), -0.18 * g.yaw));
  rotateWorld(h.bone("Neck"), Q(V(0, 0, 1), -tilt * 0.35));
  // braços: balanço mínimo, em oposição, seguindo o tronco; antebraço e dedos respiram junto
  const arm = wave(t, 10.5, 0.9);
  rotateWorld(h.bone("LeftArm"), Q(V(1, 0, 0), 1.3 * arm + 0.3 * breath));
  rotateWorld(h.bone("RightArm"), Q(V(1, 0, 0), -1.3 * arm + 0.3 * breath));
  rotateWorld(h.bone("LeftArm"), Q(V(0, 0, 1), 0.5 * breath + 0.6 * sway));
  rotateWorld(h.bone("RightArm"), Q(V(0, 0, 1), -0.5 * breath + 0.6 * sway));
  rotateWorld(h.bone("LeftForeArm"), Q(V(1, 0, 0), 1.2 * wave(t, 9.3, 0.2)));
  rotateWorld(h.bone("RightForeArm"), Q(V(1, 0, 0), 1.2 * wave(t, 9.3, 2.4)));
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

export type TestPose = "repouso" | "bracos" | "caminhada" | "agachamento";

/**
 * Poses de verificação do provador (PROVADOR-3D): braços erguidos à frente, passo de caminhada (t = fase do passo, 0–1)
 * e agachamento. Não fazem parte do movimento parado: servem para medir interseção e estiramento da roupa em movimento.
 */
export function applyTestPose(h: Human, st: PoseState, kind: TestPose, t = 0.25) {
  for (const [b, q] of st.base) b.quaternion.copy(q);
  h.bone("Hips").position.copy(st.hips);
  const X = V(1, 0, 0), Y = V(0, 1, 0);
  const Q = (axis: THREE.Vector3, deg: number) => new THREE.Quaternion().setFromAxisAngle(axis, deg * D);
  if (kind === "bracos") {
    // braços à frente quase na horizontal, cotovelo solto
    rotateWorld(h.bone("LeftArm"), Q(X, -80)); rotateWorld(h.bone("RightArm"), Q(X, -80));
    rotateWorld(h.bone("LeftShoulder"), Q(V(0, 0, 1), 4)); rotateWorld(h.bone("RightShoulder"), Q(V(0, 0, 1), -4));
  } else if (kind === "caminhada") {
    const s = Math.sin(2 * Math.PI * t);
    rotateWorld(h.bone("LeftUpLeg"), Q(X, -24 * s)); rotateWorld(h.bone("RightUpLeg"), Q(X, 24 * s));
    rotateWorld(h.bone("LeftLeg"), Q(X, 8 + 26 * Math.max(0, -s))); rotateWorld(h.bone("RightLeg"), Q(X, 8 + 26 * Math.max(0, s)));
    rotateWorld(h.bone("LeftArm"), Q(X, 16 * s)); rotateWorld(h.bone("RightArm"), Q(X, -16 * s));
    rotateWorld(h.bone("Hips"), Q(Y, 5 * s)); rotateWorld(h.bone("Spine1"), Q(Y, -4 * s));
  } else if (kind === "agachamento") {
    // coxas para a frente, canelas para trás, tronco inclinado e braços à frente para equilibrar; o quadril desce
    rotateWorld(h.bone("LeftUpLeg"), Q(X, -70)); rotateWorld(h.bone("RightUpLeg"), Q(X, -70));
    rotateWorld(h.bone("LeftLeg"), Q(X, 105)); rotateWorld(h.bone("RightLeg"), Q(X, 105));
    rotateWorld(h.bone("LeftFoot"), Q(X, -35)); rotateWorld(h.bone("RightFoot"), Q(X, -35));
    rotateWorld(h.bone("Spine"), Q(X, -18));
    rotateWorld(h.bone("LeftArm"), Q(X, -70)); rotateWorld(h.bone("RightArm"), Q(X, -70));
    h.bone("Hips").position.y = st.hips.y - st.legLen * 0.36;
  }
}
