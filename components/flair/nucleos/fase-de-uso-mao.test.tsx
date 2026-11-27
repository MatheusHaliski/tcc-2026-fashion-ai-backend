// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { DesfileHud } from "@/components/flair/nucleos/desfile-hud";
import { assinarFx, emitirFx, type FxEvento } from "@/lib/flair/nucleos/fx-events";
import { CARTAS, viewport } from "@/test-utils/flair-nucleos";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
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

const reagir = () => act(() => new Promise((r) => setTimeout(r, 220)));
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

describe("rodada zonas na fase de uso (perfil console)", () => {
  it("X abre a roda de cartas e, solto, arma a carta; E responde ao momento-chave e a carta vai no toque", async () => {
    loggedAs(ME, { "GET /api/me/flair/cards": { season: "S", counts: {}, total: CARTAS.length, cards: CARTAS }, "POST /api/flair/3d/nucleos/SUPER_HEROI/efeitos": EFEITOS });
    const onExecucao = vi.fn();
    renderApp(<DesfileHud codigo="SUPER_HEROI" onFim={vi.fn()} resultado={EM_ACAO} onExecucao={onExecucao} />);
    const hud = await screen.findByTestId("desfile-hud");
    expect(hud.dataset.console).toBeDefined();
    // a mão de chips é do perfil legado; no console as cartas ficam na roda
    expect(screen.queryByTestId("mao-de-uso")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("console-da-fase").dataset.cartas).toBe("2"));
    fireEvent.keyDown(window, { key: "x", code: "KeyX" });
    const roda = await screen.findByTestId("roda-radial");
    // as Especiais primeiro: a Metamorfose fica no alto da roda, em foco
    expect(within(roda).getByTestId("roda-nome").textContent).toContain("Metamorfose");
    expect(roda.querySelectorAll("[role=menuitem]")).toHaveLength(2);
    fireEvent.keyUp(window, { key: "x", code: "KeyX" });
    expect(screen.queryByTestId("roda-radial")).toBeNull();
    act(() => emitirFx({ tipo: "desfile", nucleo: "SUPER_HEROI", alcancadas: 1, total: 5, naPonta: false }));
    const curta = screen.getByTestId("deixa-curta");
    expect(curta.textContent).toContain("ataque do alto");
    expect(curta.textContent).toContain("escudo");
    // no máximo seis palavras na cena (as teclas não contam)
    expect((curta.textContent ?? "").replace(/\b[EF]\b/g, "").trim().split(/\s+/).length).toBeLessThanOrEqual(6);
    expect(eventos.some((e) => e.tipo === "uso-chave" && e.certa === null)).toBe(true);
    // a reação humana mínima é 150 ms: antes disso é antecipar (erro)
    await reagir();
    fireEvent.keyDown(window, { key: "e", code: "KeyE" });
    const nota = eventos.find((e) => e.tipo === "desfile-nota");
    expect(nota).toMatchObject({ marca: 0, nota: "CHAVE", carta: { id: "c3", lance: "METAMORFOSE" } });
    for (const marca of [1, 2, 3, 4]) {
      act(() => emitirFx({ tipo: "desfile", nucleo: "SUPER_HEROI", alcancadas: marca + 1, total: 5, naPonta: false }));
      await reagir();
      fireEvent.keyDown(window, { key: "e", code: "KeyE" });
      fireEvent.keyUp(window, { key: "e", code: "KeyE" });
    }
    expect(onExecucao).toHaveBeenCalledTimes(1);
    const toques = onExecucao.mock.calls[0][0];
    expect(toques[0]).toMatchObject({ marca: 0, botao: "VESTIR", carta: "c3" });
    expect(toques.map((t: { botao: string }) => t.botao)).toEqual(PEDIDO.botoes);
  });
});
