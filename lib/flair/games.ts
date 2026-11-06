/**
 * FLAIR 3D — os 100 jogos FLAIR (docs/flair/flair-3d-100-jogos) sobre /api/flair/games. Cada jogo é um Desafio
 * de Montagem com série, distrito, raridade, nível de FAI XP e nível do guarda-roupa exigidos, deck, regras de Hype,
 * efeitos por vaga e recompensas extras. O acesso vem SEMPRE do servidor (`access`): o cliente nunca compara o nível
 * local com um valor fixo; sem resposta, o jogo fica bloqueado (fail closed). Aqui ficam o contrato TS, as constantes
 * dos filtros e os helpers puros (filtro local, URL, cadeado, miniatura, cena).
 */
import type { ApiError } from "@/lib/api/client";
import { DIFFICULTIES, type CbcCheck, type CbcDetail, type CbcDifficulty, type CbcSlot, type CbcSubmitResult, type CbcSummary, type Scene } from "@/lib/flair/cbc";

export type GameSeries = "A" | "B" | "C" | "D" | "E";
export type GameDistrict = "SUITE" | "RUNWAY" | "CITY" | "BACKSTAGE" | "COMMUNITY";
export type GameRarity = "COMMON" | "RARE" | "LEGENDARY" | "COLLAB_DROP";
export type GameTier = "ESTREIA" | "STUDIO" | "LOFT";
export type WardrobeLevel = "EM_MONTAGEM" | "ORGANIZADO" | "VERSATIL" | "BEM_CURADO" | "CLOSET_INTELIGENTE" | "CLOSET_ASSINATURA" | "MAISON_CLOSET";
export type HypeBand = "LOW_SIGNAL" | "NICHE" | "RELEVANT" | "HOT" | "TRENDING" | "VIRAL";
export type EffectKind = "COMUM" | "METAMORFOSE" | "IMPERSONATION";
export type RewardType = "ITEM" | "SPECIAL_CARD";

export const SERIES: GameSeries[] = ["A", "B", "C", "D", "E"];
export const DISTRICTS: GameDistrict[] = ["SUITE", "RUNWAY", "CITY", "BACKSTAGE", "COMMUNITY"];
export const RARITIES: GameRarity[] = ["COMMON", "RARE", "LEGENDARY", "COLLAB_DROP"];
export const TIERS: GameTier[] = ["ESTREIA", "STUDIO", "LOFT"];
export const WARDROBE_LEVELS: WardrobeLevel[] = ["EM_MONTAGEM", "ORGANIZADO", "VERSATIL", "BEM_CURADO", "CLOSET_INTELIGENTE", "CLOSET_ASSINATURA", "MAISON_CLOSET"];
export const HYPE_BANDS: HypeBand[] = ["LOW_SIGNAL", "NICHE", "RELEVANT", "HOT", "TRENDING", "VIRAL"];
export const EFFECT_KINDS: EffectKind[] = ["COMUM", "METAMORFOSE", "IMPERSONATION"];
/** Distrito de cada série (README §2). */
export const SERIES_DISTRICT: Record<GameSeries, GameDistrict> = { A: "SUITE", B: "RUNWAY", C: "CITY", D: "BACKSTAGE", E: "COMMUNITY" };

export const FILTERS = { levels: TIERS, wardrobeLevels: WARDROBE_LEVELS, difficulties: DIFFICULTIES, rarities: RARITIES, series: SERIES, districts: DISTRICTS };

// ================================================================== contrato (§1.4 do desenho)
export interface GameAccess {
  allowed: boolean; tierOk: boolean; wardrobeOk: boolean;
  requiredTier: GameTier; currentTier?: GameTier | null; requiredWardrobeLevel: WardrobeLevel; currentWardrobeLevel?: WardrobeLevel | null;
}
export interface GameReward { type: RewardType; code: string; name: string; state?: string | null; condition?: string | null }
export interface GameDeck { minCards: number; maxCards: number; mala?: number | null }
export interface GameHype { deckMin?: HypeBand | null; mandatoryMin?: HypeBand | null; mandatoryMax?: HypeBand | null }

export interface GameSummary extends CbcSummary {
  number: number; series: GameSeries; district: GameDistrict; rarity: GameRarity; requiredTier: GameTier; requiredWardrobeLevel: WardrobeLevel;
  thumbnail?: string | null; deck: GameDeck; hype: GameHype; access: GameAccess; rewards: GameReward[];
}
export interface GameMe { tier: GameTier; wardrobeLevel: WardrobeLevel; wardrobeScore?: number | null }
export interface GameCounts { bySeries: Record<string, number>; byDifficulty: Record<string, number>; byRarity: Record<string, number>; byTier: Record<string, number> }
export interface GameList { games: GameSummary[]; me: GameMe | null; season: string; counts: GameCounts }
export interface GamesSummary { total: number; playable: number; byTier?: Record<string, number> }

export interface GameSlot extends CbcSlot { optional: boolean; effects: Partial<Record<"comum" | "metamorfose" | "impersonation", string | null>>; bonus?: Record<string, number> }
export interface GameFicha { objective?: string | null; scenario?: string | null; mandatory?: string | null; sequence?: string | null; reward?: string | null; hypePlay?: string | null; hypePartial?: string | null }
/** Cena vinda da API: as vagas podem trazer um terceiro elemento, o módulo do quarto (série A). */
/** Crédito da fotografia do cenário (licença livre; public/flair/games/scenes/credits.json). */
export interface GameSceneCredit { title?: string | null; creator?: string | null; license: string; source?: string | null }
/** Tipo de luz do ambiente em cada vaga (o efeito usa a luz do lugar: holofote, flash, neon, vela, vitrine…). */
export type SceneFx = "spot" | "flash" | "neon" | "candle" | "vitrine" | "mirror" | "rack" | "daylight" | "screen" | "lamp";
export const SCENE_FX: SceneFx[] = ["spot", "flash", "neon", "candle", "vitrine", "mirror", "rack", "daylight", "screen", "lamp"];
export interface GameScene extends Omit<Scene, "slots"> { slots: Record<string, [number, number] | [number, number, string]>; venue?: string | null; photo?: string | null; credit?: GameSceneCredit | null;
  /** tipo de luz por vaga, o objeto da foto onde a vaga está e a largura dele (% da foto) */ fx?: Record<string, SceneFx>; anchors?: Record<string, string>; sizes?: Record<string, number> }
export interface GameDetail extends GameSummary, CbcDetail { slots: GameSlot[]; ficha: GameFicha; scene: GameScene; hypeRules: Record<string, unknown> }

/** Erro do jogador numa vaga (Flair3dPenalties no servidor): tira pontos do placar FLAIR 3D, que nunca fica negativo. */
export type Flair3dPenaltyCode = "REFUSED" | "MISPLACED" | "NO_SINTONIA" | "OVEREXPOSED";
export interface Flair3dPenalty { code: Flair3dPenaltyCode; points: number }
export interface Flair3dSlot { slot: string; cardId: string; hypeBand: HypeBand; hypeBonus: number; effect: { kind: EffectKind; bonus: number; text?: string | null }; matchBand: HypeBand; matchDelta: number; penalties?: Flair3dPenalty[] }
export interface Flair3dResult { slots: Flair3dSlot[]; hypeTotal: number; effectTotal: number; penaltyTotal?: number; score: number; scoreMax: number; perfect: boolean }
export interface GameCheck extends CbcCheck { flair3d: Flair3dResult }
export interface GameSubmitResult extends CbcSubmitResult { flair3d: Flair3dResult; rewards: GameReward[] }

// ================================================================== filtros e URL
export interface GameFilters {
  level?: GameTier | null; wardrobe?: WardrobeLevel | null; difficulty?: CbcDifficulty | null; rarity?: GameRarity | null;
  series?: GameSeries | null; district?: GameDistrict | null; playable?: boolean; q?: string | null;
}
const FILTER_KEYS = ["level", "wardrobe", "difficulty", "rarity", "series", "district"] as const;
const VALUES: Record<(typeof FILTER_KEYS)[number], readonly string[]> = { level: TIERS, wardrobe: WARDROBE_LEVELS, difficulty: DIFFICULTIES, rarity: RARITIES, series: SERIES, district: DISTRICTS };

/** Lê `?level=&wardrobe=&difficulty=&rarity=&series=&district=&playable=1&q=`; valor desconhecido é ignorado. */
export function parseFilters(sp: URLSearchParams | string | null | undefined): GameFilters {
  const p = typeof sp === "string" ? new URLSearchParams(sp) : sp ?? new URLSearchParams();
  const f: GameFilters = {};
  for (const k of FILTER_KEYS) {
    const v = (p.get(k) ?? "").toUpperCase();
    if (v && VALUES[k].includes(v)) (f as Record<string, string>)[k] = v;
  }
  if (p.get("playable") === "1") f.playable = true;
  const q = (p.get("q") ?? "").trim();
  if (q) f.q = q;
  return f;
}

/** O contrário de parseFilters, sem "?" (vazio quando não há filtro). */
export function serializeFilters(f: GameFilters): string {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) { const v = f[k]; if (v) p.set(k, v); }
  if (f.playable) p.set("playable", "1");
  if (f.q?.trim()) p.set("q", f.q.trim());
  return p.toString();
}

export function hasFilter(f: GameFilters): boolean {
  return FILTER_KEYS.some((k) => !!f[k]) || !!f.playable || !!f.q?.trim();
}

/** Filtro aplicado sobre a lista inteira que a API devolve (os filtros do servidor são opcionais). */
export function applyFilters(games: GameSummary[], f: GameFilters): GameSummary[] {
  const q = f.q?.trim().toLowerCase();
  return games.filter((g) =>
    (!f.level || g.requiredTier === f.level) && (!f.wardrobe || g.requiredWardrobeLevel === f.wardrobe) && (!f.difficulty || g.difficulty === f.difficulty)
    && (!f.rarity || g.rarity === f.rarity) && (!f.series || g.series === f.series) && (!f.district || g.district === f.district)
    && (!f.playable || g.access.allowed) && (!q || g.name.toLowerCase().includes(q) || (g.description ?? "").toLowerCase().includes(q) || String(g.number) === q));
}

/** Grupos por série (A–E) na ordem das séries, só os que têm jogo. */
export function groupBySeries(games: GameSummary[]): { series: GameSeries; games: GameSummary[] }[] {
  return SERIES.map((series) => ({ series, games: games.filter((g) => g.series === series).sort((a, b) => a.number - b.number) })).filter((g) => g.games.length > 0);
}

// ================================================================== cadeado
export const LOCK_CODES = ["FAI_LEVEL_REQUIRED", "WARDROBE_LEVEL_REQUIRED"] as const;
/** Bloqueado = o servidor não liberou (sem acesso informado também conta como bloqueado). */
export function isLocked(g: Pick<GameSummary, "access"> | null | undefined): boolean {
  return !g?.access?.allowed;
}
/** Motivos do cadeado em chaves i18n: nível de XP e/ou faixa do guarda-roupa. */
export function lockReasonKeys(a: Partial<GameAccess> | null | undefined): ("games.lock.tier" | "games.lock.wardrobe")[] {
  if (!a) return ["games.lock.tier", "games.lock.wardrobe"];
  const out: ("games.lock.tier" | "games.lock.wardrobe")[] = [];
  if (a.tierOk === false) out.push("games.lock.tier");
  if (a.wardrobeOk === false) out.push("games.lock.wardrobe");
  return out;
}
/** 403 do servidor (check/submit) → o mesmo painel de bloqueio, com os detalhes da resposta; outros erros → null. */
export function lockFromError(e: unknown): GameAccess | null {
  const err = e as ApiError | undefined;
  if (!err || err.status !== 403 || !(LOCK_CODES as readonly string[]).includes(err.code)) return null;
  const d = (err.details ?? {}) as Record<string, string | undefined>;
  const tier = err.code === "FAI_LEVEL_REQUIRED";
  return {
    allowed: false, tierOk: !tier, wardrobeOk: tier,
    requiredTier: (d.requiredTier ?? "ESTREIA") as GameTier, currentTier: (d.currentTier ?? null) as GameTier | null,
    requiredWardrobeLevel: (d.requiredWardrobeLevel ?? "EM_MONTAGEM") as WardrobeLevel, currentWardrobeLevel: (d.currentWardrobeLevel ?? null) as WardrobeLevel | null,
  };
}

// ================================================================== miniatura, cena e Hype
export function thumbnailOf(g: Pick<GameSummary, "slug" | "thumbnail">): string {
  return g.thumbnail || `/flair/games/${g.slug}.webp`;
}

/** A cena da API no formato do CbcScene (sem o módulo do quarto nas coordenadas). */
export function toScene(scene: GameScene | null | undefined): Scene | undefined {
  if (!scene) return undefined;
  const slots: Record<string, [number, number]> = {};
  for (const [k, v] of Object.entries(scene.slots ?? {})) slots[k] = [v[0], v[1]];
  return { sky: scene.sky, ground: scene.ground, horizon: scene.horizon, accent: scene.accent, props: scene.props ?? [], slots };
}

/** Módulos do quarto que acendem: as vagas preenchidas cujo terceiro elemento é um módulo (série A). */
export function litModules(scene: GameScene | null | undefined, placed: Record<string, string>): Set<string> {
  const out = new Set<string>();
  for (const key of Object.keys(placed)) { const m = scene?.slots?.[key]?.[2]; if (m) out.add(m); }
  return out;
}

/** Cena noturna quando o céu é escuro (luminância relativa do topo < 0,35): a suíte acende as luzes. */
export function isNightScene(scene: Pick<GameScene, "sky"> | null | undefined): boolean {
  const hex = scene?.sky?.[0] ?? "";
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum < 0.35;
}

export function bandIndex(b: HypeBand | string | null | undefined): number {
  const i = HYPE_BANDS.indexOf(b as HypeBand);
  return i < 0 ? 0 : i;
}
