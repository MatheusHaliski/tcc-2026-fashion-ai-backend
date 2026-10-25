import type { Look3dPiece } from "@/components/three/common";

/** The photograph belongs to this product/variant, never the displayed FABRIC crop. */
export function garmentPhotoUrls(piece: Look3dPiece, retry = 0): string[] {
  if (!piece.catalogProductId) return [piece.studioUrl, piece.imageUrl]
    .filter((url, index, urls): url is string => !!url && urls.indexOf(url) === index);
  const path = `/api/catalog/products/${encodeURIComponent(piece.catalogProductId)}/texture-image`;
  const selected = new URLSearchParams();
  if (piece.catalogVariantId) selected.set("variantId", piece.catalogVariantId);
  if (piece.catalogImageId) selected.set("imageId", piece.catalogImageId);
  if (piece.textureRevision || retry) selected.set("v", `${piece.textureRevision ?? "source"}:${retry}`);
  const isolated = new URLSearchParams(selected); isolated.set("isolated", "true");
  return [`${path}?${isolated}`, `${path}${selected.size ? `?${selected}` : ""}`];
}

/**
 * Foto das COSTAS da mesma peça/variante (o backend só serve uma foto marcada como costas; sem ela, 404). Peça fora do
 * catálogo não tem foto de costas cadastrada: lista vazia, as costas ficam no tecido medido ("sem evidência").
 */
export function garmentBackPhotoUrls(piece: Look3dPiece, retry = 0): string[] {
  if (!piece.catalogProductId) return [];
  const path = `/api/catalog/products/${encodeURIComponent(piece.catalogProductId)}/texture-image`;
  const selected = new URLSearchParams({ view: "back" });
  if (piece.catalogVariantId) selected.set("variantId", piece.catalogVariantId);
  if (piece.textureRevision || retry) selected.set("v", `${piece.textureRevision ?? "source"}:${retry}`);
  const isolated = new URLSearchParams(selected); isolated.set("isolated", "true");
  return [`${path}?${isolated}`, `${path}?${selected}`];
}

/** Retry and metadata changes invalidate only this garment's memory/HTTP cache. */
export function garmentPhotoKey(part: string, piece: Look3dPiece, retry = 0): string {
  return JSON.stringify([part, piece.catalogProductId, piece.catalogVariantId, piece.catalogImageId,
    piece.textureRevision, piece.category, piece.subcategory, garmentPhotoUrls(piece, retry), piece.imageUrl, piece.studioUrl, retry]);
}

export function isIsolatedCatalogPhoto(piece: Look3dPiece, url: string, retry = 0): boolean {
  return !!piece.catalogProductId && (garmentPhotoUrls(piece, retry)[0] === url || garmentBackPhotoUrls(piece, retry)[0] === url);
}
