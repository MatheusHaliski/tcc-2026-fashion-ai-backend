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
    // o recurso com o nome dele no jogo: na Passarela, o FOCO é a confiança da modelo
    expect(hud.textContent).toContain("Confiança da modelo: 40");
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

  it("fase de uso (jogos de zonas): a deixa mostra o lance seguro e o ousado; o ousado gasta o recurso; com as cinco marcas, os toques vão ao servidor", async () => {
    loggedAs(ME, {});
    const onAcionar = vi.fn();
    const pedido = { botoes: ["VESTIR", "DESFILAR", "VESTIR", "DESFILAR", "VESTIR"], ousados: ["TROCAR_ABA", "VESTIR", "TROCAR_ABA", "VESTIR", "TROCAR_ABA"],
      janelaMs: 1000, janelaOusadaMs: 600, prazoMs: 25000, custo: 12, recurso: "ENERGIA", reserva: 50, dreno: 15 };
    const emAcao = { ...RESULTADO_PASSARELA, status: "EM_ACAO" as const, eventos: [{ codigo: "EXECUCAO_PEDIDA", valor: pedido }] };
    renderApp(<NucleoGame definicao={definicao("PILOTO_FAVORITO")} cartas={[]} entregando={false} erro={null} onEntregar={vi.fn()} momento="ACAO" resultado={emAcao} onFimAcao={vi.fn()} onAcionar={onAcionar} />);
    const hud = await screen.findByTestId("desfile-hud");
    expect(hud.textContent).toContain("Volta de classificação: 0 de 5");
    expect(hud.textContent).toContain("Combustível: 50");
    // a cena é a do lugar de uso (a pista), não a do ateliê: quem publica as marcas é a cena 3D, aqui simulada
    const teclas = [{ key: "i", code: "KeyI" }, { key: "f", code: "KeyF" }, { key: " ", code: "Space" }, { key: "f", code: "KeyF" }, { key: " ", code: "Space" }];
    // o relógio da deixa: cada toque vem 300 ms depois de ela abrir (antes de 150 ms seria antecipar)
    let relogio = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => relogio);
    for (let i = 0; i < 5; i++) {
      act(() => emitirFx({ tipo: "desfile", nucleo: "PILOTO_FAVORITO", alcancadas: i + 1, total: 5, naPonta: i === 4 }));
      expect(hud.dataset.deixa).toBe(pedido.botoes[i]);
      if (i === 0) {
        const lances = screen.getByTestId("deixa-de-uso");
        expect(lances.textContent).toContain("poupar");
        expect(lances.textContent).toContain("acelerar −12");
        expect(hud.textContent).toContain("✕ para poupar ou △ para acelerar (vale mais, gasta 12)");
        expect(screen.getByTestId("prazo-da-fase")).toBeTruthy();
      }
      relogio += 300;
      fireEvent.keyDown(window, teclas[i]);
      // o primeiro toque foi o lance ousado (△): gastou 12 do combustível na hora
      if (i === 0) expect(hud.textContent).toContain("Combustível: 38");
    }
    expect(eventos.flatMap((e) => (e.tipo === "desfile-nota" ? [e.nota] : []))).toEqual(["OUSADO", "PERFEITO", "PERFEITO", "PERFEITO", "PERFEITO"]);
    expect(onAcionar).toHaveBeenCalledTimes(1);
    const toques = onAcionar.mock.calls[0][0].execucao.toques;
    expect(toques.map((t: { botao: string }) => t.botao)).toEqual(["TROCAR_ABA", "DESFILAR", "VESTIR", "DESFILAR", "VESTIR"]);
  });
});
