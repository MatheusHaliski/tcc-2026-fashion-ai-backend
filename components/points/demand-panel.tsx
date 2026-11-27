"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { demandApi } from "@/lib/store/demand";
import { Badge, EmptyState, ErrorState, Field, Input, SkeletonGrid } from "@/components/ui";

/** RF-PESQ-10 — painel da marca: só o próprio catálogo, agregado com limiar; mostra período, amostra, atraso e semântica. */
export function DemandPanel() {
  const { t, fmtDate, fmtNumber } = useI18n();
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const panel = useApi((signal) => demandApi.panel(from, to, signal), [from, to]);
  return <section className="grid gap-3" aria-labelledby="demand-title">
    <h2 id="demand-title" className="type-h2">{t("demand.title")}</h2>
    <p className="type-body-sm text-muted">{t("demand.hint")}</p>
    <div className="grid gap-2 sm:grid-cols-2">
      <Field id="demand-from" label={t("demand.from")}><Input id="demand-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
      <Field id="demand-to" label={t("demand.to")}><Input id="demand-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
    </div>
    {panel.error ? <ErrorState error={panel.error} onRetry={panel.reload} /> : !panel.data ? <SkeletonGrid n={2} h="h-16" /> : <>
      <p className="type-caption text-muted" role="status">{t("demand.meta", { from: fmtDate(panel.data.period.from), to: fmtDate(panel.data.period.to), sample: fmtNumber(panel.data.sampleSize), contributors: fmtNumber(panel.data.contributors), delay: panel.data.delayDays, threshold: panel.data.threshold, suppressed: panel.data.suppressedCells })}</p>
      {panel.data.cells.length === 0 ? <EmptyState title={t("demand.empty")} hint={t("demand.emptyHint", { threshold: panel.data.threshold })} /> : <table className="w-full type-body-sm"><thead><tr><th className="text-left">{t("demand.product")}</th><th className="text-left">{t("demand.color")}</th><th className="text-left">{t("demand.size")}</th><th className="text-left">{t("demand.kind")}</th><th className="text-right">{t("demand.contributors")}</th></tr></thead>
        <tbody>{panel.data.cells.map((cell, index) => <tr key={`${cell.productId}-${index}`}><td>{cell.productName ?? cell.productId}</td><td>{cell.colorName ?? "—"}</td><td>{cell.sizeLabel ?? "—"}</td><td><Badge tone="thread">{t(`demand.kindLabel.${cell.kind}`)}</Badge></td><td className="text-right tabular">{fmtNumber(cell.contributors)}</td></tr>)}</tbody></table>}
      <p className="type-caption text-muted">{t("demand.notice")}</p>
    </>}
  </section>;
}
