"use client";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { ExperienceRow } from "@/lib/daily-look/types";

/** Selo de experiência do look (F2 §4.2): "Usado em 3 entrevistas · 2 deram certo" — dado da própria pessoa, nunca promessa. */
export function ExperienceBadges({ schemeId }: { schemeId: string }) {
  const { t } = useI18n();
  const { data } = useApi<ExperienceRow[]>((signal) => api.get(`/api/me/daily-looks/experience?schemeId=${encodeURIComponent(schemeId)}`, { signal }), [schemeId]);
  if (!data || data.length === 0) return null;
  return (
    <ul className="dl-experience" aria-label={t("dailyLookExperience.aria")}>
      {data.map((r) => <li key={r.purpose} className="dl-experience-row"><b>{t("dailyLookExperience.used", { n: r.times, purpose: r.label.toLowerCase() })}</b>{r.worked > 0 && <span className="text-muted"> · {t("dailyLookExperience.worked", { n: r.worked })}</span>}</li>)}
    </ul>
  );
}
