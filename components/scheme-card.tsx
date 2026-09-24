"use client";
import Link from "next/link";
import type { SchemeView } from "@/lib/api/types";
import { mediaUrl } from "@/lib/api/client";
import { label } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import { skinStyle } from "@/lib/skins";
import { containerColorOf, inkOn, photoFilterCss, resolveCardArt, studioOf } from "@/lib/card-art";
import { CardArtLayer } from "@/components/card-art";
import { Avatar } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { Generate3DButton } from "@/components/generate-3d";
import { AnatomyBody, hasOwnArt, sealPlacement, toAnatomyPieces } from "@/components/scheme-anatomies";
import { SealMedallion, type SealDesign } from "@/components/seal-medallion";
import { CommentButton } from "@/components/interactions";
import { useDetailModal } from "@/components/detail-modal";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

export const hypeColor = (h?: number | null) => (h ?? 0) >= 70 ? "var(--status-good)" : (h ?? 0) >= 50 ? "var(--status-warning)" : (h ?? 0) >= 30 ? "var(--status-serious)" : "var(--status-critical)";

/**
 * Card oficial v17 (docs/anatomias): header do autor, container do esquema (foto/grade + peças), rodapé com métricas.
 * layout = "lista" (foto + peças em linhas), "grade" (mosaico 3×N), "lateral" (foto hero + lista lateral).
 */
export interface SealBadge { label: string; premium?: boolean; iconUrl?: string | null; tier?: string; owner?: string; name?: string | null; design?: SealDesign | null; linkedPieceIds?: string[]; kind?: "BRAND" | "CELEBRITY" | "LOOK"; }
/** Converte o "badge" que a API devolve nos vínculos aprovados (tier, owner, premium, name, iconUrl, design) em SealBadge. */
export function toSealBadges(list?: { tier: string; owner: string; premium: boolean; name?: string | null; iconUrl?: string | null; design?: SealDesign | null; linkedPieceIds?: string[] }[] | null): SealBadge[] {
  return (list ?? []).map((b) => ({ label: b.tier === "PECA" ? "PEÇA" : "LOOK", premium: b.premium, owner: b.owner, tier: b.tier, name: b.name ?? null, iconUrl: b.iconUrl ?? null, design: b.design ?? null, linkedPieceIds: b.linkedPieceIds ?? [], kind: b.premium ? "CELEBRITY" : "BRAND" }));
}
/** Espaço reservado para o selo (RF20/RF21): sempre presente na anatomia; mostra os medalhões quando o look conquistou selos. */
export function SealSlot({ seals, size, inline, px }: { seals?: SealBadge[]; size?: "sm"; inline?: boolean; px?: number }) {
  const list = (seals ?? []).slice(0, 3);
  const dim = px ?? (size === "sm" ? 36 : 44);
  if (list.length === 0) return <span className={`seal-slot empty ${inline ? "inline" : ""} ${size === "sm" ? "seal-sm" : ""}`} style={px ? { width: px, height: px } : undefined} aria-hidden title="espaço reservado para selo" />;
  return (
    <span className={`seal-slot ${inline ? "inline" : ""} ${list.length > 1 ? "many" : ""}`} role="img" aria-label={`selos: ${list.map((s) => s.label).join(", ")}`}>
      {list.map((s, i) => {
        const title = `${s.name ?? s.label}${s.owner ? ` · @${s.owner}` : ""}${s.tier ? ` · ${s.tier}` : ""}`;
        if (s.design) return <SealMedallion key={i} design={s.design} size={dim} premium={s.premium} title={title} />;
        return <span key={i} className={`seal-medallion relative ${s.premium ? "premium" : ""}`} title={title}>{s.iconUrl ? <img src={mediaUrl(s.iconUrl)} alt="" /> : s.label.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "FAI"}</span>;
      })}
    </span>
  );
}

/** LEGO: selos como placas redondas 1×1 nas cores de sistema — verde marca, vermelho celebridade, amarelo look. */
export function SealStuds({ seals }: { seals: SealBadge[] }) {
  const color = (s: SealBadge) => (s.kind === "CELEBRITY" || s.premium ? "#C8102E" : s.tier === "LOOK" && !s.owner ? "#F2C200" : "#237841");
  return (
    <div className="seal-studs" aria-label={`${seals.length} selos`}>
      {seals.length === 0 ? <span className="seal-stud empty" aria-hidden title="espaço reservado para selo" /> : seals.slice(0, 4).map((s, i) => <span key={i} className="seal-stud" style={{ ["--stud" as string]: color(s) }} title={`${s.name ?? s.label}${s.owner ? ` · @${s.owner}` : ""}`}>{s.design ? <SealMedallion design={s.design} size={30} premium={s.premium} /> : null}</span>)}
      <span className="seal-stud-tile">{seals.length} selo{seals.length === 1 ? "" : "s"}</span>
    </div>
  );
}

export function SchemeCard({ scheme, layout, href, compact, seals, expanded, onPiece, extra }: { scheme: SchemeView; layout?: "lista" | "grade" | "lateral"; href?: string; compact?: boolean; seals?: SealBadge[]; expanded?: boolean; onPiece?: (pieceId: string) => void; extra?: ReactNode }) {
  const detail = useDetailModal();
  // Clique no card abre o modal com o esquema ampliado (RF7); a página continua acessível por "Abrir página"/nova aba.
  const openModal = (e: React.MouseEvent) => { if (!detail || expanded || href === "#" || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); detail.openScheme(scheme.id); };
  const { t, fmtMoney, relative } = useI18n();
  // anatomias da Seção A: LISTA_VERTICAL → lista, GRADE_PECAS → grade, HERO_LISTA (foto hero + lista lateral) → lateral
  const anat = (scheme.layoutAnatomy ?? "").toUpperCase();
  const l = layout ?? (anat.includes("GRADE") ? "grade" : anat === "HERO_LISTA" || anat.includes("LATERAL") ? "lateral" : "lista");
  const items = scheme.items ?? [];
  const cover = mediaUrl(scheme.coverImageUrl) ?? mediaUrl(items[0]?.piece?.imageUrl ?? (items[0]?.imageUrl as string));
  const link = href ?? `/schemes/${scheme.id}`;
  const pieces = items.map((it) => ({ id: it.wardrobeItemId, name: it.piece?.name ?? (it.name as string) ?? it.slot, img: mediaUrl(it.piece?.imageUrl ?? (it.imageUrl as string)), brand: it.piece?.brandName, logo: it.piece?.brandLogoUrl ?? null, price: it.piece?.price, slot: it.slot }));
  // Posição do selo segue a anatomia escolhida na etapa 4 (SEAL_PLACEMENT); o espaço fica reservado mesmo sem selo.
  const placement = sealPlacement(scheme.layoutAnatomy ?? (l === "grade" ? "GRADE_PECAS" : l === "lateral" ? "HERO_LISTA" : "LISTA_VERTICAL"));
  const badges: SealBadge[] = seals ?? (scheme.sealBadges?.length ? toSealBadges(scheme.sealBadges) : (scheme.seals ?? []).filter((x) => /^[A-Z0-9_]+:/.test(x)).map((x) => ({ label: x.split(":")[1] ?? x })));
  const pieceSeals = (id?: string) => (id ? badges.filter((b) => b.tier === "PECA" && (b.linkedPieceIds ?? []).includes(id)) : []);
  // Arte do Background Studio fica no palco do card, atrás do container (passe-partout) — nunca sobre a foto do conjunto.
  const ownArt = hasOwnArt(scheme.layoutAnatomy);
  const studio = studioOf(scheme.background);
  const art = ownArt ? null : resolveCardArt(scheme.background, { season: scheme.season });
  const hasArt = !!art && art.kind !== "none";
  const boxColor = containerColorOf(scheme.cardSkin, scheme.containerColor ?? studio.container?.color);
  const manualBox = !!(scheme.containerColor ?? studio.container?.color);
  const photoFilter = photoFilterCss(studio.photo?.filters);
  const stageVars = hasArt ? ({ "--container-bg": boxColor, ...(manualBox ? { "--card-ink": inkOn(boxColor) } : {}) } as React.CSSProperties) : undefined;
  const titleRow = <div className="c-title seal-row"><span className="min-w-0 flex-1">{scheme.title}</span>{placement.zone === "TITLE_ROW" && <SealSlot inline seals={badges} />}</div>;
  return (
    <article className={`fai-card ${hasArt ? "has-art" : ""}`} style={{ ...skinStyle(scheme.cardSkin), ...stageVars }} aria-label={scheme.title} data-art={art?.label}>
      <div className="c-header">
        <span className="c-avatar"><Avatar src={mediaUrl(scheme.owner?.avatarUrl)} name={scheme.owner?.displayName} size={18} /></span>
        <span className="c-meta">@{scheme.owner?.username} · {relative(scheme.publishedAt ?? scheme.createdAt)}</span>
        {scheme.lookDoDia && <span className="badge badge-chalk" title={t("lookbook.daily")}>LDD</span>}
        <span className="c-fav" aria-hidden><FaiIcon id="SOC-06" size={24} active={scheme.viewer?.saved} decorative /></span>
      </div>
      <div className="scheme-stage">
      {hasArt && art && <CardArtLayer art={art} />}
      <Link href={link} onClick={openModal} className="scheme-container block" data-anatomy={scheme.layoutAnatomy ?? "LISTA_VERTICAL"} data-label={scheme.origin === "AUTOPILOTO" ? "autopiloto" : scheme.creationMode === "AI" ? "ia" : "esquema"}>
        {(placement.zone === "COVER_CORNER" || placement.zone === "HEADER") && <SealSlot seals={badges} />}
        {hasOwnArt(scheme.layoutAnatomy) ? (
          <AnatomyBody scheme={scheme} pieces={toAnatomyPieces(scheme)} />
        ) : l === "grade" ? (
          <div className="grid-pieces">
            {pieces.slice(0, 6).map((p, i) => <div key={i} className="cell relative">{p.img ? <img src={p.img} alt={p.name} loading="lazy" /> : null}{pieceSeals(p.id).length > 0 && <span className="absolute bottom-1 right-1"><SealSlot inline px={20} seals={pieceSeals(p.id)} /></span>}</div>)}
          </div>
        ) : l === "lateral" ? (
          <div className="hero-lateral-row">
            <div className="c-photo">{cover && <img src={cover} alt="" loading="lazy" style={{ filter: photoFilter }} />}</div>
            <div className="hero-lateral-list">{pieces.slice(0, 4).map((p, i) => <div key={i} className="piece2-sm"><b>{p.name}</b><span>{p.brand ?? p.slot}</span>{pieceSeals(p.id).length > 0 && <SealSlot inline px={20} seals={pieceSeals(p.id)} />}</div>)}</div>
          </div>
        ) : (
          <>
            <div className="c-photo">{cover && <img src={cover} alt="" loading="lazy" style={{ filter: photoFilter }} />}</div>
            {titleRow}
            {!compact && pieces.slice(0, expanded ? pieces.length : 4).map((p, i) => (
              <div key={i} className={`piece2 ${onPiece ? "cursor-pointer hover:bg-surface-2" : ""}`} role={onPiece ? "button" : undefined} tabIndex={onPiece ? 0 : undefined}
                onClick={onPiece ? (e) => { e.preventDefault(); e.stopPropagation(); onPiece(p.id); } : undefined} onKeyDown={onPiece ? (e) => { if (e.key === "Enter") { e.preventDefault(); onPiece(p.id); } } : undefined}>
                <span className="logo-chip">{p.brand ? <BrandLogo name={p.brand} src={p.logo} size={26} shape="square" /> : p.img ? <img src={p.img} alt="" /> : "FAI"}</span>
                <span className="ptxt"><span className="l1">{p.name}</span><span className="l2">{[p.brand, p.price != null ? fmtMoney(p.price) : null].filter(Boolean).join(" · ") || p.slot}</span></span>
                {pieceSeals(p.id).length > 0 && <SealSlot inline px={22} seals={pieceSeals(p.id)} />}
              </div>
            ))}
          </>
        )}
        {(l !== "lista" || hasOwnArt(scheme.layoutAnatomy)) && titleRow}
        {expanded && scheme.description && <div className="c-row"><span className="k">Descrição</span>{scheme.description}</div>}
        {placement.zone === "STUDS" && <SealStuds seals={badges} />}
        <div className="c-row seal-row"><span className="min-w-0 flex-1"><span className="k">{placement.zone === "META_BLOCK" ? "Selos · " : ""}{t("common.occasion")} · {t("common.style")}</span>{[...(scheme.occasion ?? []), ...(scheme.style ?? [])].map((x) => label(x)).join(", ") || "—"}</span>{placement.zone === "META_BLOCK" && <SealSlot inline seals={badges} />}</div>
      </Link>
      </div>
      <div className="c-foot">
        <span className="metrics tabular"><span title="curtidas">♥ {scheme.counters?.likes ?? 0}</span><CommentButton type="SCHEME" id={scheme.id} count={scheme.counters?.comments} title={scheme.title} /><span title="remixes">↻ {scheme.counters?.remixes ?? 0}</span><Generate3DButton targets={scheme.id ? [{ kind: "scheme", id: scheme.id, title: scheme.title }] : []} /></span>
        {scheme.hypeScore != null && <span className="flex items-center gap-1 tabular" title="Hype Score"><span className="hype-bar w-14"><i style={{ width: `${scheme.hypeScore}%`, background: hypeColor(scheme.hypeScore) }} /></span>{Math.round(scheme.hypeScore)}</span>}
      </div>
      {extra && <div className="c-extra">{extra}</div>}
    </article>
  );
}
