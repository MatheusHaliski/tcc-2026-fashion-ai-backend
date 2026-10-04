"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/lib/i18n/i18n";
import type { HypeHistoryPoint } from "@/lib/hype/types";

const AXIS = { fontSize: 12, fill: "var(--muted)" };
const TIP = { background: "var(--surface)", border: "1px solid var(--line-soft)", borderRadius: 8, color: "var(--ink)", fontSize: 12 };
const shortDay = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v.slice(8, 10)}/${v.slice(5, 7)}` : v);

/**
 * Evolução do HypeScore (snapshots diários): uma série, eixo fixo 0–100 (o mesmo do score), linha de 2 px, grade
 * recessiva, crosshair com tooltip. Dia sem dados suficientes é um BURACO na linha (nunca 0). Tabela para leitor de tela.
 */
export function HypeHistoryChart({ points, height = 180, label }: { points: HypeHistoryPoint[]; height?: number; label?: string }) {
  const { t, fmtDate } = useI18n();
  const rows = points.map((p) => ({ date: p.date, score: p.status === "AVAILABLE" && p.score != null ? Math.round(p.score) : null }));
  if (!rows.some((r) => r.score != null)) return <p className="type-body-sm text-muted">{t("hype.history.empty")}</p>;
  const name = label ?? t("hype.history.score");
  return (
    <figure className="hype-history">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line-soft)" strokeWidth={1} vertical={false} />
          <XAxis dataKey="date" tick={AXIS} tickFormatter={shortDay} minTickGap={16} axisLine={{ stroke: "var(--line-soft)" }} tickLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS} width={32} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TIP} labelFormatter={(v) => fmtDate(String(v))} formatter={(v) => [v as number, name]} cursor={{ stroke: "var(--muted)", strokeWidth: 1 }} />
          <Line type="monotone" dataKey="score" name={name} stroke="var(--series-1)" strokeWidth={2} strokeLinecap="round" connectNulls={false}
            dot={rows.length < 3 ? { r: 4, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--series-1)" } : false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <table className="sr-only">
        <caption>{t("hype.history.table_caption")}</caption>
        <thead><tr><th scope="col">{t("hype.history.date")}</th><th scope="col">{name}</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.date}><td>{fmtDate(r.date)}</td><td>{r.score ?? t("hype.state.insufficient")}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
