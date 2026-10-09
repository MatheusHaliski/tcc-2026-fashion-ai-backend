// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import NewPiecePage from "@/app/(site)/(app)/pieces/new/page";
import type { CatalogProduct, SearchResponse } from "@/lib/api/catalog";
import { __setTaxonomyCache } from "@/lib/api/taxonomy";
import { PIECE } from "@/test-utils/fixtures";
import { loggedAs, ME, renderApp } from "@/test-utils/render";

const taxonomy = {
  subcategories: { shoes_piece: ["casual_sneakers"] },
  colors: { white: "#FFFFFF", black: "#12100F" }, materials: ["LEATHER"], sizes: ["m", "shoe_41"],
  sexes: ["FEMININO", "MASCULINO", "UNISSEX"], occasions: ["casual"], styles: ["basic"],
  allowedOccasionsByCategory: { shoes_piece: ["casual"] }, brands: [],
};
const products: CatalogProduct[] = Array.from({ length: 11 }, (_, index) => ({
  id: `catalog-${index + 1}`, productName: `Tênis ${index + 1}`,
  brand: { id: "nike", name: "Nike", slug: "nike" }, category: "shoes_piece", subcategory: "casual_sneakers",
  color: "white", material: "LEATHER", gender: index % 2 === 0 ? "FEMININO" : "MASCULINO",
  variants: [
    { id: `white-${index + 1}`, key: "white", color: "white", colorName: `Branco ${index + 1}` },
    { id: `black-${index + 1}`, key: "black", color: "black", colorName: `Preto ${index + 1}` },
  ],
  source: { type: "OFFICIAL_BRAND", domain: "nike.example", productUrl: `https://nike.example/${index + 1}`, status: "ACTIVE", lastVerifiedAt: "2026-10-09T00:00:00Z" },
  ingestionStatus: "VALIDATED", ownersCount: 0,
}));

beforeEach(() => __setTaxonomyCache(null));
afterEach(() => { cleanup(); vi.restoreAllMocks(); __setTaxonomyCache(null); });

function viewport(width: number) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: width >= Number(query.match(/min-width:\s*(\d+)px/)?.[1] ?? Infinity),
    media: query, onchange: null, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  } as MediaQueryList));
}

function mockCatalog() {
  return loggedAs(ME, {
    "GET /api/taxonomy": taxonomy,
    "GET /api/catalog/brands": { brands: [{ id: "nike", name: "Nike", slug: "nike", products: 11 }] },
    "GET /api/catalog/suggestions": { suggestions: [] },
    "GET /api/catalog/search": (url: URL): SearchResponse => {
      const results = url.searchParams.get("q") === "vazio" ? [] : products;
      return {
        intent: { brand: "Nike", brandKnown: true, category: "shoes_piece", keywords: [], color: null },
        results, total: results.length, enoughInput: true, canSearchOfficial: false,
      };
    },
    "POST /api/pieces/from-catalog": { ...PIECE, id: "saved-catalog-piece" },
  });
}

async function searchCatalog() {
  renderApp(<NewPiecePage />);
  fireEvent.click(await screen.findByRole("button", { name: "Calçados" }));
  fireEvent.change(screen.getByLabelText(/De qual marca/), { target: { value: "Nike" } });
  fireEvent.change(screen.getByLabelText(/Como ela se chama/), { target: { value: "tenis" } });
  await screen.findByText("Peças nesta seleção: 11");
  return screen.getByRole("list", { name: "Resultados do catálogo" });
}

const pagination = () => screen.getByRole("navigation", { name: "paginação" });
const advance = () => within(pagination()).getByRole("button", { name: "Avançar →" });

describe("busca catalogada em Adicionar peça", () => {
  it.each([
    { screenName: "celular", width: 375, pageSize: 4, pages: 3 },
    { screenName: "tablet", width: 768, pageSize: 6, pages: 2 },
    { screenName: "desktop", width: 1280, pageSize: 8, pages: 2 },
  ])("limita os resultados a duas linhas no $screenName e navega pela seleção completa", async ({ width, pageSize, pages }) => {
    viewport(width);
    mockCatalog();
    const list = await searchCatalog();
    expect(within(list).getAllByRole("listitem")).toHaveLength(pageSize);
    expect(within(list).getByRole("heading", { name: "Tênis 1" })).toBeTruthy();
    expect(within(list).queryByRole("heading", { name: `Tênis ${pageSize + 1}` })).toBeNull();
    expect(within(pagination()).getByText(`Página 1 de ${pages} · 11 resultados`)).toBeTruthy();
    expect((within(pagination()).getByRole("button", { name: "← Voltar" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(advance());
    expect(within(list).getAllByRole("listitem")).toHaveLength(Math.min(pageSize, 11 - pageSize));
    expect(within(list).getByRole("heading", { name: `Tênis ${pageSize + 1}` })).toBeTruthy();
    expect(within(pagination()).getByText(`Página 2 de ${pages} · 11 resultados`)).toBeTruthy();
    if (pages === 3) fireEvent.click(advance());
    expect((advance() as HTMLButtonElement).disabled).toBe(true);
    // The count represents the entire filtered selection, not just cards on this page.
    expect(screen.getByText("Peças nesta seleção: 11")).toBeTruthy();
  });

  it("atualiza a contagem dos filtros, volta à primeira página e informa uma busca com zero peças", async () => {
    viewport(375);
    mockCatalog();
    const list = await searchCatalog();
    fireEvent.click(advance());
    fireEvent.click(advance());
    expect(within(list).getByRole("heading", { name: "Tênis 11" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Feminino", exact: true }));
    expect(screen.getByText("Peças nesta seleção: 6")).toBeTruthy();
    expect(within(pagination()).getByText("Página 1 de 2 · 6 resultados")).toBeTruthy();
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(within(list).getByRole("heading", { name: "Tênis 1" })).toBeTruthy();
    expect(within(list).queryByRole("heading", { name: "Tênis 2" })).toBeNull();

    fireEvent.change(screen.getByLabelText(/Como ela se chama/), { target: { value: "vazio" } });
    await screen.findByText("Peças nesta seleção: 0");
    expect(screen.queryByRole("list", { name: "Resultados do catálogo" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "paginação" })).toBeNull();
  });

  it("preserva a variante escolhida ao navegar entre páginas e salva a peça selecionada na segunda página", async () => {
    viewport(375);
    const { calls } = mockCatalog();
    const list = await searchCatalog();
    fireEvent.click(advance());
    const sixthCard = within(list).getByRole("heading", { name: "Tênis 6" }).closest("article")!;
    fireEvent.click(within(sixthCard).getByRole("button", { name: "Preto 6" }));
    fireEvent.click(within(pagination()).getByRole("button", { name: "← Voltar" }));
    fireEvent.click(advance());
    const revisitedCard = within(list).getByRole("heading", { name: "Tênis 6" }).closest("article")!;
    expect(within(revisitedCard).getByRole("button", { name: "Preto 6" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(revisitedCard).getByRole("button", { name: "É esta" }));
    expect(await screen.findByText("Peça do catálogo")).toBeTruthy();
    expect((screen.getByLabelText(/^Nome/) as HTMLInputElement).value).toBe("Tênis 6");
    for (let step = 0; step < 3; step++) {
      fireEvent.click(screen.getAllByRole("button").find((button) => /Próximo|Avançar|Next/i.test(button.textContent ?? ""))!);
    }
    const review = screen.getByRole("heading", { name: "Revisar e salvar" }).closest("section")!;
    fireEvent.click(within(review).getByRole("button", { name: /^Salvar$/ }));
    await waitFor(() => expect(calls.some((call) => call.path === "/api/pieces/from-catalog")).toBe(true));
    expect(calls.find((call) => call.path === "/api/pieces/from-catalog")!.body).toMatchObject({
      productId: "catalog-6", variantId: "black-6", color: "black",
    });
  });
});
