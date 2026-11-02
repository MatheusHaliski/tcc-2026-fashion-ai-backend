/*
 * Avatar 3D — locomoção: DJ no console (mixer, pratos, fone, braço para a pista).
 */
import { type MotionInput, type MotionState, type Rig, type Side, SIGN } from "./locomotion-model";
import { A, B, C, D, hash, mix, pulse } from "./locomotion-math";
import { arm, AZ, bank, curl, handTo, headPt, lean, leg, rot, twist } from "./locomotion-kinematics";
import { armsFree, lower } from "./locomotion-gait";
import { danceBeat } from "./locomotion-dance-moves";

/**
 * Console do DJ, em metros no mundo, a partir dos pés do DJ olhando para a cabine (a do Grande Salão, salao-dj.ts: tampo
 * a 1,05 m, players e mixer em cima): superfície do equipamento a ~1,16 m, linha dos botões 0,55 m à frente, borda do
 * mixer (crossfader) a 0,44 m, pratos (jog) a ±0,62 m de lado.
 */
export const DJ_DESK = { y: 1.16, z: 0.55, near: 0.44, deckX: 0.62 } as const;
/**
 * DJ no console: na maior parte do tempo as duas mãos no mixer (botões e fader, a direita corre o crossfader); a cada
 * poucos compassos vai a um dos pratos (o quadril desloca, o tronco gira e inclina para alcançar o jog, que gira ou
 * arranha no dobro da batida); a cada 4 compassos, por 2, uma mão segura o fone na orelha (cabeça inclinada, ouvindo a
 * próxima música) e a outra fica no mixer; de vez em quando a direita sobe para a pista. Cabeça, ombros e joelhos marcam
 * a batida o tempo todo. `inp.scale` (altura da pessoa) mantém as mãos na altura do equipamento no mundo.
 */
export function djPose(r: Rig, st: MotionState, t: number, inp: MotionInput) {
  const seed = st.seed, b = danceBeat(inp.time ?? st.t), bar = Math.floor(b / 4), c = b - bar * 4, on = Math.cos(2 * Math.PI * c) * 0.5 + 0.5;
  const { walking, g } = lower(r, st, "idle", { still: st.speed < 0.3, wide: 0.15 });
  if (walking > 0.5) { armsFree(r, st, walking, g, 0.8); return; }
  const k = 1 / (inp.scale ?? 1), Y = DJ_DESK.y * k + 0.035, Z = DJ_DESK.z * k, N = DJ_DESK.near * k, X = DJ_DESK.deckX * k;
  // momentos (por compasso): fone 2 a cada 4; prato da esquerda ou da direita 1 a cada 3; braço no alto 1 a cada 6
  const cycle = (bar + Math.floor(hash(seed) * 4)) % 4, cue = cycle >= 2 ? pulse(0, 8, 0.6, (cycle - 2) * 4 + c) : 0;
  const deckBar = (bar + Math.floor(hash(seed + 5) * 3)) % 3 === 0 && cue === 0, deckSide: Side = hash(seed + bar * 0.37) > 0.5 ? 0 : 1;
  const deck = deckBar ? pulse(0, 4, 0.7, c) : 0;
  const hype = cue === 0 && !deckBar && (bar + Math.floor(hash(seed + 3) * 6)) % 6 === 0 ? pulse(0, 4, 0.5, c) : 0;
  // quadril: marca a batida e vai para o lado do prato; tronco inclinado sobre o console, gira para o prato
  const hp = r.bones[r.k.Hips].position; hp.y -= 0.018 * on; hp.x += 0.012 * Math.sin((Math.PI * c) / 2) + SIGN[deckSide] * 0.11 * deck;
  for (const s of [0, 1] as Side[]) leg(r, s, r.footIdle[s].x * 1.18, r.footIdle[s].y, r.footIdle[s].z, 0, SIGN[s] * 8 * D, 0.05);
  lean(r, r.k.Spine, 6 * D); lean(r, r.k.Spine1, (8 + 2 * on + 6 * deck) * D); lean(r, r.k.Spine2, (7 + 3 * deck) * D);
  twist(r, r.k.Spine1, SIGN[deckSide] * 9 * D * deck); twist(r, r.k.Spine2, SIGN[deckSide] * 7 * D * deck);
  rot(r, r.k.LeftShoulder, AZ, 3 * D * on); rot(r, r.k.RightShoulder, AZ, -3 * D * on);
  const dip = (r.hips0.y - hp.y) * 0.3;
  const scratch = hash(seed + bar * 0.73) > 0.55 ? Math.sin(2 * Math.PI * b * 2) : Math.sin(2 * Math.PI * b * 0.5);
  for (const s of [0, 1] as Side[]) {
    // mixer: esquerda nos botões, direita no crossfader (corre de um lado ao outro nas batidas)
    const knob = Math.floor(b * 0.5 + hash(seed + 7 + s) * 3) % 3;
    if (s === 0) A.set(0.07 + 0.03 * (knob - 1), Y - dip, mix(N, Z, 0.5 + 0.25 * (knob - 1)));
    else A.set(-0.02 + 0.06 * Math.sin(Math.PI * b * 0.5 + seed), Y - dip - 0.01, N + 0.02);
    // prato: a mão do lado dele vai ao jog
    if (s === deckSide && deck > 0) { B.set(SIGN[s] * (X - 0.04), Y - dip + 0.015, Z - 0.03 + 0.025 * scratch); A.lerp(B, deck); }
    // fone: uma mão (a esquerda, ou a direita de quem prefere) na orelha
    const ear: Side = hash(seed + 9) > 0.7 ? 1 : 0;
    if (s === ear && cue > 0) { headPt(r, SIGN[s] * 0.075, 0.05, 0.0, B); A.lerp(B, cue); }
    if (s === 1 && hype > 0) { headPt(r, -0.32, 0.38 + 0.04 * on, 0.25, C); A.lerp(C, hype); }
    const atEar = s === ear ? cue : 0, up = s === 1 ? hype : 0;
    arm(r, s, A, SIGN[s] * mix(0.8, 1, atEar), mix(-1, -0.2, Math.max(atEar, up)), mix(-0.3, -0.6, atEar));
    if (atEar > 0.5) handTo(r, s, -SIGN[s] * 0.1, 1, 0.1, -SIGN[s], 0, 0.1, 0.9);
    else if (up > 0.5) handTo(r, s, 0.1, 1, 0.2, 0, 0, 1, 0.9);
    else handTo(r, s, -SIGN[s] * 0.15, -0.3, 1, 0, -1, 0.2, 0.9);
    curl(r, s, up > 0.5 ? 0.95 : atEar > 0.5 ? 0.55 : 0.3, 0.3);
  }
  // cabeça: acena na batida; no fone inclina para o lado da orelha; no alto olha a pista
  const earSign = hash(seed + 9) > 0.7 ? 1 : -1;
  lean(r, r.k.Neck, (6 + 6 * on) * D * (1 - hype)); lean(r, r.k.Head, (10 + 6 * on) * D * (1 - hype) - 8 * D * hype);
  bank(r, r.k.Head, earSign * 14 * D * cue); twist(r, r.k.Head, (SIGN[deckSide] * 12 * deck + 6 * Math.sin(b * 0.21 + seed)) * D);
  void t;
}
