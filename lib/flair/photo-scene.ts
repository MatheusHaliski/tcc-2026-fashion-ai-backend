/**
 * Cena fotográfica (components/flair/match): tipos e helpers puros que o palco dos confrontos usa. Vieram do catálogo
 * antigo de capítulos (removido em 15/11/2026, docs/flair/ENDPOINTS_FLAIR.md); só ficou o que a cena desenha: faixas
 * de Hype, tipos de efeito, luz de cada vaga, crédito da foto e o resultado por vaga.
 */
export type HypeBand = "LOW_SIGNAL" | "NICHE" | "RELEVANT" | "HOT" | "TRENDING" | "VIRAL";
export type EffectKind = "COMUM" | "METAMORFOSE" | "IMPERSONATION";

export const HYPE_BANDS: HypeBand[] = ["LOW_SIGNAL", "NICHE", "RELEVANT", "HOT", "TRENDING", "VIRAL"];

/** Crédito da fotografia do cenário (licença livre; public/flair/games/scenes/credits). */
export interface GameSceneCredit { title?: string | null; creator?: string | null; license: string; source?: string | null }
/** Tipo de luz do ambiente em cada vaga (o efeito usa a luz do lugar: holofote, flash, neon, vela, vitrine…). */
export type SceneFx = "spot" | "flash" | "neon" | "candle" | "vitrine" | "mirror" | "rack" | "daylight" | "screen" | "lamp";

/** Erro do jogador numa vaga: tira pontos do placar, que nunca fica negativo. */
export type Flair3dPenaltyCode = "REFUSED" | "MISPLACED" | "NO_SINTONIA" | "OVEREXPOSED";
export interface Flair3dPenalty { code: Flair3dPenaltyCode; points: number }
/** Resultado de uma vaga: faixa de Hype real e de partida, efeito e bônus. */
export interface Flair3dSlot {
  slot: string; cardId: string; hypeBand: HypeBand; hypeBonus: number; effect: { kind: EffectKind; bonus: number; text?: string | null };
  matchBand: HypeBand; matchDelta: number; penalties?: Flair3dPenalty[];
}

export function bandIndex(b: HypeBand | string | null | undefined): number {
  const i = HYPE_BANDS.indexOf(b as HypeBand);
  return i < 0 ? 0 : i;
}
