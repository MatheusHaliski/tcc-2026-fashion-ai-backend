/*
 * MET Gala Heist v2 — puzzles: teclado da doca e cofre (4 dígitos; 3 erros fazem barulho), quadro de luz (3×3 em cruz),
 * anéis da vitrine do diamante e o grampo/decodificador que abre sem o código. Resolver a vitrine começa a cena.
 */
import type { PuzzleKind, SimState } from "./types";
import { CODES } from "./level";
import { emit, toast } from "./state";
import { makeNoise } from "./combat";
import { startCutscene } from "./sim-cutscene";
import type { OpenUi } from "./sim-interact";

/* ---------- puzzles ---------- */
const FUSE_START = [0, 4, 8];
export function startPuzzle(s: SimState, kind: PuzzleKind, id: string): OpenUi {
  const lights = Array(9).fill(true); for (const i of FUSE_START) toggleFuse(lights, i);
  s.puzzle = { kind, id, input: "", lights, rings: [0, 0, 0], mistakes: 0, hints: 0, solved: false, startedAt: s.time };
  emit(s, { t: "puzzle", kind, result: "start" });
  return { ui: "puzzle", kind };
}
function toggleFuse(l: boolean[], i: number) { const r = Math.floor(i / 3), c = i % 3; for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 3 && cc >= 0 && cc < 3) l[rr * 3 + cc] = !l[rr * 3 + cc]; } }

/** Teclado/cofre: um dígito (ou "C" apaga). Com 4 dígitos confere. */
export function puzzleKey(s: SimState, key: string) {
  const z = s.puzzle; if (!z || z.solved || (z.kind !== "keypad" && z.kind !== "safe")) return;
  if (key === "C") { z.input = ""; return; }
  if (z.input.length >= 4) return;
  z.input += key;
  if (z.input.length < 4) return;
  if (z.input === (z.kind === "keypad" ? CODES.service : CODES.safe)) solvePuzzle(s);
  else {
    z.mistakes++; s.stats.mistakes++; emit(s, { t: "puzzle", kind: z.kind, result: "mistake" }); z.input = "";
    if (z.mistakes >= 3) { makeNoise(s, s.player.pos, 8, "bottle"); toast(s, "heist.toast.keypadAlarm"); z.mistakes = 0; }
  }
}
export function puzzleFuse(s: SimState, i: number) {
  const z = s.puzzle; if (!z || z.kind !== "fuses" || z.solved) return;
  toggleFuse(z.lights, i);
  if (z.lights.every(Boolean)) solvePuzzle(s);
}
export function puzzleRing(s: SimState, ring: number, dir: 1 | -1) {
  const z = s.puzzle; if (!z || z.kind !== "rings" || z.solved) return;
  z.rings[ring] = (z.rings[ring] + dir + 4) % 4;
  if (z.rings.every((v, k) => v === CODES.rings[k])) solvePuzzle(s);
}
/** Joia (grampo) ou decodificador: abre teclado, cofre e a trava da vitrine sem o código. O quadro de luz não. */
export function puzzlePick(s: SimState, from: "decoder" | string): boolean {
  const z = s.puzzle; if (!z || z.solved || z.kind === "fuses") return false;
  if (from === "decoder") { if (s.player.inv.decoder <= 0) return false; s.player.inv.decoder--; }
  else { const c = s.cards.find((x) => x.id === from); if (!c || c.use !== "PICK" || s.cardState[c.id] !== "DECK") return false; s.cardState[c.id] = "USED"; }
  z.hints++; solvePuzzle(s); return true;
}
function solvePuzzle(s: SimState) {
  const z = s.puzzle!; z.solved = true; s.solved.push(z.kind); s.stats.puzzles++;
  emit(s, { t: "puzzle", kind: z.kind, result: "solved" });
  if (z.kind === "keypad") { s.unlocked.push("service"); toast(s, "heist.toast.serviceOpen"); }
  if (z.kind === "safe") { s.player.inv.keycard = true; toast(s, "heist.toast.keycard"); }
  if (z.kind === "fuses") { s.fusesCut = true; toast(s, "heist.toast.fuses"); }
  if (z.kind === "rings") startCutscene(s);
}
export function closePuzzle(s: SimState) { if (s.puzzle) emit(s, { t: "puzzle", kind: s.puzzle.kind, result: "close" }); s.puzzle = null; }
