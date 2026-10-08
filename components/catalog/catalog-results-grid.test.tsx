// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { loggedAs, renderApp } from "@/test-utils/render";
import type { CatalogProduct } from "@/lib/api/catalog";
import { CatalogResultsGrid } from "./catalog-results-grid";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const products: CatalogProduct[] = Array.from({ length: 10 }, (_, index) => ({
  id: `p${index + 1}`, productName: `Produto ${index + 1}`, brand: null, category: "upper_piece", subcategory: "t_shirt",
  source: { type: "OFFICIAL_BRAND", domain: "brand.example", productUrl: `https://brand.example/${index + 1}`, status: "ACTIVE", lastVerifiedAt: "2026-10-08T00:00:00Z" },
  ingestionStatus: "VALIDATED", ownersCount: 0,
}));
const renderProduct = (product: CatalogProduct) => <span>{product.productName}</span>;
const list = () => screen.getByRole("list", { name: "Resultados do catálogo" });
const next = () => screen.getByRole("button", { name: "Avançar →" });

/** Exercise the browser event used by useSyncExternalStore instead of mocking the grid's column count. */
function viewport(initialWidth: number) {
  let width = initialWidth;
  const queries: { query: string; listeners: Set<(event: MediaQueryListEvent) => void> }[] = [];
  const matches = (query: string) => {
    const minimum = query.match(/min-width:\s*(\d+)px/);
    return minimum ? width >= Number(minimum[1]) : false;
  };
  vi.spyOn(window, "matchMedia").mockImplementation((query) => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    queries.push({ query, listeners });
    return {
      get matches() { return matches(query); }, media: query, onchange: null,
      addEventListener: (_type: string, callback: EventListenerOrEventListenerObject) => listeners.add(callback as (event: MediaQueryListEvent) => void),
      removeEventListener: (_type: string, callback: EventListenerOrEventListenerObject) => listeners.delete(callback as (event: MediaQueryListEvent) => void),
      addListener: (callback: (event: MediaQueryListEvent) => void) => listeners.add(callback),
      removeListener: (callback: (event: MediaQueryListEvent) => void) => listeners.delete(callback),
      dispatchEvent: () => false,
    } as MediaQueryList;
  });
  return (nextWidth: number) => act(() => {
    const previous = queries.map(({ query }) => matches(query));
    width = nextWidth;
    queries.forEach(({ query, listeners }, index) => {
      if (matches(query) === previous[index]) return;
      const event = { matches: matches(query), media: query } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    });
  });
}

describe("matriz do catálogo do provador", () => {
  it("mostra no máximo duas linhas nos três tamanhos de tela e nunca deixa uma página vazia após redimensionar", () => {
    const resize = viewport(639);
    loggedAs();
    renderApp(<CatalogResultsGrid products={products} resetKey="Nike" renderProduct={renderProduct} />);
    expect(list().getAttribute("data-columns")).toBe("2");
    expect(within(list()).getAllByRole("listitem")).toHaveLength(4);
    fireEvent.click(next());
    fireEvent.click(next());
    expect(within(list()).getAllByRole("listitem")).toHaveLength(2);

    resize(640);
    expect(list().getAttribute("data-columns")).toBe("3");
    expect(within(list()).getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByText("Página 1 de 2 · 10 resultados")).toBeTruthy();

    resize(1024);
    expect(list().getAttribute("data-columns")).toBe("4");
    expect(within(list()).getAllByRole("listitem")).toHaveLength(8);
    fireEvent.click(next());
    expect(within(list()).getAllByRole("listitem")).toHaveLength(2);
    expect((next() as HTMLButtonElement).disabled).toBe(true);
  });

  it("reinicia a página ao mudar o contexto e limita o índice quando a lista diminui", () => {
    viewport(400);
    loggedAs();
    const rendered = renderApp(<CatalogResultsGrid products={products} resetKey="Nike" renderProduct={renderProduct} />);
    fireEvent.click(next());
    expect(within(list()).getByText("Produto 5")).toBeTruthy();
    rendered.rerender(<CatalogResultsGrid products={products} resetKey="Nike:FEMININO" renderProduct={renderProduct} />);
    expect(within(list()).getByText("Produto 1")).toBeTruthy();
    expect((screen.getByRole("button", { name: "← Voltar" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(next());
    fireEvent.click(next());
    rendered.rerender(<CatalogResultsGrid products={products.slice(0, 2)} resetKey="Nike:FEMININO" renderProduct={renderProduct} />);
    expect(within(list()).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list()).getByText("Produto 1")).toBeTruthy();
    const previous = screen.queryByRole("button", { name: "← Voltar" }) as HTMLButtonElement | null;
    expect(previous === null || previous.disabled).toBe(true);
  });
});
