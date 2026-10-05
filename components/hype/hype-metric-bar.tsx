"use client";
import { useI18n } from "@/lib/i18n/i18n";
import type { HypeDimension } from "@/lib/hype/types";

/** Uma dimensão do Hype: nome, valor 0–100 e barra (magnitude, uma cor só). Sem dado = "—" (nunca uma barra zerada). */
export function HypeMetricBar({ dimension, value, hint, weight }: { dimension: HypeDimension; value?: number | null; hint?: boolean; weight?: number | null }) {
  const { t } = useI18n();
  const label = t(`hype.dimension.${dimension}`);
  const has = value != null;
  return (
    <li className="hype-metric">
      <span className="hype-metric-label">{label}{weight != null && <span className="hype-metric-weight">{t("hype.drawer.weight", { value: Math.round(weight * 100) })}</span>}{hint && <span className="hype-metric-hint">{t(`hype.dimension_hint.${dimension}`)}</span>}</span>
      <span className="hype-metric-value tabular">{has ? Math.round(value!) : <><span aria-hidden>—</span><span className="sr-only">{t("hype.dimension.missing")}</span></>}</span>
      <span className="hype-bar hype-metric-bar" aria-hidden><i style={{ width: `${has ? Math.max(0, Math.min(100, value!)) : 0}%` }} /></span>
    </li>
  );
}
