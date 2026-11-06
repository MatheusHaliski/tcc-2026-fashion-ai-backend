"use client";

import { useRef, useState } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { commandKey, returnsApi, storeApi } from "@/lib/store/api";
import { variantLabel, type ReturnCase, type ReturnReason, type ReturnRequestForm, type StoreOrder } from "@/lib/store/types";
import { Badge, Button, Dialog, Field, FileButton, Select, Switch, Textarea, useToast } from "@/components/ui";

/** Linha do tempo de um caso: estados com data, sem expor o conteúdo dos comprovantes. */
export function ReturnTimeline({ item }: { item: ReturnCase }) {
  const { t, fmtDate } = useI18n();
  return <ol className="grid gap-1 type-caption text-muted" aria-label={t("storeReturn.timeline")}>
    {item.events.map((event) => <li key={event.id}>{fmtDate(event.at)} · {t(`storeReturn.status.${event.toStatus}`)}{event.notes ? ` — ${event.notes}` : ""}</li>)}
    {item.inspectionOutcome && <li>{t(`storeReturn.outcome.${item.inspectionOutcome}`)}{item.divergenceReason ? ` — ${item.divergenceReason}` : ""}{item.restocked ? ` · ${t("storeReturn.restocked")}` : ""}</li>}
  </ol>;
}

/** RF-PESQ-02 — o comprador pede troca/devolução de um pedido elegível pela política congelada nele. */
export function ReturnRequest({ order, onChanged }: { order: StoreOrder; onChanged: () => void }) {
  const { t, fmtDate } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(commandKey());
  const [form, setForm] = useState<ReturnRequestForm>({ kind: "RETURN", reasonCode: "FIT_TOO_SMALL", reasonNotes: "", exchangeVariantId: null, fitFeedbackConsent: false });
  const cases = useApi((signal) => returnsApi.mine(signal), [order.id]);
  const eligibility = useApi((signal) => returnsApi.eligibility(order.id, signal), [order.id], { enabled: order.status === "DELIVERED" });
  const checkout = useApi((signal) => storeApi.checkout(order.listingId, signal), [order.listingId], { enabled: open && form.kind === "EXCHANGE" });
  const current = (cases.data ?? []).find((item) => item.orderId === order.id && !["REJECTED", "CANCELLED", "REFUNDED", "EXCHANGED", "CLOSED"].includes(item.status));
  const history = (cases.data ?? []).filter((item) => item.orderId === order.id && item !== current);
  const set = (patch: Partial<ReturnRequestForm>) => setForm((value) => ({ ...value, ...patch }));
  const fit = form.reasonCode.startsWith("FIT_");
  async function run(action: () => Promise<unknown>) {
    if (busy) return; setBusy(true);
    try { await action(); cases.reload(); eligibility.reload(); onChanged(); }
    catch (error) { toast.fromError(error); }
    finally { setBusy(false); }
  }
  async function submit() {
    await run(async () => { await returnsApi.open(order.id, form, key.current); key.current = commandKey(); setOpen(false); toast.success(t("storeReturn.opened")); });
  }
  const e = eligibility.data;
  return <div className="grid gap-2">
    {current && <div className="rounded-md border border-line-soft p-3 grid gap-2">
      <div className="flex flex-wrap items-center gap-2"><Badge tone="mark">{t(`storeReturn.kind.${current.kind}`)}</Badge><Badge tone="thread">{t(`storeReturn.status.${current.status}`)}</Badge><span className="type-caption text-muted">{t("storeReturn.policy", { version: current.policyVersion, days: current.windowDays })}</span></div>
      <ReturnTimeline item={current} />
      <div className="flex flex-wrap gap-2">
        {["REQUESTED", "APPROVED"].includes(current.status) && <Button size="sm" disabled={busy} onClick={() => run(() => returnsApi.cancel(current.id, current.version))}>{t("storeReturn.cancel")}</Button>}
        {current.status === "APPROVED" && <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => returnsApi.ship(current.id, { expectedVersion: current.version, trackingCode: "" }))}>{t("storeReturn.markShipped")}</Button>}
        <FileButton id={`evidence-${current.id}`} accept="image/png,image/jpeg" disabled={busy} onFiles={(files) => files[0] && run(() => returnsApi.upload(current.id, files[0], commandKey()))}>{t("storeReturn.addEvidence", { count: current.evidence.length })}</FileButton>
      </div>
    </div>}
    {history.map((item) => <p key={item.id} className="type-caption text-muted">{t(`storeReturn.kind.${item.kind}`)} · {t(`storeReturn.status.${item.status}`)} · {fmtDate(item.createdAt)}</p>)}
    {!current && e && (e.eligible
      ? <div className="flex flex-wrap items-center gap-2"><Button size="sm" onClick={() => setOpen(true)}>{t("storeReturn.request")}</Button><span className="type-caption text-muted">{t("storeReturn.deadline", { date: fmtDate(e.deadlineAt!), version: e.policyVersion })}{e.legacyPolicy ? ` · ${t("storeReturn.legacyPolicy")}` : ""}</span></div>
      : <p className="type-caption text-muted">{t(`storeReturn.ineligible.${e.reason}`)} · {t("storeReturn.policy", { version: e.policyVersion, days: e.windowDays })}</p>)}
    <Dialog open={open} onClose={() => !busy && setOpen(false)} title={t("storeReturn.dialogTitle")} footer={<><Button disabled={busy} onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button variant="primary" loading={busy} disabled={form.kind === "EXCHANGE" && !form.exchangeVariantId} onClick={submit}>{t("storeReturn.confirm")}</Button></>}>
      {e && <p className="mb-3 type-body-sm text-muted">{t("storeReturn.dialogLead", { days: e.windowDays, date: fmtDate(e.deadlineAt!) })}</p>}
      <div className="grid gap-3">
        <Field label={t("storeReturn.kindLabel")}><Select value={form.kind} onChange={(event) => set({ kind: event.target.value as ReturnRequestForm["kind"], exchangeVariantId: null })}><option value="RETURN">{t("storeReturn.kind.RETURN")}</option><option value="EXCHANGE">{t("storeReturn.kind.EXCHANGE")}</option></Select></Field>
        <Field label={t("storeReturn.reasonLabel")}><Select value={form.reasonCode} onChange={(event) => set({ reasonCode: event.target.value as ReturnReason })}>{(e?.reasonCodes ?? []).map((code) => <option key={code} value={code}>{t(`storeReturn.reason.${code}`)}</option>)}</Select></Field>
        {form.kind === "EXCHANGE" && <Field label={t("storeReturn.exchangeVariant")}><Select value={form.exchangeVariantId ?? ""} onChange={(event) => set({ exchangeVariantId: event.target.value || null })}>
          <option value="">{t("storeReturn.chooseVariant")}</option>
          {(checkout.data?.variants ?? []).filter((variant) => variant.availability === "AVAILABLE" && variant.id !== order.variant?.id).map((variant) => <option key={variant.id} value={variant.id}>{variantLabel(variant, t("physicalStore.variant.noColor"))}</option>)}
        </Select></Field>}
        <Field label={t("storeReturn.notes")}><Textarea maxLength={2000} value={form.reasonNotes} onChange={(event) => set({ reasonNotes: event.target.value })} /></Field>
        {fit && <Switch checked={form.fitFeedbackConsent} onChange={(value) => set({ fitFeedbackConsent: value })} label={t("storeReturn.fitConsent")} hint={t("storeReturn.fitConsentHint")} />}
      </div>
    </Dialog>
  </div>;
}
