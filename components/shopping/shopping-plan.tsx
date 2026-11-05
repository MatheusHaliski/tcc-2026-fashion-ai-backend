"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { mediaUrl } from "@/lib/api/client";
import { label } from "@/lib/api/taxonomy";
import { shoppingPlanApi, type Candidate, type ShoppingPlan } from "@/lib/shopping/plan";
import { Badge, Button, Card, Chip, EmptyState, Field, Input, useToast } from "@/components/ui";

const OCCASIONS = ["trabalho", "festa", "casual", "esporte", "viagem", "formal"];
const SLOTS = ["upper_piece", "lower_piece", "shoes_piece"];

function CandidateCard({ item, currency, busy, onDismiss }: { item: Candidate; currency: string; busy: boolean; onDismiss: (kind: "OWNED" | "NOT_NEEDED") => void }) {
  const { t, fmtDate, fmtMoney } = useI18n();
  const url = mediaUrl(item.product.imageUrl);
  return <li className="surface grid gap-2 p-3">
    <div className="flex items-center gap-3"><span className="h-14 w-14 shrink-0 overflow-hidden rounded bg-surface-2" aria-hidden>{url && <img src={url} alt="" className="h-full w-full object-cover" />}</span>
      <span className="min-w-0"><b className="block truncate">{item.product.productName}</b><span className="type-caption text-muted">{label(item.slot)} · {t("shopping.covers", { occasions: item.coversOccasions.join(", ") })}</span></span></div>
    <p className="type-body-sm">{item.complements.length === 0 ? t("shopping.noComplements") : t("shopping.complements", { pieces: item.complements.map((piece) => piece.name).join(", ") })}</p>
    <p className="type-body-sm flex flex-wrap items-center gap-2">
      {item.priceConfirmed && item.price != null ? <><b>{fmtMoney(item.price, item.currency ?? currency)}</b><span className="type-caption text-muted">{t("shopping.priceMeta", { source: item.priceSource ?? "—", date: item.priceCheckedAt ? fmtDate(item.priceCheckedAt) : "—" })}</span></> : <Badge tone="mark">{t("shopping.priceUnconfirmed")}</Badge>}
      {item.withinBudget ? <Badge tone="chalk">{t("shopping.withinBudget")}</Badge> : <Badge tone="thread">{t("shopping.outsideGuaranteed")}</Badge>}
    </p>
    <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => onDismiss("OWNED")}>{t("shopping.own")}</Button><Button size="sm" disabled={busy} onClick={() => onDismiss("NOT_NEEDED")}>{t("shopping.notNeeded")}</Button></div>
  </li>;
}

/** RF-PESQ-09 — ocasiões, restrições e orçamento → lacunas e candidatos explicados; nada é comprado aqui. */
export function ShoppingPlanner() {
  const { t, fmtMoney, fmtDateTime } = useI18n(); const toast = useToast();
  const [occasions, setOccasions] = useState<string[]>(["trabalho"]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [budget, setBudget] = useState("500"); const [currency, setCurrency] = useState("BRL");
  const [plan, setPlan] = useState<ShoppingPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = (list: string[], value: string, set: (next: string[]) => void) => set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  async function compute() {
    if (busy) return; setBusy(true);
    try { setPlan(await shoppingPlanApi.plan({ occasions, budget: Number(budget), currency, excludedCategories: excluded })); }
    catch (error) { toast.fromError(error); } finally { setBusy(false); }
  }
  async function dismiss(productId: string, kind: "OWNED" | "NOT_NEEDED") {
    if (busy) return; setBusy(true);
    try { await shoppingPlanApi.dismiss(productId, kind); setPlan(await shoppingPlanApi.plan({ occasions, budget: Number(budget), currency, excludedCategories: excluded })); }
    catch (error) { toast.fromError(error); } finally { setBusy(false); }
  }
  return <div className="grid gap-4">
    <Card><h2 className="type-h3">{t("shopping.inputs")}</h2>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("shopping.occasions")}>{OCCASIONS.map((occasion) => <Chip key={occasion} active={occasions.includes(occasion)} onClick={() => toggle(occasions, occasion, setOccasions)}>{t(`shopping.occasion.${occasion}`)}</Chip>)}</div>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t("shopping.restrictions")}>{SLOTS.map((slot) => <Chip key={slot} active={excluded.includes(slot)} onClick={() => toggle(excluded, slot, setExcluded)}>{t("shopping.exclude", { slot: label(slot) })}</Chip>)}</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <Field id="plan-budget" label={t("shopping.budget")}><Input id="plan-budget" type="number" min={0} value={budget} onChange={(event) => setBudget(event.target.value)} /></Field>
        <Field id="plan-currency" label={t("sourcing.currency")}><Input id="plan-currency" maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></Field>
        <div className="flex items-end"><Button variant="primary" loading={busy} disabled={occasions.length === 0} onClick={compute}>{t("shopping.compute")}</Button></div>
      </div>
      <p className="type-caption text-muted">{t("shopping.scope")}</p>
    </Card>
    {plan && <>
      <Card><h2 className="type-h3">{t("shopping.gapsTitle")}</h2>
        {plan.gaps.length === 0 ? <p className="type-body-sm">{t("shopping.noGaps")}</p> : <ul className="grid gap-1 type-body-sm">{plan.gaps.map((gap) => <li key={`${gap.occasion}-${gap.slot}`}>{t("shopping.gap", { occasion: t(`shopping.occasion.${gap.occasion}`), slot: label(gap.slot) })}</li>)}</ul>}
        <p className="type-caption text-muted">{t("shopping.totals", { guaranteed: fmtMoney(plan.guaranteedTotal, plan.currency), remaining: fmtMoney(plan.remainingBudget, plan.currency), unconfirmed: plan.outsideGuaranteedTotal, date: fmtDateTime(plan.computedAt) })}</p>
      </Card>
      {plan.candidates.length === 0 ? <EmptyState title={t("shopping.noCandidates")} /> : <ul className="grid gap-3 sm:grid-cols-2">{plan.candidates.map((item) => <CandidateCard key={item.product.id} item={item} currency={plan.currency} busy={busy} onDismiss={(kind) => void dismiss(item.product.id, kind)} />)}</ul>}
      <p className="type-caption text-muted">{t("shopping.noPurchase")}</p>
    </>}
  </div>;
}
