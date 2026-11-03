/*
 * MET Gala Heist v2 — leitura da grade de 0,5 m para a casca do interior (interior-shell.ts): índice e centro de cada
 * célula, a sala de cada célula de piso, as divisórias do labirinto, a distância até a parede (oclusão fingida no piso)
 * e o parapeito do terraço.
 */
import { CELL, GH, GW, X0, Z0, type World } from "@/lib/heist/world";
import { INNER_WALLS } from "@/lib/heist/level";
import type { RoomId } from "@/lib/heist/types";
import { isInterior, roomAtPoint } from "./interior-shell";

export const idx = (i: number, j: number) => j * GW + i;
export const cx = (i: number) => X0 + (i + 0.5) * CELL, cz = (j: number) => Z0 + (j + 0.5) * CELL;

/** Sala de cada célula de piso (null = parede, porta ou fora). */
export function cellRooms(w: World): (RoomId | null)[] {
  const out: (RoomId | null)[] = new Array(GW * GH).fill(null);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (w.grid[idx(i, j)] === 1) out[idx(i, j)] = roomAtPoint(cx(i), cz(j));
  return out;
}
/** Células de parede do labirinto (divisórias baixas). */
export function innerWallMask(): Uint8Array {
  const m = new Uint8Array(GW * GH);
  for (const r of INNER_WALLS) {
    const i0 = Math.floor((r.x0 - X0) / CELL + 1e-6), i1 = Math.ceil((r.x1 - X0) / CELL - 1e-6) - 1, j0 = Math.floor((r.z0 - Z0) / CELL + 1e-6), j1 = Math.ceil((r.z1 - Z0) / CELL - 1e-6) - 1;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (i >= 0 && j >= 0 && i < GW && j < GH) m[idx(i, j)] = 1;
  }
  return m;
}
/** Distância (em células) até a parede mais próxima — oclusão fingida no piso. */
export function wallDistance(w: World): Float32Array {
  const d = new Float32Array(GW * GH).fill(99); const q: number[] = [];
  for (let k = 0; k < GW * GH; k++) if (w.grid[k] === 0) { d[k] = 0; q.push(k); }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], i = k % GW, j = (k - i) / GW;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
      const nk = idx(ni, nj); if (d[nk] > d[k] + 1) { d[nk] = d[k] + 1; q.push(nk); }
    }
  }
  return d;
}

/** Paredes do terraço que dão para fora (norte e leste): parapeito baixo com balaústres, não parede de 7 m. */
export function parapetMask(w: World, cellRoom: (RoomId | null)[]): Uint8Array {
  const m = new Uint8Array(GW * GH);
  for (let j = 1; j < GH - 1; j++) for (let i = 1; i < GW - 1; i++) {
    const k = idx(i, j); if (w.grid[k] === 1) continue;
    if (w.grid[k] === 2) { const d = w.doors[w.doorAt[k]]; if (d.id !== "windowT" && d.id !== "fireEscape") continue; }
    let terr = false, other = false;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const r = cellRoom[idx(i + di, j + dj)]; if (r === "terraco") terr = true; else if (isInterior(r)) other = true;
    }
    if (terr && !other) m[k] = 1;
  }
  return m;
}
