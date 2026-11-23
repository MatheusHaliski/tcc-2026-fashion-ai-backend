"use client";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { LivingToday as LivingTodayData, OnThisDay as OnThisDayData, TomorrowInvite as TomorrowInviteData } from "@/lib/daily-look/types";
import { Card, cn } from "@/components/ui";
import { DailyLookContextChips, DailyLookMarks } from "@/components/daily-look/context-chips";

/** F2 §4.1 — "quem mais está vivendo isso hoje": looks com a mesma missão no mesmo dia; só com ≥ 5 pessoas; nunca em dia de cuidado ou "só eu". */
export function LivingToday() {
  const { t } = useI18n();
  const { data } = useApi<LivingTodayData>((signal) => api.get("/api/me/daily-looks/living-today", { signal }), []);
  if (!data || !data.purpose || data.hidden) return null;
  const purpose = (data.purposeLabel ?? "").toLowerCase();
  return (
    <Card className="mb-4 living-today" aria-labelledby="living-today-title">
      <h2 id="living-today-title" className="type-h3 mb-1">{t("livingToday.title")}</h2>
      {data.enough ? <p className="type-body-sm text-muted mb-2">{t("livingToday.count", { n: data.count, purpose })}</p> : <p className="type-body-sm text-muted">{t("livingToday.few", { purpose, min: data.minGroup ?? 5 })}</p>}
      {data.enough && <ul className="living-today-rail" aria-label={t("livingToday.rail")}>
        {data.looks.map((l) => <li key={l.schemeId} className="living-today-item"><Link href={`/schemes/${l.schemeId}`} className="day-look-main"><span className="day-look-thumb" aria-hidden>{l.coverImageUrl ? <img src={l.coverImageUrl} alt="" loading="lazy" /> : <span className="day-look-thumb-empty">👗</span>}</span><span className="day-look-text"><span className="type-caption text-muted">@{l.owner.username}{l.worked ? ` · ${t("livingToday.worked")}` : ""}</span><b className="day-look-title">{l.title}</b></span></Link></li>)}
      </ul>}
    </Card>
  );
}

/** §4.5 — convite da véspera: "Amanhã: apresentação. Quer preparar o Look do Dia agora?" (uma vez, sem notificação). */
export function TomorrowInvite() {
  const { t } = useI18n();
  const { data } = useApi<TomorrowInviteData | null>((signal) => api.get("/api/me/daily-looks/tomorrow", { signal }), []);
  if (!data || data.hasLook) return null;
  return (
    <Card className={cn("mb-4 tomorrow-invite")} aria-labelledby="tomorrow-title">
      <p id="tomorrow-title" className="type-body mb-2">{data.message}</p>
      {data.moments.length > 0 && <DailyLookMarks marks={data.moments} compact className="mb-2" />}
      <Link href={data.prepareHref} className="btn btn-sm btn-primary">{t("tomorrow.prepare")}</Link>
    </Card>
  );
}

/** F3 §4.3 — "mesma data, outro ano": memória, não métrica. */
export function OnThisDay() {
  const { t } = useI18n();
  const { data } = useApi<OnThisDayData>((signal) => api.get("/api/me/daily-looks/on-this-day", { signal }), []);
  if (!data || data.items.length === 0) return null;
  return (
    <Card className="mb-4 on-this-day" aria-labelledby="on-this-day-title">
      <h2 id="on-this-day-title" className="type-h3 mb-2">{t("onThisDay.title")}</h2>
      <ul className="grid gap-2">
        {data.items.map((r) => <li key={r.id} className="on-this-day-item"><p className="type-caption text-muted">{t("onThisDay.years_ago", { n: r.yearsAgo })}</p><Link href={`/schemes/${r.schemeId}`} className="type-body"><b>{r.title}</b></Link><DailyLookContextChips context={r.context} compact /></li>)}
      </ul>
    </Card>
  );
}
