import type { UV } from "./state";

/** RGBA 8 bits sem pré-multiplicação, linha 0 = v 0 (texturas glTF usam flipY = false). */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
export type RGB = [number, number, number];

export function createPixels(width: number, height: number): Pixels {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function clonePixels(source: Pixels): Pixels {
  return { width: source.width, height: source.height, data: new Uint8ClampedArray(source.data) };
}

export function hexToRgb(hex: string): RGB {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? parseInt(hex.slice(1), 16) : 0;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function fillPixels(target: Pixels, color: RGB, alpha = 255): Pixels {
  for (let i = 0; i < target.data.length; i += 4) {
    target.data[i] = color[0];
    target.data[i + 1] = color[1];
    target.data[i + 2] = color[2];
    target.data[i + 3] = alpha;
  }
  return target;
}

/** Composição "over" de uma cor com cobertura `a` (0..1) no pixel `i` (índice do canal R). */
export function blendAt(data: Uint8ClampedArray, i: number, r: number, g: number, b: number, a: number) {
  if (a <= 0) return;
  const da = data[i + 3] / 255;
  const out = a + da * (1 - a);
  if (out <= 0) return;
  const keep = (da * (1 - a)) / out, put = a / out;
  data[i] = r * put + data[i] * keep;
  data[i + 1] = g * put + data[i + 1] * keep;
  data[i + 2] = b * put + data[i + 2] * keep;
  data[i + 3] = out * 255;
}

/** Desenha `source` sobre `target` (mesmo tamanho) com opacidade global. */
export function blendOver(target: Pixels, source: Pixels, opacity = 1) {
  if (target.width !== source.width || target.height !== source.height) throw Error("ATELIER_PIXELS_SIZE");
  const s = source.data;
  for (let i = 0; i < s.length; i += 4) blendAt(target.data, i, s[i], s[i + 1], s[i + 2], (s[i + 3] / 255) * opacity);
}

/** Cobertura do pincel a uma distância normalizada (0 = centro, 1 = borda); dureza 1 = borda seca. */
export function brushFalloff(distance: number, hardness: number): number {
  if (distance >= 1) return 0;
  const inner = Math.min(0.999, Math.max(0, hardness));
  if (distance <= inner) return 1;
  const t = (distance - inner) / (1 - inner);
  return 1 - t * t * (3 - 2 * t);
}

/** Pontos de carimbo espaçados ao longo do traço (em pixels), incluindo o primeiro e o último. */
export function strokeDabs(points: [number, number][], spacing: number): [number, number][] {
  if (!points.length) return [];
  const step = Math.max(0.5, spacing);
  const out: [number, number][] = [points[0]];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const length = Math.hypot(bx - ax, by - ay);
    let travelled = step - carry;
    while (travelled <= length) {
      const t = travelled / length;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      travelled += step;
    }
    carry = length - (travelled - step);
  }
  const last = points[points.length - 1];
  const tail = out[out.length - 1];
  if (points.length > 1 && (tail[0] !== last[0] || tail[1] !== last[1])) out.push(last);
  return out;
}

/**
 * Máscara do traço inteiro (máximo da cobertura de cada carimbo): opacidade não acumula dentro do mesmo
 * traço, como nos editores de textura. Retorna a caixa e a cobertura 0..1 por pixel.
 */
export function strokeMask(width: number, height: number, points: UV[], radius: number, hardness: number) {
  const pixels = points.map(([u, v]) => [u * width, v * height] as [number, number]);
  const dabs = strokeDabs(pixels, radius * 0.25);
  const xs = dabs.map((p) => p[0]), ys = dabs.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - radius)), x1 = Math.min(width - 1, Math.ceil(Math.max(...xs) + radius));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - radius)), y1 = Math.min(height - 1, Math.ceil(Math.max(...ys) + radius));
  if (!dabs.length || x1 < x0 || y1 < y0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const mask = new Float32Array(w * h);
  for (const [cx, cy] of dabs) {
    const ax = Math.max(x0, Math.floor(cx - radius)), bx = Math.min(x1, Math.ceil(cx + radius));
    const ay = Math.max(y0, Math.floor(cy - radius)), by = Math.min(y1, Math.ceil(cy + radius));
    for (let y = ay; y <= by; y++)
      for (let x = ax; x <= bx; x++) {
        const cover = brushFalloff(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / radius, hardness);
        const k = (y - y0) * w + (x - x0);
        if (cover > mask[k]) mask[k] = cover;
      }
  }
  return { x0, y0, w, h, mask };
}

/** Amostra bilinear com repetição (padrões e estampas lado a lado). */
export function sampleWrapped(source: Pixels, u: number, v: number, out: number[]) {
  const x = (((u % 1) + 1) % 1) * source.width - 0.5, y = (((v % 1) + 1) % 1) * source.height - 0.5;
  const xa = Math.floor(x), ya = Math.floor(y), fx = x - xa, fy = y - ya;
  const W = source.width, H = source.height, d = source.data;
  for (let c = 0; c < 4; c++) out[c] = 0;
  for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
    const i = ((((ya + dy) % H) + H) % H * W + ((((xa + dx) % W) + W) % W)) * 4;
    for (let c = 0; c < 4; c++) out[c] += d[i + c] * w;
  }
  return out;
}

/** Repete `tile` sobre todo o UV (`repeat` vezes por eixo), girado em torno do centro. */
export function tileOver(target: Pixels, tile: Pixels, repeat: number, rotation: number, opacity: number) {
  const cos = Math.cos(rotation), sin = Math.sin(rotation), sample = [0, 0, 0, 0];
  for (let y = 0; y < target.height; y++)
    for (let x = 0; x < target.width; x++) {
      const u = (x + 0.5) / target.width - 0.5, v = (y + 0.5) / target.height - 0.5;
      sampleWrapped(tile, (u * cos - v * sin) * repeat, (u * sin + v * cos) * repeat, sample);
      blendAt(target.data, (y * target.width + x) * 4, sample[0], sample[1], sample[2], (sample[3] / 255) * opacity);
    }
}
