// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useNucleoControls } from "@/components/flair/nucleos/use-nucleo-controls";
import type { Comando } from "@/lib/flair/nucleos/controls";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import type { NucleoAcao } from "@/lib/flair/nucleos/types";

/** Controles: teclado e gamepad (layout padrão, lido por requestAnimationFrame só enquanto montado) viram as ações do contrato. */
function Harness({ acoes, onComando }: { acoes: NucleoAcao[]; onComando: (c: Comando) => void }) {
  const { gamepad } = useNucleoControls({ acoes, onComando });
  return <p data-testid="pad">{gamepad ? "on" : "off"}</p>;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("teclado", () => {
  it("padrão de console: setas e WASD andam no foco, Espaço/E vestem, Shift/Backspace tiram, F é o gesto, I a aba, Esc a pausa", () => {
    const got: Comando[] = [];
    render(<Harness acoes={NUCLEOS.PASSARELA.acoes} onComando={(c) => got.push(c)} />);
    for (const key of ["ArrowLeft", "s", "i", " ", "e", "Backspace", "Shift", "f", "Enter", "Escape"]) fireEvent.keyDown(window, { key });
    expect(got.map((c) => c.acao)).toEqual(["NAVEGAR", "NAVEGAR", "TROCAR_ABA", "VESTIR", "VESTIR", "TIRAR", "TIRAR", "DESFILAR", "ENTREGAR", "VER_OBJETIVO"]);
    expect(got[1]).toEqual({ acao: "NAVEGAR", dir: 1, eixo: "y" });
    // o que deixou de ser comando (zoom, girar e posar em tecla própria)
    for (const key of ["z", "c", "+", "-", "p", "q", "o"]) fireEvent.keyDown(window, { key });
    expect(got).toHaveLength(10);
    cleanup();
    // nos jogos sem desfile, o □ (F) é posar
    const zonas: Comando[] = [];
    render(<Harness acoes={NUCLEOS.CLUBE_CORACAO.acoes} onComando={(c) => zonas.push(c)} />);
    fireEvent.keyDown(window, { key: "f" });
    expect(zonas.map((c) => c.acao)).toEqual(["POSAR"]);
  });

  it("ignora teclas em campos de texto e Espaço/Enter num botão focado", () => {
    const got: Comando[] = [];
    render(<><Harness acoes={NUCLEOS.PASSARELA.acoes} onComando={(c) => got.push(c)} /><input data-testid="i" /><button data-testid="b">ok</button></>);
    fireEvent.keyDown(document.querySelector("[data-testid=i]")!, { key: "e" });
    fireEvent.keyDown(document.querySelector("[data-testid=b]")!, { key: " " });
    fireEvent.keyDown(document.querySelector("[data-testid=b]")!, { key: "f" });
    expect(got.map((c) => c.acao)).toEqual(["DESFILAR"]);
  });
});

describe("gamepad", () => {
  it("lê o controle por requestAnimationFrame: borda dos botões ✕ ○ □ △ e Start, direcional e os dois analógicos", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    let pressed: number[] = [];
    let axes = [0, 0, 0, 0];
    const pad = () => ({ index: 0, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })), axes });
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [pad()] });
    const got: Comando[] = [];
    const { getByTestId, unmount } = render(<Harness acoes={NUCLEOS.PASSARELA.acoes} onComando={(c) => got.push(c)} />);
    const tick = (t: number) => act(() => frames.shift()?.(t));
    pressed = [0, 4, 7];
    tick(10);
    tick(20);
    pressed = [1, 2, 3, 9, 8, 15];
    tick(30);
    pressed = [];
    axes = [0, 0, -0.8, 0];
    tick(400);
    axes = [0.9, 0, 0, 0];
    tick(800);
    expect(getByTestId("pad").textContent).toBe("on");
    // ✕ ○ □ △ e Start; LB, RB, gatilhos e Select não são mais comandos; analógico esquerdo move o foco, o direito gira
    expect(got).toEqual([
      { acao: "VESTIR" },
      { acao: "TIRAR" }, { acao: "DESFILAR" }, { acao: "TROCAR_ABA", dir: 1 }, { acao: "VER_OBJETIVO" }, { acao: "NAVEGAR", dir: 1, eixo: "x" },
      { acao: "GIRAR", dir: -1 },
      { acao: "NAVEGAR", dir: 1, eixo: "x" },
    ]);
    unmount();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    Reflect.deleteProperty(navigator, "getGamepads");
  });
});
