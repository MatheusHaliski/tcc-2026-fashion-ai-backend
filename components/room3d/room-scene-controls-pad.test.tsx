// @vitest-environment jsdom
/**
 * Controle na tela e controle físico (DualSense) do quarto 3D: botões ×○□△ e direcional, analógicos pelo toque,
 * ombros L1/R1, o aviso do objeto próximo e os modos da interface (completa, mínima, oculta).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { act, cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import { ROOM_CAMERA_EVENT, RoomInteraction } from "@/lib/room3d/interaction";
import RoomSceneControls, { TAP_STEP_MS } from "./room-scene-controls";

const frames = new Map<number, FrameRequestCallback>(); let seq = 0;
beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => { frames.set(++seq, f); return seq; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  HTMLElement.prototype.setPointerCapture = vi.fn();
});
afterEach(() => { cleanup(); frames.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = ""; });
const frame = () => act(() => { for (const [id, fn] of [...frames]) { frames.delete(id); fn(16); } });

type Pad = { mapping: string; axes: number[]; buttons: { pressed: boolean }[] };
function gamepad(): Pad { return { mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false })) }; }

function setup(props: Partial<Parameters<typeof RoomSceneControls>[0]> = {}) {
  const engine = new RoomInteraction(), canvas = document.createElement("canvas");
  canvas.tabIndex = 0; document.body.appendChild(canvas);
  const handlers = { onVistaMe: vi.fn(), onPhoto: vi.fn(), onLight: vi.fn(), onView: vi.fn() };
  renderApp(<RoomSceneControls engine={engine} canvas={canvas} walk {...handlers} {...props} />);
  return { engine, canvas, ...handlers };
}
const near = (engine: RoomInteraction, kind: "sit" | "pick" = "sit", label?: string) => {
  const object = new THREE.Object3D(); object.position.copy(engine.actor); const run = vi.fn();
  act(() => { engine.actions.set("a", { id: "a", object, kind, radius: 1, run, label }); engine.updateNearby(); });
  return run;
};

describe("controle físico", () => {
  it("com o canvas em foco, cada botão faz a sua ação uma vez por toque e os analógicos movem e giram", () => {
    const pad = gamepad();
    vi.stubGlobal("navigator", { ...navigator, getGamepads: () => [null, pad] });
    const { engine, canvas, onPhoto, onVistaMe, onLight, onView } = setup();
    const interact = vi.spyOn(engine, "interact"), cancel = vi.spyOn(engine, "cancelGoal");
    canvas.focus();
    pad.axes = [0.9, 0, 0, -0.9]; pad.buttons[5].pressed = true;
    frame();
    expect(engine.moveStick.x).toBeGreaterThan(0.8);
    expect(engine.cameraStick.y).toBeLessThan(-0.8);
    expect(engine.cameraStick.x).toBe(1);                                         // R1 gira para a direita
    expect(cancel).toHaveBeenCalled();
    pad.axes = [0, 0, 0, 0]; pad.buttons[5].pressed = false;
    for (const i of [0, 1, 2, 3, 12, 14, 15]) pad.buttons[i].pressed = true;
    engine.seated = new THREE.Vector3();
    frame(); frame();                                                             // segurar não repete
    expect(interact).toHaveBeenCalledTimes(1);
    expect(engine.seated).toBeNull();                                             // ○ levanta
    expect(onPhoto).toHaveBeenCalledTimes(1);
    expect(onVistaMe).toHaveBeenCalledTimes(1);
    expect(onLight).toHaveBeenCalledTimes(1);
    expect(onView.mock.calls).toEqual([[-1], [1]]);
    for (const i of [0, 2]) pad.buttons[i].pressed = false;
    frame();
    pad.buttons[0].pressed = true; frame();
    expect(interact).toHaveBeenCalledTimes(2);                                    // soltou e apertou de novo
  });

  it("sem foco no quarto o controle é ignorado; foco nos botões da tela vale", () => {
    const pad = gamepad(); pad.buttons[2].pressed = true;
    vi.stubGlobal("navigator", { ...navigator, getGamepads: () => [pad] });
    const { onPhoto } = setup();
    frame();
    expect(onPhoto).not.toHaveBeenCalled();
    (screen.getByRole("button", { name: "Andar para frente" }) as HTMLButtonElement).focus();
    frame();
    expect(onPhoto).toHaveBeenCalledTimes(1);
  });

  it("controle sem mapeamento padrão ou sem API de controles não faz nada", () => {
    vi.stubGlobal("navigator", { ...navigator, getGamepads: () => [{ ...gamepad(), mapping: "" }] });
    const { engine, canvas } = setup(); canvas.focus(); frame();
    expect(engine.moveStick.length()).toBe(0);
    cleanup();
    vi.stubGlobal("navigator", { ...navigator, getGamepads: undefined });
    const second = setup(); second.canvas.focus(); frame();
    expect(second.engine.moveStick.length()).toBe(0);
  });

  it("câmera livre: o controle manda zoom e giro como evento para a câmera", () => {
    const pad = gamepad(); pad.axes = [0, 0.9, 0.9, 0]; pad.buttons[4].pressed = true;
    vi.stubGlobal("navigator", { ...navigator, getGamepads: () => [pad] });
    const { engine, canvas } = setup({ walk: false });
    const events: { x: number; y: number; zoom: number }[] = [];
    canvas.addEventListener(ROOM_CAMERA_EVENT, (e) => events.push((e as CustomEvent).detail));
    canvas.focus(); frame();
    const last = events.at(-1)!;
    expect(last.zoom).toBeGreaterThan(0.8);
    expect(last.x).toBeGreaterThan(-0.2);                                          // giro direito menos o L1
    expect(last.x).toBeLessThan(0);
    expect(engine.moveStick.length()).toBe(0);
    cleanup();
    expect(events.at(-1)).toEqual({ x: 0, y: 0, zoom: 0 });                       // ao sair, para a câmera
  });
});

describe("controle na tela", () => {
  it("analógico pelo toque: aperta, arrasta, solta; outro dedo é ignorado", () => {
    const { engine } = setup();
    const stick = document.querySelectorAll<HTMLButtonElement>(".room-pad-stick")[0];
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 50, clientY: 0 }); frame();
    expect(engine.moveStick.x).toBeGreaterThan(0.9);
    expect(stick.setPointerCapture).toHaveBeenCalledWith(1);
    fireEvent.pointerDown(stick, { pointerId: 2, clientX: -50, clientY: 0 }); frame();
    expect(engine.moveStick.x).toBeGreaterThan(0.9);
    fireEvent.pointerMove(stick, { pointerId: 2, clientX: 0, clientY: 50 }); frame();
    expect(engine.moveStick.x).toBeGreaterThan(0.9);
    fireEvent.pointerMove(stick, { pointerId: 1, clientX: 0, clientY: 50 }); frame();
    expect(engine.moveStick.y).toBeGreaterThan(0.9);
    expect(stick.querySelector<HTMLElement>(".room-pad-thumb")!.style.transform).toContain("22px");
    fireEvent.pointerUp(stick); frame();
    expect(engine.moveStick.length()).toBe(0);
    for (const end of ["pointerCancel", "lostPointerCapture", "blur"] as const) {
      fireEvent.pointerDown(stick, { pointerId: 3, clientX: 50, clientY: 0 }); frame();
      expect(engine.moveStick.length()).toBeGreaterThan(0);
      fireEvent[end](stick); frame();
      expect(engine.moveStick.length()).toBe(0);
    }
    fireEvent.keyDown(stick, { key: "Enter" }); frame();                          // tecla sem direção não mexe
    expect(engine.moveStick.length()).toBe(0);
  });

  it("ombros: segurar com o dedo ou com Espaço/Enter gira e soltar para", () => {
    const { engine } = setup();
    const left = screen.getByRole("button", { name: "Girar a cena para a esquerda" }), right = screen.getByRole("button", { name: "Girar a cena para a direita" });
    fireEvent.pointerDown(left, { pointerId: 1 }); frame(); expect(engine.cameraStick.x).toBe(-1);
    fireEvent.pointerUp(left); frame(); expect(engine.cameraStick.x).toBe(0);
    fireEvent.pointerDown(right, { pointerId: 1 }); frame(); expect(engine.cameraStick.x).toBe(1);
    fireEvent.pointerCancel(right); frame(); expect(engine.cameraStick.x).toBe(0);
    fireEvent.pointerDown(right, { pointerId: 1 }); fireEvent.lostPointerCapture(right); frame(); expect(engine.cameraStick.x).toBe(0);
    fireEvent.pointerDown(right, { pointerId: 1 }); fireEvent.blur(right); frame(); expect(engine.cameraStick.x).toBe(0);
    fireEvent.keyDown(left, { key: "Enter" }); frame(); expect(engine.cameraStick.x).toBe(-1);
    fireEvent.keyUp(left, { key: "Enter" }); frame(); expect(engine.cameraStick.x).toBe(0);
    // o clique que o navegador gera logo depois da tecla não vira um segundo giro
    fireEvent.click(left, { detail: 0 }); frame(); expect(engine.cameraStick.x).toBe(0);
    fireEvent.keyDown(left, { key: "a" }); frame(); expect(engine.cameraStick.x).toBe(0);
    fireEvent.click(left, { detail: 1 }); frame(); expect(engine.cameraStick.x).toBe(0);   // clique de mouse: já tratado pelo ponteiro
  });

  it("passos de leitor de tela para os quatro lados, um seguido do outro", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const { engine } = setup();
      engine.seated = new THREE.Vector3();
      fireEvent.click(screen.getByRole("button", { name: "Andar para a esquerda" })); frame();
      expect(engine.moveStick.x).toBe(-1); expect(engine.seated).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Andar para a direita" })); frame();
      expect(engine.moveStick.x).toBe(1);
      fireEvent.click(screen.getByRole("button", { name: "Andar para trás" })); frame();
      expect(engine.moveStick.y).toBe(1);
      act(() => vi.advanceTimersByTime(TAP_STEP_MS)); frame();
      expect(engine.moveStick.length()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("botão ○ levanta e cancela a caminhada; × só com algo perto; o aviso do objeto próximo interage", () => {
    const { engine } = setup();
    const done = vi.fn(); engine.walkTo(new THREE.Vector3(2, 0, 2), done); engine.seated = new THREE.Vector3();
    fireEvent.click(screen.getByRole("button", { name: "Círculo: levantar e cancelar caminhada" }));
    expect(engine.seated).toBeNull(); expect(done).toHaveBeenCalledWith("cancelled");
    expect((screen.getByRole("button", { name: "X: interagir com o objeto próximo" }) as HTMLButtonElement).disabled).toBe(true);
    const run = near(engine, "pick", "Camiseta");
    fireEvent.click(screen.getByRole("button", { name: "×Aperte X para pegar Camiseta" }));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("interface mínima mostra só o aviso (ou nada); oculta não mostra nada; sem andar não há aviso", () => {
    const { engine } = setup({ hud: "minimo" });
    expect(document.querySelector(".room-gamepad")).toBeNull();
    near(engine);
    expect(document.querySelector(".room-gamepad.is-minimal")).toBeTruthy();
    expect(screen.getByText("Aperte X para sentar ou levantar")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Andar para frente" })).toBeNull();
    cleanup();
    setup({ hud: "oculto" });
    expect(document.querySelector(".room3d-controls")).toBeNull();
    cleanup();
    const orbit = setup({ walk: false });
    near(orbit.engine);
    expect(screen.queryByText("Aperte X para sentar ou levantar")).toBeNull();
    expect(screen.queryByRole("button", { name: "Andar para frente" })).toBeNull();
    expect(screen.getByRole("button", { name: "Aproximar ou afastar a câmera" })).toBeTruthy();
  });

  it("perder o foco da janela solta tudo, inclusive um passo pendente", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const { engine } = setup();
      const blur = vi.spyOn(engine, "blur");
      fireEvent.click(screen.getByRole("button", { name: "Andar para frente" })); frame();
      fireEvent(window, new Event("blur")); frame();
      expect(blur).toHaveBeenCalled();
      expect(engine.moveStick.length()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
