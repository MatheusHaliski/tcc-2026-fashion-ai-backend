import { positionalGroups } from "../position-weld";
import type { Vec3 } from "../document";

export interface BoundaryLoop {
  /** Um vértice representante por posição soldada, na ordem da borda. */
  vertices: number[];
  /** Altura média relativa (0 = base da parte, 1 = topo), para nomear barra/gola na interface. */
  height: number;
  /** Vizinhos internos (fora da borda) de cada vértice, para saber para que lado fica o tecido. */
  inward: number[][];
  closed: boolean;
}

/** Bordas abertas da malha (barra, punhos, gola), com vértices soldados para atravessar costuras de UV. */
export function boundaryLoops(original: Float32Array, index: ArrayLike<number> | null): BoundaryLoop[] {
  const { groups, groupOf } = positionalGroups(original);
  const edges = new Map<string, number>();
  const neighbors = groups.map(() => new Set<number>());
  const count = index ? index.length : original.length / 3;
  for (let i = 0; i + 2 < count; i += 3) {
    const t = [0, 1, 2].map((o) => groupOf[index ? index[i + o] : i + o]);
    if (new Set(t).size < 3) continue;
    for (let j = 0; j < 3; j++) {
      const a = t[j], b = t[(j + 1) % 3];
      neighbors[a].add(b);
      neighbors[b].add(a);
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  const next = new Map<number, number[]>();
  for (const [key, uses] of edges) {
    if (uses !== 1) continue;
    const [a, b] = key.split(":").map(Number);
    next.set(a, [...(next.get(a) ?? []), b]);
    next.set(b, [...(next.get(b) ?? []), a]);
  }
  const boundary = new Set(next.keys());
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < original.length; i += 3) [minY, maxY] = [Math.min(minY, original[i]), Math.max(maxY, original[i])];
  const seen = new Set<number>();
  const loops: BoundaryLoop[] = [];
  for (const start of boundary) {
    if (seen.has(start)) continue;
    const chain = [start];
    seen.add(start);
    let current = start, previous = -1;
    for (;;) {
      const step = (next.get(current) ?? []).find((g) => g !== previous && !seen.has(g));
      if (step === undefined) break;
      chain.push(step);
      seen.add(step);
      [previous, current] = [current, step];
    }
    if (chain.length < 3) continue;
    const closed = (next.get(current) ?? []).includes(start);
    const vertices = chain.map((g) => groups[g][0]);
    const height = vertices.reduce((sum, v) => sum + (original[v * 3 + 1] - minY), 0) / vertices.length / Math.max(1e-9, maxY - minY);
    const inward = chain.map((g) => [...neighbors[g]].filter((n) => !boundary.has(n)).map((n) => groups[n][0]));
    loops.push({ vertices, height, inward, closed });
  }
  return loops.sort((a, b) => a.height - b.height);
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Pesponto tracejado: fitas finas recuadas da borda para dentro do tecido e levemente afastadas da
 * superfície. Devolve triângulos (posições xyz) em coordenadas locais da parte.
 */
export function stitchRibbon(points: Vec3[], normals: Vec3[] | null, loop: BoundaryLoop, offset: number, dash: number, width: number): number[] {
  const path = loop.vertices.map((v, i) => {
    const p = points[v];
    const inside = loop.inward[i].map((n) => points[n]);
    const target = inside.length
      ? inside.reduce((s, q) => [s[0] + q[0] / inside.length, s[1] + q[1] / inside.length, s[2] + q[2] / inside.length] as Vec3, [0, 0, 0] as Vec3)
      : p;
    const dir = norm(sub(target, p));
    const n = normals ? norm(normals[v]) : null;
    return { p: [p[0] + dir[0] * offset, p[1] + dir[1] * offset, p[2] + dir[2] * offset] as Vec3, dir, n };
  });
  const segments = loop.closed ? [...path, path[0]] : path;
  const out: number[] = [];
  let carried = 0, on = true;
  for (let i = 1; i < segments.length; i++) {
    const a = segments[i - 1], b = segments[i];
    const length = Math.hypot(...sub(b.p, a.p));
    let t = 0;
    while (t < length) {
      const span = Math.min((on ? dash : dash * 0.6) - carried, length - t);
      if (on && span > 0) {
        const s = t / length, e = (t + span) / length;
        const from = a.p.map((x, k) => x + (b.p[k] - x) * s) as Vec3, to = a.p.map((x, k) => x + (b.p[k] - x) * e) as Vec3;
        const side = a.dir.map((x) => x * width * 0.5) as Vec3;
        const lift = (a.n ?? norm(cross(sub(to, from), a.dir))).map((x) => x * width * 0.6) as Vec3;
        const q = [[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]];
        for (const [sgn, end] of q) {
          const base = end ? to : from;
          out.push(base[0] + side[0] * sgn + lift[0], base[1] + side[1] * sgn + lift[1], base[2] + side[2] * sgn + lift[2]);
        }
      }
      carried += span;
      t += span;
      if (carried >= (on ? dash : dash * 0.6) - 1e-12) {
        carried = 0;
        on = !on;
      }
      if (span <= 0) break;
    }
  }
  return out;
}
