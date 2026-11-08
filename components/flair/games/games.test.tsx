// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GamesCatalog } from "@/components/flair/games/games-catalog";
import type { GameAccess, GameSummary } from "@/lib/flair/games";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor } from "@/test-utils/render";

/**
 * Catálogo do FLAIR 3D (/flair/jogos): faixa com o nível e o guarda-roupa vindos do servidor, grade agrupada por
 * série com contadores, miniaturas, cadeado com motivo e links para destravar, filtros em chips espelhados na URL,
 * "Só o que posso jogar", busca, estado vazio e o convite a entrar quando não há sessão.
 */
const push = vi.fn(); const replace = vi.fn();
let search = "";
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push, replace, prefetch: vi.fn(), back: vi.fn() }), useSearchParams: () => new URLSearchParams(search), usePathname: () => "/flair/jogos" }));

const open: GameAccess = { allowed: true, tierOk: true, wardrobeOk: true, requiredTier: "ESTREIA", currentTier: "STUDIO", requiredWardrobeLevel: "EM_MONTAGEM", currentWardrobeLevel: "BEM_CURADO" };
const time = { status: "OPEN" as const, now: "2026-10-10T12:00:00Z", always: true, startsInSeconds: 0, endsInSeconds: 0, daysLeft: null };
const game = (number: number, over: Partial<GameSummary> = {}): GameSummary => ({
  id: `g${number}`, slug: `a${String(number).padStart(2, "0")}-jogo-${number}`, name: `Jogo ${number}`, description: `Descrição ${number}.`, scenario: "livre", difficulty: "EASY", status: "OPEN", time,
  slotsCount: 3, points: 15, multiplier: 1, pointsPreview: 15, requirements: [], levelOpen: true, locksCards: false, repeatLimit: 1, official: true, mine: null,
  number, series: "A", district: "SUITE", rarity: "COMMON", requiredTier: "ESTREIA", requiredWardrobeLevel: "EM_MONTAGEM", thumbnail: null,
  deck: { minCards: 3, maxCards: 3, mala: null }, hype: { deckMin: "LOW_SIGNAL", mandatoryMin: "NICHE", mandatoryMax: "TRENDING" }, access: open, rewards: [], ...over,
});
const GAMES = [
  game(1, { slug: "a01-espelho-partido", name: "Espelho Partido", thumbnail: "/flair/games/a01-espelho-partido.webp" }),
  game(2, { name: "Closet Lendário", difficulty: "LEGENDARY", rarity: "LEGENDARY", requiredTier: "LOFT", requiredWardrobeLevel: "CLOSET_INTELIGENTE",
    access: { ...open, allowed: false, tierOk: false, wardrobeOk: false, requiredTier: "LOFT", requiredWardrobeLevel: "CLOSET_INTELIGENTE" } }),
  game(21, { series: "B", district: "RUNWAY", name: "Passarela de Vidro", difficulty: "HARD", rarity: "RARE", requiredTier: "STUDIO", mine: { submissions: 1, attemptsLeft: 0, done: true } }),
  game(100, { series: "E", district: "COMMUNITY", name: "Herança", rarity: "COLLAB_DROP", requiredWardrobeLevel: "MAISON_CLOSET",
    access: { ...open, allowed: false, wardrobeOk: false, requiredWardrobeLevel: "MAISON_CLOSET" } }),
];
const LIST = { games: GAMES, me: { tier: "STUDIO", wardrobeLevel: "BEM_CURADO", wardrobeScore: 712 }, season: "SPRING", counts: { bySeries: { A: 2, B: 1, E: 1 }, byDifficulty: { EASY: 2, HARD: 1, LEGENDARY: 1 }, byRarity: { COMMON: 1, RARE: 1, LEGENDARY: 1, COLLAB_DROP: 1 }, byTier: { ESTREIA: 2, STUDIO: 1, LOFT: 1 } } };

// como no app, replace() muda a URL que useSearchParams() devolve na próxima renderização
beforeEach(() => { search = ""; push.mockReset(); replace.mockReset(); replace.mockImplementation((url: string) => { search = url.split("?")[1] ?? ""; }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("catálogo", () => {
  it("mostra nível e guarda-roupa do servidor, agrupa por série com contadores, miniaturas e selos; bloqueado tem cadeado com motivo e links", async () => {
    const { calls } = loggedAs(ME, { "GET /api/flair/games": LIST });
    renderApp(<GamesCatalog />);
    expect(await screen.findByRole("heading", { name: "FLAIR 3D" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Central FLAIR/ }).getAttribute("href")).toBe("/flair?mode=games");
    expect((await screen.findByTestId("ge-me")).textContent).toContain("Seu nível: Studio");
    expect(screen.getByTestId("ge-me").textContent).toContain("Seu guarda-roupa: Bem curado");
    expect(screen.getByTestId("ge-me").textContent).toContain("pontuação 712");
    // séries na ordem, com contadores de jogos e liberados
    const heads = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(heads).toEqual(["Série A · Suíte de Vidro", "Série B · Passarela e imprensa", "Série E · Comunidade e marcas"]);
    const serieA = screen.getByRole("region", { name: "Série A · Suíte de Vidro" });
    expect(serieA.textContent).toContain("2 jogos · 1 liberado");
    // miniatura: a do servidor ou /flair/games/<slug>.webp, com carregamento preguiçoso e alt = nome do jogo
    const img = screen.getByRole("img", { name: "Espelho Partido" }) as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/flair/games/a01-espelho-partido.webp"); expect(img.getAttribute("loading")).toBe("lazy");
    expect(screen.getByRole("img", { name: "Closet Lendário" }).getAttribute("src")).toBe("/flair/games/a02-jogo-2.webp");
    // selos
    const lendario = screen.getByRole("article", { name: /Closet Lendário/ });
    expect(lendario.className).toContain("is-locked");
    expect(lendario.querySelector(".ge-rarity.is-legendary")?.textContent).toBe("Lendária");
    expect(lendario.querySelector(".cbc-diff.is-legendary")?.textContent).toBe("Lendário");
    expect(lendario.textContent).toContain("Nível Loft"); expect(lendario.textContent).toContain("Guarda-roupa Closet inteligente");
    // cadeado com os dois motivos e os dois caminhos
    const lock = lendario.querySelector("[data-testid=ge-lock]")!;
    expect(lock.textContent).toContain("Requer nível Loft"); expect(lock.textContent).toContain("seu nível: Studio");
    expect(lock.textContent).toContain("Requer guarda-roupa Closet inteligente"); expect(lock.textContent).toContain("seu guarda-roupa: Bem curado");
    expect(lock.querySelector("a[href='/points']")).toBeTruthy(); expect(lock.querySelector("a[href='/highlights']")).toBeTruthy();
    const heranca = screen.getByRole("article", { name: /Herança/ });
    expect(heranca.textContent).toContain("Requer guarda-roupa Maison Closet"); expect(heranca.textContent).not.toContain("Requer nível");
    expect(heranca.querySelector("a[href='/points']")).toBeNull(); expect(heranca.querySelector("a[href='/highlights']")).toBeTruthy();
    expect(screen.getByRole("article", { name: /Espelho Partido/ }).querySelector("[data-testid=ge-lock]")).toBeNull();
    // ações: Jogar (liberado), Ver (entregue) e Bloqueado — todas levam ao jogo, que decide pelo servidor
    expect(screen.getByRole("link", { name: "Jogar" }).getAttribute("href")).toBe("/flair/jogos/a01-espelho-partido");
    expect(screen.getByRole("link", { name: "Ver" }).getAttribute("href")).toBe("/flair/jogos/a21-jogo-21");
    expect(screen.getAllByRole("link", { name: "Bloqueado" }).map((l) => l.getAttribute("href"))).toEqual(["/flair/jogos/a02-jogo-2", "/flair/jogos/a100-jogo-100"]);
    expect(calls.filter((c) => c.path.startsWith("/api/flair/games")).map((c) => c.path)).toEqual(["/api/flair/games"]);
  });

  it("filtros em chips: um valor por eixo, espelhado na URL e aplicado sobre a lista local; 'Só o que posso jogar'; limpar", async () => {
    const { calls } = loggedAs(ME, { "GET /api/flair/games": LIST });
    renderApp(<GamesCatalog />);
    await screen.findAllByRole("article");
    const level = screen.getByRole("group", { name: "Nível de XP" });
    expect(level.textContent).toContain("Básico"); expect(level.textContent).toContain("Studio"); expect(level.textContent).toContain("Loft");
    expect(screen.getByRole("group", { name: "Guarda-roupa" }).querySelectorAll("button").length).toBe(7);
    expect(screen.getByRole("group", { name: "Dificuldade" }).querySelectorAll("button").length).toBe(4);
    expect(screen.getByRole("group", { name: "Raridade" }).querySelectorAll("button").length).toBe(4);
    expect(screen.getByRole("group", { name: "Série" }).querySelectorAll("button").length).toBe(5);
    expect(screen.getByRole("group", { name: "Distrito" }).querySelectorAll("button").length).toBe(5);
    // série B: só a Passarela, com o contador do servidor no chip
    const serieB = screen.getByRole("button", { name: /Série B/ });
    expect(serieB.textContent).toContain("1");
    fireEvent.click(serieB);
    expect(serieB.getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith("/flair/jogos?series=B", { scroll: false }));
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("data-series"))).toEqual(["B"]);
    // trocar o valor do mesmo eixo, somar outro eixo, e tirar
    fireEvent.click(screen.getByRole("button", { name: /Série A/ }));
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith("/flair/jogos?series=A", { scroll: false }));
    expect(screen.getAllByRole("article").length).toBe(2);
    fireEvent.click(screen.getByRole("group", { name: "Nível de XP" }).querySelector("button:nth-child(3)")!);   /* Loft */
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith("/flair/jogos?level=LOFT&series=A", { scroll: false }));
    expect(screen.getAllByRole("article").map((a) => a.textContent)).toEqual([expect.stringContaining("Closet Lendário")]);
    // só o que posso jogar: o lendário sai; nada sobra → estado vazio
    fireEvent.click(screen.getByRole("button", { name: "Só o que posso jogar" }));
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith("/flair/jogos?level=LOFT&series=A&playable=1", { scroll: false }));
    expect(screen.getByText("Nenhum jogo com esses filtros")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith("/flair/jogos", { scroll: false }));
    expect(screen.getAllByRole("article").length).toBe(4);
    // busca por número
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar jogo por nome ou número" }), { target: { value: "100" } });
    await waitFor(() => expect(screen.getAllByRole("article").length).toBe(1));
    expect(screen.getByRole("article", { name: /Herança/ })).toBeTruthy();
    // a lista nunca refez a busca: o filtro é local
    expect(calls.filter((c) => c.path.startsWith("/api/flair/games")).length).toBe(1);
  });

  it("os filtros da URL entram ativos na abertura", async () => {
    search = "rarity=RARE&playable=1";
    loggedAs(ME, { "GET /api/flair/games": LIST });
    renderApp(<GamesCatalog />);
    await screen.findAllByRole("article");
    expect(screen.getByRole("button", { name: /^Rara/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Só o que posso jogar" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-labelledby"))).toEqual(["ge-card-g21"]);
    expect(replace).not.toHaveBeenCalled();
    await settle();
  });

  it("sem sessão no servidor (me null) convida a entrar; erro de rede mostra o erro, sem nenhum card para jogar", async () => {
    loggedAs(ME, { "GET /api/flair/games": { ...LIST, me: null, games: GAMES.map((g) => ({ ...g, access: { ...g.access, allowed: false, currentTier: null, currentWardrobeLevel: null } })) } });
    renderApp(<GamesCatalog />);
    expect(await screen.findByText("Entre para ver quais jogos já pode jogar.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Entrar" }).getAttribute("href")).toBe("/login");
    expect(screen.queryByRole("link", { name: "Jogar" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Bloqueado" }).length).toBe(4);
    cleanup();
    loggedAs(ME, { "GET /api/flair/games": () => new Response(JSON.stringify({ status: 500, code: "ERRO", message: "caiu" }), { status: 500, headers: { "content-type": "application/json" } }) });
    renderApp(<GamesCatalog />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Tentar de novo|Tentar novamente/ })).toBeTruthy());
    expect(screen.queryByRole("article")).toBeNull();
  });
});
