"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Cores de série do dataviz: nunca reaproveitam as cores de status (bom/alerta/crítico). */
export const SERIES = ["#1F7A76", "#C6275E", "#B8862B", "#5B6B7A", "#7C5FC0", "#4FB3AE", "#F58220", "#2F3E46"];
type Row = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

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

export function TimeSeries({ data, x = "day", keys, kind = "line", height = 220, from, to }: { data: Row[]; x?: string; keys: { key: string; label: string }[]; kind?: "line" | "area" | "bar"; height?: number; from?: string; to?: string }) {
  const rows = fillDays(data, from, to, x, keys.map((k) => k.key)).map((r) => ({ ...r, [x]: String(r[x] ?? "").slice(0, 10) }));
  const common = { data: rows, margin: { top: 8, right: 8, left: 0, bottom: 0 } };
  // Recharts 2 só enxerga eixos/grade/tooltip como filhos diretos (ou em array) — dentro de um Fragment eles somem.
  const axes = [
    <CartesianGrid key="grid" strokeDasharray="3 3" stroke="var(--line-soft)" />,
    <XAxis key="x" dataKey={x} tick={{ fontSize: 12, fill: "var(--muted)" }} tickFormatter={(v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? `${String(v).slice(8, 10)}/${String(v).slice(5, 7)}` : String(v))} minTickGap={12} />,
    <YAxis key="y" tick={{ fontSize: 12, fill: "var(--muted)" }} width={44} />,
    <Tooltip key="tip" contentStyle={{ background: "var(--surface)", border: "1px solid var(--line-soft)", color: "var(--ink)" }} />,
    <Legend key="legend" wrapperStyle={{ fontSize: 12 }} />,
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      {kind === "bar" ? <BarChart {...common}>{axes}{keys.map((k, i) => <Bar key={k.key} dataKey={k.key} name={k.label} fill={SERIES[i % SERIES.length]} />)}</BarChart>
        : kind === "area" ? <AreaChart {...common}>{axes}{keys.map((k, i) => <Area key={k.key} type="monotone" dataKey={k.key} name={k.label} stroke={SERIES[i % SERIES.length]} fill={SERIES[i % SERIES.length]} fillOpacity={0.2} />)}</AreaChart>
        : <LineChart {...common}>{axes}{keys.map((k, i) => <Line key={k.key} type="monotone" dataKey={k.key} name={k.label} stroke={SERIES[i % SERIES.length]} dot={false} strokeWidth={2} />)}</LineChart>}
    </ResponsiveContainer>
  );
}
export function Bars({ data, x, y, height = 220, horizontal }: { data: Row[]; x: string; y: string; height?: number; horizontal?: boolean }) {
  const rows = data.map((r) => ({ name: String(r[x] ?? "—"), value: num(r[y]) }));
  const labelW = Math.min(200, Math.max(70, 7 * Math.max(0, ...rows.map((r) => r.name.length))));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line-soft)" />
        {horizontal
          ? [<XAxis key="x" type="number" tick={{ fontSize: 12, fill: "var(--muted)" }} />, <YAxis key="y" type="category" dataKey="name" tick={{ fontSize: 12, fill: "var(--ink)" }} width={labelW} interval={0} />]
          : [<XAxis key="x" dataKey="name" tick={{ fontSize: 12, fill: "var(--muted)" }} interval={0} />, <YAxis key="y" tick={{ fontSize: 12, fill: "var(--muted)" }} width={40} />]}
        <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line-soft)", color: "var(--ink)" }} />
        <Bar dataKey="value">{rows.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
export function Donut({ data, x, y, height = 220 }: { data: Row[]; x: string; y: string; height?: number }) {
  const rows = data.map((r) => ({ name: String(r[x] ?? "—"), value: num(r[y]) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart><Pie data={rows} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>{rows.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}</Pie><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line-soft)", color: "var(--ink)" }} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart>
    </ResponsiveContainer>
  );
}
