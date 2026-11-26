// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NucleoScreen } from "@/components/flair/nucleos/nucleo-screen";
import { cartasDaMao } from "@/components/flair/esporte/esporte-painel";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * Fashion Sports jogado por cartas, com a API simulada: depois de vestir o uniforme, o palco vira a transmissão (no
 * jsdom, o campo visto de cima) com o placar de TV e o relógio; a faixa de baixo mostra a situação, a janela da jogada
 * e a mão, cada carta com a ação da cor e o poder; jogar a carta manda a jogada ao servidor; seguir sem carta manda a
 * jogada vazia; no fim, o resultado traz o resumo da partida e que peça fez cada lance.
 */
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams(""), usePathname: () => "/flair/3d" }));

const card = (id: string, name: string, position: string) => ({ id, originType: "PIECE", originId: `p-${id}`, season: "SPRING", tier: "PRATA", ovr: 70, rare: false, position, name, brandName: "Atelier Lumi", imageUrl: null, hype: null, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" });
const CARDS = { season: "SPRING", counts: { ESPECIAL: 0, OURO: 0, PRATA: 6, BRONZE: 0 }, total: 6, cards: [card("u1", "Camisa azul", "SUP"), card("u2", "Calção branco", "INF"), card("u3", "Chuteira preta", "CAL"), card("m1", "Lenço vermelho", "ACE"), card("m2", "Boné verde", "ACE"), card("m3", "Cinto cinza", "ACE")] };
const DEF = { codigo: "FASHION_SPORTS", numero: 14, objetivo: { codigo: "FUTEBOL_DE_5", regras: [{ codigo: "VITORIA", pontos: 100 }] }, recursos: ["CARTAS", "RESPOSTA"], vagas: ["SUP", "INF", "CAL"], zonas: [], areas: [], opcoes: ["FUTEBOL", "BASQUETE"], acoes: [], deck: { tamanhoMax: 15, obrigatorias: [{ posicao: "SUP", quantidade: 1 }], semDeck: false } };
const EFEITOS = { efeitos: [
  { cardId: "u1", itens: [{ codigo: "PODER", valor: 7 }, { codigo: "ACAO_CORRIDA", valor: 4 }] },
  { cardId: "m1", itens: [{ codigo: "PODER", valor: 21 }, { codigo: "ACAO_PASSE", valor: 5 }] },
  { cardId: "m2", itens: [{ codigo: "PODER", valor: 30 }, { codigo: "ACAO_CHUTE", valor: 2 }] },
  { cardId: "m3", itens: [{ codigo: "PODER", valor: 6 }, { codigo: "ACAO_TOQUE", valor: 0 }] },
] };
const jogada = (n: number, tipo: string, over: Record<string, unknown> = {}) => ({ codigo: "JOGADA", valor: { n, jogada: n, tempo: 1, relogio: (n - 1) * 150, tipo, time: "NOS", ok: true, jogador: 3, alvo: 4, de: [45, 30], para: [70, 28], placar: "0-0", ...over } });
const situacao = (n: number, over: Record<string, unknown> = {}) => ({ codigo: "SITUACAO", valor: { jogada: n, total: 16, tempo: 1, relogio: (n - 1) * 150, posse: "NOS", zona: 1, goleiroPronto: false, mao: ["m1", "m2", "m3"], baralho: 0, placar: "0-0", ...over } });
/** cada lance fica 1,7 s na tela: as esperas do teste precisam de mais que o segundo padrão */
const LONGO = { timeout: 6000 };
const INICIO = [{ codigo: "MODALIDADE", valor: "FUTEBOL" }, jogada(1, "SAIDA")];

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function vestirEEntregar() {
  const deck = await screen.findByTestId("nucleo-deck");
  deck.querySelectorAll<HTMLButtonElement>(".n3d-deck-card").forEach((b) => fireEvent.click(b));
  fireEvent.click(within(deck).getByRole("button", { name: "Entrar na partida" }));
  await screen.findByTestId("nucleo-game");
  // o uniforme inteiro: parte de cima, de baixo e calçado (uma aba por vaga)
  // ✕ veste, △ (I) passa à aba seguinte, Enter entrega
  for (const tecla of [" ", "i", " ", "i", " ", "Enter"]) fireEvent.keyDown(window, { key: tecla });
}

describe("partida jogada por cartas", () => {
  it("transmissão com placar e relógio; a mão mostra ação e poder; cada carta jogada é uma jogada no servidor", async () => {
    const passe = jogada(2, "PASSE", { carta: "m1", acao: "PASSE", relogio: 150 });
    const gol = jogada(3, "CHUTE_GOL", { carta: "m2", acao: "CHUTE", relogio: 300, jogador: 5, de: [70, 28], para: [100, 30], placar: "1-0" });
    const respostas = [
      { pontos: 0, estrelas: 0, resultado: "EM_ACAO", status: "EM_ACAO", regras: [], eventos: [...INICIO, passe, situacao(2, { zona: 2, mao: ["m2", "m3", "m1"] })] },
      { pontos: 0, estrelas: 0, resultado: "EM_ACAO", status: "EM_ACAO", regras: [], eventos: [...INICIO, passe, gol, situacao(3, { posse: "ELES", zona: 1, placar: "1-0", mao: ["m3", "m1", "m2"] })] },
      { pontos: 100, estrelas: 3, resultado: "VITORIA", status: "ENTREGUE", regras: [{ codigo: "VITORIA", ok: true, pontos: 100 }, { codigo: "EMPATE", ok: false, pontos: 0 }],
        eventos: [...INICIO, passe, gol, jogada(4, "RIVAL_AVANCA", { time: "ELES", relogio: 450, placar: "1-0" }),
          { codigo: "RESUMO", valor: { posse: [67, 33], chutes: [1, 0], noGol: [1, 0], defesas: [0, 0], desarmes: [0, 0], passes: [1, 1], cartas: 2 } }, { codigo: "PLACAR", valor: "1-0" }] },
    ];
    const { calls } = loggedAs(ME, {
      "GET /api/flair/3d/nucleos/FASHION_SPORTS": DEF,
      "GET /api/me/flair/cards": CARDS,
      "POST /api/flair/3d/nucleos/FASHION_SPORTS/efeitos": EFEITOS,
      "POST /api/flair/3d/nucleos/FASHION_SPORTS/partidas": { id: "m14", nucleo: "FASHION_SPORTS", status: "ABERTA", semente: 7 },
      "POST /api/flair/3d/partidas/m14/previa": { pontos: 0, estrelas: 0, resultado: "PREVIA", regras: [], eventos: [{ codigo: "FISICO", valor: 18 }], status: "ABERTA" },
      "POST /api/flair/3d/partidas/m14/entrega": { pontos: 0, estrelas: 0, resultado: "EM_ACAO", status: "EM_ACAO", regras: [], eventos: [...INICIO, situacao(1)] },
      "POST /api/flair/3d/partidas/m14/acionar": () => respostas.shift(),
    });
    renderApp(<NucleoScreen nucleo="fashion-sports" />);
    await vestirEEntregar();

    const palco = await screen.findByTestId("esporte-palco");
    expect(screen.queryByTestId("nucleo-stage")).toBeNull();
    expect(palco.getAttribute("data-modalidade")).toBe("FUTEBOL");
    expect((await within(palco).findByTestId("esporte-planta")).querySelectorAll("[data-jogador]")).toHaveLength(10);
    expect(within(palco).getByTestId("esporte-bola")).toBeTruthy();
    const placar = within(palco).getByTestId("esporte-placar");
    expect(placar.textContent).toContain("Seu time");
    expect(placar.textContent).toContain("0 × 0");
    expect(placar.textContent).toContain("1º tempo");
    expect(within(palco).getByTestId("esporte-relogio").textContent).toBe("00:00");
    expect((await within(palco).findByTestId("esporte-narracao")).textContent).toBe("0' Saída de bola com Seu time");

    // a mão: cada carta com a ação da cor e o poder; a situação em uma frase e a janela da jogada
    const painel = await screen.findByTestId("esporte-painel");
    await waitFor(() => expect(painel.getAttribute("data-aberta")).toBe("true"), LONGO);
    expect(screen.getByTestId("esporte-situacao").textContent).toContain("Jogada 1 de 16. Você tem a bola no meio-campo.");
    expect(screen.getByTestId("esporte-janela").textContent).toBe("Escolha a carta em 30 s");
    const mao = within(painel).getAllByRole("button", { name: /^Jogar / });
    expect(mao.map((b) => b.getAttribute("aria-label"))).toEqual(["Jogar Lenço vermelho: passe, poder 21", "Jogar Boné verde: chute a gol, poder 30", "Jogar Cinto cinza: toque curto, poder 6"]);
    expect(painel.textContent).toContain("Sem carta, o time não faz nada de útil nesta jogada");
    fireEvent.click(mao[0]);
    await waitFor(() => expect(calls.filter((c) => c.path.endsWith("/acionar"))).toHaveLength(1), LONGO);
    expect(calls.find((c) => c.path.endsWith("/acionar"))?.body).toEqual({ carta: "m1" });
    await waitFor(() => expect(screen.getByTestId("esporte-narracao").textContent).toBe("2' Passe de Caio para Bia"), LONGO);

    // teclado: a seta escolhe e Enter joga a carta em foco
    await waitFor(() => expect(screen.getByTestId("esporte-situacao").textContent).toContain("Você tem a bola no ataque"), LONGO);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "Enter" });
    // o chute abre a barra de tempo: Enter de novo aperta a barra e a faixa do acerto vai junto da carta
    expect((await screen.findByTestId("esporte-tempo")).textContent).toContain("Agora!");
    fireEvent.keyDown(window, { key: "Enter" });
    const chute = { carta: "m2", alvo: expect.stringMatching(/^TEMPO:[012]$/) };
    await waitFor(() => expect(calls.filter((c) => c.path.endsWith("/acionar")).map((c) => c.body)).toEqual([{ carta: "m1" }, chute]), LONGO);
    await waitFor(() => expect(screen.getByTestId("esporte-placar").textContent).toContain("1 × 0"), LONGO);
    expect(screen.getByTestId("esporte-narracao").textContent).toBe("5' Gol! Téo finaliza e marca");

    // sem a bola: seguir sem carta manda a jogada vazia
    await waitFor(() => expect(screen.getByTestId("esporte-situacao").textContent).toContain("O adversário tem a bola no meio-campo"), LONGO);
    fireEvent.click(screen.getByRole("button", { name: "Seguir sem carta" }));
    await waitFor(() => expect(calls.filter((c) => c.path.endsWith("/acionar")).map((c) => c.body)).toEqual([{ carta: "m1" }, chute, {}]), LONGO);

    const result = await screen.findByTestId("nucleo-result", undefined, { timeout: 8000 });
    expect(result.textContent).toContain("Vitória");
    expect(result.textContent).toContain("Placar: 1-0");
    const resumo = screen.getByTestId("esporte-resumo");
    expect(resumo.textContent).toContain("Posse: você 67% × 33% adversário");
    expect(resumo.textContent).toContain("Passes certos: 1 de 1");
    expect(screen.getByTestId("esporte-pecas").textContent).toContain("Boné verde: 5' Gol! Téo finaliza e marca");
    expect(result.textContent).not.toContain("JOGADA");
    expect(screen.getByTestId("esporte-placar").textContent).toContain("Fim de jogo");
  }, 20000);

  it("só entra em campo com o uniforme inteiro: com a parte de cima, o botão fica desligado e diz o que falta", async () => {
    loggedAs(ME, {
      "GET /api/flair/3d/nucleos/FASHION_SPORTS": DEF,
      "GET /api/me/flair/cards": CARDS,
      "POST /api/flair/3d/nucleos/FASHION_SPORTS/efeitos": EFEITOS,
      "POST /api/flair/3d/nucleos/FASHION_SPORTS/partidas": { id: "m15", nucleo: "FASHION_SPORTS", status: "ABERTA", semente: 7 },
      "POST /api/flair/3d/partidas/m15/previa": { pontos: 0, estrelas: 0, resultado: "PREVIA", regras: [], eventos: [], status: "ABERTA" },
    });
    renderApp(<NucleoScreen nucleo="fashion-sports" />);
    const deck = await screen.findByTestId("nucleo-deck");
    deck.querySelectorAll<HTMLButtonElement>(".n3d-deck-card").forEach((b) => fireEvent.click(b));
    fireEvent.click(within(deck).getByRole("button", { name: "Entrar na partida" }));
    await screen.findByTestId("nucleo-game");
    fireEvent.keyDown(window, { key: " " });
    expect((await screen.findByTestId("nucleo-hint")).textContent).toContain("falta parte de baixo, calçado");
    expect(screen.getByRole("button", { name: "Entregar o look" }).hasAttribute("disabled")).toBe(true);
  });

  it("a mão lê a ação e o poder dos selos do servidor; carta sem selo de cor joga o toque curto", () => {
    const itens = (id: string) => EFEITOS.efeitos.find((e) => e.cardId === id)?.itens;
    const mao = cartasDaMao(["m2", "zz", "m3", "u2"], CARDS.cards as never, itens);
    expect(mao.map((c) => [c.card.id, c.acao, c.poder])).toEqual([["m2", "CHUTE", 30], ["m3", "TOQUE", 6], ["u2", "TOQUE", 0]]);
  });
});
