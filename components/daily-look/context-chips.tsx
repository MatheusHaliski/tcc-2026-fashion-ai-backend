"use client";
import { useI18n } from "@/lib/i18n/i18n";
import type { CalendarMark, DailyLookContextView } from "@/lib/daily-look/types";
import { cn } from "@/components/ui";

const MARK_ICON: Record<string, string> = { WEEKDAY: "📅", SEASON: "🍃", WEATHER: "🌤", MOMENT: "◌" };

/** Marcas do calendário (dia da semana, estação, clima, Momentos) como chips somente leitura; nada depende só do ícone. */
export function DailyLookMarks({ marks, compact, className }: { marks: CalendarMark[]; compact?: boolean; className?: string }) {
  const { t } = useI18n();
  if (!marks || marks.length === 0) return null;
  return (
    <ul className={cn("dl-marks", compact && "is-compact", className)} aria-label={t("dailyLookContext.marks")}>
      {marks.map((m) => <li key={`${m.kind}-${m.code}`} className={cn("dl-mark", `is-${m.kind.toLowerCase()}`)} title={m.label}><span aria-hidden>{m.kind === "MOMENT" && m.icon ? m.icon : MARK_ICON[m.kind] ?? "•"}</span>{compact && m.kind === "WEATHER" ? m.label.split(" · ")[0] : m.label}</li>)}
    </ul>
  );
}

/** Contexto do Dia de um Look do Dia: propósito (e nota), para quem e as marcas congeladas no dia. `compact` (célula do mês,
 * linhas de histórico): só o propósito e as marcas, clima reduzido à temperatura — anatomia em docs/anatomias. */
export function DailyLookContextChips({ context, compact, className }: { context?: DailyLookContextView | null; compact?: boolean; className?: string }) {
  const { t } = useI18n();
  if (!context) return null;
  const hasPurpose = !!context.purposeLabel || !!context.purposeNote || !!context.audienceLabel;
  return (
    <div className={cn("dl-context", compact && "is-compact", className)}>
      {hasPurpose && (
        <p className="dl-purpose">
          {context.purposeLabel && <b className={cn("dl-purpose-chip", context.sensitive && "is-sensitive")}>{context.sensitive ? "🔒 " : ""}{context.purposeLabel}</b>}
          {context.purposeNote && !compact && <span className="dl-note">{context.purposeNote}</span>}
          {context.audienceLabel && !compact && <span className="dl-audience">· {t("dailyLookContext.for", { who: context.audienceLabel })}</span>}
        </p>
      )}
      <DailyLookMarks marks={context.marks} compact={compact} />
    </div>
  );
}
