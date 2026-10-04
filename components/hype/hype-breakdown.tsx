"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { BACK_DIMENSIONS, dimensionsFor } from "@/lib/hype/model";
import type { HypeDimension, HypeEntity } from "@/lib/hype/types";
import { HypeMetricBar } from "./hype-metric-bar";

/**
 * Componentes do Hype. No verso do card: 7 dimensões de leitura rápida; na análise completa: todas, com a definição.
 * Trend e popularidade aparecem separadas de propósito — muito popular sem crescer ≠ pequeno crescendo rápido.
 */
export function HypeBreakdown({ type, dimensions, list = BACK_DIMENSIONS, hints }: { type: HypeEntity; dimensions?: Partial<Record<HypeDimension, number>>; list?: HypeDimension[]; hints?: boolean }) {
  const { t } = useI18n();
  return (
    <ul className="hype-breakdown" aria-label={t("hype.drawer.breakdown")}>
      {dimensionsFor(type, list).map((d) => <HypeMetricBar key={d} dimension={d} value={dimensions?.[d]} hint={hints} />)}
    </ul>
  );
}
