import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/lib/api/catalog";
import {
  hasCachedPreview, hasFlatLay, hasPreviewSource, hasUsableCatalogPreview, matchesPhotoContext, matchesVariant,
  previewContextChanged, sourceKey,
} from "./preview-rules";

const produto = (extra: Record<string, unknown> = {}) => ({ id: "p1", category: "upper_piece", ...extra }) as unknown as CatalogProduct;

describe("regras da prévia do cartão do catálogo", () => {
  it("só há fonte para enquadrar quando existe alguma foto", () => {
    expect(hasPreviewSource(produto())).toBe(false);
    expect(hasPreviewSource(produto({ imageUrl: "/a.jpg" }))).toBe(true);
    expect(hasPreviewSource(produto({ catalogImage: { url: "/b.jpg" } }))).toBe(true);
    expect(hasPreviewSource(produto({ imageSource: { imageUrl: "/c.jpg" } }))).toBe(true);
  });

  it("a prévia vale para a variante escolhida", () => {
    expect(matchesVariant(produto())).toBe(true);
    expect(matchesVariant(produto({ selectedVariant: { id: "v1" }, catalogImage: { variantId: "v1" } }))).toBe(true);
    expect(matchesVariant(produto({ selectedVariant: { id: "v1" }, catalogImage: { variantId: "v2" } }))).toBe(false);
    expect(matchesVariant(produto({ selectedVariant: { id: "v1" }, catalogImage: { mode: "DEFAULT", variantId: "v2" } }))).toBe(true);
  });

  it("um conjunto de fotos de outra categoria ou cor não serve", () => {
    const set = { category: "upper_piece", color: "blue", status: "READY" };
    expect(matchesPhotoContext(produto({ color: "blue", catalogImage: { photoSet: set } }))).toBe(true);
    expect(matchesPhotoContext(produto({ color: "red", catalogImage: { photoSet: set } }))).toBe(false);
    expect(matchesPhotoContext(produto({ category: "lower_piece", catalogImage: { photoSet: set } }))).toBe(false);
  });

  it("prévia utilizável exige url e um modo pronto", () => {
    expect(hasUsableCatalogPreview(produto({ catalogImage: { url: "/x.png", mode: "PROCESSED" } }))).toBe(true);
    expect(hasUsableCatalogPreview(produto({ catalogImage: { url: "/x.png", mode: "SEMANTIC_CROP" } }))).toBe(false);
    expect(hasUsableCatalogPreview(produto({ catalogImage: { url: "/x.png", mode: "SEMANTIC_CROP", crop: { x: 0 } } }))).toBe(true);
    expect(hasUsableCatalogPreview(produto({ catalogImage: { mode: "PROCESSED" } }))).toBe(false);
    expect(hasUsableCatalogPreview(produto({ catalogImage: { url: "/x.png", mode: "PROCESSED", photoSet: { status: "PENDING" } } }))).toBe(false);
  });

  it("flat lay aprovado conta como prévia pronta", () => {
    const flat = produto({ catalogImage: { whole: { version: "FLAT_LAY_V1", url: "/flat.png" } } });
    expect(hasFlatLay(flat)).toBe(true);
    expect(hasCachedPreview(flat)).toBe(true);
    expect(hasFlatLay(produto({ catalogImage: { whole: { version: "FLAT_LAY_V1" } } }))).toBe(false);
  });

  it("cache só vale na versão V2 e com status READY", () => {
    const base = { url: "/x.png", mode: "PROCESSED" };
    expect(hasCachedPreview(produto({ catalogImage: { ...base, previewCache: { version: "CATALOG_PREVIEW_FRAMES_V2", status: "READY" } } }))).toBe(true);
    expect(hasCachedPreview(produto({ catalogImage: { ...base, previewCache: { version: "CATALOG_PREVIEW_FRAMES_V1", status: "READY" } } }))).toBe(false);
    expect(hasCachedPreview(produto({ catalogImage: { ...base, previewCache: { version: "CATALOG_PREVIEW_FRAMES_V2", status: "PENDING" } } }))).toBe(false);
  });

  it("detecta resposta de outro produto ou categoria", () => {
    const atual = produto();
    expect(previewContextChanged(atual, produto(), atual)).toBe(false);
    expect(previewContextChanged(atual, produto({ id: "p2" }), atual)).toBe(true);
    expect(previewContextChanged(atual, produto({ category: "shoes_piece" }), atual)).toBe(true);
  });

  it("a chave da fonte muda quando a cor muda e não muda à toa", () => {
    expect(sourceKey(produto({ color: "blue" }))).toBe(sourceKey(produto({ color: "blue" })));
    expect(sourceKey(produto({ color: "blue" }))).not.toBe(sourceKey(produto({ color: "red" })));
  });
});
