/**
 * Sugestão de tipo pela forma do recorte (auditoria 10: "o tipo nunca é sugerido; dava para usar a proporção do
 * recorte"). Conferida nas ilustrações de referência das peças, que têm fundo transparente.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import path from "node:path";
import { foregroundMask, suggestCategoryFromMask } from "./type-suggestion";

async function suggest(file: string, onBackground = false) {
  let img = sharp(path.join(process.cwd(), "public/_derived/pecas_thumb", file)).resize(160, 160, { fit: "inside" });
  if (onBackground) img = img.flatten({ background: "#ece8e0" });
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return suggestCategoryFromMask(foregroundMask(new Uint8ClampedArray(data), info.width, info.height), info.width, info.height);
}

describe("sugestão de tipo pela forma", () => {
  it("calça alta com o vão entre as pernas: parte inferior (também numa foto com fundo)", async () => {
    expect(await suggest("02_parte_inferior_01_jeans-320.webp")).toBe("lower_piece");
    expect(await suggest("02_parte_inferior_08_legging-320.webp")).toBe("lower_piece");
    expect(await suggest("02_parte_inferior_01_jeans-320.webp", true)).toBe("lower_piece");
  });

  it("camiseta e blusa de manga: parte superior", async () => {
    expect(await suggest("01_parte_superior_01_camiseta_referencia-320.webp")).toBe("upper_piece");
    expect(await suggest("01_parte_superior_03_blouse_blusa-320.webp", true)).toBe("upper_piece");
  });

  it("cinto: acessório; saia, tênis, bolsa e colar ficam sem sugestão", async () => {
    expect(await suggest("04_acessorios_06_cinto-320.webp")).toBe("accessory_piece");
    expect(await suggest("02_parte_inferior_12_saia-320.webp")).toBeNull();
    expect(await suggest("03_calcados_01_tenis_casual-320.webp")).toBeNull();
    expect(await suggest("04_acessorios_04_tote-320.webp")).toBeNull();
    expect(await suggest("04_acessorios_15_colar-320.webp")).toBeNull();
  });
});
