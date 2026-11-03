/*
 * Avatar 3D — locomoção: cinemática do esqueleto. Rotações no espaço do modelo, IK de dois ossos, orientação de
 * mão/pé, dedos e pontos do corpo que seguem o tronco. Ver locomotion.ts.
 */
import * as THREE from "three";
import { type Rig, type Side, SIGN } from "./locomotion-model";
import { CHAIN, clamp, D, M1, M2, Q1, Q2, Q3, Q4, V5, V6 } from "./locomotion-math";

/* ---------- cinemática ---------- */
/** Volta à pose de exibição. */
export function reset(r: Rig) {
  for (let i = 0; i < r.bones.length; i++) r.bones[i].quaternion.copy(r.base[i]);
  r.bones[r.k.Hips].position.copy(r.hips0);
}
/** Orientação do osso no espaço do modelo. */
export function modelQuat(r: Rig, i: number, out: THREE.Quaternion): THREE.Quaternion {
  let n = 0; for (let b = i; b >= 0; b = r.parent[b]) CHAIN[n++] = b;
  out.identity(); for (let m = n - 1; m >= 0; m--) out.multiply(r.bones[CHAIN[m]].quaternion);
  return out;
}
/** Posição da junta no espaço do modelo. */
export function modelPos(r: Rig, i: number, out: THREE.Vector3): THREE.Vector3 {
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
export const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
/** Gira o osso em torno de um eixo do modelo (rad). */
export function rot(r: Rig, i: number, axis: THREE.Vector3, a: number) { if (a === 0) return; Q4.setFromAxisAngle(axis, a); rotQ(r, i, Q4); }
/** Tronco/cabeça: + inclina para a frente. */
export const lean = (r: Rig, i: number, a: number) => rot(r, i, AX, a);
/** Membro pendurado (braço, perna): + balança para a frente. */
export const swing = (r: Rig, i: number, a: number) => rot(r, i, AX, -a);
/** + gira para a esquerda da pessoa. */
export const twist = (r: Rig, i: number, a: number) => rot(r, i, AY, a);
/** Tronco: + inclina para a direita da pessoa. */
export const bank = (r: Rig, i: number, a: number) => rot(r, i, AZ, a);

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
export function leg(r: Rig, s: Side, x: number, y: number, z: number, pitch = 0, turn = 0, knee = 0) {
  const up = s ? r.k.RightUpLeg : r.k.LeftUpLeg, lg = s ? r.k.RightLeg : r.k.LeftLeg, ft = s ? r.k.RightFoot : r.k.LeftFoot, toe = s ? r.k.RightToeBase : r.k.LeftToeBase;
  T1.set(x, y, z); POLE.set(SIGN[s] * (0.12 + knee), 0, 1);
  ik(r, up, lg, ft, T1, POLE);
  FOOTQ.setFromAxisAngle(AX, pitch); if (turn) { Q4.setFromAxisAngle(AY, turn); FOOTQ.premultiply(Q4); }
  FOOTQ.multiply(r.baseModel[ft]);
  orient(r, ft, FOOTQ);
  if (pitch > 0) rot(r, toe, AX, -pitch * 0.85);
}
/** Braço: punho no alvo, cotovelo para o lado de `pole`. */
export function arm(r: Rig, s: Side, target: THREE.Vector3, px: number, py: number, pz: number) {
  POLE.set(px, py, pz);
  if (s) ik(r, r.k.RightArm, r.k.RightForeArm, r.k.RightHand, target, POLE); else ik(r, r.k.LeftArm, r.k.LeftForeArm, r.k.LeftHand, target, POLE);
}
const HF = new THREE.Vector3(), HN = new THREE.Vector3(), HS = new THREE.Vector3(), HF0 = new THREE.Vector3(), HN0 = new THREE.Vector3(), HS0 = new THREE.Vector3();
/** Mão: dedos para `f` e palma para `n` (espaço do modelo). */
export function handTo(r: Rig, s: Side, fx: number, fy: number, fz: number, nx: number, ny: number, nz: number, w = 1) {
  HF.set(fx, fy, fz).normalize(); HN.set(nx, ny, nz); HN.addScaledVector(HF, -HN.dot(HF));
  if (HN.lengthSq() < 1e-8) return; HN.normalize(); HS.crossVectors(HF, HN);
  HF0.copy(r.hand.f[s]); HN0.copy(r.hand.n[s]); HS0.crossVectors(HF0, HN0);
  M1.makeBasis(HF, HN, HS); M2.makeBasis(HF0, HN0, HS0).transpose(); M1.multiply(M2);
  Q1.setFromRotationMatrix(M1);
  orient(r, s ? r.k.RightHand : r.k.LeftHand, Q1, w);
}
/** Dedos: 0 = soltos (pose de exibição), 1 = punho fechado. O polegar fecha junto. */
export function curl(r: Rig, s: Side, amount: number, thumb = amount) {
  if (amount <= 0 && thumb <= 0) return;
  const ax = r.hand.curl[s];
  for (let f = 0; f < 4; f++) for (let n = 0; n < 3; n++) {
    Q4.setFromAxisAngle(ax, amount * (n === 0 ? 62 : n === 1 ? 88 : 55) * D * (f === 3 ? 1.08 : 1));
    r.bones[r.fingers[s][f][n]].quaternion.multiply(Q4);
  }
  if (thumb > 0) for (let n = 0; n < 3; n++) { Q4.setFromAxisAngle(ax, thumb * (n === 0 ? 18 : 30) * D); r.bones[r.thumbs[s][n]].quaternion.multiply(Q4); }
}
/** Só o indicador esticado (apontar). */
export function pointFinger(r: Rig, s: Side) {
  const ax = r.hand.curl[s];
  for (let f = 1; f < 4; f++) for (let n = 0; n < 3; n++) { Q4.setFromAxisAngle(ax, (n === 0 ? 70 : 90) * D); r.bones[r.fingers[s][f][n]].quaternion.multiply(Q4); }
  for (let n = 0; n < 3; n++) { Q4.setFromAxisAngle(ax, -4 * D); r.bones[r.fingers[s][0][n]].quaternion.multiply(Q4); }
}

/* ---------- pontos do corpo (seguem o tronco) ---------- */
const CP = new THREE.Vector3(), CQ = new THREE.Quaternion();
/** Ponto em relação ao peito (Spine2): x esquerda, y para cima, z para a frente — acompanha a inclinação do tronco. */
export function chest(r: Rig, x: number, y: number, z: number, out: THREE.Vector3) {
  modelPos(r, r.k.Spine2, CP); modelQuat(r, r.k.Spine2, CQ);
  return out.set(x, y, z).applyQuaternion(CQ).add(CP);
}
/** Ponto em relação à cabeça (junta Head, base do crânio). */
export function headPt(r: Rig, x: number, y: number, z: number, out: THREE.Vector3) {
  modelPos(r, r.k.Head, CP); modelQuat(r, r.k.Head, CQ);
  return out.set(x, y, z).applyQuaternion(CQ).add(CP);
}
/** Ponto em relação ao quadril (junta Hips). */
export function pelvis(r: Rig, x: number, y: number, z: number, out: THREE.Vector3) {
  modelPos(r, r.k.Hips, CP); modelQuat(r, r.k.Hips, CQ);
  return out.set(x, y, z).applyQuaternion(CQ).add(CP);
}
