"use client";

import { useMemo, useRef, useState } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { read, SESSION_KEY } from "@/lib/tryon/fitting-room-storage";
import type { FittingItem } from "@/lib/tryon/fitting-room";
import { appointmentsApi, type FittingAppointment } from "@/lib/fitting/appointments";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Select, Skeleton, Textarea, useToast } from "@/components/ui";

export function AppointmentCard({ item, busy, children }: { item: FittingAppointment; busy: boolean; children?: React.ReactNode }) {
  const { t, fmtDateTime } = useI18n();
  return <Card>
    <div className="flex flex-wrap items-center gap-2"><b>{item.sellerName ?? item.sellerId}</b><Badge tone="thread">{t(`fitting.status.${item.status}`)}</Badge><Badge tone={item.confirmation === "STORE_CONFIRMED" ? "chalk" : "mark"}>{t(`fitting.confirmation.${item.confirmation}`)}</Badge>
      <span className="type-caption text-muted">{fmtDateTime(item.confirmedSlot ?? item.requestedSlot)} · {t("fitting.expires", { date: fmtDateTime(item.expiresAt) })}</span></div>
    <ul className="grid gap-1 type-body-sm">{item.items.map((row) => <li key={row.id}>{row.productName ?? row.productId} · {row.sizeLabel} · <Badge tone={row.state === "RESERVED" ? "chalk" : "mark"}>{t(`fitting.item.${row.state}`)}</Badge>{row.result ? ` · ${t(`fitting.result.${row.result}`)}` : ""}</li>)}</ul>
    <p className="type-caption text-muted">{t("fitting.privacy")}</p>
    {busy ? null : children}
  </Card>;
}

/** RF-PESQ-07 — pede a prova em loja com as peças do provador (SKU/tamanho) e concilia o resultado. */
export function FittingAppointments() {
  const { t } = useI18n(); const toast = useToast();
  const mine = useApi((signal) => appointmentsApi.mine(signal), []);
  const session = useMemo(() => read<FittingItem[]>("session", SESSION_KEY, []).filter((item) => item.source === "catalog" && item.productId), []);
  const [form, setForm] = useState({ sellerUsername: "", requestedSlot: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Record<string, "FIT" | "NO_FIT" | "NOT_TRIED">>({});
  const key = useRef(crypto.randomUUID());
  async function run(action: () => Promise<unknown>) {
    if (busy) return; setBusy(true);
    try { await action(); mine.reload(); } catch (error) { toast.fromError(error); } finally { setBusy(false); }
  }
  async function request() {
    await run(async () => {
      await appointmentsApi.request({ sellerUsername: form.sellerUsername, requestedSlot: new Date(form.requestedSlot).toISOString(), notes: form.notes, items: session.map((item) => ({ productId: item.productId!, sizeLabel: item.size ?? "", variantId: item.variantId ?? null })) }, key.current);
      key.current = crypto.randomUUID(); toast.success(t("fitting.requested"));
    });
  }
  const ready = session.length > 0 && session.every((item) => !!item.size);
  return <div className="grid gap-4">
    <Card><h2 className="type-h3">{t("fitting.requestTitle")}</h2><p className="type-body-sm text-muted">{t("fitting.requestHint")}</p>
      {session.length === 0 ? <p className="type-body-sm text-muted">{t("fitting.noItems")}</p> : <ul className="grid gap-1 type-body-sm">{session.map((item) => <li key={item.key}>{item.name}{item.colorName ? ` — ${item.colorName}` : ""} · {item.size ? t("fitting.sizeChosen", { size: item.size }) : t("fitting.sizeMissing")}</li>)}</ul>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Field id="appt-store" label={t("fitting.store")}><Input id="appt-store" maxLength={80} value={form.sellerUsername} onChange={(e) => setForm({ ...form, sellerUsername: e.target.value })} /></Field>
        <Field id="appt-slot" label={t("fitting.slot")}><Input id="appt-slot" type="datetime-local" value={form.requestedSlot} onChange={(e) => setForm({ ...form, requestedSlot: e.target.value })} /></Field>
      </div>
      <Field id="appt-notes" label={t("sourcing.notes")}><Textarea id="appt-notes" maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      <Button variant="primary" loading={busy} disabled={!ready || !form.sellerUsername.trim() || !form.requestedSlot} onClick={request}>{t("fitting.send")}</Button>
    </Card>
    {mine.error ? <ErrorState error={mine.error} onRetry={mine.reload} /> : mine.loading && !mine.data ? <Skeleton className="h-24" /> : (mine.data ?? []).length === 0 ? <EmptyState title={t("fitting.none")} /> : (mine.data ?? []).map((item) => <AppointmentCard key={item.id} item={item} busy={false}>
      <div className="flex flex-wrap items-end gap-2">
        {["REQUESTED", "CONFIRMED"].includes(item.status) && <Button size="sm" disabled={busy} onClick={() => run(() => appointmentsApi.cancel(item.id, item.version))}>{t("common.cancel")}</Button>}
        {item.status === "CONFIRMED" && <>{item.items.map((row) => <Field key={row.id} id={`res-${row.id}`} label={`${row.productName ?? ""} ${row.sizeLabel}`} className="mb-0"><Select id={`res-${row.id}`} value={results[row.id] ?? "NOT_TRIED"} onChange={(e) => setResults({ ...results, [row.id]: e.target.value as "FIT" | "NO_FIT" | "NOT_TRIED" })}><option value="NOT_TRIED">{t("fitting.result.NOT_TRIED")}</option><option value="FIT">{t("fitting.result.FIT")}</option><option value="NO_FIT">{t("fitting.result.NO_FIT")}</option></Select></Field>)}
          <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => appointmentsApi.complete(item.id, item.version, item.items.map((row) => ({ itemId: row.id, result: results[row.id] ?? "NOT_TRIED" }))))}>{t("fitting.complete")}</Button></>}
      </div>
    </AppointmentCard>)}
  </div>;
}

/** Caixa da loja: confirma com horário ou recusa; nunca vê medidas, fotos ou avatar. */
export function FittingAppointmentsInbox() {
  const { t } = useI18n(); const toast = useToast();
  const inbox = useApi((signal) => appointmentsApi.inbox(signal), []);
  const [slots, setSlots] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<unknown>) {
    if (busy) return; setBusy(true);
    try { await action(); inbox.reload(); } catch (error) { toast.fromError(error); } finally { setBusy(false); }
  }
  if (inbox.error) return <ErrorState error={inbox.error} onRetry={inbox.reload} />;
  if (inbox.loading && !inbox.data) return <Skeleton className="h-24" />;
  const rows = inbox.data ?? [];
  return <section className="grid gap-3"><h2 className="type-h2">{t("fitting.inboxTitle")}</h2><p className="type-body-sm text-muted">{t("fitting.inboxHint")}</p>
    {rows.length === 0 ? <EmptyState title={t("fitting.inboxEmpty")} /> : rows.map((item) => <AppointmentCard key={item.id} item={item} busy={false}>
      {item.status === "REQUESTED" && <div className="flex flex-wrap items-end gap-2">
        <Field id={`slot-${item.id}`} label={t("fitting.confirmedSlot")} className="mb-0"><Input id={`slot-${item.id}`} type="datetime-local" value={slots[item.id] ?? ""} onChange={(e) => setSlots({ ...slots, [item.id]: e.target.value })} /></Field>
        <Button size="sm" variant="primary" disabled={busy || !slots[item.id]} onClick={() => run(() => appointmentsApi.confirm(item.id, item.version, new Date(slots[item.id]).toISOString()))}>{t("fitting.confirm")}</Button>
        <Button size="sm" disabled={busy} onClick={() => run(() => appointmentsApi.decline(item.id, item.version))}>{t("fitting.decline")}</Button>
      </div>}
    </AppointmentCard>)}
  </section>;
}
