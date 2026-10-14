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
it.each([
  ["processed", { url: "https://media.example/card.jpg", mode: "PROCESSED" as const }],
  ["semantic crop", { url: "https://brand.example/cached.jpg", mode: "SEMANTIC_CROP" as const, crop: { x: .1, y: .1, w: .8, h: .8 } }],
])("uses the database-cached %s preview without requesting another render", async (_label, catalogImage) => {
  const product = { id: `cached-${_label}`, imageUrl: catalogImage.url, catalogImage } as CatalogProduct;
  const request = vi.spyOn(catalogApi, "previewImage");
  const result = renderHook(() => useCatalogPreview(product));

  await waitFor(() => expect(result.result.current.pending).toBe(false));
  expect(result.result.current.product).toBe(product);
  expect(request).not.toHaveBeenCalled();
});
it("keeps source metadata for retry when framing fails; display stays gated by the caller", async () => {
  const product = { id: "failed-preview", imageUrl: "https://brand.example/b.jpg" } as CatalogProduct;
  vi.spyOn(catalogApi, "previewImage").mockRejectedValue(new Error("unavailable"));
  const result = renderHook(() => useCatalogPreview(product));
  await waitFor(() => expect(result.result.current.pending).toBe(false));
  expect(result.result.current.product).toBe(product);
});
it("requests a render when semantic crop metadata is missing", async () => {
  const product = {
    id: "uncached-preview",
    imageUrl: "https://brand.example/uncached.jpg",
    catalogImage: { url: "https://brand.example/uncached.jpg", mode: "SEMANTIC_CROP" as const },
  } as CatalogProduct;
  const request = vi.spyOn(catalogApi, "previewImage").mockResolvedValue(product);
  renderHook(() => useCatalogPreview(product));

  await waitFor(() => expect(request).toHaveBeenCalledWith(product.id));
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

it("queues source-only products while the unframed display URL is withheld", async () => {
  const product = { id: "source-only-required-frame", imageUrl: null, imageSource: { imageUrl: "https://brand.example/source.jpg" } } as unknown as CatalogProduct;
  const framed = { ...product, catalogImage: { url: "https://media.example/processed.jpg", mode: "PROCESSED" as const } };
  const request = vi.spyOn(catalogApi, "previewImage").mockResolvedValue(framed);
  const result = renderHook(() => useCatalogPreview(product));
  await waitFor(() => expect(result.result.current.product.catalogImage?.mode).toBe("PROCESSED"));
  expect(request).toHaveBeenCalledWith(product.id);
});
