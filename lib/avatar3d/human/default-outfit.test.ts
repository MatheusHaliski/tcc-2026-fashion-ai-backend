import { describe, expect, it } from "vitest";
import type { Look3dPiece } from "@/components/three/common";
import { DEFAULT_PIECES, missingZones, withDefaultOutfit } from "./default-outfit";
import { outfitOf } from "@/components/three/human-outfit";

const P = (id: string, subcategory: string, slot = "upper"): Look3dPiece => ({ id, name: id, slot, subcategory, imageUrl: `/x/${id}.png` });

describe("look padrão — o avatar 3D nunca aparece sem roupa", () => {
  it("sem peças, veste camiseta, jeans e tênis dos assets do FashionAI", () => {
    const out = withDefaultOutfit([]);
    expect(out.map((p) => p.id)).toEqual(["fai-padrao-camiseta", "fai-padrao-jeans", "fai-padrao-tenis"]);
    for (const p of out) { expect(p.imageUrl).toMatch(/^\/_derived\/pecas_thumb\/.+-640\.webp$/); expect(p.defaultImage).toBe(true); }
  });

  it("completa só as zonas que o look não cobre", () => {
    expect(missingZones([P("c", "t_shirt")])).toEqual(["lower", "feet"]);
    expect(missingZones([P("v", "dress", "dress")])).toEqual(["feet"]);
    expect(missingZones([P("m", "jumpsuit", "dress"), P("t", "sneakers", "shoes")])).toEqual([]);
    expect(missingZones([P("s", "skirt", "lower"), P("b", "boots", "shoes")])).toEqual(["upper"]);
    // jaqueta e casaco vão por cima: por baixo entra a camiseta; o casaco longo não substitui a calça
    expect(missingZones([P("j", "jacket", "outer_layer")])).toEqual(["upper", "lower", "feet"]);
    expect(missingZones([P("k", "coat", "outer_layer"), P("p", "jeans", "lower")])).toEqual(["upper", "feet"]);
    // acessório não é roupa
    expect(missingZones([P("o", "sunglasses", "accessory")])).toEqual(["upper", "lower", "feet"]);
  });

  it("as peças do look vêm primeiro e não são trocadas", () => {
    const look = [P("c", "t_shirt"), P("t", "sneakers", "shoes")];
    const out = withDefaultOutfit(look);
    expect(out.slice(0, 2)).toEqual(look);
    expect(out[2]).toBe(DEFAULT_PIECES.lower);
    const full = [P("c", "t_shirt"), P("p", "jeans", "lower"), P("t", "sneakers", "shoes")];
    expect(withDefaultOutfit(full)).toBe(full);
  });

  it("o provador monta tronco, pernas e pés para qualquer look", () => {
    for (const look of [[], [P("o", "sunglasses", "accessory")], [P("j", "jacket", "outer_layer")], [P("v", "dress", "dress")], [P("s", "shorts", "lower")]]) {
      const kinds = outfitOf(look).map((i) => i.spec.kind);
      expect(kinds.some((k) => ["tee", "tank", "crop", "longsleeve", "shirt", "sweater", "hoodie", "dress", "jumpsuit"].includes(k))).toBe(true);
      expect(kinds.some((k) => ["pants", "shorts", "skirt", "leggings", "dress", "jumpsuit"].includes(k))).toBe(true);
      expect(kinds.some((k) => k === "shoes" || k === "boots")).toBe(true);
    }
  });
});
