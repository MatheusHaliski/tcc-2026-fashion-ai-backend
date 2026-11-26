// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NucleoScreen } from "@/components/flair/nucleos/nucleo-screen";
import { pontoDaRetomada } from "@/lib/flair/nucleos/retomada";
import type { NucleoRetomada } from "@/lib/flair/nucleos/types";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen } from "@/test-utils/render";

/**
 * "Continuar partida" com a API simulada: ao voltar ao jogo, a partida que não fechou aparece com o ponto em que parou;
 * continuar devolve o deck, o look e a ação de onde pararam, e começar outra segue para o deck de sempre.
 */
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams(""), usePathname: () => "/flair/3d" }));

const card = (id: string, name: string, position: string) => ({ id, originType: "PIECE", originId: `p-${id}`, season: "SPRING", tier: "PRATA", ovr: 70, rare: false, position, name, brandName: "Atelier Lumi", imageUrl: null, hype: null, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" });
const CARDS = { season: "SPRING", counts: {}, total: 3, cards: [card("c1", "Camisa verde", "SUP"), card("c2", "Calça linho", "INF"), card("c3", "Tênis azul", "CAL")] };
const partida = (over: Record<string, unknown> = {}) => ({ id: "m9", nucleo: "PASSARELA", status: "ABERTA", semente: 7, deck: ["c1", "c2", "c3"], participantes: [], rodada: null, abertura: {}, ...over });
const RETRATO = { sala: "SALAO", ponto: "meio", escondido: false, vida: 2, tempo: 754, limite: 2700, pistas: [{ id: "P1", completa: true }, { id: "P2", completa: true }], totalDePistas: 12, chaves: [], visitadas: ["ENTRADA", "SALAO"], resolvidas: [], portasAbertas: [], cutscene: null, avisos: [], dica: false, tentativas: 0, final: null, mao: [], baralho: 0, alcance: 3.8, meiaAbertura: 30, passoMaximo: 3.6, layout: { pontos: [{ id: "meio", x: 0, z: 0, esconderijo: false }], armarios: [], saidas: [], vigias: [], enigma: null }, mapa: [] };

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ponto da retomada (puro)", () => {
  it("investigação, partida por cartas, etapa da vez e deck já escolhido", () => {
    const base: NucleoRetomada = { partida: partida() as never, vestidas: null, resultado: null, tentativa: null };
    expect(pontoDaRetomada(base)).toEqual({ tipo: "deck", n: 3 });
    const detetive = { ...base, resultado: { pontos: 0, estrelas: 0, resultado: "EM_ACAO", status: "EM_ACAO", regras: [], eventos: [{ codigo: "DETETIVE", valor: RETRATO }] } };
    expect(pontoDaRetomada(detetive)).toEqual({ tipo: "detetive", sala: "SALAO", pistas: 2, total: 12, vida: 2, relogio: "12:34" });
    const esporte = { ...base, resultado: { pontos: 0, estrelas: 0, resultado: "EM_ACAO", status: "EM_ACAO", regras: [], eventos: [{ codigo: "SITUACAO", valor: { jogada: 5, total: 16, tempo: 1, relogio: 600, posse: "NOS", zona: 1, goleiroPronto: false, mao: [], baralho: 0, placar: "1-0" } }] } };
    expect(pontoDaRetomada(esporte)).toEqual({ tipo: "esporte", placar: "1 × 0", jogada: 5, total: 16 });
    const etapa = { ...base, tentativa: { pontos: 70, estrelas: 1, resultado: "ETAPA_CUMPRIDA", status: "ABERTA", regras: [], eventos: [{ codigo: "PROXIMA_ETAPA", valor: { etapa: 2, codigo: "CLIMA_FRIO", total: 3, tentativa: 1 } }] } };
    expect(pontoDaRetomada(etapa)).toEqual({ tipo: "etapa", etapa: 2, total: 3 });
  });
});

describe("Continuar partida", () => {
  it("o deck já escolhido volta para a preparação e a entrega vai para a mesma partida", async () => {
    const { calls } = loggedAs(ME, {
      "GET /api/me/flair/cards": CARDS,
      "GET /api/flair/3d/nucleos/PASSARELA/em-andamento": { partida: partida(), vestidas: null, resultado: null, tentativa: null, atualizadaEm: "2026-11-15T18:00:00Z" },
      "POST /api/flair/3d/partidas/m9/entrega": { pontos: 30, estrelas: 0, resultado: "REPROVADO", status: "ENTREGUE", regras: [], eventos: [] },
    });
    renderApp(<NucleoScreen nucleo="passarela" />);
    const continuar = await screen.findByTestId("nucleo-continuar");
    expect(continuar.textContent).toContain("O deck de 3 cartas já está escolhido");
    fireEvent.click(screen.getByRole("button", { name: "Continuar partida" }));
    await screen.findByTestId("nucleo-game");
    expect(screen.queryByTestId("nucleo-deck")).toBeNull();
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "Enter" });
    await screen.findByRole("button", { name: "Ver o resultado" });
    expect(calls.some((c) => c.path === "/api/flair/3d/partidas/m9/entrega")).toBe(true);
    expect(calls.some((c) => c.path.endsWith("/partidas") && c.method === "POST")).toBe(false);
  });

  it("a investigação volta na sala em que parou; começar outra segue para o deck", async () => {
    const em = { partida: partida({ nucleo: "FASHION_DETECTIVE", status: "EM_ACAO", rodada: "COLECAO_MARE" }), vestidas: { SUP: "c1" },
      resultado: { pontos: 0, estrelas: 0, resultado: "EM_ACAO", status: "EM_ACAO", regras: [], eventos: [{ codigo: "DETETIVE", valor: RETRATO }] }, tentativa: null };
    loggedAs(ME, { "GET /api/me/flair/cards": CARDS, "GET /api/flair/3d/nucleos/FASHION_DETECTIVE/em-andamento": em });
    renderApp(<NucleoScreen nucleo="fashion-detective" />);
    expect((await screen.findByTestId("nucleo-continuar-ponto")).textContent).toBe("Sala: Salão principal · pistas 2 de 12 · fôlego 2 de 3 · relógio 12:34");
    fireEvent.click(screen.getByRole("button", { name: "Continuar desta sala" }));
    expect((await screen.findByTestId("detetive-palco")).getAttribute("data-sala")).toBe("SALAO");
    cleanup();

    loggedAs(ME, { "GET /api/me/flair/cards": CARDS, "GET /api/flair/3d/nucleos/FASHION_DETECTIVE/em-andamento": em });
    renderApp(<NucleoScreen nucleo="fashion-detective" />);
    fireEvent.click(await screen.findByRole("button", { name: "Começar outra partida" }));
    expect(screen.queryByTestId("nucleo-continuar")).toBeNull();
    expect(await screen.findByTestId("nucleo-deck")).toBeTruthy();
  });
});
