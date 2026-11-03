/*
 * MET Gala Heist v2 — base das texturas procedurais da cena externa: o cache por qualidade, o sorteio com semente, o ruído
 * periódico (fbm que emenda sem costura), a amostragem bilinear e a saída canvas → textura (cor, normal e o conjunto PBR).
 */
import * as THREE from "three";

export type Quality = "high" | "low";

const cache = new Map<string, unknown>();
/** Cache das texturas do módulo (as da cidade também guardam aqui: chave com o prefixo "city-"). */
export function memo<T>(key: string, make: () => T): T { if (!cache.has(key)) cache.set(key, make()); return cache.get(key) as T; }

/** Sorteio com semente (mulberry32): a rua é sempre a mesma. */
export function prng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- ruído periódico (as texturas emendam sem costura) ---------- */
/** Campo fbm periódico size×size em 0–1: soma de oitavas de ruído de valor numa rede que repete a cada `base·2^o`. */
function field(size: number, seed: number, octaves = 5, base = 4): Float32Array {
  const out = new Float32Array(size * size); const r = prng(seed);
  let amp = 0.5, total = 0;
  for (let o = 0; o < octaves; o++) {
    const per = base << o, lat = new Float32Array(per * per);
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    const k = per / size;
    for (let y = 0; y < size; y++) {
      const fy = y * k, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty), y0 = (iy % per) * per, y1 = ((iy + 1) % per) * per;
      for (let x = 0; x < size; x++) {
        const fx = x * k, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx), x0 = ix % per, x1 = (ix + 1) % per;
        const a = lat[y0 + x0], b = lat[y0 + x1], c = lat[y1 + x0], d = lat[y1 + x1];
        out[y * size + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
export const fieldOf = (size: number, seed: number, octaves = 5, base = 4) => memo(`f${size}:${seed}:${octaves}:${base}`, () => field(size, seed, octaves, base));
/** Amostra o campo com repetição (bilinear), em coordenadas de pixel de um campo de lado n. */
export function samp(f: Float32Array, n: number, x: number, y: number): number {
  x = ((x % n) + n) % n; y = ((y % n) + n) % n;
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy, ix1 = (ix + 1) % n, iy1 = (iy + 1) % n;
  const a = f[iy * n + ix], b = f[iy * n + ix1], c = f[iy1 * n + ix], d = f[iy1 * n + ix1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ---------- saída: canvas → textura ---------- */
export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return [c, c.getContext("2d", { willReadFrequently: false })!];
}
export function texFrom(c: HTMLCanvasElement, srgb: boolean, meters?: number | [number, number]): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (meters !== undefined) { const [mx, my] = typeof meters === "number" ? [meters, meters] : meters; t.repeat.set(1 / mx, 1 / my); }
  t.needsUpdate = true;
  return t;
}
/** Escreve RGBA num canvas a partir de uma função por pixel. */
function paint(w: number, h: number, px: (x: number, y: number, o: Uint8ClampedArray, i: number) => void): HTMLCanvasElement {
  const [c, g] = canvas(w, h); const img = g.createImageData(w, h); const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(x, y, d, (y * w + x) * 4);
  g.putImageData(img, 0, 0); return c;
}
/** Mapa normal (espaço tangente, +Y para cima) a partir de um campo de altura periódico. */
export function normalFrom(hf: Float32Array, w: number, h: number, strength: number): HTMLCanvasElement {
  return paint(w, h, (x, y, d, i) => {
    const l = hf[y * w + ((x - 1 + w) % w)], r = hf[y * w + ((x + 1) % w)], u = hf[((y - 1 + h) % h) * w + x], b = hf[((y + 1) % h) * w + x];
    let nx = (l - r) * strength, ny = (b - u) * strength, nz = 1; const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  });
}
export interface PbrSet { map: THREE.Texture; normalMap: THREE.Texture; orm: THREE.Texture; meters: [number, number] }
export function pbr(w: number, h: number, meters: [number, number], color: Uint8ClampedArray, height: Float32Array, orm: Uint8ClampedArray, normalStrength: number): PbrSet {
  const toCanvas = (data: Uint8ClampedArray) => { const [c, g] = canvas(w, h); const img = g.createImageData(w, h); img.data.set(data); g.putImageData(img, 0, 0); return c; };
  return { map: texFrom(toCanvas(color), true, meters), normalMap: texFrom(normalFrom(height, w, h, normalStrength), false, meters), orm: texFrom(toCanvas(orm), false, meters), meters };
}
