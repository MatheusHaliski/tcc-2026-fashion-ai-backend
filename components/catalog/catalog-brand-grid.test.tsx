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

describe("grade de marcas na busca catalogada", () => {
  it("lista todas as marcas do catálogo; tocar escolhe (sem digitar) e preenche o campo; tocar de novo desfaz", async () => {
    const { calls } = mockApi({ "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/stores": STORES, "GET /api/catalog/brands": { brands: [] }, "GET /api/catalog/search": { intent: { brand: "Nike", brandKnown: true, keywords: [] }, results: [], total: 0 } });
    renderApp(<CatalogSearch onPick={vi.fn()} category="upper_piece" />);
    const group = await screen.findByRole("group", { name: /Marcas do catálogo \(3\)/ });
    expect(group.querySelectorAll("button")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /Nike/ }));
    expect(screen.getByRole("button", { name: /Nike/ }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByLabelText(/De qual marca/) as HTMLInputElement).value).toBe("Nike");
    // só a marca ainda não dispara a busca (duas ou três informações), mas o botão já pode buscar por ela
    expect((screen.getByRole("button", { name: /Buscar peças/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(calls.some((c) => c.path.startsWith("/api/catalog/stores"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Nike/ }));
    expect((screen.getByLabelText(/De qual marca/) as HTMLInputElement).value).toBe("");
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
