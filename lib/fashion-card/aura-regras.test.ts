import { describe, expect, it, vi } from "vitest";
import { AuraContextEngineService, AuraPresetResolver, InMemoryAuraPresetRepository, canonicalAuraContext } from "./aura-context-engine";
import { AuraLockedError, AuraPermissionsService, cardLevelUnlocked, getLockedAuraMessage } from "./aura-gating";
import { AuraImpersonationService, FashionCardPipelineService, InMemoryOwnedFashionCardRepository, MOTION_TEMPLATES, MockFashionMotionWorker } from "./aura-impersonation-service";
import { safeMediaUrl, validStat, type AuraAnimationPreset, type OwnedFashionCard } from "./types";

const engine = new AuraContextEngineService();

describe("motor de contexto da Aura", () => {
  it("normaliza acentos, espaços e caixa; campos ausentes ficam vazios", () => {
    expect(canonicalAuraContext({ brand: "  café  bar " })).toMatchObject({ brand: "CAFE BAR", sku: "", ruleVersion: 2 });
  });

  it("escolhe partícula, shader, cenário e poder por ocasião e estilo", () => {
    expect(engine.resolve({ brand: "x", occasion: "Gala" })).toEqual({ ruleVersion: 2, palette: ["#D6B367", "#FFF1BD"], particleType: "GOLD_DUST", shaderOverlay: "CINEMATIC_LIGHTS", backgroundEnvironment: "GALA_STAGE", powerVfx: "COSMIC_GOLD" });
    expect(engine.resolve({ brand: "x", styleCategory: "gorpcore" })).toEqual({ ruleVersion: 2, palette: ["#77D9ED", "#86DEBB"], particleType: "WEATHER_MIST", shaderOverlay: "INFRARED_SCAN", backgroundEnvironment: "ALPINE_WEATHER", powerVfx: "ELEMENTAL_WIND" });
    expect(engine.resolve({ brand: "x", styleCategory: "techwear", originCountry: "jp" }).backgroundEnvironment).toBe("TOKYO_CYBERPUNK");
    expect(engine.resolve({ brand: "x", styleCategory: "Y2K" })).toEqual({ ruleVersion: 2, palette: ["#DE77E8", "#A391F0"], particleType: "NEON_GLITCH", shaderOverlay: "VHS_Y2K", backgroundEnvironment: "RETRO_STREET", powerVfx: "Y2K_HOLOGRAM" });
    expect(engine.resolve({ brand: "x" })).toEqual({ ruleVersion: 2, palette: ["#77D9ED", "#A391F0"], particleType: "SOFT_SPARKS", shaderOverlay: "SATIN_LIGHT", backgroundEnvironment: "FASHION_STUDIO", powerVfx: "COSMIC_GOLD" });
    expect(engine.resolve({ brand: "x", colorHex: "#abcdef" }).palette?.[0]).toBe("#ABCDEF");
    expect(engine.resolve({ brand: "x", collaboration: "Anime", originCountry: "BR" }).particleType).toBe("SOFT_SPARKS");
  });

  it("selos mostram marca × colab, país, estilo e ocasião, até quatro", () => {
    expect(engine.badges({ brand: "Nike", collaboration: "Sacai", originCountry: "jp", styleCategory: "Street", occasion: "Show" })).toEqual(["Nike × Sacai", "JP", "Street", "Show"]);
    expect(engine.badges({ brand: "" })).toEqual([]);
  });
});

describe("cache de presets", () => {
  const preset = (id: string): AuraAnimationPreset => ({ id, fingerprint: id, config: engine.resolve({ brand: id }) });

  it("recusa tamanho inválido e descarta o menos usado ao lotar", async () => {
    expect(() => new InMemoryAuraPresetRepository(0)).toThrow("INVALID_CACHE_SIZE");
    expect(() => new InMemoryAuraPresetRepository(1.5)).toThrow("INVALID_CACHE_SIZE");
    const repo = new InMemoryAuraPresetRepository(2);
    await repo.save(preset("a")); await repo.save(preset("b"));
    expect(await repo.get("a")).not.toBeNull();
    await repo.save(preset("c"));
    expect(await repo.get("b")).toBeNull();
    expect(await repo.get("a")).not.toBeNull();
    expect(await repo.get("nada")).toBeNull();
  });

  it("resoluções simultâneas compartilham a mesma promessa e só salvam uma vez", async () => {
    const repo = new InMemoryAuraPresetRepository();
    const save = vi.spyOn(repo, "save");
    const resolver = new AuraPresetResolver(engine, repo);
    const [a, b] = await Promise.all([resolver.resolve({ brand: "Z" }), resolver.resolve({ brand: "z" })]);
    expect(a.id).toBe(b.id);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("id existente com impressão divergente refaz o preset", async () => {
    const fp = await engine.fingerprint({ brand: "Q" });
    const id = `aura-v2-${fp}`;
    const repo = { get: vi.fn().mockResolvedValue({ id, fingerprint: "outra", config: {} }), save: vi.fn().mockResolvedValue(undefined) };
    const out = await new AuraPresetResolver(engine, repo).resolve({ brand: "Q" }, id);
    expect(out.fingerprint).toBe(fp);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});

describe("permissões por nível", () => {
  it("sem usuário ou tipo desconhecido nega; sem nível nega; compara a ordem dos níveis", async () => {
    const svc = new AuraPermissionsService(async (u) => (u === "loft" ? "LOFT" : u === "studio" ? "STUDIO" : null));
    expect(await svc.canUserEquipAura("", "AURA_BASIC")).toBe(false);
    expect(await svc.canUserEquipAura("loft", "NADA" as never)).toBe(false);
    expect(await svc.canUserEquipAura("anon", "AURA_BASIC")).toBe(false);
    expect(await svc.canUserEquipAura("studio", "AURA_DYNAMIC")).toBe(true);
    expect(await svc.canUserEquipAura("studio", "AURA_METAMORPHOSE")).toBe(false);
    expect(svc.getLockedAuraMessage("AURA_DYNAMIC")).toBe(getLockedAuraMessage("AURA_DYNAMIC"));
    expect(getLockedAuraMessage("AURA_DYNAMIC")).not.toContain("auraGate.");
    const err = new AuraLockedError("AURA_DYNAMIC");
    expect(err.requiredTier).toBe("STUDIO");
    expect(err.code).toBe("AURA_LEVEL_REQUIRED");
  });

  it("nível da carta: comum sempre livre; demais pelo nível de FAI XP", () => {
    expect(cardLevelUnlocked("COMMON", null)).toBe(true);
    expect(cardLevelUnlocked("RARE", "STUDIO")).toBe(true);
    expect(cardLevelUnlocked("LEGENDARY", "STUDIO")).toBe(false);
    expect(cardLevelUnlocked("COLLAB_DROP", "LOFT")).toBe(true);
  });
});

describe("validações de mídia e atributos", () => {
  it("só aceita caminhos locais sem .. ou https sem credenciais", () => {
    expect(safeMediaUrl("")).toBe(false);
    expect(safeMediaUrl("/a b.png")).toBe(false);
    expect(safeMediaUrl("/media/../x")).toBe(false);
    expect(safeMediaUrl("//evil.com/x")).toBe(false);
    expect(safeMediaUrl("/media/x.mp4")).toBe(true);
    expect(safeMediaUrl("https://cdn.x/a.mp4")).toBe(true);
    expect(safeMediaUrl("https://u:p@cdn.x/a.mp4")).toBe(false);
    expect(safeMediaUrl("http://cdn.x/a.mp4")).toBe(false);
    expect(safeMediaUrl("não-url")).toBe(false);
  });
  it("atributo vale nulo ou número finito de 0 a 100", () => {
    expect(validStat(null)).toBe(true);
    expect(validStat(100)).toBe(true);
    expect(validStat(101)).toBe(false);
    expect(validStat(-1)).toBe(false);
    expect(validStat("5")).toBe(false);
    expect(validStat(Number.NaN)).toBe(false);
  });
});

describe("pipeline e serviço de Impersonation", () => {
  const metadata = { brand: "Marca", occasion: "gala" };
  const card: OwnedFashionCard = { ownerId: "u1", entityType: "LOOK", entityId: "l1", revision: 3, metadata, fashionCard: { rarity: "RARE", auraType: "COMMON", stats: { versatility: 10, hypeIndex: 20, legacyScore: 30 } } };
  const allow = new AuraPermissionsService(async () => "LOFT");
  const resolver = () => new AuraPresetResolver(engine, new InMemoryAuraPresetRepository());

  it("pipeline recusa mídia insegura, template desconhecido e respeita cancelamento", async () => {
    const pipe = new FashionCardPipelineService(new MockFashionMotionWorker());
    const preset = await resolver().resolve(metadata);
    const base = { ownerId: "u1", entityId: "l1", entityType: "LOOK" as const, userMediaUrl: "/eu.jpg", motionTemplateId: "WIND_POSE", preset };
    await expect(pipe.processFashionCardMotion({ ...base, userMediaUrl: "http://x" })).rejects.toThrow("INVALID_USER_MEDIA");
    await expect(pipe.processFashionCardMotion({ ...base, motionTemplateId: "NADA" })).rejects.toThrow("UNKNOWN_MOTION_TEMPLATE");
    const ctrl = new AbortController(); ctrl.abort();
    await expect(pipe.processFashionCardMotion(base, ctrl.signal)).rejects.toBeTruthy();
    const ok = await pipe.processFashionCardMotion(base);
    expect(ok).toMatchObject({ mediaUrl: MOTION_TEMPLATES[0].demo, mimeType: "video/mp4", status: "MOCK_PREVIEW" });
    expect(ok.jobId.startsWith("mock-")).toBe(true);
    await expect(new MockFashionMotionWorker().process({ ...base, motionTemplateId: "X" })).rejects.toThrow("UNKNOWN_MOTION_TEMPLATE");
    const bad = new FashionCardPipelineService({ process: async () => null as never });
    await expect(bad.processFashionCardMotion(base)).rejects.toThrow("INVALID_WORKER_MEDIA");
    const longId = new FashionCardPipelineService({ process: async () => ({ jobId: "x".repeat(201), mediaUrl: "/v.mp4", mimeType: "video/mp4", status: "READY" }) });
    await expect(longId.processFashionCardMotion(base)).rejects.toThrow("INVALID_WORKER_MEDIA");
    const gif = new FashionCardPipelineService({ process: async () => ({ jobId: "j", mediaUrl: "/v.gif", mimeType: "image/gif", status: "READY" }) });
    expect((await gif.processFashionCardMotion(base)).mimeType).toBe("image/gif");
  });

  it("escolhe o template pelo poder do preset e grava a nova revisão", async () => {
    const repo = new InMemoryOwnedFashionCardRepository([card]);
    const svc = new AuraImpersonationService(resolver(), new FashionCardPipelineService(new MockFashionMotionWorker()), repo, allow);
    const out = await svc.generateImpersonationAura({ ownerId: "u1", entityType: "LOOK", entityId: "l1", userMediaUrl: "/eu.jpg" });
    expect(out.revision).toBe(4);
    expect(out.fashionCard.motionTemplateId).toBe("COSMIC_FLOAT");
    expect(out.fashionCard.contextBadges).toEqual(["Marca", "gala"]);
    expect(out.fashionCard.impersonationData).toMatchObject({ posterUrl: "/eu.jpg", powerVfx: "COSMIC_GOLD", status: "MOCK_PREVIEW" });
    const chosen = await svc.generateImpersonationAura({ ownerId: "u1", entityType: "LOOK", entityId: "l1", userMediaUrl: "/eu.jpg", motionTemplateId: "Y2K_ECHO" });
    expect(chosen.fashionCard.motionTemplateId).toBe("Y2K_ECHO");
  });

  it("poder sem template correspondente cai em COSMIC_FLOAT", async () => {
    const repo = new InMemoryOwnedFashionCardRepository([card]);
    const presets = { resolve: async () => ({ id: "p", fingerprint: "p", config: { ...engine.resolve(metadata), powerVfx: "OUTRO" } }) } as unknown as AuraPresetResolver;
    const svc = new AuraImpersonationService(presets, new FashionCardPipelineService(new MockFashionMotionWorker()), repo, allow);
    expect((await svc.generateImpersonationAura({ ownerId: "u1", entityType: "LOOK", entityId: "l1", userMediaUrl: "/eu.jpg" })).fashionCard.motionTemplateId).toBe("COSMIC_FLOAT");
  });

  it("recusa card de outro dono, atributos inválidos, conflito de revisão e cancelamento", async () => {
    const pipe = new FashionCardPipelineService(new MockFashionMotionWorker());
    const svc = (cards: OwnedFashionCard[]) => new AuraImpersonationService(resolver(), pipe, new InMemoryOwnedFashionCardRepository(cards), allow);
    await expect(svc([]).generateImpersonationAura({ ownerId: "u1", entityType: "LOOK", entityId: "l1", userMediaUrl: "/eu.jpg" })).rejects.toThrow("OWNED_CARD_NOT_FOUND");
    const badStats = { ...card, fashionCard: { ...card.fashionCard, stats: { versatility: 500, hypeIndex: 1, legacyScore: 1 } } };
    await expect(svc([badStats]).generateImpersonationAura({ ownerId: "u1", entityType: "LOOK", entityId: "l1", userMediaUrl: "/eu.jpg" })).rejects.toThrow("INVALID_CARD_STATS");
    const ctrl = new AbortController(); ctrl.abort();
    await expect(svc([card]).generateImpersonationAura({ ownerId: "u1", entityType: "LOOK", entityId: "l1", userMediaUrl: "/eu.jpg" }, ctrl.signal)).rejects.toBeTruthy();
    const repo = new InMemoryOwnedFashionCardRepository([card]);
    await expect(repo.saveOwned(card, 99)).rejects.toThrow("FASHION_CARD_REVISION_CONFLICT");
    await expect(repo.saveOwned({ ...card, entityId: "outro" }, 3)).rejects.toThrow("FASHION_CARD_REVISION_CONFLICT");
    const foreign = { getOwned: async () => ({ ...card, ownerId: "u2" }), saveOwned: vi.fn() };
    await expect(new AuraImpersonationService(resolver(), pipe, foreign, allow).generateImpersonationAura({ ownerId: "u1", entityType: "LOOK", entityId: "l1", userMediaUrl: "/eu.jpg" })).rejects.toThrow("OWNED_CARD_NOT_FOUND");
  });
});
