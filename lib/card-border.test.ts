import { describe, expect, it } from "vitest";
import { autoBorderPair, borderPaint, borderStyle, DEFAULT_BORDER, isHexColor } from "./card-border";

describe("borda do card", () => {
  it("aceita só cores hex de 6 dígitos", () => {
    expect(isHexColor("#a1B2c3")).toBe(true);
    expect(isHexColor("#abc")).toBe(false);
    expect(isHexColor("red")).toBe(false);
    expect(isHexColor(123)).toBe(false);
  });

  it("sem fundo nem escolha, usa a borda padrão champanhe → linho", () => {
    expect(autoBorderPair(null)).toEqual([DEFAULT_BORDER.from, DEFAULT_BORDER.to]);
    expect(borderPaint(null).paint).toBe(`linear-gradient(135deg,${DEFAULT_BORDER.from},${DEFAULT_BORDER.to})`);
  });

  it("a cor do fundo vira o início do degradê automático", () => {
    expect(autoBorderPair({ color: "#112233" })).toEqual(["#112233", DEFAULT_BORDER.to]);
    expect(autoBorderPair({ color: "azul" })).toEqual([DEFAULT_BORDER.from, DEFAULT_BORDER.to]);
  });

  it("metamorfose e preset de marca trazem a própria paleta", () => {
    expect(autoBorderPair({ auraMetamorphose: "PRISMA" })).toEqual(["#e6a0e8", "#77dce2"]);
    expect(autoBorderPair({ auraMetamorphosePreset: "NIKE_ORANGE" })).toEqual(["#f97316", "#ffd08a"]);
  });

  it("Aura Hype usa a paleta do efeito, com SCANNER como padrão", () => {
    expect(autoBorderPair({ auraHype: "STARS" }, true)).toEqual(["#f5d38b", "#e4b9ff"]);
    expect(autoBorderPair({ auraHype: "INEXISTENTE" }, true)).toEqual(["#65eddf", "#a3c8ff"]);
  });

  it("modo cor sólida pinta e brilha na cor escolhida", () => {
    expect(borderPaint({ border: { mode: "COLOR", color: "#ff0000" } })).toEqual({ paint: "#ff0000", glow: "#ff0000" });
  });

  it("modo degradê usa as cores escolhidas e completa as inválidas com o automático", () => {
    expect(borderPaint({ border: { mode: "GRADIENT", from: "#000000", to: "#ffffff" } }).paint).toBe("linear-gradient(135deg,#000000,#ffffff)");
    expect(borderPaint({ border: { mode: "GRADIENT", from: "x", to: "#ffffff" } }).paint).toBe(`linear-gradient(135deg,${DEFAULT_BORDER.from},#ffffff)`);
  });

  it("o estilo expõe a tinta e o brilho como variáveis CSS", () => {
    const style = borderStyle({ border: { mode: "COLOR", color: "#123456" } }) as Record<string, string>;
    expect(style["--card-border-paint"]).toBe("#123456");
    expect(style["--card-border-glow"]).toBe("#123456");
  });
});
