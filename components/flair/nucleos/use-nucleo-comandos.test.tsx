// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NucleoGame } from "@/components/flair/nucleos/nucleo-game";
import { CARTAS, EFEITOS, definicao, viewport } from "@/test-utils/flair-nucleos";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen } from "@/test-utils/render";

/** Padrão de console na tela de jogo: Start/Esc pausa com o objetivo; na pausa ✕ entrega o look e ○ volta ao jogo. */
beforeEach(() => {
  localStorage.clear();
  viewport(1024, 768);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("pausa no controle", () => {
  it("monta o look só no teclado, pausa com Esc, ○ volta e ✕ na pausa entrega", async () => {
    loggedAs(ME, { "POST /api/flair/3d/nucleos/PASSARELA/efeitos": EFEITOS });
    const onEntregar = vi.fn();
    renderApp(<NucleoGame definicao={definicao("PASSARELA")} cartas={CARTAS} entregando={false} erro={null} onEntregar={onEntregar} />);
    await screen.findByTestId("nucleo-resource-window");
    // ✕ veste a carta em foco; △ (I) passa à aba seguinte
    for (const key of [" ", "i", " ", "i", " "]) fireEvent.keyDown(window, { key });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("nucleo-objective-details")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Shift" });
    expect(screen.queryByTestId("nucleo-objective-details")).toBeNull();
    expect(onEntregar).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(window, { key: "e" });
    expect(onEntregar).toHaveBeenCalledTimes(1);
    expect(Object.keys(onEntregar.mock.calls[0][0].cartas).sort()).toEqual(["CAL", "INF", "SUP"]);
  });
});
