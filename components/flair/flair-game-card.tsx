"use client";
import { useState } from "react";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * Carta FLAIR (FLAIR-UT §3, seção E da prancha): a cópia da peça que a pessoa gerou com "Converter para FLAIR".
 * Frente: nota (OVR) e posição no alto, foto no centro, nome e marca, e os números do Hype em linha (as 7 dimensões do
 * verso do card + o HYP), em 2 colunas de 4 — sem Hype público aparece "—", nunca 0. O nível (Bronze, Prata, Ouro,
 * Especial) é o metal e também vem escrito no rodapé (nunca só pela cor); o acabamento "raro" vem do Hype, não do preço.
 * Verso (↻): atributos de jogo, habilidade, temporada e o que decidiu o nível.
 */
export type FlairTier = "BRONZE" | "PRATA" | "OURO" | "ESPECIAL";
export const FLAIR_TIERS: FlairTier[] = ["ESPECIAL", "OURO", "PRATA", "BRONZE"];
export const HYPE_KEYS = ["POP", "RAR", "ENG", "LON", "TRD", "NOV", "ORI", "HYP"] as const;
const SEASONS = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];
/** Temporada no idioma da pessoa (o motor grava SPRING, SUMMER…). */
export function seasonName(t: (k: string, v?: Record<string, unknown>) => string, season: string) {
  return SEASONS.includes(season) ? t(`pieceArt.season.${season}`) : season;
}

export interface FlairCollectionCard {
  id: string; originType: "PIECE" | "LOOK"; originId: string; season: string; tier: FlairTier; ovr: number; rare: boolean; position: string;
  name: string; brandName?: string | null; imageUrl?: string | null; category?: string | null; subcategory?: string | null;
  hype?: Partial<Record<(typeof HYPE_KEYS)[number], number | null>> | null; stats?: Record<string, number> | null; rarity?: string | null;
  ability?: { code?: string; name?: string; text?: string } | null; priceVerified: boolean; state: string; tradeable: boolean; acquiredVia: string;
  createdAt?: string; basis?: { priceUsed?: number | null; priceVerified?: boolean; cappedByUnverifiedPrice?: boolean } | null;
}

export function FlairGameCard({ card, size = "md", flip = true }: { card: FlairCollectionCard; size?: "sm" | "md" | "lg"; flip?: boolean }) {
  const { t, fmtMoney } = useI18n();
  const [back, setBack] = useState(false);
  const tierName = t(`flairCard.tier.${card.tier}`);
  const label = t("flairCard.aria", { tier: tierName, rare: card.rare ? ` ${t("flairCard.rare")}` : "", ovr: card.ovr, name: card.name, brand: card.brandName ? `, ${card.brandName}` : "" });
  const value = (k: (typeof HYPE_KEYS)[number]) => { const v = card.hype?.[k]; return v == null ? "—" : String(Math.round(v)); };
  return (
    <article className={`fgc fgc-${size} tier-${card.tier.toLowerCase()} ${card.rare ? "is-rare" : ""} ${card.state === "LOCKED_CHALLENGE" ? "is-locked" : ""}`} aria-label={label}>
      {!back ? (
        <div className="fgc-face">
          <div className="fgc-top">
            <span className="fgc-ovr tabular" aria-hidden><b>{card.ovr}</b><small>{card.position}</small></span>
            {card.brandName && <span className="fgc-brand-mark" aria-hidden>{card.brandName.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="fgc-photo">{card.imageUrl ? <img src={mediaUrl(card.imageUrl)} alt="" loading="lazy" decoding="async" /> : null}</div>
          <p className="fgc-name">{card.name}</p>
          <p className="fgc-brand">{card.brandName ?? t("flairCard.semMarca")}</p>
          <dl className="fgc-hype tabular" aria-label={card.hype ? t("flairCard.hypeLabel") : t("flairCard.noHype")}>
            {HYPE_KEYS.map((k) => <div key={k} title={t(`flairCard.hype.${k}`)}><dd>{value(k)}</dd><dt aria-label={t(`flairCard.hype.${k}`)}>{k}</dt></div>)}
          </dl>
          <p className="fgc-foot"><span>{tierName}{card.rare ? ` · ${t("flairCard.rare")}` : ""}</span><span aria-hidden>FAI</span></p>
        </div>
      ) : (
        <div className="fgc-face fgc-back">
          <p className="fgc-back-title">{card.name}</p>
          {card.stats && <ul className="fgc-stats">{Object.entries(card.stats).map(([k, v]) => <li key={k}><span>{k}</span><span className="fgc-bar"><i style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></span><b className="tabular">{v}</b></li>)}</ul>}
          {card.ability?.name && <p className="fgc-ability"><b>{card.ability.name}</b>{card.ability.text ? ` · ${card.ability.text}` : ""}</p>}
          <p className="fgc-meta">{t("flairCard.season", { season: seasonName(t, card.season) })}</p>
          {card.basis?.priceUsed != null && <p className="fgc-meta">{t(card.priceVerified ? "flairCard.priceVerified" : "flairCard.priceTyped", { price: fmtMoney(card.basis.priceUsed, "BRL") })}</p>}
          {card.basis?.cappedByUnverifiedPrice && <p className="fgc-meta">{t("flairCard.unverified")}</p>}
          {card.state === "LOCKED_CHALLENGE" && <p className="fgc-meta">{t("flairCard.locked")}</p>}
        </div>
      )}
      {flip && <button type="button" className="fgc-flip" aria-pressed={back} aria-label={back ? t("flairCard.front") : t("flairCard.back")} title={back ? t("flairCard.front") : t("flairCard.back")} onClick={() => setBack((b) => !b)}>↻</button>}
    </article>
  );
}
