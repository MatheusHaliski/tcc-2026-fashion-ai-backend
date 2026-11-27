import { describe, expect, it } from "vitest";
import { contornoDaCategoria, formaDaCategoria } from "./formas";
import { painelDaSilhueta, recortarFundo, recorteUsavel } from "./silhueta";

/** Imagem RGBA ``w`` × ``h`` de uma cor, com um retângulo de outra cor em [x0, x1) × [y0, y1). */
function imagem(w: number, h: number, fundo: number[], peca: number[], [x0, y0, x1, y1]: number[]) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = x >= x0 && x < x1 && y >= y0 && y < y1 ? peca : fundo;
    px.set([...c, 255], (y * w + x) * 4);
  }
  return px;
}

describe("silhueta da peça na cena do ACERVO (sem o bloco com a foto)", () => {
  it("o fundo branco da miniatura sai e sobra a peça, com a caixa dela", () => {
    const px = imagem(40, 40, [255, 255, 255], [40, 70, 120], [10, 4, 30, 36]);
    const r = recortarFundo(px, 40, 40);
    expect(r.removido).toBeCloseTo(1 - (20 * 32) / 1600, 5);
    expect(r.caixa).toEqual([10 / 40, 4 / 40, 30 / 40, 36 / 40]);
    expect(px[(20 * 40 + 20) * 4 + 3]).toBe(255);             // a peça fica opaca
    expect(px[3]).toBe(0);                                      // o canto (fundo) fica transparente
    expect(recorteUsavel(r)).toBe(true);
  });

  it("só o fundo ligado à borda sai: o branco dentro da peça (estampa, gola) fica", () => {
    const px = imagem(30, 30, [250, 250, 250], [20, 20, 20], [5, 5, 25, 25]);
    for (let y = 12; y < 18; y++) for (let x = 12; x < 18; x++) px.set([250, 250, 250, 255], (y * 30 + x) * 4);
    recortarFundo(px, 30, 30);
    expect(px[(15 * 30 + 15) * 4 + 3]).toBe(255);
  });

  it("a foto sem fundo liso (estampa até a borda) não vira silhueta: fica a forma da categoria", () => {
    const px = new Uint8ClampedArray(20 * 20 * 4);
    for (let i = 0; i < 400; i++) px.set([(i * 37) % 256, (i * 91) % 256, (i * 53) % 256, 255], i * 4);
    expect(recorteUsavel(recortarFundo(px, 20, 20))).toBe(false);
    expect(recorteUsavel(null)).toBe(false);
  });

  it("o painel tem a proporção da peça e usa só o trecho dela na textura", () => {
    const p = painelDaSilhueta({ removido: 0.5, caixa: [0.25, 0, 0.75, 1] }, 0.4, 0.62);
    expect(p.h).toBeCloseTo(0.62);
    expect(p.w).toBeCloseTo(0.31);
    expect(p.uv).toEqual({ u0: 0.25, u1: 0.75, vBaixo: 0, vCima: 1 });
    const larga = painelDaSilhueta({ removido: 0.5, caixa: [0, 0.4, 1, 0.6] }, 0.4, 0.62);
    expect(larga.w).toBeCloseTo(0.4);
    expect(larga.h).toBeCloseTo(0.08);
  });

  it("cada categoria tem a sua silhueta, do tamanho pedido", () => {
    expect(["upper_piece", "lower_piece", "full_body_piece", "shoes_piece", "accessory_piece"].map(formaDaCategoria))
      .toEqual(["cima", "baixo", "inteira", "calcado", "cima"]);
    const pts = contornoDaCategoria("lower_piece", 0.4, 0.9).getPoints();
    expect(Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x))).toBeCloseTo(0.4 * 0.96, 5);
    expect(Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y))).toBeCloseTo(0.9, 5);
  });
});
