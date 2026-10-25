"use client";
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { PieceView } from "@/lib/api/types";
import {HypeBadge} from "@/components/hype/hype-badge";
import {hypeViewState} from "@/lib/hype/model";
import type { HypeEntity, HypeSummary } from "@/lib/hype/types";
import { useI18n } from "@/lib/i18n/i18n";
import { label, CATEGORY_LABEL, subcategoryLabel } from "@/lib/api/taxonomy";
import { FashionCardStats } from "@/components/hype/fashion-card-panel";
import { HypeGuideIcon } from "@/components/hype/hype-guide";
import { BrandLogo } from "@/components/brand-logo";
import { hypePreset } from "@/lib/hype/aura-hype-presets";
import { conservationLabel } from "@/lib/api/piece-references";
import { mediaUrl } from "@/lib/api/client";
import { SealMedallion } from "@/components/seal-medallion";
import type { SealBadge } from "@/components/scheme-card";

type Tab = "info" | "hype";

function InfoIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></svg>;
}

/**
 * Janela segmentada do card: "Info" (atributos da peça — marca, categoria, cor, estilo, ocasião) e "Hype" (matriz dos
 * atributos derivados do Hype, os mesmos do verso). Separa o que a peça É do que a comunidade faz com ela; uma aba por vez
 * mantém o card curto. Teclado de tablist: setas trocam de aba.
 */
export function PieceCardPanels({ piece, summary, initial = "info", auraMode, loading=false, error=false, type="PIECE", summaryFacts=false, infoRows=[], seals }: { piece: Pick<PieceView,"name"> & Partial<Pick<PieceView,"brandName"|"brandLogoUrl"|"category"|"subcategory"|"color"|"colorHex"|"style"|"occasion"|"material"|"size"|"condition"|"estadoConservacao">>; summary?: HypeSummary | null; initial?: Tab;
  /** modelo AURA Hype escolhido na peça: define a disposição da lista de atributos */
  auraMode?: string | null;loading?:boolean;error?:boolean;type?:HypeEntity; summaryFacts?:boolean; infoRows?:[string,ReactNode][];
  /** selos de marca/celebridade da peça: entram na lista Info com o medalhão desenhado pelo emissor na criação do selo */
  seals?: SealBadge[] }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>(initial);
  // a aba inicial acompanha a preferência (a AURA Hype salva no navegador chega depois do 1º render) até a pessoa escolher
  const touched = useRef(false);
  useEffect(() => { if (!touched.current) setTab(initial); }, [initial]);
  const id = useId();
  const list = (values?: string[] | null) => (values ?? []).filter(Boolean).map((v) => label(v)).join(" · ");
  const rows: [string, ReactNode][] = ([
    [t("common.brand"), piece.brandName ? <BrandLogo name={piece.brandName} src={piece.brandLogoUrl} size={18} withName /> : null],
    [t("common.category"), subcategoryLabel(piece.subcategory) || (piece.category ? CATEGORY_LABEL[piece.category] : null)],
    [t("common.color"), piece.color ? <span className="pc-info-color">{piece.colorHex && <i style={{ background: piece.colorHex }} aria-hidden />}{label(piece.color)}</span> : null],
    [t("common.style"), list(piece.style)],
    [t("common.occasion"), list(piece.occasion)],
  ] as [string, ReactNode][]).filter(([key, value]) => !!value && (!summaryFacts || key===t("common.category")));
  if(summaryFacts) {
    if(piece.material) rows.push([t("common.material"),label(piece.material)]);
    if(piece.size) rows.push([t("common.size"),label(piece.size)]);
  }
  // depois de Material e Tamanho: na grade de duas colunas o selo é a 4ª célula, logo abaixo de Material
  const sealTitle = (s: SealBadge) => `${s.name ?? s.label}${s.owner ? ` · @${s.owner}` : ""}${s.tier ? ` · ${s.tier}` : ""}`;
  if (seals?.length) rows.push([t("pieceCard.selo"), <span className="pc-info-seal">{seals.slice(0, 2).map((s, i) => (
    <span key={i} className="pc-info-seal-item">
      {s.design ? <SealMedallion design={s.design} size={30} premium={s.premium} title={sealTitle(s)} />
        : <span className={`seal-medallion ${s.premium ? "premium" : ""}`} title={sealTitle(s)}>{s.iconUrl ? <img src={mediaUrl(s.iconUrl)} alt="" /> : (s.name ?? s.label).replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase()}</span>}
      <span>{s.name ?? s.label}</span>
    </span>))}{seals.length > 2 && <span className="card-meta-more" title={seals.slice(2).map(sealTitle).join(" · ")}>+{seals.length - 2}</span>}</span>]);
  const condition = conservationLabel(piece, t);
  if (condition) rows.push([t("pieceReferences.condition.label"), condition]);
  rows.push(...infoRows);
  const tabs: { key: Tab; icon: ReactNode; text: string }[] = [
    { key: "info", icon: <InfoIcon />, text: t("pieceCard.tab_info") },
    { key: "hype", icon: <HypeGuideIcon kind="score" className="pc-seg-hype" />, text: t("pieceCard.tab_hype") },
  ];
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next: Tab = tab === "info" ? "hype" : "info";
    touched.current = true;
    setTab(next);
    (e.currentTarget.querySelector(`[data-tab="${next}"]`) as HTMLButtonElement | null)?.focus();
  };
  const preset = auraMode && auraMode !== "OFF" ? hypePreset(auraMode) : null;
  return (
    <div className="pc-panels" style={preset ? { "--hype-ink": preset.color, "--hype-secondary": preset.secondary } as CSSProperties : undefined}>
      <div role="tablist" className="pc-seg" aria-label={t("pieceCard.tabs", { name: piece.name })} onKeyDown={onKey}>
        {tabs.map((x) => (
          <button key={x.key} type="button" role="tab" data-tab={x.key} id={`${id}-${x.key}`} aria-selected={tab === x.key} aria-controls={`${id}-panel`}
            tabIndex={tab === x.key ? 0 : -1} className="pc-seg-btn" onClick={(e) => { e.stopPropagation(); touched.current = true; setTab(x.key); }}>
            {x.icon}<span>{x.text}{x.key==="hype"&&<span className="pc-tab-live-score"><HypeBadge state={hypeViewState(summary,{loading,error})} summary={summary}/></span>}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} className="pc-panel">
        {tab === "info"
          ? <dl className="pc-info">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          : <FashionCardStats summary={summary} type={type} layout={preset?.layout} context={piece} />}
      </div>
    </div>
  );
}
