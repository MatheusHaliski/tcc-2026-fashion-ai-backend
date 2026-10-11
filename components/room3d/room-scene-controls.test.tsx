// @vitest-environment jsdom
/** Acessibilidade 3D: o direcional segura as mesmas teclas do motor enquanto o botão fica apertado; girar manda o comando ao canvas. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import { ROOM_TURN_EVENT, ROOM_ZOOM_EVENT, RoomInteraction } from "@/lib/room3d/interaction";
import RoomSceneControls, { TAP_STEP_MS } from "./room-scene-controls";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
const setup = (walk = true) => {
  const engine = new RoomInteraction(), canvas = document.createElement("canvas");
  const turns: number[] = [], zooms: number[] = [];
  canvas.addEventListener(ROOM_TURN_EVENT, (e) => turns.push((e as CustomEvent).detail));
  canvas.addEventListener(ROOM_ZOOM_EVENT, (e) => zooms.push((e as CustomEvent).detail));
  renderApp(<RoomSceneControls engine={engine} canvas={canvas} walk={walk} />);
  return { engine, canvas, turns, zooms };
};

describe("controles da cena 3D (botões de acessibilidade)", () => {
  it("segurar um botão do direcional aperta a tecla do motor; soltar, sair ou cancelar solta", () => {
    const { engine } = setup();
    const up = screen.getByRole("button", { name: "Andar para frente" });
    expect(up.getAttribute("data-pressed")).toBe("false");
    fireEvent.pointerDown(up, { pointerType: "touch" });
    expect(engine.keys.has("ArrowUp")).toBe(true); expect(up.getAttribute("data-pressed")).toBe("true");
    fireEvent.pointerUp(up, { pointerType: "touch" });
    expect(engine.keys.has("ArrowUp")).toBe(false); expect(up.getAttribute("data-pressed")).toBe("false");
    const left = screen.getByRole("button", { name: "Andar para a esquerda" });
    fireEvent.pointerDown(left, { pointerType: "mouse", button: 0 }); expect(engine.keys.has("ArrowLeft")).toBe(true);
    fireEvent.pointerLeave(left); expect(engine.keys.has("ArrowLeft")).toBe(false);
    const back = screen.getByRole("button", { name: "Andar para trás" });
    fireEvent.pointerDown(back, { pointerType: "pen" }); fireEvent.pointerCancel(back); expect(engine.keys.has("ArrowDown")).toBe(false);
    fireEvent.pointerDown(back, { pointerType: "mouse", button: 2 }); expect(engine.keys.has("ArrowDown")).toBe(false);   // botão direito não anda
  });
  it("pelo teclado: Enter ou Espaço no botão focado seguram enquanto pressionados; perder o foco solta", () => {
    const { engine } = setup();
    const right = screen.getByRole("button", { name: "Andar para a direita" });
    right.focus();
    fireEvent.keyDown(right, { key: "Enter" }); fireEvent.keyDown(right, { key: "Enter", repeat: true });
    expect(engine.keys.has("ArrowRight")).toBe(true); expect(right.getAttribute("data-pressed")).toBe("true");
    fireEvent.keyUp(right, { key: "Enter" }); expect(engine.keys.has("ArrowRight")).toBe(false);
    fireEvent.keyDown(right, { key: " " }); expect(engine.keys.has("ArrowRight")).toBe(true);
    fireEvent.blur(right); expect(engine.keys.has("ArrowRight")).toBe(false); expect(right.getAttribute("data-pressed")).toBe("false");
  });
  it("leitor de tela ou controle por voz (clique sintetizado, sem ponteiro nem tecla): cada ativação dá um passo curto", () => {
    vi.useFakeTimers();
    const { engine } = setup();
    const up = screen.getByRole("button", { name: "Andar para frente" });
    expect(up.hasAttribute("aria-pressed")).toBe(false);                                    // não é um botão de liga/desliga
    fireEvent.click(up);                                                                     // detail 0
    expect(engine.keys.has("ArrowUp")).toBe(true); expect(up.getAttribute("data-pressed")).toBe("true");
    act(() => { vi.advanceTimersByTime(TAP_STEP_MS - 1); }); expect(engine.keys.has("ArrowUp")).toBe(true);
    act(() => { vi.advanceTimersByTime(1); }); expect(engine.keys.has("ArrowUp")).toBe(false); expect(up.getAttribute("data-pressed")).toBe("false");
    // ativar de novo durante o passo estica o passo
    fireEvent.click(up); act(() => { vi.advanceTimersByTime(TAP_STEP_MS - 50); }); fireEvent.click(up);
    act(() => { vi.advanceTimersByTime(TAP_STEP_MS - 50); }); expect(engine.keys.has("ArrowUp")).toBe(true);
    act(() => { vi.advanceTimersByTime(50); }); expect(engine.keys.has("ArrowUp")).toBe(false);
    // ponteiro apertado e solto no mesmo instante (alguns leitores mandam o par) + o clique sintetizado: também anda
    fireEvent.pointerDown(up, { pointerType: "mouse", button: 0 }); fireEvent.pointerUp(up, { pointerType: "mouse" }); fireEvent.click(up);
    expect(engine.keys.has("ArrowUp")).toBe(true); act(() => { vi.advanceTimersByTime(TAP_STEP_MS); }); expect(engine.keys.has("ArrowUp")).toBe(false);
    // clique de mouse/toque de verdade (detail 1): o segurar já cuidou; o clique não soma um passo
    fireEvent.pointerDown(up, { pointerType: "mouse", button: 0 }); fireEvent.pointerUp(up, { pointerType: "mouse" }); fireEvent.click(up, { detail: 1 });
    expect(engine.keys.has("ArrowUp")).toBe(false);
    // Espaço seguido do clique que o navegador manda ao soltar: o teclado já andou, sem passo extra
    fireEvent.keyDown(up, { key: " " }); fireEvent.keyUp(up, { key: " " }); fireEvent.click(up);
    expect(engine.keys.has("ArrowUp")).toBe(false);
    // segurando pelo ponteiro, o clique sintetizado não solta antes da hora
    fireEvent.pointerDown(up, { pointerType: "touch" }); fireEvent.click(up); act(() => { vi.advanceTimersByTime(TAP_STEP_MS * 2); });
    expect(engine.keys.has("ArrowUp")).toBe(true);
    fireEvent.pointerUp(up, { pointerType: "touch" }); expect(engine.keys.has("ArrowUp")).toBe(false);
  });
  it("o motor soltando tudo (janela perdeu o foco) devolve o botão ao estado solto", () => {
    const { engine } = setup();
    const up = screen.getByRole("button", { name: "Andar para frente" });
    fireEvent.pointerDown(up, { pointerType: "touch" }); expect(up.getAttribute("data-pressed")).toBe("true");
    act(() => engine.blur()); expect(up.getAttribute("data-pressed")).toBe("false");
  });
  it("girar a cena manda o comando ao canvas e anuncia a vista; no modo andar não há aproximar/afastar", () => {
    const { engine, turns } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Girar a cena para a esquerda" }));
    fireEvent.click(screen.getByRole("button", { name: "Girar a cena para a direita" }));
    expect(turns).toEqual([1, -1]);
    expect(screen.queryByRole("button", { name: "Aproximar" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Vista 1 de 4");
    act(() => engine.turn(1)); expect(screen.getByRole("status").textContent).toBe("Vista 2 de 4");
    act(() => engine.turn(-2)); expect(engine.view).toBe(3); expect(screen.getByRole("status").textContent).toBe("Vista 4 de 4");
  });
  it("no modo câmera (foto/órbita): girar e aproximar/afastar, sem o direcional", () => {
    const { turns, zooms } = setup(false);
    expect(screen.queryByRole("button", { name: "Andar para frente" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Girar a cena para a direita" }));
    fireEvent.click(screen.getByRole("button", { name: "Aproximar" })); fireEvent.click(screen.getByRole("button", { name: "Afastar" }));
    expect(turns).toEqual([-1]); expect(zooms).toEqual([1, -1]);
    expect(screen.getByRole("group", { name: "Controles da cena 3D" })).toBeTruthy();
  });
  it("sem o canvas (cena ainda carregando) não mostra nada", () => {
    renderApp(<RoomSceneControls engine={new RoomInteraction()} canvas={null} walk />);
    expect(screen.queryByRole("group", { name: "Controles da cena 3D" })).toBeNull();
  });
});
