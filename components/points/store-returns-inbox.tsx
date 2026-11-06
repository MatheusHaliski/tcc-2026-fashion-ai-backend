"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { returnsApi } from "@/lib/store/api";
import type { ReturnCase } from "@/lib/store/types";
import { Badge, Button, EmptyState, ErrorState, Field, Input, Select, SkeletonGrid, Switch, useToast } from "@/components/ui";
import { ReturnTimeline } from "./store-returns";

function InspectionForm({ item, busy, onInspect }: { item: ReturnCase; busy: boolean; onInspect: (body: { outcome: "AS_DECLARED" | "DIVERGENT"; divergenceReason: string; restock: boolean; settle: boolean; notes: string }) => void }) {
  const { t } = useI18n();
  const [outcome, setOutcome] = useState<"AS_DECLARED" | "DIVERGENT">("AS_DECLARED");
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(false);
  const [settle, setSettle] = useState(false);
  return <div className="grid gap-2 rounded-md border border-line-soft p-3">
    <Field id={`outcome-${item.id}`} label={t("storeReturn.inspection")}><Select id={`outcome-${item.id}`} value={outcome} onChange={(event) => setOutcome(event.target.value as "AS_DECLARED" | "DIVERGENT")}><option value="AS_DECLARED">{t("storeReturn.outcome.AS_DECLARED")}</option><option value="DIVERGENT">{t("storeReturn.outcome.DIVERGENT")}</option></Select></Field>
    {outcome === "DIVERGENT" && <><Field id={`divergence-${item.id}`} label={t("storeReturn.divergenceReason")} required><Input id={`divergence-${item.id}`} required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
      <Switch checked={settle} onChange={setSettle} label={t(item.kind === "RETURN" ? "storeReturn.settleAnyway" : "storeReturn.exchangeAnyway")} /></>}
    <Switch checked={restock} onChange={setRestock} label={t("storeReturn.restock")} hint={t("storeReturn.restockHint")} />
    <div><Button size="sm" variant="primary" loading={busy} disabled={outcome === "DIVERGENT" && !reason.trim()} onClick={() => onInspect({ outcome, divergenceReason: reason, restock, settle, notes: "" })}>{t("storeReturn.finishInspection")}</Button></div>
  </div>;
}

/** Fila do vendedor/operador: aprovar, registrar recebimento e inspecionar; só então o estorno ou a troca acontecem. */
export function ReturnsInbox() {
  const { t, fmtDate } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const inbox = useApi((signal) => returnsApi.inbox(signal), []);
  async function run(action: () => Promise<unknown>) {
    if (busy) return; setBusy(true);
    try { await action(); inbox.reload(); toast.success(t("common.saved")); }
    catch (error) { toast.fromError(error); }
    finally { setBusy(false); }
  }
  if (inbox.error) return <ErrorState error={inbox.error} onRetry={inbox.reload} />;
  if (inbox.loading && !inbox.data) return <SkeletonGrid n={2} h="h-24" />;
  const rows = inbox.data ?? [];
  return <section className="grid gap-3" aria-labelledby="returns-inbox-title">
    <h2 id="returns-inbox-title" className="type-h2">{t("storeReturn.inboxTitle")}</h2>
    <p className="type-body-sm text-muted">{t("storeReturn.inboxHint")}</p>
    {rows.length === 0 ? <EmptyState title={t("storeReturn.inboxEmpty")} /> : <ul className="grid gap-3">{rows.map((item) => <li key={item.id} className="surface grid gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2"><Badge tone="mark">{t(`storeReturn.kind.${item.kind}`)}</Badge><Badge tone="thread">{t(`storeReturn.status.${item.status}`)}</Badge><span className="type-caption text-muted">{fmtDate(item.createdAt)} · {t(`storeReturn.reason.${item.reasonCode}`)}</span></div>
      {item.reasonNotes && <p className="type-body-sm">{item.reasonNotes}</p>}
      <ReturnTimeline item={item} />
      {item.evidence.length > 0 && <p className="type-caption text-muted">{t("storeReturn.evidenceCount", { count: item.evidence.length })}</p>}
      <div className="flex flex-wrap gap-2">
        {item.status === "REQUESTED" && <><Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => returnsApi.decide(item.id, { expectedVersion: item.version, approve: true, notes: "" }))}>{t("storeReturn.approve")}</Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={() => run(() => returnsApi.decide(item.id, { expectedVersion: item.version, approve: false, notes: "" }))}>{t("storeReturn.reject")}</Button></>}
        {["APPROVED", "IN_TRANSIT"].includes(item.status) && <Button size="sm" disabled={busy} onClick={() => run(() => returnsApi.receive(item.id, item.version))}>{t("storeReturn.markReceived")}</Button>}
      </div>
      {item.status === "RECEIVED" && <InspectionForm item={item} busy={busy} onInspect={(body) => run(() => returnsApi.inspect(item.id, { expectedVersion: item.version, ...body }))} />}
    </li>)}</ul>}
  </section>;
}
