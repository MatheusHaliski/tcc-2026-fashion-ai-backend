"use client";
import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { FashionCardStats } from "@/components/hype/fashion-card-panel";
import { HypeBadge } from "@/components/hype/hype-badge";
import { HypeGuideIcon } from "@/components/hype/hype-guide";
import { CATEGORY_LABEL, subcategoryLabel } from "@/lib/api/taxonomy";
import { hypeViewState, levelForScore } from "@/lib/hype/model";
import type { HypeDimension, HypeSummary } from "@/lib/hype/types";
import { useI18n } from "@/lib/i18n/i18n";
import { STAT_META } from "./flair-card";
import { seasonName, type FlairCollectionCard, type HYPE_KEYS } from "./flair-game-card";

type Tab = "info" | "hype";
type HypeKey = (typeof HYPE_KEYS)[number];
/** Dimensões do HypeSummary (lib/hype/types.ts) que o snapshot da carta guarda com nomes curtos. */
const DIMENSION_OF: Partial<Record<HypeKey, HypeDimension>> = { POP: "POPULARITY", ENG: "ENGAGEMENT", TRD: "TREND", ORI: "ORIGINALITY", RAR: "RARITY", LON: "LONGEVITY", NOV: "NOVELTY" };

/**
 * HypeSummary sintetizado do snapshot da carta, para a aba Hype usar a MESMA matriz do card comum (FashionCardStats).
 * Sem snapshot (ou só nulos) vira INSUFFICIENT_DATA: a matriz mostra "—" em cada atributo, nunca 0.
 */
export function flairHypeSummary(hype: FlairCollectionCard["hype"]): HypeSummary {
  const dimensions: Partial<Record<HypeDimension, number>> = {};
  for (const [key, dimension] of Object.entries(DIMENSION_OF) as [HypeKey, HypeDimension][]) {
    const value = hype?.[key];
    if (value != null) dimensions[dimension] = value;
  }
  const score = hype?.HYP ?? null;
  if (score == null && !Object.keys(dimensions).length) return { status: "INSUFFICIENT_DATA" };
  return { status: "AVAILABLE", score, level: levelForScore(score), dimensions };
}

/** Os atributos reais de jogo (EDGE, RANGE, CLOUT, GLOW, ART, SYNC) numa linha da aba Info; ausentes aparecem como "—". */
export function FlairStatList({ stats }: { stats: FlairCollectionCard["stats"] }) {
  const { t } = useI18n();
  const keys = Object.keys(stats ?? {}).length ? Object.keys(stats!) : Object.keys(STAT_META);
  return (
    <span className="fpc-stats tabular" aria-label={t("flairCard.statsLabel")}>
      {keys.map((k) => <span key={k} className="fpc-stat" title={STAT_META[k]?.hint ?? k}><b>{stats?.[k] == null ? "—" : Math.round(stats[k])}</b><abbr>{k}</abbr></span>)}
    </span>
  );
}

function InfoIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></svg>;
}

/** Linhas da aba Info da carta: marca e categoria (como no card comum) + nível, nota, posição, atributos, habilidade, temporada e preço. */
export function useFlairInfoRows(card: FlairCollectionCard): [string, ReactNode][] {
  const { t, fmtPrice } = useI18n();
  const tierName = t(`flairCard.tier.${card.tier}`);
  const rows: [string, ReactNode][] = [
    [t("common.brand"), card.brandName ? <BrandLogo name={card.brandName} size={18} withName /> : t("flairCard.semMarca")],
    [t("common.category"), subcategoryLabel(card.subcategory ?? undefined) || (card.category ? CATEGORY_LABEL[card.category] : null)],
    [t("flairCard.row.tier"), `${tierName}${card.rare ? ` · ${t("flairCard.rare")}` : ""}`],
    [t("flairCard.row.ovr"), <b key="ovr" className="tabular">{card.ovr}</b>],
    [t("flairCard.row.position"), card.position],
    [t("flairCard.statsLabel"), <FlairStatList key="stats" stats={card.stats} />],
    [t("flairCard.row.ability"), card.ability?.name ? <><b>{card.ability.name}</b>{card.ability.text ? ` · ${card.ability.text}` : ""}</> : null],
    [t("flairCard.row.season"), seasonName(t, card.season)],
    [t("common.price"), card.basis?.priceUsed != null ? <>
      {t(card.priceVerified ? "flairCard.row.priceVerified" : "flairCard.row.priceTyped", { price: fmtPrice(card.basis.priceUsed) })}
      {card.basis.cappedByUnverifiedPrice && <small className="fpc-note">{t("flairCard.unverified")}</small>}
    </> : null],
  ];
  return rows.filter(([, value]) => value != null && value !== "");
}

/**
 * Janela segmentada da carta FLAIR: o MESMO DOM e as mesmas classes de PieceCardPanels (.pc-panels/.pc-seg/.pc-seg-btn/
 * .pc-panel/.pc-info + FashionCardStats), para o estilo ser idêntico ao do card comum. Difere só nas linhas de Info (as
 * do jogo, sem estado de conservação) e no Hype, que vem do snapshot da carta e não de /api/hype. Setas trocam de aba.
 */
/** `interactive=false` (carta dentro de um botão, como no escolhedor de cartas): a janela fica fixa na aba inicial, sem botões aninhados. */
export function FlairPieceCardPanels({ card, initial = "hype", interactive = true }: { card: FlairCollectionCard; initial?: Tab; interactive?: boolean }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>(initial);
  const id = useId();
  const rows = useFlairInfoRows(card);
  const summary = flairHypeSummary(card.hype);
  const tabs: { key: Tab; icon: ReactNode; text: string }[] = [
    { key: "info", icon: <InfoIcon />, text: t("pieceCard.tab_info") },
    { key: "hype", icon: <HypeGuideIcon kind="score" className="pc-seg-hype" />, text: t("pieceCard.tab_hype") },
  ];
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next: Tab = tab === "info" ? "hype" : "info";
    setTab(next);
    (e.currentTarget.querySelector(`[data-tab="${next}"]`) as HTMLButtonElement | null)?.focus();
  };
  return (
    <div className="pc-panels">
      <div role={interactive ? "tablist" : undefined} className="pc-seg" aria-label={interactive ? t("pieceCard.tabs", { name: card.name }) : undefined} onKeyDown={interactive ? onKey : undefined}>
        {tabs.map((x) => {
          const inner = <>{x.icon}<span>{x.text}{x.key === "info" && <span className="pc-tab-live-score"><HypeBadge state={hypeViewState(summary)} summary={summary} /></span>}</span></>;
          if (!interactive) return <span key={x.key} role="presentation" data-tab={x.key} aria-selected={tab === x.key} className="pc-seg-btn">{inner}</span>;
          return (
            <button key={x.key} type="button" role="tab" data-tab={x.key} id={`${id}-${x.key}`} aria-selected={tab === x.key} aria-controls={`${id}-panel`}
              tabIndex={tab === x.key ? 0 : -1} className="pc-seg-btn" onClick={(e) => { e.stopPropagation(); setTab(x.key); }}>{inner}</button>
          );
        })}
      </div>
      <div role={interactive ? "tabpanel" : undefined} id={`${id}-panel`} aria-labelledby={interactive ? `${id}-${tab}` : undefined} className="pc-panel">
        {tab === "info"
          ? <dl className="pc-info">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          : <FashionCardStats summary={summary} type="PIECE" context={{ name: card.name, brandName: card.brandName, category: card.category ?? undefined, subcategory: card.subcategory }} />}
      </div>
    </div>
  );
}
