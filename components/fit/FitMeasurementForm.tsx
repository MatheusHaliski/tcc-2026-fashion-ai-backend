"use client";
import { useId, useState, type FormEvent } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { fitApi, type FitMeasurement, type FitProfile, type FitProtocol, type FitRegion } from "@/lib/api/fit";
import { useI18n } from "@/lib/i18n/i18n";

const REGIONS: FitRegion[] = ["CHEST", "WAIST", "HIP", "THIGH", "INSEAM"];
const PROTOCOLS: FitProtocol[] = ["BODY_CIRCUMFERENCE_V1", "GARMENT_CIRCUMFERENCE_V1", "GARMENT_FLAT_WIDTH_V1", "BODY_LENGTH_V1", "GARMENT_LENGTH_V1"];
export function FitMeasurementForm({ profile, onSaved }: { profile: FitProfile | null; onSaved: (value: FitProfile | null) => void }) {
  const { t } = useI18n(); const id = useId();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries((profile?.measurements ?? []).map(m => [`${m.protocol}:${m.region}`, String(m.value)])));
  const [protocol, setProtocol] = useState<FitProtocol>(profile?.measurements[0]?.protocol ?? "BODY_CIRCUMFERENCE_V1");
  const [unit, setUnit] = useState<"CM" | "IN">("CM");
  const [measuredDate, setMeasuredDate] = useState(profile?.measuredAt.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [consent, setConsent] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  function changeUnit(next: "CM" | "IN") {
    setValues(previous => Object.fromEntries(Object.entries(previous).map(([key, value]) => [key, value.trim() && Number.isFinite(Number(value))
      ? String(Math.round(Number(value) * (next === "IN" ? 1 / 2.54 : 2.54) * 10000) / 10000) : value])));
    setUnit(next);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try {
      const measurements: FitMeasurement[] = Object.entries(values).filter(([, value]) => value.trim()).map(([key, value]) => {
        const [entryProtocol, region] = key.split(":") as [FitProtocol, FitRegion];
        return { region, protocol: entryProtocol, value: Number(value), unit };
      });
      if (!measurements.length || !consent || !measuredDate) throw new Error(t("fit.measurementsRequired"));
      const saved = await fitApi.saveProfile(profile?.version ?? null, new Date(`${measuredDate}T00:00:00Z`).toISOString(), measurements);
      onSaved(saved); setConsent(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("fit.error")); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (busy) return; setBusy(true); setError("");
    try { await fitApi.deleteProfile(profile?.version ?? 0); setValues({}); onSaved(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("fit.error")); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="grid gap-4">
    <p className="type-body text-muted">{t("fit.privacy")}</p>
    <Field label={t("fit.protocol")} id={`${id}-protocol`}><Select id={`${id}-protocol`} value={protocol} onChange={event => setProtocol(event.target.value as FitProtocol)} disabled={busy}>
      {PROTOCOLS.map(value => <option key={value} value={value}>{t(`fit.protocol.${value}`)}</option>)}
    </Select></Field>
    <p className="type-caption text-muted">{t(`fit.instructions.${protocol}`)}</p>
    <Field label={t("fit.unit")} id={`${id}-unit`}><Select id={`${id}-unit`} value={unit} onChange={event => changeUnit(event.target.value as "CM" | "IN")} disabled={busy}>
      <option value="CM">{t("fit.unit.CM")}</option><option value="IN">{t("fit.unit.IN")}</option>
    </Select></Field>
    <div className="grid gap-3 sm:grid-cols-3">{REGIONS.filter(region => (region === "INSEAM") === (protocol === "BODY_LENGTH_V1" || protocol === "GARMENT_LENGTH_V1")).map(region => <Field key={region} id={`${id}-${region}`} label={t(`fit.region.${region}`)} hint={t(`fit.point.${region}`)}>
      <Input id={`${id}-${region}`} type="number" inputMode="decimal" min={unit === "CM" ? 1 : 0.394} max={unit === "CM" ? 350 : 137.795} step="any" value={values[`${protocol}:${region}`] ?? ""} disabled={busy}
        onChange={event => setValues(previous => ({ ...previous, [`${protocol}:${region}`]: event.target.value }))} />
    </Field>)}</div>
    <Field label={t("fit.measuredAt")} id={`${id}-date`}><Input id={`${id}-date`} type="date" value={measuredDate} max={new Date().toISOString().slice(0, 10)} onChange={event => setMeasuredDate(event.target.value)} disabled={busy} required /></Field>
    <label className="flex items-start gap-2 type-body"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} required /><span>{t("fit.consent")}</span></label>
    {error && <p role="alert" className="type-body">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button type="submit" variant="primary" loading={busy} disabled={!consent}>{t("fit.saveMeasurements")}</Button>
      <Button type="button" disabled={busy} onClick={() => void remove()}>{t("fit.deleteMeasurements")}</Button></div>
  </form>;
}
