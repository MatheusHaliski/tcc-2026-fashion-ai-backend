// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { FittingDetailApi } from "@/lib/scene3d/orbit-steps";
import { ENGAGE_MS, HOVER_INTENT_MS } from "@/lib/scene3d/wheel-intent";
import { WHEEL_HINT_MS, useSmartWheel } from "./use-smart-wheel";

let clock = 10_000;
beforeEach(() => { clock = 10_000; vi.spyOn(performance, "now").mockImplementation(() => clock); vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

function Stage({ api }: { api: FittingDetailApi }) {
  const ref = useRef<HTMLDivElement>(null), hint = useSmartWheel(ref, api);
  return <div ref={ref} data-testid="stage"><canvas data-testid="canvas" /><div data-testid="panel">painel</div>{hint && <p>dica</p>}</div>;
}
function setup(consumes: (deltaY: number, pinch?: boolean) => boolean = () => true) {
  const api = { focus: vi.fn(), travel: vi.fn(), wheel: vi.fn(consumes), subscribe: vi.fn(() => () => {}) } satisfies FittingDetailApi;
  render(<Stage api={api} />);
  const canvas = screen.getByTestId("canvas"), stage = screen.getByTestId("stage");
  const orbit = vi.fn(); canvas.addEventListener("wheel", orbit);       // o OrbitControls escuta a roda no canvas
  const page = vi.fn(); document.body.addEventListener("wheel", page);
  return { api, canvas, stage, orbit, page };
}
const wheel = (target: Element, init: WheelEventInit = {}) => {
  const e = new WheelEvent("wheel", { deltaY: 60, bubbles: true, cancelable: true, ...init });
  act(() => { target.dispatchEvent(e); });
  return e;
};
const pointer = (target: Element, type: string, extra: Record<string, unknown> = {}) => {
  const e = new MouseEvent(type, { bubbles: type !== "pointerenter" && type !== "pointerleave" });
  for (const [k, v] of Object.entries({ pointerType: "mouse", ...extra })) Object.defineProperty(e, k, { value: v });
  act(() => { target.dispatchEvent(e); });
};

describe("rolagem inteligente no palco do provador", () => {
  it("rolagem fria sobre o 3D desce a página, mostra a dica e nunca chega ao OrbitControls", () => {
    const { api, canvas, orbit, page } = setup();
    const e = wheel(canvas);
    expect(e.defaultPrevented).toBe(false);
    expect(api.wheel).not.toHaveBeenCalled();
    expect(orbit).not.toHaveBeenCalled();
    expect(page).not.toHaveBeenCalled();          // a propagação para no palco; a ação padrão (rolar a página) continua
    expect(screen.getByText("dica")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(WHEEL_HINT_MS + 10); });
    expect(screen.queryByText("dica")).toBeNull();
  });

  it("depois de clicar no palco, a roda vai para a câmera e não rola a página", () => {
    const { api, canvas, stage } = setup();
    pointer(stage, "pointerdown");
    const e = wheel(canvas, { deltaY: 3, deltaMode: 1 });
    expect(api.wheel).toHaveBeenLastCalledWith(48, false);
    expect(e.defaultPrevented).toBe(true);
    expect(screen.queryByText("dica")).toBeNull();
    clock += ENGAGE_MS + 2000;
    expect(wheel(canvas).defaultPrevented).toBe(false);                  // passou o engajamento: página de novo
  });

  it("câmera no limite devolve a rolagem: o resto do gesto segue na página", () => {
    const { api, canvas, stage } = setup(() => false);
    pointer(stage, "pointerdown");
    expect(wheel(canvas).defaultPrevented).toBe(false);
    expect(api.wheel).toHaveBeenCalledTimes(1);
    clock += 100;
    expect(wheel(canvas).defaultPrevented).toBe(false);
    expect(api.wheel).toHaveBeenCalledTimes(1);
  });

  it("pinça do trackpad é zoom da câmera, nunca da página", () => {
    const { api, canvas } = setup(() => false);
    const e = wheel(canvas, { deltaY: -4, ctrlKey: true });
    expect(api.wheel).toHaveBeenLastCalledWith(-40, true);
    expect(e.defaultPrevented).toBe(true);
  });

  it("ponteiro parado sobre o palco antes de rolar: câmera; se a página rolou depois, não", () => {
    const { api, canvas, stage } = setup();
    pointer(stage, "pointerenter");
    clock += HOVER_INTENT_MS + 50;
    expect(wheel(canvas).defaultPrevented).toBe(true);
    expect(api.wheel).toHaveBeenCalledTimes(1);

    cleanup(); const second = setup();
    pointer(second.stage, "pointerenter");
    clock += 100; act(() => { window.dispatchEvent(new Event("scroll")); });
    clock += HOVER_INTENT_MS + 50;
    expect(wheel(second.canvas).defaultPrevented).toBe(false);          // chegou ao palco com a página rolando
    pointer(second.canvas, "pointermove", { movementX: 0, movementY: 0 }); // evento sintético do fim da rolagem
    clock += HOVER_INTENT_MS + 50;
    expect(wheel(second.canvas).defaultPrevented).toBe(false);
    pointer(second.canvas, "pointermove", { movementX: 4, movementY: 1 }); // a pessoa mexeu o mouse em cima do avatar
    clock += HOVER_INTENT_MS + 50;
    expect(wheel(second.canvas).defaultPrevented).toBe(true);
  });

  it("roda sobre o painel e os botões por cima do palco é da página", () => {
    const { api, stage, page } = setup();
    pointer(stage, "pointerdown");
    const e = wheel(screen.getByTestId("panel"));
    expect(api.wheel).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
    expect(page).toHaveBeenCalledTimes(1);
  });
});
