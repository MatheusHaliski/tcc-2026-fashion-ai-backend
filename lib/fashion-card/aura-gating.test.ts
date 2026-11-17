import { describe, expect, it, vi } from "vitest";
import {
  AuraGatingConfig, AuraLockedError, AuraPermissionsService, cardLevelUnlocked, getLockedAuraMessage, type RoomTier,
} from "./aura-gating";

const servico = (tier: RoomTier | null) => new AuraPermissionsService(vi.fn(async () => tier));

describe("liberação das Auras pelo nível de FAI XP", () => {
  it("Aura básica abre já no nível Básico", async () => {
    expect(await servico("ESTREIA").canUserEquipAura("u1", "AURA_BASIC")).toBe(true);
  });

  it("Aura dinâmica pede Studio e Metamorfose pede Loft", async () => {
    expect(await servico("ESTREIA").canUserEquipAura("u1", "AURA_DYNAMIC")).toBe(false);
    expect(await servico("STUDIO").canUserEquipAura("u1", "AURA_DYNAMIC")).toBe(true);
    expect(await servico("STUDIO").canUserEquipAura("u1", "AURA_METAMORPHOSE")).toBe(false);
    expect(await servico("LOFT").canUserEquipAura("u1", "AURA_METAMORPHOSE")).toBe(true);
    expect(await servico("LOFT").canUserEquipAura("u1", "AURA_IMPERSONATION")).toBe(true);
  });

  it("sem usuário ou sem nível conhecido, nada é liberado", async () => {
    const lookup = vi.fn(async () => "LOFT" as RoomTier);
    expect(await new AuraPermissionsService(lookup).canUserEquipAura("", "AURA_BASIC")).toBe(false);
    expect(lookup).not.toHaveBeenCalled();
    expect(await servico(null).canUserEquipAura("u1", "AURA_BASIC")).toBe(false);
  });

  it("o erro de Aura bloqueada traz o código e o nível exigido", () => {
    const erro = new AuraLockedError("AURA_DYNAMIC");
    expect(erro.code).toBe("AURA_LEVEL_REQUIRED");
    expect(erro.requiredTier).toBe(AuraGatingConfig.AURA_DYNAMIC.requiredTier);
    expect(erro.message).toBe(getLockedAuraMessage("AURA_DYNAMIC"));
  });

  it("nível da carta AURA Hype: Comum livre, Rara no Studio, Lendária no Loft", () => {
    expect(cardLevelUnlocked("COMMON", null)).toBe(true);
    expect(cardLevelUnlocked("RARE", "ESTREIA")).toBe(false);
    expect(cardLevelUnlocked("RARE", "STUDIO")).toBe(true);
    expect(cardLevelUnlocked("LEGENDARY", "STUDIO")).toBe(false);
    expect(cardLevelUnlocked("COLLAB_DROP", "LOFT")).toBe(true);
  });

  it("nomes antigos acima do Loft contam como Loft", () => {
    expect(cardLevelUnlocked("LEGENDARY", "PENTHOUSE")).toBe(true);
    expect(cardLevelUnlocked("RARE", "desconhecido")).toBe(false);
  });
});
