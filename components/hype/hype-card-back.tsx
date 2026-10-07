"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { displayScore, hypeViewState, levelTone } from "@/lib/hype/model";
import { useHypeSummary } from "@/lib/hype/use-hype";
import type { HypeEntity } from "@/lib/hype/types";
import { CardFlipButton } from "@/components/fashion-card";
import { cn } from "@/components/ui";
import { HypeBreakdown } from "./hype-breakdown";
import { HypeStateNotice } from "./hype-state-notice";
import { HypeTrendIndicator } from "./hype-trend-indicator";
import { HypeAnalyticsDrawer } from "./hype-analytics-drawer";
import { HypeBackArt } from "./hype-back-art";
import { MomentContextRows } from "@/components/moments/moment-scores";

/**
 * Verso do card (HYPE ANALYTICS): objetivo analítico — score grande, faixa, movimento, dimensões, leitura do momento,
 * quando foi calculado e o caminho para a análise completa. Sem ações sociais (elas ficam na frente). O fundo é uma arte
 * dinâmica da faixa (HypeBackArt): tímida no sinal baixo, dourada e cintilante no viral — sempre atrás dos dados.
 */
export function HypeCardBack({ type, id, name }: { type: HypeEntity; id: string; name: string }) {
  const { t, relative } = useI18n();
  const { summary, loading, error } = useHypeSummary(type, id);
  const [open, setOpen] = useState(false);
  const state = hypeViewState(summary, { loading, error });
  return (
    <article className={cn("fai-card hype-back", `art-${state.kind === "available" ? state.level.toLowerCase().replace("_", "-") : "none"}`)} aria-label={t("hype.card.back_label", { name })}>
      <HypeBackArt level={state.kind === "available" ? state.level : "NONE"} seed={id} />
      <header className="hype-back-head">
        <span className="min-w-0">
          <span className="hype-back-kicker">{t("hype.card.title")}</span>
          {state.kind === "available" && state.calculatedAt && <span className={cn("hype-back-updated", state.stale && "is-stale")}>{state.stale ? t("hype.state.stale_hint", { when: relative(state.calculatedAt) }) : t("hype.card.updated", { when: relative(state.calculatedAt) })}</span>}
        </span>
        <CardFlipButton side="back" />
      </header>
      <div className="hype-back-body">
        {state.kind === "available" ? (
          <>
            <div className="hype-back-score">
              <b className="hype-back-number tabular">{displayScore(state.score)}</b>
              <span className="hype-back-caption">{t("hype.card.score_caption")}</span>
              <span className={cn("hype-level-chip", levelTone(state.level))}>{t(`hype.level.${state.level}`)}</span>
              <span className="hype-back-move">
                <HypeTrendIndicator summary={summary} />
                {summary?.momentum && <span className="hype-back-momentum">{t("hype.card.trend_line", { momentum: t(`hype.momentum.${summary.momentum}`) })}</span>}
              </span>
            </div>
            <HypeBreakdown type={type} dimensions={summary?.dimensions} />
            {/* Momentos §16/§35 — relevância contextual (MomentMatch + Hype contextual) por Momento ativo; só no verso */}
            <MomentContextRows type={type} id={id} />
          </>
        ) : <HypeStateNotice state={state} />}
      </div>
      <footer className="hype-back-foot">
        <button type="button" className="hype-back-more" onClick={() => setOpen(true)} aria-haspopup="dialog">{t("hype.card.full_analysis")} <span aria-hidden>→</span></button>
      </footer>
      {open && <HypeAnalyticsDrawer type={type} id={id} name={name} open={open} onClose={() => setOpen(false)} />}
    </article>
  );
}
