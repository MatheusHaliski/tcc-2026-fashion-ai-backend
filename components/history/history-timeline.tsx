"use client";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { hypeViewState } from "@/lib/hype/model";
import { useHypeSummary } from "@/lib/hype/use-hype";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { HypeBadge } from "@/components/hype/hype-badge";
import { DailyLookContextChips } from "@/components/daily-look/context-chips";
import type { DailyLookRow } from "@/lib/daily-look/types";

const FEEDBACK: Record<string, string> = { ADOREI: "lookbookTabs.adorei", NAO_USEI: "lookbookTabs.nao_usei", NAO_GOSTEI: "lookbookTabs.nao_gostei" };

/** Quantas vezes o mesmo look já tinha sido o Look do Dia até a data de cada registro (1 = a primeira). */
function vezesDoLook(rows: DailyLookRow[]): Map<string, number> {
  const out = new Map<string, number>();
  const contagem = new Map<string, number>();
  [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((r) => {
    const n = (contagem.get(r.schemeId) ?? 0) + 1;
    contagem.set(r.schemeId, n);
    out.set(r.id, n);
  });
  return out;
}

function Row({ r, vez }: { r: DailyLookRow; vez: number }) {
  const { t, fmtDate } = useI18n();
  const hype = useHypeSummary("SCHEME", r.schemeId);
  return (
    <li className="history-row">
      <time className="history-date tabular" dateTime={r.date}>{fmtDate(r.date, { day: "2-digit", month: "short" })}</time>
      <Link href={`/schemes/${r.schemeId}`} className="history-title">{r.title}</Link>
      <span className="history-meta">
        {r.feedback ? t(FEEDBACK[r.feedback] ?? r.feedback) : t("history.timeline.no_feedback")}
        {vez > 1 && ` · ${t("history.timeline.again", { n: vez })}`}
      </span>
      <HypeBadge state={hypeViewState(hype.summary, hype)} summary={hype.summary} />
      <DailyLookContextChips context={r.context} compact className="history-context" />
    </li>
  );
}

/** Histórico → Timeline: os looks do dia em ordem, com a avaliação, o Hype atual e o Contexto do Dia congelado de cada um. */
export function HistoryTimeline() {
  const { t, fmtDate } = useI18n();
  const { data, loading, error, reload } = useApi<DailyLookRow[]>((signal) => api.get("/api/me/daily-looks", { signal }), []);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-64" />;
  if (data.length === 0) return <EmptyState title={t("history.timeline.empty")} hint={t("history.timeline.empty_hint")} action={<Link href="/lookbook?tab=daily" className="btn btn-primary">{t("history.timeline.mark_today")}</Link>} />;
  const vezes = vezesDoLook(data);
  const firsts = data.filter((r) => r.context?.purpose === "PRIMEIRO_DIA");   // §4.3: "primeiro dia" fica fixo na linha do tempo
  const months = new Map<string, DailyLookRow[]>();
  data.forEach((r) => { const k = String(r.date).slice(0, 7); months.set(k, [...(months.get(k) ?? []), r]); });
  return (
    <div className="grid gap-4">
      {firsts.length > 0 && <Card><h2 className="type-h3 mb-2">{t("history.timeline.first_days")}</h2><ol className="history-list">{firsts.map((r) => <Row key={"first-" + r.id} r={r} vez={vezes.get(r.id) ?? 1} />)}</ol></Card>}
      {[...months.entries()].map(([month, rows]) => (
        <Card key={month}>
          <h2 className="type-h3 mb-2">{fmtDate(`${month}-01`, { month: "long", year: "numeric" })}</h2>
          <ol className="history-list">{rows.map((r) => <Row key={r.id} r={r} vez={vezes.get(r.id) ?? 1} />)}</ol>
        </Card>
      ))}
      <p className="type-caption text-muted">{t("history.timeline.photos")} <Link href="/atelier?tab=timeline" className="underline">{t("history.timeline.photos_link")}</Link></p>
    </div>
  );
}
