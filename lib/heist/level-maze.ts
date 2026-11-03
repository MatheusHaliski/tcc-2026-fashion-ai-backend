/* MET Gala Heist v2 — labirinto de serviço: módulo, paredes internas geradas com semente (DFS + laços) e o centro de cada corredor. */
import type { Rect, Vec } from "./types";
import { mulberry } from "./math";

/* ---------- labirinto de serviço ---------- */
/** Módulo de 2 m: corredor de 1,5 m e parede de 0,5 m. 5 colunas × 11 linhas entre x −22…−12,5 e z −6…16. */
export const MAZE = { x0: -22, z0: -6, cols: 5, rows: 11, cell: 2, wall: 0.5 };
/** Células ocupadas pela sala de segurança (colunas 0–1, linhas 4–6). */
const inSecRoom = (c: number, r: number) => c <= 1 && r >= 4 && r <= 6;

/** Paredes internas do labirinto (retângulos), geradas com semente: DFS + alguns laços. Sempre as mesmas. */
export function mazeWalls(): Rect[] {
  const { x0, z0, cols, rows, cell, wall } = MAZE;
  // paredes entre células: v[c][r] = parede à direita de (c,r); h[c][r] = parede abaixo de (c,r)
  const v = Array.from({ length: cols }, () => Array<boolean>(rows).fill(true));
  const h = Array.from({ length: cols }, () => Array<boolean>(rows).fill(true));
  const seen = Array.from({ length: cols }, () => Array<boolean>(rows).fill(false));
  let rng = 1957;
  const rnd = () => { const [x, s] = mulberry(rng); rng = s; return x; };
  const stack: [number, number][] = [[2, 0]]; seen[2][0] = true;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (inSecRoom(c, r)) seen[c][r] = true;
  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const next = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dc, dr]) => [c + dc, r + dr] as [number, number])
      .filter(([nc, nr]) => nc >= 0 && nr >= 0 && nc < cols && nr < rows && !seen[nc][nr]);
    if (!next.length) { stack.pop(); continue; }
    const [nc, nr] = next[Math.floor(rnd() * next.length)];
    if (nc !== c) v[Math.min(c, nc)][r] = false; else h[c][Math.min(r, nr)] = false;
    seen[nc][nr] = true; stack.push([nc, nr]);
  }
  // laços: abre algumas paredes fora da sala de segurança (rondas em circuito e mais de uma saída)
  for (const [c, r, dir] of [[3, 1, "v"], [2, 3, "h"], [3, 6, "v"], [2, 8, "h"], [0, 9, "v"], [3, 9, "h"], [1, 1, "h"], [2, 5, "v"]] as const) {
    if (dir === "v") v[c][r] = false; else h[c][r] = false;
  }
  // a sala de segurança tem as próprias paredes (sem paredes por dentro); a porta abre na linha 5 (secDoor)
  for (let c = 0; c <= 1; c++) for (let r = 4; r <= 6; r++) { if (c === 0) v[c][r] = false; if (r < 6) h[c][r] = false; }
  h[0][3] = true; h[1][3] = true; h[0][6] = true; h[1][6] = true; v[1][4] = true; v[1][5] = true; v[1][6] = true;
  h[4][7] = false;                                                                 // porta da equipe (coluna 4, linhas 7–8) sem parede no meio
  // segmentos de parede + pilares em todos os cruzamentos internos (menos dentro da sala de segurança)
  const out: Rect[] = [];
  const cx = (c: number) => x0 + c * cell, cz = (r: number) => z0 + r * cell, run = cell - wall;
  for (let c = 0; c < cols - 1; c++) for (let r = 0; r < rows; r++) if (v[c][r]) out.push({ x0: cx(c) + run, z0: cz(r), x1: cx(c) + cell, z1: r === rows - 1 ? 16 : cz(r) + run });
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows - 1; r++) if (h[c][r]) out.push({ x0: cx(c), z0: cz(r) + run, x1: cx(c) + run, z1: cz(r) + cell });
  for (let c = 0; c < cols - 1; c++) for (let r = 0; r < rows - 1; r++) {
    if (inSecRoom(c, r) && inSecRoom(c + 1, r) && inSecRoom(c, r + 1) && inSecRoom(c + 1, r + 1)) continue;
    out.push({ x0: cx(c) + run, z0: cz(r) + run, x1: cx(c) + cell, z1: cz(r) + cell });
  }
  return out;
}
/** Centro do corredor (c, r) do labirinto. */
export const mazeCell = (c: number, r: number): Vec => ({ x: MAZE.x0 + c * MAZE.cell + 0.75, z: MAZE.z0 + r * MAZE.cell + 0.75 });

/** Paredes internas fora das salas (além do labirinto): por enquanto só ele. */
export const INNER_WALLS: Rect[] = mazeWalls();
