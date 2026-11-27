import { api } from "@/lib/api/client";
import type { CatalogCardImage } from "@/lib/api/catalog";

/** Tipos de item da Loja FAI Points, na ordem dos filtros (a mesma do servidor). */
export const FAI_STORE_TYPES = ["AURA_PRESET", "WARDROBE", "ACERVO_ITEM", "PIECE_CARD", "LOOK_CARD", "BRAND_AURA", "BRAND_PIECE"] as const;
export type FaiStoreType = (typeof FAI_STORE_TYPES)[number];

export interface FaiStoreCreator { name: string; kind: "MARCA" | "CELEBRIDADE"; slug?: string; demo?: boolean }
export interface FaiStoreProduct { id: string; productName: string; category?: string | null; colorName?: string | null; imageUrl?: string | null; catalogImage?: CatalogCardImage | null }

export interface FaiStoreItem {
  id: string;
  type: FaiStoreType;
  name: string;
  description: string;
  pricePoints: number;
  visual: Record<string, unknown> | null;
  creator: FaiStoreCreator | null;
  product: FaiStoreProduct | null;
  owned: boolean;
  affordable: boolean;
}

export interface FaiStoreView { balance: number; types: FaiStoreType[]; items: FaiStoreItem[] }
export interface FaiStorePurchase { itemId: string; owned: true; balance: number }

/** Loja FAI Points: só FAI Points, só itens do app (docs/loja/LOJA_FAI_POINTS.md). */
export const faiStoreApi = {
  store: (signal?: AbortSignal) => api.get<FaiStoreView>("/api/fai-store", { signal }),
  mine: (signal?: AbortSignal) => api.get<FaiStoreItem[]>("/api/fai-store/mine", { signal }),
  purchase: (id: string) => api.post<FaiStorePurchase>(`/api/fai-store/items/${encodeURIComponent(id)}/purchase`),
};
