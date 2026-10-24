"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { catalogApi, type CatalogProduct } from "@/lib/api/catalog";

// Only mounted, visible cards are queued. Two requests at a time (matching backend preview capacity); bounded session cache.
const cache = new Map<string, Promise<CatalogProduct>>();
const consumers = new Map<Promise<CatalogProduct>, Set<() => boolean>>();
const STORE_KEY = "fai.catalogPreview.v2";
const MAX_AGE = 24 * 60 * 60 * 1000;
type PreviewFields = Pick<CatalogProduct, "catalogImage" | "imageProcessingStatus" | "images" | "imageSource">;
type PreviewContext = PreviewFields & Partial<Pick<CatalogProduct, "selectedVariant" | "category" | "subcategory" | "color" | "imageUrl" | "imageSource">>;
type Stored = { source: string; created: number; preview: PreviewFields };
const sourceKey = (p: CatalogProduct) => JSON.stringify([
  p.id, p.category, p.subcategory, p.color, p.selectedVariant?.id, p.selectedVariant?.color,
  p.imageUrl, p.imageSource?.imageUrl, p.catalogImage?.imageId, p.catalogImage?.variantId,
  p.catalogImage?.url, p.catalogImage?.sourceUrl, p.catalogImage?.crop, p.catalogImage?.whole, p.catalogImage?.pipelineVersion, p.catalogImage?.photoSet,
  p.catalogImage?.previewCache?.contextHash, p.catalogImage?.previewCache?.sourceSha256,
  p.images?.map(image => [image.id, image.variantId, image.url, image.sourceUrl, image.processedUrl, image.processingStatus]),
]);
const previewFields = (p: CatalogProduct): PreviewFields => ({ catalogImage: p.catalogImage, imageProcessingStatus: p.imageProcessingStatus, ...(p.images ? { images: p.images } : {}), ...(p.imageSource !== undefined ? { imageSource: p.imageSource } : {}) });
const STORE_MAX = 400;
// Persistent cache across reloads: successful framings are reused instantly instead of re-rendered.
function readStore(): Record<string, Stored> {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch { return {}; }
}
function storedPreview(product: CatalogProduct): CatalogProduct | null {
  if (typeof localStorage === "undefined") return null;
  const entry = readStore()[product.id];
  return entry?.source === sourceKey(product) && Date.now() - entry.created < MAX_AGE && hasCachedPreview({ ...product, ...entry.preview })
    ? { ...product, ...entry.preview } : null;
}
function forgetPreview(product: CatalogProduct) {
  cache.delete(sourceKey(product));
  try { const all = readStore(); delete all[product.id]; localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch { /* session only */ }
}
function storePreview(source: CatalogProduct, p: CatalogProduct) {
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
const MAX_ACTIVE = 2;
const queue: (() => Promise<void>)[] = [];
const queued = new Map<string, () => Promise<void>>();
let active = 0;
function matchesVariant(product: PreviewContext) {
  const variantId = product.selectedVariant?.id;
  const image = product.catalogImage;
  if (!variantId || image?.mode === "DEFAULT") return true;
  if (image?.variantId) return image.variantId === variantId;
  return !!product.images?.some(source => source.id === image?.imageId && source.variantId === variantId);
}
function matchesPhotoContext(product: PreviewContext) {
  const image = product.catalogImage, set = image?.photoSet;
  if (!set) return true;
  const color = product.selectedVariant?.color ?? product.color;
  const source = product.images?.find(candidate => candidate.id === image.imageId);
  const sourceUrl = source?.sourceUrl ?? image.sourceUrl ?? product.imageSource?.imageUrl ?? product.imageUrl;
  return !(set.category && product.category && set.category !== product.category) &&
    !(set.subcategory && product.subcategory && set.subcategory !== product.subcategory) &&
    !(set.color && color && set.color !== color) &&
    !(set.sourceUrl && sourceUrl && set.sourceUrl !== sourceUrl);
}
export function hasUsableCatalogPreview(product: PreviewContext) {
  const image = product.catalogImage;
  if (image?.photoSet && !["READY", "DEFAULT"].includes(image.photoSet.status)) return false;
  return matchesVariant(product) && matchesPhotoContext(product) && !!image?.url && (image.mode === "DEFAULT" || image.mode === "PROCESSED" || (image?.mode === "SEMANTIC_CROP" && !!image.crop));
}
function hasCachedPreview(product: PreviewContext) {
  const state = product.catalogImage?.previewCache;
  if(product.catalogImage?.photoSet?.version === "CATALOG_PHOTO_SET_V2" && ["READY","DEFAULT"].includes(product.catalogImage.photoSet.status)) return hasUsableCatalogPreview(product);
  return hasUsableCatalogPreview(product) && state?.version === "CATALOG_PREVIEW_FRAMES_V2" && state.status === "READY";
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
function preview(product: CatalogProduct, force: boolean, wanted: () => boolean, priority = false) {
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
        if (p.id !== product.id || (p.category && product.category && p.category !== product.category) ||
          (p.subcategory && product.subcategory && p.subcategory !== product.subcategory) ||
          (p.catalogImage?.photoSet && !["READY", "DEFAULT"].includes(p.catalogImage.photoSet.status)) ||
          (p.catalogImage && (!matchesVariant(prepared) || !matchesPhotoContext(prepared)))) {
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

export function useCatalogPreview(product: CatalogProduct) {
  const ref = useRef<HTMLElement>(null);
  const identity = sourceKey(product);
  const [framed, setFramed] = useState<{ identity: string; product: CatalogProduct } | null>(null);
  const [pending, setPending] = useState(() => !hasCachedPreview(product) && !!(product.imageUrl || product.catalogImage?.url || product.imageSource?.imageUrl));
  const [failed, setFailed] = useState<"unsupported" | "source" | "service" | null>(null);
  const [retry, setRetry] = useState<{ identity: string; count: number } | null>(null);
  const retryCount = retry?.identity === identity ? retry.count : 0;
  useEffect(() => {
    let alive = true, started = false;
    const cachedPreview = retryCount === 0 && hasCachedPreview(product);
    const stored = cachedPreview || retryCount > 0 ? null : storedPreview(product);
    // Keep an old, valid photo visible during the one-time backend migration.
    const initial = cachedPreview ? product : stored ?? (hasUsableCatalogPreview(product) ? product : null);
    setFramed(initial ? { identity, product: initial } : null);
    setFailed(null);
    const hasSource = !!(product.imageUrl || product.catalogImage?.url || product.imageSource?.imageUrl);
    setPending(!cachedPreview && !stored && hasSource);
    if (cachedPreview || stored || !hasSource) return;
    const start = () => {
      if (started) return;
      started = true;
      setPending(true);
      void preview(product, retryCount > 0, () => alive).then((p) => { if (alive) setFramed({ identity, product: { ...product, ...previewFields(p) } }); })
        .catch((error) => { if (alive) setFailed(error instanceof ApiError && error.code === "CATEGORY_FRAME_UNAVAILABLE" ? "unsupported" : error instanceof ApiError && error.code === "CATALOG_IMAGE_FETCH_FAILED" ? "source" : "service"); })
        .finally(() => { if (alive) setPending(false); });
    };
    if (typeof IntersectionObserver === "undefined") start();
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { start(); observer?.disconnect(); }
    }, { rootMargin: "250px 0px" });
    if (ref.current) observer?.observe(ref.current);
    return () => { alive = false; observer?.disconnect(); };
  }, [identity, retryCount]); // Source/variant identity excludes unrelated editable product metadata.
  function prepare(): CatalogProduct | Promise<CatalogProduct> {
    const current = framed?.identity === identity ? { ...product, ...previewFields(framed.product) } : product;
    if (hasCachedPreview(current) || !(product.imageUrl || product.catalogImage?.url || product.imageSource?.imageUrl)) return current;
    return preview(product, false, () => true, true).then(prepared => ({ ...product, ...previewFields(prepared) }));
  }
  return { ref, prepare, product: framed?.identity === identity && framed.product !== product ? { ...product, ...previewFields(framed.product) } : product, pending, failed, retry: () => { forgetPreview(product); setRetry(current => ({ identity, count: current?.identity === identity ? current.count + 1 : 1 })); } };
}
