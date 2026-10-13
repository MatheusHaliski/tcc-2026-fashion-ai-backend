"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { Badge, Button, Card, Dialog, EmptyState, ErrorState, Field, Input, Pagination, Select, Skeleton, Textarea, useNotice } from "@/components/ui";

export const TREND_KINDS = ["PASSA_O_LOOK", "COR_EM_COMUM", "REINTERPRETACAO", "PECA_ASSINATURA", "DUETO_CRIATIVO"] as const;
interface Trend { id: string; title: string; description: string; kind: string; status: string; endsAt?: string; author?: { username: string; displayName: string }; }
interface Trends { items: Trend[]; total: number; page: number; size: number; }
const empty = { title: "", description: "", kind: "PASSA_O_LOOK", durationDays: "7" };

export function CommunityTrends() {
  const { t, fmtDate } = useI18n(); const notice = useNotice();
  const [page, setPage] = useState(0); const [kind, setKind] = useState(""); const size = 12;
  const list = useApi<Trends>((signal) => api.get(`/api/challenges/trends?page=${page}&size=${size}${kind ? `&kind=${kind}` : ""}`, { signal }), [page, kind]);
  const [open, setOpen] = useState(false); const [form, setForm] = useState(empty); const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  async function publish() {
    if (lock.current || !form.title.trim() || !form.description.trim()) return;
    lock.current = true; setBusy(true);
    try {
      let id = draftId;
      if (!id) { const draft = await api.post<Trend>("/api/challenges/trends", { ...form, durationDays: Number(form.durationDays) }); id = draft.id; setDraftId(id); }
      const result = await api.post<{ awardedPoints: number; pointsMessage: string; alreadyPublished: boolean }>(`/api/challenges/trends/${id}/publish`, {});
      notice.success(t("trends.published", { points: result.awardedPoints }), { details: [result.pointsMessage] });
      setOpen(false); setForm(empty); setDraftId(null); setPage(0); list.reload();
    } catch (error) { notice.fromError(error); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="grid gap-4" aria-label={t("trends.title")}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="type-h3">{t("trends.title")}</h2><p className="type-body-sm text-muted">{t("trends.lead")}</p></div><Button variant="primary" onClick={() => setOpen(true)}>{t("trends.create")}</Button></div>
    <Field id="trend-filter" label={t("trends.type")}><Select id="trend-filter" value={kind} onChange={(event) => { setKind(event.target.value); setPage(0); }}><option value="">{t("trends.all")}</option>{TREND_KINDS.map(value => <option key={value} value={value}>{t(`trends.kind.${value}`)}</option>)}</Select></Field>
    {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : list.loading ? <Skeleton className="h-64" /> : !list.data?.items.length ? <EmptyState title={t("trends.empty")} hint={t("trends.emptyHint")} /> : <>
      <p className="type-caption text-muted">{t("trends.total", { n: list.data.total })}</p><div className="grid-looks">{list.data.items.map(trend => <Card key={trend.id}>
        <Badge>{t(`trends.kind.${trend.kind}`)}</Badge><h3 className="type-h3 mt-2">{trend.title}</h3><p className="type-body-sm whitespace-pre-wrap mt-2">{trend.description}</p>
        {trend.author && <Link className="type-caption underline" href={`/u/${encodeURIComponent(trend.author.username)}`}>{trend.author.displayName}</Link>}
        {trend.endsAt && <p className="type-caption text-muted mt-2">{t("trends.ends", { date: fmtDate(trend.endsAt) })}</p>}
      </Card>)}</div>
      {list.data.total > size && <Pagination page={page} size={size} total={list.data.total} hasMore={(page + 1) * size < list.data.total} onPage={setPage} />}
    </>}
    <Dialog open={open} onClose={() => { if (!busy) setOpen(false); }} title={t("trends.create")} footer={<><Button disabled={busy} onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button variant="primary" loading={busy} disabled={!form.title.trim() || !form.description.trim() || Number(form.durationDays) < 1 || Number(form.durationDays) > 30} onClick={publish}>{t("trends.publish")}</Button></>}>
      <p className="type-body-sm text-muted mb-3">{t("trends.creationHint")}</p>
      {draftId && <p role="status" className="type-body-sm mb-3">{t("trends.retryHint")}</p>}
      <Field id="trend-kind" label={t("trends.type")} required><Select id="trend-kind" disabled={busy || !!draftId} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>{TREND_KINDS.map(value => <option key={value} value={value}>{t(`trends.kind.${value}`)}</option>)}</Select></Field>
      <p className="type-body-sm text-muted mb-3">{t(`trends.hint.${form.kind}`)}</p>
      <Field id="trend-title" label={t("common.nome")} required><Input id="trend-title" maxLength={80} disabled={busy || !!draftId} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
      <Field id="trend-description" label={t("trends.rules")} required><Textarea id="trend-description" maxLength={1000} disabled={busy || !!draftId} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
      <Field id="trend-days" label={t("challenges.duracao_dias")} required><Input id="trend-days" type="number" min={1} max={30} disabled={busy || !!draftId} value={form.durationDays} onChange={e => setForm({ ...form, durationDays: e.target.value })} /></Field>
    </Dialog>
  </section>;
}
