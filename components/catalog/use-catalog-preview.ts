"use client";
import { useEffect, useRef, useState } from "react";
import { catalogApi, type CatalogProduct } from "@/lib/api/catalog";

// Only mounted, visible cards are queued. Two requests at a time; bounded session cache.
const cache = new Map<string, Promise<CatalogProduct>>();
const queue: (() => Promise<void>)[] = [];
let active = 0;
function drain() {
  while (active < 2 && queue.length) {
    active++;
    void queue.shift()!().finally(() => { active--; drain(); });
  }
}
function preview(id: string) {
  const existing = cache.get(id);
  if (existing) return existing;
  if (queue.length >= 32) return Promise.reject(new Error("Preview queue is full"));
  const result = new Promise<CatalogProduct>((resolve, reject) => {
    queue.push(async () => {
      try { resolve(await catalogApi.previewImage(id)); }
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
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true, started = false;
    setFramed(null);
    setFailed(false);
    setPending(true);
    if (!product.imageUrl && !product.catalogImage?.url) { setPending(false); return; }
    const start = () => {
      if (started) return;
      started = true;
      setPending(true);
      void preview(product.id).then((p) => { if (alive) setFramed(p); })
        .catch(() => { if (alive) setFailed(true); })
        .finally(() => { if (alive) setPending(false); });
    };
    if (typeof IntersectionObserver === "undefined") start();
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { start(); observer?.disconnect(); }
    });
    if (ref.current) observer?.observe(ref.current);
    return () => { alive = false; observer?.disconnect(); };
  }, [product.id, product.imageUrl]);
  return { ref, product: framed ?? product, pending, failed };
}
