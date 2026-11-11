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
  it("cada tecla da tabela vira a ação; desfilar só onde o núcleo permite", () => {
    const got: Comando[] = [];
    render(<Harness acoes={NUCLEOS.PASSARELA.acoes} onComando={(c) => got.push(c)} />);
    for (const key of ["ArrowLeft", "ArrowDown", "q", "E", " ", "Backspace", "z", "c", "+", "-", "p", "w", "Enter", "o"]) fireEvent.keyDown(window, { key });
    expect(got.map((c) => c.acao)).toEqual(["NAVEGAR", "NAVEGAR", "TROCAR_ABA", "TROCAR_ABA", "APLICAR", "TIRAR", "GIRAR", "GIRAR", "ZOOM", "ZOOM", "POSAR", "DESFILAR", "ENTREGAR", "OBJETIVO"]);
    expect(got[1]).toEqual({ acao: "NAVEGAR", dir: 1, eixo: "y" });
    cleanup();
    const zonas: Comando[] = [];
    render(<Harness acoes={NUCLEOS.CLUBE_CORACAO.acoes} onComando={(c) => zonas.push(c)} />);
    fireEvent.keyDown(window, { key: "w" });
    fireEvent.keyDown(window, { key: "Backspace" });
    fireEvent.keyDown(window, { key: "p" });
    expect(zonas.map((c) => c.acao)).toEqual(["POSAR"]);
  });

  it("ignora teclas em campos de texto e Espaço/Enter num botão focado", () => {
    const got: Comando[] = [];
    render(<><Harness acoes={NUCLEOS.PASSARELA.acoes} onComando={(c) => got.push(c)} /><input data-testid="i" /><button data-testid="b">ok</button></>);
    fireEvent.keyDown(document.querySelector("[data-testid=i]")!, { key: "q" });
    fireEvent.keyDown(document.querySelector("[data-testid=b]")!, { key: " " });
    fireEvent.keyDown(document.querySelector("[data-testid=b]")!, { key: "z" });
    expect(got.map((c) => c.acao)).toEqual(["GIRAR"]);
  });
});

describe("gamepad", () => {
  it("lê o controle por requestAnimationFrame: borda dos botões, LB/RB, RT/LT, Start, Select e analógico direito", () => {
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
    pressed = [1, 3, 9, 8, 15];
    tick(30);
    pressed = [];
    axes = [0, 0, -0.8, 0];
    tick(400);
    expect(getByTestId("pad").textContent).toBe("on");
    expect(got).toEqual([
      { acao: "APLICAR" }, { acao: "TROCAR_ABA", dir: -1 }, { acao: "ZOOM", dir: 1 },
      { acao: "TIRAR" }, { acao: "DESFILAR" }, { acao: "OBJETIVO" }, { acao: "ENTREGAR" }, { acao: "NAVEGAR", dir: 1, eixo: "x" },
      { acao: "GIRAR", dir: -1 },
    ]);
    unmount();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    Reflect.deleteProperty(navigator, "getGamepads");
  });
});
