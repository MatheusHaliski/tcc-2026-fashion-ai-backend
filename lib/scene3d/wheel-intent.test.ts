import { describe, expect, it } from "vitest";
import { ENGAGE_MS, afterWheel, initialWheelState, wheelIntent, wheelPixels } from "./wheel-intent";

const down = { deltaX: 0, deltaY: 60, deltaMode: 0, ctrlKey: false };

describe("rolagem inteligente: página ou câmera", () => {
  it("rolagem fria ao passar pelo palco desce a página (sem prender)", () => {
    expect(wheelIntent(down, 10_000, initialWheelState())).toBe("page");
  });
  it("pinça no trackpad é zoom de propósito", () => {
    expect(wheelIntent({ ...down, ctrlKey: true }, 10_000, initialWheelState())).toBe("camera");
  });
  it("depois de mexer no palco, a roda vai para a câmera por alguns segundos", () => {
    const s = { ...initialWheelState(), engagedUntil: 10_000 + ENGAGE_MS };
    expect(wheelIntent(down, 12_000, s)).toBe("camera");
    expect(wheelIntent(down, 10_000 + ENGAGE_MS + 1, s)).toBe("page");
  });
  it("página rolando há pouco: o gesto continua na página mesmo com o ponteiro parado no palco", () => {
    const s = { ...initialWheelState(), lastPageScrollAt: 9_800, hoverSince: 9_000 };
    expect(wheelIntent(down, 10_000, s)).toBe("page");
  });
  it("ponteiro parado em cima do palco antes de rolar: câmera", () => {
    expect(wheelIntent(down, 10_000, { ...initialWheelState(), hoverSince: 9_300 })).toBe("camera");
    expect(wheelIntent(down, 10_000, { ...initialWheelState(), hoverSince: 9_700 })).toBe("page");
  });
  it("rolagem horizontal pura fica com o navegador", () => {
    expect(wheelIntent({ ...down, deltaX: 80, deltaY: 5 }, 10_000, { ...initialWheelState(), engagedUntil: 20_000 })).toBe("page");
  });
  it("câmera no limite devolve a rolagem à página e desengaja; câmera que andou prolonga", () => {
    const engaged = { ...initialWheelState(), engagedUntil: 10_500 };
    expect(afterWheel(engaged, "camera", true, 10_000).engagedUntil).toBe(11_500);
    const released = afterWheel(engaged, "camera", false, 10_000);
    expect(released.engagedUntil).toBe(0); expect(released.lastPageScrollAt).toBe(10_000);
    expect(wheelIntent(down, 10_100, released)).toBe("page");                         // o resto do gesto segue na página
    expect(afterWheel(engaged, "page", false, 10_000)).toBe(engaged);
  });
  it("normaliza linhas e páginas para pixels", () => {
    expect(wheelPixels({ ...down, deltaY: 3, deltaMode: 1 })).toBe(48);
    expect(wheelPixels({ ...down, deltaY: 1, deltaMode: 2 })).toBe(400);
  });
});
