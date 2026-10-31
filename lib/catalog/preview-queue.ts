import { ApiError } from "@/lib/api/client";
import { catalogApi, type CatalogProduct } from "@/lib/api/catalog";
import { previewContextChanged, previewFields, sourceKey } from "./preview-rules";
import { removeStoredPreview, storedPreview, storePreview } from "./preview-store";

// Only mounted, visible cards are queued. Two requests at a time (matching backend preview capacity); bounded session cache.
const cache = new Map<string, Promise<CatalogProduct>>();
const consumers = new Map<Promise<CatalogProduct>, Set<() => boolean>>();
const MAX_ACTIVE = 2;
const queue: (() => Promise<void>)[] = [];
const queued = new Map<string, () => Promise<void>>();
let active = 0;

/** Esquece a prévia desta fonte na sessão e no cache persistente (nova tentativa explícita). */
export function forgetPreview(product: CatalogProduct) {
  cache.delete(sourceKey(product));
  removeStoredPreview(product);
}

function drain() {
  while (active < MAX_ACTIVE && queue.length) {
    active++;
    void queue.shift()!().finally(() => { active--; drain(); });
  }
}
async function requestPreview(product: CatalogProduct, force = false) {
  for (let attempt = 0; ; attempt++) {
    try {
      const options = { ...(force ? { force: true } : {}), ...(product.selectedVariant?.id ? { variantId: product.selectedVariant.id } : {}) };
      return await (Object.keys(options).length ? catalogApi.previewImage(product.id, options) : catalogApi.previewImage(product.id));
    }
    catch (error) {
      if (!(error instanceof ApiError) || ![429, 502, 503, 504].includes(error.status) || attempt >= 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 600 * 2 ** attempt));
    }
  }
}
/**
 * Prévia enquadrada do produto: reaproveita o pedido em andamento da mesma fonte (e o adianta na fila se `priority`),
 * depois o cache persistente; senão entra na fila. O pedido é pulado se nenhum cartão interessado ainda está visível.
 */
export function preview(product: CatalogProduct, force: boolean, wanted: () => boolean, priority = false) {
  const id = sourceKey(product);
  const existing = cache.get(id);
  if (existing) {
    consumers.get(existing)?.add(wanted);
    const waiting = priority ? queued.get(id) : undefined;
    const position = waiting ? queue.indexOf(waiting) : -1;
    if (position > 0) { queue.splice(position, 1); queue.unshift(waiting!); }
    drain();
    return existing;
  }
  const stored = force ? null : storedPreview(product);
  if (stored) { const hit = Promise.resolve(stored); cache.set(id, hit); return hit; }
  if (queue.length >= 96) return Promise.reject(new Error("Preview queue is full"));
  const interested = new Set([wanted]);
  const result = new Promise<CatalogProduct>((resolve, reject) => {
    const run = async () => {
      if (queued.get(id) === run) queued.delete(id);
      try {
        if (![...interested].some(isAlive => isAlive())) throw new DOMException("Preview no longer displayed", "AbortError");
        const p = await requestPreview(product, force);
        const prepared = { ...product, ...previewFields(p) };
        if (previewContextChanged(product, p, prepared)) {
          throw new ApiError(409, "CATALOG_PREVIEW_CONTEXT_MISMATCH", "Catalog preview context changed");
        }
        if (cache.get(id) === result) storePreview(product, prepared);
        resolve(prepared);
      }
      catch (error) { if (cache.get(id) === result) cache.delete(id); reject(error); }
      finally { consumers.delete(result); }
    };
    // Explicit recovery should not wait behind a previous page's queued cards.
    queued.set(id, run);
    if (force || priority) queue.unshift(run); else queue.push(run);
  });
  consumers.set(result, interested);
  cache.set(id, result);
  if (cache.size > 512) cache.delete(cache.keys().next().value!);
  drain();
  return result;
}
