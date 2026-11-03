/*
 * MET Gala Heist v2 — beco (Z15): utilitários de ruído das texturas: cache (chave "beco-…"), sorteio com semente, campo fbm
 * periódico, amostragem bilinear com repetição, suavização e hash inteiro.
 */
export type Quality = "high" | "low";

const cache = new Map<string, unknown>();
export function memo<T>(key: string, make: () => T): T { const k = `beco-${key}`; if (!cache.has(k)) cache.set(k, make()); return cache.get(k) as T; }

/** Sorteio com semente (mulberry32): o beco é sempre o mesmo. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- ruído periódico (emenda sem costura) ---------- */
/** Campo fbm periódico n×n em 0–1 (oitavas de ruído de valor numa rede que repete a cada `base·2^o`). */
export function field(n: number, seed: number, octaves = 5, base = 4): Float32Array {
  const out = new Float32Array(n * n), r = rng(seed);
  let amp = 0.5, total = 0;
  for (let o = 0; o < octaves; o++) {
    const per = base << o, lat = new Float32Array(per * per);
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    const k = per / n;
    for (let y = 0; y < n; y++) {
      const fy = y * k, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty), y0 = (iy % per) * per, y1 = ((iy + 1) % per) * per;
      for (let x = 0; x < n; x++) {
        const fx = x * k, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx), x0 = ix % per, x1 = (ix + 1) % per;
        const a = lat[y0 + x0], b = lat[y0 + x1], c = lat[y1 + x0], d = lat[y1 + x1];
        out[y * n + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
export const fieldOf = (n: number, seed: number, octaves = 5, base = 4) => memo(`f${n}:${seed}:${octaves}:${base}`, () => field(n, seed, octaves, base));
/** Amostra com repetição (bilinear) num campo de lado n, em coordenadas de pixel do campo. */
export function samp(f: Float32Array, n: number, x: number, y: number): number {
  x = ((x % n) + n) % n; y = ((y % n) + n) % n;
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy, ix1 = (ix + 1) % n, iy1 = (iy + 1) % n;
  const a = f[iy * n + ix], b = f[iy * n + ix1], c = f[iy1 * n + ix], d = f[iy1 * n + ix1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
/** Hash inteiro → 0–1 (posições de células, tons de tijolo). */
export function hash(i: number, j: number, seed: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
