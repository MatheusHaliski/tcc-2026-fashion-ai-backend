"use client";
import { useState } from "react";
import { api, qs } from "@/lib/api/client";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import Link from "next/link";
import { ApiError } from "@/lib/api/client";
import { Button, Card, ErrorState, Field, Input, PageHeader, Skeleton } from "@/components/ui";
import { TimeSeries } from "@/components/charts";
import { IssuerCenter, useIssuerReview } from "@/components/issuer-review";
import { IssuerHypeBlock, type IssuerHype } from "@/components/hype/hype-dashboards";

const ISSUER_LABEL: Record<string, string> = { get suggested() { return tr("dashboard.vinculos_sugeridos"); }, get accepted() { return tr("dashboard.aceitos_pelos_usuarios"); }, get approved() { return tr("dashboard.aprovados_por_voce"); }, get pendingReview() { return tr("dashboard.aguardando_sua_revisao"); }, get activeSeals() { return tr("dashboard.selos_ativos"); }, get redemptions() { return tr("common.resgates"); }, get conversionSealToRedemption() { return tr("dashboard.conversao_selo_resgate"); } };

/**
 * Dashboard do emissor (marca/celebridade): selos, vínculos, resgates e série de vínculos no período. RF53 (P2-20): o
 * bloco "Hype dos looks vinculados" mostra a média do HypeScore v2, o Δ7d e o top 3 — só looks públicos.
 */
function IssuerDashboard() {
  const { t, fmtNumber } = useI18n();
  const today = new Date().toISOString().slice(0, 10); const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [f, setF] = useState({ from: monthAgo, to: today }); const [applied, setApplied] = useState(f);
  const { data, loading, error, reload } = useApi<{ filter: unknown; metrics: Record<string, number | string>; bondSeries: Record<string, unknown>[]; layout: unknown; hype?: IssuerHype | null }>((signal) => api.get(`/api/me/issuer-dashboard${qs(applied)}`, { signal }), [JSON.stringify(applied)]);
  // perfil ainda em análise: o painel do examinador no lugar do "acesso negado"
  if (error instanceof ApiError && error.status === 403 && error.code === "PERFIL_EM_VALIDACAO") return <PendingReview />;
  if (error instanceof ApiError && error.status === 403) return (
    <div role="alert" className="surface mx-auto mt-6 max-w-lg p-6 text-center"><p className="type-label text-mark">{t("common.n403_acesso_negado")}</p><h1 className="type-h2 mt-1">{t("dashboard.painel_exclusivo_de_marcas_e")}</h1>
      <p className="type-body mt-2 text-muted">{error.message}</p><Link href="/feed" className="btn mt-4">{t("common.voltar_ao_feed")}</Link></div>);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader title={t("dashboard.dashboard_do_emissor")} kicker={t("dashboard.rf20_rf22")} />
      <form className="mb-4 grid gap-2 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); setApplied(f); }}><Field label={t("dashboard.from")} id="from"><Input id="from" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field><Field label={t("dashboard.to")} id="to"><Input id="to" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field><div className="flex items-end"><Button type="submit" variant="primary">{t("dashboard.apply")}</Button></div></form>
      {loading || !data ? <Skeleton className="h-64" /> : <><div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(data.metrics).filter(([, v]) => typeof v === "number").map(([k, v]) => <Card key={k} className="p-3"><p className="label">{ISSUER_LABEL[k] ?? k.replace(/([A-Z])/g, " $1").toLowerCase()}</p><p className="hero-number text-2xl">{fmtNumber(Number(v))}</p></Card>)}</div><Card><h2 className="type-h3 mb-2">{t("dashboard.vinculos_por_dia")}</h2><TimeSeries data={data.bondSeries} keys={[{ key: "value", label: t("dashboard.vinculos") }]} kind="area" /></Card><IssuerHypeBlock data={data.hype} /></>}
    </>
  );
}
function PendingReview() {
  const { t } = useI18n(); const review = useIssuerReview();
  return (
    <div className="mx-auto mt-6 max-w-5xl">
      <h1 className="type-h2 mb-1">{t("issuerReview.central")}</h1>
      <p className="mb-4 type-body-sm text-muted">{t("issuerReview.dashboard_apos_aprovacao")}{review.data?.slug && <> <Link href={`/brands/${review.data.slug}?tab=CENTRAL`} className="underline">{t("issuerReview.abrir_no_perfil")}</Link></>}</p>
      <IssuerCenter review={review} />
    </div>
  );
}
export default function IssuerDashboardPage() { return <RequireAuth><IssuerDashboard /></RequireAuth>; }
