// @vitest-environment jsdom
/**
 * Busca catalogada (RF47) além do fluxo feliz: resumo do acervo, grade de marcas, ver todo o acervo, filtros rápidos de
 * cor e gênero, refinar por código, lojas oficiais, sugestões, Enter, erros e o card de resultado com variantes e motivos.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { ApiError } from "@/lib/api/client";
import { catalogApi, type CatalogProduct, type DesignTraits } from "@/lib/api/catalog";
import { CatalogResultCard, CatalogSearch, designLabels } from "./catalog-search";

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt"], lower_piece: ["jeans"], shoes_piece: ["casual_sneakers"], accessory_piece: ["watch"], full_body_piece: ["dress"] },
  colors: { white: "#FFFFFF", black: "#12100F" }, materials: [], sizes: [], sexes: [], occasions: [], styles: [], allowedOccasionsByCategory: {}, brands: [],
};
const IMG = { url: "https://media.example/p.jpg", mode: "PROCESSED" as const };
const prod = (id: string, over: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id, brand: { id: "b1", name: "Nike", slug: "nike", logoUrl: null }, productName: `Camiseta ${id}`, modelName: `Camiseta ${id}`, category: "upper_piece", subcategory: "t_shirt",
  color: "white", colorName: "Branca", colorHex: "#FFFFFF", gender: "MALE", catalogImage: IMG, imageUrl: IMG.url,
  source: { type: "MANUAL_ADMIN", domain: "nike.com", productUrl: null, status: "ACTIVE" }, ingestionStatus: "VALIDATED", ...over,
} as unknown as CatalogProduct);
const P1 = prod("p1");
const P2 = prod("p2", { color: "black", colorName: "Preta", gender: "FEMALE" });
const STORES = { stores: [
  { brandId: "b1", slug: "nike", name: "Nike", catalogProducts: 10, categories: ["upper_piece"], categoryCounts: { upper_piece: 7 } },
  { brandId: "b2", slug: "adidas", name: "Adidas", catalogProducts: 4, categories: ["shoes_piece"] },
] };
const SEARCH = (over: Record<string, unknown> = {}) => ({ intent: { brand: "Nike", brandKnown: true, category: null, subcategory: null, keywords: [], color: null }, results: [P1, P2], total: 2, enoughInput: true, canSearchOfficial: true, ...over });
const BROWSE = (over: Record<string, unknown> = {}) => ({ items: [P1, P2], total: 2, page: 0, size: 48, hasMore: false, brandKnown: true, canSearchOfficial: false, ...over });
const err = (status: number, message = "falhou") => () => new Response(JSON.stringify({ status, code: "X", message }), { status, headers: { "content-type": "application/json" } });

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("designLabels (características lidas do texto)", () => {
  const t = (k: string, v?: Record<string, unknown>) => (v ? `${k}:${JSON.stringify(v)}` : k);
  it("lista estampa, posição, tamanho, lados e cores com papel", () => {
    const d: DesignTraits = { pattern: "STRIPES", logoPlacement: "LEFT_CHEST", logoSize: "SMALL", sides: ["FRONT"], baseColors: ["Black"], printColors: ["White"], anyColors: ["red"] };
    expect(designLabels(d, t)).toEqual([
      "catalog.design.pattern.STRIPES", "catalog.design.placement.LEFT_CHEST", "catalog.design.size.SMALL", "catalog.design.sides.FRONT",
      'catalog.design.base_color:{"cor":"preto"}', 'catalog.design.print_color:{"cor":"branco"}', "Vermelho",
    ]);
  });
  it("logo em toda a peça não repete a posição; dois lados viram frente e verso; vazio não lista nada", () => {
    expect(designLabels({ pattern: "ALLOVER_LOGO", logoPlacement: "ALLOVER", sides: ["FRONT", "BACK"] }, t)).toEqual(["catalog.design.pattern.ALLOVER_LOGO", "catalog.design.sides.both"]);
    expect(designLabels({}, t)).toEqual([]);
  });
});

describe("CatalogResultCard", () => {
  it("mostra compatibilidade, loja oficial, descrição, motivos e escolhe a variante pela amostra", () => {
    const onPick = vi.fn(); const onVariant = vi.fn();
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    const p = prod("v", {
      matchPercent: 88, ingestionStatus: "DISCOVERED", description: "Algodão orgânico", modelName: "Modelo X",
      matchScore: { total: 0.9, brandMatch: 1, categoryMatch: 1, subcategoryMatch: 1, textSimilarity: 1, colorMatch: 1, reasons: [
        { facet: "pattern", value: "PLAIN", ok: true }, { facet: "placement", value: "BACK", ok: false }, { facet: "size", value: "LARGE", ok: true },
        { facet: "sides", value: "FRONT+BACK", ok: true }, { facet: "baseColor", value: "black", ok: false }, { facet: "printColor", value: "white", ok: true },
      ] },
      variants: [{ id: "a", key: "a", color: "white", colorName: "Branca" }, { id: "b", key: "b", color: "black" }, { id: "c", key: "chave-c" }],
      source: { type: "X", domain: "null" },
    } as Partial<CatalogProduct>);
    renderApp(<CatalogResultCard product={p} onPick={onPick} onVariantChange={onVariant} pickLabel="Provar" />);
    expect(screen.getByText("88% compatível")).toBeTruthy();
    expect(screen.getByText("Loja oficial")).toBeTruthy();
    expect(screen.getByText("Algodão orgânico")).toBeTruthy();
    expect(screen.getByText(/Modelo X/)).toBeTruthy();
    const reasons = within(screen.getByRole("list", { name: "Por que esta" })).getAllByRole("listitem");
    expect(reasons).toHaveLength(5);
    expect(reasons[0].textContent).toContain("Lisa");
    expect(reasons[1].className).toContain("is-miss");
    expect(reasons[3].textContent).toContain("Frente e verso");
    expect(screen.getByText("Fonte: Catálogo FashionAI")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "black" }));
    expect(onVariant).toHaveBeenCalledWith(expect.objectContaining({ id: "b" }));
    expect(screen.getByRole("button", { name: "chave-c" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Provar" }));
    // o card entrega a variante, o produto mostrado e como prepará-lo (enquadrar) antes de usar
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "b" }), expect.objectContaining({ id: "v" }), expect.any(Function));
  });

  it("sem foto desenha a ilustração padrão sem pedir enquadramento; ocupada mostra 'verificando'; variante controlada", () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    const preview = vi.spyOn(catalogApi, "previewImage");
    const onPick = vi.fn();
    const p = prod("s", { catalogImage: null, imageUrl: null, imageProcessingStatus: "PENDING", colorName: "Azul", colorHex: "#00F", modelName: "Camiseta s", source: null } as Partial<CatalogProduct>);
    const { container } = renderApp(<CatalogResultCard product={p} onPick={onPick} busy selectedVariant={null} />);
    expect(screen.getByRole("img", { name: "Ilustração padrão FAI na cor da peça" })).toBeTruthy();
    expect(container.querySelector("article")!.getAttribute("aria-busy")).toBe("false");
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).toBeNull();
    expect(preview).not.toHaveBeenCalled();
    expect(screen.getByText("Azul")).toBeTruthy();
    expect(screen.getByText("Fonte: Catálogo FashionAI")).toBeTruthy();
    const pick = screen.getByRole("button", { name: /Verificando e enquadrando foto/ });
    expect(pick.getAttribute("aria-busy")).toBe("true");
  });

  it("falha no enquadramento cai na ilustração e permite tentar de novo", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    const preview = vi.spyOn(catalogApi, "previewImage").mockRejectedValue(new ApiError(422, "CATEGORY_FRAME_UNAVAILABLE", "x"));
    const p = prod("f-unsup", { catalogImage: { url: "https://b.example/x.jpg", mode: "SEMANTIC_CROP" } } as Partial<CatalogProduct>);
    renderApp(<CatalogResultCard product={p} onPick={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }, { timeout: 4000 }));
    expect(screen.getByRole("img", { name: "Ilustração padrão FAI na cor da peça" })).toBeTruthy();
    await waitFor(() => expect(preview).toHaveBeenCalledTimes(2));
  });

  it("falha da fonte e falha do serviço também oferecem tentar de novo sobre a ilustração", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    vi.spyOn(catalogApi, "previewImage").mockImplementation(async (id) => { throw id === "f-src" ? new ApiError(422, "CATALOG_IMAGE_FETCH_FAILED", "x") : new Error("caiu"); });
    renderApp(<>
      <CatalogResultCard product={prod("f-src", { catalogImage: null } as Partial<CatalogProduct>)} onPick={() => {}} />
      <CatalogResultCard product={prod("f-svc", { catalogImage: null } as Partial<CatalogProduct>)} onPick={() => {}} />
    </>);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Tentar de novo" })).toHaveLength(2), { timeout: 4000 });
    expect(screen.getAllByRole("img", { name: "Ilustração padrão FAI na cor da peça" })).toHaveLength(2);
    expect(Array.from(document.querySelectorAll("article")).map((a) => a.getAttribute("aria-busy"))).toEqual(["false", "false"]);
  });
});

describe("CatalogSearch › acervo, marcas e filtros", () => {
  it("resumo do acervo com fotos, sem marca e pendentes; 'ver todo o acervo' lista e 'fechar acervo' some", async () => {
    const { calls } = mockApi({
      "GET /api/taxonomy": TAXONOMY,
      "GET /api/catalog/summary": { products: 120, brands: 8, withImage: 100, unbrandedProducts: 5, registeredProducts: 130 },
      "GET /api/catalog/stores": STORES,
      "GET /api/catalog/products": BROWSE({ total: 120, hasMore: true }),
    });
    renderApp(<CatalogSearch onPick={() => {}} />);
    expect(await screen.findByText(/Acervo disponível: 120 peças de 8 marcas/)).toBeTruthy();
    expect(screen.getByText("· 100 com foto")).toBeTruthy();
    expect(screen.getByText("5 peças disponíveis sem marca; incluídas no acervo completo.")).toBeTruthy();
    expect(screen.getByText("130 peças registradas no banco; 10 ainda indisponíveis no catálogo.")).toBeTruthy();
    expect(await screen.findByText(/Marcas do catálogo \(2\)/)).toBeTruthy();
    expect(screen.getByText("Duas ou três informações já bastam para começar.")).toBeTruthy();
    fireEvent.click(screen.getByText("Ver todo o acervo"));
    expect(await screen.findByText("120 peças no acervo")).toBeTruthy();
    expect(screen.getByText("Mostrando 2 de 120")).toBeTruthy();
    expect(calls.some((c) => c.path.startsWith("/api/catalog/products?page=0"))).toBe(true);
    fireEvent.click(screen.getByText("Fechar acervo"));
    await waitFor(() => expect(screen.queryByText("120 peças no acervo")).toBeNull());
  });

  it("erros do resumo e das marcas oferecem tentar de novo; filtro de marca sem resultado avisa", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/summary": err(500), "GET /api/catalog/stores": err(500), "GET /api/catalog/brands": { brands: [] }, "GET /api/catalog/products": BROWSE({ items: [], total: 0 }), "GET /api/catalog/search": SEARCH({ results: [] }) });
    renderApp(<CatalogSearch onPick={() => {}} />);
    expect(await screen.findByText(/Não foi possível consultar o total do acervo/)).toBeTruthy();
    expect(await screen.findByText("Não foi possível carregar as marcas do catálogo.")).toBeTruthy();
    expect(screen.getAllByText("Tentar de novo").length).toBeGreaterThanOrEqual(2);
    cleanup();
    mockApi({ "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/summary": { products: 0, brands: 0 }, "GET /api/catalog/stores": STORES, "GET /api/catalog/brands": { brands: [] }, "GET /api/catalog/products": BROWSE({ items: [], total: 0 }), "GET /api/catalog/search": SEARCH({ results: [] }) });
    renderApp(<CatalogSearch onPick={() => {}} />);
    await screen.findByText(/Marcas do catálogo \(2\)/);
    fireEvent.change(screen.getByLabelText(/De qual marca/), { target: { value: "zzz" } });
    expect(await screen.findByText(/Nenhuma marca do catálogo com "zzz"/)).toBeTruthy();
  });

  it("escolher uma marca na grade lista o acervo dela; filtros rápidos de cor e gênero; limpar seleção", async () => {
    const onClearBrand = vi.fn();
    const { calls } = mockApi({
      "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/summary": { products: 2, brands: 1 }, "GET /api/catalog/stores": STORES, "GET /api/catalog/brands": { brands: [] },
      "GET /api/catalog/products": BROWSE(),
      "GET /api/catalog/search": SEARCH({ results: [P2] }),
    });
    renderApp(<CatalogSearch onPick={() => {}} onClearBrand={onClearBrand} browse />);
    fireEvent.click(await screen.findByRole("button", { name: /Nike/ }));
    expect(await screen.findByText("2 peças de Nike")).toBeTruthy();
    expect(calls.some((c) => c.path.includes("brandId=b1"))).toBe(true);
    const quick = screen.getByLabelText("Filtros rápidos");
    expect(within(quick).getByText("Gênero:")).toBeTruthy();
    fireEvent.click(within(quick).getAllByRole("button")[1]);   // segunda cor
    await waitFor(() => expect(calls.some((c) => c.path.startsWith("/api/catalog/search") && c.path.includes("color=black"))).toBe(true));
    expect(await screen.findByText(/Encontramos 1/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("catalog-clear-filters"));
    expect(onClearBrand).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId("catalog-clear-filters")).toBeNull());
  });

  it("busca por texto: sugestões, 'ver todas com', Enter, design entendido e marca desconhecida", async () => {
    const { calls } = mockApi({
      "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/summary": { products: 0, brands: 0 }, "GET /api/catalog/brands": { brands: [] },
      "GET /api/catalog/suggestions": { suggestions: ["camiseta polo", "Camiseta"] },
      "GET /api/catalog/search": SEARCH({ intent: { brand: "Zeta", brandKnown: false, keywords: [], design: { pattern: "PLAIN", source: "AI" } } }),
      "GET /api/catalog/products": BROWSE({ total: 9 }),
    });
    renderApp(<CatalogSearch onPick={() => {}} brandGrid={false} />);
    fireEvent.change(screen.getByLabelText(/De qual marca/), { target: { value: "Zeta" } });
    fireEvent.change(screen.getByLabelText(/Como ela se chama/), { target: { value: "camiseta" } });
    expect(await screen.findByText("camiseta polo", {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Camiseta" })).toBeNull();   // igual ao digitado não aparece
    expect(await screen.findByText("lido pela IA", {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText("Ainda não conhecemos essa marca no catálogo; a busca segue pelo nome.")).toBeTruthy();
    expect(screen.getByText("Estas são as mais parecidas.")).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText(/Como ela se chama/), { key: "Enter" });
    await waitFor(() => expect(calls.filter((c) => c.path.startsWith("/api/catalog/search")).length).toBeGreaterThanOrEqual(2));
    fireEvent.click(screen.getByText("Ver todas as peças com “camiseta”"));
    expect(await screen.findByText("9 peças com “camiseta”")).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText(/Como ela se chama/), { key: "Enter" });
    fireEvent.click(screen.getByText("camiseta polo"));
    expect((screen.getByLabelText(/Como ela se chama/) as HTMLInputElement).value).toBe("camiseta polo");
  });

  it("refinar por código, lojas oficiais com resultados e com erro; usar minha foto leva o contexto", async () => {
    const onUsePhoto = vi.fn();
    let discoverFails = false;
    const { calls } = mockApi({
      "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/summary": { products: 0, brands: 0 }, "GET /api/catalog/brands": { brands: [] },
      "GET /api/catalog/search": SEARCH({ results: [], message: "Nada por aqui." }),
      "GET /api/catalog/products": BROWSE({ items: [], total: 0, canSearchOfficial: true }),
      "POST /api/catalog/discover": () => discoverFails ? err(503, "Lojas fora do ar")() : { results: [prod("d1", { productName: "Oficial 1" })], status: "FOUND", message: "Achamos 1 peça oficial" },
    });
    renderApp(<CatalogSearch onPick={() => {}} brandGrid={false} onUsePhoto={onUsePhoto} initial={{ category: "upper_piece" }} />);
    fireEvent.change(screen.getByLabelText(/De qual marca/), { target: { value: "Nike" } });
    const official = await screen.findByText("Pesquisar em lojas oficiais", {}, { timeout: 3000 });
    fireEvent.click(screen.getByText("Não encontrei minha peça"));
    expect(screen.getByLabelText("Código ou SKU")).toBeTruthy();
    fireEvent.click(official);
    expect(await screen.findByText("Achamos 1 peça oficial")).toBeTruthy();
    expect(screen.getByText("Oficial 1")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/catalog/discover")!.body).toMatchObject({ brand: "Nike", category: "upper_piece" });
    fireEvent.click(screen.getByText("Adicionar com minha foto"));
    expect(onUsePhoto).toHaveBeenCalledWith({ category: "upper_piece", subcategory: "", brand: "Nike", query: "" });
    fireEvent.click(screen.getByText("Usar minha foto"));
    expect(onUsePhoto).toHaveBeenCalledTimes(2);
    // novo texto: volta a oferecer as lojas; agora a busca oficial falha
    discoverFails = true;
    fireEvent.change(screen.getByLabelText("Código ou SKU"), { target: { value: "SKU-1" } });
    fireEvent.click(await screen.findByText("Pesquisar em lojas oficiais", {}, { timeout: 3000 }));
    expect(await screen.findByText("Lojas fora do ar")).toBeTruthy();
  });

  it("acervo antigo sem rota (404) cai para a busca ranqueada; na matriz avisa que o acervo está indisponível", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/summary": { products: 0, brands: 0 }, "GET /api/catalog/brands": { brands: [] },
      "GET /api/catalog/products": err(404), "GET /api/catalog/search": SEARCH() });
    renderApp(<CatalogSearch onPick={() => {}} brandGrid={false} initial={{ brand: "Nike" }} />);
    expect(await screen.findByText(/Encontramos 2/, {}, { timeout: 3000 })).toBeTruthy();
    cleanup();
    mockApi({ "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/summary": { products: 0, brands: 0 }, "GET /api/catalog/brands": { brands: [] }, "GET /api/catalog/products": err(404) });
    renderApp(<CatalogSearch onPick={() => {}} brandGrid={false} resultsLayout="matrix" />);
    expect(await screen.findByText(/O servidor não disponibilizou o acervo paginado/, {}, { timeout: 3000 })).toBeTruthy();
  });

  it("erro do acervo mostra a mensagem do servidor; erro ao escolher mostra a falha", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/summary": { products: 0, brands: 0 }, "GET /api/catalog/brands": { brands: [] }, "GET /api/catalog/products": err(500, "Banco indisponível") });
    renderApp(<CatalogSearch onPick={() => {}} brandGrid={false} initial={{ brand: "Nike" }} />);
    expect(await screen.findByText("Banco indisponível", {}, { timeout: 3000 })).toBeTruthy();
    cleanup();
    mockApi({ "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/summary": { products: 0, brands: 0 }, "GET /api/catalog/brands": { brands: [] }, "GET /api/catalog/products": BROWSE() });
    vi.spyOn(catalogApi, "previewImage").mockImplementation(async (id) => (id === P1.id ? P1 : P2));
    const onPick = vi.fn().mockRejectedValue(new Error("Foto recusada"));
    const onResults = vi.fn();
    renderApp(<CatalogSearch onPick={onPick} brandGrid={false} resultsLayout="matrix" onResults={onResults} />);
    expect(await screen.findByText("Peças nesta seleção: 2", {}, { timeout: 3000 })).toBeTruthy();
    await waitFor(() => expect(onResults).toHaveBeenCalledWith(expect.objectContaining({ brand: "" }), [P1, P2]));
    fireEvent.click(screen.getAllByRole("button", { name: "Selecionar" })[0]);
    expect(await screen.findByText("Foto recusada")).toBeTruthy();
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: P1.id, productName: P1.productName }), null);
  });

  it("resultados em outro lugar: sem alvo nada é desenhado; categoria controlada não repete os cards", async () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/summary": { products: 0, brands: 0 }, "GET /api/catalog/brands": { brands: [] }, "GET /api/catalog/products": BROWSE() });
    const onClearCategory = vi.fn(); const onContext = vi.fn();
    renderApp(<CatalogSearch onPick={() => {}} brandGrid={false} category="shoes_piece" resultsMount={{ target: null }} onClearCategory={onClearCategory} onContext={onContext} />);
    expect(screen.queryByText("1. Qual é a categoria?")).toBeNull();
    expect((screen.getByLabelText(/Como ela se chama/) as HTMLInputElement).placeholder).toBe("Ex.: Air Force 1 '07");
    fireEvent.click(await screen.findByRole("button", { name: "Tênis casual" }));
    expect(onContext).toHaveBeenCalledWith({ subcategory: "casual_sneakers" });
    await waitFor(() => expect(screen.getByTestId("catalog-clear-filters")).toBeTruthy());
    expect(screen.queryByRole("list", { name: /resultados/i })).toBeNull();
    fireEvent.click(screen.getByTestId("catalog-clear-filters"));
    expect(onClearCategory).toHaveBeenCalled();
    expect(onContext).toHaveBeenLastCalledWith({ subcategory: "" });
  });
});
