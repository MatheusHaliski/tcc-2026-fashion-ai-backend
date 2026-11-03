/*
 * Avatar 3D — locomoção e gestos procedurais no esqueleto do corpo humano (MakeHuman, nomes do Mixamo), para cenas com
 * muita gente (MET Gala Heist v2). Nada de clipe gravado: cada quadro monta a pose a partir da pose de exibição
 * (pose.ts) com três ferramentas, todas sem alocar memória por quadro:
 *
 *  - rotações no espaço do modelo (como rotateWorld de pose.ts): "inclinar o tronco", "balançar o braço";
 *  - IK de dois ossos (coxa+canela, braço+antebraço): o pé vai aonde o passo manda e a mão vai aonde o gesto manda —
 *    é isso que deixa os pés plantados no chão (sem patinar) e as mãos no lugar certo (celular na orelha, bandeja no
 *    ombro, mãos na cabeça);
 *  - orientação absoluta de mão, pé e cabeça (pé chato no chão, palma para cima sob a bandeja, olhar estável).
 *
 * Eixos do modelo: x = esquerda da pessoa, y = para cima, z = para a frente (o corpo nasce olhando para +z). Na pose de
 * repouso do arquivo (pose "A") todas as rotações são identidade, então o eixo local de cada osso coincide com o do
 * modelo — as direções de repouso (J) valem nos dois.
 *
 * A marcha é o ciclo de dois passos: fase φ ∈ [0, 1), pé esquerdo toca o chão em φ = 0 e o direito em 0,5. O apoio dura
 * β do ciclo; durante o apoio o pé anda para trás exatamente na velocidade do corpo (alcance = β × comprimento do
 * ciclo), por isso ele fica parado no mundo. Velocidade → comprimento do passo e cadência (caminhada até ~1,9 m/s,
 * corrida a partir de ~2,8 m/s, mistura no meio).
 *
 * Poses deitadas (queda, nocaute, jogadora abatida, rastejar): o corpo é montado em pé ("quadro do corpo") e só no fim
 * o quadril gira e desce até o chão — os filhos acompanham.
 */
import { type Motion, type MotionInput, type MotionState, type Rig } from "./locomotion-model";
import { clamp, D, mix, pulse, Q1, Q2, smooth } from "./locomotion-math";
import { reset, twist } from "./locomotion-kinematics";
import { armsFree, breathe, gaitParams, headLevel, idleHead, lower } from "./locomotion-gait";
import { crouchArms, discreet, holdIdle, stand, tiredOverlay } from "./locomotion-stance";
import { aimPose, pickpocket, reload, strike, takedown } from "./locomotion-combat";
import { cheer, drink, guardHands, interact, phone, photo, play, point, serve, talk, wave } from "./locomotion-social";
import { celebrate, change, cower } from "./locomotion-scripted";
import { dance } from "./locomotion-dance";
import { djPose } from "./locomotion-dj";
import { eat } from "./locomotion-eat";
import { climb, crawl, downed, fall, sit } from "./locomotion-floor";
import { drawOverlay, flinch, lookAt } from "./locomotion-overlays";

export type { Grip, Motion, MotionInput, MotionState, Rig } from "./locomotion-model";
export { CHANGE_SWAP_AT, MOTION_DURATION, MOTIONS, newMotionState } from "./locomotion-model";
export { reset } from "./locomotion-kinematics";
export { cloneRig, jointPos, makeRig, syncBase } from "./locomotion-rig";
export { DANCE_BPM, danceBeat } from "./locomotion-dance-moves";
export { DJ_DESK } from "./locomotion-dj";
export { eatPhase } from "./locomotion-eat";
export { DRAW_TIME } from "./locomotion-overlays";

function save(r: Rig, buf: Float32Array) {
  for (let i = 0; i < r.bones.length; i++) { const q = r.bones[i].quaternion; buf[i * 4] = q.x; buf[i * 4 + 1] = q.y; buf[i * 4 + 2] = q.z; buf[i * 4 + 3] = q.w; }
  const p = r.bones[r.k.Hips].position, o = r.bones.length * 4; buf[o] = p.x; buf[o + 1] = p.y; buf[o + 2] = p.z;
}
function blendInto(r: Rig, a: Float32Array, b: Float32Array, w: number) {
  for (let i = 0; i < r.bones.length; i++) {
    Q1.set(a[i * 4], a[i * 4 + 1], a[i * 4 + 2], a[i * 4 + 3]); Q2.set(b[i * 4], b[i * 4 + 1], b[i * 4 + 2], b[i * 4 + 3]);
    r.bones[i].quaternion.slerpQuaternions(Q1, Q2, w);
  }
  const o = r.bones.length * 4; r.bones[r.k.Hips].position.set(mix(a[o], b[o], w), mix(a[o + 1], b[o + 1], w), mix(a[o + 2], b[o + 2], w));
}

/** Gestos que deitam o corpo: não recebem olhar, recuo nem mistura com o cansaço. */
const LYING: ReadonlySet<Motion> = new Set(["knockedOut", "dead", "downed", "crawl"]);
/** Gestos que só mexem no tronco e nos braços: as pernas andam se houver velocidade. */
const UPPER: ReadonlySet<Motion> = new Set(["idle", "queue", "look", "talk", "phone", "drink", "photo", "cheer", "serve", "guard", "aim", "shoot", "reload", "point", "wave", "interact", "play", "walk", "run", "tired", "discreet", "flee", "eat"]);

/**
 * Um quadro de animação: mistura com o gesto anterior por ~0,2 s, depois olhar e recuo de tiro por cima.
 * `dt` em segundos (até 0,1: quem fica longe é atualizado com menos frequência e recebe o dt acumulado).
 */
export function animate(r: Rig, st: MotionState, inp: MotionInput, dt: number) {
  dt = clamp(dt, 0, 0.1);
  st.t += dt;
  st.speed += (inp.speed - st.speed) * (1 - Math.exp(-dt * 10));
  st.tired += ((inp.tired ?? 0) - st.tired) * (1 - Math.exp(-dt * 2.5));
  if (inp.anim !== st.cur) { st.prev = st.cur; st.prevT = Math.max(st.prevT, 0); st.cur = inp.anim; st.since = st.t; }
  st.prevT += dt;
  // fase da marcha: avança pela distância (pé parado no mundo); parada, a fase congela
  const g = gaitParams(st.cur, st.speed, st.tired);
  st.phase = (st.phase + (st.speed * dt) / g.cycle) % 1;
  const w = smooth(0, st.blend, st.t - st.since);
  if (w < 1) {
    pose(r, st, st.prev, st.prevT, inp); save(r, st.bufA);
    pose(r, st, st.cur, inp.animT, inp); save(r, st.bufB);
    blendInto(r, st.bufA, st.bufB, w);
  } else { pose(r, st, st.cur, inp.animT, inp); st.prevT = inp.animT; }
  if (!LYING.has(st.cur)) { if (inp.draw) drawOverlay(r, inp.draw); lookAt(r, st, inp, dt); flinch(r, st, inp); }
}

/* ---------- poses ---------- */
function pose(r: Rig, st: MotionState, m: Motion, t: number, inp: MotionInput) {
  reset(r);
  const grip = inp.grip ?? null;
  switch (m) {
    case "knockedOut": case "dead": fall(r, st, m, t); return;
    case "downed": downed(r, st, t); return;
    case "crawl": crawl(r, st, t); return;
    case "sit": sit(r, st, t, grip); return;
    case "climb": climb(r, st, t); return;
    case "change": change(r, st, t); return;
    case "celebrate": celebrate(r, st, t); return;
    case "dance": dance(r, st, t, inp); return;
    case "dj": djPose(r, st, t, inp); return;
    case "takedown": takedown(r, st, t); return;
    case "cower": cower(r, st, t); return;
    case "crouch": case "sneak": { const { walking, g } = lower(r, st, "sneak", { crouch: m === "crouch" && st.speed < 0.2 ? 0.34 : 0 }); crouchArms(r, st, walking, g, grip); headLevel(r, 4 * D); return; }
    case "pickpocket": pickpocket(r, st, t); return;
    case "melee": case "stab": strike(r, st, m, t, grip); return;
    default: break;
  }
  if (!UPPER.has(m)) { stand(r, st, grip); return; }
  // pernas: andam com a velocidade; o estilo da passada vem do gesto
  const style: Motion = m === "discreet" || m === "flee" ? m : m === "tired" ? "walk" : st.speed > 2.4 ? "run" : "walk";
  const { walking, g } = lower(r, st, style, { wide: m === "guard" || m === "aim" || m === "shoot" ? 0.25 : 0 });
  const heavy = st.tired;
  breathe(r, st, 1 - walking * 0.5, heavy);
  switch (m) {
    case "aim": case "shoot": aimPose(r, st, m, t, inp); break;
    case "reload": reload(r, st, t); break;
    case "talk": armsFree(r, st, walking, g, 0.6); talk(r, st, t, walking); break;
    case "phone": armsFree(r, st, walking, g, 0.6); phone(r, st, t); break;
    case "drink": armsFree(r, st, walking, g, 0.7); drink(r, st, t); break;
    case "photo": photo(r, st, t); break;
    case "cheer": cheer(r, st, t, grip); break;
    case "serve": armsFree(r, st, walking, g, 0.7); serve(r, st, walking); break;
    case "guard": guardHands(r, st, walking); break;
    case "point": armsFree(r, st, walking, g, 0.5); point(r, st, inp); break;
    case "wave": armsFree(r, st, walking, g, 0.5); wave(r, st, t); break;
    case "interact": interact(r, st, t, grip); break;
    case "play": play(r, st, t); break;
    case "eat": armsFree(r, st, walking, g, 0.7); eat(r, st, t, walking, inp); break;
    case "discreet": discreet(r, st, walking); break;
    case "flee": armsFree(r, st, walking, g, 1.25); twist(r, r.k.Neck, 28 * D * pulse(0.5, 1.5, 0.3, (st.t + st.seed) % 3.2)); break;
    default:
      armsFree(r, st, walking, g, 1);
      if (grip) holdIdle(r, st, grip, walking);
      if (walking < 0.5) idleHead(r, st, 1 - walking * 2);
  }
  if (heavy > 0.02 && m !== "aim" && m !== "shoot") tiredOverlay(r, st, walking, heavy);
  if (m !== "discreet") headLevel(r, (4 + st.tired * 10) * D, 0.65);
}
