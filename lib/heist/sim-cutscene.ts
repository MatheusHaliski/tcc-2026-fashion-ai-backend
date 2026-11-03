/*
 * MET Gala Heist v2 — cena do diamante (os seguranças entram pela porta), alarme e fuga, vitória, objetivos e
 * checkpoints (progress) e as cenas curtas de subobjetivo (beats).
 */
import type { HeistInput, SimState } from "./types";
import { CHECKPOINTS, DIAMOND_POS, EXITS, VAULT_ENTRY } from "./level";
import { OUTDOOR, emit, line, toast, type SimCtx } from "./state";
import { makeNoise } from "./combat";
import { endingOf } from "./goals";
import { STEPS, beatFor, beatLength, stepDone, type MissionStep } from "./mission";
import { dist, norm, yawOf } from "./math";
import { addLoot } from "./sim-loot";

/* ---------- cena do diamante, alarme e fuga ---------- */
export function startCutscene(s: SimState) {
  const p = s.player;
  s.puzzle = null; p.inv.diamond = true; p.aiming = false; p.crouch = false; p.mode = "CUTSCENE"; p.action = null;
  addLoot(s, "diamante", 15000, "ESPECIAL", "exposed", "vitrine", "cofre");
  p.yaw = yawOf({ x: DIAMOND_POS.x - p.pos.x, z: DIAMOND_POS.z - p.pos.z });
  s.phase = "CUTSCENE"; s.phaseAt = s.time; s.cutscene = { t: 0, step: 0 };
  emit(s, { t: "phase", phase: "CUTSCENE" });
  line(s, "player", "heist.cut.l1", 0);
}
export const CUTSCENE_LEN = 7.4;
export function cutscene(s: SimState, ctx: SimCtx, dt: number) {
  const c = s.cutscene!; c.t += dt;
  const p = s.player;
  if (c.step === 0 && c.t > 2.4) { c.step = 1; line(s, "player", "heist.cut.l2", 0); }
  if (c.step === 1 && c.t > 4.4) { c.step = 2; raiseAlarm(s); line(s, "x1", "heist.cut.guard", 0); }
  if (c.step >= 2) for (const id of ["x1", "x2"]) {
    const g = s.guards.find((x) => x.id === id)!;
    const goal = { x: -14.2, z: id === "x1" ? -13.8 : -15.4 };
    const d = norm({ x: goal.x - g.pos.x, z: goal.z - g.pos.z }), far = dist(goal, g.pos) > 0.2;
    if (far) { g.pos.x += d.x * 2.6 * dt; g.pos.z += d.z * 2.6 * dt; g.anim = "run"; } else g.anim = "aim";
    g.yaw = yawOf({ x: p.pos.x - g.pos.x, z: p.pos.z - g.pos.z }); g.state = "ALERT"; g.aimStart = s.time; g.nextShotAt = s.time + 1.2;
  }
  if (c.t >= CUTSCENE_LEN) endCutscene(s);
  void ctx;
}
/** Pula a cena (✕ / E / Enter). */
export function skipCutscene(s: SimState) { if (s.phase !== "CUTSCENE") return; if (s.cutscene!.step < 2) raiseAlarm(s); for (const id of ["x1", "x2"]) { const g = s.guards.find((x) => x.id === id)!; g.pos = { x: -14.2, z: id === "x1" ? -13.8 : -15.4 }; } endCutscene(s); }
function raiseAlarm(s: SimState) {
  if (s.lockdown) return;
  s.alarm = true; s.alarmAt = s.time; s.lockdown = true; s.cutscene && (s.cutscene.step = Math.max(2, s.cutscene.step));
  for (const g of s.guards) {
    if (g.state === "DOWN") continue;
    if (!g.active) { g.active = true; if (g.id === "x1" || g.id === "x2") g.pos = { x: VAULT_ENTRY.x, z: VAULT_ENTRY.z + (g.id === "x1" ? 0.5 : -0.5) }; }
    g.state = "ALERT"; g.suspicion = 1; g.lastKnown = { ...s.player.pos }; g.aimStart = 0; g.nextShotAt = s.time + 1.5;
  }
  emit(s, { t: "alarm", on: true });
  makeNoise(s, s.player.pos, 80, "alarm");
}
function endCutscene(s: SimState) {
  const p = s.player;
  s.cutscene = null; s.phase = "ESCAPE"; s.phaseAt = s.time; p.mode = "WALK"; s.objective = "ESCAPE";
  emit(s, { t: "phase", phase: "ESCAPE" }); emit(s, { t: "objective", id: "ESCAPE" }); emit(s, { t: "checkpoint", reason: "fuga" });
  toast(s, "heist.toast.escape");
}
export function win(s: SimState, exit: string) {
  s.phase = "WON"; s.phaseAt = s.time; s.objective = "DONE"; s.stats.route = `${s.stats.route || "furtiva"}→${exit}`;
  if (!s.flags.includes(`ending-${endingOf(s)}`)) s.flags.push(`ending-${endingOf(s)}`);
  emit(s, { t: "phase", phase: "WON" }); emit(s, { t: "objective", id: "DONE" });
  if (s.challenge && !s.challengeFailed) emit(s, { t: "challenge", id: s.challenge, result: "done" });
}

/* ---------- objetivos e checkpoints ---------- */
export function progress(s: SimState, ctx: SimCtx) {
  const p = s.player, room = p.lastRoom;
  if (!s.visited.includes(room)) {
    s.visited.push(room);
    if (CHECKPOINTS[room] && s.phase === "INFILTRATE") emit(s, { t: "checkpoint", reason: room });
  }
  let obj = s.objective;
  if (s.phase === "INFILTRATE") {
    if (OUTDOOR.has(room) && !s.visited.some((r) => !OUTDOOR.has(r))) obj = "ENTER";
    else if (room !== "cofre") obj = "ROUTE";
    else obj = s.fusesCut || dist(p.pos, DIAMOND_POS) < 3 ? "DIAMOND" : "LASERS";
  }
  if (obj !== s.objective) { s.objective = obj; emit(s, { t: "objective", id: obj }); }
  // subobjetivos cumpridos, em ordem (vários de uma vez: a cena é só a do último)
  while (s.mission.step < STEPS.length) {
    const st = STEPS[s.mission.step], via = stepDone(s, st.id);
    if (!via) break;
    s.mission.via[st.id] = via; s.mission.step++;
    emit(s, { t: "beat", step: st.id, via });
    startBeat(s, st.id, via);
  }
  // fuga: chegar perto do carro já basta
  if (s.phase === "ESCAPE") for (const e of EXITS) if (dist(e.pos, p.pos) < 1.4) win(s, e.id);
  void ctx;
}

/** Entrada sem nada apertado (cena curta: a câmera e o mundo seguem, a jogadora não). */
export const IDLE_INPUT = (inp: HeistInput): HeistInput => ({ ...inp, move: { x: 0, y: 0 }, sprint: false, crouchPress: false, discreet: false, interactPress: false, aim: false, fire: false, firePress: false, reloadPress: false, meleePress: false, healPress: false, throwPress: false, dodgePress: false });

/** Começa a cena curta de um subobjetivo (ou a de abertura). Devolve os enquadramentos para a câmera; null se não houver. */
export function startBeat(s: SimState, id: MissionStep | "intro", via: string) {
  if (!s.options.beats || s.phase === "CUTSCENE" || s.phase === "WON" || s.phase === "LOST") return null;
  const b = beatFor(s, id, via);
  if (!b) return null;
  s.beat = { ...b, step: id, via, at: s.time, until: s.time + beatLength(b) };
  s.player.iframesUntil = Math.max(s.player.iframesUntil, s.beat.until + 0.6);
  return b;
}
/** Pular a cena curta (Enter / ✕): o controle volta na hora. */
export function skipBeat(s: SimState) { if (s.beat) s.beat.until = s.time; }
