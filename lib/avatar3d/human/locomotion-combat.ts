/*
 * Avatar 3D — locomoção: gestos de ação do heist (arma baixa, mira e tiro, recarga, golpe, imobilização,
 * bater carteira).
 */
import { type Grip, type Motion, MOTION_DURATION, type MotionInput, type MotionState, type Rig } from "./locomotion-model";
import { A, B, C, clamp, D, mix, pulse, smooth } from "./locomotion-math";
import { arm, chest, curl, handTo, lean, modelPos, pelvis, twist } from "./locomotion-kinematics";
import { armsFree, headLevel, lower } from "./locomotion-gait";

/** Pistola/lanterna baixa, junto ao corpo, cano para o chão à frente. */
export function lowReady(r: Rig, st: MotionState, grip: Grip) {
  chest(r, -0.12, -0.32, 0.22, A); arm(r, 1, A, -0.6, -1, -0.3); handTo(r, 1, 0, -0.65, 0.75, 0.95, 0, 0); curl(r, 1, 0.85, 0.6);
  if (grip === "pistol") { chest(r, -0.04, -0.34, 0.2, B); arm(r, 0, B, 0.6, -1, -0.3); handTo(r, 0, -0.3, -0.6, 0.7, -0.9, -0.2, 0); curl(r, 0, 0.6, 0.4); }
  void st;
}

/** Mira com as duas mãos (pistola): braço direito estendido seguindo a inclinação, esquerda apoiando; recuo no tiro. */
export function aimPose(r: Rig, st: MotionState, m: Motion, t: number, inp: MotionInput) {
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
export function reload(r: Rig, st: MotionState, t: number) {
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
export function strike(r: Rig, st: MotionState, m: Motion, t: number, grip: Grip) {
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

/** Bater carteira: mão direita alcança a bolsa de quem está à frente, tronco inclina, volta rápido. */
export function pickpocket(r: Rig, st: MotionState, t: number) {
  const { walking, g } = lower(r, st, "sneak", { crouch: 0.08 });
  armsFree(r, st, walking, g, 0.3);
  const u = t / (MOTION_DURATION.pickpocket ?? 1), reach = smooth(0.05, 0.45, u) * (1 - smooth(0.62, 0.95, u));
  lean(r, r.k.Spine1, 12 * D * reach);
  pelvis(r, -0.12, 0.0, 0.12, A); pelvis(r, -0.06, 0.02, 0.55, B); A.lerp(B, reach);
  arm(r, 1, A, -0.6, -1, -0.3); handTo(r, 1, 0, -0.5, 1, 0.3, -0.2, 0.9); curl(r, 1, mix(0.2, 0.6, smooth(0.4, 0.6, u)), 0.5);
  twist(r, r.k.Head, 18 * D * Math.sin(u * 9)); headLevel(r, 12 * D, 0.8);
}

/** Imobilização por trás: braços em volta do pescoço do outro, puxa para trás. */
export function takedown(r: Rig, st: MotionState, t: number) {
  const k = smooth(0, 0.25, t), pull = smooth(0.35, 0.9, t) * (1 - smooth(1.1, 1.4, t));
  lower(r, st, "idle", { still: true, crouch: 0.1 * k, wide: 0.3 });
  lean(r, r.k.Spine1, (10 * k - 14 * pull) * D); lean(r, r.k.Spine2, 6 * k * D);
  chest(r, -0.04, 0.12, 0.36, A); arm(r, 1, A, -1, -0.3, 0); handTo(r, 1, 1, 0, 0.2, 0, 0, -1, 0.8); curl(r, 1, 0.7);
  chest(r, 0.12, 0.16, 0.3, B); arm(r, 0, B, 1, -0.3, 0); handTo(r, 0, -0.8, 0.4, 0.4, 0, 0, -1, 0.8); curl(r, 0, 0.9);
  twist(r, r.k.Head, 10 * D * pull);
  void st;
}
