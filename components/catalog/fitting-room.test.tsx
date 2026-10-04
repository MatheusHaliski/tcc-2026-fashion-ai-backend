// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { loggedAs, renderApp, ME } from "@/test-utils/render";
import TryOnPage from "@/app/(site)/(app)/try-on/page";

afterEach(() => { cleanup(); try { sessionStorage.clear(); localStorage.clear(); } catch { /* sem storage */ } });

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt", "hoodie"], lower_piece: ["jeans"], shoes_piece: ["casual_sneakers"], accessory_piece: ["cap"], full_body_piece: ["dress"] },
  colors: { white: "#FFFFFF", black: "#12100F", blue: "#1F4FA0" }, materials: ["COTTON"], sizes: ["m"], sexes: ["UNISSEX"], occasions: ["casual"], styles: ["basic"],
  allowedOccasionsByCategory: {}, brands: [],
};
const STATE = { mannequin: { sex: "FEMININO", build: "MEDIUM", skinTone: "media" }, sex: "FEMININO", pieces: { upper_piece: [], lower_piece: [], shoes_piece: [], accessory_piece: [] }, avatar: null };
const STORES = { stores: [
  { brandId: "b1", slug: "nike", name: "Nike", logoUrl: null, catalogProducts: 26, categories: ["shoes_piece", "upper_piece"] },
  { brandId: "b2", slug: "levis", name: "Levi's", logoUrl: null, catalogProducts: 18, categories: ["lower_piece"] },
] };
const product = (id: string, brand: { id: string; name: string; slug: string }, name: string, category: string, subcategory: string) => ({
  id, brand: { ...brand, logoUrl: null }, productName: name, modelName: name, category, subcategory, color: "white", colorName: "White", colorHex: "#FFFFFF",
  source: { type: "OFFICIAL_BRAND", domain: `${brand.slug}.com`, productUrl: `https://${brand.slug}.com/p/${id}`, status: "ACTIVE", lastVerifiedAt: "2026-10-04T00:00:00Z" },
  ingestionStatus: "VALIDATED", ownersCount: 0, matchPercent: 90,
  variants: [{ id: `${id}-w`, key: "white", color: "white", colorName: "White" }, { id: `${id}-k`, key: "black", color: "black", colorName: "Black" }],
});
const AF1 = product("p1", { id: "b1", name: "Nike", slug: "nike" }, "Air Force 1 '07", "shoes_piece", "casual_sneakers");
const L501 = product("p2", { id: "b2", name: "Levi's", slug: "levis" }, "501 Original", "lower_piece", "jeans");

describe("provador virtual de lojas (RF18 + RF47)", () => {
  it("prova peças de duas marcas: o ambiente segue a última marca e a outra vira painel lateral", async () => {
    const { calls } = loggedAs(ME, {
      "GET /api/taxonomy": TAXONOMY, "GET /api/try-on": STATE, "GET /api/catalog/stores": STORES,
      "GET /api/catalog/search": (url: URL) => {
        const brand = url.searchParams.get("brand");
        return { intent: { brand, brandKnown: true, keywords: [] }, results: brand === "Levi's" ? [L501] : [AF1], total: 1, enoughInput: true, canSearchOfficial: false };
      },
      "POST /api/pieces/from-catalog": { id: "nova", name: "Air Force 1 '07" },
    });
    renderApp(<TryOnPage />);
    expect(await screen.findByRole("heading", { name: "Provador virtual" })).toBeTruthy();
    // a vitrine da loja abre só com a marca escolhida
    fireEvent.click(await screen.findByRole("button", { name: /Levi's/ }));
    await waitFor(() => expect(calls.some((c) => c.path.startsWith("/api/catalog/search") && c.path.includes("Levi"))).toBe(true), { timeout: 4000 });
    fireEvent.click(await screen.findByRole("button", { name: "Provar" }));
    expect(await screen.findByText("Provador Levi's")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Nike/ }));
    await waitFor(() => expect(screen.getByText("Air Force 1 '07")).toBeTruthy(), { timeout: 4000 });
    fireEvent.click(screen.getByRole("button", { name: "Provar" }));
    expect(await screen.findByText("Provador Nike · também: Levi's")).toBeTruthy();
    // fixar a marca anterior mantém o provador dela
    fireEvent.click(within(screen.getByRole("group", { name: "Ambiente" })).getByRole("button", { name: /Levi's/ }));
    expect(await screen.findByText("Provador Levi's · também: Nike")).toBeTruthy();
    // trocar a cor da peça vestida e "Já tenho esta peça" (entra no guarda-roupa por referência)
    fireEvent.click(screen.getAllByRole("button", { name: "Black" })[0]);
    expect(await screen.findByText(/Air Force 1 '07 · Black|501 Original · Black/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Já tenho esta peça" })[0]);
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/pieces/from-catalog")).toBe(true), { timeout: 4000 });
    expect(screen.getAllByRole("link", { name: /Ver em/ }).length).toBeGreaterThan(0);
  });

  it("guarda-roupa vazio não bloqueia: o provador abre nas lojas e salva provas", async () => {
    loggedAs(ME, {
      "GET /api/taxonomy": TAXONOMY, "GET /api/try-on": STATE, "GET /api/catalog/stores": STORES,
      "GET /api/catalog/search": { intent: { brand: "Nike", brandKnown: true, keywords: [] }, results: [AF1], total: 1, enoughInput: true },
    });
    renderApp(<TryOnPage />);
    fireEvent.click(await screen.findByRole("radio", { name: /Meu guarda-roupa/ }));
    expect(await screen.findByText(/Seu guarda-roupa ainda está vazio/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /^Lojas$/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Nike/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Provar" }, { timeout: 4000 }));
    fireEvent.click(await screen.findByRole("button", { name: "Salvar prova" }));
    expect(await screen.findByRole("button", { name: "Provar de novo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Apagar a prova Nike" })).toBeTruthy();
  });
});
