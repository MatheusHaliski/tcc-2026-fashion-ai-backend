import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { applyFilters, bandIndex, groupBySeries, hasFilter, isLocked, isNightScene, litModules, lockFromError, lockReasonKeys, parseFilters, serializeFilters, thumbnailOf, toScene, type GameAccess, type GameScene, type GameSummary } from "@/lib/flair/games";

/**
 * Glass Empire — helpers puros: filtros ↔ URL, filtro local sobre a lista inteira, grupos por série, cadeado (sempre a
 * partir do `access` do servidor; 403 vira o mesmo bloqueio), miniatura, cena da API e módulos do quarto que acendem.
 */
const open: GameAccess = { allowed: true, tierOk: true, wardrobeOk: true, requiredTier: "ESTREIA", currentTier: "LOFT", requiredWardrobeLevel: "EM_MONTAGEM", currentWardrobeLevel: "BEM_CURADO" };
const noTier: GameAccess = { ...open, allowed: false, tierOk: false, requiredTier: "LOFT", currentTier: "STUDIO" };
const noWardrobe: GameAccess = { ...open, allowed: false, wardrobeOk: false, requiredWardrobeLevel: "MAISON_CLOSET", currentWardrobeLevel: "BEM_CURADO" };
const time = { status: "OPEN" as const, now: "2026-10-10T12:00:00Z", always: true, startsInSeconds: 0, endsInSeconds: 0, daysLeft: null };
const game = (number: number, over: Partial<GameSummary> = {}): GameSummary => ({
  id: `g${number}`, slug: `a${String(number).padStart(2, "0")}-jogo-${number}`, name: `Jogo ${number}`, description: null, scenario: "livre", difficulty: "EASY", status: "OPEN", time,
  slotsCount: 3, points: 15, multiplier: 1, pointsPreview: 15, requirements: [], levelOpen: true, locksCards: false, repeatLimit: 1, official: true, mine: null,
  number, series: "A", district: "SUITE", rarity: "COMMON", requiredTier: "ESTREIA", requiredWardrobeLevel: "EM_MONTAGEM", thumbnail: null,
  deck: { minCards: 3, maxCards: 3, mala: null }, hype: { deckMin: "LOW_SIGNAL", mandatoryMin: "NICHE", mandatoryMax: "TRENDING" }, access: open, rewards: [], ...over,
});
const LIST = [
  game(1), game(2, { difficulty: "HARD", rarity: "RARE", requiredTier: "STUDIO", access: noTier }),
  game(21, { series: "B", district: "RUNWAY", requiredWardrobeLevel: "MAISON_CLOSET", access: noWardrobe, name: "Passarela de vidro" }),
  game(100, { series: "E", district: "COMMUNITY", rarity: "COLLAB_DROP", difficulty: "LEGENDARY", requiredTier: "LOFT" }),
];

describe("filtros e URL", () => {
  it("lê e escreve os mesmos parâmetros; valores desconhecidos são ignorados; vazio quando não há filtro", () => {
    const f = parseFilters("level=studio&wardrobe=BEM_CURADO&difficulty=hard&rarity=RARE&series=b&district=RUNWAY&playable=1&q=%20vidro%20&foo=bar");
    expect(f).toEqual({ level: "STUDIO", wardrobe: "BEM_CURADO", difficulty: "HARD", rarity: "RARE", series: "B", district: "RUNWAY", playable: true, q: "vidro" });
    expect(serializeFilters(f)).toBe("level=STUDIO&wardrobe=BEM_CURADO&difficulty=HARD&rarity=RARE&series=B&district=RUNWAY&playable=1&q=vidro");
    expect(parseFilters("level=OURO&series=Z&playable=0&q=")).toEqual({});
    expect(parseFilters(null)).toEqual({});
    expect(serializeFilters({})).toBe("");
    expect(serializeFilters({ level: null, q: "  " })).toBe("");
    expect(hasFilter({})).toBe(false); expect(hasFilter({ playable: true })).toBe(true); expect(hasFilter({ q: " " })).toBe(false); expect(hasFilter({ series: "A" })).toBe(true);
  });
  it("aplica cada eixo, o toggle 'só o que posso jogar' e a busca por nome ou número sobre a lista inteira", () => {
    const ids = (f: Parameters<typeof applyFilters>[1]) => applyFilters(LIST, f).map((g) => g.number);
    expect(ids({})).toEqual([1, 2, 21, 100]);
    expect(ids({ level: "STUDIO" })).toEqual([2]);
    expect(ids({ wardrobe: "MAISON_CLOSET" })).toEqual([21]);
    expect(ids({ difficulty: "LEGENDARY" })).toEqual([100]);
    expect(ids({ rarity: "COMMON" })).toEqual([1, 21]);
    expect(ids({ series: "A" })).toEqual([1, 2]);
    expect(ids({ district: "COMMUNITY" })).toEqual([100]);
    expect(ids({ playable: true })).toEqual([1, 100]);
    expect(ids({ series: "A", playable: true })).toEqual([1]);
    expect(ids({ q: "PASSARELA" })).toEqual([21]);
    expect(ids({ q: "100" })).toEqual([100]);
    expect(ids({ q: "nada" })).toEqual([]);
  });
  it("agrupa por série na ordem A–E, só as séries com jogo, ordenadas pelo número", () => {
    const groups = groupBySeries([LIST[3], LIST[1], LIST[0], LIST[2]]);
    expect(groups.map((g) => g.series)).toEqual(["A", "B", "E"]);
    expect(groups[0].games.map((g) => g.number)).toEqual([1, 2]);
    expect(groupBySeries([])).toEqual([]);
  });
});

describe("cadeado", () => {
  it("bloqueado é sempre o que o servidor não liberou; sem acesso informado também é bloqueado", () => {
    expect(isLocked(LIST[0])).toBe(false);
    expect(isLocked(LIST[1])).toBe(true);
    expect(isLocked(null)).toBe(true);
    expect(isLocked({ access: undefined as unknown as GameAccess })).toBe(true);
  });
  it("motivos: nível de XP e/ou guarda-roupa; sem acesso, os dois", () => {
    expect(lockReasonKeys(noTier)).toEqual(["games.lock.tier"]);
    expect(lockReasonKeys(noWardrobe)).toEqual(["games.lock.wardrobe"]);
    expect(lockReasonKeys({ ...noTier, wardrobeOk: false })).toEqual(["games.lock.tier", "games.lock.wardrobe"]);
    expect(lockReasonKeys(open)).toEqual([]);
    expect(lockReasonKeys(null)).toEqual(["games.lock.tier", "games.lock.wardrobe"]);
  });
  it("403 FAI_LEVEL_REQUIRED / WARDROBE_LEVEL_REQUIRED viram bloqueio com os detalhes; outros erros não", () => {
    expect(lockFromError(new ApiError(403, "FAI_LEVEL_REQUIRED", "nível", { requiredTier: "LOFT", currentTier: "STUDIO" })))
      .toEqual({ allowed: false, tierOk: false, wardrobeOk: true, requiredTier: "LOFT", currentTier: "STUDIO", requiredWardrobeLevel: "EM_MONTAGEM", currentWardrobeLevel: null });
    expect(lockFromError(new ApiError(403, "WARDROBE_LEVEL_REQUIRED", "guarda-roupa", { requiredWardrobeLevel: "BEM_CURADO", currentWardrobeLevel: "ORGANIZADO" })))
      .toMatchObject({ allowed: false, tierOk: true, wardrobeOk: false, requiredWardrobeLevel: "BEM_CURADO", currentWardrobeLevel: "ORGANIZADO", currentTier: null });
    expect(lockFromError(new ApiError(403, "ACESSO_NEGADO", "não"))).toBeNull();
    expect(lockFromError(new ApiError(500, "FAI_LEVEL_REQUIRED", "x"))).toBeNull();
    expect(lockFromError(new Error("rede"))).toBeNull();
    expect(lockFromError(undefined)).toBeNull();
  });
});

describe("miniatura, cena e Hype", () => {
  it("miniatura: a do servidor ou /flair/games/<slug>.webp", () => {
    expect(thumbnailOf({ slug: "a01-espelho-partido", thumbnail: null })).toBe("/flair/games/a01-espelho-partido.webp");
    expect(thumbnailOf({ slug: "a01-espelho-partido", thumbnail: "/flair/games/outra.webp" })).toBe("/flair/games/outra.webp");
  });
  it("a cena da API vira a cena do CbcScene sem o módulo do quarto; os módulos acendem pelas vagas preenchidas", () => {
    const scene: GameScene = { sky: ["#1B2440", "#3A3F6B"], ground: "#2C2F45", horizon: 62, accent: "#8FD3F4", props: [{ k: "mirror", x: 80, y: 50 }], slots: { caco: [50, 55, "mirror"], porta: [20, 70, "door:1"], livre: [80, 80] } };
    expect(toScene(scene)).toEqual({ sky: ["#1B2440", "#3A3F6B"], ground: "#2C2F45", horizon: 62, accent: "#8FD3F4", props: [{ k: "mirror", x: 80, y: 50 }], slots: { caco: [50, 55], porta: [20, 70], livre: [80, 80] } });
    expect(toScene(null)).toBeUndefined();
    expect([...litModules(scene, { caco: "c1", livre: "c2" })]).toEqual(["mirror"]);
    expect([...litModules(scene, { caco: "c1", porta: "c3" })].sort()).toEqual(["door:1", "mirror"]);
    expect(litModules(undefined, { caco: "c1" }).size).toBe(0);
    expect(isNightScene(scene)).toBe(true);
    expect(isNightScene({ sky: ["#9FD3F5", "#FDF2DC"] })).toBe(false);
    expect(isNightScene({ sky: ["azul", "x"] })).toBe(false);
  });
  it("índice das faixas de Hype: Sinal baixo é 0, Viral é 5, desconhecido cai em 0", () => {
    expect(bandIndex("LOW_SIGNAL")).toBe(0); expect(bandIndex("RELEVANT")).toBe(2); expect(bandIndex("VIRAL")).toBe(5); expect(bandIndex(null)).toBe(0); expect(bandIndex("X")).toBe(0);
  });
});
