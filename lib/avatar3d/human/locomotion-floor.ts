/*
 * Avatar 3D — locomoção: poses deitadas e sentadas (queda, abatida, rastejar, sentar, escalar).
 */
import { type Grip, type Motion, type MotionState, type Rig, type Side, SIGN } from "./locomotion-model";
import { A, D, hash, mix, smooth } from "./locomotion-math";
import { arm, AZ, bank, curl, handTo, headPt, lean, leg, modelPos, rot, swing, twist } from "./locomotion-kinematics";
import { breathe, idleHead } from "./locomotion-gait";
import { drink } from "./locomotion-social";

/* ---------- poses deitadas e sentadas ---------- */
/** Queda: nocaute (luta 0,6 s e cai de lado) ou abatido (cai de costas). Termina deitado, imóvel. */
export function fall(r: Rig, st: MotionState, m: Motion, t: number) {
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
export function downed(r: Rig, st: MotionState, t: number) {
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
export function crawl(r: Rig, st: MotionState, t: number) {
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
export function sit(r: Rig, st: MotionState, t: number, grip: Grip) {
  const hp = r.bones[r.k.Hips].position, seat = 0.46;
  hp.set(r.hips0.x, seat + 0.08, r.hips0.z - 0.18);
  lean(r, r.k.Spine, -6 * D); lean(r, r.k.Spine2, 4 * D);
  for (const s of [0, 1] as Side[]) leg(r, s, r.footIdle[s].x * 1.25, r.dim.ankle, 0.34 + (s ? 0.04 : -0.03) * (st.stance - 0.5), 0, SIGN[s] * 8 * D, 0.2);
  breathe(r, st, 1); idleHead(r, st);
  if (grip === "glass") drink(r, st, t);
  else for (const s of [0, 1] as Side[]) { modelPos(r, s ? r.k.RightLeg : r.k.LeftLeg, A); A.x -= SIGN[s] * 0.02; A.y += 0.08; A.z -= 0.1; arm(r, s, A, SIGN[s] * 0.5, -1, -0.5); handTo(r, s, 0, -0.2, 1, 0, -1, 0, 0.8); curl(r, s, 0.3); }
}
/** Escalada (escada de incêndio, janela): de frente para a parede, mãos e pés alternando nos degraus. */
export function climb(r: Rig, st: MotionState, t: number) {
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
