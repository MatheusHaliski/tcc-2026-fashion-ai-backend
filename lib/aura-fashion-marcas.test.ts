import { describe, expect, it } from "vitest";
import { fashionPreset, suggestBrandAuras, type FashionPreset } from "./aura-fashion";

const p = (id: string, color: string, family: FashionPreset["family"] = "METAMORPHOSE"): FashionPreset => ({ id, name: id, family, image: `/aura/fashion-curated/${id}.webp`, palette: [color, "#000000"] });
const PRESETS = [
  p("brand-nike-preto", "#0b0b0b"), p("brand-nike-laranja", "#f4511e"), p("brand-nike-branco", "#f3f3f3"),
  p("brand-new-balance-cinza", "#7c7f86"), p("brand-adidas-azul", "#1e4fd8"), p("nike-solto", "#ff0000"), p("brand-nike-comum", "#ffffff", "COMMON"),
];

describe("fashionPreset: validação", () => {
  it("recusa valores que não são objeto e campos inválidos", () => {
    expect(fashionPreset(null)).toBeNull();
    expect(fashionPreset("texto")).toBeNull();
    const ok = p("brand-nike-preto", "#0b0b0b");
    expect(fashionPreset(ok)).toEqual(ok);
    expect(fashionPreset({ ...ok, id: "Maiúsculo" })).toBeNull();
    expect(fashionPreset({ ...ok, name: 3 })).toBeNull();
    expect(fashionPreset({ ...ok, name: "x".repeat(161) })).toBeNull();
    expect(fashionPreset({ ...ok, family: "OUTRA" })).toBeNull();
    expect(fashionPreset({ ...ok, video: "https://x/v.mp4" })).toBeNull();
    expect(fashionPreset({ ...ok, video: "/aura/fashion-curated/brand-nike-preto.mp4" })).not.toBeNull();
    expect(fashionPreset({ ...ok, palette: ["#000000"] })).toBeNull();
    expect(fashionPreset({ ...ok, palette: "#000000" })).toBeNull();
    expect(fashionPreset({ ...ok, id: undefined })).toBeNull();
  });
});

describe("suggestBrandAuras", () => {
  it("sem marca não sugere nada", () => {
    expect(suggestBrandAuras(PRESETS, null)).toEqual([]);
    expect(suggestBrandAuras(PRESETS, "  ")).toEqual([]);
  });

  it("filtra só presets Metamorfose da marca e mantém a ordem sem cor", () => {
    expect(suggestBrandAuras(PRESETS, "Nike").map((x) => x.id)).toEqual(["brand-nike-preto", "brand-nike-laranja", "brand-nike-branco"]);
    expect(suggestBrandAuras(PRESETS, "New Balance").map((x) => x.id)).toEqual(["brand-new-balance-cinza"]);
    expect(suggestBrandAuras(PRESETS, "Nike", "não-hex", "roxo").map((x) => x.id)).toHaveLength(3);
  });

  it("ordena pela cor nomeada (pt/en, com acento) ou pelo hex da peça", () => {
    expect(suggestBrandAuras(PRESETS, "Nike", null, "Laranja")[0].id).toBe("brand-nike-laranja");
    expect(suggestBrandAuras(PRESETS, "nike", null, "White")[0].id).toBe("brand-nike-branco");
    expect(suggestBrandAuras(PRESETS, "NIKE", "#101010")[0].id).toBe("brand-nike-preto");
    expect(suggestBrandAuras(PRESETS, "Nike", "#f00000", "preto")[0].id).toBe("brand-nike-preto");
  });
});
