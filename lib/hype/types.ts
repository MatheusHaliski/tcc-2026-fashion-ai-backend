/**
 * HypeScore v2 — tipos espelhando o backend (HypeQueryService). O Hype mede a relevância de uma peça ou look dentro do
 * FashionAI e como ela evolui; NUNCA a qualidade nem a compatibilidade com o estilo de quem vê (campo separado).
 */
import type { PieceView, SchemeView } from "@/lib/api/types";

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
  signals: Record<string, unknown>;
  publicEligible: boolean;
  weights?: Partial<Record<HypeDimension, number>>;
  compatibility?: StyleCompatibility | null;
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
