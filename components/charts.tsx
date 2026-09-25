"use client";
import { useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * Gráficos do app (dataviz): paleta categórica validada em ordem fixa (tokens --series-N em globals.css, claro e escuro),
 * marcas finas (barras ≤ 24 px com ponta arredondada, linhas de 2 px, área a 10 %), grade sólida e recessiva, cor por
 * entidade — nunca pela posição no ranking — e tabela de dados sob cada gráfico (contraste < 3:1 de algumas cores pede a
 * tabela como alívio). Texto usa sempre os tokens de tinta, nunca a cor da série.
 */
export const SERIES = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);
type Row = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const TIP = { background: "var(--surface)", border: "1px solid var(--line-soft)", borderRadius: 8, color: "var(--ink)", fontSize: 12 };
const AXIS = { fontSize: 12, fill: "var(--muted)" };
/** Texto da legenda na tinta do tema; a cor da série fica só no ícone ao lado. */
const legendText = (value: string) => <span style={{ color: "var(--ink)" }}>{value}</span>;

/** Completa com zero os dias sem registro entre from e to (a série diária do MySQL só traz dias com dados). */
export function fillDays(data: Row[], from?: string, to?: string, x = "day", keys: string[] = ["value"]): Row[] {
  if (!from || !to) return data;
  const byDay = new Map(data.map((r) => [String(r[x] ?? "").slice(0, 10), r]));
  const out: Row[] = [];
  const end = new Date(`${to.slice(0, 10)}T00:00:00Z`);
  for (let d = new Date(`${from.slice(0, 10)}T00:00:00Z`); d <= end && out.length < 400; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    out.push(byDay.get(day) ?? Object.fromEntries([[x, day], ...keys.map((k) => [k, 0])]));
  }
  return out;
}

const shortDay = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? `${String(v).slice(8, 10)}/${String(v).slice(5, 7)}` : String(v));

export function TimeSeries({ data, x = "day", keys, kind = "line", height = 220, from, to }: { data: Row[]; x?: string; keys: { key: string; label: string; color?: string }[]; kind?: "line" | "area" | "bar"; height?: number; from?: string; to?: string }) {
  const rows = fillDays(data, from, to, x, keys.map((k) => k.key)).map((r) => ({ ...r, [x]: String(r[x] ?? "").slice(0, 10) }));
  const common = { data: rows, margin: { top: 8, right: 8, left: 0, bottom: 0 } };
  const color = (k: { color?: string }, i: number) => k.color ?? SERIES[i % SERIES.length];
  // Recharts 2 só enxerga eixos/grade/tooltip como filhos diretos (ou em array) — dentro de um Fragment eles somem.
  const axes = [
    <CartesianGrid key="grid" stroke="var(--line-soft)" strokeWidth={1} vertical={false} />,
    <XAxis key="x" dataKey={x} tick={AXIS} tickFormatter={shortDay} minTickGap={16} axisLine={{ stroke: "var(--line-soft)" }} tickLine={false} />,
    <YAxis key="y" tick={AXIS} width={44} axisLine={false} tickLine={false} allowDecimals={false} />,
    <Tooltip key="tip" contentStyle={TIP} labelFormatter={(v) => shortDay(String(v))} cursor={{ stroke: "var(--muted)", strokeWidth: 1 }} />,
    ...(keys.length > 1 ? [<Legend key="legend" wrapperStyle={{ fontSize: 12 }} formatter={legendText} iconType={kind === "line" ? "plainline" : "square"} />] : []),
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      {kind === "bar" ? <BarChart {...common} barCategoryGap={2}>{axes}{keys.map((k, i) => <Bar key={k.key} dataKey={k.key} name={k.label} fill={color(k, i)} maxBarSize={24} radius={[4, 4, 0, 0]} stackId={keys.length > 1 ? "s" : undefined} />)}</BarChart>
        : kind === "area" ? <AreaChart {...common}>{axes}{keys.map((k, i) => <Area key={k.key} type="monotone" dataKey={k.key} name={k.label} stroke={color(k, i)} strokeWidth={2} fill={color(k, i)} fillOpacity={0.1} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} />)}</AreaChart>
        : <LineChart {...common}>{axes}{keys.map((k, i) => <Line key={k.key} type="monotone" dataKey={k.key} name={k.label} stroke={color(k, i)} dot={false} strokeWidth={2} strokeLinecap="round" activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} />)}</LineChart>}
    </ResponsiveContainer>
  );
}

/** Barras de uma série só: uma cor (a série é a entidade; o ranking não troca cor). `colorBy` pinta por entidade quando cada barra é uma categoria fixa. */
export function Bars({ data, x, y, height = 220, horizontal, colorBy, format }: { data: Row[]; x: string; y: string; height?: number; horizontal?: boolean; colorBy?: (name: string) => string; format?: (v: number) => string }) {
  const rows = data.map((r) => ({ name: String(r[x] ?? "—"), value: num(r[y]) }));
  const labelW = Math.min(200, Math.max(70, 7 * Math.max(0, ...rows.map((r) => r.name.length))));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barCategoryGap={4}>
        <CartesianGrid stroke="var(--line-soft)" strokeWidth={1} horizontal={!horizontal} vertical={!!horizontal} />
        {horizontal
          ? [<XAxis key="x" type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={format ? (v: number) => format(v) : undefined} />, <YAxis key="y" type="category" dataKey="name" tick={{ fontSize: 12, fill: "var(--ink)" }} width={labelW} interval={0} axisLine={false} tickLine={false} />]
          : [<XAxis key="x" dataKey="name" tick={AXIS} interval={0} axisLine={{ stroke: "var(--line-soft)" }} tickLine={false} />, <YAxis key="y" tick={AXIS} width={40} axisLine={false} tickLine={false} tickFormatter={format ? (v: number) => format(v) : undefined} />]}
        <Tooltip contentStyle={TIP} cursor={{ fill: "var(--surface-2)" }} formatter={format ? (v: number) => format(v) : undefined} />
        <Bar dataKey="value" maxBarSize={24} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} fill={SERIES[0]}>
          {colorBy ? rows.map((r) => <Cell key={r.name} fill={colorBy(r.name)} />) : null}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Rosca para poucas partes de um todo (até 4–5 fatias); cada fatia mantém a cor da sua categoria. */
export function Donut({ data, x, y, height = 220 }: { data: Row[]; x: string; y: string; height?: number }) {
  const rows = data.map((r) => ({ name: String(r[x] ?? "—"), value: num(r[y]) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart><Pie data={rows} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="86%" paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>{rows.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}</Pie><Tooltip contentStyle={TIP} /><Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} iconType="square" /></PieChart>
    </ResponsiveContainer>
  );
}

/** Número de destaque com variação sobre o período anterior (sem cor de status: seta + texto dizem a direção). */
export function KpiTile({ label, value, previous, format, invert }: { label: string; value: number; previous?: number | null; format: (v: number) => string; invert?: boolean }) {
  const { t, fmtNumber } = useI18n();
  const has = previous != null && Number.isFinite(previous);
  const delta = has ? value - (previous as number) : 0;
  // base muito pequena gera porcentagens sem sentido (ex.: +14 000 %): nesses casos mostra a diferença absoluta
  const rawPct = has && previous ? Math.round((delta / Math.abs(previous as number)) * 100) : null;
  const pct = rawPct !== null && Math.abs(rawPct) <= 999 ? rawPct : null;
  const up = delta > 0; const flat = !has || delta === 0;
  const good = flat ? null : invert ? !up : up;
  return (
    <div className="kpi-tile">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value tabular">{format(value)}</p>
      <p className={`kpi-delta ${good === null ? "" : good ? "is-good" : "is-bad"}`}>
        {flat ? t("charts.kpi.sem_variacao") : <><span aria-hidden>{up ? "▲" : "▼"}</span> {pct === null ? format(Math.abs(delta)) : `${fmtNumber(Math.abs(pct))}%`} <span className="text-muted">{t("charts.kpi.vs_anterior")}</span></>}
      </p>
    </div>
  );
}

/** Mapa de calor dia da semana × hora (rampa sequencial de um tom); cada célula tem título e foco com o valor. */
export function Heatmap({ data, max }: { data: { dow: number; hour: number; total: number }[]; max?: number }) {
  const { t, fmtNumber } = useI18n();
  const grid = new Map(data.map((d) => [`${d.dow}-${d.hour}`, d.total]));
  const top = max ?? Math.max(1, ...data.map((d) => d.total));
  const days = [0, 1, 2, 3, 4, 5, 6];
  const step = (v: number) => (v <= 0 ? 0 : Math.min(7, 1 + Math.floor((v / top) * 6.999)));
  const dayName = (d: number) => t(`charts.dow.${d}`);
  return (
    <div className="heatmap" role="table" aria-label={t("charts.heatmap.aria")}>
      <div className="heatmap-row" role="row"><span role="columnheader" className="heatmap-axis" />{Array.from({ length: 24 }, (_, h) => <span key={h} role="columnheader" className="heatmap-hour">{h % 3 === 0 ? `${h}h` : ""}</span>)}</div>
      {days.map((d) => (
        <div key={d} className="heatmap-row" role="row">
          <span role="rowheader" className="heatmap-axis">{dayName(d)}</span>
          {Array.from({ length: 24 }, (_, h) => { const v = grid.get(`${d}-${h}`) ?? 0; const s = step(v); const label = t("charts.heatmap.cell", { day: dayName(d), hour: h, value: fmtNumber(v) });
            return <span key={h} role="cell" tabIndex={-1} className="heatmap-cell" style={{ background: s ? `var(--seq-${s})` : "var(--surface-2)" }} title={label} aria-label={label} />; })}
        </div>))}
      <div className="heatmap-legend" aria-hidden><span>{t("charts.heatmap.menos")}</span>{[1, 2, 3, 4, 5, 6, 7].map((s) => <i key={s} style={{ background: `var(--seq-${s})` }} />)}<span>{t("charts.heatmap.mais")}</span></div>
    </div>
  );
}

/** Funil: barras horizontais de uma cor, com o total e a conversão sobre a etapa anterior e sobre o início. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const { t, fmtNumber } = useI18n();
  const first = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="funnel">
      {steps.map((s, i) => { const prev = i === 0 ? s.value : steps[i - 1].value; const conv = prev ? Math.round((s.value / prev) * 100) : 0;
        return (
          <li key={s.label} className="funnel-step">
            <span className="funnel-label">{s.label}</span>
            <span className="funnel-track"><i style={{ width: `${Math.max(1, (s.value / first) * 100)}%` }} /></span>
            <span className="funnel-value tabular"><b>{fmtNumber(s.value)}</b>{i > 0 && <span className="text-muted"> · {t("charts.funnel.da_etapa_anterior", { pct: conv })}</span>}</span>
          </li>); })}
    </ol>
  );
}

/** Tabela de dados sob um gráfico (sempre disponível; é o alívio para cores abaixo de 3:1 e para quem não vê o gráfico). */
export function DataTable({ columns, rows, caption }: { columns: { key: string; label: string; align?: "right"; render?: (row: Row) => ReactNode }[]; rows: Row[]; caption?: string }) {
  const { t } = useI18n(); const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  return (
    <details className="data-table" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>{t("charts.ver_tabela")}</summary>
      <div className="overflow-x-auto">
        <table className="w-full type-caption">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead><tr>{columns.map((c) => <th key={c.key} scope="col" className={c.align === "right" ? "text-right" : "text-left"}>{c.label}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{columns.map((c) => <td key={c.key} className={c.align === "right" ? "text-right tabular" : ""}>{c.render ? c.render(r) : String(r[c.key] ?? "—")}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}
