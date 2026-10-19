import { describe, it, expect } from "vitest";
import { suggestStyle, rarityOf, pieceStory, STYLE_IDS, STYLE_AURAS } from "./fashion-style";

describe("fashion style", () => {
  it("suggests aesthetic from material/color/category", () => {
    expect(suggestStyle({ material: "Veludo Esmeralda", color: "vinho" }).id).toBe("dark_academia");
    expect(suggestStyle({ material: "Nylon Ripstop", category: "Corta-vento" }).id).toBe("gorpcore");
    expect(suggestStyle({ material: "Linho", category: "Blazer" }).id).toBe("old_money");
    expect(suggestStyle({}).id).toBe("streetwear");
  });
  it("defines every style with valid palette", () => {
    for (const id of STYLE_IDS) expect(STYLE_AURAS[id].palette.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
  });
  it("derives rarity", () => {
    expect(rarityOf({}).id).toBe("COMMON");
    expect(rarityOf({ trending: true }).id).toBe("RARE");
    expect(rarityOf({ trending: true, timeless: true }).id).toBe("LEGENDARY");
    expect(rarityOf({ limitedEdition: true }).id).toBe("LEGENDARY");
  });
  it("builds a story", () => {
    const s = pieceStory({ category: "Jaqueta", material: "Nylon", color: "neon" });
    expect(s.tagline).toContain("Jaqueta");
    expect(s.palette).toHaveLength(3);
  });
});
