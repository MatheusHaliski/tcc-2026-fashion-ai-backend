"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, qs } from "@/lib/api/client";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, Dialog, ErrorState, Field, Input, PageHeader, Select, Skeleton, Switch, useToast } from "@/components/ui";
import { Bars, Donut, TimeSeries } from "@/components/charts";
import { FaiIcon } from "@/components/fai-icon";
import { Globe, countryName } from "@/components/globe";
import { label } from "@/lib/api/taxonomy";
import { BrandLogo } from "@/components/brand-logo";

type Row = Record<string, unknown>;
interface Dash { filter: { from: string; to: string; country?: string | null; profileType?: string | null }; kpis: Record<string, number>; series: Record<string, Row[]>; aiUsage: Row[]; aiByCountry: Row[]; aiProviders: Record<string, boolean>; brands: Row[]; countries: Row[]; hypeBands: Row[]; inventoryBands: Row[]; sealFunnel: Row[]; challenges: Row[]; points: Row[]; profiles: Row[]; alerts: { level: string; title: string; action?: string }[]; layout: { widgets: string[]; hidden: string[]; defaultFilter?: { days?: number } }; }
const WIDGET_LABEL: Record<string, string> = { get alerts() { return tr("admin.dashboard.alertas_para_decisao"); }, get kpis() { return tr("admin.dashboard.indicadores_do_periodo"); }, get growth() { return tr("admin.dashboard.novos_usuarios_por_dia"); }, get content() { return tr("admin.dashboard.conteudo_criado_por_dia"); }, get countries() { return tr("admin.dashboard.mapa_usuarios_e_looks_por"); }, get ai_by_country() { return tr("admin.dashboard.em_qual_pais_a_ia"); }, get ai_cost() { return tr("admin.dashboard.custo_de_ia_por_dia"); }, get ai_usage() { return tr("admin.dashboard.uso_de_ia_por_capacidade"); }, get brands() { return tr("admin.dashboard.marcas_mais_usadas_no_acervo"); }, get hype_bands() { return tr("admin.dashboard.faixas_de_hype_score_looks"); }, get inventory_bands() { return tr("admin.dashboard.faixas_de_inventory_score"); }, get seal_funnel() { return tr("admin.dashboard.funil_de_selos_vinculos_por"); }, get challenges() { return tr("admin.dashboard.desafios_participantes"); }, get points() { return tr("admin.dashboard.fai_points_por_acao"); }, get profiles() { return tr("admin.dashboard.usuarios_por_tipo_de_perfil"); } };
const PROFILE_LABEL: Record<string, string> = { get PESSOAL() { return tr("auth.profilePersonal"); }, get MARCA() { return tr("auth.profileBrand"); }, get CELEBRIDADE() { return tr("auth.profileCelebrity"); } };
/** Soma linhas repetidas (ex.: mesma capacidade em vários provedores) e troca o código pelo rótulo em português. */
function agg(rows: Row[], key: string, val: string, name: (k: string) => string = (k) => label(k)): Row[] {
  const m = new Map<string, number>(); rows.forEach((r) => { const k = String(r[key] ?? "—"); m.set(k, (m.get(k) ?? 0) + Number(r[val] ?? 0)); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: name(k), value: Math.round(v * 10000) / 10000 }));
}
const KPI_LABEL: Record<string, string> = { get new_users() { return tr("admin.dashboard.novos_usuarios_2"); }, get active_users() { return tr("admin.dashboard.usuarios_ativos"); }, get pieces_created() { return tr("admin.dashboard.pecas_cadastradas"); }, get schemes_created() { return tr("admin.dashboard.looks_criados"); }, get schemes_published() { return tr("admin.dashboard.looks_publicados"); }, get daily_looks() { return tr("admin.dashboard.looks_do_dia"); }, get ai_calls() { return tr("admin.dashboard.chamadas_de_ia"); }, get ai_cost_usd() { return tr("admin.dashboard.custo_de_ia_usd"); }, get ai_fallback_pct() { return tr("admin.dashboard.fallback_de_ia"); }, get moderation_pending() { return tr("admin.dashboard.moderacao_pendente"); }, get bonds_approved() { return tr("admin.dashboard.vinculos_aprovados"); }, get redemptions() { return tr("common.resgates"); }, get points_issued() { return tr("admin.dashboard.pontos_emitidos"); }, get approvals_pending() { return tr("admin.dashboard.aprovacoes_pendentes"); } };

function AdminDashboard() {
  const { t, fmtNumber, fmtMoney, rich } = useI18n(); const toast = useToast();
  const usd = (v: number) => (v > 0 && v < 1 ? `US$ ${v.toFixed(4).replace(".", ",")}` : fmtMoney(v, "USD"));
  const today = new Date().toISOString().slice(0, 10); const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [f, setF] = useState({ from: monthAgo, to: today, country: "", profileType: "" }); const [applied, setApplied] = useState(f);
  const { data, loading, error, reload } = useApi<Dash>((signal) => api.get(`/api/admin/dashboard${qs(applied)}`, { signal }), [JSON.stringify(applied)]);
  const [custom, setCustom] = useState(false); const [dragging, setDragging] = useState<string | null>(null); const [layout, setLayout] = useState<{ widgets: string[]; hidden: string[] }>({ widgets: [], hidden: [] });
  useEffect(() => { if (data?.layout) setLayout({ widgets: data.layout.widgets, hidden: data.layout.hidden }); }, [data]);
  async function saveLayout() { try { await api.put("/api/me/dashboard-layout", { widgets: layout.widgets, hidden: layout.hidden, defaultFilter: { days: 30, country: applied.country || null, profileType: applied.profileType || null } }); toast.success(t("dashboard.layoutSaved")); setCustom(false); } catch (e) { toast.fromError(e); } }
  async function hideWidget(w: string) {
    const next = { widgets: layout.widgets.length ? layout.widgets : Object.keys(WIDGET_LABEL), hidden: [...layout.hidden, w] }; setLayout(next);
    try { await api.put("/api/me/dashboard-layout", { ...next, defaultFilter: { days: 30, country: applied.country || null, profileType: applied.profileType || null } }); toast.info(t("admin.dashboard.oculto_reative_em_personalizar", { value: WIDGET_LABEL[w] ?? w })); } catch (e) { toast.fromError(e); }
  }
  const move = (w: string, dir: -1 | 1) => setLayout((l) => { const i = l.widgets.indexOf(w); const j = i + dir; if (i < 0 || j < 0 || j >= l.widgets.length) return l; const arr = [...l.widgets]; [arr[i], arr[j]] = [arr[j], arr[i]]; return { ...l, widgets: arr }; });
  const exportCsv = () => { if (!data) return; const rows = Object.entries(data.kpis).map(([k, v]) => `${k},${v}`); const csv = `metric,value\n${rows.join("\n")}`; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `fashionai-kpis-${applied.from}-${applied.to}.csv`; a.click(); };
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const widgets = (layout.widgets.length ? layout.widgets : Object.keys(WIDGET_LABEL)).filter((w) => !layout.hidden.includes(w));
  const from = data?.filter.from?.slice(0, 10), to = data?.filter.to?.slice(0, 10);
  const render = (w: string) => {
    if (!data) return null;
    switch (w) {
      case "kpis": return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{Object.entries(data.kpis).map(([k, v]) => <Card key={k} className="p-3"><p className="label">{KPI_LABEL[k] ?? k}</p><p className="hero-number text-2xl">{k === "ai_cost_usd" ? usd(Number(v)) : k.endsWith("pct") ? `${fmtNumber(v)}%` : fmtNumber(v)}</p></Card>)}</div>;
      case "growth": return <TimeSeries data={data.series.users ?? []} keys={[{ key: "value", label: t("admin.dashboard.novos_usuarios") }]} kind="area" from={from} to={to} />;
      case "content": { const byDay = new Map<string, Row>(); ([["pieces", "pecas"], ["schemes", "looks"], ["daily_looks", "lookDoDia"]] as const).forEach(([m, k]) => (data.series[m] ?? []).forEach((r) => { const d = String(r.day).slice(0, 10); byDay.set(d, { ...(byDay.get(d) ?? { day: d, pecas: 0, looks: 0, lookDoDia: 0 }), [k]: Number(r.value) }); }));
        return <TimeSeries data={[...byDay.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)))} keys={[{ key: "pecas", label: t("common.pieces") }, { key: "looks", label: t("common.looks") }, { key: "lookDoDia", label: t("lookbook.daily") }]} from={from} to={to} />; }
      case "ai_cost": return <TimeSeries data={data.series.ai_cost ?? []} keys={[{ key: "value", label: "USD" }]} kind="bar" from={from} to={to} />;
      case "ai_usage": { const rows = agg(data.aiUsage, "capability", "calls"); return rows.length ? <Bars data={rows} x="name" y="value" horizontal height={Math.max(200, rows.length * 26)} /> : <p className="type-body text-muted">{t("admin.dashboard.sem_chamadas_de_ia_no")}</p>; }
      case "ai_by_country": return data.aiByCountry.length === 0 ? <p className="type-body text-muted">{t("admin.dashboard.sem_chamadas_de_ia_de")}</p> : (
        <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <Bars data={data.aiByCountry.map((r) => ({ name: countryName(String(r.country)), value: Number(r.cost_per_user ?? 0) }))} x="name" y="value" horizontal height={Math.max(180, data.aiByCountry.length * 28)} />
          <table className="w-full type-caption"><thead><tr className="text-left text-muted"><th>{t("auth.country")}</th><th className="text-right">{t("common.usuarios")}</th><th className="text-right">{t("admin.dashboard.chamadas")}</th><th className="text-right">{t("admin.dashboard.custo")}</th><th className="text-right">{t("admin.dashboard.por_usuario")}</th><th className="text-right">{t("admin.dashboard.fallback")}</th></tr></thead>
            <tbody>{data.aiByCountry.map((r, i) => <tr key={String(r.country)} className="border-t border-line-soft"><td>{i === 0 ? <b>{countryName(String(r.country))}</b> : countryName(String(r.country))}</td><td className="text-right type-data">{fmtNumber(Number(r.users))}</td><td className="text-right type-data">{fmtNumber(Number(r.calls))}</td><td className="text-right type-data">{usd(Number(r.cost_usd ?? 0))}</td><td className="text-right type-data">{usd(Number(r.cost_per_user ?? 0))}</td><td className="text-right type-data">{fmtNumber(Number(r.fallback_pct ?? 0))}%</td></tr>)}</tbody></table>
          <p className="type-caption text-muted lg:col-span-2">{rich("admin.dashboard.resposta_por_usuario_no_periodo", { countryName: countryName(String(data.aiByCountry[0].country)), usd: usd(Number(data.aiByCountry[0].cost_per_user ?? 0)) }, { 0: ($c) => <b>{$c}</b> })}</p>
        </div>);
      case "brands": { const max = Math.max(1, ...data.brands.map((r) => Number(r.pieces)));
        return <ul className="grid gap-1.5">{data.brands.map((r) => <li key={String(r.brand)} className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] items-center gap-3 type-caption"><BrandLogo name={String(r.brand)} size={24} withName /><span className="h-2.5 rounded bg-surface-2"><span className="block h-full rounded bg-thread" style={{ width: `${(Number(r.pieces) / max) * 100}%` }} /></span><span className="whitespace-nowrap text-right type-data">{t("admin.dashboard.pecas_donos_hype", { number: fmtNumber(Number(r.pieces)), number2: fmtNumber(Number(r.owners ?? 0)), value: r.avg_hype != null ? Math.round(Number(r.avg_hype)) : "—" })}</span></li>)}</ul>; }
      case "countries": { const max = Math.max(1, ...data.countries.map((c) => Number(c.users) + Number(c.public_schemes)));
        return (
          <div className="grid items-start gap-3 lg:grid-cols-[360px_1fr]">
            <Globe size={340} points={data.countries.map((c) => ({ country: String(c.country), schemes: Number(c.public_schemes), pieces: 0, total: Number(c.users) + Number(c.public_schemes), avg_hype: c.avg_hype == null ? null : Number(c.avg_hype), sufficient: Number(c.users) > 0, dominantColorHex: null }))} selected={f.country || undefined} onSelect={(iso) => { const next = { ...f, country: iso }; setF(next); setApplied(next); }} />
            <ul className="grid gap-1.5">{data.countries.map((c) => <li key={String(c.country)}><button type="button" className="grid w-full grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-3 rounded px-1 py-0.5 text-left type-caption hover:bg-surface-2" onClick={() => { const next = { ...f, country: String(c.country) }; setF(next); setApplied(next); }}><span>{countryName(String(c.country))}</span><span className="h-2 rounded bg-thread" style={{ width: `${((Number(c.users) + Number(c.public_schemes)) / max) * 100}%` }} /><span className="whitespace-nowrap text-right type-data">{t("admin.dashboard.usuarios_looks", { number: fmtNumber(Number(c.users)), number2: fmtNumber(Number(c.public_schemes)) })}</span></button></li>)}</ul>
            <p className="type-caption text-muted lg:col-span-2">{t("admin.dashboard.clique_num_pais_no_globo")}</p>
          </div>); }
      case "hype_bands": return <Donut data={data.hypeBands.map((r) => ({ name: label(String(r.band)), value: Number(r.total) }))} x="name" y="value" />;
      case "inventory_bands": return data.inventoryBands.length ? <Donut data={data.inventoryBands.map((r) => ({ name: label(String(r.band)), value: Number(r.total) }))} x="name" y="value" /> : <p className="type-body text-muted">{t("admin.dashboard.sem_snapshots_de_inventory_score")}</p>;
      case "seal_funnel": return data.sealFunnel.length ? <Bars data={agg(data.sealFunnel, "status", "total")} x="name" y="value" /> : <p className="type-body text-muted">{t("admin.dashboard.nenhum_vinculo_de_selo_no")}</p>;
      case "challenges": return data.challenges.length ? <Bars data={agg(data.challenges, "template", "participants")} x="name" y="value" horizontal /> : <p className="type-body text-muted">{t("admin.dashboard.nenhum_desafio")}</p>;
      case "points": return data.points.length ? <Bars data={agg(data.points, "action_code", "points")} x="name" y="value" horizontal height={Math.max(200, data.points.length * 24)} /> : <p className="type-body text-muted">{t("admin.dashboard.nenhum_ponto_no_periodo")}</p>;
      case "profiles": return <Donut data={agg(data.profiles, "profile_type", "total", (k) => PROFILE_LABEL[k] ?? k)} x="name" y="value" />;
      case "alerts": return data.alerts.length === 0 ? <p className="type-body text-muted">{t("admin.dashboard.nenhum_alerta_no_periodo")}</p> : <ul className="grid gap-2">{data.alerts.map((a, i) => <li key={i} className={`rounded-md p-2 type-body-sm ${a.level === "critical" ? "bg-critical/15" : a.level === "warning" ? "bg-warning/20" : "bg-surface-2"}`}><Badge tone={a.level === "info" ? "thread" : "mark"}>{a.level === "warning" ? t("admin.dashboard.atencao") : a.level === "critical" ? t("admin.dashboard.critico") : t("admin.dashboard.info")}</Badge> <b>{a.title}</b>{a.action ? <span className="text-muted"> — {a.action}</span> : null}</li>)}</ul>;
      default: return null;
    }
  };
  return (
    <>
      <PageHeader title={t("dashboard.title")} kicker={t("admin.dashboard.admin")} lead={t("admin.dashboard.procedures_e_views_no_mysql")} actions={<><Button onClick={exportCsv}>{t("dashboard.export")}</Button><Button onClick={() => setCustom(true)}>{t("dashboard.customize")}</Button><Link href="/admin/users" className="btn">{t("common.usuarios")}</Link><Link href="/admin/moderation" className="btn">{t("admin.dashboard.moderacao")}</Link><Link href="/admin/system" className="btn">{t("common.ia_sistema")}</Link></>} />
      <form className="mb-4 grid gap-2 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); setApplied(f); }}>
        <Field label={t("dashboard.from")} id="from"><Input id="from" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label={t("dashboard.to")} id="to"><Input id="to" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label={t("dashboard.country")} id="country"><Select id="country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}><option value="">{t("common.all")}</option>{(data?.countries ?? []).map((c) => <option key={String(c.country)} value={String(c.country)}>{countryName(String(c.country))}</option>)}</Select></Field>
        <Field label={t("dashboard.profileType")} id="profileType"><Select id="profileType" value={f.profileType} onChange={(e) => setF({ ...f, profileType: e.target.value })}><option value="">{t("common.all")}</option>{["PESSOAL", "MARCA", "CELEBRIDADE"].map((p) => <option key={p} value={p}>{PROFILE_LABEL[p]}</option>)}</Select></Field>
        <div className="flex items-end"><Button type="submit" variant="primary" className="w-full"><FaiIcon id="ACT-12" size={24} decorative />{t("dashboard.apply")}</Button></div>
      </form>
      {loading && <Skeleton className="h-96" />}
      {data && <div className="grid gap-4">{widgets.map((w) => <section key={w} aria-label={WIDGET_LABEL[w]}>{w !== "kpis" ? <Card><div className="mb-2 flex items-start gap-2"><h2 className="type-h3 flex-1">{WIDGET_LABEL[w] ?? w}</h2><Button size="sm" variant="ghost" aria-label={t("admin.dashboard.ocultar", { value: WIDGET_LABEL[w] ?? w })} onClick={() => hideWidget(w)}>{t("admin.dashboard.ocultar_2")}</Button></div>{render(w)}</Card> : render(w)}</section>)}</div>}
      {data && <p className="mt-3 type-caption text-faint">{t("admin.dashboard.provedores_de_ia")}{" "}{Object.entries(data.aiProviders).map(([k, v]) => `${k} ${v ? "✓" : "✗"}`).join(" · ")}</p>}
      <Dialog open={custom} onClose={() => setCustom(false)} title={t("dashboard.customize")} footer={<Button variant="primary" onClick={saveLayout}>{t("common.save")}</Button>}>
        <p className="mb-2 type-caption text-muted">{t("admin.dashboard.arraste_as_linhas_para_mudar")}</p>
        <ul className="divide-y divide-line-soft">{(layout.widgets.length ? layout.widgets : Object.keys(WIDGET_LABEL)).map((w) => <li key={w} className={`flex items-center gap-2 py-1 ${dragging === w ? "opacity-40" : ""}`} draggable
          onDragStart={(e) => { setDragging(w); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDragging(null)}
          onDragOver={(e) => { e.preventDefault(); if (!dragging || dragging === w) return; setLayout((l) => { const arr = [...(l.widgets.length ? l.widgets : Object.keys(WIDGET_LABEL))].filter((x) => x !== dragging); arr.splice(arr.indexOf(w), 0, dragging); return { ...l, widgets: arr }; }); }}>
          <span className="cursor-grab select-none text-faint" aria-hidden>⋮⋮</span><span className="flex-1 type-body">{WIDGET_LABEL[w] ?? w}</span><Button size="sm" variant="ghost" onClick={() => move(w, -1)} aria-label={t("common.subir")}>↑</Button><Button size="sm" variant="ghost" onClick={() => move(w, 1)} aria-label={t("common.descer")}>↓</Button><Switch checked={!layout.hidden.includes(w)} onChange={(v) => setLayout((l) => ({ ...l, hidden: v ? l.hidden.filter((x) => x !== w) : [...l.hidden, w] }))} label="" /></li>)}</ul>
      </Dialog>
    </>
  );
}
export default function AdminDashboardPage() { return <RequireAuth admin><AdminDashboard /></RequireAuth>; }
