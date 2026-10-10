"use client";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { label } from "@/lib/api/taxonomy";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { TimeSeries } from "@/components/charts";

interface Evolution { evolution?: { title?: string; history?: { date: string; score: number }[] } }
interface DnaOverview { versions?: { id: string; createdAt: string; snapshot?: { reason?: string; archetype?: string; palette?: string[]; phrase?: string } }[] }

/** O histórico chega do mais novo para o mais antigo: o gráfico precisa da ordem do tempo. */
export function chronological<T extends { date: string }>(rows: T[] = []) {
  return [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** Histórico → Evolução do estilo: Inventory Score ao longo do tempo e as versões do DNA de estilo. */
export function HistoryStyle() {
  const { t, fmtDate } = useI18n();
  const hl = useApi<Evolution>((signal) => api.get("/api/me/highlights", { signal }), []);
  const dna = useApi<DnaOverview>((signal) => api.get("/api/me/dna", { signal }), []);
  if (hl.error) return <ErrorState error={hl.error} onRetry={hl.reload} />;
  const history = chronological(hl.data?.evolution?.history).map((p) => ({ day: String(p.date).slice(0, 10), score: p.score }));
  const versions = dna.data?.versions ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="type-h3 mb-2">{t("history.style.inventory")}</h2>
        {hl.loading ? <Skeleton className="h-52" /> : history.length ? <TimeSeries data={history} x="day" keys={[{ key: "score", label: t("highlights.inventory_score") }]} height={220} />
          : <p className="type-body-sm text-muted">{t("history.style.inventory_empty")}</p>}
      </Card>
      <Card>
        <h2 className="type-h3 mb-2">{t("history.style.dna")}</h2>
        {dna.loading ? <Skeleton className="h-52" /> : versions.length === 0
          ? <EmptyState title={t("history.style.dna_empty")} action={<Link href="/dna" className="btn btn-primary">{t("hype.vs.no_dna_cta")}</Link>} />
          : <ol className="history-list">{versions.map((v) => (
            <li key={v.id} className="history-row">
              <time className="history-date tabular" dateTime={v.createdAt}>{fmtDate(v.createdAt, { day: "2-digit", month: "short", year: "2-digit" })}</time>
              <span className="history-title">{v.snapshot?.archetype ? label(v.snapshot.archetype.toLowerCase()) : "—"}</span>
              <span className="history-meta">{v.snapshot?.phrase && v.snapshot.phrase !== "null" ? v.snapshot.phrase : (v.snapshot?.palette ?? []).map((c) => label(c)).join(" · ")}</span>
            </li>))}</ol>}
      </Card>
    </div>
  );
}
