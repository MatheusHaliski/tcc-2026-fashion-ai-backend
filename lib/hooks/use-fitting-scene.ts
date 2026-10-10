"use client";

import { useMemo } from "react";
import type { CatalogProduct } from "@/lib/api/catalog";
import type { CatalogSearchContext } from "@/components/catalog/catalog-search";
import { resolveEnvironment, type EnvironmentMode, type FittingItem } from "@/lib/tryon/fitting-room";
import { toSceneProduct, type Store } from "@/lib/tryon/fitting-room-model";
import { resolveScene } from "@/lib/scene3d/scene";

export interface FittingSearchResults {
  ctx: CatalogSearchContext;
  results: CatalogProduct[];
}

interface FittingSceneOptions {
  items: FittingItem[];
  mode: EnvironmentMode;
  search: FittingSearchResults | null;
  stores?: Store[];
  heroId: string | null;
  products: Record<string, CatalogProduct>;
}

/** Derives the room theme and product display; presentation components do not resolve catalog rules. */
export function useFittingScene({ items, mode, search, stores, heroId, products }: FittingSceneOptions) {
  const environment = useMemo(() => resolveEnvironment(items, mode), [items, mode]);
  const scene = useMemo(() => {
    if (mode !== "auto" || !search) return null;
    const { ctx, results } = search;
    if (!ctx.brand && !ctx.category && !ctx.subcategory) return null;
    const known = ctx.brand
      ? stores?.find((store) => store.name.toLowerCase() === ctx.brand.toLowerCase())
      : undefined;
    const hero = heroId ? products[heroId] : undefined;
    const heroFits = !!hero
      && (!ctx.category || hero.category === ctx.category)
      && (!ctx.brand || hero.brand?.name.toLowerCase() === ctx.brand.toLowerCase());
    return resolveScene({
      brand: ctx.brand ? { name: known?.name ?? ctx.brand, slug: known?.slug, logoUrl: known?.logoUrl ?? null } : null,
      category: ctx.category || null,
      subcategory: ctx.subcategory || null,
      product: heroFits ? toSceneProduct(hero!) : null,
      results: results.map(toSceneProduct),
      worn: items,
    });
  }, [mode, search, stores, heroId, products, items]);

  return { environment, scene };
}
