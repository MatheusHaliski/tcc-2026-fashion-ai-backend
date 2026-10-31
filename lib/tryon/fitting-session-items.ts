import { api } from "@/lib/api/client";
import { catalogApi, type CatalogProduct } from "@/lib/api/catalog";
import { FITTING_SLOTS, wearItem, type FittingItem, type TryOnRef } from "@/lib/tryon/fitting-room";
import { fromCatalog, fromWardrobe, type Entry, type State } from "@/lib/tryon/fitting-room-model";
import { gridOf, readMySizes } from "@/lib/tryon/sizes";

/* Peças que entram na sessão do provador: tamanho padrão de peça nova e prova restaurada de link ou esquema. */

/** Peça nova entra no tamanho que a pessoa escolheu por último nessa grade; sem escolha, no tamanho do avatar. */
export function withMySize(item: FittingItem): FittingItem {
  if (item.size) return item;
  const grid = gridOf(item.category, item.subcategory);
  const mine = grid ? readMySizes()[grid] : undefined;
  return mine ? { ...item, size: mine } : item;
}

/** Peças do guarda-roupa do provador por id. */
export function wardrobeIndex(data: State): Map<string, Entry> {
  return new Map(FITTING_SLOTS.flatMap((slot) =>
    (data.pieces?.[slot] ?? []).map((entry) => [entry.piece.id, entry] as const),
  ));
}

/**
 * Prova do link compartilhado (`?provar=`): veste as referências na ordem; produto da loja é buscado com a variante
 * pedida (e entregue a `onProduct`); peça fora do guarda-roupa ou produto indisponível é ignorado.
 */
export async function restoreTryOn(
  refs: TryOnRef[], wardrobe: Map<string, Entry>, colors: Record<string, string> | undefined, onProduct: (product: CatalogProduct) => void,
): Promise<FittingItem[]> {
  const restored = await Promise.all(refs.map(async (ref) => {
    if (ref.source === "wardrobe") {
      const entry = wardrobe.get(ref.id);
      return entry ? fromWardrobe(entry) : null;
    }
    try {
      const product = await catalogApi.product(ref.id);
      onProduct(product);
      return fromCatalog(product, product.variants?.find((variant) => variant.id === ref.variantId) ?? null, colors);
    } catch {
      return null;
    }
  }));
  let next: FittingItem[] = [];
  restored.forEach((item) => { if (item) next = wearItem(next, item); });
  return next;
}

/** Esquema salvo (`?scheme=`): veste, na ordem, só as peças que ainda estão no guarda-roupa. */
export async function loadScheme(schemeId: string, wardrobe: Map<string, Entry>): Promise<FittingItem[]> {
  const { scheme } = await api.get<{ scheme: { items: { wardrobeItemId: string }[] } }>(`/api/schemes/${schemeId}`);
  let next: FittingItem[] = [];
  scheme.items.forEach((item) => {
    const entry = wardrobe.get(item.wardrobeItemId);
    if (entry) next = wearItem(next, fromWardrobe(entry));
  });
  return next;
}
