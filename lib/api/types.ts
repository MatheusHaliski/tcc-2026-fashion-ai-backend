/** Tipos espelhando os records do backend (Views.java e serviços). Campos opcionais quando o backend pode omitir. */
export interface UserCard {
  id: string; username: string; displayName: string; avatarUrl?: string | null; profileType: "PESSOAL" | "MARCA" | "CELEBRIDADE" | "ADMIN";
  verified: boolean; country?: string | null; privateAccount: boolean;
}
export interface Session {
  accessToken: string; expiresInSeconds: number; refreshToken: string; refreshExpiresAt: string; sessionId: string;
  user: UserCard; status: string; emailVerified: boolean; warnings: string[];
}
export interface Me {
  user: UserCard; email: string; emailVerified: boolean; phone?: string | null; birthDate?: string | null; bio?: string | null;
  coverUrl?: string | null; status: string; role: "USER" | "ADMIN"; twoFactorEnabled: boolean; termsVersion?: string;
  deletionScheduledFor?: string | null; lookDoDiaPanelVersion?: string;
  /** RF1 — sexo do manequim (Passarela 3D / provador) e saída da Passarela 3D. */
  sex?: "FEMININO" | "MASCULINO" | null; runwayOptOut?: boolean; pronouns?: string | null; links?: { title: string; url: string }[]; [k: string]: unknown;
}
export interface Counters { likes: number; comments: number; shares: number; remixes: number; views: number; saves: number; reactions: Record<string, number>; }
export interface ViewerState { liked: boolean; reactions: string[]; saved: boolean; canEdit: boolean; following: boolean; }
export interface PieceView {
  id: string; owner: UserCard; name: string; category: string; subcategory: string; sex: string; brandName?: string | null; brandId?: string | null;
  brandLogoUrl?: string | null; brandSource?: string | null; color: string; colorHex?: string | null; material?: string; size?: string; market?: string; style: string[]; occasion: string[];
  seals: string[]; price?: number | null; imageUrl?: string | null; originalImageUrl?: string | null; thumbnailUrl?: string | null; defaultImage: boolean;
  visibility: string; disponivel: boolean; availabilityStatus: string; condition?: string; favorite: boolean; forSale: boolean; wearCount: number;
  lastWornDate?: string | null; moderationStatus?: string; photoProcessingStatus?: string; photoQuality?: Record<string, unknown>;
  flatLayMetadata?: Record<string, unknown>; background?: Record<string, unknown>; hypeScore?: number | null; hypeScoreGlobal?: number | null;
  /** curtidas da peça (vem na linha resumida da peça dentro de um look) */
  likes?: number;
  tags: string[]; notes?: string | null; purchaseDate?: string | null; model3dStatus?: string | null; model3dUrl?: string | null;
  /** RF4 · Estúdio: foto de produto (fundo de estúdio, luz e sombra) + miniatura 640 px para grades */
  studioImageUrl?: string | null; studioBackdrop?: string | null; studioThumbUrl?: string | null; mannequinImageUrl?: string | null; mannequinImageFace?: string | null;
  /** foto de detalhe 4:5 enquadrada no logo (quando há logo) */
  studioDetailUrl?: string | null;
  /** foto do feed 4:5 enquadrada pelo template da categoria (gola/peito, cós/joelhos…); null em fotos antigas */
  studioFeedUrl?: string | null;
  counters: Counters; viewer: ViewerState; notAvailableAnymore: boolean; createdAt: string; updatedAt: string;
}
export interface SchemeItemView { id?: string; wardrobeItemId: string; slot: string; sortOrder?: number; zIndex?: number; piece?: PieceView | null; name?: string; imageUrl?: string | null; [k: string]: unknown; }
export interface SchemeView {
  id: string; owner: UserCard; title: string; description?: string | null; creationMode: string; origin: string; style: string[]; occasion: string[];
  season?: string | null; mood?: string | null; visibility: string; status: string; displayMode?: string; disponivel: boolean; lookDoDia: boolean;
  coverImageUrl?: string | null; mannequinImageUrl?: string | null; mannequinImageFace?: string | null; background?: Record<string, unknown>; cardSkin?: string | null; layoutAnatomy?: string | null; containerOrigin?: string;
  containerColor?: string; items: SchemeItemView[]; totalPrice?: number | null; seals: string[]; sealBadges?: { tier: string; owner: string; premium: boolean; name?: string | null; iconUrl?: string | null; design?: import("@/components/seal-medallion").SealDesign | null; linkedPieceIds?: string[] }[]; tags: string[]; renderingStatus?: string;
  virtualTryOnUrl?: string | null; hypeScore?: number | null; hypeScoreGlobal?: number | null; remixedFromId?: string | null; revalidationPending: boolean;
  counters: Counters; viewer: ViewerState; publishedAt?: string | null; createdAt: string; updatedAt: string;
}
export interface Page<T> { items: T[]; page: number; size: number; total: number; hasMore: boolean; }
export type Dict = Record<string, unknown>;
