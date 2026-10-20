import type { Counters, PieceView, UserCard, ViewerState } from "@/lib/api/types";
import type { HypeSummary } from "@/lib/hype/types";
import { DEMO_ID_PREFIX } from "@/lib/hype/use-hype";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";

export const DEMO_OWNER: UserCard = { id: `${DEMO_ID_PREFIX}owner`, username: "exemplo", displayName: "Exemplo", profileType: "PESSOAL", verified: false, privateAccount: false, country: "BR" };
export const DEMO_COUNTERS: Counters = { likes: 24, comments: 5, shares: 2, remixes: 1, views: 180, saves: 7, reactions: {} };
export const DEMO_VIEWER: ViewerState = { liked: false, reactions: [], saved: false, canEdit: false, following: false };
export const AT = "2026-10-01T12:00:00Z";
/** nomes próprios do exemplo (marca fictícia e o nome do produto FAI Points): não se traduzem */
export const DEMO_BRAND = "Atelier Lumi";
export const POINTS_NAME = "FAI Points";
/** dados fictícios do exemplo ilustrado (não vão à API nem viram conteúdo de ninguém) */
export const DEMO_PIECE_NAME = "Jaqueta jeans";
export const DEMO_PIECE_NAME_2 = "Camisa de linho";
export const DEMO_SEAL_NAME = "Selo de exemplo";

export function demoPiece(over: Partial<PieceView> = {}): PieceView {
  return {
    id: `${DEMO_ID_PREFIX}piece`, owner: DEMO_OWNER, name: DEMO_PIECE_NAME, category: "upper_piece", subcategory: "jacket", sex: "UNISSEX",
    brandName: null, brandLogoUrl: null, color: "denim", colorHex: "#4a6a8c", material: "DENIM", size: "m", style: ["streetwear"], occasion: ["casual"],
    seals: [], price: null, imageUrl: "/assets_pecas/14_jacket_jaqueta.png", originalImageUrl: null, thumbnailUrl: "/assets_pecas/14_jacket_jaqueta.png",
    defaultImage: true, aiGeneratedImage: false, visibility: "PUBLIC", disponivel: true, availabilityStatus: "AVAILABLE", favorite: false, forSale: false,
    wearCount: 3, moderationStatus: "APPROVED", photoProcessingStatus: "COMPLETED", flatLayMetadata: {}, background: { skin: "atelier" },
    hypeScore: null, hypeScoreGlobal: null, tags: [], counters: DEMO_COUNTERS, viewer: DEMO_VIEWER, notAvailableAnymore: false, createdAt: AT, updatedAt: AT,
    ...over,
  } as PieceView;
}

export function demoCard(over: Partial<FlairCollectionCard> = {}): FlairCollectionCard {
  return {
    id: `${DEMO_ID_PREFIX}card`, originType: "PIECE", originId: `${DEMO_ID_PREFIX}piece`, season: "SPRING", tier: "OURO", ovr: 78, rare: false, position: "SUP",
    name: DEMO_PIECE_NAME, brandName: DEMO_BRAND, imageUrl: "/assets_pecas/14_jacket_jaqueta.png", category: "upper_piece", subcategory: "jacket",
    hype: { POP: 71, RAR: 40, ENG: 66, LON: 58, TRD: 74, NOV: 62, ORI: 55, HYP: 68 }, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED",
    ...over,
  };
}

export const DEMO_SCHEME_SEAL = { label: "LOOK", name: DEMO_SEAL_NAME, kind: "BRAND" as const, premium: false, design: null };
// o Hype dos exemplos nasce no cache (nunca é pedido à API): um com números de exemplo, outro sem dados
export const DEMO_HYPE: Record<string, HypeSummary> = {
  [`${DEMO_ID_PREFIX}piece`]: { status: "INSUFFICIENT_DATA", score: null },
  [`${DEMO_ID_PREFIX}piece-hype`]: { status: "AVAILABLE", score: 68, level: "HOT", direction: "UP", calculatedAt: AT },
};

