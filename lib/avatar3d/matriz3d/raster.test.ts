import { describe, expect, it } from "vitest";
import { CORES, render, sideBySide, type Image, type Mesh } from "./raster";

const px = (img: Image, x: number, y: number) => Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
// quadrado de lado 2 no plano z = z0 (dois triângulos), de −1 a 1 em x e y
const quad = (z0: number, color: [number, number, number], alpha?: number[]): Mesh => ({
  position: [-1, -1, z0, 1, -1, z0, 1, 1, z0, -1, 1, z0], index: [0, 1, 2, 0, 2, 3], color, alpha,
});
const FRONT = { axis: "front" as const, x0: -2, x1: 2, y0: -2, y1: 2 };

describe("rasterizador do catálogo MATRIZ-3D", () => {
  it("sem malhas devolve só o fundo, com altura proporcional à janela", () => {
    const img = render([], { axis: "front", x0: 0, x1: 2, y0: 0, y1: 1 }, 8, [1, 2, 3]);
    expect([img.width, img.height]).toEqual([8, 4]);
    expect(px(img, 0, 0)).toEqual([1, 2, 3, 255]);
    expect(render([], { axis: "front", x0: 0, x1: 10, y0: 0, y1: 0 }, 4).height).toBe(1);
  });

  it("de frente desenha o quadrado no centro com sombreamento de Lambert e deixa a borda com o fundo", () => {
    const img = render([quad(0, [200, 100, 50])], FRONT, 8);
    const c = px(img, 4, 4);
    expect(c).not.toEqual([246, 244, 240, 255]);
    expect(c[0]).toBeLessThanOrEqual(200);
    expect(c[0]).toBeGreaterThan(c[1]);
    expect(px(img, 0, 0)).toEqual([246, 244, 240, 255]);
  });

  it("z-buffer: a malha mais perto da câmera vence, qualquer que seja a ordem", () => {
    const perto = quad(1, [255, 0, 0]), longe = quad(-1, [0, 0, 255]);
    for (const ordem of [[perto, longe], [longe, perto]]) {
      const c = px(render(ordem, FRONT, 8), 4, 4);
      expect(c[0]).toBeGreaterThan(0);
      expect(c[2]).toBe(0);
    }
  });

  it("face virada para trás é sombreada dos dois lados (DoubleSide)", () => {
    const m = quad(0, [200, 200, 200]); const inv: Mesh = { ...m, index: [0, 2, 1, 0, 3, 2] };
    expect(px(render([inv], FRONT, 8), 4, 4)).toEqual(px(render([m], FRONT, 8), 4, 4));
  });

  it("alfa abaixo de 0,5 nos três vértices descarta o triângulo; alfa misto corta por pixel", () => {
    expect(px(render([quad(0, [255, 0, 0], [0, 0, 0, 0])], FRONT, 8), 4, 4)).toEqual([246, 244, 240, 255]);
    // alfa 1 só no vértice (1,1): perto dele desenha, longe dele (−1,−1) não
    const img = render([quad(0, [255, 0, 0], [0, 0, 1, 0.4])], FRONT, 16);
    expect(px(img, 11, 4)[1]).toBe(0);
    expect(px(img, 5, 11)).toEqual([246, 244, 240, 255]);
  });

  it("triângulo degenerado (área zero) é ignorado", () => {
    const m: Mesh = { position: [0, 0, 0, 1, 1, 0, 2, 2, 0], index: [0, 1, 2], color: [0, 0, 0] };
    const img = render([m], FRONT, 8);
    expect(img.data.every((v, i) => v === [246, 244, 240, 255][i % 4])).toBe(true);
  });

  it("de lado projeta o eixo z na horizontal: um plano em z = const vira uma linha sem área", () => {
    const lado = { axis: "side" as const, x0: -2, x1: 2, y0: -2, y1: 2 };
    expect(px(render([quad(0, [255, 0, 0])], lado, 8), 4, 4)).toEqual([246, 244, 240, 255]);
    // plano x = 0 (de frente para o lado)
    const m: Mesh = { position: [0, -1, -1, 0, -1, 1, 0, 1, 1, 0, 1, -1], index: [0, 1, 2, 0, 2, 3], color: [0, 255, 0] };
    expect(px(render([m], lado, 8), 4, 4)[1]).toBeGreaterThan(0);
  });

  it("junta imagens lado a lado com espaço e centra a mais baixa", () => {
    const a: Image = { width: 2, height: 4, data: new Uint8ClampedArray(2 * 4 * 4).fill(10) };
    const b: Image = { width: 1, height: 2, data: new Uint8ClampedArray(1 * 2 * 4).fill(99) };
    const out = sideBySide([a, b], 3, [0, 0, 0]);
    expect([out.width, out.height]).toEqual([6, 4]);
    expect(px(out, 0, 0)).toEqual([10, 10, 10, 10]);
    expect(px(out, 3, 0)).toEqual([0, 0, 0, 255]);
    expect(px(out, 5, 0)).toEqual([0, 0, 0, 255]);
    expect(px(out, 5, 1)).toEqual([99, 99, 99, 99]);
    expect(sideBySide([a]).width).toBe(2);
  });

  it("a legenda tem uma cor RGB para cada componente", () => {
    expect(Object.values(CORES).every((c) => c.length === 3 && c.every((v) => v >= 0 && v <= 255))).toBe(true);
    expect(CORES.corpo).toEqual([222, 214, 204]);
  });
});
