// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useFashionDepth } from "./use-fashion-depth";

let api: ReturnType<typeof useFashionDepth>;
function Harness({ enabled }: { enabled: boolean }) {
  api = useFashionDepth(enabled);
  return <div data-testid="card" ref={(el) => { api.ref.current = el; }} {...api.events}>{api.sensorOn ? "on" : "off"}{api.sensorError ? " erro" : ""}{api.sensorAvailable ? " sensor" : ""}</div>;
}

let frames: FrameRequestCallback[] = [];
const flush = () => act(() => { const f = frames; frames = []; f.forEach((cb) => cb(0)); });
const cancel = vi.fn();
const tilt = () => {
  const s = screen.getByTestId("card").style;
  return [s.getPropertyValue("--fashion-tilt-x"), s.getPropertyValue("--fashion-tilt-y"), s.getPropertyValue("--fashion-glare-x"), s.getPropertyValue("--fashion-glare-y")];
};
function rect(el: HTMLElement) {
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
}
class FakeOrientation extends Event {
  static requestPermission?: () => Promise<string>;
}
function orientation(beta: number | null, gamma: number | null) {
  const e = new Event("deviceorientation") as DeviceOrientationEvent;
  Object.assign(e, { beta, gamma });
  act(() => { window.dispatchEvent(e); });
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
  vi.stubGlobal("cancelAnimationFrame", cancel);
  delete document.documentElement.dataset.reduceMotion;
  FakeOrientation.requestPermission = undefined;
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); cancel.mockReset(); delete document.documentElement.dataset.reduceMotion; });

describe("useFashionDepth", () => {
  it("o ponteiro não inclina mais o card: o hook não expõe eventos de ponteiro", () => {
    render(<Harness enabled />);
    const card = screen.getByTestId("card");
    rect(card);
    expect(api.events).toEqual({});
    fireEvent.pointerMove(card, { clientX: 200, clientY: 0, pointerType: "mouse" });
    fireEvent.pointerLeave(card);
    expect(frames).toHaveLength(0);
    expect(cancel).not.toHaveBeenCalled();
    expect(tilt()).toEqual(["", "", "", ""]);
  });

  it("ignora toque, cartão sem tamanho, desativado e movimento reduzido", () => {
    const { rerender } = render(<Harness enabled />);
    const card = screen.getByTestId("card");
    fireEvent.pointerMove(card, { clientX: 10, clientY: 10, pointerType: "mouse" });
    rect(card);
    fireEvent.pointerMove(card, { clientX: 10, clientY: 10, pointerType: "touch" });
    document.documentElement.dataset.reduceMotion = "true";
    fireEvent.pointerMove(card, { clientX: 10, clientY: 10, pointerType: "mouse" });
    delete document.documentElement.dataset.reduceMotion;
    rerender(<Harness enabled={false} />);
    fireEvent.pointerMove(card, { clientX: 10, clientY: 10, pointerType: "mouse" });
    expect(frames).toHaveLength(0);
  });

  it("frame agendado após o card sair da tela não quebra", () => {
    const { unmount } = render(<Harness enabled />);
    const card = screen.getByTestId("card");
    rect(card);
    fireEvent.pointerMove(card, { clientX: 50, clientY: 50, pointerType: "pen" });
    const pending = frames.slice();
    api.ref.current = null;
    expect(() => pending.forEach((cb) => cb(0))).not.toThrow();
    unmount();
  });

  it("sem DeviceOrientationEvent, sensor fica indisponível", () => {
    vi.stubGlobal("DeviceOrientationEvent", undefined);
    render(<Harness enabled />);
    expect(api.sensorAvailable).toBe(false);
  });

  it("liga o sensor sem pedido de permissão, usa a primeira leitura como base e desliga", async () => {
    vi.stubGlobal("DeviceOrientationEvent", FakeOrientation);
    render(<Harness enabled />);
    expect(api.sensorAvailable).toBe(true);
    await act(async () => { await api.toggleSensor(); });
    expect(screen.getByTestId("card").textContent).toContain("on");
    orientation(null, 5);
    orientation(10, 10);
    expect(frames).toHaveLength(0);
    orientation(35, 35);
    flush();
    expect(tilt()).toEqual(["-5deg", "5deg", "85%", "85%"]);
    const card = screen.getByTestId("card");
    rect(card);
    fireEvent.pointerMove(card, { clientX: 1, clientY: 1, pointerType: "mouse" });
    expect(frames).toHaveLength(0);
    await act(async () => { await api.toggleSensor(); });
    expect(screen.getByTestId("card").textContent).toContain("off");
    expect(tilt()[0]).toBe("0deg");
    orientation(90, 90);
    expect(frames).toHaveLength(0);
  });

  it("permissão negada marca erro; concedida liga", async () => {
    vi.stubGlobal("DeviceOrientationEvent", FakeOrientation);
    FakeOrientation.requestPermission = vi.fn().mockResolvedValueOnce("denied").mockResolvedValueOnce("granted");
    render(<Harness enabled />);
    await act(async () => { await api.toggleSensor(); });
    expect(screen.getByTestId("card").textContent).toContain("erro");
    await act(async () => { await api.toggleSensor(); });
    expect(screen.getByTestId("card").textContent).toContain("on");
    expect(screen.getByTestId("card").textContent).not.toContain("erro");
  });

  it("falha no pedido de permissão marca erro", async () => {
    vi.stubGlobal("DeviceOrientationEvent", FakeOrientation);
    FakeOrientation.requestPermission = vi.fn().mockRejectedValue(new Error("x"));
    render(<Harness enabled />);
    await act(async () => { await api.toggleSensor(); });
    expect(screen.getByTestId("card").textContent).toContain("erro");
  });

  it("não liga desativado, com movimento reduzido ou se desmontar durante a permissão", async () => {
    vi.stubGlobal("DeviceOrientationEvent", FakeOrientation);
    const { rerender, unmount } = render(<Harness enabled={false} />);
    await act(async () => { await api.toggleSensor(); });
    expect(api.sensorOn).toBe(false);
    rerender(<Harness enabled />);
    document.documentElement.dataset.reduceMotion = "true";
    await act(async () => { await api.toggleSensor(); });
    expect(api.sensorOn).toBe(false);
    delete document.documentElement.dataset.reduceMotion;
    let grant!: (v: string) => void;
    FakeOrientation.requestPermission = () => new Promise((r) => { grant = r; });
    const toggle = api.toggleSensor;
    let pending!: Promise<void>;
    act(() => { pending = toggle(); });
    unmount();
    const add = vi.spyOn(window, "addEventListener");
    grant("granted");
    await pending;
    expect(add).not.toHaveBeenCalledWith("deviceorientation", expect.anything());
    add.mockRestore();
  });

  it("ativar movimento reduzido com o sensor ligado desliga e zera", async () => {
    vi.stubGlobal("DeviceOrientationEvent", FakeOrientation);
    render(<Harness enabled />);
    await act(async () => { await api.toggleSensor(); });
    expect(api.sensorOn).toBe(true);
    act(() => { document.documentElement.dataset.reduceMotion = "true"; });
    await waitFor(() => expect(screen.getByTestId("card").textContent).toContain("off"));
    expect(tilt()).toEqual(["0deg", "0deg", "50%", "50%"]);
  });

  it("mudança de atributo sem movimento reduzido mantém o sensor", async () => {
    vi.stubGlobal("DeviceOrientationEvent", FakeOrientation);
    render(<Harness enabled />);
    await act(async () => { await api.toggleSensor(); });
    act(() => { document.documentElement.dataset.reduceMotion = "false"; });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(api.sensorOn).toBe(true);
  });
});
