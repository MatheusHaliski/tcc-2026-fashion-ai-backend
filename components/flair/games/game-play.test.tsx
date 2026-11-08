// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GamePlay } from "@/components/flair/games/game-play";
import type { GameAccess, GameCheck, GameDetail } from "@/lib/flair/games";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor } from "@/test-utils/render";

/**
 * Tela de um jogo do FLAIR 3D: bloqueado pelo servidor não busca o banco de cartas e mostra os motivos; liberado
 * monta vaga a vaga, confere no servidor (requisitos novos, efeitos por vaga, Hype de partida, pontuação FLAIR 3D e
 * prévia da partida perfeita), entrega e recebe o modal do CBC mais as recompensas FLAIR 3D; um 403 de nível no check vira
 * o mesmo painel de bloqueio. Na série A o quarto 3D só entra com WebGL — aqui (jsdom) fica a cena 2D.
 */
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams(""), usePathname: () => "/flair/jogos/a01-espelho-partido" }));

const open: GameAccess = { allowed: true, tierOk: true, wardrobeOk: true, requiredTier: "ESTREIA", currentTier: "LOFT", requiredWardrobeLevel: "ORGANIZADO", currentWardrobeLevel: "BEM_CURADO" };
const time = { status: "OPEN" as const, now: "2026-10-10T12:00:00Z", always: true, startsInSeconds: 0, endsInSeconds: 0, daysLeft: null };
const card = (id: string, name: string, position: string, tier = "PRATA", ovr = 70) => ({ id, originType: "PIECE", originId: `p-${id}`, season: "SPRING", tier, ovr, rare: false, position, name, brandName: "Atelier Lumi", imageUrl: null, hype: null, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" });
const CARDS = { season: "SPRING", counts: { ESPECIAL: 0, OURO: 0, PRATA: 3, BRONZE: 0 }, total: 3, cards: [card("c1", "Vestido prisma", "VES"), card("c2", "Bolsa transversal", "ACE"), card("c3", "Camisa de linho", "SUP")] };
const detail = (over: Partial<GameDetail> = {}): GameDetail => ({
  id: "g1", slug: "a01-espelho-partido", name: "Espelho Partido", description: "Recomponha o espelho da suíte.", scenario: "livre", difficulty: "EASY", status: "OPEN", time,
  slotsCount: 3, points: 25, multiplier: 1, pointsPreview: 25, levelOpen: true, locksCards: false, repeatLimit: 1, official: true, mine: { submissions: 0, attemptsLeft: 1, done: false },
  requirements: [{ type: "cards", min: 2 }, { type: "hypeBand", min: "NICHE", count: 1 }, { type: "distinctTags", field: "color", count: 2 }, { type: "position", position: "ACE", count: 1 }, { type: "mala", max: 6 }],
  number: 1, series: "A", district: "SUITE", rarity: "LEGENDARY", requiredTier: "ESTREIA", requiredWardrobeLevel: "ORGANIZADO", thumbnail: null,
  deck: { minCards: 2, maxCards: 3, mala: 6 }, hype: { deckMin: "LOW_SIGNAL", mandatoryMin: "NICHE", mandatoryMax: "TRENDING" }, access: open,
  rewards: [{ type: "ITEM", code: "F3D-A01-MOLDURA", name: "Moldura prisma" }, { type: "SPECIAL_CARD", code: "F3D-A01-ESPELHO", name: "Espelho inteiro", condition: "perfect" }],
  slots: [
    { key: "caco_central", position: "VES", label: "Caco central", optional: false, effects: { comum: "O caco reflete.", metamorfose: "O espelho se refaz.", impersonation: "Outra pessoa no reflexo." }, bonus: { metamorfose: 1, impersonation: 2 } },
    { key: "porta", position: "ACE", label: "Porta", optional: true, effects: { comum: "A porta range.", metamorfose: null, impersonation: null } },
    { key: "espelho", position: "SUP", label: "Espelho", optional: false, effects: { comum: "Reflexo limpo.", metamorfose: null, impersonation: null } },
  ],
  themeTags: [], interpretations: [], suggestedInterpretation: null, mySubmissions: [], communityOpen: false, community: [], memory: { builds: 3, people: 2, averageSintonia: 50, readings: null, season: "SPRING" },
  ficha: { objective: "Recompor o espelho.", scenario: "A suíte amanhece em cacos.", mandatory: "Uma peça inteira.", sequence: "Centro, porta, espelho.", reward: "Moldura prisma.", hypePlay: "Bônus acima de Relevante.", hypePartial: "Sobe ou desce uma faixa." },
  scene: { sky: ["#1B2440", "#3A3F6B"], ground: "#2C2F45", horizon: 62, accent: "#8FD3F4", props: [{ k: "mirror", x: 80, y: 50 }], slots: { caco_central: [50, 55, "mirror"], porta: [20, 70, "door:1"], espelho: [80, 60] } },
  hypeRules: { play: { mode: "BONUS_ABOVE_RELEVANT", cap: 3 }, partial: { mode: "UP_DOWN" } }, ...over,
});
const band = (cardId: string) => (cardId === "c1" ? "RELEVANT" : "NICHE");
const check = (slots: Record<string, string>): GameCheck => {
  const n = Object.keys(slots).length; const complete = !!slots.caco_central && !!slots.espelho;
  return { status: "OPEN", interpretation: "own", canSubmit: complete,
    evaluation: { slots: Object.entries(slots).map(([slot, cardId]) => ({ slot, position: "ANY", cardId, positionOk: true, neighbor: false, theme: false, sintonia: 2 })), sintonia: 2 * n, sintoniaMax: 9, filled: n, complete, ok: complete, rediscovered: [],
      requirements: [{ type: "cards", ok: n >= 2, have: n, need: 2, args: { min: 2 } }, { type: "hypeBand", ok: true, have: n, need: 1, args: { min: "NICHE", count: 1 } }, { type: "distinctTags", ok: n >= 2, have: n, need: 2, args: { field: "color", count: 2 } },
        { type: "position", ok: !!slots.porta, have: slots.porta ? 1 : 0, need: 1, args: { position: "ACE", count: 1 } }, { type: "mala", ok: true, have: 2 * n, need: 6, args: { max: 6 } }] },
    story: [{ key: null, vars: {}, text: { "pt-BR": "A suíte amanhece em cacos.", en: "Shards at dawn.", es: "Trizas al amanecer." } }, ...Object.entries(slots).map(([slot, cardId]) => ({ key: "cbc.story.generic", vars: { name: CARDS.cards.find((c) => c.id === cardId)!.name, brand: "Atelier Lumi", color: "none" }, slot, sintonia: 2 }))],
    points: { lines: [{ action: "FLAIR_3D", points: 25, ref: "g1", label: "" }, ...(complete ? [{ action: "FLAIR_3D_PERFECT", points: 10, ref: "g1", label: "" }] : [])], total: complete ? 35 : 25 },
    flair3d: { slots: Object.entries(slots).map(([slot, cardId]) => ({ slot, cardId, hypeBand: band(cardId), hypeBonus: cardId === "c1" ? 1 : 0, effect: { kind: slot === "caco_central" ? "METAMORFOSE" : "COMUM", bonus: slot === "caco_central" ? 1 : 0, text: slot === "caco_central" ? "O espelho se refaz." : "Reflexo limpo." }, matchBand: cardId === "c1" ? "HOT" : "NICHE", matchDelta: cardId === "c1" ? 1 : 0 })),
      hypeTotal: slots.caco_central === "c1" ? 1 : 0, effectTotal: slots.caco_central ? 1 : 0, score: 2 * n + (slots.caco_central ? 2 : 0), scoreMax: 15, perfect: complete } };
};
const forbidden = (code: string, details: Record<string, string>) => () => new Response(JSON.stringify({ status: 403, code, message: "nível insuficiente", details }), { status: 403, headers: { "content-type": "application/json" } });

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("bloqueio (fail closed)", () => {
  it("abaixo do nível pelo servidor: painel com os motivos e os links, sem vagas clicáveis e sem buscar o banco de cartas", async () => {
    const { calls } = loggedAs(ME, {
      "GET /api/flair/games/a01-espelho-partido": detail({ requiredTier: "LOFT", requiredWardrobeLevel: "BEM_CURADO", access: { allowed: false, tierOk: false, wardrobeOk: false, requiredTier: "LOFT", currentTier: "STUDIO", requiredWardrobeLevel: "BEM_CURADO", currentWardrobeLevel: "ORGANIZADO" } }),
      "GET /api/me/flair/cards": CARDS,
    });
    renderApp(<GamePlay slug="a01-espelho-partido" />);
    expect(await screen.findByRole("heading", { name: "Espelho Partido" })).toBeTruthy();
    const lock = screen.getByTestId("game-lock");
    expect(lock.getAttribute("role")).toBe("status");
    expect(lock.textContent).toContain("Jogo bloqueado");
    expect(lock.textContent).toContain("Requer nível Loft"); expect(lock.textContent).toContain("seu nível: Studio");
    expect(lock.textContent).toContain("Requer guarda-roupa Bem curado"); expect(lock.textContent).toContain("seu guarda-roupa: Organizado");
    expect(lock.querySelector("a[href='/points']")?.textContent).toBe("Ver FAI Points");
    expect(lock.querySelector("a[href='/highlights']")?.textContent).toBe("Melhorar o guarda-roupa");
    expect(screen.queryByRole("button", { name: /Caco central/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Entregar" })).toBeNull();
    await settle();
    expect(calls.some((c) => c.path === "/api/me/flair/cards")).toBe(false);
    expect(calls.some((c) => c.path === "/api/me/room")).toBe(false);
  });

  it("403 do servidor na conferência vira o painel de bloqueio com os detalhes da resposta", async () => {
    loggedAs(ME, {
      "GET /api/flair/games/a01-espelho-partido": detail(),
      "GET /api/me/flair/cards": CARDS,
      "POST /api/flair/games/a01-espelho-partido/check": forbidden("WARDROBE_LEVEL_REQUIRED", { requiredWardrobeLevel: "BEM_CURADO", currentWardrobeLevel: "ORGANIZADO" }),
    });
    renderApp(<GamePlay slug="a01-espelho-partido" />);
    fireEvent.click(await screen.findByRole("button", { name: /Caco central/ }));
    fireEvent.click((await screen.findAllByRole("button", { name: /Vestido prisma/ }))[0]);
    const lock = await screen.findByTestId("game-lock", {}, { timeout: 3000 });
    expect(lock.textContent).toContain("Requer guarda-roupa Bem curado"); expect(lock.textContent).toContain("seu guarda-roupa: Organizado");
    expect(lock.textContent).not.toContain("Requer nível");
    expect(screen.queryByRole("button", { name: "Entregar" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Caco central/ })).toBeNull();
  });
});

describe("partida", () => {
  it("série A sem WebGL fica na cena 2D; ficha, requisitos novos e vaga opcional aparecem antes de qualquer carta", async () => {
    const { calls } = loggedAs(ME, { "GET /api/flair/games/a01-espelho-partido": detail(), "GET /api/me/flair/cards": CARDS });
    renderApp(<GamePlay slug="a01-espelho-partido" />);
    expect(await screen.findByRole("heading", { name: "Espelho Partido" })).toBeTruthy();
    expect(screen.getByText("FLAIR 3D · Série A · Jogo 1")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Todos os jogos/ }).getAttribute("href")).toBe("/flair/jogos");
    await screen.findByRole("button", { name: /Caco central/ });
    expect(screen.getByRole("button", { name: /Porta \(opcional\)/ })).toBeTruthy();
    expect(screen.queryByTestId("ge-room")).toBeNull();
    expect(document.querySelector(".cbc-stage")).toBeTruthy();
    const side = screen.getByRole("complementary", { name: "Ficha, requisitos, efeitos, Hype e pontos" });
    expect(side.textContent).toContain("Recompor o espelho."); expect(side.textContent).toContain("Deck: 2 a 3 cartas"); expect(side.textContent).toContain("Mala: peso máximo 6");
    expect(side.textContent).toContain("Hype mínima: deck Sinal baixo · obrigatórias Nicho · teto Tendência");
    expect(side.textContent).toContain("Preencher as 2 vagas obrigatórias");
    for (const r of ["2 cartas colocadas", "1 carta com Hype Nicho ou acima", "2 valores diferentes de cor", "1 carta de Acessório", "Peso da mala até 6"]) expect(side.textContent).toContain(r);
    expect(side.textContent).toContain("Coloque cartas para ver os efeitos de cada vaga.");
    expect(side.textContent).toContain("Moldura prisma"); expect(side.textContent).toContain("Espelho inteiro"); expect(side.textContent).toContain("só com partida perfeita");
    expect((screen.getByRole("button", { name: "Entregar" }) as HTMLButtonElement).disabled).toBe(true);
    await settle();
    expect(calls.some((c) => c.path === "/api/me/room")).toBe(false);
  });

  it("coloca cartas, confere no servidor (efeitos, Hype de partida, pontuação FLAIR 3D, prévia da partida perfeita), entrega e recebe o modal com as recompensas", async () => {
    let submitted = false;
    const { calls } = loggedAs(ME, {
      "GET /api/flair/games/a01-espelho-partido": () => detail(submitted ? { mine: { submissions: 1, attemptsLeft: 0, done: true }, mySubmissions: [{ id: "s1", attempt: 1, createdAt: "2026-10-10T12:00:00Z", interpretation: "own", sintonia: 6, sintoniaMax: 9, points: 35, story: [], cards: [] }] } : {}),
      "GET /api/me/flair/cards": CARDS,
      "POST /api/flair/games/a01-espelho-partido/check": (_u: URL, init: RequestInit) => check((JSON.parse(String(init.body)) as { slots: Record<string, string> }).slots),
      "POST /api/flair/games/a01-espelho-partido/submit": (_u: URL, init: RequestInit) => {
        submitted = true; const c = check((JSON.parse(String(init.body)) as { slots: Record<string, string> }).slots);
        return { ...c, points: { lines: c.points.lines.map((l) => ({ ...l, granted: true })), total: 35 }, submission: { id: "s1", attempt: 1, createdAt: "2026-10-10T12:00:00Z", interpretation: "own", sintonia: 6, sintoniaMax: 9, points: 35, story: c.story, cards: [] }, group: null, locked: false,
          rewards: [{ type: "ITEM", code: "F3D-A01-MOLDURA", name: "Moldura prisma", state: "DELIVERED" }, { type: "SPECIAL_CARD", code: "F3D-A01-ESPELHO", name: "Espelho inteiro", state: "DELIVERED", condition: "perfect" }] };
      },
    });
    renderApp(<GamePlay slug="a01-espelho-partido" />);
    // vaga 1: a peça inteira vem primeiro no banco
    fireEvent.click(await screen.findByRole("button", { name: /Caco central/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Carta para: Caco central");
    const options = screen.getAllByRole("button", { name: /Vestido prisma|Bolsa transversal|Camisa de linho/ });
    expect(options[0].textContent).toContain("Vestido prisma");
    fireEvent.click(options[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(calls.filter((c) => c.path.endsWith("/check")).length).toBe(1), { timeout: 3000 });
    expect((calls.find((c) => c.path.endsWith("/check"))!.body as { slots: Record<string, string> }).slots).toEqual({ caco_central: "c1" });
    const effects = await screen.findByTestId("ge-effects");
    expect(effects.textContent).toContain("Caco central"); expect(effects.textContent).toContain("Metamorfose +1"); expect(effects.textContent).toContain("O espelho se refaz.");
    expect(screen.getByTestId("ge-hype").textContent).toContain("Relevante→Em alta +1");
    expect(screen.getByText("Pontuação FLAIR 3D 4 de 15")).toBeTruthy();
    expect(screen.queryByText("Partida perfeita")).toBeNull();
    expect((screen.getByRole("button", { name: "Entregar" }) as HTMLButtonElement).disabled).toBe(true);
    expect(calls.filter((c) => c.path.endsWith("/submit")).length).toBe(0);
    // a vaga opcional e a última obrigatória
    fireEvent.click(screen.getByRole("button", { name: /Porta \(opcional\)/ }));
    fireEvent.click((await screen.findAllByRole("button", { name: /Bolsa transversal/ }))[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /^Espelho ·/ }));
    fireEvent.click((await screen.findAllByRole("button", { name: /Camisa de linho/ }))[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect((screen.getByRole("button", { name: "Entregar" }) as HTMLButtonElement).disabled).toBe(false), { timeout: 3000 });
    expect(screen.getByText("Pontuação FLAIR 3D 8 de 15")).toBeTruthy();
    expect(screen.getAllByText("Partida perfeita").length).toBeGreaterThan(0);   /* selo + linha de pontos FLAIR_3D_PERFECT (prévia) */
    expect(screen.getByText("+35")).toBeTruthy();
    expect(screen.getByText("A suíte amanhece em cacos.")).toBeTruthy();
    // entrega: uma chamada; o modal do CBC mais a lista de recompensas FLAIR 3D com o estado real
    fireEvent.click(screen.getByRole("button", { name: "Entregar" }));
    const reward = await screen.findByRole("dialog");
    expect(reward.textContent).toContain("Montagem entregue"); expect(reward.textContent).toContain("Creditado");
    expect(calls.filter((c) => c.path.endsWith("/submit")).length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Ver minha entrega" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const rewards = screen.getAllByTestId("ge-rewards");
    expect(rewards.some((r) => r.textContent?.includes("Moldura prisma") && r.textContent.includes("Entregue") && r.textContent.includes("Espelho inteiro"))).toBe(true);
    await waitFor(() => expect(screen.getByText(/Você entregou a tentativa 1/)).toBeTruthy());
    expect(screen.queryByRole("button", { name: /Caco central/ })).toBeNull();
  });
});
