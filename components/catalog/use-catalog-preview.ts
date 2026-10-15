"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { catalogApi, type CatalogProduct } from "@/lib/api/catalog";

// Only mounted, visible cards are queued. Two requests at a time; bounded session cache.
const cache = new Map<string, Promise<CatalogProduct>>();
const queue: (() => Promise<void>)[] = [];
let active = 0;
function hasCachedPreview(product: CatalogProduct) {
  const image = product.catalogImage;
  return image?.mode === "PROCESSED" || (image?.mode === "SEMANTIC_CROP" && !!image.crop);
}

function drain() {
  while (active < 2 && queue.length) {
    active++;
    void queue.shift()!().finally(() => { active--; drain(); });
  }
}
async function requestPreview(id: string) {
  for (let attempt = 0; ; attempt++) {
    try { return await catalogApi.previewImage(id); }
    catch (error) {
      if (!(error instanceof ApiError) || ![429, 502, 503, 504].includes(error.status) || attempt >= 3) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
}
function preview(id: string) {
  const existing = cache.get(id);
  if (existing) return existing;
  if (queue.length >= 32) return Promise.reject(new Error("Preview queue is full"));
  const result = new Promise<CatalogProduct>((resolve, reject) => {
    queue.push(async () => {
      try { resolve(await requestPreview(id)); }
      catch (error) { cache.delete(id); reject(error); }
    });
  });
  cache.set(id, result);
  if (cache.size > 256) cache.delete(cache.keys().next().value!);
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
    const cachedPreview = hasCachedPreview(product);
    setFramed(cachedPreview ? product : null);
    setFailed(null);
    const hasSource = !!(product.imageUrl || product.catalogImage?.url || product.imageSource?.imageUrl);
    setPending(!cachedPreview && hasSource);
    if (cachedPreview || !hasSource) return;
    const start = () => {
      if (started) return;
      started = true;
      setPending(true);
      void preview(product.id).then((p) => { if (alive) setFramed(p); })
        .catch((error) => { if (alive) setFailed(error instanceof ApiError && error.code === "CATEGORY_FRAME_UNAVAILABLE" ? "unsupported" : error instanceof ApiError && error.code === "CATALOG_IMAGE_FETCH_FAILED" ? "source" : "service"); })
        .finally(() => { if (alive) setPending(false); });
    };
    if (typeof IntersectionObserver === "undefined") start();
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { start(); observer?.disconnect(); }
    });
    if (ref.current) observer?.observe(ref.current);
    return () => { alive = false; observer?.disconnect(); };
  }, [product.id, product.imageUrl, product.catalogImage?.url, product.catalogImage?.mode, product.catalogImage?.crop, product.imageSource?.imageUrl, retryCount]);
  return { ref, product: framed ?? product, pending, failed, retry: () => { cache.delete(product.id); setRetryCount(n => n + 1); } };
}
