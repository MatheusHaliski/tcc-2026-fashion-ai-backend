/*
 * MET Gala Heist v2 — ruído periódico das texturas procedurais do interior (interior-tex.ts): hash inteiro, ruído de
 * valor com período, soma de oitavas (fbm), gerador determinístico por semente e os primitivos de desenho das superfícies
 * (veio de mármore, lascas do terrazzo, medalhão adamascado). Todo ruído é periódico: a textura repete sem emenda.
 */

/* ---------- ruído periódico ---------- */
export function hash2(i: number, j: number, seed: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
/** Ruído de valor com período p (em células da rede): vnoise(x + p, y) = vnoise(x, y). */
export function vnoise(x: number, y: number, p: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const i0 = ((xi % p) + p) % p, j0 = ((yi % p) + p) % p, i1 = (i0 + 1) % p, j1 = (j0 + 1) % p;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(i0, j0, seed), b = hash2(i1, j0, seed), c = hash2(i0, j1, seed), d = hash2(i1, j1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Soma de oitavas (u, v em [0, 1), período base p). */
export function fbm(u: number, v: number, p: number, seed: number, oct = 4): number {
  let s = 0, a = 0.5, n = 0, f = 1;
  for (let k = 0; k < oct; k++) { s += a * vnoise(u * p * f, v * p * f, p * f, seed + k * 31); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
export const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Gerador determinístico por semente (posições de lascas, tábuas, fitas). */
export function rand(seed: number) { let s = seed >>> 0 || 1; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }

/* ---------- primitivos das superfícies ---------- */
/** Veio de mármore: 1 sobre o veio, 0 fora (t = coordenada turbulenta). */
export function vein(t: number, width: number) { const s = Math.abs(Math.sin(t * Math.PI)); return 1 - smooth(0, width, s); }

/** Lascas (terrazzo): célula sorteada mais perto em grade de `cells`; devolve índice da cor ou −1. */
export function chip(u: number, v: number, cells: number, seed: number, fill: number): number {
  const x = u * cells, y = v * cells, xi = Math.floor(x), yi = Math.floor(y);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const ci = ((xi + dx) % cells + cells) % cells, cj = ((yi + dy) % cells + cells) % cells;
    const h = hash2(ci, cj, seed); if (h > fill) continue;
    const cx = xi + dx + hash2(ci, cj, seed + 7), cy = yi + dy + hash2(ci, cj, seed + 13);
    const r = 0.18 + 0.32 * hash2(ci, cj, seed + 19);
    const ex = (x - cx) * (1 + 0.5 * hash2(ci, cj, seed + 3)), ey = y - cy;
    if (ex * ex + ey * ey < r * r) return Math.floor(hash2(ci, cj, seed + 29) * 6);
  }
  return -1;
}
export const CHIPS: [number, number, number][] = [[0.95, 0.94, 0.9], [0.62, 0.6, 0.57], [0.16, 0.15, 0.15], [0.66, 0.38, 0.26], [0.83, 0.74, 0.58], [0.74, 0.62, 0.36]];

export function damask(u: number, v: number): number {
  // medalhão de quatro pétalas em grade 2×2 com losangos entre eles (linha fina ~ 0–1)
  const x = (u * 2 % 1) - 0.5, y = (v * 2 % 1) - 0.5, r = Math.hypot(x, y), a = Math.atan2(y, x);
  const petal = 0.26 + 0.1 * Math.cos(4 * a) + 0.03 * Math.cos(12 * a);
  const m1 = 1 - smooth(0.012, 0.03, Math.abs(r - petal));
  const m2 = 1 - smooth(0.01, 0.025, Math.abs(r - 0.08 - 0.03 * Math.cos(8 * a)));
  const d = Math.abs(Math.abs(x) + Math.abs(y) - 0.5);
  const m3 = 1 - smooth(0.006, 0.02, d);
  const leaf = r > 0.33 && r < 0.48 ? (1 - smooth(0.0, 0.04, Math.abs(Math.sin(a * 2) * 0.12 - (r - 0.4)))) * 0.6 : 0;
  return Math.min(1, m1 + m2 + m3 * 0.8 + leaf);
}
