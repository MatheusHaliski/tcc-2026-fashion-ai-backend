import { describe, expect, it } from "vitest";
import { TOTAL_FRAME, catalogWholeFrame, fitWhole, isLightBackground, pieceWholeFrame, resolveFraming, validBox } from "./photo-framing";
import type { PieceView } from "@/lib/api/types";

const pct = (v: unknown) => parseFloat(String(v));

describe("fitWhole — Total frame", () => {
  it("peça larga (bermuda) ocupa a largura máxima e fica centralizada nos dois eixos", () => {
    // foto 864×1152, bermuda de x=110 a 755 e y=220 a 910 (como o exemplo de referência)
    const fit = fitWhole({ x: 110 / 864, y: 220 / 1152, w: 645 / 864, h: 690 / 1152 }, 864, 1152)!;
    const k = pct(fit.style.width) / 100;                         // fração do quadro por largura da foto
    const garmentW = (645 / 864) * k * 100;
    expect(garmentW).toBeCloseTo(TOTAL_FRAME.maxW * 100, 0);
    const left = pct(fit.style.left), top = pct(fit.style.top), height = pct(fit.style.height);
    expect(left + ((110 + 645 / 2) / 864) * pct(fit.style.width)).toBeCloseTo(50, 1);   // centro x = 50%
    expect(top + ((220 + 690 / 2) / 1152) * height).toBeCloseTo(50, 1);                 // centro y = 50%
    expect(fit.grounded).toBe(false);
  });

  it("peça alta (camisa comprida) ocupa a altura máxima, nunca passa da largura máxima", () => {
    const fit = fitWhole({ x: 0.3, y: 0.05, w: 0.4, h: 0.9 }, 1000, 1000)!;
    const garmentH = 0.9 * pct(fit.style.height);
    const garmentW = 0.4 * pct(fit.style.width);
    expect(garmentH).toBeCloseTo(TOTAL_FRAME.maxH * 100, 0);
    expect(garmentW).toBeLessThanOrEqual(TOTAL_FRAME.maxW * 100 + 0.01);
    expect(fit.floor).toBeCloseTo(50 + (TOTAL_FRAME.maxH * 100) / 2, 0);   // base da peça: abaixo do centro
  });

  it("peça fora do centro na foto é trazida para o centro do quadro", () => {
    const a = fitWhole({ x: 0.05, y: 0.4, w: 0.3, h: 0.5 }, 800, 800)!;
    expect(pct(a.style.left) + (0.05 + 0.15) * pct(a.style.width)).toBeCloseTo(50, 1);
  });

  it("foto que corta a peça embaixo encosta a peça na base do quadro e tira a sombra", () => {
    const fit = fitWhole({ x: 0.2, y: 0.3, w: 0.6, h: 0.7 }, 1000, 1000, ["bottom"])!;
    expect(fit.grounded).toBe(true);
    expect(fit.floor).toBeCloseTo(100, 1);
  });

  it("caixa ou medidas inválidas → null (o card volta ao recorte de sempre)", () => {
    expect(fitWhole({ x: 0.5, y: 0.5, w: 0.9, h: 0.9 }, 100, 100)).toBeNull();
    expect(fitWhole({ x: 0.1, y: 0.1, w: 0, h: 0.5 }, 100, 100)).toBeNull();
    expect(fitWhole({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, 0, 100)).toBeNull();
    expect(validBox({ x: Number.NaN, y: 0, w: 0.5, h: 0.5 })).toBe(false);
  });
});

describe("resolveFraming / fundo", () => {
  it("a escolha da peça vence o padrão de quem vê; sem nada, recorte de tecido", () => {
    expect(resolveFraming("WHOLE", "FABRIC")).toBe("WHOLE");
    expect(resolveFraming(undefined, "WHOLE")).toBe("WHOLE");
    expect(resolveFraming("qualquer", null)).toBe("FABRIC");
  });

  it("fundo claro se funde ao quadro; fundo escuro não", () => {
    expect(isLightBackground("#f6f6f6")).toBe(true);
    expect(isLightBackground("#3a3a3a")).toBe(false);
    expect(isLightBackground("azul")).toBe(false);
  });
});

describe("Total frame da peça", () => {
  const whole = { url: "https://img.brand.com/a.jpg", box: { x: 0.1, y: 0.2, w: 0.7, h: 0.6 }, background: "#ffffff" };
  it("só vale enquanto a foto da peça for a oficial do catálogo", () => {
    const piece = { imageUrl: "https://img.brand.com/card.jpg", flatLayMetadata: { catalogImage: { url: "https://img.brand.com/card.jpg", mode: "PROCESSED", whole } } } as unknown as PieceView;
    expect(pieceWholeFrame(piece)?.url).toBe(whole.url);
    expect(pieceWholeFrame({ ...piece, imageUrl: "https://media.app/minha-foto.png" } as PieceView)).toBeNull();
    expect(catalogWholeFrame({ url: "x", mode: "PROCESSED", whole: { ...whole, box: { x: 0, y: 0, w: 2, h: 2 } } })).toBeNull();
  });
});
