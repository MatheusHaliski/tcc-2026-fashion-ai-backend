/**
 * HypeScore v2 — tipos espelhando o backend (HypeQueryService). O Hype mede a relevância de uma peça ou look dentro do
 * FashionAI e como ela evolui; NUNCA a qualidade nem a compatibilidade com o estilo de quem vê (campo separado).
 */
import type { PieceView, SchemeView, UserCard } from "@/lib/api/types";

/** PIECE = peça; SCHEME = look (esquema de vestimenta). A API também aceita "LOOK". */
export type HypeEntity = "PIECE" | "SCHEME";
/** NOT_CALCULATED = ainda sem snapshot; INSUFFICIENT_DATA = calculado, mas sem sinais suficientes (nunca vira 0). */
export type HypeStatus = "AVAILABLE" | "INSUFFICIENT_DATA" | "NOT_CALCULATED";
export type HypeLevel = "LOW_SIGNAL" | "NICHE" | "RELEVANT" | "HOT" | "TRENDING" | "VIRAL";
export type HypeDirection = "UP" | "DOWN" | "STABLE";
export type HypeMomentum = "EMERGING" | "RISING" | "STABLE" | "COOLING" | "CLASSIC";
export type HypeDimension = "POPULARITY" | "ENGAGEMENT" | "TREND" | "TREND_VELOCITY" | "ORIGINALITY" | "RARITY" | "LONGEVITY" | "NOVELTY" | "INFLUENCE";

export interface HypeSummary {
  status: HypeStatus;
  stale?: boolean;
  score?: number | null;
  level?: HypeLevel | null;
  direction?: HypeDirection | null;
  deltaPoints?: number | null;
  deltaPercent?: number | null;
  momentum?: HypeMomentum | null;
  dimensions?: Partial<Record<HypeDimension, number>>;
  calculatedAt?: string;
  algorithmVersion?: string;
}

export interface HypeReason { code: string; tone: "POSITIVE" | "NEGATIVE" | "NEUTRAL"; dimension?: HypeDimension; value?: number }

/** Compatibilidade PESSOAL com o DNA de estilo — separada do Hype. */
export interface StyleCompatibility { score: number; parts?: { styles?: number; colors?: number; occasions?: number } }

export interface HypeDetail extends HypeSummary {
  entityType: HypeEntity;
  entityId: string;
  reasons: HypeReason[];
  /** métricas do cálculo + `byType`: contagem real por tipo de sinal (janela atual, anterior e horizonte) */
  signals: Record<string, unknown> & { byType?: Record<string, { current: number; previous: number; total: number }> };
  publicEligible: boolean;
  weights?: Partial<Record<HypeDimension, number>>;
  compatibility?: StyleCompatibility | null;
  /** peça: em quantos looks aparece */
  inLooks?: number;
  /** look: cada peça com o próprio Hype */
  pieces?: { id: string; name: string; category?: string | null; subcategory?: string | null; imageUrl?: string | null; hype: HypeSummary }[];
}
/** Posições do item no ranking público (análise completa); fora da população pública: eligible = false. */
export type HypePositionScope = "GLOBAL" | "CATEGORY" | "SUBCATEGORY" | "REGION" | "COUNTRY";
export interface HypePositions {
  eligible: boolean; window: number;
  positions: { scope: HypePositionScope; key?: string | null; label?: string | null; rank: number; total: number }[];
}

export interface HypeHistoryPoint { date: string; status: "AVAILABLE" | "INSUFFICIENT_DATA"; score?: number | null; level?: HypeLevel | null; dimensions?: Partial<Record<HypeDimension, number>> }
export interface HypeHistory { entityType: HypeEntity; entityId: string; algorithmVersion: string; days: number; points: HypeHistoryPoint[] }

export interface HypeSummaries { type: HypeEntity; algorithmVersion: string; deltaWindowDays: number; items: Record<string, HypeSummary> }

/** Item dos painéis pessoais (destaques, quem subiu/caiu, redescobertas). */
export interface HypeCardItem {
  type: HypeEntity; id: string; metric: string; value?: number | null; hype: HypeSummary;
  piece?: PieceView; scheme?: SchemeView;
  idleDays?: number; similarGrowthPercent?: number | null; trend?: number;
}

export interface HypeWardrobe {
  algorithmVersion: string; deltaWindowDays: number; pieces: number; piecesWithHype: number; looks: number;
  averageHype?: number | null; averageDeltaPoints?: number | null; calculatedAt?: string | null;
  highlights: Partial<Record<"topPiece" | "biggestGrowth" | "classic" | "rare" | "forgotten" | "topLook" | "mostRemixed", HypeCardItem>>;
  rediscoveries: HypeCardItem[];
}

export interface HypeMovers {
  algorithmVersion: string; deltaWindowDays: number; days: number;
  series: { pieces: { date: string; average: number; n: number }[]; looks: { date: string; average: number; n: number }[] };
  risers: HypeCardItem[]; fallers: HypeCardItem[]; rediscoveries: HypeCardItem[]; emergingLooks: HypeCardItem[];
  newTrends: { category: string; emerging: number }[];
}

export interface HypeTrending {
  type: HypeEntity; window: 1 | 7 | 30; algorithmVersion: string;
  items: { rank: number; id: string; hype: HypeSummary; piece?: PieceView; scheme?: SchemeView }[];
}
/** Recortes agregados do "Em alta": marca (peças) ou pessoa criadora (peças + looks). */
export type HypeRankGroup = "BRAND" | "CREATOR";
export interface HypeTrendingGroups {
  type: HypeRankGroup; window: 1 | 7 | 30; algorithmVersion: string; minItems: number;
  items: { rank: number; key: string; name?: string; logoUrl?: string | null; ownerId?: string; user?: UserCard; value: number; items: number; pieces: number; looks: number; top: { type: HypeEntity; id: string; hype: HypeSummary } }[];
}

/* ---------- Explorador → Ranking de HypeScore (por região do mundo, país, categoria e subcategoria) ---------- */
/** Regiões do mundo (WorldRegions do backend); quem não informou o país fica em OUTRAS. */
export type HypeWorldRegion = "AMERICA_DO_SUL" | "AMERICA_DO_NORTE" | "AMERICA_CENTRAL_CARIBE" | "EUROPA" | "ASIA" | "ORIENTE_MEDIO" | "AFRICA" | "OCEANIA" | "OUTRAS";

/** Peça do look com o próprio Hype ("o hype do look pelas peças dentro dele"). */
export interface HypeLookPiece { id: string; name?: string | null; category?: string | null; subcategory?: string | null; imageUrl?: string | null; hype: HypeSummary }

export interface HypeRankingItem {
  /** posição pública no recorte (não muda com bloqueios de quem vê: o item bloqueado só some) */
  rank: number; id: string;
  /** número da janela: trend (hoje), HypeScore (7 dias) ou média do mês (30 dias) */
  value?: number | null;
  hype: HypeSummary; region: HypeWorldRegion | string; regionLabel?: string | null; country?: string | null;
  piece?: PieceView; scheme?: SchemeView; pieces?: HypeLookPiece[];
}
export interface HypeRanking {
  type: HypeEntity; window: 1 | 7 | 30; algorithmVersion: string; total: number; page: number; size: number; hasMore: boolean;
  filters: { region?: string | null; country?: string | null; category?: string | null; subcategory?: string | null };
  items: HypeRankingItem[];
}
export interface HypeRankingFacets {
  type: HypeEntity; window: 1 | 7 | 30; algorithmVersion?: string; total?: number;
  filters?: { region?: string | null; category?: string | null };
  /** base da comparação: todos os itens públicos do tipo/categoria */
  world?: { count: number; avgHype?: number | null };
  regions: { key: string; label?: string | null; count: number; avgHype?: number | null }[];
  countries: { key: string; count: number }[];
  categories: { key: string; count: number }[];
  subcategories: { key: string; category?: string | null; count: number }[];
}
