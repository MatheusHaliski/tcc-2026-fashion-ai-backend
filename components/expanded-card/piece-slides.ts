/**
 * As fotos do card ampliado da peça: a foto de produto (a do estúdio aprovada, inteira, ou o recorte contido; sem foto,
 * a ilustração da categoria) e, quando há, a foto no manequim. Usado pelo ExpandedPieceCard (galeria) e pelo
 * ExpandedPiece (tela cheia). Extraído de expanded-piece.tsx.
 */
import { mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { defaultGarmentUrl } from "@/lib/catalog/default-garment";
import { pieceCatalogCrop, pieceCatalogSource } from "@/components/catalog/catalog-photo";
import { backdropCenter, backdropEdge, type StudioBackdrop } from "@/components/studio";
import type { Slide } from "./piece-gallery";

type T = (key: string, vars?: Record<string, string | number>) => string;

export function pieceSlides(p: PieceView, backdrops: StudioBackdrop[], t: T): Slide[] {
  const edge = backdropEdge(backdrops, p.studioBackdrop);
  // a foto de produto aprovada, inteira (a variante enquadrada é só para o feed); sem estúdio, o recorte contido
  const product: Slide = p.studioImageUrl
    ? { key: "product", src: mediaUrl(p.studioImageUrl)!, alt: t("pieces.id.estudio", { name: p.name }), caption: t("pieceDetail.slide_produto"), fit: "contain", alternatives: [p.imageUrl, p.thumbnailUrl, pieceCatalogSource(p)], backdrop: { center: backdropCenter(backdrops, p.studioBackdrop), edge } }
    : { key: "product", src: (mediaUrl(p.imageUrl) ?? mediaUrl(p.thumbnailUrl))!, alt: p.name, caption: t("pieceDetail.slide_produto"), fit: "contain", alternatives: [p.thumbnailUrl, p.imageUrl, pieceCatalogSource(p)], crop: pieceCatalogCrop(p) };
  if (p.defaultImage) { product.src = defaultGarmentUrl(p.category, p.subcategory, p.colorHex, p.color, "WHOLE"); product.crop = null; product.alternatives = []; }
  return [product, ...(p.mannequinImageUrl ? [{ key: "mannequin", src: mediaUrl(p.mannequinImageUrl)!, alt: t("pieces.id.no_manequim", { name: p.name, value: "" }), caption: t("pieceDetail.slide_manequim"), fit: "contain" as const }] : [])];
}
