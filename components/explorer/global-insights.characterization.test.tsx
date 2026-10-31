// @vitest-environment jsdom
/**
 * Caracterização (domínio 15) dos Insights globais do Explorador, escrita sobre a página original antes de extrair
 * `components/explorer/global-insights.tsx`: larguras das barras (Hype absoluto, Crescimento divergente a partir de 50,
 * Volume relativo ao maior), pontos de cor, nomes por tipo de grupo (país, estação, marca), descarte de valores não
 * finitos, rótulo do motor e nota. O DOM (classes, data-*, aria) tem de continuar idêntico depois da extração.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, mockApi, renderApp, screen, within } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import { tokenStore } from "@/lib/api/client";
import ExplorerPage from "@/app/(site)/(app)/explorer/page";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, onchange: null, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }));
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  nav.pathname = "/explorer"; nav.search = new URLSearchParams("tab=insights");
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  nav.search = new URLSearchParams(); nav.pathname = "/";
  tokenStore.clear();
});

const TAXONOMY = { subcategories: { upper_piece: ["t_shirt"] }, colors: {}, materials: [], sizes: [], sexes: [], occasions: [], styles: [], allowedOccasionsByCategory: {}, brands: [] };
const COMMON = { "GET /api/insights": { context: "X", items: [] }, "GET /api/taxonomy": TAXONOMY };
const ROW = (label: string, value: number | null, level: string | null, items: number | null, hex?: string) => ({ label, value, level, items, hex: hex ?? null });

const INSIGHTS = {
  aiInsight: "Leitura de teste.", fallbackUsed: true, note: "Nota do motor.",
  rankings: {
    topBrands: [{ label: "Nike", value: 8 }, { label: "Lacoste", value: 2 }, { label: "Sem número", value: "x" }],
    topColors: [], topCountries: [{ label: "BR", value: 21 }],
  },
  hype: {
    algorithmVersion: "HYPE_V2", minItems: 5,
    byCategory: [ROW("shoes_piece", 120, null, 9), ROW("upper_piece", -4, "LOW_SIGNAL", null), ROW("lower_piece", null, null, 2)],
    byColor: [ROW("black", 62, "HOT", 12, "#12100F")],
    byBrand: [ROW("Nike", 71, "HOT", 6)],
    bySeason: [ROW("SUMMER", 58, "RELEVANT", 4)],
    growthByCategory: [ROW("shoes_piece", 130, null, 3), ROW("upper_piece", 20, null, null), ROW("lower_piece", 49.6, null, 1)],
  },
};

const bar = (li: Element) => li.querySelector<HTMLElement>(".xp-row-bar > span")!;

describe("Explorador › Insights globais (caracterização da extração)", () => {
  it("cabeçalho: motor local quando fallbackUsed e nota do motor", async () => {
    mockApi({ ...COMMON, "GET /api/explorer/insights": INSIGHTS });
    renderApp(<ExplorerPage />);
    await screen.findByText("Leitura de teste.");
    expect(screen.getByText("Nota do motor.").className).toContain("text-faint");
    const head = screen.getByText("Leitura de teste.").closest(".card, [class*='card']") ?? screen.getByText("Leitura de teste.").parentElement!;
    expect(head.querySelector(".label")!.textContent).not.toBe("");
  });

  it("Hype atual: barra absoluta limitada a 0–100, faixa derivada do valor e grupos não finitos descartados", async () => {
    mockApi({ ...COMMON, "GET /api/explorer/insights": INSIGHTS });
    renderApp(<ExplorerPage />);
    const hype = await screen.findByRole("region", { name: "Hype atual" });
    const rows = within(within(hype).getByRole("list", { name: "Hype por categoria" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);                       // valor nulo saiu
    expect(bar(rows[0]).style.width).toBe("100%");      // 120 → 100
    expect(bar(rows[1]).style.width).toBe("0%");        // −4 → 0
    expect(rows[0].querySelector(".hype-level-chip")).not.toBeNull();   // faixa derivada de levelForScore
    expect(rows[0].querySelector(".xp-row-meta")!.textContent).toContain("9");
    expect(rows[1].querySelector(".xp-row-meta")!.textContent).toBe("");
    expect(hype.querySelector('[data-ranking="color"] .xp-dot')!.getAttribute("style")).toContain("background");
    expect(hype.querySelector('[data-ranking="brand"] .xp-row-name')!.textContent).toContain("Nike");
    expect(hype.querySelector('[data-ranking="season"] .xp-row-name')!.textContent).not.toBe("SUMMER");   // rótulo traduzido
    expect(hype.querySelector('[data-ranking="season"] .xp-row-name')!.textContent!.length).toBeGreaterThan(0);
    expect(hype.querySelectorAll("[data-ranking]")).toHaveLength(4);
  });

  it("Crescimento: barra divergente a partir de 50, número arredondado e direção pelo valor arredondado", async () => {
    mockApi({ ...COMMON, "GET /api/explorer/insights": INSIGHTS });
    renderApp(<ExplorerPage />);
    const growth = await screen.findByRole("region", { name: "Crescimento" });
    const rows = within(within(growth).getByRole("list", { name: "Crescimento por categoria" })).getAllByRole("listitem");
    expect(rows.map((r) => r.getAttribute("data-direction"))).toEqual(["up", "down", "flat"]);
    expect(rows.map((r) => r.querySelector(".xp-row-val b")!.textContent)).toEqual(["100", "20", "50"]);
    expect(bar(rows[0]).style.left).toBe("50%"); expect(bar(rows[0]).style.width).toBe("50%");
    expect(bar(rows[1]).style.left).toBe("20%"); expect(bar(rows[1]).style.width).toBe("30%");
    expect(rows[0].querySelector(".xp-row-bar")!.className).toContain("is-diverging");
    expect(rows[1].querySelector(".xp-row-meta")!.textContent).toBe("");
  });

  it("Volume: barra relativa ao maior, valor não numérico vira 0 e vazio mostra o aviso sem dados", async () => {
    mockApi({ ...COMMON, "GET /api/explorer/insights": INSIGHTS });
    renderApp(<ExplorerPage />);
    const volume = await screen.findByRole("region", { name: "Volume" });
    const brands = within(within(volume).getByRole("list", { name: "Marcas mais usadas (peças)" })).getAllByRole("listitem");
    expect(brands.map((r) => bar(r).style.width)).toEqual(["100%", "25%", "0%"]);
    expect(brands[2].querySelector(".xp-row-val b")!.textContent).toBe("0");
    expect(brands[0].className).toContain("is-volume");
    expect(volume.querySelector('[data-ranking="volume-color"] ul')).toBeNull();
    expect(volume.querySelector('[data-ranking="volume-color"] .type-caption')!.textContent!.length).toBeGreaterThan(0);
    expect(volume.querySelector('[data-ranking="volume-country"] .xp-row-name')!.textContent).toContain("Brasil");
  });

  it("sem rankings nem hype: os quatro cards de Hype com o mínimo padrão 3 e Volume vazio", async () => {
    mockApi({ ...COMMON, "GET /api/explorer/insights": { aiInsight: "Vazio.", rankings: undefined } });
    renderApp(<ExplorerPage />);
    const hype = await screen.findByRole("region", { name: "Hype atual" });
    expect([...hype.querySelectorAll("[data-ranking]")].map((c) => /pelo menos 3 itens/.test(c.textContent ?? ""))).toEqual([true, true, true, true]);
    expect(screen.getByRole("region", { name: "Volume" }).querySelectorAll("ul")).toHaveLength(0);
  });
});
