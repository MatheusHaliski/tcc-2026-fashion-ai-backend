"use client";
import { useId, useState, type ReactNode } from "react";
import { cn, ErrorState } from "@/components/ui";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { chartState, readProductChoice, saveProductChoice, type ChartResponse, type ProductChart } from "@/lib/fit/product-chart";

/** Reads the existing authenticated product-chart API; never invokes AI or infers missing measurements. */
export function ProductChartSizes({ productId, fallback }: { productId: string; fallback: ReactNode }) {
  const { t } = useI18n();
  const result = useApi<ChartResponse>((signal) => api.get(`/api/catalog/products/${productId}/size-chart`, { signal }), [productId]);
  if (result.loading) return <p role="status">{t("size.productChart.loading")}</p>;
  if (result.error) return <><ErrorState error={result.error} onRetry={result.reload} />{fallback}</>;
  const state = result.data ? chartState(result.data, productId) : "NO_CHART";
  if (state !== "AVAILABLE" || !result.data?.chart) return <>
    <p role="status">{t(`size.productChart.${state}`)}</p>
    {fallback}
  </>;
  return <ChartChoices key={`${productId}:${result.data.revision}`} productId={productId}
    revision={result.data.revision} chart={result.data.chart} />;
}

function ChartChoices({ productId, revision, chart }: { productId: string; revision: number; chart: ProductChart }) {
  const { t } = useI18n();
  const groupName = useId();
  const options = [...chart.options].sort((a, b) => a.order - b.order);
  const [chosen, setChosen] = useState(() => readProductChoice(productId, revision, options));
  return <section className="grid gap-3">
    <p className="type-body">{t(`size.productChart.${chart.type}`)}</p>
    <p className="type-caption">{t("size.productChart.source", { name: chart.sourceName, revision: chart.sourceRevision })}</p>
    <div role="radiogroup" aria-label={t("size.productChart.choose")} className="flex flex-wrap gap-2">
      {options.map((option) => <label key={option.label} className={cn("chip", chosen === option.label && "is-active")}>
        <input type="radio" name={groupName} value={option.label} checked={chosen === option.label}
          onChange={() => { setChosen(option.label); saveProductChoice(productId, revision, option.label); }} />
        {option.label}
      </label>)}
    </div>
    {chosen && <p role="status">{t("size.productChart.saved", { size: chosen })}</p>}
    <div className="overflow-x-auto">
      <table className="w-full type-body-sm">
        <caption>{t("size.productChart.caption")}</caption>
        <thead><tr><th scope="col">{t("size.col.size")}</th><th scope="col">{t("size.productChart.measurements")}</th></tr></thead>
        <tbody>{options.map((option) => <tr key={option.label}>
          <th scope="row">{option.label}</th>
          <td><ul>{option.measurements.map((dimension, i) => <li key={i}>
            {t(`size.productChart.region.${dimension.region}`)}: {dimension.min}–{dimension.max} cm
            {dimension.protocol === "GARMENT_FLAT_WIDTH_V1" && ` (${t("size.productChart.flatWidth")})`}
          </li>)}</ul></td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="type-caption">{t("size.productChart.scope")}</p>
  </section>;
}
