// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { catalogApi, type CatalogProduct } from "@/lib/api/catalog";
import { useCatalogPreview } from "./use-catalog-preview";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("frames on display without selection and deduplicates concurrent cards", async () => {
  const product = { id: "automatic-preview", imageUrl: "https://brand.example/a.jpg" } as CatalogProduct;
  const framed = { ...product, catalogImage: { url: product.imageUrl!, mode: "SEMANTIC_CROP" as const, crop: { x: .2, y: .2, w: .3, h: .4 } } };
  const request = vi.spyOn(catalogApi, "previewImage").mockResolvedValue(framed);
  const a = renderHook(() => useCatalogPreview(product));
  const b = renderHook(() => useCatalogPreview(product));
  await waitFor(() => expect(a.result.current.product.catalogImage).toEqual(framed.catalogImage));
  expect(b.result.current.product.catalogImage).toEqual(framed.catalogImage);
  expect(request).toHaveBeenCalledTimes(1);
});
it("keeps the original when framing fails", async () => {
  const product = { id: "failed-preview", imageUrl: "https://brand.example/b.jpg" } as CatalogProduct;
  vi.spyOn(catalogApi, "previewImage").mockRejectedValue(new Error("unavailable"));
  const result = renderHook(() => useCatalogPreview(product));
  await waitFor(() => expect(result.result.current.pending).toBe(false));
  expect(result.result.current.product).toBe(product);
});
