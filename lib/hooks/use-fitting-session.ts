"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import type { CatalogProduct, CatalogVariant } from "@/lib/api/catalog";
import { useI18n } from "@/lib/i18n/i18n";
import { useToast } from "@/components/ui";
import {
  decodeTryOn, removeSlot, restoreFittingItems, wearItem,
  type FittingItem, type FittingSlot,
} from "@/lib/tryon/fitting-room";
import { fromCatalog, type State } from "@/lib/tryon/fitting-room-model";
import { read, write, SESSION_KEY } from "@/lib/tryon/fitting-room-storage";
import { loadScheme, restoreTryOn, wardrobeIndex, withMySize } from "@/lib/tryon/fitting-session-items";
import { gridOf, writeMySize } from "@/lib/tryon/sizes";
import { useFittingOwnership } from "./use-fitting-ownership";

interface FittingSessionOptions {
  data: State | null;
  colors?: Record<string, string>;
  searchParams: ReadonlyURLSearchParams;
  onStatus: (message: string) => void;
  onOwned: () => void;
}

/**
 * Session use cases: restore, wear, remove, change variant and add a catalog item to the wardrobe.
 * Fachada do provador: restauração e "meu tamanho" em `lib/tryon/fitting-session-items`, inclusão no guarda-roupa em
 * `useFittingOwnership`; o contrato devolvido ao FittingRoom não muda.
 */
export function useFittingSession({ data, colors, searchParams, onStatus, onOwned }: FittingSessionOptions) {
  const { t } = useI18n();
  const toast = useToast();
  const [items, setItems] = useState<FittingItem[]>([]);
  const [products, setProducts] = useState<Record<string, CatalogProduct>>({});
  const { owned, busyOwn, ownIt } = useFittingOwnership(onOwned);
  const booted = useRef(false);

  const slotNames: Record<FittingSlot, string> = {
    upper_piece: t("tryOn.slot_upper"),
    lower_piece: t("tryOn.slot_lower"),
    shoes_piece: t("tryOn.slot_shoes"),
    accessory_piece: t("tryOn.slot_accessory"),
  };

  const commit = useCallback((next: FittingItem[]) => {
    setItems(next);
    write("session", SESSION_KEY, next);
  }, []);

  useEffect(() => {
    if (booted.current || !data) return;
    booted.current = true;
    const refs = decodeTryOn(searchParams.get("provar"));
    if (!refs.length) {
      setItems(restoreFittingItems(read<FittingItem[]>("session", SESSION_KEY, [])));
      return;
    }
    void restoreTryOn(refs, wardrobeIndex(data), colors, (product) => setProducts((current) => ({ ...current, [product.id]: product })))
      .then(commit);
  }, [data, searchParams, colors, commit]);

  useEffect(() => {
    const schemeId = searchParams.get("scheme");
    if (!schemeId || !data) return;
    loadScheme(schemeId, wardrobeIndex(data)).then(commit).catch(() => undefined);
  }, [searchParams, data, commit]);

  function tryOn(item: FittingItem) {
    item = withMySize(item);
    commit(wearItem(items, item));
    onStatus(t("tryOn.provando_status", {
      name: item.name, slot: slotNames[item.slot], marca: item.brand?.name ?? "",
    }));
  }

  function pickProduct(product: CatalogProduct, variant: CatalogVariant | null) {
    setProducts((current) => ({ ...current, [product.id]: product }));
    const item = fromCatalog(product, variant ?? product.selectedVariant ?? null, colors);
    if (item) tryOn(item);
    else toast.info(t("tryOn.category_review"));
  }

  function remove(slot: FittingSlot) {
    commit(removeSlot(items, slot));
    onStatus(t("tryOn.lugar_vazio_status", { slot: slotNames[slot] }));
  }

  function changeVariant(item: FittingItem, variant: CatalogVariant) {
    const product = products[item.productId!];
    if (!product) return;
    const next = fromCatalog(product, variant, colors);
    if (!next) return;
    commit(items.map((current) => current.key === item.key ? { ...next, size: item.size ?? null, addedAt: item.addedAt } : current));
  }

  /** Toque no tamanho: a peça veste o avatar nesse tamanho e ele vira o padrão das próximas peças da mesma grade. */
  function changeSize(item: FittingItem, size: string) {
    const grid = gridOf(item.category, item.subcategory);
    if (grid) writeMySize(grid, size);
    commit(items.map((current) => current.key === item.key ? { ...current, size } : current));
    onStatus(t("size.vestindo_status", { name: item.name, size }));
  }

  return { items, products, owned, busyOwn, slotNames, commit, tryOn, pickProduct, remove, changeVariant, changeSize, ownIt };
}
