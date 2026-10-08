"use client";
import type { CSSProperties } from "react";
import type { CatalogCardImage, NormRect } from "@/lib/api/catalog";
import type { PieceView } from "@/lib/api/types";
import { cn } from "@/components/ui";

/** Only ratios emitted by the image pipeline; malformed/legacy metadata keeps the portrait frame. */
export function photoAspect(aspect?: string | null): string {
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(aspect ?? "");
  if (!match) return "4 / 5";
  const a = Number(match[1]), b = Number(match[2]);
  return b > 0 && a / b >= 0.25 && a / b <= 4 ? `${a} / ${b}` : "4 / 5";
}

/** Image metadata only applies to the image it was produced for. */
export function piecePhotoAspect(piece: PieceView): string {
  const meta = piece.flatLayMetadata as { studio?: { feed?: { aspect?: string } }; catalogImage?: CatalogCardImage } | undefined;
  if (piece.studioFeedUrl) return photoAspect(meta?.studio?.feed?.aspect);
  if (meta?.catalogImage?.url === piece.imageUrl) return photoAspect(meta?.catalogImage?.aspect);
  return photoAspect();
}

/**
 * Posição da foto original dentro do quadro informado pelo pipeline para mostrar só o recorte semântico, sem esticar: o recorte já tem
 * a proporção do quadro em pixels, então largura = 1/w do quadro e o deslocamento é proporcional a x/w e y/h.
 * Recorte que passa da borda da foto (smartPadding) deixa aparecer o fundo do quadro, pintado com a cor do fundo.
 */
export function semanticCropStyle(crop: NormRect): CSSProperties {
  const w = crop.w > 0 ? crop.w : 1, h = crop.h > 0 ? crop.h : 1;
  return { position: "absolute", width: `${100 / w}%`, height: "auto", maxWidth: "none", left: `${(-crop.x / w) * 100}%`, top: `${(-crop.y / h) * 100}%` };
}

/**
 * Peça criada do catálogo com a foto oficial (nível A, a foto não é copiada): o mesmo recorte semântico do card,
 * enquanto a foto da peça ainda for a oficial (a própria foto da pessoa nunca é recortada por ele).
 */
export function pieceCatalogCrop(p: PieceView): CatalogCardImage | null {
  const ci = (p.flatLayMetadata as { catalogImage?: CatalogCardImage } | undefined)?.catalogImage;
  return ci?.mode === "SEMANTIC_CROP" && ci.crop && ci.url && ci.url === p.imageUrl ? ci : null;
}

/** Foto do card da Busca Catalogada: canônica do pipeline (recorte de tecido ou master processado) ou a foto inteira. */
export function CatalogPhoto({ image, fallbackUrl, alt, className }: { image?: CatalogCardImage | null; fallbackUrl?: string | null; alt: string; className?: string }) {
  if (image?.mode === "SEMANTIC_CROP" && image.crop) {
    return (
      <span className={cn("catalog-photo is-cropped", className)} style={{ background: image.background ?? undefined }} data-mode="semantic-crop">
        <img src={image.url} alt={alt} loading="lazy" style={semanticCropStyle(image.crop)} />
      </span>
    );
  }
  const src = image?.url ?? fallbackUrl;
  if (!src) return null;
  return (
    <span className={cn("catalog-photo", image?.mode === "PROCESSED" ? "is-processed" : "is-contained", className)} data-mode={image?.mode === "PROCESSED" ? "processed" : "original"}>
      <img src={src} alt={alt} loading="lazy" />
    </span>
  );
}
