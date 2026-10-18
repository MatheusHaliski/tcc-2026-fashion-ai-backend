import { afterEach, describe, expect, it } from "vitest";
import { setCurrentLocale } from "./i18n/state";
import { VFX_COLORS } from "./fashion-card";
import { pieceStory, RARITY_INFO, STYLE_AURAS } from "./fashion-style";
import { REWARD_CATEGORIES, SAMPLE_PROJECT } from "./atelier/model";

afterEach(() => setCurrentLocale("pt-BR"));

describe("fashion catalog localization", () => {
  it("updates existing style, reward and rarity objects after a locale change", () => {
    const style = STYLE_AURAS.old_money;
    const reward = REWARD_CATEGORIES[0];
    setCurrentLocale("pt-BR");
    expect(style.mood).toBe("Discreto e atemporal");
    expect(RARITY_INFO.LEGENDARY.label).toBe("Lendária");
    expect(reward.how).toBe("Ativar uma sinergia nova numa partida dos modos FLAIR");
    setCurrentLocale("en");
    expect(style.mood).toBe("Understated and timeless");
    expect(RARITY_INFO.LEGENDARY.label).toBe("Legendary");
    expect(reward.how).toBe("Trigger a new synergy in a FLAIR mode match");
    expect(SAMPLE_PROJECT.name).toBe("FAI Constellation Mirror");
    setCurrentLocale("es");
    expect(RARITY_INFO.LEGENDARY.label).toBe("Legendaria");
    expect(SAMPLE_PROJECT.goals[2].label).toBe("Completa un dueto");
  });

  it("localizes generated narratives without changing the supplied garment name or VFX colors", () => {
    setCurrentLocale("en");
    const story = pieceStory({ name: "Jaqueta Aurora", material: "Nylon Ripstop" });
    expect(story.title).toContain("Jaqueta Aurora");
    expect(story.tagline).toContain("for every trail");
    expect(story.occasion).toBe("Hiking, travel, cold weather");
    const glow = VFX_COLORS.COSMIC_GOLD.glow;
    const englishLabel = VFX_COLORS.COSMIC_GOLD.label;
    setCurrentLocale("es");
    expect(VFX_COLORS.COSMIC_GOLD.label).not.toBe(englishLabel);
    expect(VFX_COLORS.COSMIC_GOLD.glow).toBe(glow);
  });
});
