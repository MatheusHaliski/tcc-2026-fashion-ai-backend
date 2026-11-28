"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, qs } from "@/lib/api/client";
import type { CatalogProduct } from "@/lib/api/catalog";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, EmptyState, ErrorState, SkeletonGrid } from "@/components/ui";
import { CatalogResultCard } from "./catalog-result-card";

export function SavedCatalogProducts() {
  const { t } = useI18n();
  const router = useRouter();
  const [page, setPage] = useState(0);
  const { data, loading, error, reload } = useApi<{ items: CatalogProduct[]; hasMore: boolean }>(
    (signal) => api.get(`/api/me/saved-catalog-products?page=${page}`, { signal }), [page],
  );
  useEffect(() => {
    if (page > 0 && !loading && !error && data?.items.length === 0) setPage(page - 1);
  }, [data, error, loading, page]);
  if (loading) return <SkeletonGrid />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data?.items.length) return <EmptyState title={t("lookbook.noSavedCatalogProducts")} />;
  return (
    <>
      <div className="grid-cards is-pieces social-card-grid">
        {data.items.map((product) => (
          <CatalogResultCard key={product.id} product={product} pickLabel={t("marketplace.create_from_catalog")}
            onSavedChange={(saved) => { if (!saved) reload(); }}
            onPick={(_, selected) => router.push(`/pieces/new${qs({
              brand: selected.brand?.name, q: selected.productName, category: selected.category, subcategory: selected.subcategory,
            })}`)} />
        ))}
      </div>
      {(page > 0 || data.hasMore) && <nav className="mt-3 flex gap-2" aria-label={t("lookbook.savedCatalogProducts")}>
        <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("marketplace.previous")}</Button>
        <Button size="sm" disabled={!data.hasMore} onClick={() => setPage(page + 1)}>{t("marketplace.next")}</Button>
      </nav>}
    </>
  );
}
