// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { loggedAs, renderApp, ME } from "@/test-utils/render";
import { PIECE } from "@/test-utils/fixtures";
import NewPiecePage from "@/app/(site)/(app)/pieces/new/page";

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt"], lower_piece: ["jeans"], shoes_piece: ["casual_sneakers", "running_shoes"], accessory_piece: ["watch"], full_body_piece: ["dress"] },
  colors: { white: "#FFFFFF", black: "#12100F" }, materials: ["LEATHER", "COTTON"], sizes: ["m", "shoe_41", "shoe_42", "one_size"], sexes: ["UNISSEX"],
  occasions: ["casual"], styles: ["basic"], allowedOccasionsByCategory: { shoes_piece: ["casual"] }, brands: [],
};
const PRODUCT = {
  id: "p1", brand: { id: "b1", name: "Nike", slug: "nike", logoUrl: null }, productName: "Air Force 1 '07", modelName: "Air Force 1 '07",
  category: "shoes_piece", subcategory: "casual_sneakers", color: "white", colorName: "White/White", colorHex: "#FFFFFF", material: "LEATHER",
  source: { type: "MANUAL_ADMIN", domain: "null", productUrl: "null", status: "ACTIVE", lastVerifiedAt: "2026-10-03T00:00:00Z" }, ingestionStatus: "VALIDATED", ownersCount: 2,
  matchPercent: 96, matchScore: { total: 0.96, brandMatch: 1, categoryMatch: 1, subcategoryMatch: 1, textSimilarity: 0.9, colorMatch: 1 },
  variants: [{ id: "v1", key: "white-white", color: "white", colorName: "White/White" }, { id: "v2", key: "black-black", color: "black", colorName: "Black/Black" }],
};

afterEach(() => cleanup());

describe("adicionar peça pelo catálogo (RF47)", () => {
  it("categoria → tipo → marca → nome → resultado → confirmar → peça criada por referência", async () => {
    const { calls } = loggedAs(ME, {
      "GET /api/taxonomy": TAXONOMY,
      "GET /api/catalog/brands": { brands: [{ id: "b1", name: "Nike", slug: "nike", products: 26 }] },
      "GET /api/catalog/search": { intent: { brand: "Nike", brandKnown: true, category: "shoes_piece", subcategory: "casual_sneakers", keywords: ["air", "force"], color: null }, results: [PRODUCT], total: 1, enoughInput: true, canSearchOfficial: true },
      "GET /api/catalog/suggestions": { suggestions: ["Air Force 1", "Air Force 1 Mid"] },
      "GET /api/catalog/products/p1": { ...PRODUCT, images: [], aliases: ["AF1"] },
      "POST /api/pieces/from-catalog": { ...PIECE, id: "nova-af1", name: "Air Force 1 '07" },
    });
    renderApp(<NewPiecePage />);
    fireEvent.click(await screen.findByRole("button", { name: /Buscar no catálogo/ }));
    fireEvent.click(await screen.findByRole("radio", { name: /Calçados/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Tênis casual" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Nike" } });
    fireEvent.change(screen.getByLabelText(/Como ela se chama/), { target: { value: "air force" } });
    await waitFor(() => expect(calls.some((c) => c.path.startsWith("/api/catalog/search"))).toBe(true), { timeout: 4000 });
    expect(await screen.findByText("96% compatível")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "É esta" }));
    expect(await screen.findByText("Confirme sua peça")).toBeTruthy();
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Informações da minha peça")).toBeTruthy();
    // o card do resultado também tem swatches "Black/Black": a troca de cor confirmada é a do diálogo
    fireEvent.click(dialog.getByRole("button", { name: "Black/Black" }));
    fireEvent.click(dialog.getByRole("button", { name: "Adicionar ao guarda-roupa" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/pieces/from-catalog")).toBe(true), { timeout: 4000 });
    const body = calls.find((c) => c.path === "/api/pieces/from-catalog")!.body as Record<string, unknown>;
    expect(body.productId).toBe("p1");
    expect(body.variantId).toBe("v2");
    expect(body.color).toBe("black");
  });

  it("sem resultado oferece lojas oficiais e a própria foto; a busca externa nunca inventa", async () => {
    const { calls } = loggedAs(ME, {
      "GET /api/taxonomy": TAXONOMY,
      "GET /api/catalog/brands": { brands: [] },
      "GET /api/catalog/search": { intent: { brand: "Lacoste", brandKnown: true, category: null, subcategory: "watch", keywords: [], color: null }, results: [], total: 0, enoughInput: true, canSearchOfficial: true, message: "Ainda não encontramos essa peça no catálogo." },
      "POST /api/catalog/discover": { results: [], status: "NOT_FOUND", message: "Não achamos essa peça nas lojas oficiais da marca." },
    });
    renderApp(<NewPiecePage />);
    fireEvent.click(await screen.findByRole("button", { name: /Buscar no catálogo/ }));
    fireEvent.click(await screen.findByRole("radio", { name: /Acessórios/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Relógio" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Lacoste" } });
    await waitFor(() => expect(calls.some((c) => c.path.startsWith("/api/catalog/search"))).toBe(true), { timeout: 4000 });
    fireEvent.click(await screen.findByRole("button", { name: "Pesquisar em lojas oficiais" }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/catalog/discover")).toBe(true), { timeout: 4000 });
    expect(await screen.findByText(/Não achamos essa peça nas lojas oficiais/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar com minha foto" }));
    // o contexto (Acessórios · Relógio) acompanha a pessoa: o guia abre direto na orientação do relógio
    expect(await screen.findByText("Fotografe o mostrador de frente")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Alterar categoria" })).toBeTruthy();
  });
});
