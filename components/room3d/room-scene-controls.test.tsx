// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { act, cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import { ROOM_CAMERA_EVENT, RoomInteraction } from "@/lib/room3d/interaction";
import RoomSceneControls, { stickAxis, TAP_STEP_MS } from "./room-scene-controls";
const frames = new Map<number, FrameRequestCallback>(); let seq = 0;
beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => { frames.set(++seq, f); return seq; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});
afterEach(() => { cleanup(); frames.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const frame = () => act(() => { for (const [id, fn] of [...frames]) { frames.delete(id); fn(16); } });
const setup = (walk = true) => {
  const engine = new RoomInteraction(), canvas = document.createElement("canvas"), onVistaMe = vi.fn(), onPhoto = vi.fn();
  renderApp(<RoomSceneControls engine={engine} canvas={canvas} walk={walk} onVistaMe={onVistaMe} onPhoto={onPhoto} />);
  const sticks = [...document.querySelectorAll<HTMLButtonElement>(".room-pad-stick")];
  return { engine, canvas, sticks, onVistaMe, onPhoto };
};
it("keeps the dead zone stable and clamps diagonals without losing analog magnitude", () => {
  expect(stickAxis(2, 2, 40).length()).toBe(0);
  expect(stickAxis(100, 100, 40).length()).toBeCloseTo(1);
  expect(stickAxis(20, 0, 40).x).toBeGreaterThan(0); expect(stickAxis(20, 0, 40).x).toBeLessThan(1);
});
it("left stick moves continuously; release stops and manual movement cancels automatic walking", () => {
  const { engine, sticks } = setup(); const done = vi.fn(); engine.walkTo(new THREE.Vector3(2, 0, 2), done);
  fireEvent.keyDown(sticks[0], { key: "ArrowRight" }); frame();
  expect(engine.moveStick.x).toBe(1); expect(engine.goal).toBeNull(); expect(done).toHaveBeenCalledWith("cancelled");
  fireEvent.keyUp(sticks[0], { key: "ArrowRight" }); frame(); expect(engine.moveStick.length()).toBe(0);
});
it("right stick and shoulder buttons control continuous camera axes instead of quarter turns", () => {
  const { engine, sticks } = setup();
  fireEvent.keyDown(sticks[1], { key: "ArrowUp" }); frame(); expect(engine.cameraStick.y).toBe(-1);
  fireEvent.keyUp(sticks[1], { key: "ArrowUp" });
  const shoulder = screen.getByRole("button", { name: "Girar a cena para a direita" });
  fireEvent.keyDown(shoulder, { key: " " }); frame(); expect(engine.cameraStick.x).toBe(1); expect(engine.view).toBe(0);
  fireEvent.keyUp(shoulder, { key: " " }); frame(); expect(engine.cameraStick.length()).toBe(0);
});
it("photo orbit sends the analog event without moving the avatar", () => {
  const { engine, canvas, sticks } = setup(false); const events: unknown[] = [];
  canvas.addEventListener(ROOM_CAMERA_EVENT, e => events.push((e as CustomEvent).detail));
  fireEvent.keyDown(sticks[1], { key: "ArrowRight" }); frame(); expect(events).toContainEqual({ x: 1, y: 0, zoom: 0 });
  expect(engine.moveStick.length()).toBe(0);
});
it("interacts only within reach and keeps photo/dress actions separate", () => {
  const { engine, onPhoto, onVistaMe } = setup(); const run = vi.fn(); const object = new THREE.Object3D(); object.position.copy(engine.actor);
  act(() => { engine.actions.set("chair", { id: "chair", object, kind: "sit", radius: .85, run }); engine.updateNearby(); });
  fireEvent.click(screen.getByRole("button", { name: "X: interagir com o objeto próximo" })); expect(run).toHaveBeenCalledTimes(1);
  engine.actor.set(10, 0, 10); fireEvent.click(screen.getByRole("button", { name: "X: interagir com o objeto próximo" })); expect(run).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Quadrado: modo fotografia" })); expect(onPhoto).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Triângulo: Vista-me" })); expect(onVistaMe).toHaveBeenCalledOnce();
});
it("window blur and unmount stop both axes", () => {
  const { engine, sticks } = setup(); fireEvent.keyDown(sticks[0], { key: "ArrowUp" }); fireEvent.keyDown(sticks[1], { key: "ArrowLeft" }); frame();
  fireEvent(window, new Event("blur")); frame(); expect(engine.moveStick.length()).toBe(0); expect(engine.cameraStick.length()).toBe(0);
  cleanup(); expect(frames.size).toBe(0);
});
it("does not render controls until the canvas is ready", () => {
  renderApp(<RoomSceneControls engine={new RoomInteraction()} canvas={null} walk />);
  expect(document.querySelector(".room-gamepad")).toBeNull();
});
it("a screen-reader synthesized click makes one short movement and releases it", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const { engine } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Andar para frente" }), { detail: 0 }); frame();
    expect(engine.moveStick.y).toBe(-1);
    act(() => vi.advanceTimersByTime(TAP_STEP_MS)); frame(); expect(engine.moveStick.length()).toBe(0);
  } finally { vi.useRealTimers(); }
});
it("L1 is operable by a synthesized click without pointer or key events", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const { engine } = setup(); fireEvent.click(screen.getByRole("button", { name: "Girar a cena para a esquerda" }), { detail: 0 }); frame();
    expect(engine.cameraStick.x).toBe(-1); act(() => vi.advanceTimersByTime(TAP_STEP_MS)); frame(); expect(engine.cameraStick.length()).toBe(0);
  } finally { vi.useRealTimers(); }
});
