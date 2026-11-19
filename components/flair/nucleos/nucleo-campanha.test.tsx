// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NucleoScreen } from "@/components/flair/nucleos/nucleo-screen";
import { RASCUNHO_MS } from "@/components/flair/nucleos/use-rascunho";
import { limparSalvamento } from "@/lib/flair/nucleos/salvamento";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * Campanha, enredo e salvamento na tela, com a API simulada (auditoria de 15/11/2026, mudança 9): a escolha de rodada
 * marca as vencidas, mostra as estrelas e trava a que ainda não abriu; a história cita a última partida com os números
 * do servidor; depois de uma partida a campanha volta atualizada; e a tela diz o que foi salvo e quando.
 */
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams(""), usePathname: () => "/flair/3d" }));

const card = (id: string, name: string, position: string) => ({ id, originType: "PIECE", originId: `p-${id}`, season: "SPRING", tier: "PRATA", ovr: 70, rare: false, position, name, brandName: "Atelier Lumi", imageUrl: null, hype: null, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" });
const CARDS = { season: "SPRING", counts: {}, total: 3, cards: [card("c1", "Camisa verde", "SUP"), card("c2", "Calça linho", "INF"), card("c3", "Tênis azul", "CAL")] };
const DECK = { tamanhoMax: 6, obrigatorias: [{ posicao: "CAL", quantidade: 1 }], semDeck: false };
const rodada = (codigo: string) => ({ codigo, objetivo: { codigo, regras: [{ codigo: "VITORIA", pontos: 100 }, { codigo: "UM_ROUND", pontos: 50 }] } });
const LUTA = { codigo: "DRESS_FIGHTER", numero: 2, objetivo: rodada("VENCER_2_DE_3").objetivo, recursos: ["CARTAS"], vagas: ["SUP", "INF", "CAL", "ACE"], zonas: [], areas: [], opcoes: [], acoes: [], deck: DECK,
  rodadas: [rodada("VENCER_2_DE_3"), rodada("ARENA_VELOZ"), rodada("ARENA_BLINDADA")] };
const etapa = (codigo: string, ordem: number, over: Record<string, unknown> = {}) => ({ codigo, ordem, aberta: ordem === 1, vencida: false, estrelas: 0, pontos: 0, partidas: 0, vencidaEm: null, abreCom: null, ...over });
const NOVA = { nucleo: "DRESS_FIGHTER", emSequencia: true, porResposta: false, estrelas: 0, maximo: 9, vencidas: 0, total: 3, completo: false, ultima: null, enredo: { momento: "ABERTURA", proxima: "VENCER_2_DE_3" },
  rodadas: [etapa("VENCER_2_DE_3", 1), etapa("ARENA_VELOZ", 2, { abreCom: "VENCER_2_DE_3" }), etapa("ARENA_BLINDADA", 3, { abreCom: "ARENA_VELOZ" })] };
const VENCEU_A_PRIMEIRA = { ...NOVA, estrelas: 3, vencidas: 1, ultima: { rodada: "VENCER_2_DE_3", pontos: 100, estrelas: 3, resultado: "VITORIA", venceu: true, quando: "2026-11-19T14:00:00Z" },
  enredo: { momento: "TRANSICAO", proxima: "ARENA_VELOZ" },
  rodadas: [etapa("VENCER_2_DE_3", 1, { vencida: true, estrelas: 3, pontos: 100, partidas: 2, vencidaEm: "2026-11-19T14:00:00Z" }), etapa("ARENA_VELOZ", 2, { aberta: true }), etapa("ARENA_BLINDADA", 3, { abreCom: "ARENA_VELOZ" })] };
const botao = (codigo: string) => screen.getByTestId("nucleo-rounds").querySelector<HTMLButtonElement>(`[data-rodada="${codigo}"]`)!;

beforeEach(() => {
  localStorage.clear();
  limparSalvamento();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("escolha de arena com a campanha do servidor (DRESS_FIGHTER)", () => {
  it("quem nunca jogou lê a abertura, vê zero estrelas e só a primeira arena aberta; a fechada não se escolhe", async () => {
    loggedAs(ME, { "GET /api/flair/3d/nucleos/DRESS_FIGHTER": LUTA, "GET /api/me/flair/cards": CARDS, "GET /api/flair/3d/nucleos/DRESS_FIGHTER/progresso": NOVA });
    renderApp(<NucleoScreen nucleo="dress-fighter" />);
    const campanha = await screen.findByTestId("nucleo-campanha");
    expect(campanha.dataset.momento).toBe("ABERTURA");
    expect(within(campanha).getByTestId("nucleo-enredo").textContent).toContain("Você estreia no circuito de luta de estilo do bairro");
    expect(within(campanha).getByTestId("nucleo-campanha-total").textContent).toContain("0 de 9 estrelas no jogo · 0 de 3 rodadas vencidas");
    expect(botao("VENCER_2_DE_3").dataset.estado).toBe("aberta");
    expect(botao("ARENA_VELOZ").dataset.estado).toBe("fechada");
    expect(botao("ARENA_VELOZ").getAttribute("aria-disabled")).toBe("true");
    expect(botao("ARENA_VELOZ").textContent).toContain("Fechada: vença «Arena do bairro» para abrir");
    fireEvent.click(botao("ARENA_VELOZ"));
    expect(screen.queryByTestId("nucleo-deck")).toBeNull();
    fireEvent.click(botao("VENCER_2_DE_3"));
    expect(await screen.findByTestId("nucleo-deck")).toBeTruthy();
  });

  it("a arena vencida fica marcada com as estrelas e a nota, a seguinte abre e a história cita a luta que o servidor gravou", async () => {
    loggedAs(ME, { "GET /api/flair/3d/nucleos/DRESS_FIGHTER": LUTA, "GET /api/me/flair/cards": CARDS, "GET /api/flair/3d/nucleos/DRESS_FIGHTER/progresso": VENCEU_A_PRIMEIRA });
    renderApp(<NucleoScreen nucleo="dress-fighter" />);
    const campanha = await screen.findByTestId("nucleo-campanha");
    expect(within(campanha).getByTestId("nucleo-enredo").textContent).toBe("Em «Arena do bairro» você levou a luta com 100 pontos (3 estrelas). A notícia correu o beco, e a oponente de «Arena veloz» já mandou o desafio.");
    expect(within(campanha).getByTestId("nucleo-campanha-total").textContent).toContain("3 de 9 estrelas no jogo · 1 de 3 rodadas vencidas");
    const vencida = botao("VENCER_2_DE_3");
    expect(vencida.dataset.estado).toBe("vencida");
    expect(within(vencida).getByRole("img", { name: "3 de 3 estrelas" })).toBeTruthy();
    expect(vencida.querySelectorAll(".n3d-star.is-on")).toHaveLength(3);
    expect(within(vencida).getByTestId("nucleo-round-estado").textContent).toContain("Vencida · Melhor nota: 100 pontos · Vencida em");
    expect(botao("ARENA_VELOZ").dataset.estado).toBe("aberta");
    expect(botao("ARENA_VELOZ").textContent).toContain("A próxima da campanha");
    expect(botao("ARENA_BLINDADA").dataset.estado).toBe("fechada");
    expect(document.activeElement).toBe(botao("ARENA_VELOZ"));
  });

  it("sem a campanha (servidor fora do ar) a lista segue como antes: nada marcado, nada travado", async () => {
    loggedAs(ME, { "GET /api/flair/3d/nucleos/DRESS_FIGHTER": LUTA, "GET /api/me/flair/cards": CARDS });
    renderApp(<NucleoScreen nucleo="dress-fighter" />);
    await screen.findByTestId("nucleo-rounds");
    expect(screen.queryByTestId("nucleo-campanha")).toBeNull();
    expect(botao("ARENA_BLINDADA").dataset.estado).toBeUndefined();
    fireEvent.click(botao("ARENA_BLINDADA"));
    expect(await screen.findByTestId("nucleo-deck")).toBeTruthy();
  });
});

describe("jogo de uma rodada só: a trilha são as modalidades (FASHION_SPORTS)", () => {
  it("a campanha fica acima do deck, com as modalidades, as estrelas de cada uma e a derrota contada como derrota", async () => {
    const esporte = { codigo: "FASHION_SPORTS", numero: 14, objetivo: { codigo: "FUTEBOL_DE_5", regras: [{ codigo: "VITORIA", pontos: 100 }] }, recursos: ["CARTAS", "RESPOSTA"], vagas: ["SUP", "INF", "CAL"], zonas: [], areas: [],
      opcoes: ["FUTEBOL", "BASQUETE"], acoes: [], deck: { tamanhoMax: 15, obrigatorias: [], semDeck: false } };
    const progresso = { nucleo: "FASHION_SPORTS", emSequencia: false, porResposta: true, estrelas: 3, maximo: 6, vencidas: 1, total: 2, completo: false,
      ultima: { rodada: "BASQUETE", pontos: 0, estrelas: 0, resultado: "DERROTA", venceu: false, quando: "2026-11-19T14:00:00Z" }, enredo: { momento: "TRANSICAO", proxima: "BASQUETE" },
      rodadas: [etapa("FUTEBOL", 1, { vencida: true, estrelas: 3, pontos: 100, partidas: 1 }), etapa("BASQUETE", 2, { aberta: true, partidas: 1 })] };
    loggedAs(ME, { "GET /api/flair/3d/nucleos/FASHION_SPORTS": esporte, "GET /api/me/flair/cards": CARDS, "GET /api/flair/3d/nucleos/FASHION_SPORTS/progresso": progresso });
    renderApp(<NucleoScreen nucleo="fashion-sports" />);
    const campanha = await screen.findByTestId("nucleo-campanha");
    expect(await screen.findByTestId("nucleo-deck")).toBeTruthy();
    expect(within(campanha).getByTestId("nucleo-enredo").textContent).toContain("a vitória não veio: o time fez 0 pontos");
    expect(within(campanha).getByTestId("nucleo-campanha-total").textContent).toContain("3 de 6 estrelas no jogo · 1 de 2 modalidades vencidas");
    const trilha = within(campanha).getByTestId("nucleo-campanha-trilha");
    expect(trilha.querySelector('[data-etapa="FUTEBOL"]')?.className).toContain("is-vencida");
    expect(trilha.querySelector('[data-etapa="BASQUETE"]')?.className ?? "").not.toContain("is-vencida");
  });
});

describe("salvamento: o que foi salvo e quando", () => {
  const partida = { id: "m9", nucleo: "DRESS_FIGHTER", status: "ABERTA", semente: 7, deck: ["c1", "c2", "c3"], participantes: [], rodada: "VENCER_2_DE_3", abertura: {} };

  it("a retomada diz o que o servidor guardou e devolve às vagas o look em montagem que estava lá", async () => {
    const { calls } = loggedAs(ME, {
      "GET /api/flair/3d/nucleos/DRESS_FIGHTER": LUTA, "GET /api/me/flair/cards": CARDS,
      "GET /api/flair/3d/nucleos/DRESS_FIGHTER/em-andamento": { partida, vestidas: null, resultado: null, tentativa: null, atualizadaEm: "2026-11-19T14:32:00Z",
        rascunho: { cartas: { SUP: "c1", CAL: "c3" }, zonas: {}, maquiagem: {}, resposta: null }, salvo: { deck: 3, look: 0, etapas: 0, passos: 0, rascunho: 2 } },
      "PUT /api/flair/3d/partidas/m9/rascunho": { salvoEm: "2026-11-19T14:40:00Z", pecas: 1 },
    });
    renderApp(<NucleoScreen nucleo="dress-fighter" />);
    const continuar = await screen.findByTestId("nucleo-continuar");
    expect(within(continuar).getByTestId("nucleo-continuar-salvo").textContent).toBe("Guardado no servidor: deck de 3 cartas, look em montagem com 2 peças.");
    expect(continuar.textContent).toContain("Última jogada:");
    fireEvent.click(screen.getByRole("button", { name: "Continuar partida" }));
    await screen.findByTestId("nucleo-game");
    const regua = screen.getByTestId("nucleo-slot-ruler");
    expect(regua.querySelector('[data-slot="SUP"]')?.getAttribute("aria-label")).toContain("Camisa verde");
    expect(regua.querySelector('[data-slot="CAL"]')?.getAttribute("aria-label")).toContain("Tênis azul");
    expect(regua.querySelector('[data-slot="INF"]')?.className).not.toContain("is-filled");
    // o look com que a tela abriu não volta ao servidor; a mudança seguinte vai, pouco depois, e a tela diz a hora
    await new Promise((r) => setTimeout(r, RASCUNHO_MS + 150));
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
    fireEvent.keyDown(window, { key: " " });
    await waitFor(() => expect(calls.some((c) => c.method === "PUT" && c.path === "/api/flair/3d/partidas/m9/rascunho")).toBe(true), { timeout: RASCUNHO_MS + 2000 });
    const salvo = await screen.findByTestId("nucleo-salvo");
    expect(salvo.dataset.salvo).toBe("rascunho");
    expect(salvo.textContent).toMatch(/^Salvo no servidor às \d{1,2}:\d{2}: look em montagem\.$/);
  }, 15000);

  it("o resultado traz a campanha de volta do servidor, com a transição desta partida, e diz que o resultado foi salvo", async () => {
    let fechou = false;
    loggedAs(ME, {
      "GET /api/flair/3d/nucleos/DRESS_FIGHTER": LUTA, "GET /api/me/flair/cards": CARDS,
      "GET /api/flair/3d/nucleos/DRESS_FIGHTER/progresso": () => (fechou ? VENCEU_A_PRIMEIRA : NOVA),
      "GET /api/flair/3d/nucleos/DRESS_FIGHTER/em-andamento": { partida, vestidas: null, resultado: null, tentativa: null },
      "POST /api/flair/3d/partidas/m9/entrega": () => {
        fechou = true;
        return { pontos: 100, estrelas: 3, resultado: "VITORIA", status: "ENTREGUE", regras: [], eventos: [] };
      },
    });
    renderApp(<NucleoScreen nucleo="dress-fighter" />);
    fireEvent.click(await screen.findByRole("button", { name: "Continuar partida" }));
    await screen.findByTestId("nucleo-game");
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "Enter" });
    const pular = await screen.findByRole("button", { name: "Ver o resultado" }).catch(() => null);
    if (pular) fireEvent.click(pular);
    const resultado = await screen.findByTestId("nucleo-result", {}, { timeout: 6000 });
    const campanha = await within(resultado).findByTestId("nucleo-campanha");
    expect(within(campanha).getByTestId("nucleo-enredo").textContent).toContain("Em «Arena do bairro» você levou a luta com 100 pontos (3 estrelas)");
    expect(within(campanha).getByTestId("nucleo-campanha-total").textContent).toContain("3 de 9 estrelas no jogo");
    expect(within(resultado).getByTestId("nucleo-salvo").dataset.salvo).toBe("resultado");
    // jogar de novo: a escolha de arena já vem com a primeira vencida e a segunda aberta
    fireEvent.click(within(resultado).getByRole("button", { name: "Jogar de novo" }));
    await waitFor(() => expect(botao("ARENA_VELOZ").dataset.estado).toBe("aberta"));
    expect(botao("VENCER_2_DE_3").dataset.estado).toBe("vencida");
  }, 15000);
});
