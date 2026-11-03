/*
 * MET Gala Heist v2 — doca (Z12): base das texturas — cache, ruído periódico rápido, gerador de superfície
 * (cor, relevo, rugosidade) e o passeio aleatório das trincas. Saiu de doca-tex.ts sem mudança.
 */
import * as THREE from "three";

const FAKE = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);
const cache = new Map<string, unknown>();
export function memo<T>(key: string, make: () => T): T { const k = `doca-${key}`; if (!cache.has(k)) cache.set(k, make()); return cache.get(k) as T; }

/* ---------- ruído periódico rápido (rede pré-calculada + amostra bilinear) ---------- */
export function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function field(n: number, seed: number, octaves = 5, base = 4): Float32Array {
  const out = new Float32Array(n * n), r = rng(seed); let amp = 0.5, total = 0;
  for (let o = 0; o < octaves; o++) {
    const per = base << o, lat = new Float32Array(per * per); for (let i = 0; i < lat.length; i++) lat[i] = r();
    const k = per / n;
    for (let y = 0; y < n; y++) {
      const fy = y * k, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty), y0 = (iy % per) * per, y1 = ((iy + 1) % per) * per;
      for (let x = 0; x < n; x++) { const fx = x * k, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx), x0 = ix % per, x1 = (ix + 1) % per; const a = lat[y0 + x0], b = lat[y0 + x1], c = lat[y1 + x0], d = lat[y1 + x1]; out[y * n + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy); }
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
export const fieldOf = (n: number, seed: number, octaves = 5, base = 4) => memo(`f${n}:${seed}:${octaves}:${base}`, () => field(n, seed, octaves, base));
/** Amostra o campo (lado n) em u, v ∈ [0, 1) com repetição; `ku`, `kv` = quantas vezes o campo cabe no ladrilho. */
export function samp(f: Float32Array, n: number, u: number, v: number, ku = 1, kv = 1): number {
  let x = u * n * ku, y = v * n * kv; x = ((x % n) + n) % n; y = ((y % n) + n) % n;
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy, ix1 = (ix + 1) % n, iy1 = (iy + 1) % n;
  const a = f[iy * n + ix], b = f[iy * n + ix1], c = f[iy1 * n + ix], d = f[iy1 * n + ix1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const hash = (i: number, j: number, seed: number) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed + 1, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

/* ---------- superfície (cor + relevo + rugosidade) ---------- */
export interface Surface { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }
type PixelFn = (u: number, v: number, x: number, y: number, out: Float32Array) => void;
function cv(w: number, h: number) { const c = document.createElement("canvas"); c.width = w; c.height = h; return { c, g: c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D }; }
export function tex(c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; return t; }
/** Gera cor, normal (gradiente da altura, dando a volta na borda) e rugosidade; `pre` desenha máscaras num canvas do
 * mesmo tamanho antes (juntas, riscos), lidas por pixel no canal vermelho. */
export function surface(key: string, W: number, H: number, fn: PixelFn, bump: number, pre?: (g: CanvasRenderingContext2D, w: number, h: number) => void): Surface {
  return memo(`sf-${key}`, () => {
    const w = FAKE ? 8 : W, h = FAKE ? 8 : H;
    const col = cv(w, h), nor = cv(w, h), rou = cv(w, h);
    const ci = col.g.createImageData(w, h), ni = nor.g.createImageData(w, h), ri = rou.g.createImageData(w, h);
    let mask: Uint8ClampedArray | null = null;
    if (pre && !FAKE) { const m = cv(w, h); m.g.fillStyle = "#000"; m.g.fillRect(0, 0, w, h); pre(m.g, w, h); mask = m.g.getImageData(0, 0, w, h).data; }
    const Hf = new Float32Array(w * h), out = new Float32Array(6);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x; out[3] = 0.5; out[4] = 0.5; out[5] = mask ? mask[k * 4] / 255 : 0;
      fn((x + 0.5) / w, (y + 0.5) / h, x, y, out);
      ci.data[k * 4] = clamp01(out[0]) * 255; ci.data[k * 4 + 1] = clamp01(out[1]) * 255; ci.data[k * 4 + 2] = clamp01(out[2]) * 255; ci.data[k * 4 + 3] = 255;
      const rr = clamp01(out[4]) * 255; ri.data[k * 4] = rr; ri.data[k * 4 + 1] = rr; ri.data[k * 4 + 2] = rr; ri.data[k * 4 + 3] = 255;
      Hf[k] = out[3];
    }
    const s = bump * w / 256;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w, xr = (x + 1) % w, yu = (y - 1 + h) % h, yd = (y + 1) % h;
      const dx = (Hf[y * w + xr] - Hf[y * w + xl]) * s, dy = (Hf[yd * w + x] - Hf[yu * w + x]) * s, l = Math.hypot(dx, dy, 1), k = (y * w + x) * 4;
      ni.data[k] = (-dx / l * 0.5 + 0.5) * 255; ni.data[k + 1] = (dy / l * 0.5 + 0.5) * 255; ni.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[k + 3] = 255;
    }
    col.g.putImageData(ci, 0, 0); nor.g.putImageData(ni, 0, 0); rou.g.putImageData(ri, 0, 0);
    return { map: tex(col.c, true), normalMap: tex(nor.c, false), roughnessMap: tex(rou.c, false) };
  });
}
/** Passeio aleatório (trincas, riscos) desenhado com volta na borda. */
export function walk(g: CanvasRenderingContext2D, w: number, h: number, r: () => number, x: number, y: number, n: number, step: number, dir: number, width: number) {
  const pts: [number, number][] = [[x, y]];
  for (let k = 0; k < n; k++) { dir += (r() - 0.5) * 0.8; x += Math.cos(dir) * step; y += Math.sin(dir) * step; pts.push([x, y]); }
  g.lineWidth = width;
  for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { g.beginPath(); pts.forEach(([a, b], k) => (k ? g.lineTo(a + ox, b + oy) : g.moveTo(a + ox, b + oy))); g.stroke(); }
}
