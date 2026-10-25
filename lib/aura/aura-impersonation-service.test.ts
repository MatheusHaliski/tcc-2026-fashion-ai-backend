import { describe, expect, it, vi } from "vitest";
import { AuraImpersonationService, mockRenderer } from "./aura-impersonation-service";
import { VFX_COLORS, POWER_VFX, clampStat, clampStats } from "@/lib/fashion-card";
import type { CatalogProduct } from "@/lib/api/catalog";

const product = (over: Partial<CatalogProduct> = {}) => ({ id: "p 1", productName: "Tênis", ...over }) as CatalogProduct;

describe("Aura Impersonation do produto", () => {
  it("renderizador simulado codifica o id e o template na URL", async () => {
    expect(await mockRenderer.render({ productId: "p/1", motionTemplateId: "a b", powerVfx: "Y2K_HOLOGRAM", userImage: "x" }))
      .toEqual({ mediaUrl: "/mock/impersonation/p%2F1-a%20b-y2k_hologram.mp4" });
  });

  it("sem card anterior usa raridade comum e atributos 50", async () => {
    const out = await new AuraImpersonationService().generateImpersonationAura({ product: product(), userImage: "x", userMediaUrl: "/eu.png", motionTemplateId: "WIND" });
    expect(out.fashionCard).toEqual({ rarity: "COMMON", stats: { versatility: 50, hypeIndex: 50, legacyScore: 50 }, auraType: "IMPERSONATION",
      impersonationData: { userMediaUrl: "/eu.png", motionTemplateId: "WIND", powerVfx: "CYBERPUNK_ELECTRIC", renderedCardMediaUrl: "/mock/impersonation/p%201-WIND-cyberpunk_electric.mp4" } });
  });

  it("preserva raridade e limita atributos do card anterior; repassa o VFX escolhido", async () => {
    const render = vi.fn().mockResolvedValue({ mediaUrl: "/r.mp4" });
    const prev = product({ fashionCard: { rarity: "LEGENDARY", auraType: "STATIC", stats: { versatility: 120, hypeIndex: -3, legacyScore: 70.4 } } });
    const out = await new AuraImpersonationService({ render }).generateImpersonationAura({ product: prev, userImage: "x", userMediaUrl: "/eu.png", motionTemplateId: "T", powerVfx: "COSMIC_GOLD" });
    expect(render).toHaveBeenCalledWith({ userImage: "x", motionTemplateId: "T", powerVfx: "COSMIC_GOLD", productId: "p 1" });
    expect(out.fashionCard).toMatchObject({ rarity: "LEGENDARY", stats: { versatility: 100, hypeIndex: 0, legacyScore: 70 } });
    expect((prev.fashionCard as { auraType: string }).auraType).toBe("STATIC");
  });

  it("recusa foto ausente, template vazio e VFX desconhecido", async () => {
    const svc = new AuraImpersonationService();
    await expect(svc.generateImpersonationAura({ product: product(), userImage: "", userMediaUrl: "/a", motionTemplateId: "T" })).rejects.toThrow("obrigatórios");
    await expect(svc.generateImpersonationAura({ product: product(), userImage: "x", userMediaUrl: "", motionTemplateId: "T" })).rejects.toThrow("obrigatórios");
    await expect(svc.generateImpersonationAura({ product: product(), userImage: "x", userMediaUrl: "/a", motionTemplateId: "  " })).rejects.toThrow("motionTemplateId é obrigatório");
    await expect(svc.generateImpersonationAura({ product: product(), userImage: "x", userMediaUrl: "/a", motionTemplateId: "T", powerVfx: "LASER" as never })).rejects.toThrow("powerVfx inválido: LASER");
  });

  it("cada VFX tem rótulo traduzido; clamp trata nulo e não finito", () => {
    for (const v of POWER_VFX) expect(VFX_COLORS[v].label).not.toContain("impersonation.power");
    expect(clampStat(null)).toBe(0);
    expect(clampStat(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampStats({ versatility: 10.5, hypeIndex: null, legacyScore: 101 })).toEqual({ versatility: 11, hypeIndex: 0, legacyScore: 100 });
  });
});
