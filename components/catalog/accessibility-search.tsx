"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { mediaUrl } from "@/lib/api/client";
import { accessibilityApi, EMPTY_FILTERS, FILTER_KEYS, type AccessibilityFilters, type AccessibilityResult } from "@/lib/catalog/accessibility";
import { Chip, EmptyState, ErrorState, Select, SkeletonGrid } from "@/components/ui";
import { AccessibilityFacts } from "./accessibility-facts";

const CATEGORIES = ["", "upper_piece", "lower_piece", "full_body_piece", "shoes_piece", "accessory_piece"];

function ResultCard({ item, unknown }: { item: AccessibilityResult; unknown: boolean }) {
  const { t } = useI18n();
  const url = mediaUrl(item.product.imageUrl);
  return <li className="surface grid gap-2 p-3">
    <div className="flex items-center gap-3"><span className="h-14 w-14 shrink-0 overflow-hidden rounded bg-surface-2" aria-hidden>{url && <img src={url} alt="" className="h-full w-full object-cover" />}</span>
      <span className="min-w-0"><b className="block truncate">{item.product.productName}</b>{item.product.brand?.name && <span className="type-caption text-muted">{item.product.brand.name}</span>}</span></div>
    {unknown && <p className="type-caption" role="note">{t("accessibility.unknownFor", { filters: item.unknownFilters.map((key) => t(`accessibility.filter.${key}`)).join(", ") })}</p>}
    <AccessibilityFacts info={item.accessibility} />
  </li>;
}

/** RF-PESQ-08 — filtros de facilidade de vestir por requisição; a ausência de dado nunca vira inadequação. */
export function AccessibilitySearch() {
  const { t } = useI18n();
  const [filters, setFilters] = useState<AccessibilityFilters>(EMPTY_FILTERS);
  const [category, setCategory] = useState("");
  const active = FILTER_KEYS.some((key) => filters[key]);
  const search = useApi((signal) => accessibilityApi.search(filters, category, signal), [JSON.stringify(filters), category], { enabled: active });
  return <div className="grid gap-4">
    <p className="type-body-sm text-muted">{t("accessibility.searchHint")}</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("accessibility.filtersLabel")}>{FILTER_KEYS.map((key) => <Chip key={key} active={filters[key]} onClick={() => setFilters({ ...filters, [key]: !filters[key] })}>{t(`accessibility.filter.${key}`)}</Chip>)}</div>
    <Select aria-label={t("common.category")} value={category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.map((value) => <option key={value} value={value}>{value ? t(`accessibility.category.${value}`) : t("common.all")}</option>)}</Select>
    {!active ? <EmptyState title={t("accessibility.pickFilters")} hint={t("accessibility.noProfile")} />
      : search.error ? <ErrorState error={search.error} onRetry={search.reload} />
      : !search.data ? <SkeletonGrid n={3} />
      : <>
        <section className="grid gap-2" aria-labelledby="acc-confirmed"><h2 id="acc-confirmed" className="type-h3">{t("accessibility.confirmedTitle", { count: search.data!.results.length })}</h2>
          {search.data!.results.length === 0 ? <p className="type-body-sm text-muted">{t("accessibility.noConfirmed")}</p> : <ul className="grid gap-3 sm:grid-cols-2">{search.data!.results.map((item) => <ResultCard key={item.product.id} item={item} unknown={false} />)}</ul>}</section>
        <section className="grid gap-2" aria-labelledby="acc-unknown"><h2 id="acc-unknown" className="type-h3">{t("accessibility.unknownTitle", { count: search.data!.withoutInformationCount })}</h2>
          <p className="type-caption text-muted">{t("accessibility.unknownHint")}</p>
          {search.data!.withoutInformation.length > 0 && <ul className="grid gap-3 sm:grid-cols-2">{search.data!.withoutInformation.map((item) => <ResultCard key={item.product.id} item={item} unknown />)}</ul>}</section>
      </>}
  </div>;
}
