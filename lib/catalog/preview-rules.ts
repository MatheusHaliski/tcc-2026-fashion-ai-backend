import type { CatalogProduct } from "@/lib/api/catalog";

/**
 * Regras puras da prévia (foto enquadrada) do cartão do catálogo: identidade da fonte, campos que a prévia traz, e
 * quando uma prévia ainda vale para a variante, a categoria, a cor e a foto de origem atuais do produto.
 */
export type PreviewFields = Pick<CatalogProduct, "catalogImage" | "imageProcessingStatus" | "images" | "imageSource">;
export type PreviewContext = PreviewFields & Partial<Pick<CatalogProduct, "selectedVariant" | "category" | "subcategory" | "color" | "imageUrl" | "imageSource">>;

/** Identidade da fonte/variante: muda quando a foto precisa ser reenquadrada (exclui metadados editáveis sem relação). */
export const sourceKey = (p: CatalogProduct) => JSON.stringify([
  p.id, p.category, p.subcategory, p.color, p.selectedVariant?.id, p.selectedVariant?.color,
  p.imageUrl, p.imageSource?.imageUrl, p.catalogImage?.imageId, p.catalogImage?.variantId,
  p.catalogImage?.url, p.catalogImage?.sourceUrl, p.catalogImage?.crop, p.catalogImage?.whole, p.catalogImage?.pipelineVersion, p.catalogImage?.photoSet,
  p.catalogImage?.previewCache?.contextHash, p.catalogImage?.previewCache?.sourceSha256,
  p.images?.map(image => [image.id, image.variantId, image.url, image.sourceUrl, image.processedUrl, image.processingStatus]),
]);
export const previewFields = (p: CatalogProduct): PreviewFields => ({ catalogImage: p.catalogImage, imageProcessingStatus: p.imageProcessingStatus, ...(p.images ? { images: p.images } : {}), ...(p.imageSource !== undefined ? { imageSource: p.imageSource } : {}) });
/** Há alguma foto de origem para enquadrar. */
export const hasPreviewSource = (product: CatalogProduct) => !!(product.imageUrl || product.catalogImage?.url || product.imageSource?.imageUrl);

export function matchesVariant(product: PreviewContext) {
  const variantId = product.selectedVariant?.id;
  const image = product.catalogImage;
  if (!variantId || image?.mode === "DEFAULT") return true;
  if (image?.variantId) return image.variantId === variantId;
  return !!product.images?.some(source => source.id === image?.imageId && source.variantId === variantId);
}
export function matchesPhotoContext(product: PreviewContext) {
  const image = product.catalogImage, set = image?.photoSet;
  if (!set) return true;
  const color = product.selectedVariant?.color ?? product.color;
  const source = product.images?.find(candidate => candidate.id === image.imageId);
  const sourceUrl = source?.sourceUrl ?? image.sourceUrl ?? product.imageSource?.imageUrl ?? product.imageUrl;
  return !(set.category && product.category && set.category !== product.category) &&
    !(set.subcategory && product.subcategory && set.subcategory !== product.subcategory) &&
    !(set.color && color && set.color !== color) &&
    !(set.sourceUrl && sourceUrl && set.sourceUrl !== sourceUrl);
}
export function hasUsableCatalogPreview(product: PreviewContext) {
  const image = product.catalogImage;
  if (image?.photoSet && !["READY", "DEFAULT"].includes(image.photoSet.status)) return false;
  return matchesVariant(product) && matchesPhotoContext(product) && !!image?.url && (image.mode === "DEFAULT" || image.mode === "PROCESSED" || (image?.mode === "SEMANTIC_CROP" && !!image.crop));
}
export function hasCachedPreview(product: PreviewContext) {
  const state = product.catalogImage?.previewCache;
  if(product.catalogImage?.photoSet?.version === "CATALOG_PHOTO_SET_V2" && ["READY","DEFAULT"].includes(product.catalogImage.photoSet.status)) return hasUsableCatalogPreview(product);
  return hasUsableCatalogPreview(product) && state?.version === "CATALOG_PREVIEW_FRAMES_V2" && state.status === "READY";
}

/** A resposta da API é de outro produto/contexto (ou de um conjunto de fotos não aprovado) e não pode ser exibida. */
export function previewContextChanged(product: CatalogProduct, p: CatalogProduct, prepared: CatalogProduct): boolean {
  return !!(p.id !== product.id || (p.category && product.category && p.category !== product.category) ||
    (p.subcategory && product.subcategory && p.subcategory !== product.subcategory) ||
    (p.catalogImage?.photoSet && !["READY", "DEFAULT"].includes(p.catalogImage.photoSet.status)) ||
    (p.catalogImage && (!matchesVariant(prepared) || !matchesPhotoContext(prepared))));
}
