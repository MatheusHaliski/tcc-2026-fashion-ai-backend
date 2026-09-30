/** Dados de exemplo no formato das respostas da API, para os testes de telas e componentes. */
import type { Counters, PieceView, SchemeView, UserCard, ViewerState } from "@/lib/api/types";

export const OWNER: UserCard = { id: "u1", username: "ana", displayName: "Ana Souza", profileType: "PESSOAL", verified: true, privateAccount: false, country: "BR" };
export const COUNTERS: Counters = { likes: 12, comments: 3, shares: 1, remixes: 0, views: 40, saves: 2, reactions: { LOVE: 4 } };
export const VIEWER: ViewerState = { liked: false, reactions: [], saved: false, canEdit: true, following: false };
const NOW = "2026-09-30T12:00:00Z";

export const PIECE: PieceView = {
  id: "p1", owner: OWNER, name: "Camiseta branca lisa", category: "upper_piece", subcategory: "t_shirt", sex: "UNISSEX",
  brandName: "Nike", brandLogoUrl: null, color: "white", colorHex: "#ffffff", material: "COTTON", size: "m", style: ["basic"], occasion: ["casual"],
  seals: ["BRAND:Nike"], price: 89.9, imageUrl: "/media/p1.png", originalImageUrl: "/media/p1-o.jpg", thumbnailUrl: "/media/p1-t.png", defaultImage: false,
  aiGeneratedImage: true, visibility: "PUBLIC", disponivel: true, availabilityStatus: "AVAILABLE", condition: "NEW", favorite: true, forSale: true, wearCount: 5,
  lastWornDate: "2026-09-20", moderationStatus: "APPROVED", photoProcessingStatus: "COMPLETED", flatLayMetadata: {}, background: { skin: "atelier" },
  hypeScore: 72, hypeScoreGlobal: 55, tags: ["verão"], counters: COUNTERS, viewer: VIEWER, notAvailableAnymore: false, createdAt: NOW, updatedAt: NOW,
} as PieceView;

export const PIECE_2: PieceView = { ...PIECE, id: "p2", name: "Calça jeans reta", category: "lower_piece", subcategory: "jeans", color: "blue", colorHex: "#1f4fa0", favorite: false, forSale: false, aiGeneratedImage: false, disponivel: false } as PieceView;

export const SCHEME: SchemeView = {
  id: "s1", owner: OWNER, title: "Look de sexta", description: "Casual para o trabalho", creationMode: "MANUAL", origin: "MANUAL", style: ["basic"], occasion: ["work"],
  season: "summer", mood: "confiante", visibility: "PUBLIC", status: "PUBLISHED", disponivel: true, lookDoDia: true, coverImageUrl: "/media/s1.png",
  background: { skin: "atelier" }, containerColor: "#ffffff",
  items: [{ wardrobeItemId: "p1", slot: "upper", piece: PIECE }, { wardrobeItemId: "p2", slot: "lower", piece: PIECE_2 }],
  totalPrice: 190, seals: [], tags: [], sealBadges: [], hypeScore: 80, hypeScoreGlobal: 60, revalidationPending: false,
  counters: COUNTERS, viewer: VIEWER, publishedAt: NOW, createdAt: NOW, updatedAt: NOW,
} as SchemeView;

export const page = <T,>(items: T[]) => ({ items, content: items, page: 0, size: 20, total: items.length, totalElements: items.length, hasMore: false, last: true });
