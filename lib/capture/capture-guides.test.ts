import { describe, expect, it } from "vitest";
import normalization from "@/fai-application/src/main/resources/catalog/normalization.json";
import { ACCESSORY_TYPES, CAPTURE_GUIDES, CATEGORY_CARDS, guideFor } from "@/lib/capture/capture-guides";
import { GLYPH_REGIONS } from "@/components/capture/garment-glyphs";

const TAXONOMY = normalization.taxonomy.subcategories as Record<string, string[]>;

describe("guias de fotografia (RF47)", () => {
  it("toda subcategoria da taxonomia tem um guia", () => {
    for (const [category, subs] of Object.entries(TAXONOMY)) {
      for (const sub of subs) expect(guideFor(category, sub), `${category}/${sub}`).not.toBeNull();
    }
  });

  it("acessório sem subtipo não tem guia (precisa da segunda segmentação) e os subtipos dos cards existem", () => {
    expect(guideFor("accessory_piece")).toBeNull();
    for (const a of ACCESSORY_TYPES) if (a.subcategory) expect(TAXONOMY.accessory_piece).toContain(a.subcategory);
    expect(CATEGORY_CARDS.map((c) => c.id).sort()).toEqual(Object.keys(TAXONOMY).sort());
  });

  it("cada região destacada existe na ilustração do guia", () => {
    for (const g of Object.values(CAPTURE_GUIDES)) {
      for (const r of g.highlightedRegions) expect(GLYPH_REGIONS[g.illustration], `${g.id}:${r}`).toContain(r);
    }
  });

  it("a primeira foto segue a estratégia por categoria", () => {
    expect(guideFor("lower_piece", "jeans")!.primaryView).toBe("BACK_VIEW");
    expect(guideFor("shoes_piece", "casual_sneakers")!.primaryView).toBe("LEFT_SIDE");
    expect(guideFor("accessory_piece", "sunglasses")!.primaryView).toBe("TEMPLE_DETAIL");
    expect(guideFor("accessory_piece", "watch")!.primaryView).toBe("WATCH_FACE");
    expect(guideFor("accessory_piece", "belt")!.primaryView).toBe("BUCKLE_DETAIL");
    expect(guideFor("upper_piece", "polo_shirt")!.highlightedRegions).toEqual(["chest_left", "chest_right", "chest_center", "collar"]);
  });
});
