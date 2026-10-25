import { describe, expect, it, vi } from "vitest";
import { AuraImpersonationService, mockImpersonationRenderer } from "./aura-impersonation-service";
import { clampStat, type FashionCardData } from "./fashion-card";

const CARD: FashionCardData = { id: "c1", name: "Jaqueta", imageUrl: "/c1.png", rarity: "RARE", auraType: "STATIC", stats: { versatility: 1, hypeIndex: 2, legacyScore: 3 } };

describe("catálogo · Aura Impersonation", () => {
  it("renderizador simulado usa a URL enviada ou um blob fixo", async () => {
    expect(await mockImpersonationRenderer.render({ userImage: "/foto.png", motionTemplateId: "WIND", powerVfx: "COSMIC_GOLD" }))
      .toEqual({ userMediaUrl: "/foto.png", renderedCardMediaUrl: "/mock/impersonation/WIND-cosmic_gold.mp4" });
    const blob = await mockImpersonationRenderer.render({ userImage: new Blob(["x"]), motionTemplateId: "W", powerVfx: "ELEMENTAL_FIRE" });
    expect(blob.userMediaUrl).toBe("blob:mock-user-media");
  });

  it("gera o card IMPERSONATION com o VFX padrão sem mudar o original", async () => {
    const out = await new AuraImpersonationService().generateImpersonationAura(CARD, "/eu.png", "STREET");
    expect(out.auraType).toBe("IMPERSONATION");
    expect(out.impersonationData).toEqual({ userMediaUrl: "/eu.png", renderedCardMediaUrl: "/mock/impersonation/STREET-cyberpunk_electric.mp4", motionTemplateId: "STREET", powerVfx: "CYBERPUNK_ELECTRIC" });
    expect(CARD.auraType).toBe("STATIC");
  });

  it("valida entradas e a resposta do pipeline", async () => {
    const svc = new AuraImpersonationService();
    await expect(svc.generateImpersonationAura(CARD, "", "X")).rejects.toThrow("userImage é obrigatória");
    await expect(svc.generateImpersonationAura(CARD, "/a.png", "")).rejects.toThrow("motionTemplateId é obrigatório");
    const empty = new AuraImpersonationService({ render: vi.fn().mockResolvedValue({ userMediaUrl: "/a.png", renderedCardMediaUrl: "" }) });
    await expect(empty.generateImpersonationAura(CARD, "/a.png", "X", "COSMIC_GOLD")).rejects.toThrow("O pipeline não devolveu a mídia renderizada");
  });

  it("clampStat arredonda, limita a 0–100 e zera não finitos", () => {
    expect(clampStat(42.6)).toBe(43);
    expect(clampStat(-5)).toBe(0);
    expect(clampStat(500)).toBe(100);
    expect(clampStat(Number.NaN)).toBe(0);
  });
});
