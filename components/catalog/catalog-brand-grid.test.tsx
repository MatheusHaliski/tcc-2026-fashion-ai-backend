// @vitest-environment jsdom
/**
 * RF47 · busca catalogada do criador de peça: as marcas do catálogo aparecem em grade (a vitrine do provador) — um
 * toque escolhe a marca, sem digitar; o campo de texto filtra a grade e continua aceitando outra marca.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { CatalogSearch } from "@/components/catalog/catalog-search";
import { TAXONOMY } from "@/test-utils/fixtures";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const STORES = { stores: [
  { brandId: "b1", slug: "nike", name: "Nike", logoUrl: "/media/nike.png", catalogProducts: 21, categories: ["upper_piece"] },
  { brandId: "b2", slug: "adidas", name: "Adidas", logoUrl: null, catalogProducts: 9, categories: ["shoes_piece"] },
  { brandId: "b3", slug: "armani", name: "Armani", logoUrl: null, catalogProducts: 123, categories: ["upper_piece"] },
] };

const SUMMARY = { products: 14000, brands: 120 };
const product = (i: number, brand: string) => ({ id: `p${brand}${i}`, brand: brand ? { id: "b1", name: brand, slug: brand.toLowerCase() } : null, productName: `${brand || "Peça"} ${i}`, category: "upper_piece", subcategory: "tshirt",
  source: { type: "OFFICIAL", domain: "x", productUrl: "https://x/p", status: "OK", lastVerifiedAt: "2026-10-10" }, ingestionStatus: "VALIDATED", ownersCount: 0 });
/** Página do acervo: 48 por página; a marca tem 130 peças, o acervo inteiro 14 000. */
const page = (n: number, brand: string) => {
  const total = brand ? 130 : 14000;
  const size = 48;
  const start = n * size;
  const items = Array.from({ length: Math.max(0, Math.min(size, total - start)) }, (_, i) => product(start + i, brand));
  return { items, page: n, size, total, hasMore: start + items.length < total };
};

describe("grade de marcas na busca catalogada", () => {
  it("lista todas as marcas do catálogo; tocar escolhe (sem digitar) e preenche o campo; tocar de novo desfaz", async () => {
    const { calls } = mockApi({ "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/stores": STORES, "GET /api/catalog/brands": { brands: [] }, "GET /api/catalog/search": { intent: { brand: "Nike", brandKnown: true, keywords: [] }, results: [], total: 0 },
      "GET /api/catalog/summary": SUMMARY, "GET /api/catalog/products": (url: URL) => page(Number(url.searchParams.get("page") ?? 0), url.searchParams.get("brand") ?? "") });
    renderApp(<CatalogSearch onPick={vi.fn()} category="upper_piece" />);
    const group = await screen.findByRole("group", { name: /Marcas do catálogo \(3\)/ });
    expect(group.querySelectorAll("button")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /Nike/ }));
    expect(screen.getByRole("button", { name: /Nike/ }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByLabelText(/De qual marca/) as HTMLInputElement).value).toBe("Nike");
    expect((screen.getByRole("button", { name: /Buscar peças/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(calls.some((c) => c.path.startsWith("/api/catalog/stores"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Nike/ }));
    expect((screen.getByLabelText(/De qual marca/) as HTMLInputElement).value).toBe("");
  });

  it("marca escolhida sem descrever: lista o acervo INTEIRO dela (paginado, total real do banco), não as 24 mais parecidas", async () => {
    const { calls } = mockApi({ "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/stores": STORES, "GET /api/catalog/brands": { brands: [] },
      "GET /api/catalog/summary": SUMMARY, "GET /api/catalog/products": (url: URL) => page(Number(url.searchParams.get("page") ?? 0), url.searchParams.get("brand") ?? "") });
    renderApp(<CatalogSearch onPick={vi.fn()} category="upper_piece" />);
    // o resumo do acervo (total do banco) aparece antes de qualquer escolha, com o atalho para o acervo inteiro
    expect(await screen.findByText(/Acervo completo: 14\.?000 peças de 120 marcas/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Nike/ }));
    expect(await screen.findByRole("heading", { name: /^130 peças de Nike$/ })).toBeTruthy();
    const call = calls.find((c) => c.path.startsWith("/api/catalog/products"));
    expect(call?.path).toContain("brand=Nike");
    expect(call?.path).toContain("category=upper_piece");
    expect(call?.path).toContain("size=48");
    expect(calls.some((c) => c.path.startsWith("/api/catalog/search"))).toBe(false);
    expect(screen.getByText("Mostrando 48 de 130")).toBeTruthy();
    // rolagem infinita: a próxima página soma, sem repetir
    fireEvent.click(screen.getByRole("button", { name: /Carregar mais/ }));
    await waitFor(() => expect(screen.getByText("Mostrando 96 de 130")).toBeTruthy());
    expect(calls.filter((c) => c.path.startsWith("/api/catalog/products")).map((c) => new URL(c.path, "http://x").searchParams.get("page"))).toEqual(["0", "1"]);
  });

  it("'Ver todo o acervo' percorre o catálogo sem marca nem tipo", async () => {
    const { calls } = mockApi({ "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/stores": STORES, "GET /api/catalog/brands": { brands: [] },
      "GET /api/catalog/summary": SUMMARY, "GET /api/catalog/products": (url: URL) => page(Number(url.searchParams.get("page") ?? 0), url.searchParams.get("brand") ?? "") });
    renderApp(<CatalogSearch onPick={vi.fn()} category="" />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver todo o acervo/ }));
    expect(await screen.findByRole("heading", { name: /^14\.?000 peças no acervo$/ })).toBeTruthy();
    const call = calls.find((c) => c.path.startsWith("/api/catalog/products"));
    expect(call?.path).not.toContain("brand=");
    expect(call?.path).not.toContain("category=");
  });

  it("digitar filtra a grade e continua aceitando uma marca fora dela", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/stores": STORES, "GET /api/catalog/brands": { brands: [] } });
    renderApp(<CatalogSearch onPick={vi.fn()} category="upper_piece" />);
    await screen.findByRole("group", { name: /Marcas do catálogo \(3\)/ });
    fireEvent.change(screen.getByLabelText(/De qual marca/), { target: { value: "ad" } });
    await waitFor(() => expect(screen.getByRole("group", { name: /Marcas do catálogo/ }).querySelectorAll("button")).toHaveLength(1));
    expect(screen.getByRole("button", { name: /Adidas/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/De qual marca/), { target: { value: "Zyx" } });
    await waitFor(() => expect(screen.getByText(/Nenhuma marca do catálogo com "Zyx"/)).toBeTruthy());
  });

  it("sem a rota de lojas (servidor antigo), a busca segue só com o campo de texto", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/brands": { brands: [] } });
    renderApp(<CatalogSearch onPick={vi.fn()} category="upper_piece" />);
    expect(await screen.findByLabelText(/De qual marca/)).toBeTruthy();
    expect(screen.queryByRole("group", { name: /Marcas do catálogo/ })).toBeNull();
  });
});
