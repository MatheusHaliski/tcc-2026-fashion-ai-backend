/**
 * Insights dinâmicos (RF53) — contrato de GET /api/insights. Cada aba com análise pede os insights do seu contexto;
 * os públicos (EXPLORER_*) funcionam sem login e só usam dados públicos agregados, os pessoais exigem sessão.
 * Hype é contexto, nunca critério único; tendência (crescimento) ≠ popularidade (volume); o texto já vem traduzido.
 */
/**
 * Lote A5 (P3-15): FEED, SEARCH, BRAND_PROFILE (chave = slug) e CREATOR_PROFILE (chave = @) também são públicos — só o
 * agregado público, com o bloqueio de quem vê aplicado no backend; LOOK_EDITOR (peças escolhidas no editor) é pessoal.
 */
export const PUBLIC_INSIGHT_CONTEXTS = ["EXPLORER_RUNWAY", "EXPLORER_TRENDING", "EXPLORER_RANKING", "EXPLORER_MAP", "EXPLORER_BRANDS", "EXPLORER_GLOBAL", "FEED", "SEARCH", "BRAND_PROFILE", "CREATOR_PROFILE"] as const;
export const PERSONAL_INSIGHT_CONTEXTS = ["CAPSULE", "COPILOT", "AUTOPILOT", "HISTORY", "CLOSET", "LOOKS", "LOOK_EDITOR"] as const;
export type InsightContext = (typeof PUBLIC_INSIGHT_CONTEXTS)[number] | (typeof PERSONAL_INSIGHT_CONTEXTS)[number];
export const isPublicInsightContext = (c: InsightContext) => (PUBLIC_INSIGHT_CONTEXTS as readonly string[]).includes(c);

export type InsightTone = "POSITIVE" | "NEUTRAL" | "ATTENTION";
export type InsightUnit = "%" | "pts" | "dias" | "looks" | "peças";

export interface Insight {
  /** estável (CATEGORY_RISING, POPULAR_NOT_GROWING, CAPSULE_IDLE_REDISCOVERY…) */
  code: string;
  tone: InsightTone;
  title: string;
  /** frase humana com o número ("Calçados cresceram 23% em 7 dias na América do Sul.") */
  text: string;
  metric?: { label: string; value: number | null; unit?: InsightUnit | null } | null;
  action?: { label: string; href: string } | null;
  /** de onde vem: HYPE_V2, WARDROBE_USAGE, STYLE_DNA, CAPSULE, PUBLIC_RANKING… */
  basis?: string[];
}

export interface InsightsResponse {
  context: string;
  generatedAt?: string | null;
  algorithmVersion?: string | null;
  source?: "local" | "ia" | null;
  items: Insight[];
}

/**
 * Parâmetros opcionais do recorte (janela em dias, região, categoria, subcategoria); `key` = perfil (BRAND_PROFILE: slug,
 * CREATOR_PROFILE: @) e `pieces` = ids das peças escolhidas no editor (LOOK_EDITOR), separados por vírgula.
 */
export type InsightParams = { window?: string | number | null; region?: string | null; category?: string | null; subcategory?: string | null; key?: string | null; pieces?: string | null };
