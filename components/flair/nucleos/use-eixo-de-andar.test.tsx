// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { NucleoGame } from "@/components/flair/nucleos/nucleo-game";
import { eixoDeAndar } from "@/lib/flair/entrada/eixo-de-andar";
import { CARTAS, EFEITOS, definicao, viewport } from "@/test-utils/flair-nucleos";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen } from "@/test-utils/render";

/** Andar livre: WASD é do corpo (a cena lê o eixo), as setas continuam no menu das cartas. */
const frames: FrameRequestCallback[] = [];
beforeEach(() => {
  localStorage.clear();
  viewport(1024, 768);
  frames.length = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const quadro = () => act(() => frames.splice(0).forEach((f) => f(0)));

describe("andar livre na preparação", () => {
  it("na Passarela, segurar W anda para o fundo e não move o foco do menu; ao sair da tela, o andar desliga", async () => {
    loggedAs(ME, { "POST /api/flair/3d/nucleos/PASSARELA/efeitos": EFEITOS });
    renderApp(<NucleoGame definicao={definicao("PASSARELA")} cartas={CARTAS} entregando={false} erro={null} onEntregar={vi.fn()} />);
    await screen.findByTestId("nucleo-resource-window");
    expect(eixoDeAndar().ativo).toBe(true);
    const foco = () => document.querySelector(".n3d-row .n3d-res.is-focus, .n3d-row [data-focus='true']")?.textContent ?? null;
    const antes = foco();
    fireEvent.keyDown(window, { key: "w", code: "KeyW" });
    quadro();
    expect(eixoDeAndar().mover).toEqual({ x: 0, y: 1 });
    expect(foco()).toBe(antes);
    fireEvent.keyUp(window, { key: "w", code: "KeyW" });
    quadro();
    expect(eixoDeAndar().mover).toEqual({ x: 0, y: 0 });
    cleanup();
    expect(eixoDeAndar().ativo).toBe(false);
  });
});
