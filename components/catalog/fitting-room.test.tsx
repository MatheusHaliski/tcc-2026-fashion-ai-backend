// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { loggedAs, renderApp, ME } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import type { FittingItem } from "@/lib/tryon/fitting-room";
import TryOnPage from "@/app/(site)/(app)/try-on/page";

// Observe only the page-to-scene contract; these characterization tests do not require WebGL.
vi.mock("next/dynamic", () => ({ default: () => function FittingSceneStub(props: { sex: string; pieces: { id: string; slot: string; sizeLabel?: string | null }[]; view: string; light: string }) {
  return <div data-testid="fitting-scene" data-sex={props.sex} data-pieces={JSON.stringify(props.pieces.map(({ id, slot }) => ({ id, slot })))}
    data-sizes={JSON.stringify(Object.fromEntries(props.pieces.filter((p) => p.sizeLabel).map((p) => [p.id, p.sizeLabel])))} data-view={props.view} data-light={props.light} />;
} }));

afterEach(() => { cleanup(); nav.search = new URLSearchParams(); try { sessionStorage.clear(); localStorage.clear(); } catch { /* sem storage */ } });

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
const SHIRTS = Array.from({ length: 10 }, (_, index) => ({
  ...product(`shirt-${index + 1}`, { id: "b1", name: "Nike", slug: "nike" }, `Camiseta Nike ${index + 1}`, "upper_piece", "t_shirt"),
  gender: index % 2 === 0 ? "FEMININO" : "MASCULINO",
}));

const baseRoutes = () => ({
  "GET /api/taxonomy": TAXONOMY,
  "GET /api/try-on": STATE,
  "GET /api/catalog/stores": STORES,
  "GET /api/catalog/search": { intent: { brandKnown: false, keywords: [] }, results: [], total: 0, enoughInput: true },
});
const fitted = (key: string, overrides: Partial<FittingItem> = {}): FittingItem => ({
  key, source: "wardrobe", slot: "upper_piece", wear: "TOP", name: "Camiseta básica", brand: null,
  category: "upper_piece", subcategory: "t_shirt", pieceId: key.slice(2), addedAt: 1, ...overrides,
});
const wardrobeEntry = (id: string, name: string, category: string, subcategory: string, slot: string, wear: string) => ({
  piece: { id, name, category, subcategory, color: "white", colorHex: "#FFFFFF", thumbnailUrl: `/photos/${id}.jpg` }, slot, wear,
});
const persistedItems = () => JSON.parse(sessionStorage.getItem("fai.tryon.fitting") ?? "[]") as FittingItem[];
const sceneItems = () => JSON.parse(screen.getByTestId("fitting-scene").getAttribute("data-pieces") ?? "[]") as { id: string; slot: string }[];

describe("provador virtual de lojas (RF18 + RF47)", () => {
  it("prova peças de duas marcas: o ambiente segue a última marca e a outra vira painel lateral", async () => {
    const { calls } = loggedAs(ME, {
      "GET /api/taxonomy": TAXONOMY, "GET /api/try-on": STATE, "GET /api/catalog/stores": STORES,
      // a loja escolhida lista o acervo inteiro da marca (paginado), não a busca ranqueada
      "GET /api/catalog/products": (url: URL) => {
        const brand = url.searchParams.get("brand");
        return { items: brand === "Levi's" ? [L501] : [AF1], page: 0, size: 48, total: 1, hasMore: false, brandKnown: true };
      },
      "POST /api/pieces/from-catalog": { id: "nova", name: "Air Force 1 '07" },
    });
    renderApp(<TryOnPage />);
    expect(await screen.findByRole("heading", { name: "Provador virtual" })).toBeTruthy();
    // a vitrine da loja abre só com a marca escolhida
    fireEvent.click(await screen.findByRole("button", { name: /Levi's/ }));
    await waitFor(() => expect(calls.some((c) => c.path.startsWith("/api/catalog/products") && c.path.includes("brand=Levi"))).toBe(true), { timeout: 4000 });
    expect(calls.some((c) => c.path.startsWith("/api/catalog/search"))).toBe(false);
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
    const worn = within(screen.getByRole("heading", { name: "Provando agora" }).closest("section")!);
    fireEvent.click(worn.getAllByRole("button", { name: "Black" })[0]);
    expect(await screen.findByText(/Air Force 1 '07 — Black|501 Original — Black/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Já tenho esta peça" })[0]);
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/pieces/from-catalog")).toBe(true), { timeout: 4000 });
    expect(screen.getAllByRole("link", { name: /Ver em/ }).length).toBeGreaterThan(0);
  });

  it("tamanho em um toque: a peça veste o avatar no tamanho escolhido, que vira o padrão das próximas peças", async () => {
    loggedAs(ME, {
      "GET /api/taxonomy": TAXONOMY, "GET /api/try-on": { ...STATE, avatar: { id: "a1", model: {} } }, "GET /api/catalog/stores": STORES,
      "GET /api/catalog/products": (url: URL) => ({ items: url.searchParams.get("brand") === "Levi's" ? [L501] : [AF1], page: 0, size: 48, total: 1, hasMore: false }),
    });
    renderApp(<TryOnPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Levi's/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Provar" }, { timeout: 4000 }));
    const sizes = await screen.findByRole("radiogroup", { name: "Tamanho de 501 Original" });
    // sem escolha: a peça veste no tamanho do corpo do avatar (corpo padrão feminino → 40), sem formulário
    const mine = within(sizes).getByRole("radio", { name: /tamanho do seu avatar/ });
    expect(mine.textContent).toMatch(/^40/); expect(mine.getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByRole("textbox", { name: /cintura|quadril|medida/i })).toBeNull();
    fireEvent.click(within(sizes).getByRole("radio", { name: /^44/ }));
    expect(within(sizes).getByRole("radio", { name: /^44/ }).getAttribute("aria-checked")).toBe("true");
    expect(within(sizes.parentElement!).getByRole("status").textContent).toBe("Bem folgado — seu avatar veste 40");
    expect(JSON.parse(screen.getByTestId("fitting-scene").getAttribute("data-sizes") ?? "{}")).toEqual({ "c:p2": "44" });
    expect(JSON.parse(localStorage.getItem("fai.tryon.sizes") ?? "{}")).toEqual({ numeric: "44" });
    // a sessão guarda o tamanho junto da peça
    expect(JSON.parse(sessionStorage.getItem("fai.tryon.fitting") ?? "[]")[0]).toMatchObject({ key: "c:p2", size: "44" });
    // calçado: outra grade (numeração), começa no tamanho do avatar
    fireEvent.click(screen.getByRole("button", { name: /Nike/ }));
    await waitFor(() => expect(screen.getByText("Air Force 1 '07")).toBeTruthy(), { timeout: 4000 });
    fireEvent.click(screen.getByRole("button", { name: "Provar" }));
    const shoes = await screen.findByRole("radiogroup", { name: "Tamanho de Air Force 1 '07" });
    expect(within(shoes).getByRole("radio", { name: /tamanho do seu avatar/ }).textContent).toMatch(/^37/);
  });

  it("guarda-roupa vazio não bloqueia: o provador abre nas lojas e salva provas", async () => {
    loggedAs(ME, {
      "GET /api/taxonomy": TAXONOMY, "GET /api/try-on": STATE, "GET /api/catalog/stores": STORES,
      "GET /api/catalog/products": { items: [AF1], total: 1, page: 0, size: 48, hasMore: false },
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

  it("revalida uma sessão antiga e guarda a parte inferior coberta até remover a peça única", async () => {
    sessionStorage.setItem("fai.tryon.fitting", JSON.stringify([
      fitted("w:obsolete", { category: "unclassified", name: "Categoria antiga" }),
      fitted("w:jeans", { slot: "upper_piece", wear: "TOP", category: "lower_piece", subcategory: "jeans", name: "Jeans guardado" }),
      fitted("w:dress", { slot: "accessory_piece", wear: "ACCESSORY", category: "full_body_piece", subcategory: "dress", name: "Vestido floral" }),
    ]));
    loggedAs(ME, { ...baseRoutes(), "GET /api/try-on": { ...STATE, avatar: { id: "a1", model: {} } } });
    renderApp(<TryOnPage />);
    expect(await screen.findByText("Vestido floral")).toBeTruthy();
    expect(screen.queryByText("Categoria antiga")).toBeNull();
    expect(screen.getByText("Coberta por Vestido floral")).toBeTruthy();
    expect(sceneItems()).toEqual([{ id: "w:dress", slot: "dress" }]);

    fireEvent.click(screen.getByRole("button", { name: "Remover Vestido floral de Parte de cima" }));
    await waitFor(() => expect(sceneItems()).toEqual([{ id: "w:jeans", slot: "lower" }]));
    expect(persistedItems()).toEqual([expect.objectContaining({ key: "w:jeans", slot: "lower_piece", wear: "BOTTOM" })]);
    expect(screen.queryByText(/Coberta por Vestido floral/)).toBeNull();
  });

  it("prioriza o link compartilhado sobre a sessão, restaura a variante e ignora referências indisponíveis", async () => {
    sessionStorage.setItem("fai.tryon.fitting", JSON.stringify([fitted("w:session", { name: "Sessão anterior" })]));
    nav.search = new URLSearchParams({ provar: "c.p1.p1-k,w.w1,c.gone.-,w.not-owned" });
    const { calls } = loggedAs(ME, {
      ...baseRoutes(),
      "GET /api/try-on": { ...STATE, pieces: { ...STATE.pieces, upper_piece: [wardrobeEntry("w1", "Minha camisa", "upper_piece", "t_shirt", "upper_piece", "TOP")] } },
      "GET /api/catalog/products/p1": AF1,
      "GET /api/catalog/products/gone": new Response(JSON.stringify({ code: "NAO_ENCONTRADO", message: "Produto removido" }), { status: 404 }),
    });
    renderApp(<TryOnPage />);
    expect(await screen.findByText("Air Force 1 '07 — Black")).toBeTruthy();
    expect(screen.getByText("Minha camisa — Branco")).toBeTruthy();
    expect(screen.queryByText("Sessão anterior")).toBeNull();
    expect(persistedItems().map(({ key, variantId }) => ({ key, variantId }))).toEqual([
      { key: "c:p1", variantId: "p1-k" }, { key: "w:w1", variantId: undefined },
    ]);
    expect(calls.filter((c) => c.path.startsWith("/api/catalog/products/")).map((c) => c.path)).toEqual([
      "/api/catalog/products/p1", "/api/catalog/products/gone",
    ]);
  });

  it("abre um esquema usando apenas as peças disponíveis no guarda-roupa e persiste a prova reconstruída", async () => {
    sessionStorage.setItem("fai.tryon.fitting", JSON.stringify([fitted("w:session", { name: "Sessão anterior" })]));
    nav.search = new URLSearchParams({ scheme: "s1" });
    const { calls } = loggedAs(ME, {
      ...baseRoutes(),
      "GET /api/try-on": { ...STATE, pieces: {
        ...STATE.pieces,
        upper_piece: [wardrobeEntry("coat", "Casaco do esquema", "upper_piece", "coat", "upper_piece", "OUTERWEAR")],
        lower_piece: [wardrobeEntry("jeans", "Jeans do esquema", "lower_piece", "jeans", "lower_piece", "BOTTOM")],
      } },
      "GET /api/schemes/s1": { scheme: { items: [{ wardrobeItemId: "coat" }, { wardrobeItemId: "deleted" }, { wardrobeItemId: "jeans" }] } },
    });
    renderApp(<TryOnPage />);
    expect(await screen.findByText("Casaco do esquema — Branco")).toBeTruthy();
    expect(screen.getByText("Jeans do esquema — Branco")).toBeTruthy();
    expect(screen.queryByText("Sessão anterior")).toBeNull();
    expect(persistedItems().map(({ key, wear }) => ({ key, wear }))).toEqual([
      { key: "w:coat", wear: "OUTERWEAR" }, { key: "w:jeans", wear: "BOTTOM" },
    ]);
    expect(calls.some((c) => c.method === "GET" && c.path === "/api/schemes/s1")).toBe(true);
  });

  it("restaura e apaga provas locais sem alterar as demais provas salvas", async () => {
    const archived = fitted("w:archived", { name: "Camisa arquivada", addedAt: 7 });
    localStorage.setItem("fai.tryon.saved", JSON.stringify([
      { id: "saved-1", title: "Prova arquivada", items: [archived], createdAt: 7 },
      { id: "saved-2", title: "Outra prova", items: [fitted("w:other")], createdAt: 8 },
    ]));
    sessionStorage.setItem("fai.tryon.fitting", JSON.stringify([fitted("w:current", { name: "Peça atual" })]));
    loggedAs(ME, baseRoutes());
    renderApp(<TryOnPage />);
    fireEvent.click(await screen.findByRole("radio", { name: /Provas salvas/ }));
    const card = screen.getByText("Prova arquivada").closest("li")!;
    fireEvent.click(within(card).getByRole("button", { name: "Provar de novo" }));
    expect(await screen.findByText("Camisa arquivada")).toBeTruthy();
    expect(screen.queryByText("Peça atual")).toBeNull();
    expect(persistedItems()[0]).toMatchObject({ key: "w:archived", name: "Camisa arquivada" });
    expect(persistedItems()[0].addedAt).toBeGreaterThan(7);

    fireEvent.click(screen.getByRole("button", { name: "Apagar a prova Prova arquivada" }));
    expect(screen.queryByText("Prova arquivada")).toBeNull();
    expect(JSON.parse(localStorage.getItem("fai.tryon.saved") ?? "[]")).toEqual([
      expect.objectContaining({ id: "saved-2", title: "Outra prova" }),
    ]);
    // Deleting an archive does not undress the restored items.
    expect(screen.getByText("Camisa arquivada")).toBeTruthy();
  });

  it("mantém apresentação e iluminação sem reintroduzir vistas ou espelho e sem escrever na API", async () => {
    const { calls } = loggedAs(ME, { ...baseRoutes(), "GET /api/try-on": { ...STATE, avatar: { id: "a1", model: {} } } });
    renderApp(<TryOnPage />);
    // o manequim segue o sexo do avatar; o seletor "Tipo de look" não existe mais no provador
    expect((await screen.findByTestId("fitting-scene")).getAttribute("data-sex")).toBe("FEMININO");
    expect(screen.queryByRole("radio", { name: "Feminino" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "Masculino" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "Unisex" })).toBeNull();
    expect(screen.queryByText("Tipo de look")).toBeNull();
    expect(screen.queryByRole("radio", { name: "Costas" })).toBeNull();
    expect(screen.queryByRole("link", { name: /espelho/i })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Noite" }));
    expect(screen.getByTestId("fitting-scene").getAttribute("data-view")).toBe("front");
    expect(screen.getByTestId("fitting-scene").getAttribute("data-light")).toBe("night");
    expect(calls.filter((c) => c.path.startsWith("/api/") && c.method !== "GET")).toEqual([]);
  });

  it("permite tentar novamente uma inclusão com erro e guarda a referência retornada usando a variante escolhida", async () => {
    let attempts = 0;
    nav.search = new URLSearchParams({ provar: "c.p1.p1-k" });
    const { calls } = loggedAs(ME, {
      ...baseRoutes(), "GET /api/catalog/products/p1": AF1,
      "POST /api/pieces/from-catalog": () => ++attempts === 1
        ? new Response(JSON.stringify({ code: "CATALOGO_INDISPONIVEL", message: "Produto temporariamente indisponível" }), { status: 422, headers: { "content-type": "application/json" } })
        : { id: "owned-123", name: AF1.productName },
    });
    renderApp(<TryOnPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Já tenho esta peça" }));
    expect(await screen.findByText("Produto temporariamente indisponível")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Já tenho esta peça" });
    expect((retry as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(retry);
    expect((await screen.findByRole("link", { name: "No seu guarda-roupa" })).getAttribute("href")).toBe("/pieces/owned-123");
    expect(calls.filter((c) => c.method === "POST" && c.path === "/api/pieces/from-catalog").map((c) => c.body)).toEqual([
      { productId: "p1", variantId: "p1-k", visibility: "PRIVATE" },
      { productId: "p1", variantId: "p1-k", visibility: "PRIVATE" },
    ]);
    await waitFor(() => expect(calls.filter((c) => c.method === "GET" && c.path === "/api/try-on").length).toBe(2));
  });

  it("só esvazia a sessão após confirmar a limpeza e conserva as provas salvas", async () => {
    sessionStorage.setItem("fai.tryon.fitting", JSON.stringify([fitted("w:shirt")]));
    const saved = [{ id: "saved-1", title: "Minha prova", items: [fitted("w:shirt")], createdAt: 1 }];
    localStorage.setItem("fai.tryon.saved", JSON.stringify(saved));
    loggedAs(ME, baseRoutes());
    renderApp(<TryOnPage />);
    const clear = await screen.findByRole("button", { name: "Limpar" });
    await screen.findByText("Camiseta básica");
    fireEvent.click(clear);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Camiseta básica")).toBeTruthy();
    expect(persistedItems()).toHaveLength(1);
    fireEvent.click(clear);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Limpar" }));
    expect(screen.queryByText("Camiseta básica")).toBeNull();
    expect(persistedItems()).toEqual([]);
    expect(JSON.parse(localStorage.getItem("fai.tryon.saved") ?? "[]")).toEqual(saved);
    expect((screen.getByRole("button", { name: "Salvar prova" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("mostra o catálogo abaixo da prévia com duas linhas, navega até o fim e prova a variante sem trocar de página", async () => {
    const { calls } = loggedAs(ME, {
      ...baseRoutes(),
      "GET /api/try-on": { ...STATE, avatar: { id: "a1", model: {} } },
      "GET /api/catalog/products": (url: URL) => ({
        intent: { brand: url.searchParams.get("brand"), brandKnown: true, keywords: [] },
        items: SHIRTS, total: SHIRTS.length, page: 0, size: 48, hasMore: false,
      }),
    });
    renderApp(<TryOnPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Nike/ }));
    const results = await screen.findByRole("list", { name: "Resultados do catálogo" }, { timeout: 4000 });
    const catalog = results.closest(".fitting-catalog");
    const preview = document.querySelector(".fitting-preview")!;
    const browser = document.querySelector("aside.fitting-browser")!;
    expect(catalog).toBeTruthy();
    expect(browser.contains(results)).toBe(false);
    expect(preview.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(results).getAllByRole("listitem")).toHaveLength(4);
    const pagination = screen.getByRole("navigation", { name: "paginação" });
    expect((within(pagination).getByRole("button", { name: "← Voltar" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(pagination).getByText("Página 1 de 3 · 10 resultados")).toBeTruthy();

    fireEvent.click(within(pagination).getByRole("button", { name: "Avançar →" }));
    const secondPage = screen.getByRole("list", { name: "Resultados do catálogo" });
    expect(within(secondPage).getAllByRole("listitem")).toHaveLength(4);
    const fifth = within(secondPage).getByRole("heading", { name: "Camiseta Nike 5" }).closest("article")!;
    fireEvent.click(within(fifth).getByRole("button", { name: "Black" }));
    fireEvent.click(within(fifth).getByRole("button", { name: "Provar" }));
    expect(screen.getByText("Camiseta Nike 5 — Black")).toBeTruthy();
    expect(sceneItems()).toEqual([{ id: "c:shirt-5", slot: "upper" }]);
    expect(screen.getByText("Página 2 de 3 · 10 resultados")).toBeTruthy();
    expect(persistedItems()[0].variantId).toBe("shirt-5-k");

    fireEvent.click(within(pagination).getByRole("button", { name: "Avançar →" }));
    expect(within(screen.getByRole("list", { name: "Resultados do catálogo" })).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Página 3 de 3 · 10 resultados")).toBeTruthy();
    expect((within(pagination).getByRole("button", { name: "Avançar →" }) as HTMLButtonElement).disabled).toBe(true);
    expect(sceneItems()).toEqual([{ id: "c:shirt-5", slot: "upper" }]);
    fireEvent.click(within(pagination).getByRole("button", { name: "← Voltar" }));
    const revisited = within(screen.getByRole("list", { name: "Resultados do catálogo" })).getByRole("heading", { name: "Camiseta Nike 5" }).closest("article")!;
    expect(within(revisited).getByRole("button", { name: "Black" }).getAttribute("aria-pressed")).toBe("true");
    // Client-side page changes must not repeat the catalog request or alter the current outfit.
    expect(calls.filter((call) => call.path.startsWith("/api/catalog/products") && call.path.includes("brand=Nike"))).toHaveLength(1);
  });

  it("Limpar seleção ao lado do resumo (peças · loja · categoria): desmarca a loja e a categoria do provador", async () => {
    loggedAs(ME, {
      ...baseRoutes(),
      "GET /api/catalog/products": (url: URL) => {
        const items = url.searchParams.get("brand") === "Nike" ? SHIRTS : [];
        return { items, total: items.length, page: 0, size: 48, hasMore: false };
      },
    });
    renderApp(<TryOnPage />);
    const stores = within(await screen.findByRole("group", { name: "Lojas em destaque" }));
    fireEvent.click(stores.getByRole("button", { name: /Nike/ }));
    fireEvent.click(within(screen.getByRole("group", { name: "O que provar" })).getByRole("button", { name: "Parte superior" }));
    expect(await screen.findByRole("heading", { name: /peças · Nike · Parte superior/ }, { timeout: 4000 })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: /Nike · Parte superior/ })).toBeNull(), { timeout: 4000 });
    expect(stores.getByRole("button", { name: /Nike/ }).getAttribute("aria-pressed")).not.toBe("true");
    expect(within(screen.getByRole("group", { name: "O que provar" })).getByRole("button", { name: "Tudo" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Limpar seleção" })).toBeNull();
  });

  it("volta à primeira página ao filtrar o catálogo, trocar categoria ou escolher outra marca", async () => {
    loggedAs(ME, {
      ...baseRoutes(),
      "GET /api/catalog/products": (url: URL) => {
        const brand = url.searchParams.get("brand") ?? "Nike";
        const items = (brand === "Levi's" ? [{ ...L501, gender: "FEMININO" }] : SHIRTS).filter(p => !url.searchParams.get("gender") || p.gender === url.searchParams.get("gender"));
        return { items, total: items.length, page: 0, size: 48, hasMore: false };
      },
    });
    renderApp(<TryOnPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Nike/ }));
    await screen.findByRole("list", { name: "Resultados do catálogo" }, { timeout: 4000 });
    fireEvent.click(screen.getByRole("button", { name: "Avançar →" }));
    expect(screen.getByText("Página 2 de 3 · 10 resultados")).toBeTruthy();
    fireEvent.click(within(screen.getByLabelText("Filtros rápidos")).getByRole("button", { name: "Feminino" }));
    expect(await screen.findByText("Página 1 de 2 · 5 resultados")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Resultados do catálogo" })).getByText("Camiseta Nike 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Avançar →" }));
    expect(screen.getByText("Página 2 de 2 · 5 resultados")).toBeTruthy();

    fireEvent.click(within(screen.getByRole("group", { name: "O que provar" })).getByRole("button", { name: "Parte superior" }));
    await waitFor(() => expect(screen.getByText("Página 1 de 2 · 5 resultados")).toBeTruthy(), { timeout: 4000 });
    fireEvent.click(screen.getByRole("button", { name: "Avançar →" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Lojas em destaque" })).getByRole("button", { name: /Levi's/ }));
    expect(await screen.findByRole("heading", { name: "501 Original" }, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Camiseta Nike 9" })).toBeNull();
    expect(within(screen.getByRole("list", { name: "Resultados do catálogo" })).getAllByRole("listitem")).toHaveLength(1);
    const previous = screen.queryByRole("button", { name: "← Voltar" }) as HTMLButtonElement | null;
    expect(previous === null || previous.disabled).toBe(true);
  });

  it("o filtro rápido de gênero do catálogo usa o código real, preserva os demais filtros e continua visível para desmarcar", async () => {
    const { calls } = loggedAs(ME, {
      ...baseRoutes(),
      "GET /api/catalog/products": (url: URL) => {
        const items = SHIRTS.filter(p => !url.searchParams.get("gender") || p.gender === url.searchParams.get("gender"));
        return { items, total: items.length, page: Number(url.searchParams.get("page") ?? 0), size: 48, hasMore: false };
      },
    });
    renderApp(<TryOnPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Nike/ }));
    fireEvent.click(within(screen.getByRole("group", { name: "O que provar" })).getByRole("button", { name: "Parte superior" }));
    fireEvent.change(screen.getByLabelText(/Como ela se chama/), { target: { value: "camisa" } });
    await screen.findByRole("list", { name: "Resultados do catálogo" }, { timeout: 4000 });
    const quick = () => within(screen.getByLabelText("Filtros rápidos"));
    // cada filtro refaz a busca: o bloco de filtros rápidos é remontado quando os resultados chegam
    const quickButton = async (name: string) => { await waitFor(() => expect(quick().getByRole("button", { name })).toBeTruthy(), { timeout: 4000 }); return quick().getByRole("button", { name }); };
    fireEvent.click(await quickButton("Preto"));
    fireEvent.click(await quickButton("Feminino"));
    const lastBrowse = () => new URL(calls.filter(c => c.path.startsWith("/api/catalog/products?")).at(-1)!.path, "http://local.test").searchParams;
    await waitFor(() => expect(lastBrowse().get("gender")).toBe("FEMININO"), { timeout: 4000 });
    expect(Object.fromEntries(lastBrowse())).toMatchObject({ brand: "Nike", category: "upper_piece", q: "camisa", color: "black", page: "0" });
    // a página filtrada só tem peças femininas: o chip escolhido continua lá (aria-pressed) para ser desmarcado
    await waitFor(() => expect(quick().getByRole("button", { name: "Feminino" }).getAttribute("aria-pressed")).toBe("true"), { timeout: 4000 });
    fireEvent.click(await quickButton("Feminino"));
    await waitFor(() => expect(lastBrowse().has("gender")).toBe(false), { timeout: 4000 });
    expect(Object.fromEntries(lastBrowse())).toMatchObject({ brand: "Nike", category: "upper_piece", q: "camisa", color: "black" });
    fireEvent.click(await quickButton("Masculino"));
    await waitFor(() => expect(lastBrowse().get("gender")).toBe("MASCULINO"), { timeout: 4000 });
    expect(calls.filter(c => c.method !== "GET")).toEqual([]);
  });
});
