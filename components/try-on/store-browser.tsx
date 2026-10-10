"use client";

import { BrandLogo } from "@/components/brand-logo";
import { CatalogSearch, type CatalogSearchContext } from "@/components/catalog/catalog-search";
import { Card, Chip, Skeleton, cn } from "@/components/ui";
import type { CatalogProduct, CatalogVariant } from "@/lib/api/catalog";
import { CATEGORY_LABEL, label } from "@/lib/api/taxonomy";
import { CATEGORY_CARDS } from "@/lib/capture/capture-guides";
import { useI18n } from "@/lib/i18n/i18n";
import type { Store } from "@/lib/tryon/fitting-room-model";

export interface StoreBrowserProps {
  stores: Store[];
  loading: boolean;
  store: string;
  category: string;
  onStoreChange: (store: string) => void;
  onCategoryChange: (category: string) => void;
  onPick: (product: CatalogProduct, variant: CatalogVariant | null) => void;
  onResults: (context: CatalogSearchContext, products: CatalogProduct[]) => void;
  resultsTarget: HTMLElement | null;
}

/** Vitrine do catálogo; a seleção e os resultados pertencem ao coordenador do provador. */
export function StoreBrowser({
  stores, loading, store, category, onStoreChange, onCategoryChange, onPick, onResults, resultsTarget,
}: StoreBrowserProps) {
  const { t } = useI18n();

  return (
    <Card className="fitting-store-filters">
      <section aria-label={t("tryOn.lojas_em_destaque")}>
      <p className="label">{t("tryOn.lojas_em_destaque")}</p>
      {loading ? (
        <Skeleton className="h-16" />
      ) : stores.length ? (
        <div className="fitting-stores" role="group" aria-label={t("tryOn.lojas_em_destaque")}>
          {stores.map((entry) => (
            <button
              key={entry.brandId}
              type="button"
              className={cn("fitting-store", store === entry.name && "is-active")}
              aria-pressed={store === entry.name}
              onClick={() => onStoreChange(store === entry.name ? "" : entry.name)}
            >
              <BrandLogo name={entry.name} src={entry.logoUrl} size={32} shape="square" />
              <span className="fitting-store-name">{entry.name}</span>
              <span className="type-caption text-muted">
                {t("tryOn.n_produtos", { n: entry.catalogProducts })}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="type-caption text-muted">{t("tryOn.sem_lojas")}</p>
      )}
      </section>

      <section className="fitting-category-filters" aria-label={t("tryOn.o_que_provar")}>
      <p className="label mt-3">{t("tryOn.o_que_provar")}</p>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label={t("tryOn.o_que_provar")}>
        <Chip active={!category} onClick={() => onCategoryChange("")}>
          {t("tryOn.tudo")}
        </Chip>
        {CATEGORY_CARDS.map((entry) => (
          <Chip
            key={entry.id}
            active={category === entry.id}
            onClick={() => onCategoryChange(category === entry.id ? "" : entry.id)}
          >
            {CATEGORY_LABEL[entry.id] ?? label(entry.id)}
          </Chip>
        ))}
      </div>
      </section>

      <CatalogSearch brandGrid={false}
        key={store}
        initial={{ brand: store }}
        category={category}
        browse
        onPick={onPick}
        onResults={onResults}
        pickLabel={t("tryOn.provar_peca")}
        noResultHint={t("tryOn.sem_resultado_dica")}
        resultsMount={{ target: resultsTarget }}
        resultsLayout="matrix"
      />
    </Card>
  );
}
