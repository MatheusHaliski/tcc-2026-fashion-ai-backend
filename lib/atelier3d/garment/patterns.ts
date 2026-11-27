import { createPixels, hexToRgb, type Pixels, type RGB } from "./raster";
import { tileNoise } from "./weave";
import type { PatternKind } from "./state";

export const PATTERN_COLORS: Record<PatternKind, [string, string, string]> = {
  stripes: ["#f4f1ea", "#1f3a5f", "#c8423b"],
  plaid: ["#7a1f23", "#1d3b2a", "#e8c547"],
  polka: ["#1e1e24", "#f4f1ea", "#e8c547"],
  camo: ["#5b6b3c", "#3b4428", "#a39a6b"],
};

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Cor de um ponto do ladrilho (u, v em 0..1); todas as estampas repetem sem emenda. */
export function patternColor(kind: PatternKind, colors: [RGB, RGB, RGB], u: number, v: number): RGB {
  const [a, b, c] = colors;
  switch (kind) {
    case "stripes": {
      const band = (v * 4) % 2 < 1 ? a : b;
      const line = Math.abs(((v * 4) % 1) - 0.5) > 0.46 ? 1 : 0;
      return mix(band, c, line);
    }
    case "plaid": {
      const vertical = (u > 0.18 && u < 0.46 ? 0.55 : 0) + (Math.abs(u - 0.72) < 0.02 ? 0.9 : 0);
      const horizontal = (v > 0.18 && v < 0.46 ? 0.55 : 0) + (Math.abs(v - 0.72) < 0.02 ? 0.9 : 0);
      const thin = Math.abs(u - 0.72) < 0.02 || Math.abs(v - 0.72) < 0.02;
      return mix(a, thin ? c : b, Math.min(1, (vertical + horizontal) * 0.6));
    }
    case "polka": {
      const d = Math.min(Math.hypot(u - 0.25, v - 0.25), Math.hypot(u - 0.75, v - 0.75),
        ...[[-0.25, 0.75], [1.25, 0.75], [0.75, -0.25], [0.75, 1.25], [-0.25, -0.25], [1.25, 1.25]].map(([x, y]) => Math.hypot(u - x, v - y)));
      return mix(a, b, 1 - smooth(0.13, 0.145, d));
    }
    case "camo": {
      const n = tileNoise(u, v, 4) * 0.6 + tileNoise(u + 0.37, v + 0.11, 8) * 0.4;
      const m = tileNoise(u + 0.53, v + 0.71, 5) * 0.7 + tileNoise(u, v, 10) * 0.3;
      if (m > 0.62) return mix(b, [0, 0, 0], 0.25);
      return n < 0.42 ? a : n < 0.58 ? b : c;
    }
  }
}

/** Ladrilho RGBA opaco da estampa procedural (gerado sem canvas, testável no Node). */
export function patternPixels(kind: PatternKind, colors: [string, string, string], size = 256): Pixels {
  const rgb = colors.map(hexToRgb) as [RGB, RGB, RGB];
  const out = createPixels(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const color = patternColor(kind, rgb, (x + 0.5) / size, (y + 0.5) / size), i = (y * size + x) * 4;
      out.data[i] = color[0];
      out.data[i + 1] = color[1];
      out.data[i + 2] = color[2];
      out.data[i + 3] = 255;
    }
  return out;
}

const tiles = new Map<string, Pixels>();
export function cachedPatternPixels(kind: PatternKind, colors: [string, string, string]): Pixels {
  const key = `${kind}:${colors.join(",")}`;
  let tile = tiles.get(key);
  if (!tile) {
    if (tiles.size > 24) tiles.clear();
    tile = patternPixels(kind, colors);
    tiles.set(key, tile);
  }
  return tile;
}
