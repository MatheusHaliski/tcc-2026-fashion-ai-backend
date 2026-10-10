"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { catalogApi, type CatalogProduct, type CatalogVariant } from "@/lib/api/catalog";
import { useI18n } from "@/lib/i18n/i18n";
import { useToast } from "@/components/ui";
import {
  FITTING_SLOTS, decodeTryOn, removeSlot, restoreFittingItems, wearItem,
  type FittingItem, type FittingSlot,
} from "@/lib/tryon/fitting-room";
import { fromCatalog, fromWardrobe, type State } from "@/lib/tryon/fitting-room-model";
import { read, write, SESSION_KEY } from "@/lib/tryon/fitting-room-storage";

interface FittingSessionOptions {
  data: State | null;
  colors?: Record<string, string>;
  searchParams: ReadonlyURLSearchParams;
  onStatus: (message: string) => void;
  onOwned: () => void;
}

/** Session use cases: restore, wear, remove, change variant and add a catalog item to the wardrobe. */
export function useFittingSession({ data, colors, searchParams, onStatus, onOwned }: FittingSessionOptions) {
  const { t } = useI18n();
  const toast = useToast();
  const [items, setItems] = useState<FittingItem[]>([]);
  const [products, setProducts] = useState<Record<string, CatalogProduct>>({});
  const [owned, setOwned] = useState<Record<string, string>>({});
  const [busyOwn, setBusyOwn] = useState<string | null>(null);
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
    const wardrobe = new Map(FITTING_SLOTS.flatMap((slot) =>
      (data.pieces?.[slot] ?? []).map((entry) => [entry.piece.id, entry] as const),
    ));
    Promise.all(refs.map(async (ref) => {
      if (ref.source === "wardrobe") {
        const entry = wardrobe.get(ref.id);
        return entry ? fromWardrobe(entry) : null;
      }
      try {
        const product = await catalogApi.product(ref.id);
        setProducts((current) => ({ ...current, [product.id]: product }));
        return fromCatalog(product, product.variants?.find((variant) => variant.id === ref.variantId) ?? null, colors);
      } catch {
        return null;
      }
    })).then((restored) => {
      let next: FittingItem[] = [];
      restored.forEach((item) => { if (item) next = wearItem(next, item); });
      commit(next);
    });
  }, [data, searchParams, colors, commit]);

  useEffect(() => {
    const schemeId = searchParams.get("scheme");
    if (!schemeId || !data) return;
    const wardrobe = new Map(FITTING_SLOTS.flatMap((slot) =>
      (data.pieces?.[slot] ?? []).map((entry) => [entry.piece.id, entry] as const),
    ));
    api.get<{ scheme: { items: { wardrobeItemId: string }[] } }>(`/api/schemes/${schemeId}`)
      .then(({ scheme }) => {
        let next: FittingItem[] = [];
        scheme.items.forEach((item) => {
          const entry = wardrobe.get(item.wardrobeItemId);
          if (entry) next = wearItem(next, fromWardrobe(entry));
        });
        commit(next);
      })
      .catch(() => undefined);
  }, [searchParams, data, commit]);

  function tryOn(item: FittingItem) {
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
    commit(items.map((current) => current.key === item.key ? { ...next, addedAt: item.addedAt } : current));
  }

  async function ownIt(item: FittingItem) {
    if (!item.productId || busyOwn) return;
    setBusyOwn(item.key);
    try {
      const piece = await api.post<PieceView>("/api/pieces/from-catalog", {
        productId: item.productId, variantId: item.variantId ?? null, visibility: "PRIVATE",
      });
      setOwned((current) => ({ ...current, [item.key]: piece.id }));
      toast.success(t("tryOn.adicionada_ao_guarda_roupa", { name: item.name }));
      onOwned();
    } catch (error) {
      toast.fromError(error);
    } finally {
      setBusyOwn(null);
    }
  }

  return { items, products, owned, busyOwn, slotNames, commit, tryOn, pickProduct, remove, changeVariant, ownIt };
}
