// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMaoNoControle } from "@/components/flair/esporte/use-mao-controle";

/**
 * A mão de cartas no teclado e no controle: setas ou direcional escolhem, Enter, Espaço, A ou Start jogam, Backspace ou
 * B seguem sem carta; só com a janela da jogada aberta; botão que já estava apertado não conta como aperto novo.
 */
function Mao({ ativo, registro }: { ativo: boolean; registro: string[] }) {
  useMaoNoControle({ ativo, onMover: (dir) => registro.push(`mover:${dir}`), onJogar: () => registro.push("jogar"), onSeguir: () => registro.push("seguir") });
  return null;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "getGamepads");
});

describe("mão no teclado", () => {
  it("setas escolhem, Enter e Espaço jogam, Backspace segue sem carta; fechada, não ouve", () => {
    const registro: string[] = [];
    const { rerender } = render(<Mao ativo registro={registro} />);
    for (const key of ["ArrowRight", "ArrowLeft", "Enter", " ", "Backspace", "ArrowUp", "q"]) fireEvent.keyDown(window, { key });
    expect(registro).toEqual(["mover:1", "mover:-1", "jogar", "jogar", "seguir"]);
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    rerender(<Mao ativo={false} registro={registro} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(registro).toHaveLength(5);
  });
});

describe("mão no controle", () => {
  it("direcional escolhe, ✕ (A) joga, ○ (B) segue sem carta, Start não joga; o que já estava apertado não conta", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    // o A ainda está apertado do comando anterior quando a janela abre
    let apertados: number[] = [0];
    const pad = () => ({ index: 0, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: apertados.includes(i), value: apertados.includes(i) ? 1 : 0 })), axes: [0, 0, 0, 0] });
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [pad()] });
    const registro: string[] = [];
    const { unmount } = render(<Mao ativo registro={registro} />);
    const quadro = (t: number) => act(() => frames.shift()?.(t));
    quadro(10);
    expect(registro).toEqual([]);
    apertados = [];
    quadro(20);
    apertados = [15];
    quadro(30);
    quadro(40);
    apertados = [14];
    quadro(50);
    apertados = [0];
    quadro(60);
    apertados = [9];
    quadro(70);
    apertados = [1];
    quadro(80);
    // os botões que não são da mão (posar, trocar de aba) não fazem nada aqui
    apertados = [2, 4];
    quadro(90);
    // Start agora é a pausa (padrão de console): só ✕ (A) joga
    expect(registro).toEqual(["mover:1", "mover:-1", "jogar", "seguir"]);
    unmount();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("sem controle conectado não agenda leitura", () => {
    const raf = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);
    render(<Mao ativo registro={[]} />);
    expect(raf).not.toHaveBeenCalled();
  });
});
