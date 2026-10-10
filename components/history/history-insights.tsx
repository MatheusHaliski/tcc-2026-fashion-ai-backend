"use client";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { Card, Skeleton } from "@/components/ui";
import { HypeWardrobeInsights } from "@/components/hype/hype-insights";
import { InsightStrip } from "@/components/insights/insight-strip";

/** Histórico → Insights da IA: os insights dinâmicos do HISTORY (RF53), as leituras das suas fotos de looks e o painel do Hype do guarda-roupa. */
export function HistoryInsights() {
  const { t } = useI18n();
  const photos = useApi<{ sentences: string[] }>((signal) => api.get("/api/me/photos/insights", { signal }), []);
  return (<>
    <InsightStrip context="HISTORY" className="mb-4" />
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card>
        <h2 className="type-h3 mb-2">{t("history.insights.photos")}</h2>
        {photos.loading ? <Skeleton className="h-40" /> : (photos.data?.sentences ?? []).length === 0
          ? <p className="type-body-sm text-muted">{t("photos.sem_dados_insights")}</p>
          : <div className="fai-list">{photos.data!.sentences.map((s, i) => <p key={i} className="list-row type-body-sm">{s}</p>)}</div>}
      </Card>
      <HypeWardrobeInsights />
    </div>
  </>);
}
