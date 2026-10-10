// @vitest-environment jsdom
/**
 * Lookbook em HypeScore v2 (docs/hype/HYPE_AUDITORIA_ABAS.md, Lote 4): o painel do Look do Dia mostra o v2 em todas as
 * versões (P2-13) com a faixa em texto e a análise completa ao lado; o histórico tem o HypeBadge v2 por dia (P1-06); a capa
 * da FAI Magazine é liberada pela faixa ≥ Tendência; o DNA "Hype Focus" usa o v2 sem "%" e sem 0 para "sem dados" (P2-12);
 * a aba Looks ordena por Hype (P3-02) e os agrupamentos sugeridos são de similaridade, com o Hype médio à parte (P3-04).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor, within } from "@/test-utils/render";
import { OWNER, SCHEME } from "@/test-utils/fixtures";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import { levelAtLeast, levelForScore } from "@/lib/hype/model";
import type { HypeSummary } from "@/lib/hype/types";
import type { UserCard } from "@/lib/api/types";
import { LookbookTabs } from "@/components/lookbook-tabs";
import { DnaCard, type DnaCellView, type DnaView } from "@/components/dna-card";

const BIA: UserCard = { ...OWNER, id: "u2", username: "bia", displayName: "Bia Lima" };
const overview = (self: boolean, extra: Record<string, unknown> = {}) => ({ owner: self ? OWNER : BIA, self, visible: true, institutional: false,
  tabs: [{ id: "closet", count: 0 }, { id: "looks", count: 1 }, { id: "publications", count: 0 }, { id: "favorites", count: 0 }, { id: "saved_looks", count: 0 }, { id: "saved_pieces", count: 0 }], ...extra });

/** /api/hype/summaries simulado: responde só os ids conhecidos (os demais = "não calculado", como o backend). */
const summaries = (known: Record<string, HypeSummary>) => (url: URL) => {
  const type = url.searchParams.get("type") ?? "PIECE";
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  return { type, algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: Object.fromEntries(ids.filter((id) => known[`${type}:${id}`]).map((id) => [id, known[`${type}:${id}`]])) };
};
const VERSIONS = ["SPOTLIGHT_CLASSICO", "PASSARELA", "RAIO_X_ESTILO", "BENTO_DIA", "EDITORIAL_MINIMAL", "COACH_ESTILO"].map((code) => ({ code, name: code }));
const V2: HypeSummary = { status: "AVAILABLE", score: 82.4, level: "TRENDING", direction: "UP", deltaPercent: 14, deltaPoints: 10, dimensions: { POPULARITY: 70, TREND: 88 }, calculatedAt: new Date().toISOString() };
/** Aba Look do Dia: painel com o v2 e, de propósito, campos v1 que NÃO podem aparecer (número 12, faixa "Arrasando no Look"). */
const dailyTab = (v2: HypeSummary | null, panelVersion = "SPOTLIGHT_CLASSICO", tip: string | null = null) => ({
  panelVersion, panelVersions: VERSIONS, today: { date: "2026-10-05", feedback: "ADOREI" }, scheme: SCHEME,
  panel: { hypeScore: 12, band: { code: "ARRASANDO_NO_LOOK", label: "Arrasando no Look" }, v2, tip, magazineCover: { unlocked: v2?.level === "TRENDING", minLevel: "TRENDING" } },
  history: [{ date: "2026-10-04", schemeId: "s2", title: "Look de quinta", feedback: "ADOREI", hypeScore: 33 }, { date: "2026-10-03", schemeId: "s3", title: "Look de quarta", feedback: null, hypeScore: 0 }],
});
const BASE = { "GET /api/insights": { context: "HISTORY", items: [] }, "GET /api/users/u1/lookbook": overview(true) };

beforeEach(() => { __resetHypeStore(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("faixa a partir do número (levelForScore)", () => {
  it("segue os limiares 20 · 40 · 60 · 75 · 90 sobre o número exibido; sem dados não vira faixa", () => {
    expect([0, 19.4, 19.6, 39, 40, 59, 60, 74.4, 74.6, 89.6, 100].map(levelForScore))
      .toEqual(["LOW_SIGNAL", "LOW_SIGNAL", "NICHE", "NICHE", "RELEVANT", "RELEVANT", "HOT", "HOT", "TRENDING", "VIRAL", "VIRAL"]);
    expect(levelForScore(null)).toBeNull();
    expect(levelForScore(undefined)).toBeNull();
    expect(levelAtLeast("VIRAL", "TRENDING")).toBe(true);
    expect(levelAtLeast("HOT", "TRENDING")).toBe(false);
    expect(levelAtLeast(null, "TRENDING")).toBe(false);
  });
});

describe("Lookbook › Look do Dia em v2", () => {
  it("a dica do painel (dimensão v2 mais fraca, P3-16) aparece; sem dica, nada é inventado", async () => {
    loggedAs(undefined, { ...BASE, "GET /api/me/daily-look-tab": dailyTab(V2, "SPOTLIGHT_CLASSICO", "Poucas conversas no look: publique com uma pergunta."),
      "GET /api/hype/summaries": summaries({}) });
    renderApp(<LookbookTabs ownerId="u1" initialTab="daily" />);
    await settle();
    expect(await screen.findByText(/Poucas conversas no look: publique com uma pergunta\./)).toBeTruthy();
    cleanup();
    loggedAs(undefined, { ...BASE, "GET /api/me/daily-look-tab": dailyTab(V2), "GET /api/hype/summaries": summaries({}) });
    const { container } = renderApp(<LookbookTabs ownerId="u1" initialTab="daily" />);
    await settle();
    expect(await screen.findByLabelText("Hype 82, Tendência")).toBeTruthy();
    expect(container.textContent).not.toContain("💡");
  });

  it("o painel mostra o HypeScore v2 com a faixa em texto, a análise completa e o histórico com o Hype de cada dia", async () => {
    const api = loggedAs(undefined, { ...BASE, "GET /api/me/daily-look-tab": dailyTab(V2),
      "GET /api/hype/summaries": summaries({ "SCHEME:s2": { status: "AVAILABLE", score: 64, level: "HOT" }, "SCHEME:s3": { status: "INSUFFICIENT_DATA", score: null } }) });
    const { container } = renderApp(<LookbookTabs ownerId="u1" initialTab="daily" />);
    await settle();
    // número do painel = v2 (82), faixa escrita; nada do v1 (12, "Arrasando no Look") nem "%" no número
    expect(await screen.findByLabelText("Hype 82, Tendência")).toBeTruthy();
    expect(container.querySelector(".hero-number")?.textContent).toBe("82");
    expect(container.querySelector(".lb-hype-line .hype-level-chip")?.textContent).toBe("Tendência");
    expect(container.textContent).not.toContain("Arrasando");
    expect(container.textContent).not.toContain("82%");
    expect(container.textContent).not.toMatch(/hype 12\b/i);
    expect(screen.getByText(/relevância atual no FashionAI, não qualidade de estilo/)).toBeTruthy();
    // análise completa do look ao lado do painel
    expect(screen.getAllByRole("button", { name: "Ver análise completa" }).length).toBeGreaterThan(0);
    // capa liberada pela faixa ≥ Tendência, com texto descritivo
    expect(screen.getByRole("button", { name: "Baixar capa FAI Magazine" })).toBeTruthy();
    expect(screen.getByText("HypeScore 82 · Tendência: a capa da FAI Magazine está liberada para este look.")).toBeTruthy();
    // histórico: HypeBadge v2 por dia (um lote só), "sem dados" nunca vira 0; o "· hype 33" do v1 sumiu
    expect(await screen.findByText("Hype 64, Em alta")).toBeTruthy();
    expect(await screen.findByText("Hype: Dados insuficientes")).toBeTruthy();
    expect(container.textContent).not.toContain("hype 33");
    const batch = api.calls.filter((c) => c.path.startsWith("/api/hype/summaries?type=SCHEME") && c.path.includes("s2"));
    expect(batch).toHaveLength(1);
    expect(batch[0].path).toContain("s3");
  });

  it("sem dados: \"Dados insuficientes\" no lugar do número e capa bloqueada com o motivo", async () => {
    loggedAs(undefined, { ...BASE, "GET /api/me/daily-look-tab": dailyTab({ status: "INSUFFICIENT_DATA", score: null, level: null }), "GET /api/hype/summaries": summaries({}) });
    const { container } = renderApp(<LookbookTabs ownerId="u1" initialTab="daily" />);
    await settle();
    expect(await screen.findByText(/a capa da FAI Magazine é liberada a partir da faixa Tendência/)).toBeTruthy();
    expect(container.querySelector(".hero-number")).toBeNull();
    expect(within(container.querySelector("[data-panel-version]") as HTMLElement).getByText("Dados insuficientes")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Baixar capa FAI Magazine" })).toBeNull();
  });

  it("abaixo de Tendência a capa fica bloqueada; a versão Raio-X abre as dimensões do v2", async () => {
    loggedAs(undefined, { ...BASE, "GET /api/me/daily-look-tab": dailyTab({ ...V2, score: 66, level: "HOT" }, "RAIO_X_ESTILO"), "GET /api/hype/summaries": summaries({}) });
    renderApp(<LookbookTabs ownerId="u1" initialTab="daily" />);
    await settle();
    expect(await screen.findByLabelText("Hype 66, Em alta")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Baixar capa FAI Magazine" })).toBeNull();
    expect(screen.getByText("A capa da FAI Magazine é liberada a partir da faixa Tendência do HypeScore (este look está em Em alta).")).toBeTruthy();
    expect(screen.getByText("Popularidade")).toBeTruthy();
    expect(screen.getByText("Trend")).toBeTruthy();
  });
});

describe("Lookbook › Looks e Agrupamentos", () => {
  it("a aba Looks ordena por Hype (ordenação, não aba); para quem visita, só o Hype público conta", async () => {
    const api = loggedAs(undefined, { "GET /api/users/u2/lookbook": overview(false), "GET /api/profiles/u2": { schemes: [{ ...SCHEME, owner: BIA }] }, "GET /api/hype/summaries": summaries({}) });
    renderApp(<LookbookTabs ownerId="u2" initialTab="looks" />);
    await settle();
    expect(await screen.findByText("Look de sexta")).toBeTruthy();
    expect(api.calls.some((c) => c.path === "/api/profiles/u2")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Ordenar looks: Recentes" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Recentes", "Maior Hype", "Em crescimento"]);
    fireEvent.click(screen.getByRole("option", { name: "Maior Hype" }));
    await waitFor(() => expect(api.calls.some((c) => c.path === "/api/profiles/u2?sort=hype_desc")).toBe(true));
    expect(screen.getByText("Só o Hype público entra na ordem; looks sem Hype ficam no fim.")).toBeTruthy();
  });

  it("agrupamentos sugeridos são de similaridade, com o Hype médio v2 à parte (sem base = \"—\")", async () => {
    const api = loggedAs(undefined, { "GET /api/users/u1/lookbook": overview(true, { groupingSuggestionsAvailable: true }), "GET /api/users/u1/groupings": [],
      "GET /api/me/similarity-groups": [{ id: "g1", label: "casual · trabalho", kind: "SIMILARITY", count: 3, hype: { avgScore: 70, level: "HOT", items: 2, members: 3 } },
        { id: "g2", label: "festa", kind: "SIMILARITY", count: 1, hype: { avgScore: null, level: null, items: 0, members: 1 } }] });
    const { container } = renderApp(<LookbookTabs ownerId="u1" initialTab="groups" />);
    await settle();
    expect(await screen.findByText("Agrupamentos sugeridos (similaridade)")).toBeTruthy();
    expect(container.textContent).not.toContain("HypeGroups");
    expect(await screen.findByText(/Hype médio 70 \(2 de 3 com Hype\)/)).toBeTruthy();
    expect(screen.getByText("Em alta")).toBeTruthy();
    expect(screen.getByText("Hype médio: —")).toBeTruthy();
    expect(api.calls.some((c) => c.path === "/api/me/similarity-groups?type=SCHEME")).toBe(true);
    expect(api.calls.some((c) => c.path.startsWith("/api/me/hype-groups"))).toBe(false);
  });
});

describe("DNA de estilo › Hype Focus em v2", () => {
  const cell = (id: string, title: string, hype: DnaCellView["hype"], v1: number): DnaCellView => ({ cell: id, schemeId: id, title, occasion: ["work"], style: ["basic"], milestone: false,
    dominantBrand: "Nike", hypeScoreGlobal: v1, hype, pieces: [{ id: `p-${id}`, name: "Peça", imageUrl: null }] });
  const dna: DnaView = { id: "d1", owner: OWNER, title: "Meu DNA", palette: ["#111111"], cardLayout: "HORIZONTAL", targetElement: "DNA_COMPLETO", narrativeType: "HYPE_FOCUS",
    visibility: "PUBLIC", status: "PUBLISHED", logos: [], counters: { likes: 0, comments: 0, shares: 0, remixes: 0 }, canEdit: true,
    // v1 invertido de propósito: o card tem de seguir o v2
    cells: [cell("c1", "Look de segunda", { status: "AVAILABLE", score: 64, level: "HOT" }, 99), cell("c2", "Look viral", { status: "AVAILABLE", score: 93.6, level: "VIRAL" }, 5),
      cell("c3", "Look novo", { status: "INSUFFICIENT_DATA", score: null, level: null }, 0)] };

  it("medidor e lista com score v2 e faixa escrita, sem \"%\"; sem dados por último e nunca 0", () => {
    const { container } = renderApp(<DnaCard dna={dna} />);
    const hype = container.querySelector(".dna-hype") as HTMLElement;
    expect(hype).toBeTruthy();
    expect(hype.querySelector(".dna-gauge b")?.textContent).toBe("🔥 94");
    expect(hype.querySelector(".dna-gauge em")?.textContent).toContain("Look viral");
    expect(hype.querySelector(".dna-hype-level")?.textContent).toBe("Viral");
    expect(hype.textContent).not.toContain("%");
    expect(hype.textContent).not.toContain("🔥 0");
    const rows = [...hype.querySelectorAll(".dna-hype-row")];
    expect(rows.map((r) => r.querySelector(".dna-row-txt b")?.textContent)).toEqual(["Look de segunda", "Look novo"]);
    expect(rows[0].textContent).toContain("🔥 64");
    expect(rows[0].textContent).toContain("Em alta");
    expect(rows[1].textContent).toContain("🔥 —");
    expect(within(rows[1] as HTMLElement).getByTitle("Dados insuficientes").textContent).toBe("sem dados");
    expect(rows[1].querySelector(".hype-bar")).toBeNull();
    expect(screen.getByText(/não é qualidade de estilo nem compatibilidade com o seu DNA/)).toBeTruthy();
  });

  it("sem nenhum Hype no DNA: o medidor diz o motivo em vez de mostrar 0", () => {
    const { container } = renderApp(<DnaCard dna={{ ...dna, cells: [cell("c9", "Look sem cálculo", { status: "NOT_CALCULATED", score: null, level: null }, 0)] }} />);
    expect(container.querySelector(".dna-gauge b")?.textContent).toBe("🔥 —");
    expect(container.querySelector(".dna-hype-level")?.textContent).toBe("Hype ainda não calculado");
  });
});
