import { createPixels, type Pixels } from "./raster";
import type { WeaveKind } from "./state";

const frac = (x: number) => x - Math.floor(x);

/** Ruído de valor periódico (repete a cada `period` células), sem estado global. */
export function hash2(i: number, j: number): number {
  return frac(Math.sin(i * 127.1 + j * 311.7) * 43758.5453123);
}
export function tileNoise(u: number, v: number, period: number): number {
  const x = frac(u) * period, y = frac(v) * period;
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const at = (a: number, b: number) => hash2(((a % period) + period) % period, ((b % period) + period) % period);
  const top = at(i, j) * (1 - sx) + at(i + 1, j) * sx;
  const bottom = at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx;
  return top * (1 - sy) + bottom * sy;
}

/** Fios cruzados: `over(i, j)` decide se o urdume passa por cima do fio de trama na célula. */
function woven(u: number, v: number, threads: number, over: (i: number, j: number) => boolean): number {
  const x = u * threads, y = v * threads;
  const i = Math.floor(x), j = Math.floor(y), fx = frac(x), fy = frac(y);
  const warp = Math.sin(Math.PI * fx), weft = Math.sin(Math.PI * fy);
  return over(((i % threads) + threads) % threads, ((j % threads) + threads) % threads)
    ? 0.45 + 0.55 * warp * (0.75 + 0.25 * weft)
    : 0.45 + 0.55 * weft * (0.75 + 0.25 * warp);
}

/** Altura 0..1 do relevo de cada trama num ladrilho UV 0..1 que se repete sem emenda. */
export function weaveHeight(kind: WeaveKind, u: number, v: number): number {
  u = frac(u);
  v = frac(v);
  switch (kind) {
    case "plain": return woven(u, v, 8, (i, j) => (i + j) % 2 === 0);
    case "twill": return woven(u, v, 8, (i, j) => (i + j) % 4 < 2);
    case "satin": return woven(u, v, 10, (i, j) => (i * 2 + j) % 5 !== 0) * 0.4 + 0.6;
    case "knit": {
      const x = u * 6, y = v * 8, fx = frac(x) - 0.5;
      return 0.5 + 0.5 * Math.cos(2 * Math.PI * (frac(y) + Math.abs(fx) * 1.1)) * Math.cos(Math.PI * fx);
    }
    case "grain": {
      const coarse = tileNoise(u, v, 12), fine = tileNoise(u, v, 48);
      return Math.pow(coarse, 1.6) * 0.65 + fine * 0.35;
    }
    case "pile": return 0.5 + 0.5 * (tileNoise(u, v, 96) - 0.5) + 0.25 * (tileNoise(u, v, 24) - 0.5);
    case "mesh": {
      const x = frac(u * 10) - 0.5, y = frac(v * 10) - 0.5, r = Math.hypot(x, y);
      return r < 0.28 ? 0 : Math.min(1, (r - 0.28) * 5);
    }
    case "scale": {
      let best = 0;
      const rows = 8, x = u * rows, y = v * rows;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const j = Math.floor(y) + dj, shift = j % 2 ? 0.5 : 0, i = Math.floor(x - shift) + di;
          const d = Math.hypot(x - (i + 0.5 + shift), (y - (j + 0.5)) * 1.1) / 0.62;
          if (d < 1) best = Math.max(best, Math.sqrt(1 - d * d));
        }
      return best;
    }
  }
}

/** Mapa normal (espaço tangente, RGB) gerado do relevo por diferenças finitas com repetição. */
export function weaveNormalPixels(kind: WeaveKind, size = 256, strength = 3): Pixels {
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) heights[y * size + x] = weaveHeight(kind, (x + 0.5) / size, (y + 0.5) / size);
  const at = (x: number, y: number) => heights[((y + size) % size) * size + ((x + size) % size)];
  const out = createPixels(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
      out.data[i] = (-dx / length * 0.5 + 0.5) * 255;
      out.data[i + 1] = (-dy / length * 0.5 + 0.5) * 255;
      out.data[i + 2] = (1 / length * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  return out;
}
