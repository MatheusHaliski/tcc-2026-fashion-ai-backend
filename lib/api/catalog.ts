import { api } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";

/** RF47 · Tipos e chamadas do catálogo global (produto ≠ peça pessoal). */
export interface CatalogBrandRef { id: string; name: string; slug: string; logoUrl?: string | null }
export interface CatalogVariant { id: string; key: string; color?: string | null; colorName?: string | null; code?: string | null; sku?: string | null }
export interface ImageProvenance { sourceType: string; sourceDomain: string; productUrl: string; imageUrl: string; retrievedAt: string; lastVerifiedAt: string; usage: string }
/** Características únicas da peça (estampa, logo, lados, cor da peça × da estampa) — lidas do texto ou gravadas no produto. */
export interface DesignTraits { pattern?: string | null; logoPlacement?: string | null; logoSize?: string | null; sides?: string[]; baseColors?: string[]; printColors?: string[]; anyColors?: string[]; source?: "LOCAL" | "AI" | "CATALOG" }
/** Uma característica pedida e se o produto a tem ("por que esta?"). */
export interface MatchReason { facet: "pattern" | "placement" | "size" | "sides" | "baseColor" | "printColor" | "color"; value: string; ok: boolean }
export interface MatchScore { total: number; brandMatch: number; categoryMatch: number; subcategoryMatch: number; textSimilarity: number; colorMatch: number; visualSimilarity?: number | null; designMatch?: number | null; reasons?: MatchReason[] }
export interface CatalogProduct {
  id: string; brand: CatalogBrandRef | null; productName: string; modelName?: string | null; category: string; subcategory: string;
  color?: string | null; colorName?: string | null; colorHex?: string | null; material?: string | null; collection?: string | null; gender?: string | null;
  description?: string | null; design?: DesignTraits | null;
  productCode?: string | null; sku?: string | null; imageUrl?: string | null; imageSource?: ImageProvenance | null;
  source: { type: string; domain: string; productUrl: string; status: string; lastVerifiedAt: string }; ingestionStatus: string; ownersCount: number;
  matchScore?: MatchScore; matchPercent?: number; variants?: CatalogVariant[]; selectedVariant?: CatalogVariant | null;
  images?: { id: string; url: string; type: string; primary: boolean; provenance: ImageProvenance }[]; aliases?: string[];
}
export interface SearchIntent { brand?: string | null; brandKnown: boolean; category?: string | null; subcategory?: string | null; keywords: string[]; color?: string | null; design?: DesignTraits | null }
export interface SearchResponse { intent: SearchIntent; results: CatalogProduct[]; total: number; enoughInput: boolean; canSearchOfficial?: boolean; message?: string | null }
export interface DiscoverResponse { results: CatalogProduct[]; status: "FOUND" | "NOT_FOUND" | "BRAND_UNKNOWN" | "NO_OFFICIAL_SOURCE"; message?: string; rejected?: number }
export interface SearchParams { category?: string; subcategory?: string; brand?: string; q?: string; color?: string; limit?: number }

const qs = (p: SearchParams) => {
  const u = new URLSearchParams();
  Object.entries(p as Record<string, string | number | undefined>).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== null) u.set(k, String(v)); });
  const s = u.toString();
  return s ? `?${s}` : "";
};

export const catalogApi = {
  search: (p: SearchParams, signal?: AbortSignal) => api.get<SearchResponse>(`/api/catalog/search${qs(p)}`, { signal }),
  suggestions: (p: SearchParams, signal?: AbortSignal) => api.get<{ suggestions: string[] }>(`/api/catalog/suggestions${qs(p)}`, { signal }),
  product: (id: string) => api.get<CatalogProduct>(`/api/catalog/products/${id}`),
  discover: (p: { brand?: string; subcategory?: string; category?: string; query?: string; color?: string }) => api.post<DiscoverResponse>("/api/catalog/discover", p),
  addToWardrobe: (body: Record<string, unknown>) => api.post<PieceView>("/api/pieces/from-catalog", body),
};

/** Duas ou três informações já bastam para procurar (marca, tipo, texto com 2+ letras). */
export function enoughToSearch(p: { brand?: string; subcategory?: string; q?: string }) {
  const n = [(p.brand ?? "").trim().length > 0, (p.subcategory ?? "").length > 0, (p.q ?? "").trim().length >= 2].filter(Boolean).length;
  return n >= 2 || (p.q ?? "").trim().length >= 3;
}
