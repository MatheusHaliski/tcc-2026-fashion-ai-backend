"use client";
import { mediaUrl } from "@/lib/api/client";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { SealMedallion, type SealDesign } from "@/components/seal-medallion";

/** `kind: "HYPE"` = Selo de Hype FashionAI (RF53): automático, derivado do Hype atual — sem emissor nem vínculo. */
export interface SealBadge { label: string; premium?: boolean; iconUrl?: string | null; tier?: string; owner?: string; name?: string | null; design?: SealDesign | null; linkedPieceIds?: string[]; kind?: "BRAND" | "CELEBRITY" | "LOOK" | "HYPE"; }
/** Converte o "badge" que a API devolve nos vínculos aprovados (tier, owner, premium, name, iconUrl, design) em SealBadge. */
export function toSealBadges(list?: { tier: string; owner: string; premium: boolean; name?: string | null; iconUrl?: string | null; design?: SealDesign | null; linkedPieceIds?: string[] }[] | null): SealBadge[] {
  return (list ?? []).map((b) => ({ label: b.tier === "PECA" ? tr("schemeCard.peca") : "LOOK", premium: b.premium, owner: b.owner, tier: b.tier, name: b.name ?? null, iconUrl: b.iconUrl ?? null, design: b.design ?? null, linkedPieceIds: b.linkedPieceIds ?? [], kind: b.premium ? "CELEBRITY" : "BRAND" }));
}
/** Selos conquistados; cards sem selo não exibem um placeholder vazio. */
export function SealSlot({ seals, size, inline, px }: { seals?: SealBadge[]; size?: "sm"; inline?: boolean; px?: number }) {
  const { t } = useI18n();
  const list = (seals ?? []).slice(0, 3);
  const dim = px ?? (size === "sm" ? 36 : 44);
  if (list.length === 0) return null;
  return (
    <span className={`seal-slot ${inline ? "inline" : ""} ${list.length > 1 ? "many" : ""}`} role="img" aria-label={t("schemeCard.selos", { join: list.map((s) => s.name ?? s.label).join(", ") })}>
      {list.map((s, i) => {
        const title = `${s.name ?? s.label}${s.owner ? ` · @${s.owner}` : ""}${s.tier ? ` · ${s.tier}` : ""}`;
        if (s.design) return <SealMedallion key={i} design={s.design} size={dim} premium={s.premium} title={title} className={s.kind === "HYPE" ? "is-hype" : undefined} />;
        return <span key={i} className={`seal-medallion relative ${s.premium ? "premium" : ""}`} title={title}>{s.iconUrl ? <img src={mediaUrl(s.iconUrl)} alt="" /> : s.label.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "FAI"}</span>;
      })}
    </span>
  );
}

/** Visible award row shared by garment and outfit posts. Missing awards never create placeholders. */
export function CardSealSummary({seals}:{seals?:SealBadge[]}) {
  const {t}=useI18n();
  if(!seals?.length)return null;
  return <div className="card-seals">
    <SealSlot inline px={44} seals={seals}/>
    {seals.length>3&&<span className="card-meta-more" title={seals.slice(3).map(s=>s.name??s.label).join(" · ")} aria-label={t("schemeCard.selos",{join:seals.slice(3).map(s=>s.name??s.label).join(", ")})}>+{seals.length-3}</span>}
  </div>;
}

/** Blocos: selos como placas redondas 1×1 nas cores de sistema — verde marca, vermelho celebridade, amarelo look, laranja Hype. */
export function SealStuds({ seals }: { seals: SealBadge[] }) {
  const { t } = useI18n();
  if (!seals.length) return null;
  const color = (s: SealBadge) => (s.kind === "HYPE" ? "#F58220" : s.kind === "CELEBRITY" || s.premium ? "#C8102E" : s.tier === "LOOK" && !s.owner ? "#F2C200" : "#237841");
  return (
    <div className="seal-studs" aria-label={t("schemeCard.selos_2", { sealsCount: seals.length })}>
      {seals.slice(0, 4).map((s, i) => <span key={i} className="seal-stud" style={{ ["--stud" as string]: color(s) }} title={`${s.name ?? s.label}${s.owner ? ` · @${s.owner}` : ""}`}>{s.design ? <SealMedallion design={s.design} size={30} premium={s.premium} className={s.kind === "HYPE" ? "is-hype" : undefined} /> : null}</span>)}
      <span className="seal-stud-tile">{t("schemeCard.selo", { sealsCount: seals.length })}</span>
    </div>
  );
}

