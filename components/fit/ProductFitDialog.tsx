"use client";
import { useEffect, useId, useState } from "react";
import { Button, Dialog, Field, Select } from "@/components/ui";
import { fitApi, type FitChart, type FitFeedback, type FitPreference, type FitProfile, type FitRating, type FitRecommendation, type FitRegion } from "@/lib/api/fit";
import { useI18n } from "@/lib/i18n/i18n";
import { FitMeasurementForm } from "./FitMeasurementForm";
import { FitChartEditor } from "./FitChartEditor";

export function ProductFitDialog({ productId, productName, open, onClose }: { productId: string; productName?: string; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return <Dialog open={open} onClose={onClose} title={productName ? t("fit.productTitle", { name: productName }) : t("fit.title")} size="lg">
    {open && <ProductFitPanel key={productId} productId={productId} />}
  </Dialog>;
}

function ProductFitPanel({ productId }: { productId: string }) {
  const { t, fmtDate } = useI18n(); const preferenceId = useId();
  const [chart, setChart] = useState<FitChart | null>(null); const [profile, setProfile] = useState<FitProfile | null>(null);
  const [preference, setPreference] = useState<FitPreference>("REGULAR"); const [recommendation, setRecommendation] = useState<FitRecommendation | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [attempt, setAttempt] = useState(0);
  const [request, setRequest] = useState<{ key: string; preference: FitPreference } | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    void fitApi.chart(productId, controller.signal).then(async next => {
      const measured = next.chart ? await fitApi.profile(controller.signal) : null;
      if (!controller.signal.aborted) { setChart(next); setProfile(measured); }
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("fit.error")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [productId, attempt, t]);
  function changedProfile(next: FitProfile | null) { setProfile(next); setRecommendation(null); setRequest(null); }
  async function recommend() {
    if (busy) return; setBusy(true); setError("");
    const command = request?.preference === preference ? request : { key: crypto.randomUUID(), preference }; setRequest(command);
    try {
      setRecommendation(await fitApi.recommend(productId, command.preference, command.key));
      // A completed comparison starts a new command next time; only a failed response is retried.
      setRequest(null);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("fit.error")); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status" className="type-body">{t("fit.loading")}</p>;
  return <div className="grid gap-5">
    <p className="type-body text-muted">{t("fit.disclaimer")}</p>
    {error && <div role="alert"><p className="type-body">{error}</p>{!chart && <Button onClick={() => setAttempt(value => value + 1)}>{t("fit.retry")}</Button>}</div>}
    {chart && !chart.chart && <p role="status" className="type-body">{t("fit.status.NO_CHART")}</p>}
    {chart?.chart && <>
      <div className="type-body"><p><b>{t("fit.source")}: </b><a className="underline" href={chart.chart.sourceUrl} target="_blank" rel="noopener noreferrer">{chart.chart.sourceName}</a></p>
        <p className="text-muted">{t("fit.sourceDetails", { revision: chart.chart.sourceRevision, date: fmtDate(chart.chart.sourceDate), market: chart.chart.market })}</p>
        <p className="text-muted">{t("fit.validUntil", { date: fmtDate(chart.chart.validUntil) })}</p>
        <p>{t(`fit.chartType.${chart.chart.type}`)}</p>
      </div>
      <details><summary className="type-body cursor-pointer">{t("fit.viewChart")}</summary><div className="overflow-x-auto"><table className="w-full type-body"><caption className="type-caption text-muted">{t("fit.chartUnits")}</caption>
        <thead><tr><th scope="col">{t("fit.size")}</th><th scope="col">{t("fit.dimensions")}</th></tr></thead><tbody>{chart.chart.options.slice().sort((a, b) => a.order - b.order).map(option => <tr key={option.label}>
          <th scope="row">{option.label}</th><td>{option.measurements.map(dimension => <p key={`${dimension.region}-${dimension.protocol}`}>{t(`fit.region.${dimension.region}`)}: {dimension.min}–{dimension.max} · {t(`fit.protocol.${dimension.protocol}`)}</p>)}</td>
        </tr>)}</tbody></table></div></details>
      <details><summary className="type-body cursor-pointer">{profile ? t("fit.editMeasurements") : t("fit.addMeasurements")}</summary>
        <div className="mt-3"><FitMeasurementForm key={profile ? `${profile.version}-${profile.measuredAt}` : "empty"} profile={profile} onSaved={changedProfile} /></div>
      </details>
      <Field id={preferenceId} label={t("fit.preference")}><Select id={preferenceId} value={preference} disabled={busy} onChange={event => { setPreference(event.target.value as FitPreference); setRecommendation(null); setRequest(null); }}>
        {(["SLIM", "REGULAR", "LOOSE"] as const).map(value => <option key={value} value={value}>{t(`fit.preference.${value}`)}</option>)}
      </Select></Field>
      <Button variant="primary" loading={busy} onClick={() => void recommend()}>{t("fit.recommend")}</Button>
    </>}
    {recommendation && <div aria-live="polite" className="grid gap-3">
      <p className="type-body"><b>{t(`fit.status.${recommendation.result.status}`)}</b>{recommendation.result.recommendedSize && <span> · {recommendation.result.recommendedSize}</span>}</p>
      <p className="type-caption text-muted">{t(`fit.explanation.${recommendation.result.preferenceExplanation}`)}</p>
      <p className="type-body">{t("fit.qualitativeEvidence")}: {t(`fit.evidence.${recommendation.result.qualitativeEvidence}`)}</p>
      {!!recommendation.result.missingInformation.length && <div className="type-body"><b>{t("fit.missingInformation")}</b><ul>{recommendation.result.missingInformation.map(item => <li key={`${item.region}-${item.requiredProtocol}-${item.reason}`}>
        {t(`fit.region.${item.region}`)}: {t(`fit.reason.${item.reason}`)} · {t(`fit.protocol.${item.requiredProtocol}`)}
      </li>)}</ul></div>}
      {!!recommendation.priorExperience.length && <div className="type-body"><b>{t("fit.priorExperience")}</b><p className="text-muted">{t("fit.priorExperienceHelp")}</p><ul>{recommendation.priorExperience.map(item => <li key={item.sizeLabel}>
        {item.sizeLabel} · {Object.entries(item.regions).map(([region, rating]) => `${t(`fit.region.${region}`)}: ${t(`fit.rating.${rating}`)}`).join(" · ")} · {fmtDate(item.recordedAt)}
      </li>)}</ul></div>}
      {recommendation.stale && <p role="status" className="type-body">{t("fit.stale")}</p>}
      {recommendation.result.candidates.map(candidate => <div key={candidate.sizeLabel} className="list-row"><b>{candidate.sizeLabel}</b>
        <ul className="type-body">{candidate.regions.map(region => <li key={region.region}>{t(`fit.region.${region.region}`)}: {t(`fit.reason.${region.reason}`)}</li>)}</ul>
      </div>)}
      <p className="type-caption text-muted">{t("fit.resultVersions", { chart: recommendation.result.chartRevision ?? "—", profile: recommendation.result.profileVersion ?? "—", rules: recommendation.result.rulesVersion })}</p>
      {!!recommendation.result.candidates.length && <FitFeedbackForm key={recommendation.id} recommendation={recommendation} />}
    </div>}
    {chart?.canEdit && <FitChartEditor key={`chart-${chart.version}-${chart.revision}`} chart={chart} onSaved={next => { setChart(next); setRecommendation(null); setRequest(null); if (!chart.chart) setAttempt(value => value + 1); }} />}
  </div>;
}

function FitFeedbackForm({ recommendation }: { recommendation: FitRecommendation }) {
  const { t } = useI18n(); const id = useId();
  const [size, setSize] = useState(recommendation.result.recommendedSize ?? recommendation.result.candidates[0].sizeLabel);
  const [ratings, setRatings] = useState<Partial<Record<FitRegion, FitRating>>>({}); const [items, setItems] = useState(recommendation.feedback);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [key, setKey] = useState(() => crypto.randomUUID());
  const regions = recommendation.result.candidates.find(candidate => candidate.sizeLabel === size)?.regions ?? [];
  async function save() {
    setBusy(true); setError("");
    try { const entry = await fitApi.feedback(recommendation.id, key, size, ratings); setItems(previous => [...previous.filter(item => item.id !== entry.id), entry]); setRatings({}); setKey(crypto.randomUUID()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("fit.error")); }
    finally { setBusy(false); }
  }
  async function remove(entry: FitFeedback) {
    setBusy(true); setError(""); try { await fitApi.deleteFeedback(entry.id); setItems(previous => previous.filter(item => item.id !== entry.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("fit.error")); } finally { setBusy(false); }
  }
  return <details><summary className="type-body cursor-pointer">{t("fit.feedback")}</summary><div className="grid gap-3 mt-3">
    <p className="type-caption text-muted">{t("fit.feedbackPrivacy")}</p>
    <Field id={`${id}-size`} label={t("fit.triedSize")}><Select id={`${id}-size`} value={size} disabled={busy} onChange={event => { setSize(event.target.value); setRatings({}); setKey(crypto.randomUUID()); }}>
      {recommendation.result.candidates.map(candidate => <option key={candidate.sizeLabel} value={candidate.sizeLabel}>{candidate.sizeLabel}</option>)}
    </Select></Field>
    {regions.map(({ region }) => <Field key={region} id={`${id}-${region}`} label={t(`fit.region.${region}`)}><Select id={`${id}-${region}`} value={ratings[region] ?? ""} disabled={busy} onChange={event => {
      setRatings(previous => { const next = { ...previous }; if (event.target.value) next[region] = event.target.value as FitRating; else delete next[region]; return next; }); setKey(crypto.randomUUID());
    }}><option value="">{t("fit.notRated")}</option>{(["TIGHT", "COMFORTABLE", "LOOSE"] as const).map(value => <option key={value} value={value}>{t(`fit.rating.${value}`)}</option>)}</Select></Field>)}
    {error && <p role="alert" className="type-body">{error}</p>}
    <Button disabled={!Object.keys(ratings).length} loading={busy} onClick={() => void save()}>{t("fit.saveFeedback")}</Button>
    {items.map(entry => <div className="list-row" key={entry.id}><p className="type-body">{entry.triedSize} · {Object.entries(entry.regions).map(([region, rating]) => `${t(`fit.region.${region}`)}: ${t(`fit.rating.${rating}`)}`).join(" · ")}</p>
      <Button disabled={busy} onClick={() => void remove(entry)}>{t("fit.deleteFeedback")}</Button></div>)}
  </div></details>;
}
