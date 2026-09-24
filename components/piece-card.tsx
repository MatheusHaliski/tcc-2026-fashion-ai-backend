"use client";
import Link from "next/link";
import type { PieceView } from "@/lib/api/types";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { FaiIcon } from "@/components/fai-icon";
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
  const img = studio ?? mediaUrl(piece.thumbnailUrl ?? piece.imageUrl);
  const body = (
    <>
      <div className="c-photo" style={{ aspectRatio: "1" }}>
        {img ? <img src={img} alt={piece.name} loading="lazy" style={studio ? { objectFit: "cover" } : { objectFit: "contain", padding: 8 }} /> : null}
        {(zone === "COVER_CORNER" || zone === "HEADER") && <SealSlot size="sm" seals={seals} />}
        {!piece.disponivel && <span className="badge absolute left-2 top-2">{t("common.unavailable")}</span>}
        {piece.favorite && <span className="absolute bottom-2 right-2"><FaiIcon id="SOC-06" size={24} active decorative /></span>}
      </div>
      <div className="c-title seal-row"><span className="min-w-0 flex-1">{piece.name}</span>{zone === "TITLE_ROW" && <SealSlot inline size="sm" seals={seals} />}</div>
      {zone === "STUDS" && <SealStuds seals={seals ?? []} />}
      <div className="c-row flex items-center gap-2">
        <span aria-hidden className="inline-block h-3 w-3 rounded-full border border-line-soft" style={{ background: piece.colorHex ?? "#ccc" }} />
        <span className="type-data text-muted">{label(piece.color)}</span>
        <span className="ml-auto type-data text-muted">{piece.price != null ? fmtMoney(piece.price) : piece.size?.toUpperCase()}</span>
      </div>
      <div className="c-row seal-row">{piece.brandName && <BrandLogo name={piece.brandName} src={piece.brandLogoUrl} size={26} className="mr-2" />}<span className="min-w-0 flex-1"><span className="k">{[label(piece.subcategory) || CATEGORY_LABEL[piece.category], piece.brandName, label(piece.sex?.toLowerCase())].filter(Boolean).join(" · ") || "—"}{zone === "META_BLOCK" ? " · selos" : ""}</span>{(piece.occasion ?? []).map(label).join(", ") || "—"}</span>{zone === "META_BLOCK" && <SealSlot inline size="sm" seals={seals} />}</div>
    </>
  );
  return (
    <article className={`fai-card relative ${selected ? "ring-2 ring-mark" : ""}`} aria-label={piece.name}>
      {selectable ? (
        <button type="button" className="text-left" aria-pressed={selected} onClick={() => onSelect?.(piece)}>{body}</button>
      ) : (
        <Link href={href ?? `/pieces/${piece.id}`} onClick={openModal}>{body}</Link>
      )}
      {(onFavorite || onAvailability) && (
        <div className="c-foot">
          {onFavorite && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onFavorite(piece)} aria-pressed={piece.favorite}><FaiIcon id="SOC-06" size={24} active={piece.favorite} /></button>}
          {onAvailability && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAvailability(piece)} aria-pressed={piece.disponivel}><FaiIcon id={piece.disponivel ? "SOC-14" : "SOC-15"} size={24} active={piece.disponivel} /></button>}
          <span className="ml-auto type-data text-faint tabular">{piece.wearCount} {t("closet.wearCount")}</span>
        </div>
      )}
      {extra && <div className="c-extra">{extra}</div>}
    </article>
  );
}
