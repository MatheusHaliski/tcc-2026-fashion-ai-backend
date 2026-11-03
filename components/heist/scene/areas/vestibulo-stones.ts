/*
 * MET Gala Heist v2 — Vestíbulo: as superfícies procedurais das pedras e madeiras da paleta (Carrara, Botticino, nero,
 * calcário de moldura e madeira tingida), geradas uma vez por tamanho com o ruído periódico da área.
 */
import { fbm, mix, vein, vnoise, vSurface, type VSurface } from "./vestibulo-tex";

export function carraraSurface(n: number): VSurface {
  return vSurface(`carrara${n}`, n, n, (u, v, o) => {
    const t = fbm(u, v, 3, 501, 5) * 5 + (u * 1.4 + v * 0.6) * 2.2;
    const w = Math.max(vein(t, 0.045) * 0.55, vein(t * 2.2 + 0.9, 0.022) * 0.3) * (0.45 + 0.55 * fbm(u, v, 5, 503, 2));
    const base = 0.9 + 0.035 * fbm(u, v, 7, 505, 3);
    o[0] = mix(base, 0.5, w); o[1] = mix(base, 0.52, w); o[2] = mix(base * 1.01, 0.56, w); o[3] = 0.5; o[4] = 0.1 + 0.08 * w;
  }, 0.3);
}
export function botticinoSurface(n: number): VSurface {
  return vSurface(`botticino${n}`, n, n, (u, v, o) => {
    const t = fbm(u, v, 4, 511, 5) * 6 + v * 3;
    const w = vein(t, 0.03) * 0.45 * fbm(u, v, 6, 513, 2), cloud = fbm(u, v, 5, 515, 4);
    o[0] = mix(0.86 + 0.05 * cloud, 0.62, w); o[1] = mix(0.78 + 0.05 * cloud, 0.55, w); o[2] = mix(0.64 + 0.05 * cloud, 0.45, w); o[3] = 0.5; o[4] = 0.16 + 0.1 * w;
  }, 0.3);
}
export function neroSurface(n: number): VSurface {
  return vSurface(`nero${n}`, n, n, (u, v, o) => {
    const t = fbm(u, v, 3, 521, 5) * 6 + (u - v) * 2.6;
    const w = Math.max(vein(t, 0.03), vein(t * 1.8 + 0.3, 0.015) * 0.55) * (0.35 + 0.65 * fbm(u, v, 6, 523, 2));
    const base = 0.025 + 0.015 * fbm(u, v, 10, 525, 2);
    o[0] = mix(base, 0.86, w); o[1] = mix(base, 0.84, w); o[2] = mix(base * 1.15, 0.8, w); o[3] = 0.5; o[4] = 0.07 + 0.04 * w;
  }, 0.3);
}
export function moldStoneSurface(n: number): VSurface {
  return vSurface(`moldStone${n}`, n, n, (u, v, o) => {
    const nn = fbm(u, v, 6, 531, 5), pit = vnoise(u * 300, v * 300, 300, 533) > 0.94, fos = vnoise(u * 90, v * 90, 90, 535) > 0.9;
    let r = 0.86 + 0.05 * (nn - 0.5), g = 0.8 + 0.05 * (nn - 0.5), b = 0.68 + 0.05 * (nn - 0.5);
    if (pit) { r *= 0.85; g *= 0.85; b *= 0.85; } if (fos) { r *= 0.95; g *= 0.94; b *= 0.92; }
    o[0] = r; o[1] = g; o[2] = b; o[3] = 0.5 + 0.08 * nn - (pit ? 0.12 : 0); o[4] = 0.7 + 0.1 * nn;
  }, 0.9);
}
/** Madeira com veio (tingida: r, g, b de base) e poros. */
export function woodSurface(n: number, r: number, g: number, b: number, seed: number): VSurface {
  return vSurface(`wood${n}-${seed}`, n, n, (u, v, o) => {
    const ring = Math.sin((u * 6 + fbm(u * 0.5, v, 4, seed, 4) * 5) * 9) * 0.5 + 0.5, pore = vnoise(u * 40, v * 400, 40, seed + 7) > 0.8;
    const k = 0.78 + 0.32 * ring - (pore ? 0.12 : 0);
    o[0] = r * k; o[1] = g * k; o[2] = b * k; o[3] = 0.5 + 0.06 * ring - (pore ? 0.08 : 0); o[4] = 0.32 + 0.12 * (1 - ring);
  }, 0.5);
}

