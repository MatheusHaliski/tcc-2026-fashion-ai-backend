// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { DesfileHud } from "@/components/flair/nucleos/desfile-hud";
import { assinarFx, emitirFx, type FxEvento } from "@/lib/flair/nucleos/fx-events";
import { CARTAS, viewport } from "@/test-utils/flair-nucleos";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen } from "@/test-utils/render";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

/** Rodada zonas na tela: a mão de cartas arma a carta da próxima marca e o momento-chave mostra a condição e as opções. */
const PEDIDO = {
  botoes: ["VESTIR", "TIRAR", "DESFILAR", "TROCAR_ABA", "VESTIR"],
  janelaMs: 1000,
  recurso: "VIDA",
  reserva: 60,
  dreno: 22,
  ousados: ["TIRAR", "DESFILAR", "TROCAR_ABA", "VESTIR", "TIRAR"],
  custo: 12,
  janelaOusadaMs: 600,
  prazoMs: 25000,
  janelas: [1000, 960, 920, 880, 840],
  janelasOusadas: [600, 576, 552, 528, 504],
  nivel: 0,
  cartasMax: 3,
  recarga: 2,
  uniforme: ["Vermelho"],
  chave: { marca: 0, momento: "AMEACA", condicao: "ATAQUE_AEREO", opcoes: ["ESCUDO", "SALTO"], certa: "VESTIR" },
};
const EM_ACAO = { status: "EM_ACAO", eventos: [{ codigo: "EXECUCAO_PEDIDA", valor: PEDIDO }], pontos: 0, estrelas: 0, resultado: "EM_ACAO", regras: [], cartas: [] } as unknown as NucleoResultado;
const EFEITOS = {
  efeitos: [
    { cardId: "c1", itens: [], uso: { lance: "CURA", efeito: "FOLEGO", familia: "Verde", faixa: "VIRAL", janelaPct: 55 } },
    { cardId: "c3", itens: [], uso: { lance: "METAMORFOSE", efeito: "METAMORFOSE", familia: "Azul", faixa: "LOW_SIGNAL", janelaPct: 30 } },
    { cardId: "c2", itens: [], uso: null },
  ],
};

let eventos: FxEvento[] = [];
let cancelar = () => undefined as void;
beforeEach(() => {
  viewport(1024, 768);
  eventos = [];
  cancelar = assinarFx((e) => eventos.push(e));
});
afterEach(() => {
  cancelar();
  cleanup();
  vi.restoreAllMocks();
});

describe("rodada zonas na fase de uso", () => {
  it("arma a carta com a tecla, a leva no toque do momento-chave e mostra a condição sorteada", async () => {
    loggedAs(ME, { "GET /api/me/flair/cards": { season: "S", counts: {}, total: CARTAS.length, cards: CARTAS }, "POST /api/flair/3d/nucleos/SUPER_HEROI/efeitos": EFEITOS });
    const onExecucao = vi.fn();
    renderApp(<DesfileHud codigo="SUPER_HEROI" onFim={vi.fn()} resultado={EM_ACAO} onExecucao={onExecucao} />);
    const mao = await screen.findByTestId("mao-de-uso");
    await screen.findByText("Metamorfose");
    // as Especiais primeiro: a Metamorfose é a tecla 1; a carta sem lance não entra na mão
    expect(mao.querySelectorAll("button")).toHaveLength(2);
    fireEvent.keyDown(window, { key: "1" });
    expect(mao.querySelector("[data-armada]")?.textContent).toContain("Metamorfose");
    act(() => emitirFx({ tipo: "desfile", nucleo: "SUPER_HEROI", alcancadas: 1, total: 5, naPonta: false }));
    const chave = screen.getByTestId("deixa-da-chave");
    expect(chave.textContent).toContain("o drone ataca do alto");
    expect(chave.textContent).toContain("erguer o escudo");
    expect(eventos.some((e) => e.tipo === "uso-chave" && e.certa === null)).toBe(true);
    act(() => emitirFx({ tipo: "desfile-botao", nucleo: "SUPER_HEROI", botao: "VESTIR" }));
    const nota = eventos.find((e) => e.tipo === "desfile-nota");
    expect(nota).toMatchObject({ marca: 0, carta: { id: "c3", lance: "METAMORFOSE" } });
    expect(eventos.some((e) => e.tipo === "uso-chave" && e.certa !== null)).toBe(true);
    // a Metamorfose entra em recarga e sai da armada
    expect(mao.querySelector("[data-armada]")).toBeNull();
    for (const marca of [1, 2, 3, 4]) {
      act(() => emitirFx({ tipo: "desfile", nucleo: "SUPER_HEROI", alcancadas: marca + 1, total: 5, naPonta: false }));
      act(() => emitirFx({ tipo: "desfile-botao", nucleo: "SUPER_HEROI", botao: PEDIDO.botoes[marca] as "VESTIR" }));
    }
    expect(onExecucao).toHaveBeenCalledTimes(1);
    const toques = onExecucao.mock.calls[0][0];
    expect(toques[0]).toMatchObject({ marca: 0, botao: "VESTIR", carta: "c3" });
    expect(toques[1].carta).toBeUndefined();
  });
});
