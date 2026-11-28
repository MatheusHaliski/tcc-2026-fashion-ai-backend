// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import { act, render, renderHook } from "@testing-library/react";
import { usePaineisLaterais } from "@/components/flair/nucleos/console/use-paineis-laterais";
import { AjudaDeControles } from "@/components/flair/nucleos/console/ajuda-de-controles";
import { RodaRadial, type ItemDaRoda } from "@/components/flair/nucleos/console/roda-radial";
import { useControleConsole } from "@/components/flair/nucleos/console/use-controle-console";
import { estadoDoConsole, zerarConsole } from "@/lib/flair/nucleos/controle/estado-do-console";
import { acaoDoConsole, perfilDoJogo, vetorDasSetas } from "@/lib/flair/nucleos/controle/perfil-console";
import { fatiaDoVetor, girarFoco, posicaoNaRoda } from "@/lib/flair/nucleos/controle/roda-radial";

/**
 * Perfil de controles "console" (lib/flair/nucleos/controle e components/flair/nucleos/console): o mapa de teclas, as
 * setas que andam (Shift corre), as ações seguradas (A e X avisam quando sobem), a geometria e o componente da roda
 * radial e o cartão de ajuda.
 */
afterEach(() => {
  cleanup();
  zerarConsole();
});

describe("mapa de teclas (puro)", () => {
  it("setas movem, A mira, F dispara, X roda, P pega, R recarrega, T tela cheia, Esc pausa, ? ajuda; WASD não anda", () => {
    expect(acaoDoConsole("KeyA")).toBe("MIRAR");
    expect(acaoDoConsole("KeyF")).toBe("DISPARAR");
    expect(acaoDoConsole("KeyX")).toBe("RODA");
    expect(acaoDoConsole("KeyP")).toBe("PEGAR");
    expect(acaoDoConsole("KeyR")).toBe("RECARREGAR");
    expect(acaoDoConsole("KeyT")).toBe("TELA_CHEIA");
    expect(acaoDoConsole("Escape")).toBe("PAUSA");
    expect(acaoDoConsole("Slash", "?")).toBe("AJUDA");
    expect(acaoDoConsole("KeyE")).toBe("INTERAGIR");
    expect(acaoDoConsole("Enter")).toBe("INTERAGIR");
    expect(vetorDasSetas(["ArrowUp", "ArrowRight"]).x).toBeCloseTo(Math.SQRT1_2);
    expect(vetorDasSetas(["KeyW", "KeyD"])).toEqual({ x: 0, y: 0 });
    expect(vetorDasSetas(["ArrowUp", "ArrowDown"])).toEqual({ x: 0, y: 0 });
  });

  it("o perfil é por jogo: o Fashion Detective usa o console; os outros continuam no legado", () => {
    expect(perfilDoJogo("FASHION_DETECTIVE")).toBe("console");
    expect(perfilDoJogo("PASSARELA")).toBe("legado");
  });
});

function Ouvinte({ onAcao }: { onAcao: (a: string, f: string) => void }) {
  useControleConsole({ ativo: true, onAcao });
  return null;
}

describe("useControleConsole", () => {
  it("setas escrevem o vetor de andar, Shift corre; A e X avisam ao descer e ao subir; F só ao descer", () => {
    const onAcao = vi.fn();
    render(<Ouvinte onAcao={onAcao} />);
    fireEvent.keyDown(window, { code: "ArrowUp", key: "ArrowUp" });
    fireEvent.keyDown(window, { code: "ShiftLeft", key: "Shift" });
    expect(estadoDoConsole().mover).toEqual({ x: 0, y: 1 });
    expect(estadoDoConsole().correr).toBe(true);
    fireEvent.keyUp(window, { code: "ArrowUp", key: "ArrowUp" });
    expect(estadoDoConsole().mover).toEqual({ x: 0, y: 0 });
    fireEvent.keyDown(window, { code: "KeyA", key: "a" });
    fireEvent.keyUp(window, { code: "KeyA", key: "a" });
    fireEvent.keyDown(window, { code: "KeyX", key: "x" });
    fireEvent.keyUp(window, { code: "KeyX", key: "x" });
    fireEvent.keyDown(window, { code: "KeyF", key: "f" });
    fireEvent.keyUp(window, { code: "KeyF", key: "f" });
    expect(onAcao.mock.calls).toEqual([["MIRAR", "desce"], ["MIRAR", "sobe"], ["RODA", "desce"], ["RODA", "sobe"], ["DISPARAR", "desce"]]);
  });

  it("tecla segurada (repetição) não repete a ação; WASD não move", () => {
    const onAcao = vi.fn();
    render(<Ouvinte onAcao={onAcao} />);
    fireEvent.keyDown(window, { code: "KeyF", key: "f" });
    fireEvent.keyDown(window, { code: "KeyF", key: "f", repeat: true });
    fireEvent.keyDown(window, { code: "KeyW", key: "w" });
    expect(onAcao).toHaveBeenCalledTimes(1);
    expect(estadoDoConsole().mover).toEqual({ x: 0, y: 0 });
  });
});

describe("roda radial", () => {
  it("geometria: o primeiro no alto, no sentido do relógio; o vetor aponta a fatia; zona morta não escolhe", () => {
    expect(posicaoNaRoda(0, 4, 100)).toEqual({ x: 0, y: -100 });
    expect(posicaoNaRoda(1, 4, 100)).toEqual({ x: 100, y: 0 });
    expect(fatiaDoVetor(0, -1, 5)).toBe(0);
    expect(fatiaDoVetor(1, 0, 4)).toBe(1);
    expect(fatiaDoVetor(-1, 0, 4)).toBe(3);
    expect(fatiaDoVetor(0.1, 0.1, 4)).toBeNull();
    expect(girarFoco(0, -1, 5)).toBe(4);
  });

  const itens: ItemDaRoda[] = [
    { id: "PISTOLA", nome: "Pistola de alfinetes", icone: null, usos: "12 / 12", habilitado: true, equipado: true },
    { id: "LEQUE", nome: "Leque de tesoura", icone: null, habilitado: true },
    { id: "LAQUE", nome: "Spray de laquê", icone: null, usos: "×0", habilitado: false },
  ];

  it("mostra só o nome do item em foco; o clique escolhe; a seta para a direita leva o foco à fatia da direita", async () => {
    const onFoco = vi.fn();
    const onEscolher = vi.fn();
    renderApp(<RodaRadial itens={itens} foco={0} onFoco={onFoco} onEscolher={onEscolher} rotulo="Roda" reduzido />);
    expect(screen.getByTestId("roda-nome").textContent).toBe("Pistola de alfinetes");
    expect(screen.queryByText("Leque de tesoura")).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Leque de tesoura" }));
    expect(onEscolher).toHaveBeenCalledWith(1);
    expect(screen.getByRole("menuitem", { name: "Spray de laquê ×0" }).getAttribute("aria-disabled")).toBe("true");
  });
});

describe("cartão de ajuda", () => {
  it("lista as teclas pedidas pela dona e fecha", () => {
    const onFechar = vi.fn();
    renderApp(<AjudaDeControles onFechar={onFechar} />);
    const texto = screen.getByTestId("ajuda-de-controles").textContent ?? "";
    for (const k of ["↑", "Shift", "E", "A", "F", "X", "P", "R", "T", "Esc", "?"]) expect(texto).toContain(k);
    expect(texto).toContain("Mirar (segurar)");
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onFechar).toHaveBeenCalled();
  });
});

describe("painéis laterais", () => {
  it("fechados por padrão; Esc (fecharUm) fecha a direita antes da esquerda; em tela estreita abrir um fecha o outro", () => {
    const { result } = renderHook(() => usePaineisLaterais({ esquerda: "caso", direita: "acoes" }));
    expect(result.current.aberto).toEqual({ esquerda: false, direita: false });
    act(() => result.current.alternar("esquerda"));
    act(() => result.current.alternar("direita"));
    expect(result.current.aberto).toEqual({ esquerda: true, direita: true });
    act(() => void result.current.fecharUm());
    expect(result.current.aberto).toEqual({ esquerda: true, direita: false });
    const antes = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    act(() => result.current.alternar("direita"));
    expect(result.current.aberto).toEqual({ esquerda: false, direita: true });
    window.matchMedia = antes;
  });
});
