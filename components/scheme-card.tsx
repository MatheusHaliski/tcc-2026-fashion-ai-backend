"use client";
import Link from "next/link";
import type { SchemeView } from "@/lib/api/types";
import { mediaUrl, thumbSrcSet, thumbUrl } from "@/lib/api/client";
import { label } from "@/lib/api/taxonomy";
import { useI18n, tr } from "@/lib/i18n/i18n";
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

/** Escala da popularidade (Hype): sem vermelho — nota baixa não é erro, é look novo ou pouco visto. */
export const hypeColor = (h?: number | null) => (h ?? 0) >= 70 ? "var(--thread)" : (h ?? 0) >= 40 ? "var(--chalk)" : "var(--muted)";
/** Faixa qualitativa do Hype mostrada nos cards (o número exato fica no detalhe, com a explicação). */
export const hypeBand = (h?: number | null): "hot" | "rising" | null => (h ?? 0) >= 70 ? "hot" : (h ?? 0) >= 40 ? "rising" : null;
export function HypeBadge({ score }: { score?: number | null }) {
  const { t } = useI18n();
  const band = hypeBand(score);
  if (!band) return null;
  return <span className={`hype-chip is-${band}`} title={t("hype.explain")}>{band === "hot" ? t("hype.hot") : t("hype.rising")}</span>;
}

/**
 * Card oficial v17 (docs/anatomias): header do autor, container do esquema (foto/grade + peças), rodapé com métricas.
 * layout = "lista" (foto + peças em linhas), "grade" (mosaico 3×N), "lateral" (foto hero + lista lateral).
 */
export interface SealBadge { label: string; premium?: boolean; iconUrl?: string | null; tier?: string; owner?: string; name?: string | null; design?: SealDesign | null; linkedPieceIds?: string[]; kind?: "BRAND" | "CELEBRITY" | "LOOK"; }
/** Converte o "badge" que a API devolve nos vínculos aprovados (tier, owner, premium, name, iconUrl, design) em SealBadge. */
export function toSealBadges(list?: { tier: string; owner: string; premium: boolean; name?: string | null; iconUrl?: string | null; design?: SealDesign | null; linkedPieceIds?: string[] }[] | null): SealBadge[] {
  return (list ?? []).map((b) => ({ label: b.tier === "PECA" ? tr("schemeCard.peca") : "LOOK", premium: b.premium, owner: b.owner, tier: b.tier, name: b.name ?? null, iconUrl: b.iconUrl ?? null, design: b.design ?? null, linkedPieceIds: b.linkedPieceIds ?? [], kind: b.premium ? "CELEBRITY" : "BRAND" }));
}
/** Espaço reservado para o selo (RF20/RF21): sempre presente na anatomia; mostra os medalhões quando o look conquistou selos. */
export function SealSlot({ seals, size, inline, px }: { seals?: SealBadge[]; size?: "sm"; inline?: boolean; px?: number }) {
  const { t } = useI18n();
  const list = (seals ?? []).slice(0, 3);
  const dim = px ?? (size === "sm" ? 36 : 44);
  if (list.length === 0) return <span className={`seal-slot empty ${inline ? "inline" : ""} ${size === "sm" ? "seal-sm" : ""}`} style={px ? { width: px, height: px } : undefined} aria-hidden title={t("schemeCard.espaco_reservado_para_selo")} />;
  return (
    <span className={`seal-slot ${inline ? "inline" : ""} ${list.length > 1 ? "many" : ""}`} role="img" aria-label={t("schemeCard.selos", { join: list.map((s) => s.label).join(", ") })}>
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
  const { t } = useI18n();
  const color = (s: SealBadge) => (s.kind === "CELEBRITY" || s.premium ? "#C8102E" : s.tier === "LOOK" && !s.owner ? "#F2C200" : "#237841");
  return (
    <div className="seal-studs" aria-label={t("schemeCard.selos_2", { sealsCount: seals.length })}>
      {seals.length === 0 ? <span className="seal-stud empty" aria-hidden title={t("schemeCard.espaco_reservado_para_selo")} /> : seals.slice(0, 4).map((s, i) => <span key={i} className="seal-stud" style={{ ["--stud" as string]: color(s) }} title={`${s.name ?? s.label}${s.owner ? ` · @${s.owner}` : ""}`}>{s.design ? <SealMedallion design={s.design} size={30} premium={s.premium} /> : null}</span>)}
      <span className="seal-stud-tile">{t("schemeCard.selo", { sealsCount: seals.length })}</span>
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
  const coverRaw = scheme.coverImageUrl ? null : (items[0]?.piece?.imageUrl ?? (items[0]?.imageUrl as string));
  const cover = mediaUrl(scheme.coverImageUrl) ?? thumbUrl(coverRaw, 640);
  const coverSet = coverRaw ? thumbSrcSet(coverRaw) : undefined;
  const link = href ?? `/schemes/${scheme.id}`;
  const pieces = items.map((it) => ({ id: it.wardrobeItemId, name: it.piece?.name ?? (it.name as string) ?? it.slot, img: thumbUrl(it.piece?.imageUrl ?? (it.imageUrl as string), 320), brand: it.piece?.brandName, logo: it.piece?.brandLogoUrl ?? null, price: it.piece?.price, slot: it.slot }));
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
        <span className="c-avatar"><Avatar src={mediaUrl(scheme.owner?.avatarUrl)} name={scheme.owner?.displayName} size={24} /></span>
        <span className="c-meta">@{scheme.owner?.username} · {relative(scheme.publishedAt ?? scheme.createdAt)}</span>
        {scheme.lookDoDia && <span className="badge badge-chalk">{t("lookbook.daily")}</span>}
        {scheme.viewer?.saved && <span className="c-fav" role="img" aria-label={t("common.saved")} title={t("common.saved")}><FaiIcon id="SOC-05" size={20} variant="glyph" decorative /></span>}
      </div>
      <div className="scheme-stage">
      {hasArt && art && <CardArtLayer art={art} />}
      <Link href={link} onClick={openModal} className="scheme-container block" data-anatomy={scheme.layoutAnatomy ?? "LISTA_VERTICAL"} data-label={scheme.origin === "AUTOPILOTO" ? t("schemeCard.madeByAutopilot") : scheme.creationMode === "AI" ? t("schemeCard.madeWithAi") : undefined}>
        {(placement.zone === "COVER_CORNER" || placement.zone === "HEADER") && <SealSlot seals={badges} />}
        {hasOwnArt(scheme.layoutAnatomy) ? (
          <AnatomyBody scheme={scheme} pieces={toAnatomyPieces(scheme)} />
        ) : l === "grade" ? (
          <div className="grid-pieces">
            {pieces.slice(0, 6).map((p, i) => <div key={i} className="cell relative">{p.img ? <img src={p.img} alt={p.name} loading="lazy" /> : null}{pieceSeals(p.id).length > 0 && <span className="absolute bottom-1 right-1"><SealSlot inline px={20} seals={pieceSeals(p.id)} /></span>}</div>)}
          </div>
        ) : l === "lateral" ? (
          <div className="hero-lateral-row">
            <div className="c-photo">{cover && <img src={cover} srcSet={coverSet} sizes="(max-width: 639px) 92vw, 320px" alt="" loading="lazy" decoding="async" style={{ filter: photoFilter }} />}</div>
            <div className="hero-lateral-list">{pieces.slice(0, 4).map((p, i) => <div key={i} className="piece2-sm"><b>{p.name}</b><span>{p.brand ?? p.slot}</span>{pieceSeals(p.id).length > 0 && <SealSlot inline px={20} seals={pieceSeals(p.id)} />}</div>)}</div>
          </div>
        ) : (
          <>
            <div className="c-photo">{cover && <img src={cover} srcSet={coverSet} sizes="(max-width: 639px) 92vw, 320px" alt="" loading="lazy" decoding="async" style={{ filter: photoFilter }} />}</div>
            {titleRow}
            {!compact && pieces.slice(0, expanded ? pieces.length : 4).map((p, i) => (
              <div key={i} className={`piece2 ${onPiece ? "cursor-pointer hover:bg-surface-2" : ""}`} role={onPiece ? "button" : undefined} tabIndex={onPiece ? 0 : undefined}
                onClick={onPiece ? (e) => { e.preventDefault(); e.stopPropagation(); onPiece(p.id); } : undefined} onKeyDown={onPiece ? (e) => { if (e.key === "Enter") { e.preventDefault(); onPiece(p.id); } } : undefined}>
                <span className="logo-chip">{p.brand ? <BrandLogo name={p.brand} src={p.logo} size={26} shape="square" /> : p.img ? <img src={p.img} alt="" /> : "FAI"}</span>
                <span className="ptxt"><span className="l1">{p.name}</span><span className="l2">{[p.brand, p.price != null ? fmtMoney(p.price, "BRL") : null].filter(Boolean).join(" · ") || p.slot}</span></span>
                {pieceSeals(p.id).length > 0 && <SealSlot inline px={22} seals={pieceSeals(p.id)} />}
              </div>
            ))}
          </>
        )}
        {(l !== "lista" || hasOwnArt(scheme.layoutAnatomy)) && titleRow}
        {expanded && scheme.description && <div className="c-row"><span className="k">{t("common.descricao")}</span>{scheme.description}</div>}
        {placement.zone === "STUDS" && <SealStuds seals={badges} />}
        <div className="c-row seal-row"><span className="min-w-0 flex-1"><span className="k">{placement.zone === "META_BLOCK" ? t("schemeCard.selos_3") : ""}{t("common.occasion")} · {t("common.style")}</span>{[...(scheme.occasion ?? []), ...(scheme.style ?? [])].map((x) => label(x)).join(", ") || "—"}</span>{placement.zone === "META_BLOCK" && <SealSlot inline seals={badges} />}</div>
      </Link>
      </div>
      <div className="c-foot">
        <span className="metrics tabular">
          <span className="metric" role="img" aria-label={t("schemeCard.likesCount", { count: scheme.counters?.likes ?? 0 })} title={t("schemeCard.likesCount", { count: scheme.counters?.likes ?? 0 })}><FaiIcon id="SOC-01" size={20} variant="glyph" decorative />{scheme.counters?.likes ?? 0}</span>
          <CommentButton type="SCHEME" id={scheme.id} count={scheme.counters?.comments} title={scheme.title} />
          <span className="metric" role="img" aria-label={t("schemeCard.remixesCount", { count: scheme.counters?.remixes ?? 0 })} title={t("schemeCard.remixesCount", { count: scheme.counters?.remixes ?? 0 })}><FaiIcon id="SOC-04" size={20} variant="glyph" decorative />{scheme.counters?.remixes ?? 0}</span>
          <Generate3DButton targets={scheme.id ? [{ kind: "scheme", id: scheme.id, title: scheme.title }] : []} />
        </span>
        <HypeBadge score={scheme.hypeScore} />
      </div>
      {extra && <div className="c-extra">{extra}</div>}
    </article>
  );
}
