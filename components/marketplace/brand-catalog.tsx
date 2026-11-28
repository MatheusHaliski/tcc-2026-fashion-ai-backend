"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CatalogResultCard } from "@/components/catalog/catalog-result-card";
import { Button, ErrorState, Field, Input } from "@/components/ui";
import { api, qs } from "@/lib/api/client";
import type { CatalogProduct } from "@/lib/api/catalog";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import styles from "./marketplace.module.css";

export function BrandCatalog({ slug }: { slug: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const url = `/api/marketplace/brands/${encodeURIComponent(slug)}/catalog${qs({ q: query, page })}`;
  const catalog = useApi<{ items: CatalogProduct[]; hasMore: boolean }>((signal) => api.get(url, { signal }), [url]);
  return (
    <section className={styles.directory}>
      <Field id="brand-catalog-search" label={t("common.search")}>
        <Input type="search" id="brand-catalog-search" value={query} onChange={(event) => {
          setQuery(event.target.value);
          setPage(0);
        }} />
      </Field>
      {catalog.error ? <ErrorState error={catalog.error} onRetry={catalog.reload} /> :
        catalog.loading ? <p role="status">{t("marketplace.loading")}</p> :
        !catalog.data?.items.length ? <p>{t("marketplace.empty_pieces")}</p> :
        <div className={styles.cards}>{catalog.data.items.map((item) => (
          <CatalogResultCard key={item.id} product={item} pickLabel={t("marketplace.create_from_catalog")}
            onPick={(_, product) => router.push(`/pieces/new${qs({ brand: product.brand?.name, q: product.productName, category: product.category, subcategory: product.subcategory })}`)} />
        ))}</div>}
      {(page > 0 || catalog.data?.hasMore) && <div className={styles.pagination}>
        <Button disabled={page === 0 || catalog.loading} size="sm" onClick={() => setPage(page - 1)}>{t("marketplace.previous")}</Button>
        <Button disabled={!catalog.data?.hasMore || catalog.loading} size="sm" onClick={() => setPage(page + 1)}>{t("marketplace.next")}</Button>
      </div>}
    </section>
  );
}
