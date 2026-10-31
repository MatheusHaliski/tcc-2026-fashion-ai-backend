// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { catalogApi, type CatalogProduct } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import { hasUsableCatalogPreview, useCatalogPreview } from "./use-catalog-preview";

/**
 * Caracterização (R60b) das regras puras, do cache persistente e da fila de prévias do catálogo: formato gravado no
 * localStorage (chave, identidade da fonte, validade de 24 h, teto de 400), novas tentativas com espera para
 * 429/502/503/504, classificação das falhas, fila cheia e o estado inicial do hook.
 */
const STORE = "fai.catalogPreview.v2";
const previewCache = { version: "CATALOG_PREVIEW_FRAMES_V2", status: "READY", persisted: true } as const;
const simple = (id: string, imageUrl = `https://brand.example/${id}.jpg`) => ({ id, imageUrl } as CatalogProduct);
/** Identidade gravada para um produto só com id e foto de origem (as 19 posições do contrato persistido). */
const simpleSource = (id: string, url: string) => JSON.stringify([id, null, null, null, null, null, url, null, null, null, null, null, null, null, null, null, null, null, null]);
const stored = () => JSON.parse(localStorage.getItem(STORE) ?? "{}") as Record<string, { source: string; created: number; preview: Record<string, unknown> }>;

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear(); });

describe("hasUsableCatalogPreview", () => {
  const img = (extra: object) => ({ url: "/media/a.png", mode: "PROCESSED", ...extra });
  it.each([
    ["sem foto do catálogo", {}, false],
    ["PROCESSED com url", { catalogImage: img({}) }, true],
    ["DEFAULT com url", { catalogImage: img({ mode: "DEFAULT" }) }, true],
    ["SEMANTIC_CROP sem recorte", { catalogImage: img({ mode: "SEMANTIC_CROP" }) }, false],
    ["SEMANTIC_CROP com recorte", { catalogImage: img({ mode: "SEMANTIC_CROP", crop: { x: 0, y: 0, w: 1, h: 1 } }) }, true],
    ["sem url", { catalogImage: img({ url: "" }) }, false],
    ["conjunto em revisão", { catalogImage: img({ photoSet: { version: "CATALOG_PHOTO_SET_V2", status: "REVIEW" } }) }, false],
    ["conjunto DEFAULT", { catalogImage: img({ photoSet: { version: "CATALOG_PHOTO_SET_V2", status: "DEFAULT" } }) }, true],
    ["variante diferente da foto", { selectedVariant: { id: "v1" }, catalogImage: img({ variantId: "v2" }) }, false],
    ["variante igual à foto", { selectedVariant: { id: "v1" }, catalogImage: img({ variantId: "v1" }) }, true],
    ["foto DEFAULT ignora a variante", { selectedVariant: { id: "v1" }, catalogImage: img({ mode: "DEFAULT", variantId: "v2" }) }, true],
    ["variante pela imagem de origem", { selectedVariant: { id: "v1" }, images: [{ id: "i1", variantId: "v1" }], catalogImage: img({ imageId: "i1" }) }, true],
    ["imagem de origem de outra variante", { selectedVariant: { id: "v1" }, images: [{ id: "i1", variantId: "v2" }], catalogImage: img({ imageId: "i1" }) }, false],
    ["categoria do conjunto diferente", { category: "upper_piece", catalogImage: img({ photoSet: { status: "READY", category: "lower_piece" } }) }, false],
    ["produto sem categoria", { catalogImage: img({ photoSet: { status: "READY", category: "lower_piece" } }) }, true],
    ["subcategoria diferente", { subcategory: "shirt", catalogImage: img({ photoSet: { status: "READY", subcategory: "jeans" } }) }, false],
    ["cor da variante vence a do produto", { color: "red", selectedVariant: { id: "v", color: "black" }, catalogImage: img({ variantId: "v", photoSet: { status: "READY", color: "red" } }) }, false],
    ["cor do produto sem variante", { color: "red", catalogImage: img({ photoSet: { status: "READY", color: "red" } }) }, true],
    ["origem da imagem vence a do catálogo", { images: [{ id: "i", sourceUrl: "https://a" }], catalogImage: img({ imageId: "i", sourceUrl: "https://b", photoSet: { status: "READY", sourceUrl: "https://b" } }) }, false],
    ["origem pelo imageSource", { imageSource: { imageUrl: "https://c" }, imageUrl: "https://d", catalogImage: img({ photoSet: { status: "READY", sourceUrl: "https://c" } }) }, true],
    ["origem pelo imageUrl", { imageUrl: "https://d", catalogImage: img({ photoSet: { status: "READY", sourceUrl: "https://c" } }) }, false],
  ])("%s → %s", (_label, product, expected) => {
    expect(hasUsableCatalogPreview(product as unknown as CatalogProduct)).toBe(expected);
  });
});

describe("cache persistente", () => {
  it("grava a identidade da fonte e só os campos da prévia, na chave v2", async () => {
    const product = simple("fmt-1");
    vi.spyOn(catalogApi, "previewImage").mockResolvedValue({ ...product, productName: "não grava", catalogImage: { url: "/media/f.png", mode: "PROCESSED", previewCache } });
    const result = renderHook(() => useCatalogPreview(product));
    await waitFor(() => expect(result.result.current.pending).toBe(false));
    const entry = stored()["fmt-1"];
    expect(entry.source).toBe(simpleSource("fmt-1", product.imageUrl!));
    expect(entry.preview).toEqual({ catalogImage: { url: "/media/f.png", mode: "PROCESSED", previewCache } });
    expect(Math.abs(Date.now() - entry.created)).toBeLessThan(5000);
  });

  it("não grava prévia sem cache de quadros V2 pronto", async () => {
    const product = simple("fmt-uncached");
    vi.spyOn(catalogApi, "previewImage").mockResolvedValue({ ...product, catalogImage: { url: "/media/u.png", mode: "PROCESSED" } });
    const result = renderHook(() => useCatalogPreview(product));
    await waitFor(() => expect(result.result.current.product.catalogImage?.url).toBe("/media/u.png"));
    expect(stored()["fmt-uncached"]).toBeUndefined();
  });

  it("reaproveita uma entrada recente sem pedir; ignora a vencida (24 h) e a de outra fonte", async () => {
    const fresh = simple("persisted-fresh"), old = simple("persisted-old"), moved = simple("persisted-moved");
    const preview = { catalogImage: { url: "/media/kept.png", mode: "PROCESSED", previewCache } };
    localStorage.setItem(STORE, JSON.stringify({
      [fresh.id]: { source: simpleSource(fresh.id, fresh.imageUrl!), created: Date.now(), preview },
      [old.id]: { source: simpleSource(old.id, old.imageUrl!), created: Date.now() - 24 * 60 * 60 * 1000 - 1000, preview },
      [moved.id]: { source: simpleSource(moved.id, "https://brand.example/before.jpg"), created: Date.now(), preview },
    }));
    const request = vi.spyOn(catalogApi, "previewImage").mockImplementation(async id => ({ id, catalogImage: { url: `/media/new-${id}.png`, mode: "PROCESSED" } } as CatalogProduct));
    const a = renderHook(() => useCatalogPreview(fresh));
    expect(a.result.current.pending).toBe(false);
    expect(a.result.current.product.catalogImage?.url).toBe("/media/kept.png");
    const b = renderHook(() => useCatalogPreview(old));
    const c = renderHook(() => useCatalogPreview(moved));
    await waitFor(() => expect(b.result.current.product.catalogImage?.url).toBe("/media/new-persisted-old.png"));
    await waitFor(() => expect(c.result.current.product.catalogImage?.url).toBe("/media/new-persisted-moved.png"));
    expect(request.mock.calls.map(([id]) => id).sort()).toEqual(["persisted-moved", "persisted-old"]);
  });

  it("mantém no máximo 400 entradas, descartando as mais antigas", async () => {
    const seed: Record<string, unknown> = {};
    for (let n = 0; n < 400; n++) seed[`old-${n}`] = { source: "x", created: Date.now(), preview: {} };
    localStorage.setItem(STORE, JSON.stringify(seed));
    const product = simple("newest");
    vi.spyOn(catalogApi, "previewImage").mockResolvedValue({ ...product, catalogImage: { url: "/media/n.png", mode: "PROCESSED", previewCache } });
    const result = renderHook(() => useCatalogPreview(product));
    await waitFor(() => expect(result.result.current.pending).toBe(false));
    const keys = Object.keys(stored());
    expect(keys).toHaveLength(400);
    expect(keys[0]).toBe("old-1");
    expect(keys.at(-1)).toBe("newest");
  });

  it("sem localStorage gravável a prévia continua valendo na sessão", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("quota", "QuotaExceededError"); });
    const product = simple("quota-full");
    vi.spyOn(catalogApi, "previewImage").mockResolvedValue({ ...product, catalogImage: { url: "/media/q.png", mode: "PROCESSED", previewCache } });
    const result = renderHook(() => useCatalogPreview(product));
    await waitFor(() => expect(result.result.current.product.catalogImage?.url).toBe("/media/q.png"));
    expect(result.result.current.failed).toBeNull();
  });
});

describe("pedidos e fila", () => {
  it("429/502/503/504 tentam de novo após espera; outro status falha sem nova tentativa", async () => {
    const product = simple("retry-503");
    const request = vi.spyOn(catalogApi, "previewImage").mockRejectedValueOnce(new ApiError(503, "INDISPONIVEL", "busy"))
      .mockResolvedValue({ ...product, catalogImage: { url: "/media/r.png", mode: "PROCESSED" } });
    const result = renderHook(() => useCatalogPreview(product));
    await waitFor(() => expect(result.result.current.product.catalogImage?.url).toBe("/media/r.png"), { timeout: 4000 });
    expect(request).toHaveBeenCalledTimes(2);
    const other = simple("retry-400");
    const refused = vi.spyOn(catalogApi, "previewImage").mockRejectedValue(new ApiError(400, "INVALIDO", "bad"));
    const second = renderHook(() => useCatalogPreview(other));
    await waitFor(() => expect(second.result.current.failed).toBe("service"));
    expect(refused.mock.calls.filter(([id]) => id === "retry-400")).toHaveLength(1);
  });

  it("falha ao buscar a foto de origem vira 'source'", async () => {
    vi.spyOn(catalogApi, "previewImage").mockRejectedValue(new ApiError(422, "CATALOG_IMAGE_FETCH_FAILED", "fetch"));
    const result = renderHook(() => useCatalogPreview(simple("source-failure")));
    await waitFor(() => expect(result.result.current.failed).toBe("source"));
  });

  it("fila cheia (2 ativos + 96 aguardando) recusa o próximo cartão sem pedir", async () => {
    const finish: (() => void)[] = [];
    const request = vi.spyOn(catalogApi, "previewImage").mockImplementation(id => new Promise(resolve => {
      finish.push(() => resolve({ id, catalogImage: { url: `/media/${id}.png`, mode: "PROCESSED" } } as CatalogProduct));
    }));
    const hooks = Array.from({ length: 98 }, (_, n) => renderHook(() => useCatalogPreview(simple(`full-${n}`))));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2), { timeout: 4000 });
    const overflow = renderHook(() => useCatalogPreview(simple("full-overflow")));
    await waitFor(() => expect(overflow.result.current.failed).toBe("service"), { timeout: 4000 });
    expect(overflow.result.current.pending).toBe(false);
    hooks.slice(2).forEach(hook => hook.unmount());
    await act(async () => { finish.splice(0).forEach(resolve => resolve()); });
    await waitFor(() => expect(hooks[1].result.current.pending).toBe(false), { timeout: 4000 });
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe("estado inicial e prepare", () => {
  it("sem nenhuma foto de origem: não fica pendente, não pede e prepare devolve o próprio produto", () => {
    const product = { id: "no-source" } as CatalogProduct;
    const request = vi.spyOn(catalogApi, "previewImage");
    const result = renderHook(() => useCatalogPreview(product));
    expect(result.result.current.pending).toBe(false);
    expect(result.result.current.prepare()).toBe(product);
    expect(request).not.toHaveBeenCalled();
  });

  it("com prévia em cache: prepare devolve o produto sem Promise", () => {
    const product = { id: "prepared-cached", imageUrl: "https://brand.example/c.jpg", catalogImage: { url: "/media/c.png", mode: "PROCESSED", previewCache } } as CatalogProduct;
    const result = renderHook(() => useCatalogPreview(product));
    expect(result.result.current.pending).toBe(false);
    expect(result.result.current.prepare()).toEqual(product);
  });

  it("variante escolhida segue no pedido; força só na nova tentativa", async () => {
    const product = { ...simple("forced-variant"), selectedVariant: { id: "v9", key: "v9" } } as CatalogProduct;
    const request = vi.spyOn(catalogApi, "previewImage").mockRejectedValueOnce(new ApiError(500, "ERRO", "x"))
      .mockResolvedValue({ ...product, catalogImage: { url: "/media/v9.png", mode: "PROCESSED", variantId: "v9" } });
    const result = renderHook(() => useCatalogPreview(product));
    await waitFor(() => expect(result.result.current.failed).toBe("service"));
    act(() => result.result.current.retry());
    await waitFor(() => expect(result.result.current.product.catalogImage?.url).toBe("/media/v9.png"));
    expect(request.mock.calls).toEqual([["forced-variant", { variantId: "v9" }], ["forced-variant", { force: true, variantId: "v9" }]]);
  });
});

describe("nova tentativa sobre prévia gravada", () => {
  const seed = (product: CatalogProduct, url: string) => localStorage.setItem(STORE, JSON.stringify({
    [product.id]: { source: simpleSource(product.id, product.imageUrl!), created: Date.now(), preview: { catalogImage: { url, mode: "PROCESSED", previewCache } } },
  }));

  it("apaga a entrada do localStorage: se o pedido forçado falha, a prévia antiga não volta no próximo carregamento", async () => {
    const product = simple("retry-stored-fail");
    seed(product, "/media/stale.png");
    const request = vi.spyOn(catalogApi, "previewImage").mockRejectedValue(new ApiError(500, "ERRO", "x"));
    const result = renderHook(() => useCatalogPreview(product));
    expect(result.result.current.product.catalogImage?.url).toBe("/media/stale.png");
    expect(request).not.toHaveBeenCalled();
    act(() => result.result.current.retry());
    await waitFor(() => expect(result.result.current.failed).toBe("service"));
    expect(request.mock.calls).toEqual([["retry-stored-fail", { force: true }]]);
    expect(stored()["retry-stored-fail"]).toBeUndefined();
  });

  it("força o pedido mesmo quando a entrada gravada não pôde ser apagada (localStorage sem escrita)", async () => {
    const product = simple("retry-stored-readonly");
    seed(product, "/media/stale.png");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("quota", "QuotaExceededError"); });
    const request = vi.spyOn(catalogApi, "previewImage").mockResolvedValue({ ...product, catalogImage: { url: "/media/fresh.png", mode: "PROCESSED", previewCache } });
    const result = renderHook(() => useCatalogPreview(product));
    expect(result.result.current.product.catalogImage?.url).toBe("/media/stale.png");
    act(() => result.result.current.retry());
    await waitFor(() => expect(result.result.current.product.catalogImage?.url).toBe("/media/fresh.png"));
    expect(request.mock.calls).toEqual([["retry-stored-readonly", { force: true }]]);
    expect(stored()["retry-stored-readonly"].preview).toEqual({ catalogImage: { url: "/media/stale.png", mode: "PROCESSED", previewCache } });
  });
});
