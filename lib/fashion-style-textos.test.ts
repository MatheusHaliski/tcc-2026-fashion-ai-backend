import { describe, expect, it } from "vitest";
import { RARITIES, RARITY_INFO, STYLE_AURAS, STYLE_IDS, pieceStory } from "./fashion-style";

describe("textos traduzidos das estéticas", () => {
  it("cada estética tem nome, clima e ocasião vindos do catálogo (nunca a chave crua)", () => {
    for (const id of STYLE_IDS) {
      const s = STYLE_AURAS[id];
      for (const text of [s.name, s.mood, s.occasion]) {
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toContain("fashion.style.");
      }
    }
  });

  it("cada raridade tem rótulo traduzido e estrelas crescentes", () => {
    const labels = RARITIES.map((r) => RARITY_INFO[r].label);
    for (const l of labels) expect(l).not.toContain("fashion.rarity.");
    expect(new Set(labels).size).toBe(3);
    expect(RARITIES.map((r) => RARITY_INFO[r].stars)).toEqual([1, 2, 3]);
  });

  it("história usa o nome quando a categoria está em branco e cai no rótulo genérico sem nenhum dos dois", () => {
    const named = pieceStory({ category: "  ", name: " Jaqueta ", material: "Couro Cognac" });
    expect(named.title.startsWith("Jaqueta ")).toBe(true);
    expect(named.vibeTags).toEqual(["#dark_academia", "#courocognac"]);
    const anon = pieceStory({});
    expect(anon.title).not.toContain("fashion.piece");
    expect(anon.vibeTags).toEqual(["#streetwear"]);
    expect(anon.tagline).toContain(" – ");
    expect(anon.tagline).not.toContain("fashion.style.");
  });
});
