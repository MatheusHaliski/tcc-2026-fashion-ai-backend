// @vitest-environment jsdom
/**
 * Lote A3 — Explorador em HypeScore v2 (P1-04 e P2-04 no front): Buscar marcas & lojas (Hype da marca com faixa em texto e
 * base, "—"/"Dados insuficientes" sem base, sem estrelas, `minLevel` no lugar de `hypeMin`), Insights globais (Hype atual,
 * Crescimento e Volume separados; só o bloco `hype` é Hype) e a lista de países do Painel global (Hype v2 do globo,
 * nunca o v1 nem 0).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import { tokenStore } from "@/lib/api/client";
import ExplorerPage from "@/app/(site)/(app)/explorer/page";
import type { HypeGlobe, HypeGlobeCountry } from "@/lib/hype/types";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, onchange: null, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }));
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  router.replace.mockClear();
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  nav.search = new URLSearchParams(); nav.pathname = "/";
  tokenStore.clear(); document.cookie = "fai_rt_h=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

const TAXONOMY = { subcategories: { upper_piece: ["t_shirt"], shoes_piece: ["casual_sneakers"] }, colors: {}, materials: [], sizes: [], sexes: [], occasions: [], styles: [], allowedOccasionsByCategory: {}, brands: [] };
const COMMON = { "GET /api/insights": { context: "X", items: [] }, "GET /api/taxonomy": TAXONOMY };
const brandCalls = (calls: { path: string }[]) => calls.filter((c) => c.path.startsWith("/api/explorer/brands"));
const lastBrands = (calls: { path: string }[]) => new URL(brandCalls(calls).at(-1)!.path, "http://x").searchParams;

const BRANDS = {
  brands: [
    { userId: "b1", slug: "maison", name: "Maison Selo", country: "FR", category: "upper_piece", schemes: 6, pieces: 12, hypeScore: 72, stars: null,
      hype: { value: 72.4, level: "HOT", items: 5, basis: "BONDED_LOOKS", sufficient: true, minItems: 3 } },
    { userId: "b2", slug: "rua", name: "Rua Grupo", country: "BR", category: "shoes_piece", schemes: 1, pieces: 7, hypeScore: 41, stars: null,
      hype: { value: 41, level: "RELEVANT", items: 7, basis: "BRAND_GROUP", sufficient: true, minItems: 3 } },
    { userId: "b3", slug: "nova", name: "Nova Sem Base", country: "BR", schemes: 0, pieces: 1, hypeScore: null, stars: null,
      hype: { value: null, level: null, items: 1, basis: null, sufficient: false, minItems: 3 } },
    // marca de catálogo vinda de uma API sem o campo `hype` (antes do lote 1): também "—", nunca o 0 do v1
    { slug: "catalogo", name: "Só Catálogo", catalog: true, catalogProducts: 40, pieces: 40, schemes: 0, hypeScore: 0, stars: 1 },
  ],
  countries: ["BR", "FR"], categories: ["shoes_piece", "upper_piece"], seasons: ["spring", "summer", "autumn", "winter"],
  levels: ["LOW_SIGNAL", "NICHE", "RELEVANT", "HOT", "TRENDING", "VIRAL"], minItems: 3, algorithmVersion: "HYPE_V2",
};

describe("Explorador › Buscar marcas & lojas em v2", () => {
  beforeEach(() => { nav.pathname = "/explorer"; nav.search = new URLSearchParams("tab=brands"); });

  it("Hype da marca com faixa em texto e base; sem base = “—” e Dados insuficientes; nenhuma estrela", async () => {
    const { calls } = mockApi({ ...COMMON, "GET /api/explorer/brands": BRANDS });
    const { container } = renderApp(<ExplorerPage />);
    await screen.findByText("Maison Selo");
    expect(container.textContent).not.toMatch(/★|☆/);
    expect(screen.queryByLabelText(/de 5 estrelas/)).toBeNull();

    const card = (name: string) => screen.getByText(name).closest(".explorer-brand") as HTMLElement;
    const selo = card("Maison Selo");
    expect(selo.querySelector(".explorer-brand-hype b")!.textContent).toBe("72");
    expect(within(selo).getByText("Em alta").className).toContain("hype-level-chip");
    expect(within(selo).getByText("pelos looks com selo · 5 itens públicos")).toBeTruthy();
    expect(within(selo).getByText("12 peças públicas · 6 looks com selo")).toBeTruthy();

    const grupo = card("Rua Grupo");
    expect(within(grupo).getByText("Relevante")).toBeTruthy();
    expect(within(grupo).getByText("pelas peças da marca · 7 itens públicos")).toBeTruthy();

    for (const name of ["Nova Sem Base", "Só Catálogo"]) {
      const c = card(name);
      expect(c.querySelector(".explorer-brand-hype")!.getAttribute("data-hype")).toBe("none");
      expect(c.querySelector(".explorer-brand-hype b")!.textContent).toBe("—");
      expect(within(c).getByText("Dados insuficientes")).toBeTruthy();
      expect(c.querySelector(".explorer-brand-hype")!.textContent).not.toMatch(/\b0\b/);
    }
    // catálogo: os produtos ficam no selo do catálogo (não viram "peças públicas")
    expect(card("Só Catálogo").textContent).not.toMatch(/\d+ peças públicas/);
    expect(screen.getByText(/Sem base suficiente aparece “—”/)).toBeTruthy();

    // a primeira busca ordena por Hype e não manda mais o hypeMin numérico
    expect(Object.fromEntries(lastBrands(calls))).toEqual({ sort: "HYPE" });
  });

  it("nível mínimo de Hype vai como minLevel (faixa v2), nunca hypeMin", async () => {
    const { calls } = mockApi({ ...COMMON, "GET /api/explorer/brands": BRANDS });
    renderApp(<ExplorerPage />);
    await screen.findByText("Maison Selo");
    fireEvent.click(screen.getByRole("button", { name: /Nível mínimo de Hype/ }));
    const list = await screen.findByRole("listbox", { name: "Nível mínimo de Hype" });
    expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual(["Nível de Hype", "Sinal baixo ou acima", "Nicho ou acima", "Relevante ou acima", "Em alta ou acima", "Tendência ou acima", "Viral ou acima"]);
    fireEvent.click(within(list).getByRole("option", { name: "Em alta ou acima" }));
    await waitFor(() => expect(lastBrands(calls).get("minLevel")).toBe("HOT"));
    expect(lastBrands(calls).has("hypeMin")).toBe(false);
  });
});

const ROW = (label: string, value: number, level: string | null, items: number, hex?: string) => ({ label, value, level, items, ...(hex ? { hex } : {}) });
const INSIGHTS = {
  aiInsight: "Calçados crescem; preto segue no topo.", fallbackUsed: false, note: "Cores de status nunca viram identidade de série.",
  rankings: {
    topBrands: [{ label: "Nike", value: 9 }, { label: "Lacoste", value: 4 }],
    // chaves de antes, agora v2 (a tela lê o bloco `hype`)
    hypeBySeason: [ROW("SUMMER", 58, "RELEVANT", 4)], hypeByColor: [ROW("black", 62, "HOT", 12, "#12100F")], hypeByBrand: [ROW("Nike", 71, "HOT", 6)],
    topColors: [{ label: "black", value: 14, hex: "#12100F" }], topCountries: [{ label: "BR", value: 21 }, { label: "FR", value: 3 }],
  },
  hype: {
    algorithmVersion: "HYPE_V2", minItems: 3,
    byCategory: [ROW("shoes_piece", 66.6, "HOT", 9), ROW("upper_piece", 39.4, "NICHE", 15)],
    byColor: [ROW("black", 62, "HOT", 12, "#12100F")],
    byBrand: [ROW("Nike", 71, "HOT", 6)],
    bySeason: [],
    growthByCategory: [ROW("shoes_piece", 64.2, null, 9), ROW("upper_piece", 50.2, null, 15), ROW("lower_piece", 37.5, null, 4)],
  },
};

describe("Explorador › Insights globais em v2", () => {
  beforeEach(() => { nav.pathname = "/explorer"; nav.search = new URLSearchParams("tab=insights"); });

  it("Hype atual (faixa + itens), Crescimento (50 = estável) e Volume em blocos separados", async () => {
    mockApi({ ...COMMON, "GET /api/explorer/insights": INSIGHTS });
    renderApp(<ExplorerPage />);
    await screen.findByText("Calçados crescem; preto segue no topo.");
    const hype = screen.getByRole("region", { name: "Hype atual" });
    const growth = screen.getByRole("region", { name: "Crescimento" });
    const volume = screen.getByRole("region", { name: "Volume" });

    const byCategory = within(hype).getByRole("list", { name: "Hype por categoria" });
    const shoes = within(byCategory).getAllByRole("listitem")[0];
    expect(shoes.textContent).toContain("67");
    expect(within(shoes).getByText("Em alta").className).toContain("hype-level-chip");
    expect(shoes.textContent).toContain("9 itens");
    expect(within(within(hype).getByRole("list", { name: "Hype por cor" })).getByText("Em alta")).toBeTruthy();
    // grupo sem base: Dados insuficientes (nunca 0)
    expect(within(hype).getByText(/Hype por estação/).closest("[data-ranking]")!.textContent).toContain("Dados insuficientes: nenhum grupo com pelo menos 3 itens públicos com Hype.");

    const rows = within(within(growth).getByRole("list", { name: "Crescimento por categoria" })).getAllByRole("listitem");
    expect(rows.map((r) => r.getAttribute("data-direction"))).toEqual(["up", "flat", "down"]);
    expect(rows[0].textContent).toContain("64");
    expect(within(rows[0]).getByText("↑ acima do estável")).toBeTruthy();
    expect(within(rows[1]).getByText("→ estável")).toBeTruthy();
    expect(within(rows[2]).getByText("↓ abaixo do estável")).toBeTruthy();
    expect(growth.querySelector(".hype-level-chip")).toBeNull();   // crescimento não é faixa de Hype

    const brands = within(volume).getByRole("list", { name: "Marcas mais usadas (peças)" });
    expect(within(brands).getAllByRole("listitem").map((r) => r.textContent)).toEqual([expect.stringContaining("9"), expect.stringContaining("4")]);
    expect(within(volume).getByRole("list", { name: "Países com mais looks públicos" }).textContent).toContain("Brasil");
    expect(volume.querySelector(".hype-level-chip")).toBeNull();   // volume não é Hype
  });

  it("sem o bloco `hype` (API antiga), os rankings v1 não aparecem como Hype: Dados insuficientes", async () => {
    mockApi({ ...COMMON, "GET /api/explorer/insights": { ...INSIGHTS, hype: undefined, rankings: { ...INSIGHTS.rankings, hypeByColor: [{ label: "black", value: 88 }] } } });
    renderApp(<ExplorerPage />);
    const hype = await screen.findByRole("region", { name: "Hype atual" });
    expect(within(hype).getAllByText(/Dados insuficientes/)).toHaveLength(4);
    expect(hype.textContent).not.toContain("88");
    expect(within(screen.getByRole("region", { name: "Volume" })).getByRole("list", { name: "Cores mais usadas" })).toBeTruthy();
  });
});

const country = (iso: string, over: Partial<HypeGlobeCountry> = {}): HypeGlobeCountry => ({
  country: iso, region: "X", regionLabel: "X", count: 5, creators: 2, avgHype: 50, maxHype: 80, avgLevel: "RELEVANT", maxLevel: "TRENDING", trend: 40, rising: 1,
  levels: { RELEVANT: 3, TRENDING: 2 }, topLevel: "TRENDING", dominantColorHex: "#1f4f7a", topCategory: "shoes_piece", top: null, sufficient: true, ...over,
});
const GLOBE: HypeGlobe = {
  type: "PIECE", window: 7, algorithmVersion: "HYPE_V2", filters: {}, minItems: 3, world: { count: 20, avgHype: 55, maxHype: 91, creators: 8 }, regions: [],
  countries: [country("BR", { count: 14, avgHype: 52.3, maxHype: 91, avgLevel: "RELEVANT", maxLevel: "VIRAL" }), country("AR", { count: 2, avgHype: 30, avgLevel: "NICHE", sufficient: false })],
};
const V1 = { countries: [
  { country: "BR", total: 9, schemes: 4, pieces: 5, avg_hype: 61, dominantColorHex: "#12100F", sufficient: true },
  { country: "AR", total: 4, schemes: 1, pieces: 3, avg_hype: 40, dominantColorHex: "#F0E4CB", sufficient: true },
  { country: "CL", total: 3, schemes: 1, pieces: 2, avg_hype: 0, dominantColorHex: null, sufficient: true },
], minData: 3, facets: { seasons: ["SUMMER"], hypeBands: ["MUITO_ESTILOSO"], colors: [] }, legend: "Um ponto por país" };

describe("Explorador › Painel global: lista de países com o Hype v2 do globo", () => {
  beforeEach(() => { nav.pathname = "/explorer"; nav.search = new URLSearchParams("tab=map"); });

  it("volume do painel + Hype v2 (médio ou máximo) com a faixa em texto; sem v2 = “Hype —”, nunca o v1 nem 0", async () => {
    mockApi({ ...COMMON, "GET /api/explorer/global": (url: URL) => ({ ...V1, selected: url.searchParams.get("country") ? { country: url.searchParams.get("country"), looksBySeason: [{ season: "SUMMER", total: 3 }, { season: "WINTER", total: 5 }], topColors: [] } : undefined }), "GET /api/hype/globe": GLOBE });
    const { container } = renderApp(<ExplorerPage />);
    const list = await screen.findByRole("list", { name: /Países: volume do painel e Hype v2/ });
    const row = (iso: string) => list.querySelector(`[data-country="${iso}"]`) as HTMLElement;
    await waitFor(() => expect(row("BR").textContent).toContain("Hype médio 52"));
    expect(within(row("BR")).getByText("Relevante").className).toContain("hype-level-chip");
    expect(row("BR").textContent).toContain("4 looks · 5 peças");
    expect(row("BR").textContent).not.toContain("61");   // o avg_hype v1 saiu
    expect(row("AR").textContent).toContain("Hype médio 30");
    expect(row("AR").textContent).toContain("poucos dados");   // poucos itens com Hype v2 no país
    expect(row("CL").textContent).toContain("Hype —");
    expect(row("CL").textContent).not.toMatch(/Hype\D*0\b/);
    // a faixa v1 de juízo ("Muito estiloso"…) saiu do painel; o nível mínimo v2 fica na barra do globo
    expect(container.textContent).not.toMatch(/Muito estiloso|Arrasando|Ícone de estilo/i);
    expect(screen.queryByRole("button", { name: /faixa de hype/i })).toBeNull();
    expect(container.querySelector("svg defs")!.textContent).toBe("");   // nenhum "0" solto no desenho

    // métrica "Hype máximo": a lista acompanha o globo
    fireEvent.click(screen.getByRole("button", { name: /^Métrica/ }));
    fireEvent.click(within(await screen.findByRole("listbox", { name: "Métrica" })).getByRole("option", { name: "Hype máximo" }));
    await waitFor(() => expect(row("BR").textContent).toContain("Hype máximo 91"));
    expect(within(row("BR")).getByText("Viral")).toBeTruthy();

    // país selecionado: estações por volume (looks), sem o Hype v1 por estação
    fireEvent.click(row("BR"));
    await screen.findByText("Looks públicos por estação");
    const seasons = screen.getByText("Looks públicos por estação").nextElementSibling as HTMLElement;
    expect(within(seasons).getAllByRole("listitem").map((li) => li.textContent)).toEqual([expect.stringMatching(/5$/), expect.stringMatching(/3$/)]);
    expect(seasons.textContent).not.toMatch(/77|90/);
  });
});
