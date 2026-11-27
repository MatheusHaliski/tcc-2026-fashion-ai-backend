import { tr } from "@/lib/i18n/i18n";
import { getCurrentLocale, intlOf } from "@/lib/i18n/state";

/** Métricas que o servidor manda em /api/me/issuer-metrics e têm nome próprio na tela. */
const KNOWN = ["suggested", "accepted", "approved", "pendingReview", "activeSeals", "redemptions", "conversionSealToRedemption"];
/** Métricas que são porcentagem (0–100). */
const PERCENT = new Set(["conversionSealToRedemption"]);

/** Nome da métrica do emissor no idioma da pessoa; métrica nova sem tradução cai no nome técnico em minúsculas. */
export function issuerMetricLabel(key: string): string {
  return KNOWN.includes(key) ? tr(`issuerMetrics.${key}`) : key.replace(/([A-Z])/g, " $1").toLowerCase();
}

/** Valor da métrica com no máximo 1 casa decimal no formato do idioma; porcentagens levam "%". */
export function issuerMetricValue(key: string, value: number | string): string {
  if (typeof value !== "number") return value;
  const text = new Intl.NumberFormat(intlOf(getCurrentLocale()), { maximumFractionDigits: 1 }).format(value);
  return PERCENT.has(key) ? `${text}%` : text;
}
