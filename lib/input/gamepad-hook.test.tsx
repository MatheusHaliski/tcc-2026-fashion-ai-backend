// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PAD, padMove, standardPad, usePad, type PadFrame } from "./gamepad";

const mk = (pressed: number[] = [], axes = [0, 0, 0, 0], extra: Partial<Gamepad> = {}) =>
  ({ axes, mapping: "standard", connected: true, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: 0 })), ...extra }) as unknown as Gamepad;

let frames: FrameRequestCallback[] = [];
let pads: (Gamepad | null)[] = [];
const cancel = vi.fn();
const step = (now: number) => { const f = frames; frames = []; f.forEach((cb) => cb(now)); };

function Harness({ enabled, onFrame, onIdle }: { enabled: boolean; onFrame: (f: PadFrame) => void; onIdle?: () => void }) {
  usePad(enabled, onFrame, onIdle);
  return null;
}

beforeEach(() => {
  frames = []; pads = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
  vi.stubGlobal("cancelAnimationFrame", cancel);
  Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => pads });
  vi.spyOn(performance, "now").mockReturnValue(0);
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); cancel.mockReset();
  delete (navigator as unknown as { getGamepads?: unknown }).getGamepads;
});

describe("usePad", () => {
  it("lê o controle a cada quadro, separa apertado de recém-apertado e limita o dt", () => {
    const seen: { dt: number; held: boolean; tapped: boolean; circle: boolean; x: number }[] = [];
    const onFrame = (f: PadFrame) => seen.push({ dt: f.dt, held: f.held(PAD.cross), tapped: f.tapped(PAD.cross), circle: f.tapped(PAD.circle), x: f.move.x });
    render(<Harness enabled onFrame={onFrame} />);
    pads = [mk([PAD.cross], [1, 0, 0, 0])];
    step(50);
    expect(seen[0].dt).toBeCloseTo(0.05);
    expect(seen[0]).toMatchObject({ held: true, tapped: true, circle: false });
    expect(seen[0].x).toBeCloseTo(1);
    step(1000);
    expect(seen[1]).toMatchObject({ dt: 0.1, held: true, tapped: false, circle: false });
  });

  it("controle sumiu: chama onIdle uma vez; aba oculta conta como sem controle", () => {
    const onFrame = vi.fn(), onIdle = vi.fn();
    render(<Harness enabled onFrame={onFrame} onIdle={onIdle} />);
    step(10);
    expect(onIdle).not.toHaveBeenCalled();
    pads = [mk()];
    step(20);
    expect(onFrame).toHaveBeenCalledTimes(1);
    const vis = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    step(30);
    step(40);
    expect(onIdle).toHaveBeenCalledTimes(1);
    vis.mockReturnValue("visible");
    step(50);
    expect(onFrame).toHaveBeenCalledTimes(2);
  });

  it("ao desmontar cancela o quadro e avisa onIdle se havia controle", () => {
    const onIdle = vi.fn();
    pads = [mk()];
    const { unmount } = render(<Harness enabled onFrame={vi.fn()} onIdle={onIdle} />);
    step(16);
    unmount();
    expect(cancel).toHaveBeenCalled();
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("desmontar sem controle não chama onIdle", () => {
    const onIdle = vi.fn();
    const { unmount } = render(<Harness enabled onFrame={vi.fn()} onIdle={onIdle} />);
    step(16);
    unmount();
    expect(onIdle).not.toHaveBeenCalled();
  });

  it("desativado ou sem Gamepad API não agenda quadros", () => {
    render(<Harness enabled={false} onFrame={vi.fn()} />);
    expect(frames).toHaveLength(0);
    cleanup();
    delete (navigator as unknown as { getGamepads?: unknown }).getGamepads;
    render(<Harness enabled onFrame={vi.fn()} />);
    expect(frames).toHaveLength(0);
  });
});

describe("standardPad e padMove: bordas", () => {
  it("ignora controle desconectado e usa a lista do navegador por padrão", () => {
    pads = [mk([], [0, 0], { connected: false }), null];
    expect(standardPad()).toBeNull();
    const ok = mk();
    pads = [ok];
    expect(standardPad()).toBe(ok);
  });

  it("parado e sem direcional não anda; eixos ausentes contam como zero", () => {
    expect(padMove(mk([], []))).toEqual({ x: 0, y: 0 });
    const d = padMove(mk([PAD.left, PAD.down], []));
    expect(d.x).toBeCloseTo(-Math.SQRT1_2);
    expect(d.y).toBeCloseTo(Math.SQRT1_2);
  });
});
