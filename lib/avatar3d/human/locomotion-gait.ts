/*
 * Avatar 3D — locomoção: marcha. Parâmetros da passada, ciclo do pé, pernas/quadril/tronco, braços balançando,
 * respiração e cabeça (olhar em volta, nível do olhar).
 */
import * as THREE from "three";
import { type Motion, type MotionState, type Rig, type Side, SIGN } from "./locomotion-model";
import { clamp, D, hash, mix, Q1, smooth, V1 } from "./locomotion-math";
import { AZ, bank, curl, lean, leg, modelQuat, rot, swing, twist } from "./locomotion-kinematics";

/* ---------- marcha ---------- */
export interface Gait { cycle: number; beta: number; reach: number; lift: number; run: number; lean: number; crouch: number; armSwing: number; elbow: number; width: number; bob: number; toe: number }
const G: Gait = { cycle: 1, beta: 0.6, reach: 0.8, lift: 0.1, run: 0, lean: 0, crouch: 0, armSwing: 0, elbow: 0, width: 0.8, bob: 0, toe: 0.12 };
/** Parâmetros da passada para a velocidade (m/s) e o estilo. */
export function gaitParams(m: Motion, v: number, tired: number): Gait {
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
export function lower(r: Rig, st: MotionState, m: Motion, opts: { crouch?: number; wide?: number; still?: boolean } = {}) {
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
export function armsFree(r: Rig, st: MotionState, walking: number, g: Gait, k = 1) {
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
export function breathe(r: Rig, st: MotionState, amount = 1, heavy = 0) {
  const f = mix(4.6, 1.6, heavy), b = Math.sin((2 * Math.PI * st.t) / f);
  lean(r, r.k.Spine1, -(0.9 + heavy * 2.4) * D * b * amount); lean(r, r.k.Spine2, -(0.6 + heavy * 1.6) * D * b * amount);
  rot(r, r.k.LeftShoulder, AZ, (0.6 + heavy * 1.8) * D * b * amount); rot(r, r.k.RightShoulder, AZ, -(0.6 + heavy * 1.8) * D * b * amount);
}
export function idleHead(r: Rig, st: MotionState, amount = 1) {
  const t = st.t + st.seed * 3.1;
  const look = 0.7 * Math.sin((2 * Math.PI * t) / 12.3 + 0.4) + 0.3 * Math.sin((2 * Math.PI * t) / 7.1 + 2.1);
  const P = 10.5, kk = Math.floor(t / P), ph = t - kk * P, on = smooth(0.6, 1.8, ph) * (1 - smooth(4.4, 5.8, ph));
  const gl = (hash(kk + st.seed) > 0.5 ? 1 : -1) * (8 + 14 * hash(kk + 7 + st.seed)) * on;
  twist(r, r.k.Neck, (2.5 * look + 0.4 * gl) * D * amount); twist(r, r.k.Head, (3 * look + 0.6 * gl) * D * amount);
  lean(r, r.k.Head, 1.2 * D * Math.sin((2 * Math.PI * t) / 8.7 + 0.9) * amount);
}
/** Cabeça estável: desfaz parte da inclinação do tronco (olhar no horizonte), + `pitch` (+ = olhar para baixo). */
export function headLevel(r: Rig, pitch = 0, w = 0.75) {
  modelQuat(r, r.k.Head, Q1); V1.set(0, 0, 1).applyQuaternion(Q1);
  const cur = Math.asin(clamp(-V1.y, -1, 1));                   // + = olhando para baixo
  lean(r, r.k.Neck, (pitch - cur) * w * 0.4); lean(r, r.k.Head, (pitch - cur) * w * 0.6);
}
