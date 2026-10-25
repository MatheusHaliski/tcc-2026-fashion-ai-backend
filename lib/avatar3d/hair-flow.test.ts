import { describe, expect, it } from "vitest";
import { measureHairPart } from "./hair-flow";
import type { Pt, Raster } from "./image-stats";

/*
 * Foto sintética 100×100: rosto centrado em x = 50 com meia-largura 30 (234 → 20, 454 → 80), testa (10) em y = 70 e
 * queixo (152) em y = 100. A faixa medida fica em x ≈ 21–79, y ≈ 29–66.
 */
const W = 100, H = 100;
const pts = (half = 30, top = 70, chin = 100): Pt[] => {
  const p: Pt[] = Array.from({ length: 468 }, () => [50, 70] as Pt);
  p[234] = [50 - half, 70]; p[454] = [50 + half, 70]; p[10] = [50, top]; p[152] = [50, chin];
  return p;
};
const raster = (lum: (x: number, y: number) => number, w = W, h = H): Raster => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; const v = lum(x, y); data[o] = data[o + 1] = data[o + 2] = v; data[o + 3] = 255; }
  return { width: w, height: h, data };
};
// listras diagonais: à esquerda da risca (x0) descem para um lado, à direita para o outro
const stripes = (x0: number) => raster((x, y) => (Math.floor((x < x0 ? x + y : x - y + 200) / 3) % 2 ? 220 : 30));

describe("risca medida na foto (measureHairPart)", () => {
  it("listras que mudam de direção no meio dão risca ao meio com divergência alta", () => {
    const r = measureHairPart(stripes(50), null, pts());
    expect(r).not.toBeNull();
    expect(Math.abs(r!.part)).toBeLessThanOrEqual(0.25);
    expect(r!.divergence).toBeGreaterThan(1);
    expect(r!.confidence).toBeGreaterThan(0.5);
    expect(r!.confidence).toBeLessThanOrEqual(0.9);
  });

  it("risca deslocada para a direita da imagem dá parte positiva", () => {
    const r = measureHairPart(stripes(65), null, pts());
    expect(r!.part).toBeGreaterThan(0.2);
  });

  it("listras numa direção só não divergem: sem risca", () => {
    expect(measureHairPart(raster((x, y) => (Math.floor((x + y) / 3) % 2 ? 220 : 30)), null, pts())).toBeNull();
  });

  it("foto lisa (sem gradiente) não tem campo: sem risca", () => {
    expect(measureHairPart(raster(() => 128), null, pts())).toBeNull();
  });

  it("máscara de cabelo vazia exclui todas as células", () => {
    expect(measureHairPart(stripes(50), new Float32Array(W * H), pts())).toBeNull();
    expect(measureHairPart(stripes(50), new Float32Array(W * H).fill(1), pts())).not.toBeNull();
  });

  it("faixa estreita ou baixa demais devolve null", () => {
    expect(measureHairPart(stripes(50), null, pts(10))).toBeNull();
    expect(measureHairPart(stripes(50), null, pts(30, 70, 75))).toBeNull();
  });

  it("rosto largo numa foto grande reduz a grade (passo > 1) e ainda mede", () => {
    const big = 520;
    const p: Pt[] = Array.from({ length: 468 }, () => [260, 330] as Pt);
    p[234] = [20, 330]; p[454] = [500, 330]; p[10] = [260, 330]; p[152] = [260, 500];
    const img = raster((x, y) => (Math.floor((x < 260 ? x + y : x - y + 1000) / 6) % 2 ? 220 : 30), big, big);
    const r = measureHairPart(img, null, p);
    expect(r).not.toBeNull();
    expect(Math.abs(r!.part)).toBeLessThanOrEqual(0.25);
  });

  it("landmarks coincidentes não dividem por zero (meia-largura e altura viram 1) e dão null", () => {
    expect(measureHairPart(stripes(50), null, Array.from({ length: 468 }, () => [50, 50] as Pt))).toBeNull();
  });
});
