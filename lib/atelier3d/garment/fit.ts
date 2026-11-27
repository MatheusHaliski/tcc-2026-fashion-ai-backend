import type { Vec3 } from "../document";

export const REGIONS = ["all", "upper", "lower", "left", "right", "center", "front", "back"] as const;
export type Region = (typeof REGIONS)[number];
export const FIT_ADJUSTS = ["hem", "length", "ease", "sleeve", "neckline"] as const;
export type FitKind = (typeof FIT_ADJUSTS)[number];
export interface Bounds { min: Vec3; max: Vec3; size: Vec3; center: Vec3 }

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function boundsOf(points: ArrayLike<number> | Vec3[]): Bounds {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  const flat = Array.isArray(points) && Array.isArray(points[0]) ? (points as Vec3[]).flat() : Array.from(points as ArrayLike<number>);
  for (let i = 0; i < flat.length; i++) {
    min[i % 3] = Math.min(min[i % 3], flat[i]);
    max[i % 3] = Math.max(max[i % 3], flat[i]);
  }
  const size = [0, 1, 2].map((a) => Math.max(1e-9, max[a] - min[a])) as Vec3;
  return { min, max, size, center: [0, 1, 2].map((a) => (min[a] + max[a]) / 2) as Vec3 };
}

/** Peso 0..1 de cada região (transição suave, sem degrau), medido nas posições ORIGINAIS da parte. */
export function regionWeight(point: Vec3, b: Bounds, region: Region): number {
  const y = (point[1] - b.min[1]) / b.size[1];
  const x = (point[0] - b.center[0]) / (b.size[0] / 2);
  const z = (point[2] - b.center[2]) / (b.size[2] / 2);
  switch (region) {
    case "all": return 1;
    case "upper": return smooth(0.4, 0.6, y);
    case "lower": return 1 - smooth(0.4, 0.6, y);
    case "left": return 1 - smooth(-0.15, 0.15, x);
    case "right": return smooth(-0.15, 0.15, x);
    case "center": return 1 - smooth(0.3, 0.55, Math.abs(x));
    case "front": return smooth(-0.2, 0.2, z);
    case "back": return 1 - smooth(-0.2, 0.2, z);
  }
}

/**
 * Ajustes de roupa por deformação regional (valores relativos ao tamanho da parte):
 * barra (alonga/encurta só a faixa de baixo), comprimento (estica a partir do topo), folga (largura em
 * torno do eixo vertical), manga (avança as pontas laterais) e decote (aprofunda o centro do topo, mais na frente).
 */
export function fitPoints(points: Vec3[], original: ArrayLike<number>, kind: FitKind, amount: number, region: Region = "all"): Vec3[] {
  if (!Number.isFinite(amount) || Math.abs(amount) > 1) throw Error("ATELIER_COMMAND_VALUE");
  const b = boundsOf(original);
  const [w, h] = [b.size[0], b.size[1]];
  return points.map((point, i) => {
    const base: Vec3 = [original[i * 3], original[i * 3 + 1], original[i * 3 + 2]];
    const weight = regionWeight(base, b, region);
    if (weight <= 0) return [...point] as Vec3;
    const y = (base[1] - b.min[1]) / h, side = (base[0] - b.center[0]) / (w / 2);
    const next = [...point] as Vec3;
    if (kind === "hem") next[1] -= amount * h * weight * clamp01(1 - y / 0.35);
    else if (kind === "length") next[1] -= amount * h * weight * (1 - y);
    else if (kind === "ease") {
      const factor = 1 + amount * weight;
      next[0] = b.center[0] + (point[0] - b.center[0]) * factor;
      next[2] = b.center[2] + (point[2] - b.center[2]) * factor;
    } else if (kind === "sleeve") next[0] += Math.sign(side) * amount * (w / 2) * weight * clamp01((Math.abs(side) - 0.55) / 0.45);
    else {
      const front = base[2] >= b.center[2] ? 1 : 0.45;
      next[1] -= amount * h * 0.3 * weight * front * clamp01((y - 0.7) / 0.3) * clamp01(1 - Math.abs(side) / 0.45) ** 2;
    }
    return next;
  });
}

/** Simetria X: o lado escolhido é copiado espelhado para o outro, casando vértices pela posição original. */
export function mirrorPoints(points: Vec3[], original: ArrayLike<number>, from: "left" | "right"): Vec3[] {
  const b = boundsOf(original);
  const cx = b.center[0], cell = Math.max(...b.size) / 32 || 1;
  const grid = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < points.length; i++) {
    const k = key(original[i * 3], original[i * 3 + 1], original[i * 3 + 2]);
    grid.set(k, [...(grid.get(k) ?? []), i]);
  }
  const source = (x: number) => (from === "left" ? x <= cx : x >= cx);
  return points.map((point, i) => {
    const ox = original[i * 3], oy = original[i * 3 + 1], oz = original[i * 3 + 2];
    if (source(ox) && Math.abs(ox - cx) > 1e-9) return [...point] as Vec3;
    const mx = 2 * cx - ox;
    let best = -1, distance = Infinity;
    const [gx, gy, gz] = [mx, oy, oz].map((v) => Math.floor(v / cell));
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
      for (const j of grid.get(`${gx + dx},${gy + dy},${gz + dz}`) ?? []) {
        const d = Math.hypot(original[j * 3] - mx, original[j * 3 + 1] - oy, original[j * 3 + 2] - oz);
        if (d < distance) [best, distance] = [j, d];
      }
    if (best < 0 || distance > cell) return [...point] as Vec3;
    if (Math.abs(ox - cx) <= 1e-9) return [cx, points[best][1], points[best][2]];
    return [2 * cx - points[best][0], points[best][1], points[best][2]];
  });
}
