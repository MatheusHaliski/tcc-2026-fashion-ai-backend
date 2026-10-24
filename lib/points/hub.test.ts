import { describe, expect, it } from "vitest";
import { AuraGatingConfig } from "@/lib/fashion-card/aura-gating";
import { hasReachedLevel, levelNameKey } from "./hub";

describe("FAI XP levels", () => {
  it("requires Loft for Metamorfose while allowing higher levels", () => {
    expect(hasReachedLevel("STUDIO", "LOFT")).toBe(false);
    expect(hasReachedLevel("LOFT", "LOFT")).toBe(true);
    expect(hasReachedLevel("MAISON", "LOFT")).toBe(true);
    expect(hasReachedLevel(undefined, "LOFT")).toBe(false);
  });

  it("maps the persisted entry tier to the user-facing Basic label", () => {
    expect(levelNameKey("ESTREIA")).toBe("levelProgress.name.ESTREIA");
    expect(levelNameKey("STUDIO")).toBe("levelProgress.name.STUDIO");
  });

  it("unlocks Hype at Studio and Metamorphose/Impersonation at Loft", () => {
    expect(AuraGatingConfig.AURA_DYNAMIC.requiredTier).toBe("STUDIO");
    expect(AuraGatingConfig.AURA_METAMORPHOSE.requiredTier).toBe("LOFT");
    expect(AuraGatingConfig.AURA_IMPERSONATION.requiredTier).toBe("LOFT");
  });
});
