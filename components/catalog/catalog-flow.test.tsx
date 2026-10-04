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

describe("adicionar peça pelo catálogo (RF47) — etapa única Peça", () => {
  it("tipo → subtipo → marca → nome → 'É esta' preenche o formulário e salva por referência ao catálogo", async () => {
    const { calls } = loggedAs(ME, {
      "GET /api/taxonomy": TAXONOMY,
      "GET /api/catalog/brands": { brands: [{ id: "b1", name: "Nike", slug: "nike", products: 26 }] },
      "GET /api/catalog/search": { intent: { brand: "Nike", brandKnown: true, category: "shoes_piece", subcategory: "casual_sneakers", keywords: ["air", "force"], color: null }, results: [PRODUCT], total: 1, enoughInput: true, canSearchOfficial: true },
      "GET /api/catalog/suggestions": { suggestions: ["Air Force 1", "Air Force 1 Mid"] },
      "POST /api/pieces/from-catalog": { ...PIECE, id: "nova-af1", name: "Air Force 1 '07" },
    });
    renderApp(<NewPiecePage />);
    // a busca catalogada, a foto e os dados estão na mesma etapa
    expect(await screen.findByRole("heading", { name: "Buscar no catálogo" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Dados" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Calçados" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tênis casual" }));
    fireEvent.change(screen.getByLabelText(/De qual marca/), { target: { value: "Nike" } });
    fireEvent.change(screen.getByLabelText(/Como ela se chama/), { target: { value: "air force" } });
    await waitFor(() => expect(calls.some((c) => c.path.startsWith("/api/catalog/search"))).toBe(true), { timeout: 4000 });
    expect(await screen.findByText("96% compatível")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Black/Black" }));
    fireEvent.click(screen.getByRole("button", { name: "É esta" }));
    // o produto vira referência e preenche o formulário (nome, marca)
    expect(await screen.findByText("Peça do catálogo")).toBeTruthy();
    expect((screen.getByLabelText(/^Nome/) as HTMLInputElement).value).toBe("Air Force 1 '07");
    // etapas seguintes até salvar
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getAllByRole("button").find((b) => /Próximo|Avançar|Next/i.test(b.textContent ?? ""))!);
    expect(await screen.findByText(/Ilustração da categoria/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button").find((b) => /Salvar/.test(b.textContent ?? ""))!);
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/pieces/from-catalog")).toBe(true), { timeout: 4000 });
    const body = calls.find((c) => c.path === "/api/pieces/from-catalog")!.body as Record<string, unknown>;
    expect(body.productId).toBe("p1");
    expect(body.variantId).toBe("v2");
    expect(body.color).toBe("black");
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/pieces")).toBe(false);
  });

  it("sem resultado oferece refinar e lojas oficiais (que nunca inventam) e aponta para os dados logo abaixo", async () => {
    const { calls } = loggedAs(ME, {
      "GET /api/taxonomy": TAXONOMY,
      "GET /api/catalog/brands": { brands: [] },
      "GET /api/catalog/search": { intent: { brand: "Lacoste", brandKnown: true, category: "accessory_piece", subcategory: "watch", keywords: [], color: null }, results: [], total: 0, enoughInput: true, canSearchOfficial: true, message: "Ainda não encontramos essa peça no catálogo." },
      "POST /api/catalog/discover": { results: [], status: "NOT_FOUND", message: "Não achamos essa peça nas lojas oficiais da marca." },
    });
    renderApp(<NewPiecePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Acessórios" }));
    fireEvent.click(await screen.findByRole("button", { name: "Relógio" }));
    fireEvent.change(screen.getByLabelText(/De qual marca/), { target: { value: "Lacoste" } });
    await waitFor(() => expect(calls.some((c) => c.path.startsWith("/api/catalog/search"))).toBe(true), { timeout: 4000 });
    fireEvent.click(await screen.findByRole("button", { name: "Pesquisar em lojas oficiais" }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/catalog/discover")).toBe(true), { timeout: 4000 });
    expect(await screen.findByText(/Não achamos essa peça nas lojas oficiais/)).toBeTruthy();
    expect(screen.getByText("Ou preencha os dados da peça logo abaixo.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /minha foto|Enviar foto/ })).toBeNull();
  });

  it("lê as características únicas no texto do nome e mostra por que cada camiseta combina", async () => {
    const shirt = (id: string, name: string, color: string, description: string, reasons: { facet: string; value: string; ok: boolean }[], pct: number) => ({
      ...PRODUCT, id, brand: { id: "ck", name: "Calvin Klein", slug: "calvin-klein", logoUrl: null }, productName: name, modelName: name, category: "upper_piece", subcategory: "t_shirt",
      color, colorName: color, description, variants: [], matchPercent: pct, matchScore: { total: pct / 100, brandMatch: 1, categoryMatch: 1, subcategoryMatch: 0.35, textSimilarity: 0, colorMatch: 1, designMatch: pct / 100, reasons },
    });
    const { calls } = loggedAs(ME, {
      "GET /api/taxonomy": { ...TAXONOMY, subcategories: { ...TAXONOMY.subcategories, upper_piece: ["t_shirt", "shirt"] }, colors: { ...TAXONOMY.colors, blue: "#1F4FA0", gray: "#888888" } },
      "GET /api/catalog/brands": { brands: [] },
      "GET /api/catalog/suggestions": { suggestions: [] },
      "GET /api/catalog/search": {
        intent: { brand: "Calvin Klein", brandKnown: true, category: "upper_piece", subcategory: "shirt", keywords: [], color: "blue",
          design: { pattern: "SINGLE_LOGO", logoPlacement: "CENTER_CHEST", sides: [], baseColors: ["blue"], printColors: ["white"], anyColors: [], source: "AI" } },
        results: [
          shirt("c1", "Camiseta Logo Central", "blue", "Camiseta toda azul com um único logo CK branco no centro do peito.",
            [{ facet: "pattern", value: "SINGLE_LOGO", ok: true }, { facet: "placement", value: "CENTER_CHEST", ok: true }, { facet: "baseColor", value: "blue", ok: true }, { facet: "printColor", value: "white", ok: true }], 97),
          shirt("c2", "Camiseta Monogram Allover", "gray", "Camiseta com o monograma CK em toda a superfície, cinza e preto.",
            [{ facet: "pattern", value: "SINGLE_LOGO", ok: false }, { facet: "baseColor", value: "blue", ok: false }], 52),
        ], total: 2, enoughInput: true, canSearchOfficial: false },
    });
    renderApp(<NewPiecePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Parte superior" }));
    fireEvent.change(screen.getByLabelText(/De qual marca/), { target: { value: "Calvin Klein" } });
    fireEvent.change(screen.getByLabelText(/Como ela se chama/), { target: { value: "camisa toda azul com um logo ck branco no centro" } });
    await waitFor(() => expect(calls.some((c) => c.path.startsWith("/api/catalog/search") && c.path.includes("logo"))).toBe(true), { timeout: 4000 });
    const understood = (await screen.findByText("Entendemos:", {}, { timeout: 4000 })).parentElement as HTMLElement;
    expect(within(understood).getByText("Um logo")).toBeTruthy();
    expect(within(understood).getByText("Logo no centro do peito")).toBeTruthy();
    expect(within(understood).getByText("Peça azul")).toBeTruthy();
    expect(within(understood).getByText("Estampa branco")).toBeTruthy();
    expect(within(understood).getByText("lido pela IA")).toBeTruthy();
    // o card certo vem primeiro e diz o que bateu; o outro mostra o que não bate
    const cards = screen.getAllByRole("article");
    expect(within(cards[0]).getByText("Camiseta Logo Central")).toBeTruthy();
    expect(within(cards[0]).getByText(/um único logo CK branco/)).toBeTruthy();
    expect(within(cards[0]).getByText("Logo no centro do peito")).toBeTruthy();
    expect(within(cards[1]).getAllByText("✗").length).toBe(2);
  });
});
