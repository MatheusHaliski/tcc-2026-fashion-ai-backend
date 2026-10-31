import type { CatalogProduct } from "@/lib/api/catalog";
import { hasCachedPreview, previewFields, sourceKey, type PreviewFields } from "./preview-rules";

// Persistent cache across reloads: successful framings are reused instantly instead of re-rendered.
const STORE_KEY = "fai.catalogPreview.v2";
const MAX_AGE = 24 * 60 * 60 * 1000;
const STORE_MAX = 400;
type Stored = { source: string; created: number; preview: PreviewFields };

function readStore(): Record<string, Stored> {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch { return {}; }
}
/** Prévia gravada para a mesma fonte, com menos de 24 h e ainda utilizável; senão `null`. */
export function storedPreview(product: CatalogProduct): CatalogProduct | null {
  if (typeof localStorage === "undefined") return null;
  const entry = readStore()[product.id];
  return entry?.source === sourceKey(product) && Date.now() - entry.created < MAX_AGE && hasCachedPreview({ ...product, ...entry.preview })
    ? { ...product, ...entry.preview } : null;
}
export function removeStoredPreview(product: CatalogProduct) {
  try { const all = readStore(); delete all[product.id]; localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch { /* session only */ }
}
/** Grava a prévia pronta (a mais recente vai para o fim; acima de 400 entradas, saem as mais antigas). */
export function storePreview(source: CatalogProduct, p: CatalogProduct) {
  if (typeof localStorage === "undefined" || !hasCachedPreview(p)) return;
  try {
    const all = readStore();
    delete all[source.id];
    all[source.id] = { source: sourceKey(source), created: Date.now(), preview: previewFields(p) };
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - STORE_MAX))) delete all[k];
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch { /* quota or private mode: session cache still works */ }
}
