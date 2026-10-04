/**
 * HypeScore v2 — regras de apresentação puras (sem React). A fórmula NÃO mora aqui: o score, as dimensões, a faixa e o
 * delta chegam prontos do backend (HypeScoreConfig/HypeCalculator). Aqui só se decide COMO mostrar cada estado.
 */
import type { HypeDimension, HypeDirection, HypeEntity, HypeLevel, HypeSummary } from "./types";

/** Ordem de leitura das dimensões no verso do card e na análise completa. */
export const DIMENSION_ORDER: HypeDimension[] = ["POPULARITY", "ENGAGEMENT", "TREND", "TREND_VELOCITY", "ORIGINALITY", "RARITY", "LONGEVITY", "NOVELTY", "INFLUENCE"];
/** Verso do card: as 7 dimensões de leitura rápida (velocidade e influência ficam na análise completa). */
export const BACK_DIMENSIONS: HypeDimension[] = ["POPULARITY", "ENGAGEMENT", "TREND", "ORIGINALITY", "RARITY", "LONGEVITY", "NOVELTY"];
export const LEVELS: HypeLevel[] = ["LOW_SIGNAL", "NICHE", "RELEVANT", "HOT", "TRENDING", "VIRAL"];

/**
 * Estado visual do Hype de uma entidade. "Sem dados" nunca vira 0: INSUFFICIENT_DATA mostra "Dados insuficientes",
 * NOT_CALCULATED mostra "Hype ainda não calculado"; um score antigo continua visível, marcado como desatualizado.
 */
export type HypeViewState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "not_calculated" }
  | { kind: "insufficient"; stale: boolean; calculatedAt?: string }
  | { kind: "available"; score: number; level: HypeLevel; direction: HypeDirection | null; stale: boolean; calculatedAt?: string };

export function hypeViewState(summary: HypeSummary | null | undefined, opts: { loading?: boolean; error?: boolean } = {}): HypeViewState {
  if (summary) {
    if (summary.status === "NOT_CALCULATED") return { kind: "not_calculated" };
    if (summary.status === "INSUFFICIENT_DATA" || summary.score == null || !summary.level) return { kind: "insufficient", stale: !!summary.stale, calculatedAt: summary.calculatedAt };
    return { kind: "available", score: summary.score, level: summary.level, direction: summary.direction ?? null, stale: !!summary.stale, calculatedAt: summary.calculatedAt };
  }
  if (opts.loading) return { kind: "loading" };
  if (opts.error) return { kind: "error" };
  return { kind: "not_calculated" };
}

/** Número exibido (inteiro): a faixa do backend segue o mesmo arredondamento. */
export const displayScore = (score: number) => Math.round(score);

/** Seta do movimento numa janela definida (7 dias por padrão): ↑ subiu, ↓ caiu, → estável; null = sem base de comparação. */
export const ARROW: Record<HypeDirection, string> = { UP: "↑", DOWN: "↓", STABLE: "→" };

/**
 * Variação para exibição: percentual quando há base positiva ("+14%"), senão em pontos ("+3 pts"); sem sinal para estável.
 * Devolve só os números — o texto vem do i18n.
 */
export function deltaOf(summary: Pick<HypeSummary, "direction" | "deltaPercent" | "deltaPoints"> | null | undefined): { direction: HypeDirection; percent?: number; points?: number } | null {
  if (!summary?.direction) return null;
  const percent = summary.deltaPercent != null ? Math.round(summary.deltaPercent) : undefined;
  const points = summary.deltaPoints != null ? Math.round(summary.deltaPoints) : undefined;
  return { direction: summary.direction, percent, points };
}

/** Classe de tom por faixa (sempre acompanhada do rótulo em texto — nunca só cor). */
export const levelTone = (level: HypeLevel) => `is-${level.toLowerCase().replace("_", "-")}`;

/** Dimensões que fazem sentido para o tipo (influência = remixes/looks derivados, só em looks). */
export const dimensionsFor = (type: HypeEntity, list: HypeDimension[] = DIMENSION_ORDER) => list.filter((d) => d !== "INFLUENCE" || type === "SCHEME");

/**
 * Escala legada de popularidade (painel do Look do Dia v1, DNA "Hype Focus"): sem vermelho — nota baixa não é erro, é
 * conteúdo novo ou pouco visto.
 */
export const hypeColor = (h?: number | null) => ((h ?? 0) >= 70 ? "var(--thread)" : (h ?? 0) >= 40 ? "var(--chalk)" : "var(--muted)");
