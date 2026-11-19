"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import type { DailyLookCalendarDay, DayMomentRow } from "@/lib/daily-look/types";
import { cn } from "@/components/ui";
import { DailyLookContextChips } from "@/components/daily-look/context-chips";

/**
 * O card único de vestimenta de um dia do calendário (Look do Dia Vivido §4, pedido de 19/11/2026): o look que a pessoa
 * vestiu, o Contexto do Dia e a coerência (MomentMatch) com cada Momento, desafio ou evento daquele dia. Em dia de cuidado
 * não há comparação. `compact` é a versão da célula do mês; a cheia vai na semana.
 */
export function DayLookCard({ day, compact }: { day: DailyLookCalendarDay; compact?: boolean }) {
  const { t, fmtDate } = useI18n();
  const dl = day.dailyLook;
  const sensitive = !!dl.context?.sensitive;
  const scored = day.moments.filter((m): m is DayMomentRow & { match: number } => typeof m.match === "number");
  return (
    <article className={cn("day-look", compact && "is-compact", day.coherent && "is-coherent")} aria-label={t("momentDayLook.aria", { date: fmtDate(dl.date, { day: "2-digit", month: "short" }) })}>
      <Link href={`/schemes/${dl.schemeId}`} className="day-look-main">
        <span className="day-look-thumb" aria-hidden>{dl.coverImageUrl ? <img src={dl.coverImageUrl} alt="" loading="lazy" /> : <span className="day-look-thumb-empty">👗</span>}</span>
        <span className="day-look-text">
          <span className="type-caption text-muted">{t("momentDayLook.worn")}</span>
          <b className="day-look-title">{dl.title}</b>
        </span>
      </Link>
      <DailyLookContextChips context={dl.context} compact={compact} />
      {!compact && day.moments.length === 0 && <p className="type-caption text-faint">{t("momentDayLook.no_moment")}</p>}
      {sensitive && day.moments.length > 0 && <p className="type-caption text-muted">{t("momentDayLook.sensitive")}</p>}
      {!sensitive && scored.length > 0 && (
        <ul className="day-look-moments" aria-label={t("momentDayLook.coherence")}>
          {scored.slice(0, compact ? 1 : 4).map((m) => (
            <li key={m.momentId} className={cn("day-look-moment", m.coherent ? "is-coherent" : "is-off")}>
              <span aria-hidden>{m.icon ?? "◌"}</span> {t(m.coherent ? "momentDayLook.coherent" : "momentDayLook.off_theme", { name: m.label, match: m.match })}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
