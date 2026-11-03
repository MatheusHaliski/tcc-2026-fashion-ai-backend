/*
 * Avatar 3D — locomoção: camadas por cima da pose (sacar/guardar a arma, olhar para um ponto, recuo ao levar tiro).
 */
import * as THREE from "three";
import { type MotionInput, type MotionState, type Rig } from "./locomotion-model";
import { A, clamp, D, hash, pulse, smooth } from "./locomotion-math";
import { arm, AZ, bank, handTo, lean, modelPos, pelvis, rot, twist } from "./locomotion-kinematics";

/* ---------- camadas por cima ---------- */
/** Duração de sacar/guardar a arma (s). */
export const DRAW_TIME = 0.42;
const DQ = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
/**
 * Sacar a arma: a mão direita sai do coldre (quadril direito, um pouco atrás) e chega à pose do gesto; guardar: a mão
 * vai ao coldre e volta. A pose do gesto já está nos ossos; aqui só se mistura com a pose do coldre.
 */
export function drawOverlay(r: Rig, d: { t: number; out: boolean }) {
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
export function lookAt(r: Rig, st: MotionState, inp: MotionInput, dt: number) {
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
export function flinch(r: Rig, st: MotionState, inp: MotionInput) {
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
