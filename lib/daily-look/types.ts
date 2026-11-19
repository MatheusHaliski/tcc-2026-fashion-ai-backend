/**
 * Look do Dia Vivido (docs/novos-rf/PROPOSTA_LOOK_DO_DIA_VIVIDO.md) — contrato com /api/me/daily-look,
 * /api/me/daily-looks/suggest-context e /api/me/daily-looks/calendar. Rótulos vêm prontos do servidor, no idioma de quem lê.
 */
export type CalendarMarkKind = "WEEKDAY" | "SEASON" | "WEATHER" | "MOMENT";

/** Marca do calendário congelada no dia do registro (DailyLookContextService.marks). */
export interface CalendarMark { kind: CalendarMarkKind; code: string; label: string; weekend?: boolean; temperatureC?: number; momentId?: string; type?: string; nature?: string; icon?: string | null }

/** Leitura do Contexto do Dia (DailyLookContextService.view); nulo quando a pessoa não contou nada. */
export interface DailyLookContextView {
  purpose?: string | null; purposeLabel?: string | null; purposeNote?: string | null; audience?: string | null; audienceLabel?: string | null;
  sensitive: boolean; privateOnly: boolean; marks: CalendarMark[];
}

/** O que a pessoa manda ao marcar o Look do Dia (LookbookController.DailyLookRequest.context). */
export interface DailyLookContextInput { purpose?: string | null; purposeNote?: string | null; audience?: string | null; latitude?: number | null; longitude?: number | null; city?: string | null }

export interface PurposeOption { code: string; label: string; sensitive: boolean }
export interface AudienceOption { code: string; label: string; privateOnly: boolean }

/** GET /api/me/daily-looks/suggest-context */
export interface ContextSuggestion {
  date: string; prompt: string; marks: CalendarMark[]; suggestedPurposes: PurposeOption[]; purposes: PurposeOption[]; audiences: AudienceOption[];
  weekPlanDay?: { id: string; eventLabel: string; occasion: string } | null;
}

/** Registro de Look do Dia como o backend devolve (DailyLookService.view). */
export interface DailyLookRow { id: string; date: string; source: string; schemeId: string; title: string; coverImageUrl?: string | null; feedback?: string | null; context?: DailyLookContextView | null }

/** Um Momento do dia com a coerência do look (MomentDays.match); sem `match` quando o propósito é sensível. */
export interface DayMomentRow { momentId: string; code: string; label: string; type: string; nature: string; icon?: string | null; match?: number | null; interpretation?: string | null; reasons?: string[]; coherent?: boolean }

export interface DailyLookCalendarDay { date: string; dailyLook: DailyLookRow; moments: DayMomentRow[]; coherent: boolean }

/** GET /api/me/daily-looks/calendar?year[&month] */
export interface DailyLookCalendar { year: number; month?: number | null; days: DailyLookCalendarDay[]; summary: { days: number; coherentDays: number } }
