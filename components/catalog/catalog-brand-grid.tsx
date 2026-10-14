"use client";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { cn, Pagination } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import type { Store } from "@/lib/tryon/fitting-room-model";

/** Peças da marca no tipo escolhido (o bloco mostra esse número, não o total de todas as categorias). */
export function storeCount(store: Store, category?: string): number {
  if (!category) return store.catalogProducts;
  if (store.categoryCounts) return store.categoryCounts[category] ?? 0;
  return store.categories?.includes(category) ? store.catalogProducts : 0;
}
/** Shared clickable brand matrix for the fitting room and catalog piece creator. */
export function CatalogBrandGrid({ stores, selected, category, label, labelledBy, onPick, pageSize = 8 }: {
  stores: Store[]; selected: string; category?: string; label?: string; labelledBy?: string; onPick: (store: Store) => void;
  /** marcas por página; a busca do catálogo já pagina por fora e passa o tamanho da página dela */
  pageSize?: number;
}) {
  const { t } = useI18n();
  const size = pageSize;
  const [page, setPage] = useState(0);
  const key = stores.map(store => store.brandId).join("|") + (category ?? "");
  useEffect(() => { setPage(0); }, [key]);
  const last = Math.max(0, Math.ceil(stores.length / size) - 1);
  const current = Math.min(page, last);
  return <><div className="fitting-stores" role="group" aria-label={label} aria-labelledby={labelledBy}>
    {stores.slice(current * size, (current + 1) * size).map(entry => <button key={entry.brandId} type="button"
      className={cn("fitting-store", selected === entry.name && "is-active", !storeCount(entry, category) && "is-empty")}
      aria-pressed={selected === entry.name} onClick={() => onPick(entry)}>
      <BrandLogo name={entry.name} src={entry.logoUrl} size={32} shape="square" />
      <span className="fitting-store-name">{entry.name}</span>
      <span className="type-caption text-muted">{t("tryOn.n_produtos", { n: storeCount(entry, category) })}</span>
    </button>)}
  </div>
    {stores.length > size && <Pagination page={current} size={size} total={stores.length} hasMore={current < last} onPage={next => setPage(Math.max(0, Math.min(next, last)))} />}
  </>;
}
