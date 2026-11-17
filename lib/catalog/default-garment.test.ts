import { describe, expect, it } from "vitest";
import manifest from "@/lib/assets/default-garments.json";
import { DEFAULT_ASSET_VERSION, defaultGarmentColor, defaultGarmentSource, defaultGarmentUrl, pieceThumbSources } from "./default-garment";

describe("ilustração padrão das peças sem foto", () => {
  it("usa a subcategoria quando ela pertence à categoria", () => {
    expect(defaultGarmentSource("lower_piece", "jeans")).toBe(manifest.subcategories.jeans.url);
  });

  it("subcategoria de outra categoria cai na ilustração da categoria", () => {
    expect(defaultGarmentSource("upper_piece", "jeans")).toBe(manifest.categories.upper_piece);
  });

  it("categoria desconhecida usa a ilustração genérica", () => {
    expect(defaultGarmentSource("categoria_inexistente", null)).toBe(manifest.generic);
    expect(defaultGarmentSource(null, null)).toBe(manifest.generic);
  });

  it("cor: hex válido vence, depois o nome da cor, depois cinza", () => {
    expect(defaultGarmentColor(" #AABBCC ", "blue")).toBe("#aabbcc");
    expect(defaultGarmentColor("azul", "blue")).toBe(manifest.colors.blue.toLowerCase());
    expect(defaultGarmentColor(null, "cor_que_nao_existe")).toBe("#8c8a87");
  });

  it("monta a URL da rota do frontend com cor, enquadramento e versão", () => {
    const url = defaultGarmentUrl("upper_piece", "t_shirt", "#112233", null, "WHOLE");
    expect(url.startsWith("/api/catalog/default-asset?")).toBe(true);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("category")).toBe("upper_piece");
    expect(params.get("subcategory")).toBe("t_shirt");
    expect(params.get("color")).toBe("#112233");
    expect(params.get("framing")).toBe("WHOLE");
    expect(params.get("v")).toBe(DEFAULT_ASSET_VERSION);
  });

  it("miniatura: peça sem foto usa a ilustração; com foto, a miniatura e a imagem", () => {
    const [url] = pieceThumbSources({ defaultImage: true, category: "upper_piece", colorHex: "#112233" });
    expect(url).toContain("/api/catalog/default-asset?");
    expect(pieceThumbSources({ thumbnailUrl: "/t.webp", imageUrl: "/i.webp" })).toEqual(["/t.webp", "/i.webp"]);
  });
});
