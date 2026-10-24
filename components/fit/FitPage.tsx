"use client";
import { useEffect, useState } from "react";
import { Button, Card, Field, Input, PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { fitApi, type FitProfile } from "@/lib/api/fit";
import { FitMeasurementForm } from "./FitMeasurementForm";
import { ProductFitDialog } from "./ProductFitDialog";

export function FitPage() {
  const { t } = useI18n(); const [profile, setProfile] = useState<FitProfile | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [attempt, setAttempt] = useState(0); const [product, setProduct] = useState(""); const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    void fitApi.profile(controller.signal).then(value => { if (!controller.signal.aborted) setProfile(value); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("fit.error")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt, t]);
  return <div><PageHeader title={t("fit.title")} lead={t("fit.disclaimer")} />
    <div className="grid gap-5"><Card><h2 className="type-h2 mb-3">{t("fit.myMeasurements")}</h2>
      {loading ? <p role="status">{t("fit.loading")}</p> : error ? <div role="alert"><p>{error}</p><Button onClick={() => setAttempt(value => value + 1)}>{t("fit.retry")}</Button></div>
        : <FitMeasurementForm key={profile ? `${profile.version}-${profile.measuredAt}` : "empty"} profile={profile} onSaved={setProfile} />}
    </Card><Card><form className="grid gap-3" onSubmit={event => { event.preventDefault(); if (product.trim()) setSelected(product.trim()); }}>
      <Field id="fit-product-id" label={t("fit.productId")} hint={t("fit.productIdHelp")}><Input id="fit-product-id" value={product} onChange={event => setProduct(event.target.value)} pattern="[0-9a-fA-F-]{36}" required /></Field>
      <Button type="submit" disabled={!product.trim()}>{t("fit.openProduct")}</Button></form></Card></div>
    {selected && <ProductFitDialog productId={selected} open onClose={() => { setSelected(null); setAttempt(value => value + 1); }} />}
  </div>;
}
