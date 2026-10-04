"use client";
import { createPortal } from "react-dom";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { DIMENSION_ORDER, displayScore, hypeViewState, levelTone } from "@/lib/hype/model";
import type { HypeDetail, HypeEntity, HypeHistory } from "@/lib/hype/types";
import { Sheet, cn } from "@/components/ui";
import { HypeBreakdown } from "./hype-breakdown";
import { HypeExplanation } from "./hype-explanation";
import { HypeHistoryChart } from "./hype-history-chart";
import { HypeScoreGauge } from "./hype-score-gauge";
import { HypeStateNotice } from "./hype-state-notice";
import { HypeTrendIndicator } from "./hype-trend-indicator";
import { HypeVsStyle } from "./hype-vs-style";

const path = (type: HypeEntity, id: string) => `/api/hype/${type === "PIECE" ? "pieces" : "looks"}/${id}`;

/**
 * Análise completa do Hype (drawer lateral no desktop, folha inferior no celular): score atual, faixa, movimento,
 * gráfico temporal, todos os componentes com a definição, explicação humana e — à parte — a compatibilidade com o estilo
 * de quem vê. Só busca dados quando abre. Vai para o <body> num portal: aberto a partir do verso de um card, o
 * rotateY do card viraria o "containing block" do position:fixed e o painel ficaria preso dentro do card.
 */
export function HypeAnalyticsDrawer(props: { type: HypeEntity; id: string; name: string; open: boolean; onClose: () => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(<DrawerContent {...props} />, document.body);
}

function DrawerContent({ type, id, name, open, onClose }: { type: HypeEntity; id: string; name: string; open: boolean; onClose: () => void }) {
  const { t, relative } = useI18n();
  const { user } = useAuth();
  const detail = useApi<HypeDetail>((signal) => api.get(path(type, id), { signal }), [type, id], { enabled: open });
  const history = useApi<HypeHistory>((signal) => api.get(`${path(type, id)}/history?days=90`, { signal }), [type, id], { enabled: open });
  const d = detail.data;
  const state = hypeViewState(d, { loading: detail.loading, error: !!detail.error });
  return (
    <Sheet open={open} onClose={onClose} title={t("hype.drawer.title", { name })}>
      <div className="hype-drawer">
        {state.kind === "available" ? (
          <div className="hype-drawer-head">
            <HypeScoreGauge value={state.score} size={112} />
            <div className="min-w-0">
              <p className={cn("hype-level-chip", levelTone(state.level))}>{t(`hype.level.${state.level}`)}</p>
              <HypeTrendIndicator summary={d} />
              {d?.momentum && <p className="type-body-sm mt-1">{t("hype.card.trend_line", { momentum: t(`hype.momentum.${d.momentum}`) })}</p>}
              {d?.calculatedAt && <p className={cn("type-caption mt-1", state.stale ? "text-critical" : "text-muted")}>{state.stale ? t("hype.state.stale_hint", { when: relative(d.calculatedAt) }) : t("hype.card.updated", { when: relative(d.calculatedAt) })}</p>}
            </div>
          </div>
        ) : <HypeStateNotice state={state} onRetry={detail.reload} />}
        {d && <HypeVsStyle score={d.score} compatibility={d.compatibility} signedIn={!!user} />}
        <section aria-label={t("hype.history.title")}>
          <h3 className="type-h3 mb-2">{t("hype.history.title")}</h3>
          {history.loading ? <div className="skeleton h-40" aria-hidden /> : <HypeHistoryChart points={history.data?.points ?? []} />}
        </section>
        {d && d.status !== "NOT_CALCULATED" && (
          <section>
            <h3 className="type-h3 mb-2">{t("hype.drawer.breakdown")}</h3>
            <HypeBreakdown type={type} dimensions={d.dimensions} list={DIMENSION_ORDER} hints />
          </section>
        )}
        {d && d.status !== "NOT_CALCULATED" && <HypeExplanation type={type} score={d.score} momentum={d.momentum} reasons={d.reasons ?? []} />}
        {d && !d.publicEligible && d.status !== "NOT_CALCULATED" && <p className="type-caption text-muted">{t("hype.drawer.private")}</p>}
        {d?.algorithmVersion && <p className="type-caption text-faint">{t("hype.drawer.version", { version: d.algorithmVersion })}</p>}
      </div>
    </Sheet>
  );
}
