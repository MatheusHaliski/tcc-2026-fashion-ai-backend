"use client";
import Link from "next/link";
import type { SchemeView } from "@/lib/api/types";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { backgroundStyle, skinStyle } from "@/lib/skins";
import { Avatar } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { AnatomyBody, hasOwnArt, toAnatomyPieces } from "@/components/scheme-anatomies";

export const hypeColor = (h?: number | null) => (h ?? 0) >= 70 ? "var(--status-good)" : (h ?? 0) >= 50 ? "var(--status-warning)" : (h ?? 0) >= 30 ? "var(--status-serious)" : "var(--status-critical)";

/**
 * Card oficial v17 (docs/anatomias): header do autor, container do esquema (foto/grade + peças), rodapé com métricas.
 * layout = "lista" (foto + peças em linhas), "grade" (mosaico 3×N), "lateral" (foto hero + lista lateral).
 */
export interface SealBadge { label: string; premium?: boolean; iconUrl?: string | null; tier?: string; owner?: string; }
/** Espaço reservado para o selo (RF20/RF21): sempre presente na anatomia; mostra os medalhões quando o look conquistou selos. */
export function SealSlot({ seals, size }: { seals?: SealBadge[]; size?: "sm" }) {
  const list = (seals ?? []).slice(0, 3);
  if (list.length === 0) return <span className={`seal-slot empty ${size === "sm" ? "seal-sm" : ""}`} aria-hidden title="espaço reservado para selo" />;
  return (
    <span className={`seal-slot ${list.length > 1 ? "many" : ""}`} role="img" aria-label={`selos: ${list.map((s) => s.label).join(", ")}`}>
      {list.map((s, i) => <span key={i} className={`seal-medallion relative ${s.premium ? "premium" : ""}`} title={`${s.label}${s.owner ? ` · @${s.owner}` : ""}${s.tier ? ` · ${s.tier}` : ""}`}>{s.iconUrl ? <img src={s.iconUrl} alt="" /> : s.label.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "FAI"}</span>)}
    </span>
  );
}

export function SchemeCard({ scheme, layout, href, compact, seals }: { scheme: SchemeView; layout?: "lista" | "grade" | "lateral"; href?: string; compact?: boolean; seals?: SealBadge[] }) {
  const { t, fmtMoney, relative } = useI18n();
  const l = layout ?? (scheme.layoutAnatomy?.toLowerCase().includes("grade") ? "grade" : scheme.layoutAnatomy?.toLowerCase().includes("lateral") ? "lateral" : "lista");
  const items = scheme.items ?? [];
  const cover = mediaUrl(scheme.coverImageUrl) ?? mediaUrl(items[0]?.piece?.imageUrl ?? (items[0]?.imageUrl as string));
  const link = href ?? `/schemes/${scheme.id}`;
  const pieces = items.map((it) => ({ id: it.wardrobeItemId, name: it.piece?.name ?? (it.name as string) ?? it.slot, img: mediaUrl(it.piece?.imageUrl ?? (it.imageUrl as string)), brand: it.piece?.brandName, logo: mediaUrl(it.piece?.brandLogoUrl), price: it.piece?.price, slot: it.slot }));
  return (
    <article className="fai-card" style={skinStyle(scheme.cardSkin)} aria-label={scheme.title}>
      <div className="c-header">
        <span className="c-avatar"><Avatar src={mediaUrl(scheme.owner?.avatarUrl)} name={scheme.owner?.displayName} size={18} /></span>
        <span className="c-meta">@{scheme.owner?.username} · {relative(scheme.publishedAt ?? scheme.createdAt)}</span>
        {scheme.lookDoDia && <span className="badge badge-chalk" title={t("lookbook.daily")}>LDD</span>}
        <span className="c-fav" aria-hidden><FaiIcon id="SOC-06" size={24} active={scheme.viewer?.saved} decorative /></span>
      </div>
      <Link href={link} className="scheme-container block" data-label={scheme.origin === "AUTOPILOTO" ? "autopiloto" : scheme.creationMode === "AI" ? "ia" : "esquema"}>
        <SealSlot seals={seals ?? (scheme.seals ?? []).filter((x) => /^[A-Z0-9_]+:/.test(x)).map((x) => ({ label: x.split(":")[1] ?? x }))} />
        {hasOwnArt(scheme.layoutAnatomy) ? (
          <AnatomyBody scheme={scheme} pieces={toAnatomyPieces(scheme)} />
        ) : l === "grade" ? (
          <div className="grid-pieces" style={backgroundStyle(scheme.background)}>
            {pieces.slice(0, 6).map((p, i) => <div key={i} className="cell">{p.img ? <img src={p.img} alt={p.name} loading="lazy" /> : null}</div>)}
          </div>
        ) : l === "lateral" ? (
          <div className="hero-lateral-row">
            <div className="c-photo" style={backgroundStyle(scheme.background)}>{cover && <img src={cover} alt="" loading="lazy" />}</div>
            <div className="hero-lateral-list">{pieces.slice(0, 4).map((p, i) => <div key={i} className="piece2-sm"><b>{p.name}</b><span>{p.brand ?? p.slot}</span></div>)}</div>
          </div>
        ) : (
          <>
            <div className="c-photo" style={backgroundStyle(scheme.background)}>{cover && <img src={cover} alt="" loading="lazy" />}</div>
            <div className="c-title">{scheme.title}</div>
            {!compact && pieces.slice(0, 4).map((p, i) => (
              <div key={i} className="piece2">
                <span className="logo-chip">{p.logo ? <img src={p.logo} alt="" /> : p.img ? <img src={p.img} alt="" /> : (p.brand ?? "FAI").slice(0, 3).toUpperCase()}</span>
                <span className="ptxt"><span className="l1">{p.name}</span><span className="l2">{[p.brand, p.price != null ? fmtMoney(p.price) : null].filter(Boolean).join(" · ") || p.slot}</span></span>
              </div>
            ))}
          </>
        )}
        {(l !== "lista" || hasOwnArt(scheme.layoutAnatomy)) && <div className="c-title">{scheme.title}</div>}
        <div className="c-row"><span className="k">{t("common.occasion")} · {t("common.style")}</span>{[...(scheme.occasion ?? []), ...(scheme.style ?? [])].join(", ") || "—"}</div>
      </Link>
      <div className="c-foot">
        <span className="metrics tabular"><span title="curtidas">♥ {scheme.counters?.likes ?? 0}</span><span title="comentários">💬 {scheme.counters?.comments ?? 0}</span><span title="remixes">↻ {scheme.counters?.remixes ?? 0}</span></span>
        {scheme.hypeScore != null && <span className="flex items-center gap-1 tabular" title="Hype Score"><span className="hype-bar w-14"><i style={{ width: `${scheme.hypeScore}%`, background: hypeColor(scheme.hypeScore) }} /></span>{Math.round(scheme.hypeScore)}</span>}
      </div>
    </article>
  );
}
