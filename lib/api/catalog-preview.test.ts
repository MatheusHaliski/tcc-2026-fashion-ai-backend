import { afterEach, expect, it, vi } from "vitest";
import { api, ApiError } from "./client";
import { catalogApi, type CatalogProduct } from "./catalog";

afterEach(() => vi.restoreAllMocks());
it("only requests server regeneration for explicit image recovery", async () => {
  const post = vi.spyOn(api, "post").mockResolvedValue({ id: "p" } as CatalogProduct);
  await catalogApi.previewImage("p");
  expect(post).toHaveBeenLastCalledWith("/api/catalog/products/p/preview-image", {});
  await catalogApi.previewImage("p", { force: true });
  expect(post).toHaveBeenLastCalledWith("/api/catalog/products/p/preview-image?force=true", {});
});
it("keeps recovery when an older backend exposes only verify-image", async () => {
  const post = vi.spyOn(api, "post").mockRejectedValueOnce(new ApiError(404, "NOT_FOUND", "missing"))
    .mockResolvedValue({ id: "p" } as CatalogProduct);
  await catalogApi.previewImage("p", { force: true });
  expect(post).toHaveBeenLastCalledWith("/api/catalog/products/p/verify-image?force=true", {});
});
