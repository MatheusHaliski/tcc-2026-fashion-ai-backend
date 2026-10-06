"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { api, qs } from "@/lib/api/client";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, Dialog, ErrorState, Field, Input, PageHeader, Select, Skeleton, Switch, Tabs, useToast } from "@/components/ui";
import { Bars, DataTable, Donut, Funnel, Heatmap, KpiTile, SERIES, TimeSeries } from "@/components/charts";
import { FaiIcon } from "@/components/fai-icon";
import { Globe, countryName } from "@/components/globe";
import { label } from "@/lib/api/taxonomy";
import { BrandLogo } from "@/components/brand-logo";
import { AdminHypeLevels, type AdminHypeV2 } from "@/components/hype/hype-dashboards";

type Row = Record<string, unknown>;
interface Dash {
  filter: { from: string; to: string; country?: string | null; profileType?: string | null };
  kpis: Record<string, number>; kpisPrevious?: Record<string, number>; series: Record<string, Row[]>;
  aiUsage: Row[]; aiByCountry: Row[]; aiProviders: Record<string, boolean>; brands: Row[]; countries: Row[]; inventoryBands: Row[];
  /** @deprecated faixas v1 (juízo de qualidade); o widget hype_bands lê `hypeV2` (RF53 · P2-21). Sai em P3-16. */
  hypeBands: Row[];
  hypeV2?: AdminHypeV2 | null;
  sealFunnel: Row[]; challenges: Row[]; points: Row[]; profiles: Row[]; alerts: { level: string; title: string; action?: string }[];
  funnel?: Row[]; heatmap?: { dow: number; hour: number; total: number }[]; topUsers?: Row[]; categories?: Row[];
  moderation?: { byStatus: Row[]; pending: Row[] }; engagement?: Row[];
  security?: { series: Row[]; failures: Row[]; recent: Row[] }; jobs?: { byStatus: Row[]; failed: Row[] };
  system?: { dbLatencyMs: number; heapUsedMb: number; heapMaxMb: number; uptimeMinutes: number; processors: number; aiRemoteEnabled: boolean; aiProviders: Record<string, boolean>; lastBackup?: { status: string; startedAt: string; sizeBytes?: number } };
  layout: { widgets: string[]; hidden: string[]; defaultFilter?: { days?: number; tab?: string } };
}
type TabId = "overview" | "users" | "content" | "engagement" | "ai" | "system";
/** Abas e os widgets de cada uma (a ordem e os ocultos vêm do layout salvo por usuário). */
const TAB_WIDGETS: Record<TabId, string[]> = {
  overview: ["alerts", "kpis", "growth", "content", "profiles"],
  users: ["funnel", "countries", "top_users", "heatmap"],
  content: ["categories", "brands", "hype_bands", "moderation"],
  engagement: ["engagement", "seal_funnel", "challenges", "points", "inventory_bands"],
  ai: ["ai_cost", "ai_usage", "ai_by_country"],
  system: ["system", "jobs", "security"],
};
const WIDE = new Set(["funnel", "alerts", "kpis", "growth", "content", "countries", "heatmap", "engagement", "ai_cost", "ai_by_country", "system", "security", "top_users", "moderation"]);
const W = (k: string) => tr(`adminDash.widget.${k}`);
const PROFILE_LABEL = (k: string) => (k === "PESSOAL" ? tr("auth.profilePersonal") : k === "MARCA" ? tr("auth.profileBrand") : k === "CELEBRIDADE" ? tr("auth.profileCelebrity") : k === "ADMIN" ? tr("adminDash.profile_admin") : k);
/** Cor fixa por tipo de perfil (a entidade decide a cor, não a posição no gráfico). */
const PROFILE_COLOR: Record<string, string> = { PESSOAL: SERIES[0], MARCA: SERIES[1], CELEBRIDADE: SERIES[2], ADMIN: SERIES[6] };
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
/** Soma linhas repetidas (mesma capacidade em vários provedores) e troca o código pelo rótulo. */
function agg(rows: Row[], key: string, val: string, name: (k: string) => string = (k) => label(k)): Row[] {
  const m = new Map<string, number>(); rows.forEach((r) => { const k = String(r[key] ?? "—"); m.set(k, (m.get(k) ?? 0) + num(r[val])); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: name(k), value: Math.round(v * 10000) / 10000 }));
}
/** Até n categorias; o resto vira "Outros" (nunca uma cor gerada para a nona série). */
function topN(rows: Row[], n: number): Row[] {
  if (rows.length <= n) return rows;
  const rest = rows.slice(n - 1).reduce((s, r) => s + num(r.value), 0);
  return [...rows.slice(0, n - 1), { name: tr("adminDash.outros"), value: Math.round(rest * 10000) / 10000 }];
}

function AdminDashboard() {
  const { t, fmtNumber, fmtMoney, fmtDateTime, rich } = useI18n(); const toast = useToast();
  const usd = (v: number) => (v > 0 && v < 1 ? `US$ ${v.toFixed(4)}` : fmtMoney(v, "USD"));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const range = (days: number) => ({ from: iso(new Date(Date.now() - (days - 1) * 86400000)), to: iso(new Date()) });
  const [f, setF] = useState({ ...range(30), country: "", profileType: "" }); const [applied, setApplied] = useState(f);
  const [tab, setTab] = useState<TabId>("overview");
  const { data, loading, error, reload } = useApi<Dash>((signal) => api.get(`/api/admin/dashboard${qs(applied)}`, { signal }), [JSON.stringify(applied)]);
  const [custom, setCustom] = useState(false); const [layout, setLayout] = useState<{ widgets: string[]; hidden: string[] }>({ widgets: [], hidden: [] });
  useEffect(() => { if (data?.layout) { setLayout({ widgets: data.layout.widgets, hidden: data.layout.hidden }); const saved = data.layout.defaultFilter?.tab as TabId | undefined; if (saved && saved in TAB_WIDGETS) setTab((cur) => (cur === "overview" ? saved : cur)); } }, [data?.layout]);
  const persist = async (next: { widgets: string[]; hidden: string[] }, tabId: TabId = tab) => {
    await api.put("/api/me/dashboard-layout", { widgets: next.widgets, hidden: next.hidden, defaultFilter: { days: 30, tab: tabId, country: applied.country || null, profileType: applied.profileType || null } });
  };
  async function saveLayout() { try { await persist(layout); toast.success(t("dashboard.layoutSaved")); setCustom(false); } catch (e) { toast.fromError(e); } }
  async function hideWidget(w: string) {
    const next = { widgets: layout.widgets.length ? layout.widgets : Object.values(TAB_WIDGETS).flat(), hidden: [...layout.hidden, w] }; setLayout(next);
    try { await persist(next); toast.info(t("adminDash.oculto", { name: W(w) })); } catch (e) { toast.fromError(e); }
  }
  const quick = (days: number) => { const next = { ...f, ...range(days) }; setF(next); setApplied(next); };
  const exportCsv = () => {
    if (!data) return;
    const rows = Object.entries(data.kpis).map(([k, v]) => `${k},${v},${data.kpisPrevious?.[k] ?? ""}`);
    const csv = `metric,value,previous\n${rows.join("\n")}`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `fashionai-kpis-${applied.from}-${applied.to}.csv`; a.click();
  };
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const order = layout.widgets.length ? layout.widgets : Object.values(TAB_WIDGETS).flat();
  const visible = (id: TabId) => order.filter((w) => TAB_WIDGETS[id].includes(w) && !layout.hidden.includes(w)).concat(TAB_WIDGETS[id].filter((w) => !order.includes(w) && !layout.hidden.includes(w)));
  const from = data?.filter.from?.slice(0, 10), to = data?.filter.to?.slice(0, 10);
  const prev = data?.kpisPrevious ?? {};

  const kpiTiles: { key: string; format: (v: number) => string; invert?: boolean }[] = [
    { key: "new_users", format: (v) => fmtNumber(v) }, { key: "active_users", format: (v) => fmtNumber(v) }, { key: "pieces_created", format: (v) => fmtNumber(v) },
    { key: "schemes_published", format: (v) => fmtNumber(v) }, { key: "daily_looks", format: (v) => fmtNumber(v) }, { key: "ai_calls", format: (v) => fmtNumber(v) },
    { key: "ai_cost_usd", format: (v) => usd(v), invert: true }, { key: "ai_fallback_pct", format: (v) => `${fmtNumber(v)}%`, invert: true },
    { key: "moderation_pending", format: (v) => fmtNumber(v), invert: true }, { key: "redemptions", format: (v) => fmtNumber(v) },
  ];
  const card = (w: string, body: ReactNode, note?: ReactNode) => (
    <Card key={w} className={WIDE.has(w) ? "lg:col-span-2" : undefined}>
      <div className="dash-card-head"><h2 className="type-h3">{W(w)}</h2><Button size="sm" variant="ghost" aria-label={t("adminDash.ocultar_aria", { name: W(w) })} onClick={() => hideWidget(w)}>{t("adminDash.ocultar")}</Button></div>
      {body}{note ? <p className="dash-note">{note}</p> : null}
    </Card>
  );
  const empty = (key: string) => <p className="type-body text-muted">{t(key)}</p>;

  const render = (w: string): ReactNode => {
    if (!data) return null;
    switch (w) {
      case "alerts": return data.alerts.length === 0 ? card(w, empty("admin.dashboard.nenhum_alerta_no_periodo")) : card(w,
        <ul className="fai-list">{data.alerts.map((a, i) => <li key={i} className="flex items-start gap-2 rounded-md border border-line-soft p-2 type-body-sm">
          <span className={`status-dot ${a.level === "critical" ? "critical" : a.level === "warning" ? "warning" : "good"} mt-1.5`} aria-hidden />
          <span className="min-w-0"><Badge tone={a.level === "info" ? "thread" : "mark"}>{a.level === "warning" ? t("admin.dashboard.atencao") : a.level === "critical" ? t("admin.dashboard.critico") : t("admin.dashboard.info")}</Badge>{" "}<b>{a.title}</b>{a.action ? <span className="block text-muted">{a.action}</span> : null}</span></li>)}</ul>);
      case "kpis": return <section key={w} aria-label={W(w)} className="lg:col-span-2"><div className="kpi-grid">{kpiTiles.filter((k) => data.kpis[k.key] !== undefined).map((k) =>
        <KpiTile key={k.key} label={t(`adminDash.kpi.${k.key}`)} value={num(data.kpis[k.key])} previous={prev[k.key] === undefined ? null : num(prev[k.key])} format={k.format} invert={k.invert} />)}</div>
        <p className="dash-note">{t("adminDash.kpi_nota", { days: from && to ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1 : 30 })}</p></section>;
      case "growth": return card(w, <TimeSeries data={data.series.users ?? []} keys={[{ key: "value", label: t("admin.dashboard.novos_usuarios") }]} kind="area" from={from} to={to} />);
      case "content": { const byDay = new Map<string, Row>(); ([["pieces", "pecas"], ["schemes", "looks"], ["daily_looks", "lookDoDia"]] as const).forEach(([m, k]) => (data.series[m] ?? []).forEach((r) => { const d = String(r.day).slice(0, 10); byDay.set(d, { ...(byDay.get(d) ?? { day: d, pecas: 0, looks: 0, lookDoDia: 0 }), [k]: num(r.value) }); }));
        const rows = [...byDay.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)));
        return card(w, <><TimeSeries data={rows} keys={[{ key: "pecas", label: t("common.pieces") }, { key: "looks", label: t("common.looks") }, { key: "lookDoDia", label: t("lookbook.daily") }]} from={from} to={to} />
          <DataTable columns={[{ key: "day", label: t("adminDash.dia") }, { key: "pecas", label: t("common.pieces"), align: "right" }, { key: "looks", label: t("common.looks"), align: "right" }, { key: "lookDoDia", label: t("lookbook.daily"), align: "right" }]} rows={rows} /></>); }
      case "profiles": { const rows = agg(data.profiles, "profile_type", "total", (k) => k);
        return card(w, <><Bars data={rows.map((r) => ({ ...r, name: PROFILE_LABEL(String(r.name)) }))} x="name" y="value" horizontal height={Math.max(140, rows.length * 40)} colorBy={(n) => PROFILE_COLOR[Object.keys(PROFILE_COLOR).find((k) => PROFILE_LABEL(k) === n) ?? ""] ?? SERIES[7]} />
          <DataTable columns={[{ key: "name", label: t("dashboard.profileType") }, { key: "value", label: t("common.usuarios"), align: "right" }]} rows={rows.map((r) => ({ ...r, name: PROFILE_LABEL(String(r.name)) }))} /></>); }
      case "funnel": { const steps = (data.funnel ?? []).map((r) => ({ label: t(`adminDash.funil.${r.stage}`), value: num(r.total) }));
        return card(w, steps.length && steps[0].value > 0 ? <Funnel steps={steps} /> : empty("adminDash.funil_vazio"), t("adminDash.funil_nota")); }
      case "countries": { const max = Math.max(1, ...data.countries.map((c) => num(c.users) + num(c.public_schemes)));
        return card(w, <div className="grid items-start gap-3 lg:grid-cols-[340px_1fr]">
          <Globe size={320} points={data.countries.map((c) => ({ country: String(c.country), schemes: num(c.public_schemes), pieces: 0, total: num(c.users) + num(c.public_schemes), avg_hype: c.avg_hype == null ? null : num(c.avg_hype), sufficient: num(c.users) > 0, dominantColorHex: null }))} selected={f.country || undefined} onSelect={(c) => { const next = { ...f, country: c }; setF(next); setApplied(next); }} />
          <ul className="fai-list">{data.countries.slice(0, 12).map((c) => <li key={String(c.country)}><button type="button" className="grid w-full grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-3 rounded px-1 py-1 text-left type-caption hover:bg-surface-2" onClick={() => { const next = { ...f, country: String(c.country) }; setF(next); setApplied(next); }}>
            <span>{countryName(String(c.country))}</span><span className="h-2 rounded" style={{ width: `${((num(c.users) + num(c.public_schemes)) / max) * 100}%`, background: SERIES[0] }} /><span className="whitespace-nowrap text-right tabular">{t("admin.dashboard.usuarios_looks", { number: fmtNumber(num(c.users)), number2: fmtNumber(num(c.public_schemes)) })}</span></button></li>)}</ul>
        </div>, t("admin.dashboard.clique_num_pais_no_globo")); }
      case "top_users": return card(w, (data.topUsers ?? []).length === 0 ? empty("adminDash.sem_atividade") : (
        <div className="overflow-x-auto"><table className="w-full type-caption"><thead><tr className="text-left text-muted"><th>#</th><th>{t("adminDash.usuario")}</th><th>{t("dashboard.profileType")}</th><th>{t("auth.country")}</th><th className="text-right">{t("common.pieces")}</th><th className="text-right">{t("common.looks")}</th><th className="text-right">{t("adminDash.curtidas_recebidas")}</th></tr></thead>
          <tbody>{(data.topUsers ?? []).map((r, i) => <tr key={String(r.username)} className="border-t border-line-soft"><td className="tabular">{i + 1}</td><td><Link className="underline" href={`/u/${r.username}`}>@{String(r.username)}</Link></td><td>{PROFILE_LABEL(String(r.profile_type))}</td><td>{countryName(String(r.country ?? ""))}</td><td className="text-right tabular">{fmtNumber(num(r.pieces))}</td><td className="text-right tabular">{fmtNumber(num(r.schemes))}</td><td className="text-right tabular">{fmtNumber(num(r.likes))}</td></tr>)}</tbody></table></div>));
      case "heatmap": return card(w, (data.heatmap ?? []).length === 0 ? empty("adminDash.sem_atividade") : <Heatmap data={(data.heatmap ?? []).map((r) => ({ dow: num(r.dow), hour: num(r.hour), total: num(r.total) }))} />, t("adminDash.heatmap_nota"));
      case "categories": { const rows = agg(data.categories ?? [], "category", "total");
        return card(w, rows.length ? <><Bars data={rows} x="name" y="value" horizontal height={Math.max(160, rows.length * 34)} /><DataTable columns={[{ key: "name", label: t("common.category") }, { key: "value", label: t("common.pieces"), align: "right" }]} rows={rows} /></> : empty("adminDash.sem_pecas")); }
      case "brands": { const max = Math.max(1, ...data.brands.map((r) => num(r.pieces)));
        return card(w, data.brands.length === 0 ? empty("adminDash.sem_marcas") : <ul className="fai-list">{data.brands.map((r) => <li key={String(r.brand)} className="grid grid-cols-[minmax(0,170px)_minmax(0,1fr)_auto] items-center gap-3 type-caption"><BrandLogo name={String(r.brand)} size={24} withName /><span className="h-2.5 rounded bg-surface-2"><span className="block h-full rounded" style={{ width: `${(num(r.pieces) / max) * 100}%`, background: SERIES[0] }} /></span><span className="whitespace-nowrap text-right tabular">{t("admin.dashboard.pecas_donos_hype", { number: fmtNumber(num(r.pieces)), number2: fmtNumber(num(r.owners)), value: r.avg_hype != null ? Math.round(num(r.avg_hype)) : "—" })}</span></li>)}</ul>); }
      // RF53 · P2-21: faixas v2 de peças e looks (só públicas) + cobertura + versão e último cálculo; o v1 de juízo saiu da tela
      case "hype_bands": return card(w, <AdminHypeLevels data={data.hypeV2} />);
      case "moderation": { const m = data.moderation ?? { byStatus: [], pending: [] };
        return card(w, <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
          <div>{m.byStatus.length ? <Bars data={agg(m.byStatus, "status", "total")} x="name" y="value" horizontal height={Math.max(120, m.byStatus.length * 36)} /> : empty("adminDash.moderacao_vazia")}</div>
          <div>{m.pending.length === 0 ? empty("adminDash.fila_vazia") : <ul className="fai-list type-caption">{m.pending.map((p) => <li key={String(p.id)} className="flex items-start gap-2 py-1.5"><Badge>{label(String(p.target_type))}</Badge><span className="min-w-0 flex-1 truncate">{String(p.content_excerpt ?? "—")}</span><span className="tabular text-muted">{p.confidence != null ? `${Math.round(num(p.confidence) * 100)}%` : ""}</span></li>)}</ul>}
            <Link href="/admin/moderation" className="btn btn-sm mt-2">{t("adminDash.abrir_moderacao")}</Link></div>
        </div>); }
      case "engagement": { const rows = data.engagement ?? [];
        return card(w, <><TimeSeries data={rows} keys={[{ key: "likes", label: t("adminDash.curtidas") }, { key: "comments", label: t("adminDash.comentarios") }, { key: "shares", label: t("adminDash.compartilhamentos") }]} from={from} to={to} />
          <DataTable columns={[{ key: "day", label: t("adminDash.dia"), render: (r) => String(r.day).slice(0, 10) }, { key: "likes", label: t("adminDash.curtidas"), align: "right" }, { key: "comments", label: t("adminDash.comentarios"), align: "right" }, { key: "shares", label: t("adminDash.compartilhamentos"), align: "right" }]} rows={rows} /></>); }
      case "seal_funnel": return card(w, data.sealFunnel.length ? <Bars data={agg(data.sealFunnel, "status", "total")} x="name" y="value" horizontal height={Math.max(140, data.sealFunnel.length * 34)} /> : empty("admin.dashboard.nenhum_vinculo_de_selo_no"));
      case "challenges": return card(w, data.challenges.length ? <Bars data={topN(agg(data.challenges, "template", "participants", (k) => k), 8)} x="name" y="value" horizontal height={Math.max(160, Math.min(8, data.challenges.length) * 34)} /> : empty("admin.dashboard.nenhum_desafio"));
      case "points": { const rows = topN(agg(data.points, "action_code", "points", (k) => t(`adminDash.pontos.${k}`)), 8);
        return card(w, rows.length ? <Bars data={rows} x="name" y="value" horizontal height={Math.max(160, rows.length * 34)} /> : empty("admin.dashboard.nenhum_ponto_no_periodo")); }
      case "inventory_bands": { const rows = data.inventoryBands.map((r) => ({ name: label(String(r.band)), value: num(r.total) }));
        return card(w, rows.length ? <Donut data={rows} x="name" y="value" /> : empty("admin.dashboard.sem_snapshots_de_inventory_score")); }
      case "ai_cost": return card(w, <TimeSeries data={data.series.ai_cost ?? []} keys={[{ key: "value", label: "USD" }]} kind="bar" from={from} to={to} />, t("adminDash.custo_nota"));
      case "ai_usage": { const rows = topN(agg(data.aiUsage, "capability", "calls"), 8); const all = agg(data.aiUsage, "capability", "calls");
        return card(w, rows.length ? <><Bars data={rows} x="name" y="value" horizontal height={Math.max(180, rows.length * 32)} /><DataTable columns={[{ key: "name", label: t("adminDash.capacidade") }, { key: "value", label: t("admin.dashboard.chamadas"), align: "right" }]} rows={all} /></> : empty("admin.dashboard.sem_chamadas_de_ia_no")); }
      case "ai_by_country": return card(w, data.aiByCountry.length === 0 ? empty("admin.dashboard.sem_chamadas_de_ia_de") : (
        <div className="overflow-x-auto"><table className="w-full type-caption"><thead><tr className="text-left text-muted"><th>{t("auth.country")}</th><th className="text-right">{t("common.usuarios")}</th><th className="text-right">{t("admin.dashboard.chamadas")}</th><th className="text-right">{t("admin.dashboard.custo")}</th><th className="text-right">{t("admin.dashboard.por_usuario")}</th></tr></thead>
          <tbody>{data.aiByCountry.map((r) => <tr key={String(r.country)} className="border-t border-line-soft"><td>{countryName(String(r.country))}</td><td className="text-right tabular">{fmtNumber(num(r.users))}</td><td className="text-right tabular">{fmtNumber(num(r.calls))}</td><td className="text-right tabular">{usd(num(r.cost_usd))}</td><td className="text-right tabular">{usd(num(r.cost_per_user))}</td></tr>)}</tbody></table>
          <p className="dash-note">{rich("admin.dashboard.resposta_por_usuario_no_periodo", { countryName: countryName(String(data.aiByCountry[0].country)), usd: usd(num(data.aiByCountry[0].cost_per_user)) }, { 0: ($c) => <b>{$c}</b> })}</p></div>));
      case "system": { const s = data.system; if (!s) return null;
        const heapPct = s.heapMaxMb ? Math.round((s.heapUsedMb / s.heapMaxMb) * 100) : 0;
        const dbState = s.dbLatencyMs < 0 ? "critical" : s.dbLatencyMs > 200 ? "warning" : "good";
        const tiles: { label: string; value: string; state: string; hint: string }[] = [
          { label: t("adminDash.sistema.banco"), value: s.dbLatencyMs < 0 ? t("adminDash.sistema.fora") : `${fmtNumber(s.dbLatencyMs)} ms`, state: dbState, hint: t(`adminDash.estado.${dbState}`) },
          { label: t("adminDash.sistema.memoria"), value: `${fmtNumber(s.heapUsedMb)} / ${fmtNumber(s.heapMaxMb)} MB`, state: heapPct > 85 ? "warning" : "good", hint: `${heapPct}%` },
          { label: t("adminDash.sistema.no_ar"), value: s.uptimeMinutes >= 1440 ? t("adminDash.sistema.dias", { n: Math.floor(s.uptimeMinutes / 1440) }) : s.uptimeMinutes >= 60 ? t("adminDash.sistema.horas", { n: Math.floor(s.uptimeMinutes / 60) }) : t("adminDash.sistema.minutos", { n: s.uptimeMinutes }), state: "good", hint: t("adminDash.sistema.cpus", { n: s.processors }) },
          { label: t("adminDash.sistema.ia_remota"), value: s.aiRemoteEnabled ? t("admin.system.ligado") : t("admin.system.desligado"), state: s.aiRemoteEnabled ? "good" : "warning", hint: t("adminDash.sistema.provedores", { n: Object.values(s.aiProviders).filter(Boolean).length, total: Object.keys(s.aiProviders).length }) },
          { label: t("adminDash.sistema.ultimo_backup"), value: s.lastBackup ? fmtDateTime(s.lastBackup.startedAt) : t("adminDash.sistema.nenhum"), state: !s.lastBackup ? "warning" : s.lastBackup.status === "COMPLETED" ? "good" : s.lastBackup.status === "FAILED" ? "critical" : "warning", hint: s.lastBackup ? t(`adminDash.status.${s.lastBackup.status}`) : "" },
        ];
        return card(w, <><div className="health-grid">{tiles.map((x) => <div key={x.label} className="kpi-tile"><p className="kpi-label"><span className={`status-dot ${x.state}`} aria-hidden />{x.label}</p><p className="type-h3 tabular">{x.value}</p><p className="kpi-delta">{x.hint}</p></div>)}</div>
          <p className="dash-note">{Object.entries(s.aiProviders).map(([k, v]) => `${k} ${v ? "✓" : "✗"}`).join(" · ")}</p>
          <div className="mt-2 flex flex-wrap gap-2"><Link href="/admin/system" className="btn btn-sm">{t("adminDash.abrir_sistema")}</Link><Link href="/admin/users" className="btn btn-sm">{t("common.usuarios")}</Link><Link href="/admin/moments" className="btn btn-sm">{t("nav.moments")}</Link></div></>); }
      case "jobs": { const j = data.jobs ?? { byStatus: [], failed: [] };
        return card(w, <>{j.byStatus.length === 0 ? empty("adminDash.sem_jobs") : <div className="overflow-x-auto"><table className="w-full type-caption"><thead><tr className="text-left text-muted"><th>{t("adminDash.tipo")}</th><th>{t("adminDash.estado_col")}</th><th className="text-right">{t("adminDash.total")}</th><th className="text-right">{t("adminDash.tempo_medio")}</th></tr></thead>
          <tbody>{j.byStatus.map((r, i) => <tr key={i} className="border-t border-line-soft"><td>{t(`adminDash.job.${r.type}`)}</td><td><span className={`status-dot ${r.status === "FAILED" ? "critical" : r.status === "COMPLETED" ? "good" : "warning"}`} aria-hidden />{t(`adminDash.status.${r.status}`)}</td><td className="text-right tabular">{fmtNumber(num(r.total))}</td><td className="text-right tabular">{r.avg_ms != null ? `${fmtNumber(num(r.avg_ms))} ms` : "—"}</td></tr>)}</tbody></table></div>}
          {j.failed.length > 0 && <><h3 className="type-label mt-3 mb-1">{t("adminDash.falhas_recentes")}</h3><ul className="fai-list type-caption">{j.failed.map((r, i) => <li key={i} className="py-1"><b>{t(`adminDash.job.${r.type}`)}</b> · {String(r.error_code ?? "—")} <span className="tabular">×{fmtNumber(num(r.total))}</span> <span className="block text-muted">{String(r.error_message ?? "").slice(0, 140)}</span></li>)}</ul></>}</>); }
      case "security": { const sec = data.security ?? { series: [], failures: [], recent: [] };
        return card(w, <div className="grid gap-3">
          <TimeSeries data={sec.series} keys={[{ key: "login_failures", label: t("adminDash.logins_falhos") }, { key: "denied", label: t("adminDash.acessos_negados") }, { key: "errors", label: t("adminDash.erros") }]} kind="bar" from={from} to={to} />
          <div className="grid gap-3 lg:grid-cols-2">
            <div><h3 className="type-label mb-1">{t("adminDash.falhas_por_acao")}</h3>{sec.failures.length === 0 ? empty("adminDash.sem_falhas") : <table className="w-full type-caption"><tbody>{sec.failures.map((r, i) => <tr key={i} className="border-t border-line-soft"><td>{String(r.acao)}</td><td className="text-muted">{String(r.resultado)}</td><td className="text-right tabular">{fmtNumber(num(r.total))}</td></tr>)}</tbody></table>}</div>
            <div><h3 className="type-label mb-1">{t("adminDash.ultimos_eventos")}</h3>{sec.recent.length === 0 ? empty("adminDash.sem_falhas") : <ul className="fai-list type-caption">{sec.recent.map((r, i) => <li key={i} className="flex gap-2 py-1"><span className="tabular text-muted">{fmtDateTime(String(r.at))}</span><span className="min-w-0 flex-1 truncate">{String(r.acao)} · {String(r.recurso ?? "")}</span><span className="text-muted">{String(r.ip ?? "")}</span></li>)}</ul>}</div>
          </div>
        </div>, t("adminDash.seguranca_nota")); }
      default: return null;
    }
  };

  const tabs: { id: TabId; label: string }[] = (Object.keys(TAB_WIDGETS) as TabId[]).map((id) => ({ id, label: t(`adminDash.tab.${id}`) }));
  return (
    <>
      <PageHeader title={t("dashboard.title")} kicker={t("admin.dashboard.admin")} lead={t("adminDash.lead")}
        actions={<><Button onClick={exportCsv}>{t("dashboard.export")}</Button><Button onClick={() => setCustom(true)}>{t("dashboard.customize")}</Button></>} />
      <form className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]" onSubmit={(e) => { e.preventDefault(); setApplied(f); }}>
        <Field label={t("dashboard.from")} id="from"><Input id="from" type="date" value={f.from} max={f.to} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label={t("dashboard.to")} id="to"><Input id="to" type="date" value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label={t("dashboard.country")} id="country"><Select id="country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}><option value="">{t("common.all")}</option>{(data?.countries ?? []).map((c) => <option key={String(c.country)} value={String(c.country)}>{countryName(String(c.country))}</option>)}</Select></Field>
        <Field label={t("dashboard.profileType")} id="profileType"><Select id="profileType" value={f.profileType} onChange={(e) => setF({ ...f, profileType: e.target.value })}><option value="">{t("common.all")}</option>{["PESSOAL", "MARCA", "CELEBRIDADE"].map((p) => <option key={p} value={p}>{PROFILE_LABEL(p)}</option>)}</Select></Field>
        <div className="flex items-end"><Button type="submit" variant="primary" className="w-full"><FaiIcon id="ACT-12" size={24} decorative />{t("dashboard.apply")}</Button></div>
      </form>
      <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label={t("adminDash.periodo_rapido")}>
        {[7, 30, 90].map((d) => <Button key={d} size="sm" variant="ghost" onClick={() => quick(d)}>{t("adminDash.ultimos_dias", { n: d })}</Button>)}
        {(applied.country || applied.profileType) && <Button size="sm" variant="ghost" onClick={() => { const next = { ...f, country: "", profileType: "" }; setF(next); setApplied(next); }}>{t("adminDash.limpar_filtros")}</Button>}
      </div>
      <Tabs tabs={tabs} value={tab} onChange={(id) => { setTab(id); persist(layout, id).catch(() => undefined); }} label={t("adminDash.abas")} />
      {loading && !data && <Skeleton className="mt-3 h-96" />}
      {data && <div className="dash-grid cols-2 mt-3">{visible(tab).map((w) => render(w))}</div>}
      <Dialog open={custom} onClose={() => setCustom(false)} title={t("dashboard.customize")} footer={<Button variant="primary" onClick={saveLayout}>{t("common.save")}</Button>}>
        <p className="mb-2 type-caption text-muted">{t("adminDash.personalizar_ajuda")}</p>
        {(Object.keys(TAB_WIDGETS) as TabId[]).map((id) => <div key={id} className="mb-3"><p className="label">{t(`adminDash.tab.${id}`)}</p>
          <ul className="fai-list">{TAB_WIDGETS[id].map((w) => <li key={w} className="py-1">
            <Switch checked={!layout.hidden.includes(w)} onChange={(on) => setLayout((l) => ({ widgets: l.widgets.length ? l.widgets : Object.values(TAB_WIDGETS).flat(), hidden: on ? l.hidden.filter((x) => x !== w) : [...l.hidden, w] }))} label={W(w)} /></li>)}</ul></div>)}
      </Dialog>
    </>
  );
}
export default function AdminDashboardPage() { return <RequireAuth admin><AdminDashboard /></RequireAuth>; }
