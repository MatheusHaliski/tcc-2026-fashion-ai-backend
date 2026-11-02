/*
 * Avatar 3D — locomoção: gestos com começo e fim roteirizados (troca de roupa, comemoração, proteger a cabeça).
 */
import { MOTION_DURATION, type MotionState, type Rig, type Side, SIGN } from "./locomotion-model";
import { A, B, C, clamp, D, pulse, smooth } from "./locomotion-math";
import { arm, AY, AZ, bank, chest, curl, handTo, headPt, lean, modelPos, pelvis, rot, twist } from "./locomotion-kinematics";
import { breathe, lower } from "./locomotion-gait";

/**
 * Troca de roupa (2,6 s): olha em volta com timidez, agacha, cruza os braços no tronco (a peça troca em ~45 %, com o
 * corpo encolhido), ajeita a roupa subindo, ajeita o cabelo e se endireita.
 */
export function change(r: Rig, st: MotionState, t: number) {
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
export function celebrate(r: Rig, st: MotionState, t: number) {
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
/** Abaixar e proteger a cabeça (pânico): agachada, mãos na nuca, tremendo. */
export function cower(r: Rig, st: MotionState, t: number) {
  const k = smooth(0, 0.35, t);
  lower(r, st, "idle", { still: true, crouch: 0.4 * k, wide: 0.2 * k });
  lean(r, r.k.Spine1, 26 * D * k); lean(r, r.k.Spine2, 20 * D * k); lean(r, r.k.Head, 24 * D * k);
  const shake = 0.008 * Math.sin(st.t * 31) * k;
  for (const s of [0, 1] as Side[]) {
    headPt(r, SIGN[s] * 0.07, 0.16 + shake, -0.06, A); modelPos(r, s ? r.k.RightHand : r.k.LeftHand, B); B.lerp(A, k);
    arm(r, s, B, SIGN[s], 0.2, 0.6); handTo(r, s, -SIGN[s] * 0.6, 0.3, -0.6, 0, -1, 0, k * 0.8); curl(r, s, 0.35);
  }
}
