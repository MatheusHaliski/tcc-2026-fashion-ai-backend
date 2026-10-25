// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlairModes, LeagueTable, type LeagueRow } from "./modes";
import { cleanup, fireEvent, loggedAs, ME, renderApp, screen, settle, waitFor, within } from "@/test-utils/render";
import type { FlairCard } from "./flair-card";
import type { ModeLook } from "./modes-shared";

/**
 * Painéis dos modos do FLAIR: cada modo abre na mesma tela (por `initial` ou clicando no card), monta a jogada com os
 * looks/cartas da pessoa, manda o corpo certo para a API e mostra o resultado (placar, rodadas, recompensa).
 */
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }), useSearchParams: () => new URLSearchParams(""), usePathname: () => "/flair" }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const THEME = { code: "GALA", label: "Gala", emoji: "🎭", occasions: [], styles: [], weights: {}, hint: "Noite de gala" };
const look = (id: string, title: string, extra: Partial<ModeLook> = {}): ModeLook => ({
  schemeId: id, title, owner: "ana", rating: 80, stats: { STYLE: 70, HYPE: 50 }, synergies: [{ code: "MONO", label: "Mono", emoji: "🖤", stat: "STYLE", bonus: 3 }], styles: [], occasions: [],
  cards: [{ id: `${id}-c`, name: "Peça", imageUrl: "/x.png", category: "upper_piece", rarity: "RARE", power: 50 }], ...extra,
});
const LOOKS = [look("s1", "Look Alfa", { coverUrl: "/capa.png" }), look("s2", "Look Beta"), look("s3", "Look Gama"), look("s4", "Look Delta")];
const card = (id: string, name: string, category = "upper_piece"): FlairCard => ({ id, name, category, subcategory: "tshirt", styles: [], occasions: [], season: "SPRING", stats: { EDGE: 50 }, rarity: "PREMIUM", multiplier: 1, power: 60 });
const CARDS = [card("k1", "Camiseta Azul"), card("k2", "Calça Preta", "lower_piece"), card("k3", "Tênis Branco", "shoes_piece"), card("k4", "Vestido", "full_body_piece")];

const RESULT = {
  mode: "BATTLE", outcome: "WIN", coins: 40, rewardCapReached: false, faiPoints: 5, scoreA: 3, scoreB: 1, theme: THEME,
  rounds: [
    { label: "Rodada Estilo", a: "Alfa", b: "Rival", scoreA: 80, scoreB: 60, winner: "A", notes: ["combo +3"], breakdown: [{ stat: "STYLE", label: "Style", weight: 1.5, a: 80, b: 60 }, { stat: "HYPE", label: "Hype", weight: 1, a: 40, b: 50 }] },
    { label: "Rodada Cor", a: "", b: "", scoreA: 50, scoreB: 70, winner: "B", notes: [], breakdown: [] },
    { label: "Rodada Empate", a: "x", b: "y", scoreA: 50, scoreB: 50, winner: "DRAW", notes: [], breakdown: [] },
  ],
};

const MODES = ["BATTLE", "SQUAD", "LEAGUE", "TOUR", "CONQUEST", "MONOPOLY", "DECK", "WARDROBE", "RUNWAY", "DRAFT", "TAG_TEAM", "BOSS", "COMBO", "CHESS", "ULTIMATE"]
  .map((code, i) => ({ code, name: `Modo ${code}`, emoji: "🎮", group: i % 2 ? "ESPECIAL" : "NUCLEO", summary: `resumo ${code}`, how: `como jogar ${code}` }));
const CATALOG = {
  architecture: [], modes: MODES, themes: [THEME], board: [], territories: [], chessBoard: [], roles: [], ethics: "Ética do jogo.", divisions: [],
  bosses: [{ code: "VOGUE", name: "Chefe Vogue", emoji: "👑", theme: "GALA", stats: { STYLE: 90, COLOR: 80 }, lesson: "Cor importa" }],
};

function base(extra: Record<string, unknown> = {}) {
  return loggedAs(ME, {
    "GET /api/flair/modes": CATALOG,
    "GET /api/flair/modes/looks": { looks: LOOKS },
    "GET /api/flair/modes/trophies": [{ id: "t1", title: "Campeã da Gala", mode: "BATTLE" }],
    "GET /api/me/points": { balance: 0, lifetime: 100, level: "STUDIO", levels: [], rules: [] },
    "GET /api/flair/cards": { cards: CARDS },
    ...extra,
  });
}

const btn = (name: string | RegExp) => screen.getByRole("button", { name });
const choose = (field: string, option: string | RegExp) => { fireEvent.click(screen.getByLabelText(field)); fireEvent.click(screen.getByRole("option", { name: option })); };
const pickLook = (title: string) => fireEvent.click(screen.getAllByRole("button", { name: new RegExp(title) })[0]);

describe("catálogo de modos", () => {
  it("lista os modos, mostra troféus e a nota de ética; clicar num modo abre o painel e voltar fecha", async () => {
    base();
    renderApp(<FlairModes />);
    expect(await screen.findByText("🏆 Campeã da Gala")).toBeTruthy();
    expect(screen.getByText(/Ética do jogo\./)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /Modo SQUAD/ }));
    expect(screen.getByRole("heading", { name: /Modo SQUAD/ })).toBeTruthy();
    expect(screen.getByText("Especial")).toBeTruthy();
    expect(screen.getByText("como jogar SQUAD")).toBeTruthy();
    fireEvent.click(btn("← Modos"));
    expect(screen.queryByRole("heading", { name: /Modo SQUAD/ })).toBeNull();
  });

  it("modo clássico aparece com o selo Clássico; erro do catálogo mostra o estado de erro", async () => {
    base({ "GET /api/flair/decks": [] });
    renderApp(<FlairModes />);
    fireEvent.click(await screen.findByRole("button", { name: /Duelo de estilo/ }));
    expect(await screen.findByText("Clássico")).toBeTruthy();
    cleanup();
    loggedAs(ME, { "GET /api/flair/modes": new Response(JSON.stringify({ status: 500, code: "ERRO", message: "falhou" }), { status: 500, headers: { "content-type": "application/json" } }) });
    renderApp(<FlairModes />);
    expect(await screen.findByRole("button", { name: /Tentar novamente|tentar/i })).toBeTruthy();
  });
});

describe("Battle of Looks", () => {
  it("sem look o botão fica desabilitado; com look, tema e oponente manda a batalha e mostra o resultado com rodadas", async () => {
    const onPlayed = vi.fn();
    const { calls } = base({ "POST /api/flair/modes/battle": { ...RESULT, me: LOOKS[0], opponent: { label: "@rival", look: LOOKS[1] } } });
    renderApp(<FlairModes initial="BATTLE" onPlayed={onPlayed} />);
    const play = await screen.findByRole("button", { name: "⚔️ Batalhar" });
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Look Alfa/ }).length).toBeGreaterThan(0));
    expect((play as HTMLButtonElement).disabled).toBe(true);
    pickLook("Look Alfa");
    expect(screen.getAllByRole("button", { name: /Look Alfa/ })[0].getAttribute("aria-pressed")).toBe("true");
    choose("Tema", "🎭 Gala");
    fireEvent.change(screen.getByPlaceholderText("@usuário"), { target: { value: "rival" } });
    fireEvent.click(play);
    expect(await screen.findByText("Vitória")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/flair/modes/battle")?.body).toEqual({ schemeId: "s1", opponent: "rival", theme: "GALA" });
    expect(screen.getByText("3 × 1")).toBeTruthy();
    expect(screen.getByText("+40 coins")).toBeTruthy();
    expect(screen.getByText("+5 FAI Pts")).toBeTruthy();
    expect(screen.getByText("Você × @rival")).toBeTruthy();
    expect(screen.getByText("combo +3")).toBeTruthy();
    expect(screen.getAllByText("🎭 Gala").length).toBeGreaterThan(0);
    // abrir a rodada mostra a tabela de pesos; clicar de novo fecha
    const round = screen.getByRole("button", { name: /Rodada Estilo/ });
    fireEvent.click(round);
    expect(round.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("×1.5")).toBeTruthy();
    fireEvent.click(round);
    expect(screen.queryByText("×1.5")).toBeNull();
    expect(screen.getByText("✔ Oponente")).toBeTruthy();
    expect(screen.getByText("✔ Você")).toBeTruthy();
    expect(onPlayed).toHaveBeenCalled();
  });

  it("escolher A Casa volta o oponente para a comunidade; teto diário aparece no lugar das moedas", async () => {
    const { calls } = base({ "POST /api/flair/modes/battle": { ...RESULT, outcome: "LOSS", rewardCapReached: true, faiPoints: 0, rounds: [] } });
    renderApp(<FlairModes initial="BATTLE" />);
    await screen.findByRole("button", { name: "⚔️ Batalhar" });
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Look Beta/ }).length).toBeGreaterThan(0));
    pickLook("Look Beta");
    fireEvent.change(screen.getByPlaceholderText("@usuário"), { target: { value: "x" } });
    fireEvent.click(btn("🏠 A Casa (comunidade)"));
    fireEvent.click(btn("⚔️ Batalhar"));
    expect(await screen.findByText("Derrota")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/flair/modes/battle")?.body).toEqual({ schemeId: "s2", opponent: "CASA", theme: null });
    expect(screen.getByText("teto diário de partidas premiadas neste modo")).toBeTruthy();
  });

  it("erro na jogada vira aviso e não mostra resultado", async () => {
    base({ "POST /api/flair/modes/battle": new Response(JSON.stringify({ status: 409, code: "LIMITE", message: "Sem partidas hoje" }), { status: 409, headers: { "content-type": "application/json" } }) });
    renderApp(<FlairModes initial="BATTLE" />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Look Alfa/ }).length).toBeGreaterThan(0));
    pickLook("Look Alfa");
    fireEvent.click(btn("⚔️ Batalhar"));
    expect(await screen.findByText("Sem partidas hoje")).toBeTruthy();
    expect(screen.queryByText("Vitória")).toBeNull();
  });
});

describe("Squad 5×5", () => {
  it("escala até 5 looks e manda os ids; sem looks avisa para criar um", async () => {
    const { calls } = base({ "POST /api/flair/modes/squad": { ...RESULT, outcome: "DRAW", rounds: [] } });
    renderApp(<FlairModes initial="SQUAD" />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Look Alfa/ }).length).toBeGreaterThan(0));
    expect(screen.getByText(/\(0\/5\)/)).toBeTruthy();
    pickLook("Look Alfa"); pickLook("Look Beta"); pickLook("Look Alfa");
    expect(screen.getByText(/\(1\/5\)/)).toBeTruthy();
    fireEvent.click(btn("👥 Jogar 5 × 5"));
    expect(await screen.findByText("Empate")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/flair/modes/squad")?.body).toEqual({ schemeIds: ["s2"], opponent: "CASA" });
    cleanup();
    base({ "GET /api/flair/modes/looks": { looks: [] } });
    renderApp(<FlairModes initial="SQUAD" />);
    expect(await screen.findByText("Crie um look com peças para ele virar um look jogável.")).toBeTruthy();
  });
});

describe("Fashion League", () => {
  const LEAGUE = {
    season: "S1", rule: "Regra da liga", division: { label: "Ouro" },
    roster: { starters: ["s1"], reserves: ["s2"], specials: ["k1"] },
    table: [{ position: 1, user: { ...ME.user }, played: 3, wins: 2, draws: 1, losses: 0, points: 7, stylePoints: 1234, division: { label: "Ouro" }, you: true }],
  };
  it("carrega o elenco salvo, salva titulares/reservas/especiais e joga a rodada", async () => {
    const { calls } = base({ "GET /api/flair/modes/league": LEAGUE, "PUT /api/flair/modes/league/roster": LEAGUE, "POST /api/flair/modes/league/play": { ...RESULT, rounds: [] } });
    renderApp(<FlairModes initial="LEAGUE" />);
    expect(await screen.findByText("Regra da liga")).toBeTruthy();
    expect(screen.getAllByText("Ouro").length).toBeGreaterThan(0);
    expect(screen.getByText("1.234")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Look Alfa/ })[0].getAttribute("aria-pressed")).toBe("true"));
    // titular novo sai das reservas
    pickLook("Look Beta");
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Carta Camiseta Azul/ }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: /Carta Calça Preta/ }));
    fireEvent.click(screen.getByRole("button", { name: /Carta Camiseta Azul/ }));
    fireEvent.click(btn("Salvar elenco"));
    expect(await screen.findByText("Elenco salvo.")).toBeTruthy();
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ starters: ["s1", "s2"], reserves: [], specials: ["k2"] });
    fireEvent.click(btn("🏆 Jogar rodada"));
    expect(await screen.findByText("Vitória")).toBeTruthy();
  });

  it("falha ao salvar o elenco vira aviso de erro", async () => {
    base({ "GET /api/flair/modes/league": { ...LEAGUE, roster: {} }, "PUT /api/flair/modes/league/roster": new Response(JSON.stringify({ status: 400, code: "X", message: "Elenco inválido" }), { status: 400, headers: { "content-type": "application/json" } }) });
    renderApp(<FlairModes initial="LEAGUE" />);
    await screen.findByText("Regra da liga");
    expect((btn("Salvar elenco") as HTMLButtonElement).disabled).toBe(true);
    expect((btn("🏆 Jogar rodada") as HTMLButtonElement).disabled).toBe(true);
    pickLook("Look Gama");
    fireEvent.click(btn("Salvar elenco"));
    expect(await screen.findByText("Elenco inválido")).toBeTruthy();
  });

  it("tabela vazia avisa que ninguém escalou; pontos caem para o alias antigo hype ou zero", () => {
    const row = (id: string, extra: Partial<LeagueRow>): LeagueRow => ({ position: 1, user: { ...ME.user, id, username: id }, played: 0, wins: 0, draws: 0, losses: 0, points: 0, division: { label: "Bronze" }, you: false, ...extra });
    renderApp(<LeagueTable rows={[row("a", { hype: 77 }), row("b", {})]} />);
    expect(screen.getByText("77")).toBeTruthy();
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    cleanup();
    renderApp(<LeagueTable rows={[]} />);
    expect(screen.getByText("Ninguém escalou o elenco nesta temporada ainda.")).toBeTruthy();
  });
});

describe("Fashion World Tour", () => {
  const BOARD = [
    { index: 0, city: "Paris", title: "Desfile", emoji: "🗼", type: "CHALLENGE", theme: "GALA", target: 70, reward: 20, rule: "nota 70" },
    { index: 1, city: "Paris", title: "Café", emoji: "☕", type: "BONUS", theme: "", target: 0, reward: 5, rule: "bônus" },
    { index: 2, city: "São Paulo", title: "Feira", emoji: "🎪", type: "CHALLENGE", theme: "", target: 60, reward: 15, rule: "nota 60" },
  ];
  const TOUR = { board: BOARD, cities: ["Paris", "São Paulo"], position: 0, lap: 1, points: 10, pending: null, log: [{ text: "Você andou 2 casas" }], rollsLeft: 2, rule: "Regra do tour" };
  it("rolar o dado move o peão e abre o desafio da casa; cumprir manda o look e atualiza o tabuleiro", async () => {
    const { calls } = base({
      "GET /api/flair/modes/tour": TOUR,
      "POST /api/flair/modes/tour/roll": { ...TOUR, position: 2, lastRoll: 3, pending: 2, rollsLeft: 1 },
      "POST /api/flair/modes/tour/resolve": { ...RESULT, rounds: [], tour: { ...TOUR, position: 2, points: 25, pending: null, rollsLeft: 1 } },
    });
    renderApp(<FlairModes initial="TOUR" />);
    expect(await screen.findByText("10 pontos")).toBeTruthy();
    expect(screen.getByText("volta 1")).toBeTruthy();
    expect(screen.getByText("Você andou 2 casas")).toBeTruthy();
    expect(screen.getByText("Regra do tour")).toBeTruthy();
    expect(screen.getAllByRole("listitem").some((li) => li.textContent?.includes("Paris"))).toBe(true);
    fireEvent.click(btn("🎲 Rolar o dado"));
    expect(await screen.findByLabelText("dado 3")).toBeTruthy();
    expect(screen.getByText("⚂")).toBeTruthy();
    expect(screen.getByText(/alvo 60, vale 15/)).toBeTruthy();
    pickLook("Look Alfa");
    fireEvent.click(btn("Cumprir o desafio"));
    expect(await screen.findByText("25 pontos")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/flair/modes/tour/resolve")?.body).toEqual({ schemeId: "s1" });
    expect(screen.getByText("Vitória")).toBeTruthy();
  });

  it("sem rolagens o dado fica desabilitado; erro ao rolar vira aviso", async () => {
    base({ "GET /api/flair/modes/tour": { ...TOUR, rollsLeft: 0 } });
    renderApp(<FlairModes initial="TOUR" />);
    expect(((await screen.findByRole("button", { name: "🎲 Rolar o dado" })) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    base({ "GET /api/flair/modes/tour": TOUR, "POST /api/flair/modes/tour/roll": new Response(JSON.stringify({ status: 429, code: "X", message: "Dado cansado" }), { status: 429, headers: { "content-type": "application/json" } }) });
    renderApp(<FlairModes initial="TOUR" />);
    fireEvent.click(await screen.findByRole("button", { name: "🎲 Rolar o dado" }));
    expect(await screen.findByText("Dado cansado")).toBeTruthy();
  });
});

describe("Conquest e Monopoly", () => {
  const TERR = (mine: boolean, owner: unknown, defenders: { title: string; rating: number }[] = []) => ({ territory: { map: "CONQUEST", code: mine ? "T-MINE" : owner ? "T-OWN" : "T-FREE", name: mine ? "Minha Região" : owner ? "Região Ocupada" : "Região Livre", emoji: "🗺️", style: "", theme: "", bonus: "+5 cor" }, theme: THEME, owner, mine, defenders, defenses: 0 });
  it("Conquest: escolhe uma região livre, exige 3 looks, ataca e comemora a captura", async () => {
    const { calls } = base({
      "GET /api/flair/modes/territories": { territories: [TERR(false, null), TERR(true, ME.user), TERR(false, { ...ME.user, username: "bia" }, [{ title: "Look Defesa", rating: 70 }])], rule: "Regra da conquista.", mine: 1 },
      "POST /api/flair/modes/territories/CONQUEST/T-FREE/attack": { ...RESULT, rounds: [], captured: true },
    });
    renderApp(<FlairModes initial="CONQUEST" />);
    expect(await screen.findByText("Regra da conquista. Você domina 1.")).toBeTruthy();
    expect(screen.getByText("livre (Casa defende)")).toBeTruthy();
    expect(screen.getByText(/@ana· seu/)).toBeTruthy();
    expect(screen.getByText(/Look Defesa/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Minha Região/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Região Livre/ }));
    expect(screen.getByText(/3 looks de ataque/)).toBeTruthy();
    const attack = btn("🗺️ Conquistar região");
    pickLook("Look Alfa"); pickLook("Look Beta");
    expect((attack as HTMLButtonElement).disabled).toBe(true);
    pickLook("Look Gama"); pickLook("Look Delta");
    fireEvent.click(attack);
    expect(await screen.findByText(/Seu Lookbook conquistou a região!/)).toBeTruthy();
    expect(calls.find((c) => c.path.endsWith("/attack"))?.body).toEqual({ schemeIds: ["s1", "s2", "s3"] });
    expect(screen.getByText("Você × Defensor")).toBeTruthy();
  });

  it("Monopoly: um look basta e tomar o distrito mostra que ele é seu", async () => {
    base({
      "GET /api/flair/modes/territories": { territories: [TERR(false, null)], rule: "Regra.", mine: 0 },
      "POST /api/flair/modes/territories/MONOPOLY/T-FREE/attack": { ...RESULT, rounds: [], captured: true },
    });
    renderApp(<FlairModes initial="MONOPOLY" />);
    fireEvent.click(await screen.findByRole("button", { name: /Região Livre/ }));
    expect(screen.getByText("Look de ataque")).toBeTruthy();
    pickLook("Look Alfa");
    fireEvent.click(btn("🏙️ Tomar o distrito"));
    expect(await screen.findByText(/O distrito agora é seu!/)).toBeTruthy();
  });
});

describe("Deck Battle", () => {
  it("monta o deck (sugestão, alternar cartas), salva e joga a mão com a dica da IA", async () => {
    const { calls } = base({
      "GET /api/flair/modes/deck": { cards: [CARDS[0]], valid: true, suggestion: ["k1", "k2", "k3", "k4"] },
      "PUT /api/flair/modes/deck": { cards: CARDS, valid: true, suggestion: [] },
      "POST /api/flair/modes/deck/battle": { id: "g1", challenge: THEME, hand: [CARDS[0], CARDS[1], CARDS[2]], hint: ["k1", "k2"] },
      "POST /api/flair/modes/deck/battle/g1/play": { ...RESULT, rounds: [] },
    });
    renderApp(<FlairModes initial="DECK" />);
    await waitFor(() => expect(screen.getByText(/1\/12/)).toBeTruthy());
    expect(screen.getByText(/superiores 1\/4/)).toBeTruthy();
    fireEvent.click(btn("Usar sugestão"));
    expect(screen.getByText(/4\/12/)).toBeTruthy();
    // vestido conta como superior
    expect(screen.getByText(/superiores 2\/4/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /Carta Tênis Branco/ })[0]);
    expect(screen.getByText(/3\/12/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /Carta Tênis Branco/ })[0]);
    expect((btn("Salvar deck") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn("🃏 Nova partida"));
    expect(await screen.findByText(/monte o melhor look/)).toBeTruthy();
    const jogar = btn("Jogar look");
    expect((jogar as HTMLButtonElement).disabled).toBe(true);
    const hand = screen.getByText(/monte o melhor look/).parentElement!;
    fireEvent.click(within(hand).getByRole("button", { name: /Carta Tênis Branco/ }));
    fireEvent.click(within(hand).getByRole("button", { name: /Carta Tênis Branco/ }));
    fireEvent.click(btn("Dica da IA"));
    fireEvent.click(jogar);
    expect(await screen.findByText("Vitória")).toBeTruthy();
    expect(calls.find((c) => c.path.endsWith("/g1/play"))?.body).toEqual({ pieceIds: ["k1", "k2"] });
    expect(screen.getByText("Você × A Casa")).toBeTruthy();
  });

  it("salvar um deck de 12 cartas manda as peças; erro ao salvar avisa", async () => {
    const many = Array.from({ length: 13 }, (_, i) => card(`m${i}`, `Carta${i}`));
    const { calls } = base({
      "GET /api/flair/cards": { cards: many },
      "GET /api/flair/modes/deck": { cards: many.slice(0, 12), valid: false, suggestion: [] },
      "PUT /api/flair/modes/deck": new Response(JSON.stringify({ status: 400, code: "X", message: "Deck inválido" }), { status: 400, headers: { "content-type": "application/json" } }),
    });
    renderApp(<FlairModes initial="DECK" />);
    await waitFor(() => expect(screen.getByText(/12\/12/)).toBeTruthy());
    // a 13ª não entra
    fireEvent.click(screen.getByRole("button", { name: /Carta Carta12,/ }));
    expect(screen.getByText(/12\/12/)).toBeTruthy();
    expect((btn("🃏 Nova partida") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn("Salvar deck"));
    expect(await screen.findByText("Deck inválido")).toBeTruthy();
    expect((calls.find((c) => c.method === "PUT")?.body as { pieceIds: string[] }).pieceIds).toHaveLength(12);
  });
});

describe("Wardrobe Wars, Tag Team e Combo", () => {
  it("Wardrobe Wars exige o @ do adversário e manda o confronto", async () => {
    const { calls } = base({ "POST /api/flair/modes/wardrobe-wars": { ...RESULT, rounds: [] } });
    renderApp(<FlairModes initial="WARDROBE" />);
    const go = await screen.findByRole("button", { name: "🧥 Guarda-roupa × guarda-roupa" });
    expect((go as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("🏠 A Casa (comunidade)")).toBeNull();
    fireEvent.change(screen.getByLabelText("Guarda-roupa adversário"), { target: { value: "bia" } });
    fireEvent.click(go);
    expect(await screen.findByText("Vitória")).toBeTruthy();
    expect(calls.find((c) => c.path.endsWith("/wardrobe-wars"))?.body).toEqual({ opponent: "bia" });
  });

  it("Tag Team manda dupla e adversários (só quando os dois são informados) e mostra a harmonia", async () => {
    const { calls } = base({ "POST /api/flair/modes/tag-team": { ...RESULT, rounds: [], teamA: { harmony: 88 }, teamB: { harmony: 70 } } });
    renderApp(<FlairModes initial="TAG_TEAM" />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Look Alfa/ }).length).toBeGreaterThan(0));
    pickLook("Look Alfa");
    const go = btn("🤝 Jogar em dupla");
    expect((go as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Sua dupla (@usuário)"), { target: { value: "bia" } });
    fireEvent.change(screen.getByLabelText("Adversário 1 (opcional)"), { target: { value: "c1" } });
    fireEvent.click(go);
    expect(await screen.findByText("88")).toBeTruthy();
    expect(calls.find((c) => c.path.endsWith("/tag-team"))?.body).toEqual({ schemeId: "s1", partner: "bia", opponents: [] });
    expect(screen.getByText("Sua dupla × Dupla adversária")).toBeTruthy();
  });

  it("Tag Team com os dois adversários manda a lista", async () => {
    const { calls } = base({ "POST /api/flair/modes/tag-team": { ...RESULT, rounds: [] } });
    renderApp(<FlairModes initial="TAG_TEAM" />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Look Alfa/ }).length).toBeGreaterThan(0));
    pickLook("Look Alfa");
    fireEvent.change(screen.getByLabelText("Sua dupla (@usuário)"), { target: { value: "bia" } });
    fireEvent.change(screen.getByLabelText("Adversário 1 (opcional)"), { target: { value: "c1" } });
    fireEvent.change(screen.getByLabelText("Adversário 2 (opcional)"), { target: { value: "c2" } });
    fireEvent.click(btn("🤝 Jogar em dupla"));
    await screen.findByText("Vitória");
    expect(calls.find((c) => c.path.endsWith("/tag-team"))?.body).toMatchObject({ opponents: ["c1", "c2"] });
  });

  it("Combo Battle mostra o livro de combos padrão e troca pelo do resultado", async () => {
    const { calls } = base({ "POST /api/flair/modes/combo": { ...RESULT, rounds: [], comboBook: ["Combo novo +7"] } });
    renderApp(<FlairModes initial="COMBO" />);
    expect(await screen.findByText(/Streetwear Combo/)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Look Alfa/ }).length).toBeGreaterThan(0));
    pickLook("Look Alfa");
    fireEvent.click(btn("⚡ Combo Battle"));
    expect(await screen.findByText("Combo novo +7")).toBeTruthy();
    expect(screen.queryByText(/Streetwear Combo/)).toBeNull();
    expect(calls.find((c) => c.path.endsWith("/combo"))?.body).toEqual({ schemeId: "s1", opponent: "CASA" });
  });
});

describe("Runway", () => {
  const INFO = { theme: THEME, week: "W1", season: "S2", rule: "Regra do desfile", entry: null };
  it("desfila um look e mostra colocação, cartão-troféu e as etapas", async () => {
    const stages = [
      { stage: "Seletiva", results: [{ title: "Look Alfa", owner: "ana", score: 90, you: true, advanced: true }, { title: "Outro", owner: "bia", score: 50, advanced: false }] },
      { stage: "Final", results: [{ a: "Alfa", b: "Rival", scoreA: 9, scoreB: 7, winner: "A" }, { a: "C", b: "D", scoreA: 1, scoreB: 2, winner: "B" }] },
    ];
    const { calls } = base({ "GET /api/flair/modes/runway": INFO, "POST /api/flair/modes/runway": { ...RESULT, rounds: [], stages, place: "1º lugar", card: "Troféu Gala" } });
    renderApp(<FlairModes initial="RUNWAY" />);
    expect(await screen.findByText("Regra do desfile")).toBeTruthy();
    expect(screen.getByText(/Season S2/)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Look Alfa/ }).length).toBeGreaterThan(0));
    pickLook("Look Alfa");
    fireEvent.click(btn("✨ Desfilar"));
    expect(await screen.findByText("1º lugar")).toBeTruthy();
    expect(screen.getByText("Troféu Gala")).toBeTruthy();
    expect(screen.getByText("✔ Look Alfa (@ana) — 90")).toBeTruthy();
    expect(screen.getByText("· Outro (@bia) — 50")).toBeTruthy();
    expect(screen.getByText("Alfa 9 × 7 Rival → ◀")).toBeTruthy();
    expect(screen.getByText("C 1 × 2 D → ▶")).toBeTruthy();
    expect(calls.find((c) => c.method === "POST" && c.path === "/api/flair/modes/runway")?.body).toEqual({ schemeId: "s1" });
  });

  it("quem já desfilou vê a inscrição salva sem o botão; cartão 'null' não aparece", async () => {
    base({ "GET /api/flair/modes/runway": { ...INFO, entry: { place: "Top 8", card: "null", stages: [] } } });
    renderApp(<FlairModes initial="RUNWAY" />);
    expect(await screen.findByText("Top 8")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "✨ Desfilar" })).toBeNull();
    expect(screen.queryByText("aparece no seu perfil")).toBeNull();
  });
});

describe("Draft", () => {
  const D = { id: "d1", status: "OPEN", pool: [CARDS[0], CARDS[1]], mine: [], theirs: [CARDS[2]], pick: 0, turn: "A", order: "A-B", themes: [THEME] };
  it("começa o draft, escolhe cartas, distribui nos looks e enfrenta a IA", async () => {
    const mine = [card("x1", "Peça Um"), card("x2", "Peça Dois"), card("x3", "Peça Três"), card("x4", "Peça Quatro"), card("x5", "Peça Cinco"), card("x6", "Peça Seis")];
    const { calls } = base({
      "POST /api/flair/modes/draft": D,
      "POST /api/flair/modes/draft/d1/pick": { ...D, pick: 19, turn: "COMPOSE", mine, theirs: [] },
      "POST /api/flair/modes/draft/d1/looks": { ...RESULT, rounds: [] },
    });
    renderApp(<FlairModes initial="DRAFT" />);
    fireEvent.click(await screen.findByRole("button", { name: "🧩 Novo draft" }));
    expect(await screen.findByText(/sua vez/)).toBeTruthy();
    expect(screen.getByText("Escolhas da IA (1)")).toBeTruthy();
    expect(screen.getByText("Tênis Branco")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Carta Camiseta Azul/ }));
    expect(await screen.findByText(/monte seus 3 looks/)).toBeTruthy();
    expect(screen.getByText(/escolha 20\/20/)).toBeTruthy();
    const go = btn("Enfrentar a IA");
    expect((go as HTMLButtonElement).disabled).toBe(true);
    // Um/Dois → look 1; Três/Quatro → look 2; Cinco/Seis → look 3 (cada clique avança o look, 4 volta a 0)
    const tap = (name: string, n: number) => { for (let i = 0; i < n; i++) fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}`) })); };
    tap("Peça Um", 1); tap("Peça Dois", 1); tap("Peça Três", 2); tap("Peça Quatro", 2); tap("Peça Cinco", 3); tap("Peça Seis", 4); tap("Peça Seis", 3);
    expect(screen.getByRole("button", { name: /^Peça Um/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /^Peça Três/ }).textContent).toContain("look 2");
    fireEvent.click(go);
    expect(await screen.findByText("Vitória")).toBeTruthy();
    expect(calls.find((c) => c.path.endsWith("/d1/looks"))?.body).toEqual({ looks: [["x1", "x2"], ["x3", "x4"], ["x5", "x6"]] });
    expect(calls.find((c) => c.path.endsWith("/pick"))?.body).toEqual({ pieceId: "k1" });
    expect(screen.getByText("Você × IA do Draft")).toBeTruthy();
  });

  it("vez da IA esconde o monte; erro na escolha avisa", async () => {
    base({ "POST /api/flair/modes/draft": { ...D, turn: "B" } });
    renderApp(<FlairModes initial="DRAFT" />);
    fireEvent.click(await screen.findByRole("button", { name: "🧩 Novo draft" }));
    expect(await screen.findByText(/vez da IA/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Carta Camiseta Azul/ })).toBeNull();
    cleanup();
    base({ "POST /api/flair/modes/draft": D, "POST /api/flair/modes/draft/d1/pick": new Response(JSON.stringify({ status: 409, code: "X", message: "Não é sua vez" }), { status: 409, headers: { "content-type": "application/json" } }) });
    renderApp(<FlairModes initial="DRAFT" />);
    fireEvent.click(await screen.findByRole("button", { name: "🧩 Novo draft" }));
    fireEvent.click(await screen.findByRole("button", { name: /Carta Camiseta Azul/ }));
    expect(await screen.findByText("Não é sua vez")).toBeTruthy();
  });
});

describe("Boss", () => {
  it("escolher o boss mostra a lição, aceita de 1 a 3 looks e enfrenta", async () => {
    const { calls } = base({ "POST /api/flair/modes/bosses/VOGUE": { ...RESULT, rounds: [] } });
    renderApp(<FlairModes initial="BOSS" />);
    const boss = await screen.findByRole("button", { name: /Chefe Vogue/ });
    expect(boss.textContent).toContain("Style 90 · Color Harmony 80");
    expect(boss.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(boss);
    expect(boss.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("💡 Cor importa")).toBeTruthy();
    const go = btn("Enfrentar Chefe Vogue");
    expect((go as HTMLButtonElement).disabled).toBe(true);
    pickLook("Look Alfa");
    fireEvent.click(go);
    expect(await screen.findByText("Você × Chefe Vogue")).toBeTruthy();
    expect(calls.find((c) => c.path.endsWith("/VOGUE"))?.body).toEqual({ schemeIds: ["s1"] });
  });
});

describe("Chess", () => {
  const CHESS = { slots: ["TOP", "HERO", "SUPPORT", "SHOES_L"], cards: [{ ...CARDS[0], imageUrl: "/a.png" }, CARDS[1], CARDS[2]], suggestion: { TOP: "k1", HERO: "k2", SUPPORT: "k3" }, rules: ["Regra do xadrez"] };
  it("posiciona cartas nas casas, esvazia uma casa, usa a sugestão e joga mostrando os bônus", async () => {
    const { calls } = base({
      "GET /api/flair/modes/chess": CHESS,
      "POST /api/flair/modes/chess": { ...RESULT, rounds: [], me: { bonuses: ["Bônus herói"] }, opponent: { label: "IA", board: { bonuses: ["Bônus IA"] }, cards: {} } },
    });
    renderApp(<FlairModes initial="CHESS" />);
    expect(await screen.findByText("Regra do xadrez")).toBeTruthy();
    const grid = screen.getByRole("grid", { name: "Tabuleiro 3×3" });
    expect(within(grid).getAllByText("vazio")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: /Carta Camiseta Azul/ }));
    fireEvent.click(within(grid).getByRole("button", { name: /Top/ }));
    expect(within(grid).getByText("Camiseta Azul")).toBeTruthy();
    // a mesma carta movida para outra casa sai da anterior
    fireEvent.click(screen.getByRole("button", { name: /Carta Camiseta Azul/ }));
    fireEvent.click(within(grid).getByRole("button", { name: /HERO/ }));
    expect(within(grid).getAllByText("vazio")).toHaveLength(3);
    // tocar na casa ocupada esvazia
    fireEvent.click(within(grid).getByRole("button", { name: /HERO/ }));
    expect(within(grid).getAllByText("vazio")).toHaveLength(4);
    const go = btn("♟️ Jogar contra a IA");
    expect((go as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn("Sugestão"));
    expect(within(grid).getAllByText("vazio")).toHaveLength(1);
    fireEvent.click(go);
    expect(await screen.findByText("Bônus herói")).toBeTruthy();
    expect(screen.getByText("Bônus IA")).toBeTruthy();
    expect(calls.find((c) => c.method === "POST" && c.path.endsWith("/chess"))?.body).toEqual({ board: { TOP: "k1", HERO: "k2", SUPPORT: "k3" } });
  });
});

describe("Ultimate Team", () => {
  const UT = {
    roles: ["ICON", "WILD_CARD"], roster: { ICON: { look: LOOKS[0], value: 80 }, WILD_CARD: null }, team: { rating: 81, chemistry: 70 },
    suggestion: { ICON: "s2", WILD_CARD: null }, roleHelp: { ICON: "o look-símbolo", WILD_CARD: "livre" },
  };
  it("preenche funções pelo elenco salvo, aplica a sugestão, salva e joga", async () => {
    const { calls } = base({ "GET /api/flair/modes/ultimate": UT, "PUT /api/flair/modes/ultimate": UT, "POST /api/flair/modes/ultimate/play": { ...RESULT, rounds: [] } });
    renderApp(<FlairModes initial="ULTIMATE" />);
    expect(await screen.findByText("Team Rating")).toBeTruthy();
    expect(screen.getByText("Chemistry")).toBeTruthy();
    const icon = screen.getByLabelText("ICON — o look-símbolo");
    await waitFor(() => expect(icon.textContent).toContain("Look Alfa"));
    const wild = screen.getByLabelText("WILD CARD — livre");
    // o look já usado em outra função fica desabilitado
    fireEvent.click(wild);
    expect(screen.getByRole("option", { name: /Look Alfa/ }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(screen.getByRole("option", { name: /Look Gama/ }));
    expect(wild.textContent).toContain("Look Gama");
    fireEvent.click(btn("Sugestão por função"));
    expect(icon.textContent).toContain("Look Beta");
    expect(wild.textContent).toContain("—");
    fireEvent.click(btn("Salvar FLAIR Team"));
    expect(await screen.findByText("FLAIR Team salvo.")).toBeTruthy();
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ roles: { ICON: "s2" } });
    fireEvent.click(btn("🌟 Jogar função × função"));
    await screen.findByText("Vitória");
    expect(calls.find((c) => c.path.endsWith("/ultimate/play"))?.body).toEqual({ opponent: "CASA" });
  });

  it("erro ao salvar o time vira aviso", async () => {
    base({ "GET /api/flair/modes/ultimate": UT, "PUT /api/flair/modes/ultimate": new Response(JSON.stringify({ status: 400, code: "X", message: "Time inválido" }), { status: 400, headers: { "content-type": "application/json" } }) });
    renderApp(<FlairModes initial="ULTIMATE" />);
    fireEvent.click(await screen.findByRole("button", { name: "Salvar FLAIR Team" }));
    expect(await screen.findByText("Time inválido")).toBeTruthy();
    await settle();
  });
});
