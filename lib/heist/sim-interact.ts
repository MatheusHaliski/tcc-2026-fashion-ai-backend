/*
 * MET Gala Heist v2 — executa a interação do prompt (esconderijo, nocaute, furto, telas do revendedor/puzzle/pista,
 * escalada, saída), as conversas (começar, escolher, encerrar), o interfone da doca e o uniforme.
 */
import type { DialogueId, PuzzleKind, SimState, VendorId } from "./types";
import { CLIMB_TO, RACKS, floorY } from "./level";
import { emit, line, toast, type SimCtx } from "./state";
import { tiredness } from "./combat";
import { DIALOGUES, choicesOf } from "./dialogue";
import { angDiff, dist, yawOf } from "./math";
import { melee } from "./sim-combat";
import { promptAt } from "./sim-prompts";
import { openStash, pickup } from "./sim-loot";
import { startPuzzle } from "./sim-puzzles";
import { win } from "./sim-cutscene";

/** Executa a interação do prompt. Telas (revendedor, puzzle, pista) devolvem o que abrir. */
export type OpenUi = { ui: "vendor"; vendor: VendorId } | { ui: "puzzle"; kind: PuzzleKind } | { ui: "clue"; ref: string } | { ui: "dialogue" } | null;
export function interact(s: SimState, ctx: SimCtx): OpenUi {
  const pr = promptAt(s); const p = s.player;
  if (!pr || !pr.ok) { if (pr?.kind === "door") emit(s, { t: "sfx", id: "locked" }); return null; }
  switch (pr.kind) {
    case "unhide": unhide(s); return null;
    case "hide": { const r = RACKS.find((x) => x.id === pr.ref)!; p.hidden = r.id; p.pos = { ...r.pos }; p.crouch = false; return null; }
    case "takedown": melee(s, tiredness(s)); return null;
    case "pickup": return pickup(s, pr.ref!);
    case "pickpocket": {
      const c = s.civs.find((x) => x.id === pr.ref)!;
      p.action = { kind: "pickpocket", t: 0, dur: 1.1, ref: c.id }; p.yaw = yawOf({ x: c.pos.x - p.pos.x, z: c.pos.z - p.pos.z }); return null;
    }
    case "talk": { const c = s.civs.find((x) => x.id === pr.ref)!; return talk(s, c.id, c.talkId!); }
    case "vendor": return pr.ref === "bar" ? talk(s, s.civs.find((c) => c.talkId === "bartender")?.id ?? "bar", "bartender") : { ui: "vendor", vendor: pr.ref as VendorId };
    case "hostess": return talk(s, s.civs.find((c) => c.talkId === "hostess")?.id ?? "hostess", "hostess");
    case "stash": p.action = { kind: "pickup", t: 0, dur: 0.8 }; openStash(s, pr.ref!); return null;
    case "jewelCase": p.action = { kind: "loot", t: 0, dur: 1.6, ref: pr.ref! }; return null;
    case "coatRack": p.action = { kind: "loot", t: 0, dur: 1.4, ref: pr.ref! }; return null;
    case "uniform": takeUniform(s, ctx, pr.ref!); return null;
    case "intercom": intercom(s); return null;
    case "inspect": if (!s.clues.includes(pr.ref!)) s.clues.push(pr.ref!); return { ui: "clue", ref: pr.ref! };
    case "keypad": return startPuzzle(s, "keypad", "service");
    case "safe": return startPuzzle(s, "safe", "safe");
    case "fuses": return startPuzzle(s, "fuses", "fuses");
    case "pedestal": return startPuzzle(s, "rings", "pedestal");
    case "climb": {
      const c = CLIMB_TO[pr.ref!];
      p.action = { kind: "climb", t: 0, dur: c.dur, from: { ...p.pos }, to: { ...c.to }, fromY: p.y, toY: floorY(c.to) }; p.crouch = false;
      p.yaw = yawOf({ x: c.to.x - p.pos.x, z: c.to.z - p.pos.z }); return null;
    }
    case "exit": win(s, pr.ref!); return null;
  }
  return null;
}

export function unhide(s: SimState) {
  const p = s.player, r = RACKS.find((x) => x.id === p.hidden);
  if (r) p.pos = { x: r.pos.x + Math.sin(r.yaw) * 0.75, z: r.pos.z + Math.cos(r.yaw) * 0.75 };
  p.hidden = null;
}

/* ---------- conversas ---------- */
/** Começa a conversa com quem tem diálogo (a simulação para enquanto a tela de conversa está aberta). */
export function talk(s: SimState, civId: string, id: DialogueId): OpenUi {
  const c = s.civs.find((x) => x.id === civId);
  if (c) { c.reactKind = "look"; c.reactUntil = s.time + 2; }
  s.dialogue = { npc: civId, id, node: "start" };
  s.stats.route ||= "";
  return { ui: "dialogue" };
}
/** Escolhe a opção `index` (o índice original no nó). Devolve a próxima tela (conversa, revendedor ou nada). */
export function choose(s: SimState, index: number): OpenUi {
  const d = s.dialogue; if (!d) return null;
  const node = DIALOGUES[d.id][d.node];
  const opt = choicesOf(s, node).find((x) => x.i === index);
  if (!opt || opt.locked) return { ui: "dialogue" };
  const next = opt.c.go(s);
  if (!s.flags.includes(`dlg-${d.id}`)) s.flags.push(`dlg-${d.id}`);
  if (next?.startsWith("vendor:")) { s.dialogue = null; return { ui: "vendor", vendor: next.slice(7) as VendorId }; }
  if (!next) { s.dialogue = null; return null; }
  d.node = next; return { ui: "dialogue" };
}
export function endTalk(s: SimState) { s.dialogue = null; }

export function intercom(s: SimState) {
  const p = s.player;
  if (p.disguise === "staff") { s.unlocked.push("dockGate"); line(s, "d1", "heist.gil.open", 0); s.stats.route ||= "doca"; return; }
  line(s, "d1", "heist.gil.no", 0);
}

/** Uniforme: no caminhão do bufê (de costas para a equipe) ou no armário do labirinto. Quem vê, estranha. */
export function takeUniform(s: SimState, ctx: SimCtx, ref: string) {
  const p = s.player;
  const crew = s.civs.find((c) => c.role === "catering" && dist(c.pos, p.pos) < 6);
  if (ref === "truck" && crew && Math.abs(angDiff(crew.yaw, yawOf({ x: p.pos.x - crew.pos.x, z: p.pos.z - crew.pos.z }))) < 1.3) {
    line(s, crew.id, "heist.civ.truck", 0); crew.reactKind = "point"; crew.reactUntil = s.time + 3; return;
  }
  p.inv.uniform = true; p.action = { kind: "pickup", t: 0, dur: 0.8 }; toast(s, "heist.toast.uniform");
  void ctx;
}
