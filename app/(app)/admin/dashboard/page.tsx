"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, qs } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, Dialog, ErrorState, Field, Input, PageHeader, Select, Skeleton, Switch, useToast } from "@/components/ui";
import { Bars, Donut, TimeSeries } from "@/components/charts";
import { FaiIcon } from "@/components/fai-icon";

type Row = Record<string, unknown>;
interface Dash { filter: { from: string; to: string; country?: string | null; profileType?: string | null }; kpis: Record<string, number>; series: Record<string, Row[]>; aiUsage: Row[]; aiProviders: Record<string, boolean>; brands: Row[]; countries: Row[]; hypeBands: Row[]; inventoryBands: Row[]; sealFunnel: Row[]; challenges: Row[]; points: Row[]; profiles: Row[]; alerts: { level: string; message: string; metric?: string }[]; layout: { widgets: string[]; hidden: string[]; defaultFilter?: { days?: number } }; }
const WIDGET_LABEL: Record<string, string> = { kpis: "Indicadores", growth: "Crescimento (usuários, peças, looks)", content: "Conteúdo publicado", ai_cost: "Custo de IA (USD)", ai_usage: "Uso de IA por capacidade", brands: "Marcas mais usadas", countries: "Países", hype_bands: "Faixas de Hype Score", inventory_bands: "Faixas de Inventory Score", seal_funnel: "Funil de selos", challenges: "Desafios", points: "FAI Points por ação", profiles: "Usuários por perfil", alerts: "Alertas" };
const KPI_LABEL: Record<string, string> = { new_users: "Novos usuários", active_users: "Usuários ativos", pieces_created: "Peças cadastradas", schemes_created: "Looks criados", schemes_published: "Looks publicados", daily_looks: "Looks do Dia", ai_calls: "Chamadas de IA", ai_cost_usd: "Custo de IA (USD)", ai_fallback_pct: "Fallback de IA (%)", moderation_pending: "Moderação pendente", bonds_approved: "Vínculos aprovados", redemptions: "Resgates", points_issued: "Pontos emitidos", approvals_pending: "Aprovações pendentes" };

function AdminDashboard() {
  const { t, fmtNumber, fmtMoney } = useI18n(); const toast = useToast();
  const today = new Date().toISOString().slice(0, 10); const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [f, setF] = useState({ from: monthAgo, to: today, country: "", profileType: "" }); const [applied, setApplied] = useState(f);
  const { data, loading, error, reload } = useApi<Dash>((signal) => api.get(`/api/admin/dashboard${qs(applied)}`, { signal }), [JSON.stringify(applied)]);
  const [custom, setCustom] = useState(false); const [layout, setLayout] = useState<{ widgets: string[]; hidden: string[] }>({ widgets: [], hidden: [] });
  useEffect(() => { if (data?.layout) setLayout({ widgets: data.layout.widgets, hidden: data.layout.hidden }); }, [data]);
  async function saveLayout() { try { await api.put("/api/me/dashboard-layout", { widgets: layout.widgets, hidden: layout.hidden, defaultFilter: { days: 30, country: applied.country || null, profileType: applied.profileType || null } }); toast.success(t("dashboard.layoutSaved")); setCustom(false); } catch (e) { toast.fromError(e); } }
  const move = (w: string, dir: -1 | 1) => setLayout((l) => { const i = l.widgets.indexOf(w); const j = i + dir; if (i < 0 || j < 0 || j >= l.widgets.length) return l; const arr = [...l.widgets]; [arr[i], arr[j]] = [arr[j], arr[i]]; return { ...l, widgets: arr }; });
  const exportCsv = () => { if (!data) return; const rows = Object.entries(data.kpis).map(([k, v]) => `${k},${v}`); const csv = `metric,value\n${rows.join("\n")}`; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `fashionai-kpis-${applied.from}-${applied.to}.csv`; a.click(); };
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const widgets = (layout.widgets.length ? layout.widgets : Object.keys(WIDGET_LABEL)).filter((w) => !layout.hidden.includes(w));
  const render = (w: string) => {
    if (!data) return null;
    switch (w) {
      case "kpis": return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{Object.entries(data.kpis).map(([k, v]) => <Card key={k} className="p-3"><p className="label">{KPI_LABEL[k] ?? k}</p><p className="hero-number text-2xl">{k === "ai_cost_usd" ? fmtMoney(v, "USD") : k.endsWith("pct") ? `${fmtNumber(v)}%` : fmtNumber(v)}</p></Card>)}</div>;
      case "growth": return <TimeSeries data={data.series.users ?? data.series.growth ?? []} keys={[{ key: "value", label: "novos usuários" }]} kind="area" />;
      case "content": return <TimeSeries data={(data.series.pieces ?? []).map((r, i) => ({ day: r.day, pecas: r.value, looks: (data.series.schemes ?? [])[i]?.value ?? 0, publicados: (data.series.published ?? [])[i]?.value ?? 0 }))} keys={[{ key: "pecas", label: "peças" }, { key: "looks", label: "looks" }, { key: "publicados", label: "publicados" }]} />;
      case "ai_cost": return <TimeSeries data={data.series.ai_cost ?? data.series.aiCost ?? []} keys={[{ key: "value", label: "USD" }]} kind="bar" />;
      case "ai_usage": return <Bars data={data.aiUsage} x="capability" y="calls" horizontal height={Math.max(200, data.aiUsage.length * 26)} />;
      case "brands": return <Bars data={data.brands} x="brand" y="pieces" horizontal />;
      case "countries": return <Bars data={data.countries} x="country" y="users" />;
      case "hype_bands": return <Donut data={data.hypeBands} x="band" y="total" />;
      case "inventory_bands": return <Donut data={data.inventoryBands} x="band" y="total" />;
      case "seal_funnel": return <Bars data={data.sealFunnel} x="stage" y="total" />;
      case "challenges": return <Bars data={data.challenges} x="code" y="participants" horizontal />;
      case "points": return <Bars data={data.points} x="action" y="points" horizontal />;
      case "profiles": return <Donut data={data.profiles} x="profile_type" y="total" />;
      case "alerts": return data.alerts.length === 0 ? <p className="type-body text-muted">Nenhum alerta.</p> : <ul className="grid gap-2">{data.alerts.map((a, i) => <li key={i} className={`rounded-md p-2 type-body-sm ${a.level === "CRITICAL" ? "bg-critical/15" : a.level === "WARNING" ? "bg-warning/20" : "bg-surface-2"}`}><Badge tone={a.level === "CRITICAL" ? "mark" : "chalk"}>{a.level}</Badge> {a.message}</li>)}</ul>;
      default: return null;
    }
  };
  return (
    <>
      <PageHeader title={t("dashboard.title")} kicker="Admin" lead="Procedures e views no MySQL (sp_admin_kpis, sp_timeseries, vw_country_insights) alimentam estes widgets." actions={<><Button onClick={exportCsv}>{t("dashboard.export")}</Button><Button onClick={() => setCustom(true)}>{t("dashboard.customize")}</Button><Link href="/admin/users" className="btn">Usuários</Link><Link href="/admin/moderation" className="btn">Moderação</Link><Link href="/admin/system" className="btn">IA & sistema</Link></>} />
      <form className="mb-4 grid gap-2 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); setApplied(f); }}>
        <Field label={t("dashboard.from")} id="from"><Input id="from" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label={t("dashboard.to")} id="to"><Input id="to" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label={t("dashboard.country")} id="country"><Select id="country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}><option value="">{t("common.all")}</option>{(data?.countries ?? []).map((c) => <option key={String(c.country)} value={String(c.country)}>{String(c.country)}</option>)}</Select></Field>
        <Field label={t("dashboard.profileType")} id="profileType"><Select id="profileType" value={f.profileType} onChange={(e) => setF({ ...f, profileType: e.target.value })}><option value="">{t("common.all")}</option>{["PESSOAL", "MARCA", "CELEBRIDADE"].map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field>
        <div className="flex items-end"><Button type="submit" variant="primary" className="w-full"><FaiIcon id="ACT-12" size={24} decorative />{t("dashboard.apply")}</Button></div>
      </form>
      {loading && <Skeleton className="h-96" />}
      {data && <div className="grid gap-4">{widgets.map((w) => <section key={w} aria-label={WIDGET_LABEL[w]}>{w !== "kpis" ? <Card><h2 className="type-h3 mb-2">{WIDGET_LABEL[w] ?? w}</h2>{render(w)}</Card> : render(w)}</section>)}</div>}
      {data && <p className="mt-3 type-caption text-faint">Provedores de IA: {Object.entries(data.aiProviders).map(([k, v]) => `${k} ${v ? "✓" : "✗"}`).join(" · ")}</p>}
      <Dialog open={custom} onClose={() => setCustom(false)} title={t("dashboard.customize")} footer={<Button variant="primary" onClick={saveLayout}>{t("common.save")}</Button>}>
        <ul className="divide-y divide-line-soft">{(layout.widgets.length ? layout.widgets : Object.keys(WIDGET_LABEL)).map((w) => <li key={w} className="flex items-center gap-2 py-1"><span className="flex-1 type-body">{WIDGET_LABEL[w] ?? w}</span><Button size="sm" variant="ghost" onClick={() => move(w, -1)} aria-label="subir">↑</Button><Button size="sm" variant="ghost" onClick={() => move(w, 1)} aria-label="descer">↓</Button><Switch checked={!layout.hidden.includes(w)} onChange={(v) => setLayout((l) => ({ ...l, hidden: v ? l.hidden.filter((x) => x !== w) : [...l.hidden, w] }))} label="" /></li>)}</ul>
      </Dialog>
    </>
  );
}
export default function AdminDashboardPage() { return <RequireAuth admin><AdminDashboard /></RequireAuth>; }
