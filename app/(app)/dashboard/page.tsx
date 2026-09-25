"use client";
import { useState } from "react";
import { api, qs } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import Link from "next/link";
import { ApiError } from "@/lib/api/client";
import { Button, Card, ErrorState, Field, Input, PageHeader, Skeleton } from "@/components/ui";
import { TimeSeries } from "@/components/charts";

const ISSUER_LABEL: Record<string, string> = { suggested: "Vínculos sugeridos", accepted: "Aceitos pelos usuários", approved: "Aprovados por você", pendingReview: "Aguardando sua revisão", activeSeals: "Selos ativos", redemptions: "Resgates", conversionSealToRedemption: "Conversão selo → resgate (%)" };

/** Dashboard do emissor (marca/celebridade): selos, vínculos, resgates e série de vínculos no período. */
function IssuerDashboard() {
  const { t, fmtNumber } = useI18n();
  const today = new Date().toISOString().slice(0, 10); const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [f, setF] = useState({ from: monthAgo, to: today }); const [applied, setApplied] = useState(f);
  const { data, loading, error, reload } = useApi<{ filter: unknown; metrics: Record<string, number | string>; bondSeries: Record<string, unknown>[]; layout: unknown }>((signal) => api.get(`/api/me/issuer-dashboard${qs(applied)}`, { signal }), [JSON.stringify(applied)]);
  if (error instanceof ApiError && error.status === 403) return (
    <div role="alert" className="surface mx-auto mt-6 max-w-lg p-6 text-center"><p className="type-label text-mark">{t("common.n403_acesso_negado")}</p><h1 className="type-h2 mt-1">{t("dashboard.painel_exclusivo_de_marcas_e")}</h1>
      <p className="type-body mt-2 text-muted">{error.message}</p><Link href="/feed" className="btn mt-4">{t("common.voltar_ao_feed")}</Link></div>);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader title={t("dashboard.dashboard_do_emissor")} kicker={t("dashboard.rf20_rf22")} />
      <form className="mb-4 grid gap-2 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); setApplied(f); }}><Field label={t("dashboard.from")} id="from"><Input id="from" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field><Field label={t("dashboard.to")} id="to"><Input id="to" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field><div className="flex items-end"><Button type="submit" variant="primary">{t("dashboard.apply")}</Button></div></form>
      {loading || !data ? <Skeleton className="h-64" /> : <><div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(data.metrics).filter(([, v]) => typeof v === "number").map(([k, v]) => <Card key={k} className="p-3"><p className="label">{ISSUER_LABEL[k] ?? k.replace(/([A-Z])/g, " $1").toLowerCase()}</p><p className="hero-number text-2xl">{fmtNumber(Number(v))}</p></Card>)}</div><Card><h2 className="type-h3 mb-2">{t("dashboard.vinculos_por_dia")}</h2><TimeSeries data={data.bondSeries} keys={[{ key: "value", label: t("dashboard.vinculos") }]} kind="area" /></Card></>}
    </>
  );
}
export default function IssuerDashboardPage() { return <RequireAuth><IssuerDashboard /></RequireAuth>; }
