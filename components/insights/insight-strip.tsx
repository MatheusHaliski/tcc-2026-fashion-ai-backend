"use client";
import { useId, useState } from "react";
import { api, qs } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { isPublicInsightContext, type Insight, type InsightContext, type InsightParams, type InsightsResponse } from "@/lib/insights/types";
import { Skeleton, cn } from "@/components/ui";
import { InsightCard } from "./insight-card";

/**
 * Faixa de insights dinâmicos (RF53) no topo de cada aba com análise: 2–5 cards curtos gerados a partir dos dados do
 * contexto (Hype v2, uso, cápsula, DNA, ranking público). Contextos EXPLORER_* são públicos (anônimos sem login); os
 * pessoais só aparecem com sessão e podem ter o texto reescrito pela IA ("Reescrever com IA" — o número nunca muda).
 * `preset` mostra insights que já vieram em outra resposta (ex.: o Autopiloto) sem buscar de novo; `collapsible`
 * começa fechada e só busca ao abrir (telas cheias, como o guarda-roupa).
 */
export function InsightStrip({ context, params, preset, collapsible, className }: {
  context: InsightContext; params?: InsightParams; preset?: Insight[] | null; collapsible?: boolean; className?: string;
}) {
  const { t, relative } = useI18n(); const { user } = useAuth();
  const id = useId();
  const pub = isPublicInsightContext(context);
  const [open, setOpen] = useState(!collapsible);
  const [withAi, setWithAi] = useState(false);
  const canAi = !pub && !!user;
  const query = qs({ context, ...params, withAi: canAi && withAi ? "true" : "" });
  const { data, loading, error, reload } = useApi<InsightsResponse>((signal) => api.get(`/api/insights${query}`, { signal, anonymous: pub && !user }),
    [query, !!user], { enabled: open && !preset && (pub || !!user) });
  if (!pub && !user) return null;
  const items = (preset ?? data?.items ?? []).slice(0, 5);
  const meta = preset ? null : data;
  const body = !preset && error && !data ? (
    <div className="insight-error" role="alert">
      <p>{t("insights.error")}</p>
      <button type="button" className="btn btn-sm" onClick={reload}>{t("common.retry")}</button>
    </div>
  ) : !preset && loading && !data ? (
    <ul className="insight-list" aria-busy="true" aria-label={t("insights.loading")}>
      {[0, 1, 2].map((i) => <li key={i} className="insight-card is-skeleton"><Skeleton className="h-3 w-20" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-10" /></li>)}
    </ul>
  ) : items.length === 0 ? <p className="insight-empty">{t("insights.empty")}</p> : (
    <ul className="insight-list" aria-busy={loading || undefined}>{items.map((item, i) => <InsightCard key={`${item.code}-${i}`} item={item} />)}</ul>
  );
  const foot = [meta?.generatedAt ? t("insights.updated", { when: relative(meta.generatedAt) }) : null, meta?.algorithmVersion ? t("insights.algorithm", { version: meta.algorithmVersion }) : null,
    meta?.source ? t(meta.source === "ia" ? "insights.source.ia" : "insights.source.local") : null].filter(Boolean).join(" · ");
  return (
    <section className={cn("insight-strip", className)} aria-labelledby={`${id}-h`} data-context={context}>
      <header className="insight-head">
        <div className="min-w-0">
          <h2 id={`${id}-h`} className="insight-heading">{t("insights.title")}</h2>
          <p className="insight-hint">{t(pub ? "insights.hint_public" : "insights.hint_personal")}</p>
        </div>
        {collapsible && <button type="button" className="btn btn-sm btn-ghost" aria-expanded={open} aria-controls={`${id}-b`} onClick={() => setOpen((o) => !o)}>{open ? t("insights.hide") : t("insights.show")}</button>}
      </header>
      {open && (
        <div id={`${id}-b`}>
          {body}
          {(foot || (canAi && !preset)) && (
            <div className="insight-foot">
              {foot && <span>{foot}</span>}
              {canAi && !preset && <label className="insight-ai"><input type="checkbox" checked={withAi} onChange={(e) => setWithAi(e.target.checked)} />{t("insights.with_ai")}</label>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
