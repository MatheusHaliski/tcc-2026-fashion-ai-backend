"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { catalogApi, type CatalogProduct } from "@/lib/api/catalog";

// Only mounted, visible cards are queued. Two requests at a time (matching backend preview capacity); bounded session cache.
const cache = new Map<string, Promise<CatalogProduct>>();
const STORE_KEY = "fai.catalogPreview.v2";
const MAX_AGE = 24 * 60 * 60 * 1000;
type PreviewFields = Pick<CatalogProduct, "catalogImage" | "imageProcessingStatus">;
type Stored = { source: string; created: number; preview: PreviewFields };
const sourceKey = (p: CatalogProduct) => JSON.stringify([p.id, p.imageUrl, p.catalogImage?.url, p.imageSource?.imageUrl]);
const previewFields = (p: CatalogProduct): PreviewFields => ({ catalogImage: p.catalogImage, imageProcessingStatus: p.imageProcessingStatus });
const STORE_MAX = 400;
// Persistent cache across reloads: successful framings are reused instantly instead of re-rendered.
function readStore(): Record<string, Stored> {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch { return {}; }
}
function storedPreview(product: CatalogProduct): CatalogProduct | null {
  if (typeof localStorage === "undefined") return null;
  const entry = readStore()[product.id];
  return entry?.source === sourceKey(product) && Date.now() - entry.created < MAX_AGE && hasCachedPreview(entry.preview)
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
let active = 0;
function hasCachedPreview(product: PreviewFields) {
  const image = product.catalogImage;
  return !!image?.url && (image.mode === "PROCESSED" || (image?.mode === "SEMANTIC_CROP" && !!image.crop));
}

function drain() {
  while (active < MAX_ACTIVE && queue.length) {
    active++;
    void queue.shift()!().finally(() => { active--; drain(); });
  }
}
async function requestPreview(id: string) {
  for (let attempt = 0; ; attempt++) {
    try { return await catalogApi.previewImage(id); }
    catch (error) {
      if (!(error instanceof ApiError) || ![429, 502, 503, 504].includes(error.status) || attempt >= 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 600 * 2 ** attempt));
    }
  }
}
function preview(product: CatalogProduct) {
  const id = sourceKey(product);
  const existing = cache.get(id);
  if (existing) return existing;
  const stored = storedPreview(product);
  if (stored) { const hit = Promise.resolve(stored); cache.set(id, hit); return hit; }
  if (queue.length >= 96) return Promise.reject(new Error("Preview queue is full"));
  const result = new Promise<CatalogProduct>((resolve, reject) => {
    queue.push(async () => {
      try { const p = await requestPreview(product.id); storePreview(product, p); resolve(p); }
      catch (error) { cache.delete(id); reject(error); }
    });
  });
  cache.set(id, result);
  if (cache.size > 512) cache.delete(cache.keys().next().value!);
  drain();
  return result;
}

export function useCatalogPreview(product: CatalogProduct) {
  const ref = useRef<HTMLElement>(null);
  const [framed, setFramed] = useState<CatalogProduct | null>(null);
  const [pending, setPending] = useState(() => !hasCachedPreview(product) && !!(product.imageUrl || product.catalogImage?.url || product.imageSource?.imageUrl));
  const [failed, setFailed] = useState<"unsupported" | "source" | "service" | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    let alive = true, started = false;
    const cachedPreview = retryCount === 0 && hasCachedPreview(product);
    const stored = cachedPreview ? null : storedPreview(product);
    setFramed(cachedPreview ? product : stored);
    setFailed(null);
    const hasSource = !!(product.imageUrl || product.catalogImage?.url || product.imageSource?.imageUrl);
    setPending(!cachedPreview && !stored && hasSource);
    if (cachedPreview || stored || !hasSource) return;
    const start = () => {
      if (started) return;
      started = true;
      setPending(true);
      void preview(product).then((p) => { if (alive) setFramed({ ...product, ...previewFields(p) }); })
        .catch((error) => { if (alive) setFailed(error instanceof ApiError && error.code === "CATEGORY_FRAME_UNAVAILABLE" ? "unsupported" : error instanceof ApiError && error.code === "CATALOG_IMAGE_FETCH_FAILED" ? "source" : "service"); })
        .finally(() => { if (alive) setPending(false); });
    };
    if (typeof IntersectionObserver === "undefined") start();
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { start(); observer?.disconnect(); }
    }, { rootMargin: "800px 0px" });
    if (ref.current) observer?.observe(ref.current);
    return () => { alive = false; observer?.disconnect(); };
  }, [product.id, product.imageUrl, product.catalogImage?.url, product.catalogImage?.mode, product.catalogImage?.crop, product.imageSource?.imageUrl, retryCount]);
  return { ref, product: framed && framed !== product ? { ...product, ...previewFields(framed) } : product, pending, failed, retry: () => { forgetPreview(product); setRetryCount(n => n + 1); } };
}
