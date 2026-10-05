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
/**
 * RF53 — Selos de Hype FashionAI: automáticos, derivados do HypeScore atual (HypeSeals.of no backend; nada salvo, nada
 * emitido por marca). Ordem de prioridade: VIRAL > TRENDING > EMERGING > CLASSIC > RARE. O Hype alimenta os selos; selo
 * nunca alimenta o Hype.
 */
export type HypeSealCode = "VIRAL" | "TRENDING" | "EMERGING" | "CLASSIC" | "RARE";
/** Progresso de cada Selo de Hype no detalhe (drawer): conquistado ou o critério que falta (texto já traduzido). */
export interface HypeSealProgress { code: HypeSealCode; earned: boolean; criteria: string }

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
  /** RF53 — Selos de Hype conquistados (ordenados por prioridade; lista vazia quando nenhum) */
  seals?: HypeSealCode[];
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
  /** RF53 — todos os Selos de Hype: conquistados (earned) e o critério de cada um */
  sealProgress?: HypeSealProgress[];
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
  /** P3-01: TREND = o valor é o trend médio (janela "hoje", sem faixa); HYPE = Hype médio com faixa */
  metric?: "TREND" | "HYPE";
  items: {
    rank: number; key: string; name?: string; logoUrl?: string | null; ownerId?: string; user?: UserCard; value: number; items: number; pieces: number; looks: number;
    /** faixa do valor (só quando o valor é Hype) e o perfil oficial da marca, quando existe (link /brands/{slug}) */
    level?: HypeLevel | null; slug?: string | null; sufficient?: boolean;
    top: { type: HypeEntity; id: string; hype: HypeSummary };
  }[];
}

/**
 * Lote A1 — Hype agregado de uma marca (chave = nome normalizado) ou de uma pessoa (chave = id) em
 * GET /api/hype/groups?type=BRAND|CREATOR&keys=. Só itens públicos elegíveis; abaixo de `minItems` (3) o grupo é
 * insuficiente: sem valor, sem faixa e sem posição — a interface não mostra nada (nunca 0).
 */
export interface HypeGroupSummary {
  key: string; name?: string; slug?: string | null; logoUrl?: string | null; ownerId?: string;
  sufficient: boolean;
  /** média dos 5 itens públicos mais relevantes (HypeScore atual ou média do mês) */
  value?: number | null; level?: HypeLevel | null;
  /** posição no ranking público completo do tipo (sem recorte) */
  rank?: number | null;
  items: number; pieces: number; looks: number;
  top?: { type: HypeEntity; id: string } | null;
}
export interface HypeGroups { type: HypeRankGroup; window: 7 | 30; algorithmVersion: string; minItems: number; total: number; items: Record<string, HypeGroupSummary> }

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

/* ---------- Explorador → Painel global: globo com camadas de Hype (GET /api/hype/globe) ---------- */
/** Item de destaque do país (o de maior métrica da janela que quem vê pode ver). */
export interface HypeGlobeTop {
  id: string; type: HypeEntity; name?: string | null; imageUrl?: string | null; category?: string | null;
  owner?: { username?: string | null } | null; hype: HypeSummary;
}
/** Agregado de um país (país do dono): só a população pública elegível com score no recorte. */
export interface HypeGlobeCountry {
  country: string; region: HypeWorldRegion | string; regionLabel?: string | null;
  /** itens públicos com score no recorte */
  count: number;
  /** donos distintos */
  creators: number;
  avgHype?: number | null; maxHype?: number | null;
  /** faixa do número exibido (régua do backend); ausente → calculada pela régua padrão */
  avgLevel?: HypeLevel | null; maxLevel?: HypeLevel | null;
  /** média da dimensão TREND (0–100): crescimento, não volume */
  trend?: number | null;
  /** quantos estão em RISING/EMERGING */
  rising: number;
  levels: Partial<Record<HypeLevel, number>>;
  topLevel?: HypeLevel | null;
  dominantColorHex?: string | null; topCategory?: string | null;
  top?: HypeGlobeTop | null;
  /** count ≥ minItems (abaixo disso o globo desenha apagado e sem card) */
  sufficient: boolean;
}
export interface HypeGlobe {
  type: HypeEntity; window: 1 | 7 | 30; algorithmVersion: string;
  filters: { category?: string | null; subcategory?: string | null; minLevel?: HypeLevel | null };
  minItems?: number;
  world: { count: number; avgHype?: number | null; maxHype?: number | null; creators: number; countries?: number };
  countries: HypeGlobeCountry[];
  regions: { key: string; label?: string | null; count: number; avgHype?: number | null }[];
}
