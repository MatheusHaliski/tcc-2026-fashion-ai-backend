"use client";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { hypeViewState } from "@/lib/hype/model";
import { useHypeSummary } from "@/lib/hype/use-hype";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { HypeBadge } from "@/components/hype/hype-badge";

/** Registro de Look do Dia como o backend devolve (DailyLookService.view). */
interface DailyLookRow { id: string; date: string; source: string; schemeId: string; title: string; coverImageUrl?: string | null; feedback?: string | null }

const FEEDBACK: Record<string, string> = { ADOREI: "lookbookTabs.adorei", NAO_USEI: "lookbookTabs.nao_usei", NAO_GOSTEI: "lookbookTabs.nao_gostei" };

function Row({ r }: { r: DailyLookRow }) {
  const { t, fmtDate } = useI18n();
  const hype = useHypeSummary("SCHEME", r.schemeId);
  return (
    <li className="history-row">
      <time className="history-date tabular" dateTime={r.date}>{fmtDate(r.date, { day: "2-digit", month: "short" })}</time>
      <Link href={`/schemes/${r.schemeId}`} className="history-title">{r.title}</Link>
      <span className="history-meta">{r.feedback ? t(FEEDBACK[r.feedback] ?? r.feedback) : t("history.timeline.no_feedback")}</span>
      <HypeBadge state={hypeViewState(hype.summary, hype)} summary={hype.summary} />
    </li>
  );
}

/** Histórico → Timeline: os looks do dia em ordem, com a avaliação e o Hype atual de cada um. */
export function HistoryTimeline() {
  const { t, fmtDate } = useI18n();
  const { data, loading, error, reload } = useApi<DailyLookRow[]>((signal) => api.get("/api/me/daily-looks", { signal }), []);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-64" />;
  if (data.length === 0) return <EmptyState title={t("history.timeline.empty")} hint={t("history.timeline.empty_hint")} action={<Link href="/lookbook?tab=daily" className="btn btn-primary">{t("history.timeline.mark_today")}</Link>} />;
  const months = new Map<string, DailyLookRow[]>();
  data.forEach((r) => { const k = String(r.date).slice(0, 7); months.set(k, [...(months.get(k) ?? []), r]); });
  return (
    <div className="grid gap-4">
      {[...months.entries()].map(([month, rows]) => (
        <Card key={month}>
          <h2 className="type-h3 mb-2">{fmtDate(`${month}-01`, { month: "long", year: "numeric" })}</h2>
          <ol className="history-list">{rows.map((r) => <Row key={r.id} r={r} />)}</ol>
        </Card>
      ))}
      <p className="type-caption text-muted">{t("history.timeline.photos")} <Link href="/photos" className="underline">{t("history.timeline.photos_link")}</Link></p>
    </div>
  );
}
