import { positionalGroups } from "../position-weld";
import type { Vec3 } from "../document";

export const SCULPT_MODES = ["pull", "push", "inflate", "deflate", "smooth"] as const;
export type SculptMode = (typeof SCULPT_MODES)[number];
export const FALLOFFS = ["smooth", "linear", "sharp"] as const;
export type Falloff = (typeof FALLOFFS)[number];
export interface SculptBrushParams {
  mode: SculptMode;
  /** Raio como fração da diagonal da parte (independe da unidade do arquivo). */
  radius: number;
  strength: number;
  falloff: Falloff;
  mirror: boolean;
}
export interface SculptContext {
  groups: number[][];
  groupOf: number[];
  neighbors: Set<number>[];
  triangles: [number, number, number][];
  size: number;
  centerX: number;
}

/** Queda do pincel: 1 no centro, 0 na borda (d normalizada 0..1). */
export function falloffWeight(distance: number, falloff: Falloff): number {
  if (distance >= 1) return 0;
  if (falloff === "linear") return 1 - distance;
  if (falloff === "sharp") return (1 - distance) ** 3;
  const t = 1 - distance;
  return t * t * (3 - 2 * t);
}

/** Pré-cálculo por malha: vértices soldados por posição (costuras de UV não abrem) e vizinhança. */
export function sculptContext(original: Float32Array, index: ArrayLike<number> | null): SculptContext {
  const { groups, groupOf } = positionalGroups(original);
  const neighbors = groups.map(() => new Set<number>());
  const triangles: [number, number, number][] = [];
  const count = index ? index.length : original.length / 3;
  for (let i = 0; i + 2 < count; i += 3) {
    const t = [0, 1, 2].map((o) => groupOf[index ? index[i + o] : i + o]) as [number, number, number];
    if (new Set(t).size < 3) continue;
    triangles.push(t);
    for (let j = 0; j < 3; j++) {
      neighbors[t[j]].add(t[(j + 1) % 3]);
      neighbors[t[(j + 1) % 3]].add(t[j]);
    }
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < original.length; i++) {
    min[i % 3] = Math.min(min[i % 3], original[i]);
    max[i % 3] = Math.max(max[i % 3], original[i]);
  }
  return { groups, groupOf, neighbors, triangles, size: Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1, centerX: (min[0] + max[0]) / 2 };
}

function groupCenters(points: Vec3[], ctx: SculptContext): Vec3[] {
  return ctx.groups.map((members) => {
    const c: Vec3 = [0, 0, 0];
    for (const i of members) for (let a = 0; a < 3; a++) c[a] += points[i][a] / members.length;
    return c;
  });
}

function groupNormals(centers: Vec3[], ctx: SculptContext): Vec3[] {
  const normals = centers.map(() => [0, 0, 0] as Vec3);
  for (const [a, b, c] of ctx.triangles) {
    const u = [0, 1, 2].map((k) => centers[b][k] - centers[a][k]), v = [0, 1, 2].map((k) => centers[c][k] - centers[a][k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const g of [a, b, c]) for (let k = 0; k < 3; k++) normals[g][k] += n[k];
  }
  return normals.map((n) => {
    const length = Math.hypot(...n) || 1;
    return [n[0] / length, n[1] / length, n[2] / length];
  });
}

/**
 * Um carimbo do pincel de escultura no espaço local da parte. Puxar/empurrar seguem a normal do ponto
 * tocado; inflar/encolher a normal de cada vértice; suavizar aproxima da média dos vizinhos. Com
 * espelho, o mesmo carimbo é repetido do outro lado do plano X central.
 */
export function sculptDab(points: Vec3[], ctx: SculptContext, hit: Vec3, normal: Vec3, brush: SculptBrushParams): Vec3[] {
  const radius = Math.max(1e-4, brush.radius * ctx.size);
  const strength = Math.min(1, Math.max(0, brush.strength));
  const stamps: [Vec3, Vec3][] = [[hit, normal]];
  if (brush.mirror && Math.abs(hit[0] - ctx.centerX) > radius * 0.5)
    stamps.push([[2 * ctx.centerX - hit[0], hit[1], hit[2]], [-normal[0], normal[1], normal[2]]]);
  const centers = groupCenters(points, ctx);
  const normals = brush.mode === "inflate" || brush.mode === "deflate" ? groupNormals(centers, ctx) : null;
  const moved = centers.map((c) => [...c] as Vec3);
  for (const [center, direction] of stamps) {
    const length = Math.hypot(...direction) || 1;
    const n = direction.map((x) => x / length);
    centers.forEach((c, g) => {
      const w = falloffWeight(Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]) / radius, brush.falloff) * strength;
      if (w <= 0) return;
      if (brush.mode === "smooth") {
        if (!ctx.neighbors[g].size) return;
        const average = [0, 0, 0];
        for (const k of ctx.neighbors[g]) for (let a = 0; a < 3; a++) average[a] += centers[k][a] / ctx.neighbors[g].size;
        for (let a = 0; a < 3; a++) moved[g][a] += (average[a] - c[a]) * Math.min(1, w * 0.6);
        return;
      }
      const sign = brush.mode === "push" || brush.mode === "deflate" ? -1 : 1;
      const axis = normals ? normals[g] : n;
      for (let a = 0; a < 3; a++) moved[g][a] += axis[a] * sign * w * radius * 0.12;
    });
  }
  return points.map((point, i) => {
    const g = ctx.groupOf[i];
    return point.map((x, a) => x + moved[g][a] - centers[g][a]) as Vec3;
  });
}
