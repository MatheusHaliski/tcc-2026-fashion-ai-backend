import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/api/client", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...real, api: { get: h.get, put: h.put } };
});

import { accessibilityApi, EMPTY_FILTERS, FILTER_KEYS, type Declaration } from "./accessibility";

beforeEach(() => {
  h.get.mockReset(); h.get.mockResolvedValue({});
  h.put.mockReset(); h.put.mockResolvedValue({});
});

describe("acessibilidade de uso no catálogo", () => {
  it("todo filtro tem um valor inicial desligado", () => {
    expect(Object.keys(EMPTY_FILTERS).sort()).toEqual([...FILTER_KEYS].sort());
    expect(Object.values(EMPTY_FILTERS).every((v) => v === false)).toBe(true);
  });

  it("a busca manda só os filtros ligados e a categoria", async () => {
    await accessibilityApi.search({ ...EMPTY_FILTERS, flatSeams: true, oneHandDressing: true }, "upper_piece");
    const url = h.get.mock.calls[0][0] as string;
    expect(url.startsWith("/api/catalog/accessibility/search?")).toBe(true);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("flatSeams")).toBe("true");
    expect(params.get("oneHandDressing")).toBe("true");
    expect(params.get("easyClosure")).toBe("false");
    expect(params.get("category")).toBe("upper_piece");
  });

  it("sem categoria, o parâmetro não vai na URL", async () => {
    await accessibilityApi.search(EMPTY_FILTERS, "");
    const params = new URLSearchParams((h.get.mock.calls[0][0] as string).split("?")[1]);
    expect(params.has("category")).toBe(false);
  });

  it("lê e declara a acessibilidade de um produto com o id escapado", async () => {
    await accessibilityApi.product("p 1");
    expect(h.get.mock.calls[0][0]).toBe("/api/catalog/products/p%201/accessibility");
    const body = { declarationSource: "BRAND_SPEC" } as Declaration;
    await accessibilityApi.declare("p 1", body);
    expect(h.put).toHaveBeenCalledWith("/api/catalog/products/p%201/accessibility", body);
  });

  it("lista as declarações da marca", async () => {
    await accessibilityApi.mine();
    expect(h.get.mock.calls[0][0]).toBe("/api/me/catalog/accessibility");
  });
});
