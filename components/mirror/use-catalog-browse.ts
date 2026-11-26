"use client";
import { useEffect, useState } from "react";
import { catalogApi, type CatalogProduct } from "@/lib/api/catalog";

export const CATALOG_PAGE_SIZE = 12;

interface Page { items: CatalogProduct[]; total: number | null; hasMore: boolean; loading: boolean; error: unknown }

/**
 * O catálogo de marcas paginado de uma parte do look no Espelho: a mesma busca do acervo inteiro (GET
 * /api/catalog/products, ordem estável, total real e hasMore) filtrada pela categoria da parte e pelo texto digitado
 * (marca, modelo, cor — o texto de busca do produto inclui a marca). Digitar espera uma pausa curta e volta para a
 * primeira página; "Carregar mais" soma a seguinte sem repetir produto. Pedido velho é cancelado.
 */
export function useCatalogBrowse(category: string | null) {
  const [text, setText] = useState("");
  const [request, setRequest] = useState({ q: "", page: 0 });
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Page>({ items: [], total: null, hasMore: false, loading: true, error: null });
  useEffect(() => {
    const q = text.trim().length >= 2 ? text.trim() : "";
    if (q === request.q) return;
    const timer = setTimeout(() => setRequest({ q, page: 0 }), 300);
    return () => clearTimeout(timer);
  }, [text, request.q]);
  useEffect(() => {
    const ctl = new AbortController();
    const { q, page } = request;
    setState((s) => ({ ...s, loading: true, error: null, items: page === 0 ? [] : s.items }));
    catalogApi.browse({ category: category ?? undefined, q: q || undefined, page, size: CATALOG_PAGE_SIZE }, ctl.signal)
      .then((r) => setState((s) => ({
        items: page === 0 ? r.items : [...s.items, ...r.items.filter((x) => !s.items.some((p) => p.id === x.id))],
        total: r.total, hasMore: r.hasMore, loading: false, error: null,
      })))
      .catch((error) => { if (!ctl.signal.aborted) setState((s) => ({ ...s, loading: false, error })); });
    return () => ctl.abort();
  }, [category, request, attempt]);
  return {
    ...state, text, setText,
    loadMore: () => setRequest((r) => ({ ...r, page: r.page + 1 })),
    retry: () => setAttempt((n) => n + 1),
  };
}
