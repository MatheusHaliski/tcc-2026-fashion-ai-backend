/*
 * MET Gala Heist v2 — o passo da simulação (60 Hz no cliente): jogadora (andar, correr, agachar, caminhada discreta,
 * mira, tiro, faca, nocaute por trás, cura pelo atalho da barra de vida, garrafa para distrair, escalada, duto,
 * esconderijo), interações (recepcionista, revendedor, caminhão do bufê, interfone, pistas, teclado, cofre, quadro de luz,
 * vitrine do diamante, portas trancadas, carros da fuga), lasers, cena do diamante, alarme e fuga, objetivos, checkpoint,
 * vitória e derrota. As telas (revendedor, roda de itens, puzzles) chamam as ações exportadas daqui.
 *
 * Este arquivo tem o passo (step), as portas e os lasers; o resto fica por responsabilidade em sim-player.ts (jogadora),
 * sim-combat.ts (combate), sim-prompts.ts (prompt de E/✕), sim-interact.ts (interação e conversas), sim-loot.ts (espólio),
 * sim-puzzles.ts, sim-cutscene.ts (cena, alarme, vitória, objetivos, beats) e sim-actions.ts (ações das telas), reexportado aqui.
 */
import type { HeistInput, SimState } from "./types";
import { segDist } from "./world";
import { DOORS, LASERS } from "./level";
import { MAX_HP, emit, playerMayPass, toast, type SimCtx } from "./state";
import { alertGuard } from "./combat";
import { updateCivs, updateGuards } from "./ai";
import { trackGoals } from "./goals";
import { dist } from "./math";
import { player } from "./sim-player";
import { pendingNoises } from "./sim-combat";
import { IDLE_INPUT, cutscene, progress } from "./sim-cutscene";

/* ======================= passo ======================= */
export function step(s: SimState, ctx: SimCtx, inp: HeistInput, rawDt: number) {
  if (s.phase === "WON" || s.phase === "LOST") { s.time += rawDt; return; }
  const slow = s.time < s.player.slowUntil;
  const dt = Math.min(0.05, rawDt) * (slow ? 0.45 : 1);
  s.time += dt; s.tick++; s.stats.time += rawDt;
  if (s.phase === "CUTSCENE") { cutscene(s, ctx, dt); return; }
  if (s.beat && s.time >= s.beat.until) s.beat = null;
  player(s, ctx, s.beat ? IDLE_INPUT(inp) : inp, dt, slow);
  doors(s);
  updateGuards(s, ctx, dt);
  updateCivs(s, ctx, dt);
  pendingNoises(s);
  lasers(s, ctx);
  progress(s, ctx);
  trackGoals(s);
}

/* ---------- portas (folhas abertas: para a cena e a linha de visão) ---------- */
function doors(s: SimState) {
  for (const d of DOORS) {
    if (d.lock === "open") { s.doors[d.id] = !(s.lockdown && d.id === "front"); continue; }
    if (d.lock === "vent" || d.lock === "climb") { s.doors[d.id] = false; continue; }
    const c = { x: (d.rect.x0 + d.rect.x1) / 2, z: (d.rect.z0 + d.rect.z1) / 2 };
    let open = dist(c, s.player.pos) < 1.9 && playerMayPass(s, d);
    if (!open && !(s.lockdown && (d.id === "front" || d.id === "main"))) for (const g of s.guards) if (g.active && g.state !== "DOWN" && dist(c, g.pos) < 1.7) { open = true; break; }
    if (!open && d.lock !== "staff") for (const v of s.civs) if ((v.role === "queue" || v.role === "guest") && dist(c, v.pos) < 1.6 && (d.lock === "invite" || d.lock === "wristband")) { open = true; break; }
    if (s.doors[d.id] !== open) { s.doors[d.id] = open; emit(s, { t: "door", id: d.id, open }); }
  }
}

/* ---------- lasers ---------- */
export function laserOn(s: SimState, id: string): boolean {
  if (!s.lasersOn || s.fusesCut) return false;
  const L = LASERS.find((l) => l.id === id)!;
  if (L.off <= 0) return true;
  const t = s.time * (s.time < s.player.slowUntil ? 0.4 : 1) * (s.options.slowLasers ? 0.6 : 1) + L.phase;
  return t % (L.on + L.off) < L.on;
}
function lasers(s: SimState, ctx: SimCtx) {
  const p = s.player;
  if (p.lastRoom !== "cofre" || s.fusesCut || s.lockdown) return;
  for (const L of LASERS) {
    if (!laserOn(s, L.id)) continue;
    if (segDist(p.pos, L.a, L.b) > 0.24) continue;
    if (L.height === "high" && p.crouch) continue;
    if ((s.lineAt.laserTrip ?? -99) + 4 > s.time) continue;
    s.lineAt.laserTrip = s.time;
    emit(s, { t: "sfx", id: "laser" }); emit(s, { t: "alarm", on: true });
    toast(s, "heist.toast.laser");
    for (const g of s.guards) if (g.active && g.state !== "DOWN" && g.room === "cofre") alertGuard(s, g, p.pos, false);
    void ctx;
  }
}

/* ======================= ações e telas (sim-*.ts) ======================= */
export { CHANGE_TIME, CHANGE_SWAP, wear, useCard, equip, trade, bestGiven, tradable, buy } from "./sim-actions";
export { meleeTarget, quickHeal } from "./sim-combat";
export { type PromptKind, type Prompt, promptAt } from "./sim-prompts";
export { type OpenUi, interact, talk, choose, endTalk } from "./sim-interact";
export { startPuzzle, puzzleKey, puzzleFuse, puzzleRing, puzzlePick, closePuzzle } from "./sim-puzzles";
export { startCutscene, CUTSCENE_LEN, skipCutscene, startBeat, skipBeat } from "./sim-cutscene";

/* ======================= vista para a cena ======================= */
export { writeView } from "./view-writer";
export { MAX_HP };
