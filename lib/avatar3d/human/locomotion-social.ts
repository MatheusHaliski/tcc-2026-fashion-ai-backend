/*
 * Avatar 3D — locomoção: gestos sociais da festa (celular, conversa, taça, foto, fã, garçom, segurança, apontar,
 * acenar, mexer em painel, violino).
 */
import { type Grip, type MotionInput, type MotionState, type Rig, type Side, SIGN } from "./locomotion-model";
import { A, B, C, D, hash, mix, pulse, smooth, V1 } from "./locomotion-math";
import {
  arm, AY, bank, chest, curl, handTo, headPt, lean, modelPos, pelvis, pointFinger, rot, swing, twist,
} from "./locomotion-kinematics";
import { armsFree, gaitParams } from "./locomotion-gait";

/** Celular/tablet na frente do peito, olhando para a tela. */
export function textHold(r: Rig, st: MotionState, grip: Grip) {
  const tab = grip === "tablet";
  chest(r, -0.05, -0.14, 0.3, A); arm(r, 1, A, -0.6, -1, -0.5); handTo(r, 1, 0.15, 0.55, 0.8, 0.25, 0.6, -0.75); curl(r, 1, 0.55, 0.35);
  if (tab) { chest(r, 0.08, -0.16, 0.29, B); arm(r, 0, B, 0.6, -1, -0.5); handTo(r, 0, -0.15, 0.5, 0.8, -0.25, 0.6, -0.75); curl(r, 0, 0.5, 0.3); }
  lean(r, r.k.Neck, 10 * D); lean(r, r.k.Head, 14 * D);
  void st;
}
/** Conversa: gestos das mãos na altura da cintura/peito, de vez em quando um aceno de cabeça. */
export function talk(r: Rig, st: MotionState, t: number, walking: number) {
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
export function phone(r: Rig, st: MotionState, t: number) {
  if (hash(st.seed + 17) < 0.45) { textHold(r, st, "phone"); return; }
  headPt(r, -0.085, 0.04, 0.02, A); arm(r, 1, A, -0.4, -1, 0.2); handTo(r, 1, 0, 1, 0.2, 0.95, 0, 0.2); curl(r, 1, 0.55, 0.4);
  bank(r, r.k.Head, -4 * D); twist(r, r.k.Head, 5 * D * Math.sin((st.t + st.seed) * 0.5));
  void t;
}
/** Taça na mão esquerda, na altura do peito; um gole a cada ~7 s. */
export function drink(r: Rig, st: MotionState, t: number) {
  const tt = (st.t + st.seed * 4.7) % 7, sip = pulse(0.3, 2.2, 0.5, tt);
  chest(r, 0.12, -0.18, 0.25, A); headPt(r, 0.01, 0.0, 0.13, B); A.lerp(B, sip * 0.92);
  arm(r, 0, A, 0.8, -1, -0.3); handTo(r, 0, -0.85, 0.2 + 0.4 * sip, 0.4, -0.25, 0, -0.95); curl(r, 0, 0.62, 0.45);
  lean(r, r.k.Head, -9 * D * sip);
  void t;
}
/** Fotógrafo: câmera no rosto com as duas mãos, cotovelos abertos; varre um pouco o tapete. */
export function photo(r: Rig, st: MotionState, t: number) {
  const tt = st.t + st.seed;
  twist(r, r.k.Spine1, 10 * D * Math.sin(tt * 0.6)); twist(r, r.k.Spine2, 8 * D * Math.sin(tt * 0.6 + 0.3));
  headPt(r, -0.07, 0.03, 0.15, A); arm(r, 1, A, -1, -0.4, -0.2); handTo(r, 1, 0.1, 0.9, 0.3, 0.95, 0, -0.1); curl(r, 1, 0.6, 0.4);
  headPt(r, 0.06, -0.02, 0.17, B); arm(r, 0, B, 1, -0.6, -0.2); handTo(r, 0, -0.3, 0.2, 1, -0.2, 1, 0); curl(r, 0, 0.45, 0.2);
  lean(r, r.k.Head, 4 * D);
  void t;
}
/** Fã: celular no alto filmando (ou os dois braços acenando), pulinhos. */
export function cheer(r: Rig, st: MotionState, t: number, grip: Grip) {
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
/**
 * Garçom: bandeja na mão esquerda, palma para cima na altura do ombro, nivelada e firme — o alvo vem do quadril de
 * exibição e só acompanha um terço do sobe e desce da passada (o peito, que gira e balança, não leva a bandeja junto).
 * Parado, de tempos em tempos oferece: estende a bandeja à frente e a mão direita, aberta, mostra as taças.
 */
export function serve(r: Rig, st: MotionState, walking = 0) {
  const h = r.hips0, tt = (st.t + st.seed * 3.3) % 8, offer = (1 - walking) * pulse(0.6, 3.4, 0.6, tt);
  const bob = r.bones[r.k.Hips].position.y - h.y;
  A.set(h.x + 0.2 - 0.03 * offer, h.y + 0.39 + bob * 0.35 - 0.04 * offer, h.z + 0.22 + 0.13 * offer);
  arm(r, 0, A, 0.7, -1, -0.4); handTo(r, 0, -0.35, 0, 0.94, 0, 1, 0); curl(r, 0, 0.12, 0);
  pelvis(r, -0.1, -0.02, -0.16, B);
  if (offer > 0.02) { chest(r, -0.02, -0.1, 0.36, C); B.lerp(C, offer); }
  arm(r, 1, B, mix(-0.5, -0.6, offer), -1, mix(0.3, -0.2, offer));
  handTo(r, 1, mix(0, 0.5, offer), mix(-0.6, 0.1, offer), mix(-0.8, 0.85, offer), 0, mix(0, 0.8, offer), mix(-1, 0.2, offer), mix(0.6, 0.75, offer));
  curl(r, 1, mix(0.35, 0.08, offer));
  if (offer > 0.02) { lean(r, r.k.Spine2, 4 * D * offer); lean(r, r.k.Head, 6 * D * offer); }
}
/** Segurança em posto: pés afastados, mãos cruzadas à frente da pelve, cabeça varrendo devagar. */
export function guardHands(r: Rig, st: MotionState, walking: number) {
  if (walking > 0.5) { armsFree(r, st, walking, gaitParams("walk", st.speed, st.tired), 0.6); return; }
  pelvis(r, -0.015, -0.11, 0.16, A); arm(r, 1, A, -0.7, -1, -0.6); handTo(r, 1, 0.75, -0.55, 0.2, 0.2, 0.1, -0.95); curl(r, 1, 0.55);
  pelvis(r, 0.035, -0.09, 0.175, B); arm(r, 0, B, 0.7, -1, -0.6); handTo(r, 0, -0.75, -0.5, 0.25, -0.2, 0.05, -0.95); curl(r, 0, 0.25);
  const tt = st.t + st.seed * 3;
  twist(r, r.k.Neck, 14 * D * Math.sin(tt * 0.33)); twist(r, r.k.Head, 16 * D * Math.sin(tt * 0.33 + 0.4));
}
/** Apontar para o alvo de olhar (ou para a frente). */
export function point(r: Rig, st: MotionState, inp: MotionInput) {
  modelPos(r, r.k.RightArm, A);
  if (inp.look) V1.copy(inp.look).sub(A).normalize(); else V1.set(-0.1, 0.05, 1).normalize();
  B.copy(A).addScaledVector(V1, r.dim.upArm + r.dim.foreArm - 0.03);
  arm(r, 1, B, -0.4, -1, 0); handTo(r, 1, V1.x, V1.y, V1.z, 0.2, 0, 0); pointFinger(r, 1);
  twist(r, r.k.Spine2, -8 * D);
  void st;
}
/** Aceno: braço direito no alto, antebraço indo e vindo. */
export function wave(r: Rig, st: MotionState, t: number) {
  const tt = st.t * 6.5;
  chest(r, -0.38 - 0.06 * Math.sin(tt), 0.36, 0.12, A); arm(r, 1, A, -1, -0.6, -0.2); handTo(r, 1, -0.25 * Math.sin(tt), 1, 0.15, 0, 0, 1); curl(r, 1, 0.1);
  void t;
}
/** Mexer em painel/teclado/mesa: mãos à frente na altura do peito, dedos "digitando". Com um prato (copa, bufê): a
 * esquerda segura o prato nivelado sobre a bancada e a direita arruma o doce nele com o garfo. */
export function interact(r: Rig, st: MotionState, t: number, grip: Grip = null) {
  const tt = st.t * 7;
  for (const s of [0, 1] as Side[]) {
    if (grip === "plate" && s === 0) {
      chest(r, 0.08, -0.22, 0.36, A); arm(r, 0, A, 0.7, -1, -0.5); handTo(r, 0, -0.55, 0.05, 0.84, 0, 1, 0); curl(r, 0, 0.12, 0.05); continue;
    }
    if (grip === "plate") { chest(r, 0.02 + 0.03 * Math.sin(tt * 0.3), -0.15 + 0.02 * Math.abs(Math.sin(tt * 0.6)), 0.4, A); arm(r, 1, A, -0.7, -1, -0.3); handTo(r, 1, 0.25, -0.55, 0.8, 0.9, 0.2, 0, 0.9); curl(r, 1, 0.5, 0.45); continue; }
    chest(r, SIGN[s] * 0.1, -0.12 + 0.015 * Math.sin(tt + s * 1.7), 0.38, A); arm(r, s, A, SIGN[s] * 0.7, -1, -0.3);
    handTo(r, s, -SIGN[s] * 0.2, -0.1, 1, 0, -0.3, 1, 0.9); curl(r, s, 0.25 + 0.1 * Math.sin(tt * 1.3 + s));
  }
  lean(r, r.k.Spine2, 6 * D); lean(r, r.k.Head, 12 * D);
  void t;
}
/** Violino: instrumento entre o ombro esquerdo e o queixo, mão esquerda no braço, direita arcando. */
export function play(r: Rig, st: MotionState, t: number) {
  const tt = st.t + st.seed;
  bank(r, r.k.Head, 10 * D); twist(r, r.k.Head, 14 * D); lean(r, r.k.Head, 8 * D);
  chest(r, 0.18, 0.2, 0.42, A); arm(r, 0, A, 0.8, -1, 0); handTo(r, 0, -0.3, 0.6, 0.6, -0.6, 0, 0.4); curl(r, 0, 0.55, 0.3);
  const bow = Math.sin(tt * 2.6);
  chest(r, -0.08 + 0.2 * bow, 0.1 + 0.02 * bow, 0.3, B); arm(r, 1, B, -1, -0.6, -0.4); handTo(r, 1, 0.9, 0, 0.3, 0, -1, 0); curl(r, 1, 0.45, 0.4);
  twist(r, r.k.Spine2, 4 * D * bow);
  void t;
}
