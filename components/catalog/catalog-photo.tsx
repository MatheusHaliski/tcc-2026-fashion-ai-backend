"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { CatalogCardImage, NormRect } from "@/lib/api/catalog";
import type { PieceView } from "@/lib/api/types";
import { cn } from "@/components/ui";
import { tr } from "@/lib/i18n/i18n";
import { mediaUrl } from "@/lib/api/client";
import { catalogWholeFrame, type PhotoFraming } from "@/lib/photo-framing";
import { WholeFramePhoto } from "@/components/catalog/whole-frame-photo";

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
  // altura explícita (o recorte tem a proporção do quadro, então 100/h % do quadro não estica): com height:auto a <img>
  // lazy fica com altura 0 antes de carregar e, deslocada para cima e cortada pelo overflow, nunca entra na tela — e
  // nunca carrega (card vazio)
  return { position: "absolute", width: `${100 / w}%`, height: `${100 / h}%`, maxWidth: "none", maxHeight: "none", left: `${(-crop.x / w) * 100}%`, top: `${(-crop.y / h) * 100}%` };
}

/**
 * Peça criada do catálogo com a foto oficial (nível A, a foto não é copiada): o mesmo recorte semântico do card,
 * enquanto a foto da peça ainda for a oficial (a própria foto da pessoa nunca é recortada por ele).
 */
export function pieceCatalogCrop(p: PieceView): CatalogCardImage | null {
  const ci = (p.flatLayMetadata as { catalogImage?: CatalogCardImage } | undefined)?.catalogImage;
  return ci?.mode === "SEMANTIC_CROP" && ci.crop && ci.url && ci.url === p.imageUrl ? ci : null;
}

/**
 * Foto do card da Busca Catalogada: canônica do pipeline (recorte de tecido ou master processado) ou a foto inteira.
 * Toda peça com foto mostra uma foto: se a canônica não carregar (arquivo processado ausente, servidor da marca fora do ar),
 * tenta a seguinte da lista — `fallbackUrl`, depois `alternatives` (ex.: a foto original da marca) — e só então o
 * `placeholder` (a ilustração da categoria).
 */
export function CatalogPhoto({ image, fallbackUrl, alternatives, placeholder, alt, className, requiredFrame = false, framing = "FABRIC" }: {
  requiredFrame?: boolean; image?: CatalogCardImage | null; fallbackUrl?: string | null; alternatives?: (string | null | undefined)[]; placeholder?: ReactNode; alt: string; className?: string;
  /** WHOLE = Total frame: a peça inteira no quadro (nunca o recorte de tecido); sem a caixa da peça, a foto original inteira contida */
  framing?: PhotoFraming;
}) {
  const whole = framing === "WHOLE" ? catalogWholeFrame(image) : null;
  // Peça inteira sem a peça recortada (foto com modelo, sem caixa): mostra o enquadramento de tecido — nunca a foto
  // original da marca, que traz a pessoa e deixa a peça minúscula no quadro
  const wholeMode = framing === "WHOLE" && (!!whole || !image);
  const crop = !wholeMode && image?.mode === "SEMANTIC_CROP" && image.crop ? image : null;
  const first = wholeMode ? [image?.sourceUrl, image?.mode === "PROCESSED" ? null : image?.url] : [crop ? null : image?.url];
  const original = framing === "WHOLE" && !wholeMode ? [] : [image?.sourceUrl];
  const chain = Array.from(new Set([...first, ...(requiredFrame && !wholeMode ? [] : [fallbackUrl,...original,...(alternatives ?? [])])]
    .map(url => mediaUrl(url?.trim())).filter((u): u is string => !!u && u !== mediaUrl(crop?.url))));
  const key = [image?.url, fallbackUrl, image?.sourceUrl, framing, ...(alternatives ?? [])].join("|");
  const [failed, setFailed] = useState(0);
  const [wholeFailed, setWholeFailed] = useState(false);
  useEffect(() => { setFailed(0); setWholeFailed(false); }, [key]);
  const fail = () => setFailed((n) => n + 1);
  if (whole && !wholeFailed) return <WholeFramePhoto frame={whole} alt={alt} className={className} onFail={() => setWholeFailed(true)} />;
  if (requiredFrame && !wholeMode && (!image || failed > 0 || image.mode === "SEMANTIC_CROP" && !crop)) return <span role="alert" className="type-caption text-muted p-4">{tr("catalog.framingRequiredError")}</span>;
  if (crop && failed === 0) {
    return (
      <span className={cn("catalog-photo is-cropped", className)} style={{ background: crop.background ?? undefined }} data-mode="semantic-crop">
        <img src={mediaUrl(crop.url)} alt={alt} loading="lazy" style={semanticCropStyle(crop.crop!)} onError={fail} />
      </span>
    );
  }
  const src = chain[crop ? failed - 1 : failed];
  if (!src) return placeholder ? <>{placeholder}</> : null;
  const processed = !wholeMode && src === mediaUrl(image?.url) && image?.mode === "PROCESSED";
  return (
    <span className={cn("catalog-photo", processed ? "is-processed" : "is-contained", wholeMode && "is-whole-fallback", className)} data-mode={processed ? "processed" : wholeMode ? "whole-original" : "original"}>
      <img key={src} src={mediaUrl(src)} alt={alt} loading="lazy" onError={fail} />
    </span>
  );
}

/** Official source only belongs to this piece while the selected catalogue image remains unchanged. */
export function pieceCatalogSource(piece: PieceView): string | undefined {
  const image = (piece.flatLayMetadata as { catalogImage?: CatalogCardImage } | undefined)?.catalogImage;
  return image && image.url === piece.imageUrl ? image.sourceUrl ?? undefined : undefined;
}
