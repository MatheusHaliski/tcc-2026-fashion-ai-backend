"use client";
import Link from "next/link";
import type { PieceView } from "@/lib/api/types";
import { mediaUrl, thumbSrcSet, thumbUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { FaiIcon } from "@/components/fai-icon";
import { Generate3DButton } from "@/components/generate-3d";
import { SealSlot, SealStuds, type SealBadge } from "@/components/scheme-card";
import { pieceSealPlacement } from "@/components/scheme-anatomies";
import { useDetailModal } from "@/components/detail-modal";
import { label, CATEGORY_LABEL } from "@/lib/api/taxonomy";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

/** Card de peça (anatomia "peça de roupa" v17): foto, nome editorial, cor com nome escrito (acessibilidade para daltônicos), estado. */
export function PieceCard({ piece, href, onFavorite, onAvailability, selectable, selected, onSelect, seals, anatomy, extra }: {
  piece: PieceView; href?: string; onFavorite?: (p: PieceView) => void; onAvailability?: (p: PieceView) => void; selectable?: boolean; selected?: boolean; onSelect?: (p: PieceView) => void; seals?: SealBadge[]; anatomy?: string | null;
  /** legendas e ações extras da lista — renderizadas DENTRO do card (nunca soltas abaixo dele) */
  extra?: ReactNode;
}) {
  const detail = useDetailModal();
  const openModal = (e: React.MouseEvent) => { if (!detail || href || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); detail.openPiece(piece.id); };
  // Seção C: a posição do selo segue a anatomia da peça (padrão: "Categoria · marca · sexo · selos").
  const zone = pieceSealPlacement(anatomy ?? (piece as { background?: { anatomy?: string } }).background?.anatomy).zone;
  const { t, fmtMoney } = useI18n();
  // RF4 · Estúdio: com foto de estúdio, o card mostra a foto de produto de ponta a ponta (fundo faz parte da imagem)
  const studio = mediaUrl(piece.studioThumbUrl ?? piece.studioImageUrl);
  const raw = piece.thumbnailUrl ?? piece.imageUrl;
  const img = studio ?? thumbUrl(raw, 640);
  const srcSet = studio ? undefined : thumbSrcSet(raw);
  const body = (
    <>
      <div className="c-photo" style={{ aspectRatio: "1" }}>
        {img ? <img src={img} srcSet={srcSet} sizes="(max-width: 639px) 50vw, 240px" alt={piece.name} loading="lazy" decoding="async" style={studio ? { objectFit: "cover" } : { objectFit: "contain", padding: 8 }} /> : null}
        {(zone === "COVER_CORNER" || zone === "HEADER") && <SealSlot size="sm" seals={seals} />}
        {!piece.disponivel && <span className="badge absolute left-2 top-2">{t("common.unavailable")}</span>}
        {piece.favorite && <span className="absolute bottom-2 right-2"><FaiIcon id="SOC-06" size={24} active decorative /></span>}
      </div>
      <span className="c-kicker" style={{ padding: "10px 12px 0" }}>{t("anatomy.pieceKicker", { category: CATEGORY_LABEL[piece.category] ?? label(piece.subcategory) })}</span>
      <div className="c-title seal-row" style={{ paddingTop: 2 }}><span className="min-w-0 flex-1">{piece.name}</span>{zone === "TITLE_ROW" && <SealSlot inline size="sm" seals={seals} />}</div>
      {zone === "STUDS" && <SealStuds seals={seals ?? []} />}
      <div className="c-row piece-meta">
        <span className="piece-brand">{piece.brandName ? <BrandLogo name={piece.brandName} src={piece.brandLogoUrl} size={22} withName /> : <span className="text-muted">{label(piece.subcategory) || CATEGORY_LABEL[piece.category]}</span>}</span>
        {piece.price != null && <span className="type-data tabular">{fmtMoney(piece.price, "BRL")}</span>}
      </div>
      <div className="c-row piece-meta">
        <span className="flex min-w-0 items-center gap-2"><span aria-hidden className="piece-swatch" style={{ background: piece.colorHex ?? "#ccc" }} /><span className="truncate">{label(piece.color)}</span>{piece.brandName && <span className="truncate text-muted">· {label(piece.subcategory) || CATEGORY_LABEL[piece.category]}</span>}</span>
        {zone === "META_BLOCK" && <SealSlot inline size="sm" seals={seals} />}
      </div>
    </>
  );
  return (
    <article className={`fai-card relative ${selected ? "ring-2 ring-mark" : ""}`} aria-label={piece.name}>
      {selectable ? (
        <button type="button" className="text-left" aria-pressed={selected} onClick={() => onSelect?.(piece)}>{body}</button>
      ) : (
        <Link href={href ?? `/pieces/${piece.id}`} onClick={openModal}>{body}</Link>
      )}
      {!selectable && (
        <div className="c-foot">
          {onFavorite && <button type="button" className="metric metric-btn" onClick={() => onFavorite(piece)} aria-pressed={piece.favorite} aria-label={piece.favorite ? t("pieceCard.unfavorite") : t("pieceCard.favorite")} title={piece.favorite ? t("pieceCard.unfavorite") : t("pieceCard.favorite")}><FaiIcon id="SOC-06" size={20} variant="glyph" decorative /></button>}
          {onAvailability && <button type="button" className="metric metric-btn" onClick={() => onAvailability(piece)} aria-pressed={piece.disponivel} aria-label={piece.disponivel ? t("pieceCard.markUnavailable") : t("pieceCard.markAvailable")} title={piece.disponivel ? t("pieceCard.markUnavailable") : t("pieceCard.markAvailable")}><FaiIcon id={piece.disponivel ? "SOC-14" : "SOC-15"} size={20} variant="glyph" decorative /></button>}
          <Generate3DButton targets={piece.id ? [{ kind: "piece", id: piece.id, title: piece.name }] : []} />
          {piece.wearCount > 0 && <span className="ml-auto type-caption text-muted tabular">{t("pieceCard.worn", { count: piece.wearCount })}</span>}
        </div>
      )}
      {extra && <div className="c-extra">{extra}</div>}
    </article>
  );
}
