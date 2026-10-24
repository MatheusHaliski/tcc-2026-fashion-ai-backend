"use client";

import { CatalogBrandGrid } from "@/components/catalog/catalog-brand-grid";
import { CatalogSearch, type CatalogSearchContext } from "@/components/catalog/catalog-search";
import { Card, Chip, SegmentPicker, Skeleton } from "@/components/ui";
import type { CatalogProduct, CatalogVariant } from "@/lib/api/catalog";
import { CATEGORY_LABEL, label } from "@/lib/api/taxonomy";
import { CATEGORY_CARDS } from "@/lib/capture/capture-guides";
import { useI18n } from "@/lib/i18n/i18n";
import { toDatabaseTipoLook, type Sex, type Store } from "@/lib/tryon/fitting-room-model";

export interface StoreBrowserProps {
  stores: Store[];
  loading: boolean;
  store: string;
  category: string;
  tipoLook: Sex;
  onTipoLookChange: (sex: Sex) => void;
  gender?: string;
  onGenderChange?: (gender: string) => void;
  onStoreChange: (store: string) => void;
  onCategoryChange: (category: string) => void;
  onPick: (product: CatalogProduct, variant: CatalogVariant | null) => void;
  onResults: (context: CatalogSearchContext, products: CatalogProduct[]) => void;
  resultsTarget: HTMLElement | null;
}

export function StoreBrowser({
  stores, loading, store, category, tipoLook, onTipoLookChange, gender, onGenderChange, onStoreChange, onCategoryChange, onPick, onResults, resultsTarget,
}: StoreBrowserProps) {
  const { t } = useI18n();

  return (
    <Card className="fitting-store-filters">
      <section className="fitting-control-group" aria-label={t("lookType.label")}>
        <p className="label">{t("lookType.label")}</p>
        <SegmentPicker
          label={t("lookType.label")}
          value={tipoLook}
          onChange={onTipoLookChange}
          options={[
            { id: "MASCULINO", label: t("common.masculino") },
            { id: "FEMININO", label: t("common.feminino") },
            { id: "UNISEX", label: t("tryOn.unisex") },
          ]}
        />
        <span className="type-caption text-muted" role="status" aria-live="polite" data-tipo-look={toDatabaseTipoLook(tipoLook)}>
          {t("tryOn.look_tipo", { sex: tipoLook })}
        </span>
      </section>
      <section aria-label={t("tryOn.lojas_em_destaque")}>
        <p className="label">{t("tryOn.lojas_em_destaque")}</p>
        {loading ? (
          <Skeleton className="h-16" />
        ) : stores.length ? (
          <CatalogBrandGrid stores={stores} selected={store} category={category} label={t("tryOn.lojas_em_destaque")}
            onPick={(entry) => onStoreChange(store === entry.name ? "" : entry.name)} />
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

      <CatalogSearch
        brandGrid={false}
        key={store}
        initial={{ brand: store }}
        category={category}
        gender={gender}
        onGenderChange={onGenderChange}
        onClearCategory={() => onCategoryChange("")}
        onClearBrand={() => onStoreChange("")}
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
