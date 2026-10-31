"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import type { CatalogProduct } from "@/lib/api/catalog";
import { hasCachedPreview, hasPreviewSource, hasUsableCatalogPreview, previewFields, sourceKey } from "@/lib/catalog/preview-rules";
import { storedPreview } from "@/lib/catalog/preview-store";
import { forgetPreview, preview } from "@/lib/catalog/preview-queue";

export { hasUsableCatalogPreview };

/**
 * Prévia enquadrada de um cartão do catálogo: usa a do banco ou a gravada no navegador; senão pede quando o cartão
 * aparece na tela (fila de `lib/catalog/preview-queue`). Regras em `preview-rules`, cache persistente em `preview-store`.
 */
export function useCatalogPreview(product: CatalogProduct) {
  const ref = useRef<HTMLElement>(null);
  const identity = sourceKey(product);
  const [framed, setFramed] = useState<{ identity: string; product: CatalogProduct } | null>(null);
  const [pending, setPending] = useState(() => !hasCachedPreview(product) && hasPreviewSource(product));
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
    const hasSource = hasPreviewSource(product);
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
    if (hasCachedPreview(current) || !hasPreviewSource(product)) return current;
    return preview(product, false, () => true, true).then(prepared => ({ ...product, ...previewFields(prepared) }));
  }
  return { ref, prepare, product: framed?.identity === identity && framed.product !== product ? { ...product, ...previewFields(framed.product) } : product, pending, failed, retry: () => { forgetPreview(product); setRetry(current => ({ identity, count: current?.identity === identity ? current.count + 1 : 1 })); } };
}
