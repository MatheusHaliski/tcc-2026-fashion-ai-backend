"use client";

import { useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Pagination } from "@/components/ui";
import type { CatalogProduct } from "@/lib/api/catalog";
import { useI18n } from "@/lib/i18n/i18n";

const TABLET = "(min-width: 640px)";
const DESKTOP = "(min-width: 1024px)";

function subscribeColumns(onChange: () => void) {
  const queries = [window.matchMedia(TABLET), window.matchMedia(DESKTOP)];
  queries.forEach((query) => query.addEventListener("change", onChange));
  return () => queries.forEach((query) => query.removeEventListener("change", onChange));
}

function readColumns() {
  return window.matchMedia(DESKTOP).matches ? 4 : window.matchMedia(TABLET).matches ? 3 : 2;
}

export interface CatalogResultsGridProps {
  products: CatalogProduct[];
  resetKey: string;
  renderProduct: (product: CatalogProduct) => ReactNode;
}

/** Pagina os resultados retornados pela busca em até duas linhas por tela. */
export function CatalogResultsGrid({ products, resetKey, renderProduct }: CatalogResultsGridProps) {
  const { t } = useI18n();
  const columns = useSyncExternalStore(subscribeColumns, readColumns, () => 2);
  const size = columns * 2;
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(products.length / size) - 1);
  const currentPage = Math.min(page, lastPage);

  // Nova busca, filtro ou distribuição de colunas começa na primeira página.
  useLayoutEffect(() => { setPage(0); }, [resetKey, products, columns]);

  return (
    <>
      <ul className="catalog-results-matrix" aria-label={t("catalog.resultados")} data-columns={columns}>
        {products.slice(currentPage * size, (currentPage + 1) * size).map((product) => (
          <li key={product.id}>{renderProduct(product)}</li>
        ))}
      </ul>
      <Pagination
        page={currentPage}
        size={size}
        total={products.length}
        hasMore={currentPage < lastPage}
        onPage={(next) => setPage(Math.max(0, Math.min(next, lastPage)))}
      />
    </>
  );
}
