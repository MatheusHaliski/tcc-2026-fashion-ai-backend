import type { BrandSalePlacement } from "@/components/marketplace/brand-sale-fields";
import { api } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import type { CatalogProduct, CatalogVariant } from "@/lib/api/catalog";
import { toPayload, type PieceFormValue } from "@/components/piece-form";

export function createPieceRequest(
  value: PieceFormValue, background: Record<string, unknown>,
  draftId: string | undefined, listing: BrandSalePlacement | null,
  pick: { product: CatalogProduct; variant: CatalogVariant | null } | null,
) {
  const placement = listing ? "/api/me/marketplace/listings" : "/api/pieces";
  const params = new URLSearchParams();
  if (listing?.store) params.set("storeId", listing.store.id);
  if (listing?.expiresOn) params.set("expiresOn", listing.expiresOn);
  const query = params.size ? `?${params}` : "";
  const payload = toPayload({
    ...value,
    ...(listing ? { visibility: "PUBLIC" } : {}),
    background,
    useDefaultImage: !draftId,
    ...(draftId ? { draftId } : {}),
  });
  if (!pick) return api.post<PieceView>(placement + query, payload);
  return api.post<PieceView>(`${placement}/from-catalog${query}`, {
    productId: pick.product.id,
    variantId: pick.variant?.id ?? null,
    size: value.size || null,
    condition: value.condition || null,
    price: payload.price,
    purchaseDate: payload.purchaseDate,
    purchaseLocation: value.purchaseLocation || null,
    favorite: false,
    forSale: value.forSale,
    notes: value.notes || null,
    visibility: payload.visibility,
    occasion: value.occasion,
    style: value.style,
    color: value.color || null,
    material: value.material || null,
    sex: value.sex || null,
    name: value.name || null,
    background,
  });
}
