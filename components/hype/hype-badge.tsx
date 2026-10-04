"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { displayScore, levelTone, type HypeViewState } from "@/lib/hype/model";
import type { HypeSummary } from "@/lib/hype/types";
import { cn } from "@/components/ui";
import { HypeTrendIndicator } from "./hype-trend-indicator";

/**
 * Hype compacto da FRENTE do card ("🔥 82 ↑14%"): discreto — a imagem continua protagonista. Nunca mostra 0 para "sem
 * dados": dados insuficientes e "ainda não calculado" aparecem como "🔥 —" com o motivo para leitor de tela e no title.
 * Erro de rede não polui a frente (o verso explica).
 */
export function HypeBadge({ state, summary, days, className }: { state: HypeViewState; summary?: HypeSummary | null; days?: number; className?: string }) {
  const { t } = useI18n();
  if (state.kind === "error") return null;
  if (state.kind === "loading") return <span className={cn("hype-badge is-loading", className)} aria-busy="true"><span className="sr-only">{t("hype.state.loading")}</span></span>;
  if (state.kind !== "available") {
    const why = state.kind === "insufficient" ? t("hype.state.insufficient") : t("hype.state.not_calculated");
    return <span className={cn("hype-badge is-empty", className)} title={why}><span aria-hidden>🔥 —</span><span className="sr-only">{t("hype.badge.empty", { why })}</span></span>;
  }
  const level = t(`hype.level.${state.level}`);
  return (
    <span className={cn("hype-badge", levelTone(state.level), state.stale && "is-stale", className)} title={state.stale ? t("hype.state.stale") : level}>
      <span aria-hidden>🔥 <b className="tabular">{displayScore(state.score)}</b></span>
      <span className="sr-only">{t("hype.badge.aria", { score: displayScore(state.score), level })}{state.stale ? ` · ${t("hype.state.stale")}` : ""}</span>
      <HypeTrendIndicator summary={summary} days={days} compact />
    </span>
  );
}
