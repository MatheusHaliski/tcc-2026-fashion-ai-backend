"use client";

import { MediaImage } from "@/components/media-image";
import { DefaultGarmentPhoto } from "@/components/catalog/default-garment-photo";
import { CatalogPhoto, pieceCatalogCrop, pieceCatalogSource } from "@/components/catalog/catalog-photo";
import { ImpersonationMedia, impersonationMedia } from "@/components/impersonation-media";
import type { CatalogCardImage } from "@/lib/api/catalog";
import { mediaUrl, thumbSrcSet, thumbUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { catalogWholeFrame, type PhotoFraming } from "@/lib/photo-framing";

export function pieceWholeSources(piece: PieceView): { image: CatalogCardImage | null; sources: string[] } {
  const ci = (piece.flatLayMetadata as { catalogImage?: CatalogCardImage } | undefined)?.catalogImage;
  const image = ci?.url && ci.url === piece.imageUrl ? ci : null;
  const sources = [thumbUrl(piece.imageUrl?.trim(), 640), piece.imageUrl, piece.studioImageUrl, piece.thumbnailUrl]
    .map((url) => url?.trim()).filter((url): url is string => !!url);
  return { image, sources: Array.from(new Set(sources)) };
}

export function pieceCardImage(piece: PieceView): { src?: string; srcSet?: string; cover: boolean } {
  const studio = [piece.studioFeedUrl, piece.studioThumbUrl, piece.studioImageUrl].map(url => mediaUrl(url?.trim())).find(Boolean);
  if (studio) return { src: studio, cover: true };
  const raw = piece.thumbnailUrl?.trim() || piece.imageUrl?.trim();
  return { src: thumbUrl(raw, 640), srcSet: thumbSrcSet(raw), cover: false };
}

type PieceCardPhotoProps = {
  piece: PieceView;
  framing: PhotoFraming;
  isPreview: boolean;
};

export function PieceCardPhoto({ piece, framing, isPreview }: PieceCardPhotoProps) {
  if (impersonationMedia(piece.background, piece.owner.id)) {
    return <ImpersonationMedia background={piece.background} ownerId={piece.owner.id} />;
  }

  const { category, subcategory, colorHex, color } = piece;
  const garment = { category, subcategory, colorHex, color };
  if (piece.defaultImage) {
    return <DefaultGarmentPhoto {...garment} framing={framing} alt="" />;
  }

  if (framing === "WHOLE") {
    const { image, sources } = pieceWholeSources(piece);
    if (image || sources.length) {
      const frame = image && (!isPreview || catalogWholeFrame(image)) ? image : null;
      return <CatalogPhoto {...garment} framing="WHOLE" requiredFrame={!!frame} image={frame}
        fallbackUrl={sources[0]} alternatives={sources.slice(1)} alt="" />;
    }
  }

  const crop = piece.studioFeedUrl || piece.studioThumbUrl || piece.studioImageUrl ? null : pieceCatalogCrop(piece);
  if (crop) {
    return <CatalogPhoto {...garment} requiredFrame image={crop}
      alternatives={[piece.thumbnailUrl, piece.imageUrl, pieceCatalogSource(piece)]} alt="" />;
  }

  const image = pieceCardImage(piece);
  if (!image.src) return null;

  // O recorte temporário do cadastro deve mostrar a peça inteira, mesmo no modo tecido.
  const fillFrame = isPreview && framing === "FABRIC" && !image.src.startsWith("blob:");
  return <MediaImage src={image.src} srcSet={image.srcSet}
    fallbackSources={[piece.studioFeedUrl, piece.studioThumbUrl, piece.studioImageUrl, piece.thumbnailUrl, piece.imageUrl, pieceCatalogSource(piece)]}
    sizes="(max-width: 639px) 100vw, 620px" alt="" loading="lazy" decoding="async"
    className={image.cover || fillFrame ? "is-cover" : "is-contain"} />;
}
