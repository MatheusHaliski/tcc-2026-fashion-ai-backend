// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { catalogApi, type CatalogProduct } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import { useCatalogPreview } from "./use-catalog-preview";
const previewCache = { version: "CATALOG_PREVIEW_FRAMES_V2", status: "READY", persisted: true };

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("frames on display without selection and deduplicates concurrent cards", async () => {
  const product = { id: "automatic-preview", imageUrl: "https://brand.example/a.jpg" } as CatalogProduct;
  const framed = { ...product, catalogImage: { url: product.imageUrl!, mode: "SEMANTIC_CROP" as const, crop: { x: .2, y: .2, w: .3, h: .4 }, previewCache } };
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
  const product = { id: `cached-${_label}`, imageUrl: catalogImage.url, catalogImage: { ...catalogImage, previewCache } } as CatalogProduct;
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

it("retry invalidates persisted framing and requests a fresh preview", async () => {
  const product = { id: "retry-persisted", imageUrl: "https://brand.example/retry.jpg" } as CatalogProduct;
  const resultImage = { url: "/media/retry.webp", mode: "PROCESSED" as const, previewCache };
  const request = vi.spyOn(catalogApi, "previewImage").mockResolvedValue({ ...product, catalogImage: resultImage });
  const result = renderHook(() => useCatalogPreview(product));
  await waitFor(() => expect(result.result.current.product.catalogImage).toEqual(resultImage));
  expect(localStorage.getItem("fai.catalogPreview.v2")).toContain("retry-persisted");
  act(() => result.result.current.retry());
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  expect(request).toHaveBeenLastCalledWith(product.id, { force: true });
});

it("does not carry a forced retry into a different source that already has a valid cached frame", async () => {
  const product = { id: "retry-source-scope", imageUrl: "https://brand.example/old-source.png" } as CatalogProduct;
  const request = vi.spyOn(catalogApi, "previewImage").mockResolvedValue({ ...product,
    catalogImage: { url: "/media/old-frame.png", mode: "PROCESSED", previewCache } });
  const result = renderHook(({ current }) => useCatalogPreview(current), { initialProps: { current: product } });
  await waitFor(() => expect(result.result.current.pending).toBe(false));
  act(() => result.result.current.retry());
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.result.current.pending).toBe(false));
  result.rerender({ current: { ...product, imageUrl: "https://brand.example/new-source.png",
    catalogImage: { url: "/media/new-frame.png", mode: "PROCESSED", previewCache } } });
  await waitFor(() => expect(result.result.current.pending).toBe(false));
  expect(result.result.current.product.catalogImage?.url).toBe("/media/new-frame.png");
  expect(request).toHaveBeenCalledTimes(2);
});

it("migrates a legacy frame once, then reuses both persisted URLs on later page visits", async () => {
  const product = { id: "migrate-dual-frame", imageUrl: "https://brand.example/legacy.jpg", catalogImage: { url: "/media/legacy.webp", mode: "PROCESSED" as const } } as CatalogProduct;
  const updated = { ...product, catalogImage: { ...product.catalogImage!, previewCache,
    whole: { url: "/media/whole-cached.png", rendered: true, box: { x: 0, y: 0, w: 1, h: 1 } } } };
  const request = vi.spyOn(catalogApi, "previewImage").mockResolvedValue(updated);
  const first = renderHook(() => useCatalogPreview(product));
  await waitFor(() => expect(first.result.current.product.catalogImage?.whole?.url).toBe("/media/whole-cached.png"));
  first.unmount();
  const next = renderHook(() => useCatalogPreview(updated));
  await waitFor(() => expect(next.result.current.pending).toBe(false));
  expect(next.result.current.product.catalogImage?.url).toBe("/media/legacy.webp");
  expect(request).toHaveBeenCalledTimes(1);
});
it("does not reuse a previous source or replace current product colors and attributes", async () => {
  const first = { id: "changed-photo", productName: "Cargo", colorHex: "#112233", imageUrl: "https://brand.example/old.jpg" } as CatalogProduct;
  const request = vi.spyOn(catalogApi, "previewImage").mockImplementation(async () => ({ ...first, catalogImage: { url: `/media/framed-${request.mock.calls.length}.webp`, mode: "PROCESSED" } }));
  const result = renderHook(({ product }) => useCatalogPreview(product), { initialProps: { product: first } });
  await waitFor(() => expect(result.result.current.pending).toBe(false));
  const edited = { ...first, colorHex: "#445566", attributes: { RISE: ["HIGH_RISE"] } };
  result.rerender({ product: edited });
  expect(result.result.current.product.colorHex).toBe("#445566");
  expect(result.result.current.product.attributes).toEqual(edited.attributes);
  expect(request).toHaveBeenCalledTimes(1);
  result.rerender({ product: { ...edited, imageUrl: "https://brand.example/new.jpg" } });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.result.current.pending).toBe(false));
  expect(result.result.current.product.imageUrl).toContain("new.jpg");
});

it("limits framing to backend capacity instead of exhausting retries behind its own requests", async () => {
  const finish: (() => void)[] = [];
  const request = vi.spyOn(catalogApi, "previewImage").mockImplementation(id => new Promise(resolve => {
    finish.push(() => resolve({ id, catalogImage: { url: `/media/${id}.webp`, mode: "PROCESSED" } } as CatalogProduct));
  }));
  const hooks = [0, 1, 2, 3].map(n => renderHook(() => useCatalogPreview({ id: `capacity-${n}`, imageUrl: `https://brand.example/${n}.jpg` } as CatalogProduct)));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  await act(async () => { finish.splice(0).forEach(resolve => resolve()); });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(4));
  await act(async () => { finish.splice(0).forEach(resolve => resolve()); });
  await waitFor(() => expect(hooks.every(hook => !hook.result.current.pending)).toBe(true));
});

it("skips queued cards that unmounted while keeping a shared visible subscriber", async () => {
  const finish: (() => void)[] = [];
  const request = vi.spyOn(catalogApi, "previewImage").mockImplementation(id => new Promise(resolve => {
    finish.push(() => resolve({ id, catalogImage: { url: `/media/${id}.webp`, mode: "PROCESSED" } } as CatalogProduct));
  }));
  const product = (id: string) => ({ id, imageUrl: `https://brand.example/${id}.jpg` } as CatalogProduct);
  const active = [0, 1].map(n => renderHook(() => useCatalogPreview(product(`visible-active-${n}`))));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  const hidden = renderHook(() => useCatalogPreview(product("unmounted-queued")));
  const shared = product("shared-queued");
  const a = renderHook(() => useCatalogPreview(shared));
  const b = renderHook(() => useCatalogPreview(shared));
  hidden.unmount(); a.unmount();
  await act(async () => { finish.splice(0).forEach(resolve => resolve()); });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  expect(request).toHaveBeenLastCalledWith(shared.id);
  expect(request.mock.calls.some(([id]) => id === "unmounted-queued")).toBe(false);
  await act(async () => { finish.splice(0).forEach(resolve => resolve()); });
  await waitFor(() => expect(b.result.current.pending).toBe(false));
  active.forEach(hook => hook.unmount()); b.unmount();
});


it("reuses a persisted V2 photo set without reprocessing or losing garment image identity", async () => {
  const product = { id: "ready-v2", category: "upper_piece", subcategory: "hoodie", imageUrl: "/media/whole-v2.png",
    catalogImage: { imageId: "hoodie-photo", url: "/media/fabric-v2.png", mode: "PROCESSED", sourceUrl: "https://brand.example/hoodie.png",
      photoSet: { version: "CATALOG_PHOTO_SET_V2", status: "READY", category: "upper_piece", subcategory: "hoodie", sourceUrl: "https://brand.example/hoodie.png" },
      whole: { url: "/media/whole-v2.png", alpha: true, processed: true, box: { x: 0, y: 0, w: 1, h: 1 } } } } as CatalogProduct;
  const request = vi.spyOn(catalogApi, "previewImage");
  const result = renderHook(() => useCatalogPreview(product));
  await waitFor(() => expect(result.result.current.pending).toBe(false));
  expect(request).not.toHaveBeenCalled();
  expect(result.result.current.product.catalogImage?.imageId).toBe("hoodie-photo");
  expect(result.result.current.product.catalogImage?.whole?.alpha).toBe(true);
});

it("keeps variant previews distinct and requests the selected garment instead of canonical color", async () => {
  const base = { id: "variant-context", category: "lower_piece", subcategory: "jeans", imageUrl: "https://brand.example/front.jpg" } as CatalogProduct;
  const request = vi.spyOn(catalogApi, "previewImage").mockImplementation(async (_id, options) => ({ ...base,
    catalogImage: { url: `/media/${options?.variantId}.png`, mode: "PROCESSED", variantId: options?.variantId } }));
  const first = { ...base, selectedVariant: { id: "indigo", key: "indigo", color: "denim" } };
  const result = renderHook(({ product }) => useCatalogPreview(product), { initialProps: { product: first } });
  await waitFor(() => expect(result.result.current.product.catalogImage?.url).toBe("/media/indigo.png"));
  result.rerender({ product: { ...base, selectedVariant: { id: "black", key: "black", color: "black" } } });
  expect(result.result.current.product.catalogImage?.url).not.toBe("/media/indigo.png");
  await waitFor(() => expect(result.result.current.product.catalogImage?.url).toBe("/media/black.png"));
  expect(request).toHaveBeenCalledWith(base.id, { variantId: "indigo" });
  expect(request).toHaveBeenCalledWith(base.id, { variantId: "black" });
});

it("invalidates a cached photo when garment category context changes", async () => {
  const source = "https://brand.example/context.jpg";
  const product = { id: "recategorized-frame", category: "upper_piece", subcategory: "shirt", imageUrl: source,
    catalogImage: { url: "/media/shirt.png", mode: "PROCESSED", photoSet: { version: "CATALOG_PHOTO_SET_V2", status: "READY", category: "upper_piece", subcategory: "shirt", sourceUrl: source } } } as CatalogProduct;
  const request = vi.spyOn(catalogApi, "previewImage").mockResolvedValue({ ...product, category: "lower_piece", subcategory: "jeans",
    catalogImage: { url: "/media/jeans.png", mode: "PROCESSED", photoSet: { version: "CATALOG_PHOTO_SET_V2", status: "READY", category: "lower_piece", subcategory: "jeans", sourceUrl: source } } });
  const result = renderHook(({ current }) => useCatalogPreview(current), { initialProps: { current: product } });
  await waitFor(() => expect(result.result.current.pending).toBe(false));
  expect(request).not.toHaveBeenCalled();
  result.rerender({ current: { ...product, category: "lower_piece", subcategory: "jeans" } });
  await waitFor(() => expect(result.result.current.product.catalogImage?.url).toBe("/media/jeans.png"));
  expect(request).toHaveBeenCalledTimes(1);
});

it("does not apply a response for a different product", async () => {
  const product = { id: "expected-preview-product", imageUrl: "https://brand.example/expected.jpg" } as CatalogProduct;
  vi.spyOn(catalogApi, "previewImage").mockResolvedValue({ ...product, id: "other-product", catalogImage: { url: "/media/other.png", mode: "PROCESSED" } });
  const result = renderHook(() => useCatalogPreview(product));
  await waitFor(() => expect(result.result.current.pending).toBe(false));
  expect(result.result.current.failed).toBe("service");
  expect(result.result.current.product.catalogImage).toBeUndefined();
});

it("rejects a canonical photo of another variant before selection or persistent caching", async () => {
  const product = { id: "wrong-canonical-variant", imageUrl: "https://brand.example/black.jpg",
    selectedVariant: { id: "black", key: "black", color: "black" } } as CatalogProduct;
  let finish!: (value: CatalogProduct) => void;
  vi.spyOn(catalogApi, "previewImage").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const result = renderHook(() => useCatalogPreview(product));
  let selection!: Promise<unknown>;
  act(() => { selection = Promise.resolve(result.result.current.prepare()).catch(error => error); });
  await act(async () => { finish({ ...product, catalogImage: { variantId: "indigo", imageId: "misleading-image-binding", url: "/media/indigo.png", mode: "PROCESSED", previewCache },
    images: [{ id: "misleading-image-binding", variantId: "black" }] } as CatalogProduct); });
  expect(await selection).toMatchObject({ code: "CATALOG_PREVIEW_CONTEXT_MISMATCH" });
  await waitFor(() => expect(result.result.current.failed).toBe("service"));
  expect(result.result.current.product.catalogImage).toBeUndefined();
  expect(localStorage.getItem("fai.catalogPreview.v2") ?? "").not.toContain(product.id);
});

it.each(["REVIEW", "INELIGIBLE", "RETRY"] as const)("withholds a %s photo from display, selection and persistent caching", async status => {
  const product = { id: `unapproved-${status}`, imageUrl: "https://brand.example/unapproved.jpg" } as CatalogProduct;
  let finish!: (value: CatalogProduct) => void;
  vi.spyOn(catalogApi, "previewImage").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const result = renderHook(() => useCatalogPreview(product));
  let selection!: Promise<unknown>;
  act(() => { selection = Promise.resolve(result.result.current.prepare()).catch(error => error); });
  await act(async () => { finish({ ...product, catalogImage: { url: "/media/unapproved.png", mode: "PROCESSED",
    photoSet: { version: "CATALOG_PHOTO_SET_V2", status } } }); });
  expect(await selection).toMatchObject({ code: "CATALOG_PREVIEW_CONTEXT_MISMATCH" });
  await waitFor(() => expect(result.result.current.failed).toBe("service"));
  expect(result.result.current.product.catalogImage).toBeUndefined();
  expect(localStorage.getItem("fai.catalogPreview.v2") ?? "").not.toContain(product.id);
});

it.each(["variant color", "catalog source", "image source"])("invalidates framing when %s changes without changing the image IDs", async kind => {
  const original = "https://brand.example/original.png", changed = "https://brand.example/corrected.png";
  const product = { id: `metadata-change-${kind}`, category: "upper_piece", subcategory: "shirt", color: "red", imageUrl: original,
    selectedVariant: { id: "variant", key: "variant", color: "red" },
    catalogImage: { variantId: "variant", imageId: "image", sourceUrl: original, url: "/media/old.png", mode: "PROCESSED",
      photoSet: { version: "CATALOG_PHOTO_SET_V2", status: "READY", color: "red", sourceUrl: original } },
    ...(kind === "image source" ? { images: [{ id: "image", variantId: "variant", sourceUrl: original, url: original }] } : {}),
  } as CatalogProduct;
  const next = { ...product,
    ...(kind === "variant color" ? { selectedVariant: { ...product.selectedVariant!, color: "black" } } : {}),
    ...(kind === "catalog source" ? { catalogImage: { ...product.catalogImage!, sourceUrl: changed } } : {}),
    ...(kind === "image source" ? { images: product.images!.map(image => ({ ...image, sourceUrl: changed })) } : {}),
  };
  const request = vi.spyOn(catalogApi, "previewImage").mockResolvedValue({ ...next, catalogImage: { ...next.catalogImage!, url: "/media/corrected.png",
    photoSet: { ...next.catalogImage!.photoSet!, color: next.selectedVariant!.color!, sourceUrl: kind === "variant color" ? original : changed } } });
  const result = renderHook(({ current }) => useCatalogPreview(current), { initialProps: { current: product } });
  await waitFor(() => expect(result.result.current.pending).toBe(false));
  expect(request).not.toHaveBeenCalled();
  result.rerender({ current: next });
  await waitFor(() => expect(result.result.current.product.catalogImage?.url).toBe("/media/corrected.png"));
  expect(request).toHaveBeenCalledTimes(1);
});

it("prioritizes a selected queued garment while sharing the same request and respecting two workers", async () => {
  const pending = new Map<string, () => void>();
  const request = vi.spyOn(catalogApi, "previewImage").mockImplementation(id => new Promise(resolve => {
    pending.set(id, () => resolve({ id, catalogImage: { url: `/media/${id}.png`, mode: "PROCESSED", previewCache } } as CatalogProduct));
  }));
  const hooks = [0, 1, 2, 3].map(index => renderHook(() => useCatalogPreview({ id: `selected-priority-${index}`, imageUrl: `https://brand.example/priority-${index}.png` } as CatalogProduct)));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  let selected!: Promise<CatalogProduct>;
  act(() => { selected = Promise.resolve(hooks[3].result.current.prepare()); });
  expect(request).toHaveBeenCalledTimes(2);
  await act(async () => { pending.get("selected-priority-0")!(); });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  expect(request.mock.calls[2][0]).toBe("selected-priority-3");
  await act(async () => { pending.get("selected-priority-3")!(); pending.get("selected-priority-1")!(); });
  expect((await selected).catalogImage?.url).toBe("/media/selected-priority-3.png");
  await waitFor(() => expect(request).toHaveBeenCalledTimes(4));
  await act(async () => { pending.get("selected-priority-2")!(); });
  await waitFor(() => expect(hooks.every(hook => !hook.result.current.pending)).toBe(true));
  expect(request.mock.calls.filter(([id]) => id === "selected-priority-3")).toHaveLength(1);
});
