/*
 * The MET Gala Afterparty Heist — navegação da equipe, dos personagens e dos convidados: grade de 0,5 m com paredes e móveis inflados pelo raio do
 * corpo, A* em 8 direções (sem cortar quina) e caminho alisado por linha livre ("puxar o barbante"), para ninguém andar
 * em zigue-zague de célula em célula.
 */
import type { Vec } from "./types";
import { CELL, GH, GW, X0, Z0, cellOf, inGrid, type Mover, type World } from "./world";

export interface NavGrid { who: Mover; blocked: Uint8Array }

/** Máscara de passagem para quem anda (a equipe passa por todas as portas, menos o duto e as janelas; convidados, só pelas abertas). */
export function buildNav(w: World, who: Exclude<Mover, "player">, inflate = 0.3): NavGrid {
  const blocked = new Uint8Array(GW * GH);
  const wall = (i: number, j: number) => {
    if (!inGrid(i, j)) return true;
    const c = w.grid[j * GW + i]; if (c === 0) return true; if (c === 1) return false;
    const d = w.doors[w.doorAt[j * GW + i]];
    return d.lock === "vent" || d.lock === "window" || (who === "guest" && !(d.lock === "open" || d.lock === "wristband"));
  };
  const reach = Math.ceil(inflate / CELL);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    if (wall(i, j)) { blocked[j * GW + i] = 1; continue; }
    const cx = X0 + (i + 0.5) * CELL, cz = Z0 + (j + 0.5) * CELL;
    let b = false;
    for (let di = -reach; di <= reach && !b; di++) for (let dj = -reach; dj <= reach && !b; dj++) {
      if (!di && !dj) continue;
      if (!wall(i + di, j + dj)) continue;
      const x0 = X0 + (i + di) * CELL, z0 = Z0 + (j + dj) * CELL;
      const dx = Math.max(x0 - cx, 0, cx - (x0 + CELL)), dz = Math.max(z0 - cz, 0, cz - (z0 + CELL));
      if (dx * dx + dz * dz < inflate * inflate) b = true;
    }
    if (!b) for (const p of w.props) {
      const s = p.shape;
      if (s.type === "box") { const dx = Math.max(s.x0 - cx, 0, cx - s.x1), dz = Math.max(s.z0 - cz, 0, cz - s.z1); if (dx * dx + dz * dz < inflate * inflate) { b = true; break; } }
      else if (Math.hypot(cx - s.x, cz - s.z) < s.r + inflate) { b = true; break; }
    }
    if (b) blocked[j * GW + i] = 1;
  }
  return { who, blocked };
}

export const walkable = (n: NavGrid, i: number, j: number) => inGrid(i, j) && !n.blocked[j * GW + i];
const center = (i: number, j: number): Vec => ({ x: X0 + (i + 0.5) * CELL, z: Z0 + (j + 0.5) * CELL });

/** Célula livre mais perto (busca em anel) — para destinos que caem dentro de um móvel ou parede. */
export function nearestWalkable(n: NavGrid, p: Vec, maxR = 8): [number, number] | null {
  const [ci, cj] = cellOf(p.x, p.z);
  if (walkable(n, ci, cj)) return [ci, cj];
  for (let r = 1; r <= maxR; r++) {
    let best: [number, number] | null = null, bd = Infinity;
    for (let di = -r; di <= r; di++) for (const dj of [-r, r]) for (const [i, j] of [[ci + di, cj + dj], [ci + dj, cj + di]]) if (walkable(n, i, j)) { const c = center(i, j), d = (c.x - p.x) ** 2 + (c.z - p.z) ** 2; if (d < bd) { bd = d; best = [i, j]; } }
    if (best) return best;
  }
  return null;
}

/** Linha livre na grade (amostras a cada 1/4 de célula, com folga lateral). */
export function lineWalkable(n: NavGrid, a: Vec, b: Vec): boolean {
  const d = Math.hypot(b.x - a.x, b.z - a.z), steps = Math.max(1, Math.ceil(d / (CELL * 0.25)));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    const [i, j] = cellOf(x, z); if (!walkable(n, i, j)) return false;
  }
  return true;
}

class Heap {
  private k: number[] = []; private f: number[] = [];
  get size() { return this.k.length; }
  push(key: number, pri: number) {
    const k = this.k, f = this.f; let i = k.length; k.push(key); f.push(pri);
    while (i > 0) { const p = (i - 1) >> 1; if (f[p] <= pri) break; k[i] = k[p]; f[i] = f[p]; i = p; }
    k[i] = key; f[i] = pri;
  }
  pop(): number {
    const k = this.k, f = this.f, top = k[0], lk = k.pop()!, lf = f.pop()!;
    if (k.length) {
      let i = 0; const n = k.length;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i, mf = lf; if (l < n && f[l] < mf) { m = l; mf = f[l]; } if (r < n && f[r] < mf) { m = r; mf = f[r]; } if (m === i) break; k[i] = k[m]; f[i] = f[m]; i = m; }
      k[i] = lk; f[i] = lf;
    }
    return top;
  }
}

const SQ2 = Math.SQRT2;
const DIRS: [number, number, number][] = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [-1, -1, SQ2]];
let gScore = new Float32Array(GW * GH), came = new Int32Array(GW * GH), stamp = new Uint32Array(GW * GH), closedStamp = new Uint32Array(GW * GH), run = 0;

/** Caminho de a até b (pontos no mundo, já alisado; o último é b ou a célula livre mais perto). null = sem caminho. */
export function findPath(n: NavGrid, a: Vec, b: Vec, maxExpand = 6000): Vec[] | null {
  const s = nearestWalkable(n, a, 3), t = nearestWalkable(n, b, 8);
  if (!s || !t) return null;
  if (gScore.length !== GW * GH) { gScore = new Float32Array(GW * GH); came = new Int32Array(GW * GH); stamp = new Uint32Array(GW * GH); closedStamp = new Uint32Array(GW * GH); }
  run++;
  const si = s[1] * GW + s[0], ti = t[1] * GW + t[0];
  const h = (i: number, j: number) => { const dx = Math.abs(i - t[0]), dz = Math.abs(j - t[1]); return Math.max(dx, dz) + (SQ2 - 1) * Math.min(dx, dz); };
  const open = new Heap();
  gScore[si] = 0; stamp[si] = run; came[si] = -1; open.push(si, h(s[0], s[1]));
  let expanded = 0, found = false;
  while (open.size) {
    const cur = open.pop();
    if (closedStamp[cur] === run) continue;
    closedStamp[cur] = run;
    if (cur === ti) { found = true; break; }
    if (++expanded > maxExpand) break;
    const ci = cur % GW, cj = (cur - ci) / GW, g = gScore[cur];
    for (const [di, dj, c] of DIRS) {
      const ni = ci + di, nj = cj + dj;
      if (!walkable(n, ni, nj)) continue;
      if (di && dj && (!walkable(n, ci + di, cj) || !walkable(n, ci, cj + dj))) continue;   // sem cortar quina
      const k = nj * GW + ni; if (closedStamp[k] === run) continue;
      const ng = g + c;
      if (stamp[k] !== run || ng < gScore[k]) { stamp[k] = run; gScore[k] = ng; came[k] = cur; open.push(k, ng + h(ni, nj) * 1.001); }
    }
  }
  if (!found) return null;
  const cells: Vec[] = [];
  for (let k = ti; k !== -1; k = came[k]) { const i = k % GW; cells.push(center(i, (k - i) / GW)); }
  cells.reverse();
  const goal = t[0] === cellOf(b.x, b.z)[0] && t[1] === cellOf(b.x, b.z)[1] ? b : cells[cells.length - 1];
  cells[cells.length - 1] = goal;
  return smooth(n, a, cells);
}

/** Puxa o barbante: do ponto atual, pula para o ponto mais distante ainda alcançável em linha reta. */
export function smooth(n: NavGrid, from: Vec, pts: Vec[]): Vec[] {
  if (pts.length <= 1) return pts;
  const out: Vec[] = []; let cur = from, k = 0;
  while (k < pts.length) {
    let far = k;
    for (let m = pts.length - 1; m > k; m--) if (lineWalkable(n, cur, pts[m])) { far = m; break; }
    out.push(pts[far]); cur = pts[far]; k = far + 1;
  }
  return out;
}

/** Distância percorrida pelo caminho (para o som contornar paredes: ouvir pelo corredor, não através do concreto). */
export function pathLength(from: Vec, path: Vec[]): number { let d = 0, c = from; for (const p of path) { d += Math.hypot(p.x - c.x, p.z - c.z); c = p; } return d; }
