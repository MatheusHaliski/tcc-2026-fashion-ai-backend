"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
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
  /** Acervo paginado no servidor: total real (todas as peças, não só as já carregadas). */
  total?: number;
  /** Há mais páginas no servidor; "Próxima" na última página carregada busca a seguinte. */
  hasMoreRemote?: boolean;
  onNeedMore?: () => void;
}

/**
 * Pagina os resultados em até duas linhas por tela. Com o acervo paginado no servidor, a contagem é a do banco e a
 * página seguinte só é buscada quando a pessoa avança além do que já chegou — nada de carregar o acervo inteiro sozinho.
 */
export function CatalogResultsGrid({ products, resetKey, renderProduct, total, hasMoreRemote = false, onNeedMore }: CatalogResultsGridProps) {
  const { t } = useI18n();
  const columns = useSyncExternalStore(subscribeColumns, readColumns, () => 2);
  const size = columns * 2;
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(products.length / size) - 1);
  const currentPage = Math.min(page, lastPage);

  // Nova busca, filtro ou distribuição de colunas começa na primeira página; páginas que chegam do servidor somam
  // à lista sem tirar a pessoa de onde está (o primeiro item continua o mesmo).
  const firstId = products[0]?.id;
  useLayoutEffect(() => { setPage(0); }, [resetKey, firstId, columns]);
  // avançou além do que já chegou: busca a próxima página e fica nela quando chegar
  const waiting = page > lastPage && hasMoreRemote;
  const asked = useRef(-1);
  useEffect(() => {
    if (waiting && asked.current !== products.length) { asked.current = products.length; onNeedMore?.(); }
  }, [waiting, products.length, onNeedMore]);

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
        total={total ?? products.length}
        hasMore={currentPage < lastPage || hasMoreRemote}
        onPage={(next) => setPage(Math.max(0, Math.min(next, hasMoreRemote ? lastPage + 1 : lastPage)))}
      />
    </>
  );
}
