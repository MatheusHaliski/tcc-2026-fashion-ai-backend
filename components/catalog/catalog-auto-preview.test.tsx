// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { catalogApi, type CatalogProduct } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
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

it("does not label a server failure as an unsafe photo and permits retry", async () => {
  const product = { id: "service-failure", imageUrl: "https://brand.example/c.jpg" } as CatalogProduct;
  const request = vi.spyOn(catalogApi, "previewImage").mockRejectedValueOnce(new ApiError(500, "ERRO_INTERNO", "error"))
    .mockResolvedValue(product);
  const result = renderHook(() => useCatalogPreview(product));
  await waitFor(() => expect(result.result.current.failed).toBe("service"));
  act(() => result.result.current.retry());
  await waitFor(() => expect(result.result.current.pending).toBe(false));
  expect(result.result.current.failed).toBeNull();
  expect(request).toHaveBeenCalledTimes(2);
});
it("only classifies the explicit category-frame failure as unsupported", async () => {
  const product = { id: "unsupported-frame", imageUrl: "https://brand.example/d.jpg" } as CatalogProduct;
  vi.spyOn(catalogApi, "previewImage").mockRejectedValue(new ApiError(422, "CATEGORY_FRAME_UNAVAILABLE", "frame"));
  const result = renderHook(() => useCatalogPreview(product));
  await waitFor(() => expect(result.result.current.failed).toBe("unsupported"));
});
