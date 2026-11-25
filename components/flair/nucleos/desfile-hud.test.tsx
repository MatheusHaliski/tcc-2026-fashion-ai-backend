// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { NucleoGame } from "@/components/flair/nucleos/nucleo-game";
import { assinarFx, emitirFx, type FxEvento } from "@/lib/flair/nucleos/fx-events";
import { CARTAS, EFEITOS, RESULTADO_PASSARELA, definicao, viewport } from "@/test-utils/flair-nucleos";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen } from "@/test-utils/render";

/** Desfile jogável na ação da Passarela: marcas, □ na ponta e a pose final que revela o resultado. */
let eventos: FxEvento[] = [];
let cancelar = () => undefined as void;
beforeEach(() => {
  localStorage.clear();
  viewport(1024, 768);
  eventos = [];
  cancelar = assinarFx((e) => eventos.push(e));
});
afterEach(() => {
  cancelar();
  cleanup();
  vi.restoreAllMocks();
});

describe("desfile jogável", () => {
  it("o painel mostra as marcas; na ponta, □ (F) pede a pose; o fim da pose revela o resultado", async () => {
    loggedAs(ME, { "POST /api/flair/3d/nucleos/PASSARELA/efeitos": EFEITOS });
    const onFimAcao = vi.fn();
    renderApp(<NucleoGame definicao={definicao("PASSARELA")} cartas={CARTAS} entregando={false} erro={null} onEntregar={vi.fn()} momento="ACAO" resultado={RESULTADO_PASSARELA} onFimAcao={onFimAcao} />);
    const hud = await screen.findByTestId("desfile-hud");
    expect(hud.textContent).toContain("0 de 3 marcas");
    act(() => emitirFx({ tipo: "desfile", nucleo: "PASSARELA", alcancadas: 3, total: 3, naPonta: true }));
    expect(hud.textContent).toContain("a pose final");
    fireEvent.keyDown(window, { key: "f" });
    expect(eventos.some((e) => e.tipo === "desfile-pose")).toBe(true);
    expect(onFimAcao).not.toHaveBeenCalled();
    act(() => emitirFx({ tipo: "desfile-fim", nucleo: "PASSARELA" }));
    expect(onFimAcao).toHaveBeenCalledTimes(1);
  });

  it("execução: cada marca alcançada abre a deixa do botão pedido; com as três, os toques vão ao servidor", async () => {
    loggedAs(ME, { "POST /api/flair/3d/nucleos/PASSARELA/efeitos": EFEITOS });
    const onAcionar = vi.fn();
    const pedido = { botoes: ["VESTIR", "DESFILAR", "TROCAR_ABA"], janelaMs: 1000, recurso: "FOCO", reserva: 40, dreno: 15 };
    const emAcao = { ...RESULTADO_PASSARELA, status: "EM_ACAO" as const, eventos: [...RESULTADO_PASSARELA.eventos, { codigo: "EXECUCAO_PEDIDA", valor: pedido }] };
    renderApp(<NucleoGame definicao={definicao("PASSARELA")} cartas={CARTAS} entregando={false} erro={null} onEntregar={vi.fn()} momento="ACAO" resultado={emAcao} onFimAcao={vi.fn()} onAcionar={onAcionar} />);
    const hud = await screen.findByTestId("desfile-hud");
    expect(hud.textContent).toContain("Foco: 40");
    act(() => emitirFx({ tipo: "desfile", nucleo: "PASSARELA", alcancadas: 1, total: 3, naPonta: false }));
    expect(hud.dataset.deixa).toBe("VESTIR");
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(hud.dataset.deixa).toBeUndefined();
    act(() => emitirFx({ tipo: "desfile", nucleo: "PASSARELA", alcancadas: 2, total: 3, naPonta: false }));
    expect(hud.dataset.deixa).toBe("DESFILAR");
    fireEvent.keyDown(window, { key: "f", code: "KeyF" });
    // □ respondeu à deixa: não é a pose final
    expect(eventos.some((e) => e.tipo === "desfile-pose")).toBe(false);
    act(() => emitirFx({ tipo: "desfile", nucleo: "PASSARELA", alcancadas: 3, total: 3, naPonta: true }));
    fireEvent.keyDown(window, { key: "i", code: "KeyI" });
    expect(onAcionar).toHaveBeenCalledTimes(1);
    const toques = onAcionar.mock.calls[0][0].execucao.toques;
    expect(toques.map((t: { botao: string }) => t.botao)).toEqual(["VESTIR", "DESFILAR", "TROCAR_ABA"]);
    expect(onAcionar.mock.calls[0][0].tipo).toBe("EXECUCAO");
  });
});
