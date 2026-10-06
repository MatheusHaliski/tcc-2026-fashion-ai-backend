// @vitest-environment jsdom
/**
 * Domínio Looks (/looks) e Lookbook social (docs/hype/01-AUDITORIA_E_PROPOSTA_IA.md §3.1/§3.3): a gestão dos looks
 * (origem, estado, ocasião, salvos) mora em /looks; o Lookbook mostra a vitrine — Looks publicados, Publicações
 * (looks + peças em ordem cronológica) e Favoritos — igual para o dono e para quem visita.
 */
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, settle, waitFor } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import { OWNER, PIECE, PIECE_2, SCHEME, page } from "@/test-utils/fixtures";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import type { PieceView, SchemeView, UserCard } from "@/lib/api/types";
import LooksPage from "@/app/(site)/(app)/looks/page";
import ProfilePage from "@/app/(site)/(app)/u/[username]/page";
import EditSchemePage from "@/app/(site)/(app)/schemes/[id]/edit/page";
import { LookbookTabs } from "@/components/lookbook-tabs";
import { SchemeBuilder } from "@/components/scheme-builder";
import { AiCompositionCard } from "@/components/ai-compositions";
import { lookHypeSortOptions, hypeSortOptions } from "@/components/hype/hype-filters";
import type { HypeSummary } from "@/lib/hype/types";

const HYPE = { "GET /api/hype/summaries": { type: "PIECE", algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: {} } };
const schemeCalls = (calls: { method: string; path: string }[]) => calls.filter((c) => c.method === "GET" && c.path.startsWith("/api/me/schemes"));

/** Dona do perfil visitado (a sessão é a Ana, u1). */
const BIA: UserCard = { ...OWNER, id: "u2", username: "bia", displayName: "Bia Lima" };
const JACKET: PieceView = { ...PIECE, id: "p9", name: "Jaqueta de couro", owner: BIA };
const SAVED: SchemeView = { ...SCHEME, id: "s9", title: "Look salvo da Bia", owner: BIA };
const overview = (self: boolean, owner = self ? OWNER : BIA) => ({ owner, self, visible: true, institutional: false,
  tabs: [{ id: "closet", count: 2 }, { id: "looks", count: 1 }, { id: "publications", count: 2 }, { id: "favorites", count: 2 }, { id: "saved_looks", count: 0 }, { id: "saved_pieces", count: 0 }] });

beforeEach(() => { __resetHypeStore(); router.replace.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); nav.search = new URLSearchParams(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("Meus looks (/looks) — gestão dos looks", () => {
  it("a origem é SegmentPicker e envia kind=ia/manual/remix, guardando a origem na URL", async () => {
    const api = loggedAs(undefined, { ...HYPE, "GET /api/me/schemes": page([SCHEME]) });
    renderApp(<LooksPage />);
    await settle();
    expect(await screen.findByText("Look de sexta")).toBeTruthy();
    expect(schemeCalls(api.calls)[0].path).not.toContain("kind=");
    expect(screen.getByRole("tab", { name: "Meus looks" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("link", { name: /Criar look/ }).getAttribute("href")).toBe("/schemes/new");

    for (const [name, kind] of [["Criados por IA", "ia"], ["Criados manualmente", "manual"], ["Remixes", "remix"]] as const) {
      fireEvent.click(screen.getByRole("radio", { name }));
      await waitFor(() => expect(schemeCalls(api.calls).some((c) => c.path.includes(`kind=${kind}`))).toBe(true));
      expect(screen.getByRole("radio", { name }).getAttribute("aria-checked")).toBe("true");
      expect(router.replace).toHaveBeenLastCalledWith(`/looks?kind=${kind}`, { scroll: false });
    }
  });

  it("abre na origem da URL e o estado \"Publicados\" envia state=publicados (arquivados e rascunhos também existem)", async () => {
    nav.search = new URLSearchParams("kind=remix");
    const api = loggedAs(undefined, { ...HYPE, "GET /api/me/schemes": page([SCHEME]) });
    renderApp(<LooksPage />);
    await settle();
    await waitFor(() => expect(schemeCalls(api.calls)[0]?.path).toContain("kind=remix"));
    expect((await screen.findByRole("radio", { name: "Remixes" })).getAttribute("aria-checked")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Estado: Todos" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Todos", "Publicados", "Rascunhos", "Favoritos", "Arquivados"]);
    fireEvent.click(screen.getByRole("option", { name: "Publicados" }));
    await waitFor(() => expect(schemeCalls(api.calls).some((c) => c.path.includes("state=publicados") && c.path.includes("kind=remix"))).toBe(true));
    // a ocasião continua aqui (era filtro da antiga aba Looks do Lookbook)
    expect(screen.getByRole("button", { name: "Ocasião: Todos" })).toBeTruthy();
  });

  it("a aba Salvos lista os looks salvos de outras pessoas", async () => {
    const api = loggedAs(undefined, { ...HYPE, "GET /api/me/schemes": page([]), "GET /api/me/saved-looks": page([{ scheme: SAVED, origin: "SALVO", originLabel: "Salvo de @bia" }]) });
    renderApp(<LooksPage />);
    await settle();
    expect(await screen.findByText("Você ainda não tem looks.")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Salvos" }));
    expect(await screen.findByText("Look salvo da Bia")).toBeTruthy();
    expect(screen.getByText("Salvo de @bia")).toBeTruthy();
    expect(api.calls.some((c) => c.path.startsWith("/api/me/saved-looks"))).toBe(true);
    expect(router.replace).toHaveBeenLastCalledWith("/looks?tab=saved", { scroll: false });
  });
});

describe("Lookbook — vitrine social", () => {
  it("Publicações mistura look e peça, na ordem do endpoint", async () => {
    const api = loggedAs(undefined, { ...HYPE, "GET /api/users/u2/lookbook": overview(false),
      "GET /api/users/u2/publications": page([{ type: "LOOK", at: "2026-10-02T10:00:00Z", scheme: { ...SCHEME, owner: BIA } }, { type: "PIECE", at: "2026-10-01T10:00:00Z", piece: JACKET }]) });
    const { container } = renderApp(<LookbookTabs ownerId="u2" initialTab="publications" />);
    await settle();
    expect(await screen.findByText("Look de sexta")).toBeTruthy();
    expect(screen.getByText("Jaqueta de couro")).toBeTruthy();
    // a grade vem na ordem cronológica do backend: o look (mais recente) antes da peça
    const text = container.textContent ?? "";
    expect(text.indexOf("Look de sexta")).toBeLessThan(text.indexOf("Jaqueta de couro"));
    expect(api.calls.some((c) => c.path === "/api/users/u2/publications?page=0&size=24")).toBe(true);
    // a ordem das abas: Peças · Looks · Publicações · Favoritos · … (visitante não vê Salvos nem Insights)
    expect(screen.getAllByRole("tab").map((t) => t.firstChild?.textContent)).toEqual(["Peças", "Looks", "Publicações", "Favoritos", "Agrupamentos", "Momentos"]);
    expect(screen.getByRole("tab", { name: /Publicações/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("Favoritos mostra os looks e, no seletor, as peças favoritas", async () => {
    loggedAs(undefined, { ...HYPE, "GET /api/users/u2/lookbook": overview(false), "GET /api/users/u2/favorites": { looks: [{ ...SCHEME, owner: BIA }], pieces: [JACKET] } });
    renderApp(<LookbookTabs ownerId="u2" initialTab="favorites" />);
    await settle();
    expect(await screen.findByText("Look de sexta")).toBeTruthy();
    expect(screen.queryByText("Jaqueta de couro")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Peças/ }));
    expect(await screen.findByText("Jaqueta de couro")).toBeTruthy();
  });

  it("na aba Looks o dono vê a vitrine (publicados) e o atalho \"Gerenciar meus looks\" para /looks", async () => {
    const api = loggedAs(undefined, { ...HYPE, "GET /api/users/u1/lookbook": overview(true), "GET /api/profiles/u1": { schemes: [SCHEME] } });
    renderApp(<LookbookTabs ownerId="u1" initialTab="looks" />);
    await settle();
    expect(await screen.findByText("Look de sexta")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Gerenciar meus looks/ }).getAttribute("href")).toBe("/looks");
    // a gestão saiu do Lookbook: nenhum filtro e nenhuma chamada a /api/me/schemes
    expect(screen.queryByRole("button", { name: /Estado:/ })).toBeNull();
    expect(schemeCalls(api.calls)).toEqual([]);
    expect(screen.getAllByRole("tab").map((t) => t.firstChild?.textContent)).toEqual(["Peças", "Looks", "Publicações", "Favoritos", "Salvos", "DNA de estilo", "Look do Dia", "Cápsula", "Agrupamentos", "Momentos", "Insights"]);
  });

  it("quem visita vê os mesmos looks publicados, sem o atalho de gestão", async () => {
    loggedAs(undefined, { ...HYPE, "GET /api/users/u2/lookbook": overview(false), "GET /api/profiles/u2": { schemes: [{ ...SCHEME, owner: BIA }] } });
    renderApp(<LookbookTabs ownerId="u2" initialTab="looks" />);
    await settle();
    expect(await screen.findByText("Look de sexta")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Gerenciar meus looks/ })).toBeNull();
  });

  it("o perfil aceita ?tab=publicacoes e ?tab=favoritos (aliases em português)", async () => {
    const profile = { user: BIA, layout: "PESSOAL", self: false, relation: "NENHUMA", counters: { followers: 0, following: 0, published: 1 }, visibility: "PUBLIC", contentVisible: true };
    const routes = { ...HYPE, "GET /api/profiles/bia": profile, "GET /api/users/u2/lookbook": overview(false), "GET /api/users/u2/publications": page([]), "GET /api/users/u2/favorites": { looks: [], pieces: [] } };
    const params = Object.assign(Promise.resolve({ username: "bia" }), { status: "fulfilled", value: { username: "bia" } });
    for (const [alias, path] of [["publicacoes", "/api/users/u2/publications"], ["favoritos", "/api/users/u2/favorites"]] as const) {
      nav.search = new URLSearchParams(`tab=${alias}`);
      const api = loggedAs(undefined, routes);
      renderApp(<Suspense fallback={null}><ProfilePage params={params} /></Suspense>);
      await waitFor(() => expect(api.calls.some((c) => c.path.startsWith(path))).toBe(true), { timeout: 3000 });
      cleanup();
    }
  });
});

/** RF53 · Lote 2 do HypeScore (docs/hype/HYPE_AUDITORIA_ABAS.md): Hype em Meus looks, Salvos e no editor de look. */
const NOW_ISO = new Date().toISOString();
const SUMMARY: Record<string, HypeSummary> = {
  p1: { status: "AVAILABLE", score: 72, level: "HOT", direction: "UP", deltaPercent: 14, deltaPoints: 9, calculatedAt: NOW_ISO, seals: [] },
  p2: { status: "INSUFFICIENT_DATA", calculatedAt: NOW_ISO, seals: [] },
  s1: { status: "AVAILABLE", score: 81, level: "TRENDING", direction: "STABLE", calculatedAt: NOW_ISO, seals: [] },
};
/** /api/hype/summaries por tipo e ids (o que não está no mapa volta fora da resposta = "não calculado"). */
const summaries = (url: URL) => {
  const ids = (url.searchParams.get("ids") ?? "").split(",");
  return { type: url.searchParams.get("type"), algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: Object.fromEntries(ids.filter((id) => SUMMARY[id]).map((id) => [id, SUMMARY[id]])) };
};
const BUILDER = { totalPieces: 2, eligiblePieces: 2, status: "PRONTO", lists: { upper_piece: [PIECE], lower_piece: [PIECE_2] }, defaultVisibility: "PRIVATE" };
const PREVIEW = { scores: { compatibility: 64, hype: 72, novelty: 100, reuse: 10, usage: 40, sustainability: 77 }, hype: { basis: "PIECES_AVERAGE", withData: 1, total: 2 }, persisted: false };

describe("Meus looks — Hype como ordenação e filtro (P1-07)", () => {
  it("lookHypeSortOptions é o subconjunto de looks e não muda as ordenações do guarda-roupa", () => {
    expect(lookHypeSortOptions().map((o) => o.value)).toEqual(["hype_desc", "hype_asc", "growth"]);
    expect(hypeSortOptions().map((o) => o.value)).toEqual(["hype_desc", "hype_asc", "growth", "worn", "least_worn", "rarity", "idle"]);
  });

  it("ordenar por Hype envia sort=hype_desc, o filtro de faixa envia hypeLevel e a tela avisa que é o Hype pessoal", async () => {
    const api = loggedAs(undefined, { ...HYPE, "GET /api/me/schemes": page([SCHEME]) });
    renderApp(<LooksPage />);
    await settle();
    expect(await screen.findByText("Look de sexta")).toBeTruthy();
    expect(screen.queryByText(/inclusive os privados/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Ordenar: Mais recentes" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Mais recentes", "Maior Hype", "Menor Hype", "Maior crescimento"]);
    fireEvent.click(screen.getByRole("option", { name: "Maior Hype" }));
    await waitFor(() => expect(schemeCalls(api.calls).some((c) => c.path.includes("sort=hype_desc"))).toBe(true));
    expect(screen.getByText(/inclusive os privados \(só você vê\)/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hype: Todos" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Todos", "Nicho ou mais", "Relevante ou mais", "Em alta ou mais", "Tendência ou mais", "Viral ou mais"]);
    fireEvent.click(screen.getByRole("option", { name: "Em alta ou mais" }));
    await waitFor(() => expect(schemeCalls(api.calls).some((c) => c.path.includes("hypeLevel=HOT") && c.path.includes("sort=hype_desc"))).toBe(true));
    // a ordem padrão (mais recentes) não manda sort
    expect(schemeCalls(api.calls)[0].path).not.toContain("sort=");
  });

  it("Salvos: a ordenação por Hype vai para /api/me/saved-looks (o backend decide com o Hype público)", async () => {
    const api = loggedAs(undefined, { ...HYPE, "GET /api/me/schemes": page([]), "GET /api/me/saved-looks": page([{ scheme: SAVED, origin: "SALVO", originLabel: "Salvo de @bia" }]) });
    renderApp(<LooksPage />);
    await settle();
    fireEvent.click(await screen.findByRole("tab", { name: "Salvos" }));
    expect(await screen.findByText("Look salvo da Bia")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ordenar: Mais recentes" }));
    fireEvent.click(screen.getByRole("option", { name: "Maior crescimento" }));
    await waitFor(() => expect(api.calls.some((c) => c.path.startsWith("/api/me/saved-looks") && c.path.includes("sort=growth") && c.path.includes("page=0"))).toBe(true));
  });
});

describe("Editor de look — Hype das peças e prévia (P1-08, P2-14, P3-08)", () => {
  it("a prévia pede os seis números uma vez (com debounce), mostra a base do Hype e nada vira sinal", async () => {
    const api = loggedAs(undefined, { "GET /api/hype/summaries": summaries, "GET /api/schemes/builder": BUILDER, "POST /api/schemes/scores": PREVIEW });
    renderApp(<SchemeBuilder initial={SCHEME} />);
    await settle();
    expect(await screen.findByText("Prévia do look")).toBeTruthy();
    expect(await screen.findByText("Hype = média do HypeScore das peças com dados (1 de 2).", {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText(/nunca uma nota do look/)).toBeTruthy();
    const posts = api.calls.filter((c) => c.method === "POST" && c.path === "/api/schemes/scores");
    expect(posts).toHaveLength(1);
    // o look em edição vai junto: os pares dele não contam como "já combinados" na novidade
    expect(posts[0].body).toEqual({ pieceIds: ["p1", "p2"], occasion: ["work"], style: ["basic"], schemeId: "s1" });
    const scores = screen.getByText("Compatibilidade").closest("dl")!;
    expect(scores.textContent).toContain("Novidade100");
    // a prévia só lê: nenhuma outra escrita além do POST de leitura
    expect(api.calls.filter((c) => c.method !== "GET" && !c.path.startsWith("/bff/")).map((c) => c.path)).toEqual(["/api/schemes/scores"]);
  });

  it("cada peça escolhida mostra o Hype v2 com a faixa em texto; sem dados aparece \"—\", nunca 0", async () => {
    loggedAs(undefined, { "GET /api/hype/summaries": summaries, "GET /api/schemes/builder": BUILDER, "POST /api/schemes/scores": PREVIEW });
    const { container } = renderApp(<SchemeBuilder initial={SCHEME} />);
    await settle();
    fireEvent.click(await screen.findByRole("button", { name: /Peças/ }));
    const slots = await screen.findByRole("region", { name: "partes do look" });
    await waitFor(() => expect(slots.textContent).toContain("Em alta"));
    expect(slots.querySelectorAll(".look-hype-tag")).toHaveLength(2);
    expect(slots.textContent).toContain("🔥 72");
    expect(slots.textContent).toContain("🔥 —");
    expect(slots.textContent).not.toMatch(/🔥 0\b/);
    expect(container.querySelector(".look-hype-tag .hype-level-chip.is-hot")).toBeTruthy();
  });

  it("composições da IA trazem os seis números ao lado (Hype é só uma das leituras)", () => {
    mockApi({});
    renderApp(<AiCompositionCard title="Linho e terracota" items={[{ wardrobeItemId: "p1", slot: "TOP", piece: PIECE }]} slotLabel={(s) => s} onApply={vi.fn()}
      scores={{ compatibility: 80, hype: null, novelty: 50, reuse: 0, usage: 20, sustainability: 60 }} />);
    const dl = screen.getByText("Compatibilidade").closest("dl")!;
    expect(dl.textContent).toContain("Compatibilidade80");
    // Hype sem base: "—", nunca 0
    expect(screen.getByText("Hype").nextElementSibling?.textContent).toBe("—");
    cleanup();
    renderApp(<AiCompositionCard title="Sem números" items={[]} slotLabel={(s) => s} onApply={vi.fn()} />);
    expect(screen.queryByText("Compatibilidade")).toBeNull();
  });

  it("gerar com IA guarda os números de cada composição na ordem da resposta", async () => {
    loggedAs(undefined, { "GET /api/hype/summaries": summaries, "GET /api/schemes/builder": BUILDER,
      "POST /api/schemes/compositions": { compositions: [{ title: "Primeiro", items: [{ wardrobeItemId: "p1", slot: "TOP" }, { wardrobeItemId: "p2", slot: "BOTTOM" }] }, { title: "Segundo", items: [{ wardrobeItemId: "p2", slot: "BOTTOM" }] }],
        scores: [{ compatibility: 91, hype: 72, novelty: 100, reuse: 0, usage: 50, sustainability: 70 }, { compatibility: 33, hype: null, novelty: null, reuse: 5, usage: 0, sustainability: 60 }] } });
    renderApp(<SchemeBuilder />);
    await settle();
    fireEvent.click(await screen.findByRole("button", { name: /Com IA/ }));
    fireEvent.click(screen.getByRole("button", { name: /Gerar com IA/ }));
    const first = await screen.findByRole("button", { name: "Usar o conjunto Primeiro" });
    expect(first.querySelector("dl")?.textContent).toContain("Compatibilidade91");
    expect(screen.getByRole("button", { name: "Usar o conjunto Segundo" }).querySelector("dl")?.textContent).toContain("Compatibilidade33");
  });

  it("editar look mostra o Hype atual do look (sinais do próprio look) acima do editor", async () => {
    loggedAs(undefined, { "GET /api/hype/summaries": summaries, "GET /api/schemes/builder": BUILDER, "GET /api/schemes/s1": { scheme: SCHEME }, "POST /api/schemes/scores": PREVIEW });
    const params = Object.assign(Promise.resolve({ id: "s1" }), { status: "fulfilled", value: { id: "s1" } });
    renderApp(<Suspense fallback={null}><EditSchemePage params={params} /></Suspense>);
    expect(await screen.findByText("Hype atual deste look", {}, { timeout: 3000 })).toBeTruthy();
    const inline = screen.getByRole("region", { name: /Look de sexta/ });
    await waitFor(() => expect(inline.textContent).toContain("81"));
    expect(screen.getByRole("button", { name: "Ver análise completa" })).toBeTruthy();
  });
});
