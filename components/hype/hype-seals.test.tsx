// @vitest-environment jsdom
/**
 * RF53 — Selos × HypeScore: Selos de Hype FashionAI na frente dos cards (no máximo 2, com nome acessível), progresso dos
 * selos na análise completa, Hype das sugestões de selo, "Hype do selo" no perfil do emissor e o filtro "Com selo" do
 * guarda-roupa com os selos de marca/celebridade de cada peça (GET /api/pieces/seals, um pedido por página).
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, settle, waitFor, within } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import { PIECE, PIECE_2, SCHEME, page } from "@/test-utils/fixtures";
import { PieceCard } from "@/components/piece-card";
import { SchemeCard, type SealBadge } from "@/components/scheme-card";
import { EMPTY_PIECE, PieceSealSuggestions } from "@/components/piece-form";
import { HypeAnalyticsDrawer } from "./hype-analytics-drawer";
import { SealHypeStat, SealSuggestionHype, hypeSealBadges, withHypeSeals } from "./hype-seals";
import { HYPE_SEAL_DESIGN, HYPE_SEAL_ORDER, cardHypeSeals, orderHypeSeals } from "@/lib/hype/seals";
import { FAI_TEMPLATES } from "@/lib/seals/templates";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import type { HypeSummary } from "@/lib/hype/types";
import ClosetPage from "@/app/(site)/(app)/closet/page";

const AVAILABLE: HypeSummary = { status: "AVAILABLE", score: 92, level: "VIRAL", direction: "UP", deltaPercent: 20, momentum: "RISING", calculatedAt: new Date().toISOString(), algorithmVersion: "HYPE_V2" };
const summaries = (type: "PIECE" | "SCHEME", items: Record<string, HypeSummary>) => ({ type, algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items });
const brand = (name: string): SealBadge => ({ label: "LOOK", name, kind: "BRAND", design: { kind: "FASHIONAI", mode: "TEMPLATE", template: "fai/01" } });
const hypeMedals = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLElement>(".seal-medallion.is-hype"));

beforeEach(() => { __resetHypeStore(); router.replace.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); nav.search = new URLSearchParams(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("Selos de Hype — mapeamento e junção com os selos de marca", () => {
  it("cada código usa um medalhão Padrão FashionAI que existe no catálogo; ordem de prioridade e no máximo 2 no card", () => {
    const ids = new Set(FAI_TEMPLATES.map((t) => t.id));
    for (const code of HYPE_SEAL_ORDER) expect(ids.has(HYPE_SEAL_DESIGN[code].template)).toBe(true);
    expect(orderHypeSeals(["RARE", "VIRAL", "NOVO_CODIGO", "RARE", "CLASSIC"])).toEqual(["VIRAL", "CLASSIC", "RARE"]);
    expect(cardHypeSeals(["RARE", "EMERGING", "TRENDING"])).toEqual(["TRENDING", "EMERGING"]);
    expect(cardHypeSeals(null)).toEqual([]);
    expect(hypeSealBadges(["VIRAL"])[0]).toMatchObject({ kind: "HYPE", name: "Selo de Hype: Viral", label: "Viral", design: { kind: "FASHIONAI", template: HYPE_SEAL_DESIGN.VIRAL.template } });
  });

  it("marca primeiro; o Hype garante vaga no slot (2 sem marca, 1 quando o slot lota) e a lista original fica intacta sem Hype", () => {
    const own = [brand("A"), brand("B"), brand("C")];
    expect(withHypeSeals(own, [])).toBe(own);
    expect(withHypeSeals(undefined, ["VIRAL", "RARE"])!.map((s) => s.name)).toEqual(["Selo de Hype: Viral", "Selo de Hype: Raro"]);
    expect(withHypeSeals([brand("A")], ["VIRAL", "RARE"])!.map((s) => s.name)).toEqual(["A", "Selo de Hype: Viral", "Selo de Hype: Raro"]);
    // slot cheio: 2 de marca + 1 de Hype nos 3 primeiros; o resto continua na lista (contagem dos blocos)
    expect(withHypeSeals(own, ["VIRAL", "RARE"])!.map((s) => s.name)).toEqual(["A", "B", "Selo de Hype: Viral", "C"]);
  });
});

describe("frente dos cards", () => {
  it("peça: no máximo 2 Selos de Hype, por prioridade, com title e nome acessível \"Selo de Hype: …\" (sem pedido extra)", async () => {
    const api = mockApi({ "GET /api/hype/summaries": summaries("PIECE", { p1: { ...AVAILABLE, seals: ["RARE", "VIRAL", "TRENDING"] } }) });
    const { container } = renderApp(<PieceCard piece={PIECE} />);
    expect(await screen.findByTitle("Selo de Hype: Viral")).toBeTruthy();
    const front = container.querySelector(".fcard-face.is-front") as HTMLElement;
    expect(hypeMedals(front).map((m) => m.title)).toEqual(["Selo de Hype: Viral", "Selo de Hype: Tendência"]);
    expect(screen.queryByTitle("Selo de Hype: Raro")).toBeNull();
    // mesmo lugar do selo de marca (anatomia padrão: bloco "categoria · marca · selos"), layout do card intacto
    const slot = front.querySelector(".pc-sub .seal-slot") as HTMLElement;
    expect(slot.getAttribute("role")).toBe("img");
    expect(slot.getAttribute("aria-label")).toBe("selos: Selo de Hype: Viral, Selo de Hype: Tendência");
    expect(front.querySelector(".pc-hype-row .hype-badge")).toBeTruthy();
    expect(api.calls.filter((c) => c.path.startsWith("/api/hype"))).toHaveLength(1);   // só o resumo em lote de sempre
  });

  it("peça com selos de marca: marca primeiro e o Hype ainda aparece; sem Hype disponível, nenhum Selo de Hype", async () => {
    mockApi({ "GET /api/hype/summaries": summaries("PIECE", { p1: { ...AVAILABLE, seals: ["VIRAL", "CLASSIC"] }, p2: { status: "INSUFFICIENT_DATA", score: null, seals: ["VIRAL"] } }) });
    const { container } = renderApp(<><PieceCard piece={PIECE} seals={[brand("Nike Verde"), brand("Nike Azul"), brand("Nike Ouro")]} /><PieceCard piece={PIECE_2} /></>);
    expect(await screen.findByTitle("Selo de Hype: Viral")).toBeTruthy();
    const [first, second] = Array.from(container.querySelectorAll<HTMLElement>(".fcard-face.is-front"));
    expect(Array.from(first.querySelectorAll<HTMLElement>(".pc-sub .seal-medallion")).map((m) => m.title)).toEqual(["Nike Verde", "Nike Azul", "Selo de Hype: Viral"]);
    await waitFor(() => expect(second.querySelector(".hype-badge.is-empty")).toBeTruthy());
    expect(hypeMedals(second)).toHaveLength(0);
  });

  it("look: os Selos de Hype do look entram no espaço do selo (linha do título) e não viram selo de peça", async () => {
    mockApi({ "GET /api/hype/summaries": summaries("SCHEME", { s1: { ...AVAILABLE, level: "TRENDING", score: 80, seals: ["TRENDING", "EMERGING", "RARE"] } }) });
    const { container } = renderApp(<SchemeCard scheme={SCHEME} />);
    expect(await screen.findByTitle("Selo de Hype: Tendência")).toBeTruthy();
    const front = container.querySelector(".fcard-face.is-front") as HTMLElement;
    const slot = front.querySelector(".c-priceline .seal-slot") as HTMLElement;
    expect(slot.getAttribute("aria-label")).toBe("selos: Selo de Hype: Tendência, Selo de Hype: Emergente");
    expect(hypeMedals(front)).toHaveLength(2);
  });
});

describe("análise completa — Selos de Hype", () => {
  const DETAIL = { ...AVAILABLE, entityType: "PIECE", entityId: "p1", reasons: [], publicEligible: true, signals: {} };
  const routes = (detail: unknown) => ({ "GET /api/hype/pieces/p1": detail, "GET /api/hype/pieces/p1/history": { points: [] }, "GET /api/hype/pieces/p1/positions": { eligible: false, window: 7, positions: [] } });

  it("mostra os conquistados (✓) e as próximas metas com o critério", async () => {
    mockApi(routes({ ...DETAIL, sealProgress: [
      { code: "TRENDING", earned: true, criteria: "Em alta ou Tendência, em crescimento" },
      { code: "VIRAL", earned: false, criteria: "Nível Viral (≥ 90)" },
      { code: "RARE", earned: false, criteria: "Raridade ≥ 75" },
    ] }));
    renderApp(<HypeAnalyticsDrawer type="PIECE" id="p1" name="Tênis" open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: "Selos e metas" }));
    const section = (await screen.findByRole("heading", { name: "Selos de Hype" })).closest("section") as HTMLElement;
    expect(within(section).getByText("Conquistado (1)")).toBeTruthy();
    const earned = within(section).getByText("Tendência").closest("li") as HTMLElement;
    expect(earned.className).toContain("is-earned");
    expect(earned.textContent).toContain("Conquistado");
    expect(within(section).getByText("Próximas metas")).toBeTruthy();
    expect(within(section).getByText("Nível Viral (≥ 90)")).toBeTruthy();
    expect(within(section).getByTitle("Selo de Hype: Raro")).toBeTruthy();
  });

  it("sem sealProgress no detalhe, a seção não aparece", async () => {
    mockApi(routes(DETAIL));
    renderApp(<HypeAnalyticsDrawer type="PIECE" id="p1" name="Tênis" open onClose={() => {}} />);
    expect(await screen.findByText("Viral")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Selos de Hype" })).toBeNull();
  });
});

describe("sugestões de selo e Hype do selo", () => {
  it("a sugestão mostra o Hype da peça avaliada (número + faixa em texto) e mantém o \"atende:\"", async () => {
    mockApi({ "POST /api/seal-suggestions/preview-piece": { suggestions: [
      { targetOwnerId: "b1", kind: "BRAND", name: "Nike", confidence: 0.97, justification: "Atende à política do selo «Nike Hot»: peça com Hype ≥ Em alta.", hype: { score: 81.6, level: "TRENDING" } },
      { targetOwnerId: "b2", kind: "BRAND", name: "Adidas", confidence: 0.6, justification: "Marca da peça", hype: null },
    ] } });
    renderApp(<PieceSealSuggestions value={{ ...EMPTY_PIECE, brandName: "Nike" }} onChange={() => {}} />);
    const row = (await screen.findByRole("checkbox", { name: /Nike/ }, { timeout: 2000 }));
    expect(row.textContent).toContain("Atende à política do selo «Nike Hot»: peça com Hype ≥ Em alta.");
    expect(within(row).getByText("Hype 82 · Tendência")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /Adidas/ }).textContent).not.toContain("Hype");
  });

  it("SealSuggestionHype some sem score; SealHypeStat mostra média, faixa e vinculados (some sem média)", () => {
    const { container } = renderApp(<><SealSuggestionHype hype={{ score: null, level: null }} /><SealHypeStat hype={{ avgScore: 74.4, level: "HOT", bonded: 12 }} tier="LOOK" /><SealHypeStat hype={{ avgScore: 40, level: "RELEVANT", bonded: 1 }} tier="PECA" /><SealHypeStat hype={{ avgScore: null, level: null, bonded: 0 }} /></>);
    expect(container.querySelectorAll(".hype-seal-sugg")).toHaveLength(0);
    const stats = container.querySelectorAll(".seal-hype-stat");
    expect(stats).toHaveLength(2);
    expect(stats[0].textContent).toBe("Hype do selo74Em alta12 looks vinculados");
    expect(stats[1].textContent).toContain("1 peça vinculada");
  });
});

describe("guarda-roupa — \"Com selo\" e selos de marca nas peças", () => {
  const SEALS = { items: { p1: [{ tier: "PECA", owner: "nike", premium: false, name: "Nike Verde", design: { kind: "FASHIONAI", mode: "TEMPLATE", template: "fai/01" }, linkedPieceIds: ["p1"] }] } };
  const closetCalls = (calls: { method: string; path: string }[]) => calls.filter((c) => c.method === "GET" && c.path.startsWith("/api/me/closet"));

  it("busca os selos da página uma vez (ids da página), mostra o selo de marca e o de Hype nos cards", async () => {
    const api = loggedAs(undefined, {
      "GET /api/hype/summaries": summaries("PIECE", { p1: AVAILABLE, p2: { ...AVAILABLE, seals: ["VIRAL"] } }),
      "GET /api/me/closet": page([PIECE, PIECE_2]), "GET /api/pieces/seals": SEALS,
    });
    renderApp(<ClosetPage />);
    await settle();
    expect(await screen.findByTitle("Nike Verde · @nike · PECA")).toBeTruthy();
    expect(await screen.findByTitle("Selo de Hype: Viral")).toBeTruthy();
    const sealCalls = api.calls.filter((c) => c.path.startsWith("/api/pieces/seals"));
    expect(sealCalls).toHaveLength(1);
    expect(sealCalls[0].path).toBe("/api/pieces/seals?ids=p1,p2");
  });

  it("os chips Hype · Marca · Qualquer enviam seal= ao closet e vão para a URL junto da aba", async () => {
    nav.search = new URLSearchParams("category=lower_piece");
    const api = loggedAs(undefined, { "GET /api/hype/summaries": summaries("PIECE", {}), "GET /api/me/closet": page([PIECE_2]), "GET /api/pieces/seals": { items: {} } });
    renderApp(<ClosetPage />);
    await settle();
    const group = await screen.findByRole("group", { name: "Com selo" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["Hype", "Marca", "Qualquer"]);
    fireEvent.click(within(group).getByRole("button", { name: "Hype" }));
    await waitFor(() => expect(closetCalls(api.calls).some((c) => c.path.includes("seal=hype") && c.path.includes("category=lower_piece"))).toBe(true));
    expect(within(group).getByRole("button", { name: "Hype" }).getAttribute("aria-pressed")).toBe("true");
    expect(router.replace).toHaveBeenLastCalledWith("/closet?category=lower_piece&seal=hype", { scroll: false });
    // tocar de novo no chip ativo tira o filtro
    fireEvent.click(within(group).getByRole("button", { name: "Hype" }));
    expect(router.replace).toHaveBeenLastCalledWith("/closet?category=lower_piece", { scroll: false });
    await waitFor(() => expect(within(group).getByRole("button", { name: "Hype" }).getAttribute("aria-pressed")).toBe("false"));
  });

  it("abre já filtrado pela URL (?seal=brand); valor desconhecido é ignorado", async () => {
    nav.search = new URLSearchParams("seal=brand");
    const api = loggedAs(undefined, { "GET /api/hype/summaries": summaries("PIECE", {}), "GET /api/me/closet": page([PIECE]), "GET /api/pieces/seals": { items: {} } });
    renderApp(<ClosetPage />);
    await settle();
    await waitFor(() => expect(closetCalls(api.calls)[0]?.path).toContain("seal=brand"));
    expect((await screen.findByRole("button", { name: "Marca" })).getAttribute("aria-pressed")).toBe("true");
    cleanup();
    nav.search = new URLSearchParams("seal=premium");
    const api2 = loggedAs(undefined, { "GET /api/hype/summaries": summaries("PIECE", {}), "GET /api/me/closet": page([PIECE]) });
    renderApp(<ClosetPage />);
    await settle();
    await waitFor(() => expect(closetCalls(api2.calls).length).toBeGreaterThan(0));
    expect(closetCalls(api2.calls)[0].path).not.toContain("seal=");
  });
});

describe("CSS dos Selos de Hype", () => {
  it("bloco próprio com tokens claro/escuro/contraste, sem animação com movimento reduzido", () => {
    const css = readFileSync("app/(site)/globals.css", "utf8");
    const block = css.slice(css.indexOf("/* RF53 · Selos de Hype"));
    expect(block.length).toBeGreaterThan(100);
    expect(block).toMatch(/:root \{ --hype-seal-ring:/);
    expect(block).toMatch(/:root\[data-theme="dark"\] \{ --hype-seal-ring:/);
    expect(block).toMatch(/:root\[data-theme="contrast"\] \{ --hype-seal-ring: var\(--line\)/);
    expect(block).toMatch(/prefers-reduced-motion: reduce\) \{ \.hype-seal-item\.is-earned \.seal-medallion\.is-hype \{ animation: none; \} \}/);
    expect(block).toMatch(/:root\[data-reduce-motion="true"\] \.hype-seal-item\.is-earned \.seal-medallion\.is-hype \{ animation: none; \}/);
  });
});
