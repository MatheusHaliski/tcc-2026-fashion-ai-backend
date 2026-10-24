"use client";
import { useId, useState, type FormEvent } from "react";
import { Button, Field, Textarea } from "@/components/ui";
import { fitApi, type FitChart, type FitChartData } from "@/lib/api/fit";
import { useI18n } from "@/lib/i18n/i18n";

/** Restricted backend checks remain authoritative. JSON supports exact source protocols without importing images. */
export function FitChartEditor({ chart, onSaved }: { chart: FitChart; onSaved: (chart: FitChart) => void }) {
  const { t } = useI18n(); const id = useId(); const [value, setValue] = useState(chart.chart ? JSON.stringify(chart.chart, null, 2) : "");
  const [authorized, setAuthorized] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const data = JSON.parse(value) as FitChartData;
      if (!authorized) throw new Error(t("fit.chartAuthorization"));
      const saved = await fitApi.saveChart(chart.productId, chart.chart ? chart.version : null, { ...data, sourceAuthorized: true });
      onSaved(saved); setAuthorized(false);
    } catch (cause) { setError(cause instanceof SyntaxError ? t("fit.invalidJson") : cause instanceof Error ? cause.message : t("fit.error")); }
    finally { setBusy(false); }
  }
  return <details className="mt-5"><summary className="type-body cursor-pointer">{t("fit.editChart")}</summary>
    <form onSubmit={save} className="grid gap-3 mt-3"><p className="type-body text-muted">{t("fit.chartEditorHelp")}</p>
      <Field id={id} label={t("fit.chartJson")}><Textarea id={id} rows={16} value={value} onChange={event => setValue(event.target.value)} disabled={busy} required spellCheck={false} /></Field>
      <label className="flex items-start gap-2 type-body"><input type="checkbox" checked={authorized} onChange={event => setAuthorized(event.target.checked)} disabled={busy} required /><span>{t("fit.chartAuthorization")}</span></label>
      {error && <p role="alert" className="type-body">{error}</p>}
      <Button variant="primary" loading={busy} disabled={!authorized || !value.trim()} type="submit">{t("fit.saveChart")}</Button>
    </form></details>;
}
