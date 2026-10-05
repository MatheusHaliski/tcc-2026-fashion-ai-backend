// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import { PIECE, SCHEME } from "@/test-utils/fixtures";
import { HypeRankingPanel, rankingFiltersFrom, rankingQuery } from "@/components/hype/hype-ranking";
import ExplorerPage from "@/app/(site)/(app)/explorer/page";
import { __resetHypeStore } from "@/lib/hype/use-hype";

const HOT = { status: "AVAILABLE", score: 82, level: "TRENDING", direction: "UP", deltaPercent: 12 };
const ranking = (over: Record<string, unknown> = {}) => ({ type: "PIECE", window: 7, algorithmVersion: "HYPE_V2", total: 1, page: 0, size: 24, hasMore: false,
  filters: {}, items: [{ rank: 1, id: "p1", value: 82, hype: HOT, region: "AMERICA_DO_SUL", regionLabel: "América do Sul", country: "BR", piece: PIECE }], ...over });
const FACETS = { type: "PIECE", window: 7, total: 50, world: { count: 50, avgHype: 64.2 },
  regions: [{ key: "AMERICA_DO_SUL", label: "América do Sul", count: 42, avgHype: 71.6 }, { key: "EUROPA", label: "Europa", count: 2, avgHype: 80 }],
  countries: [{ key: "BR", count: 30 }, { key: "AR", count: 12 }],
  categories: [{ key: "upper_piece", count: 20 }, { key: "shoes_piece", count: 9 }],
  subcategories: [{ key: "heels", category: "shoes_piece", count: 4 }, { key: "casual_sneakers", category: "shoes_piece", count: 5 }, { key: "t_shirt", category: "upper_piece", count: 8 }] };
const INSIGHTS = { "GET /api/insights": { context: "EXPLORER_RANKING", items: [] } };
const NO_FACETS = { type: "PIECE", window: 7, regions: [], countries: [], categories: [], subcategories: [] };
const rankingCalls = (api: ReturnType<typeof mockApi>) => api.calls.filter((c) => c.path.startsWith("/api/hype/ranking?"));
const lastQuery = (api: ReturnType<typeof mockApi>) => new URL(rankingCalls(api).at(-1)!.path, "http://x").searchParams;

beforeEach(() => { __resetHypeStore(); router.replace.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); nav.search = new URLSearchParams(); nav.pathname = "/"; });

describe("Ranking de HypeScore › filtros e URL", () => {
  it("lê os filtros da URL e monta a consulta (look vai como LOOK; país e subcategoria dependem de região e categoria)", () => {
    const f = rankingFiltersFrom(new URLSearchParams("type=look&window=30&region=europa&country=fr&category=SHOES_PIECE&subcategory=heels"));
    expect(f).toMatchObject({ type: "SCHEME", window: "30", region: "EUROPA", country: "FR", category: "shoes_piece", subcategory: "heels", page: 0 });
    expect(rankingQuery(f)).toBe("?type=LOOK&window=30&region=EUROPA&country=FR&category=shoes_piece&subcategory=heels&page=0&size=24");
    // sem região não há país; sem categoria não há subcategoria; janela inválida volta a 7
    expect(rankingFiltersFrom(new URLSearchParams("country=FR&subcategory=heels&window=9"))).toMatchObject({ type: "PIECE", window: "7", country: "", subcategory: "" });
  });

  it("abre com os filtros da URL, troca o tipo e a categoria e sincroniza a URL com router.replace", async () => {
    nav.pathname = "/explorer";
    nav.search = new URLSearchParams("tab=ranking&type=LOOK&window=30&region=EUROPA&country=FR&category=shoes_piece&subcategory=heels");
    const api = mockApi({ "GET /api/hype/ranking": ranking({ type: "SCHEME", items: [] }), "GET /api/hype/ranking/facets": FACETS, ...INSIGHTS });
    renderApp(<HypeRankingPanel />);
    await waitFor(() => expect(rankingCalls(api).length).toBeGreaterThan(0));
    let q = lastQuery(api);
    expect(Object.fromEntries(q)).toMatchObject({ type: "LOOK", window: "30", region: "EUROPA", country: "FR", category: "shoes_piece", subcategory: "heels", size: "24" });
    expect(api.calls.some((c) => c.path.startsWith("/api/hype/ranking/facets?") && c.path.includes("region=EUROPA") && c.path.includes("category=shoes_piece"))).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: "Peças" }));
    expect(router.replace).toHaveBeenLastCalledWith("/explorer?tab=ranking&window=30&region=EUROPA&country=FR&category=shoes_piece&subcategory=heels", { scroll: false });
    await waitFor(() => expect(lastQuery(api).get("type")).toBe("PIECE"));

    // trocar a categoria limpa a subcategoria (ela depende da categoria)
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Categoria" })).getByRole("radio", { name: /Parte superior/ }));
    expect(router.replace).toHaveBeenLastCalledWith("/explorer?tab=ranking&window=30&region=EUROPA&country=FR&category=upper_piece", { scroll: false });
    await waitFor(() => { q = lastQuery(api); expect(q.get("category")).toBe("upper_piece"); });
    expect(q.get("subcategory")).toBeNull();

    // "Limpar filtros" mantém o contexto (tipo e janela)
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(router.replace).toHaveBeenLastCalledWith("/explorer?tab=ranking&window=30", { scroll: false });
  });

  it("subcategoria depende da categoria e vem das contagens; país só aparece com uma região", async () => {
    nav.search = new URLSearchParams("category=shoes_piece");
    mockApi({ "GET /api/hype/ranking": ranking(), "GET /api/hype/ranking/facets": FACETS, ...INSIGHTS });
    renderApp(<HypeRankingPanel />);
    expect(screen.queryByRole("button", { name: /^País/ })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /^Subcategoria/ }));
    const list = await screen.findByRole("listbox", { name: "Subcategoria" });
    const options = within(list).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Todas as subcategorias", "Salto (4)", "Tênis casual (5)"]);   // a camiseta (outra categoria) não entra
    fireEvent.click(within(list).getByRole("option", { name: /Salto/ }));
    expect(router.replace).toHaveBeenLastCalledWith("/?category=shoes_piece&tab=ranking&subcategory=heels", { scroll: false });
  });
});

describe("Ranking de HypeScore › Hype por região", () => {
  it("mostra a média de cada região e a quantidade de itens em texto, e a linha filtra pela região", async () => {
    const api = mockApi({ "GET /api/hype/ranking": ranking(), "GET /api/hype/ranking/facets": FACETS, ...INSIGHTS });
    renderApp(<HypeRankingPanel />);
    const compare = await screen.findByRole("region", { name: "Hype por região" });
    const south = await within(compare).findByRole("button", { name: /América do Sul/ });
    expect(south.textContent).toContain("Hype médio 72 · 42 itens");
    // Europa (80) vem antes da América do Sul (72): ordem pela média, com aviso de poucos dados
    const rows = within(compare).getAllByRole("button");
    expect(rows[0].textContent).toContain("Europa");
    expect(rows[0].textContent).toContain("Hype médio 80 · 2 itens · poucos dados");
    expect(within(compare).getByText("Hype médio 64 · 50 itens")).toBeTruthy();   // a base: o mundo
    expect(south.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(south);
    expect(router.replace).toHaveBeenLastCalledWith("/?tab=ranking&region=AMERICA_DO_SUL", { scroll: false });
    await waitFor(() => expect(lastQuery(api).get("region")).toBe("AMERICA_DO_SUL"));
    expect(within(compare).getByRole("button", { name: /América do Sul/ }).getAttribute("aria-pressed")).toBe("true");
    // a região escolhida abre o filtro de país, com as contagens
    fireEvent.click(screen.getByRole("button", { name: /^País/ }));
    expect(within(await screen.findByRole("listbox", { name: "País" })).getAllByRole("option").map((o) => o.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("(30)"), expect.stringContaining("(12)")]));
  });

  it("o filtro de região lista Mundo e as regiões com a contagem", async () => {
    mockApi({ "GET /api/hype/ranking": ranking(), "GET /api/hype/ranking/facets": FACETS, ...INSIGHTS });
    renderApp(<HypeRankingPanel />);
    await screen.findByRole("region", { name: "Hype por região" });
    fireEvent.click(await screen.findByRole("button", { name: /^Região: Mundo \(50\)/ }));
    const options = within(await screen.findByRole("listbox", { name: "Região" })).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Mundo (50)", "América do Sul (42)", "Europa (2)"]);
  });

  it("sem regiões com dados: 'Sem dados suficientes'", async () => {
    mockApi({ "GET /api/hype/ranking": ranking(), "GET /api/hype/ranking/facets": NO_FACETS, ...INSIGHTS });
    renderApp(<HypeRankingPanel />);
    expect(await screen.findByText("Sem dados suficientes")).toBeTruthy();
  });
});

describe("Ranking de HypeScore › resultados", () => {
  it("peças: posição, região e país no card; o Hype vem do ranking (sem pedir de novo)", async () => {
    const api = mockApi({ "GET /api/hype/ranking": ranking(), "GET /api/hype/ranking/facets": FACETS, ...INSIGHTS });
    renderApp(<HypeRankingPanel />);
    expect(await screen.findByText("#1")).toBeTruthy();
    expect(screen.getByText("América do Sul · Brasil")).toBeTruthy();
    expect(screen.getByText("1 item neste recorte")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 20));
    expect(api.calls.some((c) => c.path.startsWith("/api/hype/summaries"))).toBe(false);
  });

  it("30 dias mostra a média do mês ao lado da posição", async () => {
    nav.search = new URLSearchParams("window=30");
    mockApi({ "GET /api/hype/ranking": ranking({ window: 30, items: [{ ...ranking().items[0], value: 71.6 }] }), "GET /api/hype/ranking/facets": FACETS, ...INSIGHTS });
    renderApp(<HypeRankingPanel />);
    expect(await screen.findByText("Média do mês 72")).toBeTruthy();
  });

  it("look: o Hype de cada peça dentro do look, sob demanda", async () => {
    nav.search = new URLSearchParams("type=LOOK");
    const look = { rank: 1, id: SCHEME.id, value: 82, hype: HOT, region: "EUROPA", regionLabel: "Europa", country: "FR", scheme: SCHEME,
      pieces: [{ id: "p1", name: "Camiseta branca lisa", category: "upper_piece", subcategory: "t_shirt", imageUrl: "/media/p1.png", hype: { status: "AVAILABLE", score: 90, level: "VIRAL" } },
        { id: "p2", name: "Calça jeans reta", category: "lower_piece", subcategory: "jeans", hype: { status: "INSUFFICIENT_DATA" } }] };
    const api = mockApi({ "GET /api/hype/ranking": ranking({ type: "SCHEME", items: [look] }), "GET /api/hype/ranking/facets": FACETS, ...INSIGHTS });
    renderApp(<HypeRankingPanel />);
    const toggle = await screen.findByRole("button", { name: /Peças do look \(2\)/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const list = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Camiseta branca lisa")).toBeTruthy();
    expect(within(items[0]).getByText("Hype 90, Viral")).toBeTruthy();
    expect(within(items[0]).getByText("Parte superior · Camiseta")).toBeTruthy();
    expect(within(items[1]).getByText("Hype: Dados insuficientes")).toBeTruthy();   // nunca 0
    expect(lastQuery(api).get("type")).toBe("LOOK");
  });

  it("paginação: a próxima página pede page=1 e não mexe na URL", async () => {
    const api = mockApi({ "GET /api/hype/ranking": (url: URL) => ranking({ total: 30, hasMore: url.searchParams.get("page") === "0", page: Number(url.searchParams.get("page")) }),
      "GET /api/hype/ranking/facets": FACETS, ...INSIGHTS });
    renderApp(<HypeRankingPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /Avançar/ }));
    await waitFor(() => expect(lastQuery(api).get("page")).toBe("1"));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("vazio: 'Nada neste recorte' com a dica de que só o público entra", async () => {
    mockApi({ "GET /api/hype/ranking": ranking({ total: 0, items: [] }), "GET /api/hype/ranking/facets": NO_FACETS, ...INSIGHTS });
    renderApp(<HypeRankingPanel />);
    expect(await screen.findByText("Nada neste recorte")).toBeTruthy();
    expect(screen.getByText(/itens privados nunca aparecem/)).toBeTruthy();
  });

  it("erro: estado de erro com tentar de novo", async () => {
    let fail = true;
    const api = mockApi({ "GET /api/hype/ranking": () => (fail ? new Response(JSON.stringify({ status: 500, code: "ERRO", message: "falhou" }), { status: 500, headers: { "content-type": "application/json" } }) : ranking()),
      "GET /api/hype/ranking/facets": FACETS, ...INSIGHTS });
    renderApp(<HypeRankingPanel />);
    const retry = await screen.findByRole("button", { name: "Tentar de novo" });
    fail = false;
    fireEvent.click(retry);
    expect(await screen.findByText("#1")).toBeTruthy();
    expect(rankingCalls(api).length).toBeGreaterThanOrEqual(2);
  });
});

describe("Explorador › ?tab=ranking", () => {
  it("abre a sub aba Ranking de HypeScore logo depois de Em alta", async () => {
    nav.search = new URLSearchParams("tab=ranking");
    const api = mockApi({ "GET /api/hype/ranking": ranking(), "GET /api/hype/ranking/facets": FACETS, ...INSIGHTS });
    renderApp(<ExplorerPage />);
    const tab = await screen.findByRole("tab", { name: "Ranking de HypeScore" });
    await waitFor(() => expect(tab.getAttribute("aria-selected")).toBe("true"));
    const names = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(names.indexOf("Ranking de HypeScore")).toBe(names.indexOf("Em alta") + 1);
    await waitFor(() => expect(rankingCalls(api).length).toBeGreaterThan(0));
  });
});
