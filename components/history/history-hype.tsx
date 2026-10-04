"use client";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { CATEGORY_LABEL } from "@/lib/api/taxonomy";
import type { HypeCardItem, HypeMovers } from "@/lib/hype/types";
import { Card, ErrorState, Skeleton } from "@/components/ui";
import { HypeHistoryChart } from "@/components/hype/hype-history-chart";
import { HypeItemRow } from "@/components/hype/hype-item-row";
import { HypeRediscoveryCard } from "@/components/hype/hype-rediscovery";

function Items({ title, items, empty }: { title: string; items: HypeCardItem[]; empty: string }) {
  return (
    <Card>
      <h2 className="type-h3 mb-2">{title}</h2>
      {items.length === 0 ? <p className="type-body-sm text-muted">{empty}</p> : <div className="hype-items">{items.map((i) => <HypeItemRow key={`${i.type}-${i.id}`} item={i} />)}</div>}
    </Card>
  );
}

/**
 * Histórico → Hype: evolução do Hype médio do guarda-roupa, o que subiu, o que caiu, novas tendências da rede (só
 * conteúdo público, por categoria), redescobertas e looks emergentes.
 */
export function HistoryHype() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useApi<HypeMovers>((signal) => api.get("/api/me/hype/movers?days=90", { signal }), []);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-80" />;
  const series = data.series.pieces.map((p) => ({ date: p.date, status: "AVAILABLE" as const, score: p.average }));
  const looks = data.series.looks.map((p) => ({ date: p.date, status: "AVAILABLE" as const, score: p.average }));
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="type-h3 mb-2">{t("history.hype.pieces_series")}</h2><HypeHistoryChart points={series} label={t("history.hype.average")} /></Card>
        <Card><h2 className="type-h3 mb-2">{t("history.hype.looks_series")}</h2><HypeHistoryChart points={looks} label={t("history.hype.average")} /></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Items title={t("history.hype.risers", { days: data.deltaWindowDays })} items={data.risers} empty={t("history.hype.no_risers")} />
        <Items title={t("history.hype.fallers", { days: data.deltaWindowDays })} items={data.fallers} empty={t("history.hype.no_fallers")} />
      </div>
      {data.rediscoveries.length > 0 && (
        <section className="grid gap-2" aria-label={t("hypeInsights.rediscovery.title")}>
          <h2 className="type-h3">{t("hypeInsights.rediscovery.title")}</h2>
          {data.rediscoveries.map((r) => <HypeRediscoveryCard key={r.id} item={r} />)}
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Items title={t("history.hype.emerging_looks")} items={data.emergingLooks} empty={t("history.hype.no_emerging_looks")} />
        <Card>
          <h2 className="type-h3 mb-1">{t("history.hype.new_trends")}</h2>
          <p className="type-caption text-muted mb-2">{t("history.hype.new_trends_hint")}</p>
          {data.newTrends.length === 0 ? <p className="type-body-sm text-muted">{t("history.hype.no_new_trends")}</p>
            : <ul className="fai-list">{data.newTrends.map((n) => <li key={n.category} className="flex justify-between py-1 type-body-sm"><span>{CATEGORY_LABEL[n.category] ?? n.category}</span><span className="tabular">{t("history.hype.emerging_count", { count: n.emerging })}</span></li>)}</ul>}
        </Card>
      </div>
    </div>
  );
}
