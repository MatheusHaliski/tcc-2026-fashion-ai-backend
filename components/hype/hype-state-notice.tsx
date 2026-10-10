"use client";
import { useI18n } from "@/lib/i18n/i18n";
import type { HypeViewState } from "@/lib/hype/model";
import { Skeleton } from "@/components/ui";

/** Mensagem dos estados sem número (verso do card e análise completa): carregando, não calculado, dados insuficientes, erro. */
export function HypeStateNotice({ state, onRetry }: { state: HypeViewState; onRetry?: () => void }) {
  const { t, relative } = useI18n();
  if (state.kind === "loading") return <div className="hype-state" aria-busy="true"><Skeleton className="h-10 w-20" /><span className="sr-only">{t("hype.state.loading")}</span></div>;
  if (state.kind === "error") return (
    <div className="hype-state" role="alert"><p className="type-body-sm">{t("hype.state.error")}</p>{onRetry && <button type="button" className="btn btn-sm mt-2" onClick={onRetry}>{t("common.retry")}</button>}</div>
  );
  if (state.kind === "not_calculated") return <div className="hype-state"><p className="hype-state-title">{t("hype.state.not_calculated")}</p><p className="type-caption text-muted">{t("hype.state.not_calculated_hint")}</p></div>;
  if (state.kind === "insufficient") return (
    <div className="hype-state"><p className="hype-state-title">{t("hype.state.insufficient")}</p><p className="type-caption text-muted">{t("hype.state.insufficient_hint")}</p>
      {state.calculatedAt && <p className="type-caption text-faint mt-1">{t("hype.card.updated", { when: relative(state.calculatedAt) })}</p>}</div>
  );
  return null;
}
