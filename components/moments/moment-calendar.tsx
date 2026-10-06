"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { dayKey, daysInMonth, todayIn, touchesDay, weekOf, weekday, ymd } from "@/lib/moments/time";
import { momentIcon, momentStyle } from "@/lib/moments/theme";
import type { MomentCard as MomentCardData, MomentsCalendar } from "@/lib/moments/types";
import { Button, SegmentPicker, cn } from "@/components/ui";
import { MomentCard } from "./moment-shared";

export type CalendarView = "year" | "month" | "week" | "timeline";

/**
 * CALENDÁRIO VISUAL (§19, §48, §49): ANO (12 meses em lista), MÊS (grade de dias com faixas), SEMANA e LINHA DO TEMPO.
 * Nada depende só de cor: cada faixa tem nome e ícone; a grade é uma tabela com cabeçalhos; tudo navegável pelo teclado.
 * No celular, o padrão é MÊS/SEMANA — o ano inteiro só no desktop ou como lista.
 */
export function MomentCalendar({ data, receivedAt, initialView = "month", initialMonth }: { data: MomentsCalendar; receivedAt: number; initialView?: CalendarView; initialMonth?: number }) {
  const { t, fmtDate } = useI18n();
  const today = todayIn(data.timezone); const { y: ty, m: tm, d: td } = ymd(today);
  const [view, setView] = useState<CalendarView>(initialView);
  const [month, setMonth] = useState(initialMonth ?? (data.year === ty ? tm : 1));
  const [weekAnchor, setWeekAnchor] = useState(data.year === ty ? today : dayKey(data.year, month, 1));
  const items = useMemo(() => dedupe(data.months.flatMap((mo) => mo.items)), [data]);
  const monthName = (mo: number) => fmtDate(`${data.year}-${String(mo).padStart(2, "0")}-15T12:00:00Z`, { month: "long", timeZone: "UTC" });
  const dayName = (key: string) => fmtDate(key + "T12:00:00Z", { weekday: "short", timeZone: "UTC" });
  const views = [{ id: "month" as const, label: t("moments.calendar.month") }, { id: "week" as const, label: t("moments.calendar.week") }, { id: "year" as const, label: t("moments.calendar.year") }, { id: "timeline" as const, label: t("moments.calendar.timeline") }];
  return (
    <div className="moment-calendar">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SegmentPicker options={views} value={view} onChange={setView} label={t("moments.calendar.view_label")} />
        {view === "month" && <div className="ml-auto flex items-center gap-1"><Button size="sm" variant="ghost" onClick={() => setMonth((m) => Math.max(1, m - 1))} disabled={month <= 1} aria-label={t("moments.calendar.prev_month")}>‹</Button><span className="type-h3 capitalize min-w-32 text-center" aria-live="polite">{monthName(month)} {data.year}</span><Button size="sm" variant="ghost" onClick={() => setMonth((m) => Math.min(12, m + 1))} disabled={month >= 12} aria-label={t("moments.calendar.next_month")}>›</Button></div>}
        {view === "week" && <div className="ml-auto flex items-center gap-1"><Button size="sm" variant="ghost" onClick={() => setWeekAnchor(shift(weekAnchor, -7))} aria-label={t("moments.calendar.prev_week")}>‹</Button><Button size="sm" onClick={() => setWeekAnchor(today)}>{t("moments.calendar.today")}</Button><Button size="sm" variant="ghost" onClick={() => setWeekAnchor(shift(weekAnchor, 7))} aria-label={t("moments.calendar.next_week")}>›</Button></div>}
      </div>
      <p className="type-caption text-muted mb-2">{t("moments.calendar.timezone_note", { tz: data.timezone })}</p>
      {view === "month" && <MonthGrid year={data.year} month={month} items={items} today={today} dayName={dayName} />}
      {view === "week" && <WeekList days={weekOf(...(Object.values(ymd(weekAnchor)) as [number, number, number]))} items={items} today={today} dayName={dayName} receivedAt={receivedAt} />}
      {view === "year" && <YearList year={data.year} months={data.months} monthName={monthName} today={today} />}
      {view === "timeline" && <Timeline items={items} receivedAt={receivedAt} />}
      <p className="sr-only">{t("moments.calendar.today_is", { date: fmtDate(`${ty}-${String(tm).padStart(2, "0")}-${String(td).padStart(2, "0")}T12:00:00Z`, { timeZone: "UTC" }) })}</p>
    </div>
  );
}

function dedupe(items: MomentCardData[]): MomentCardData[] {
  const seen = new Set<string>();
  return items.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

function shift(key: string, days: number): string {
  const { y, m, d } = ymd(key); const x = new Date(Date.UTC(y, m - 1, d + days));
  return dayKey(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
}

function MonthGrid({ year, month, items, today, dayName }: { year: number; month: number; items: MomentCardData[]; today: string; dayName: (k: string) => string }) {
  const { t } = useI18n();
  const n = daysInMonth(year, month); const lead = weekday(year, month, 1);
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = []; for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const heads = weekOf(2026, 10, 25).map(dayName);   // domingo → sábado, no idioma
  const inMonth = items.filter((m) => touchesDay(m.time.localStart, m.time.localEnd, dayKey(year, month, n)) || touchesDay(dayKey(year, month, 1), dayKey(year, month, n), m.time.localStart) || (m.time.localStart <= dayKey(year, month, 1) && m.time.localEnd >= dayKey(year, month, n)));
  return (
    <>
      <table className="moment-month" role="grid" aria-label={t("moments.calendar.month_grid")}>
        <thead><tr>{heads.map((h) => <th key={h} scope="col" className="type-label">{h}</th>)}</tr></thead>
        <tbody>
          {weeks.map((w, wi) => (
            <tr key={wi}>
              {w.map((d, di) => {
                if (d === null) return <td key={di} className="is-empty" aria-hidden />;
                const key = dayKey(year, month, d); const here = inMonth.filter((m) => touchesDay(m.time.localStart, m.time.localEnd, key));
                return (
                  <td key={di} className={cn("moment-day", key === today && "is-today", here.length > 0 && "has-items")} aria-current={key === today ? "date" : undefined}>
                    <span className="moment-day-num tabular">{d}</span>
                    {here.length > 0 && <ul className="moment-day-items" aria-label={t("moments.calendar.on_day", { n: here.length })}>
                      {here.slice(0, 3).map((m) => <li key={m.id} style={momentStyle(m.theme)}><Link href={`/moments/${m.slug}`} className="moment-day-pill" title={m.name}><span aria-hidden>{momentIcon(m.theme)}</span><span className="moment-day-pill-name">{m.name}</span></Link></li>)}
                      {here.length > 3 && <li className="type-caption text-muted">+{here.length - 3}</li>}
                    </ul>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {inMonth.length > 0 && <ul className="moment-month-legend" aria-label={t("moments.calendar.legend")}>{inMonth.map((m) => <li key={m.id} style={momentStyle(m.theme)}><Link href={`/moments/${m.slug}`} className="moment-day-pill"><span aria-hidden>{momentIcon(m.theme)}</span>{m.name} <span className="type-caption text-muted">{m.time.localStart.slice(8)}–{m.time.localEnd.slice(8)}</span></Link></li>)}</ul>}
      {inMonth.length === 0 && <p className="type-body-sm text-muted mt-2">{t("moments.calendar.empty_month")}</p>}
    </>
  );
}

function WeekList({ days, items, today, dayName, receivedAt }: { days: string[]; items: MomentCardData[]; today: string; dayName: (k: string) => string; receivedAt: number }) {
  const { t } = useI18n();
  const seen = new Set<string>();
  return (
    <ol className="moment-week">
      {days.map((key) => {
        const here = items.filter((m) => touchesDay(m.time.localStart, m.time.localEnd, key));
        return (
          <li key={key} className={cn("moment-week-day", key === today && "is-today")} aria-current={key === today ? "date" : undefined}>
            <p className="type-label">{dayName(key)} <b className="tabular">{key.slice(8)}</b>{key === today ? ` · ${t("moments.calendar.today")}` : ""}</p>
            {here.length === 0 ? <p className="type-caption text-faint">—</p> : <div className="grid gap-2">{here.map((m) => { const first = !seen.has(m.id); seen.add(m.id); return first ? <MomentCard key={m.id} m={m} receivedAt={receivedAt} compact /> : <p key={m.id} className="type-caption text-muted" style={momentStyle(m.theme)}><span aria-hidden>{momentIcon(m.theme)}</span> {m.name} · {t("moments.calendar.continues")}</p>; })}</div>}
          </li>
        );
      })}
    </ol>
  );
}

function YearList({ year, months, monthName, today }: { year: number; months: MomentsCalendar["months"]; monthName: (m: number) => string; today: string }) {
  const { t } = useI18n(); const cur = ymd(today);
  return (
    <ol className="moment-year" aria-label={t("moments.calendar.year_list", { year })}>
      {months.map((mo) => (
        <li key={mo.month} className={cn("moment-year-month", cur.y === year && cur.m === mo.month && "is-current")}>
          <h3 className="type-h3 capitalize">{monthName(mo.month)}</h3>
          {mo.items.length === 0 ? <p className="type-caption text-faint">{t("moments.calendar.free_month")}</p> : (
            <ul className="moment-year-items">{mo.items.map((m) => <li key={m.id} style={momentStyle(m.theme)}><Link href={`/moments/${m.slug}`} className="moment-day-pill"><span aria-hidden>{momentIcon(m.theme)}</span>{m.name}<span className="type-caption text-muted">{m.time.localStart.slice(5).replace("-", "/")}–{m.time.localEnd.slice(5).replace("-", "/")}</span></Link></li>)}</ul>
          )}
        </li>
      ))}
    </ol>
  );
}

function Timeline({ items, receivedAt }: { items: MomentCardData[]; receivedAt: number }) {
  const { t } = useI18n();
  const sorted = [...items].sort((a, b) => a.time.localStart.localeCompare(b.time.localStart));
  if (sorted.length === 0) return <p className="type-body-sm text-muted">{t("moments.calendar.empty_year")}</p>;
  return <ol className="moment-timeline">{sorted.map((m) => <li key={m.id}><MomentCard m={m} receivedAt={receivedAt} compact /></li>)}</ol>;
}
