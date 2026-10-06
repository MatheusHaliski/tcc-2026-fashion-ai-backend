// @vitest-environment jsdom
/** Som de tecido e háptico do quarto (DET-D04): o tecido sai das peças do módulo; som e vibração respeitam as preferências. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fabricOf, feel, type Fabric } from "./sensory";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

/** AudioContext mínimo: registra o que a síntese do som pede. */
function fakeAudio() {
  const calls: string[] = [];
  const node = () => ({ connect: vi.fn(function c(this: unknown) { return node(); }), start: vi.fn(() => calls.push("start")), stop: vi.fn(), buffer: null as unknown,
    type: "", frequency: { value: 0 }, Q: { value: 0 }, gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } });
  class AC { state = "suspended"; currentTime = 0; sampleRate = 8000; destination = {}; resume = vi.fn(async () => { calls.push("resume"); });
    createBuffer(_c: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { return node(); } createBiquadFilter() { return node(); } createGain() { return node(); } }
  vi.stubGlobal("AudioContext", AC);
  (window as unknown as { AudioContext: unknown }).AudioContext = AC;
  return calls;
}

describe("som de tecido e háptico (quarto)", () => {
  it("tecido pelas subcategorias, ou pelo acabamento do módulo vazio", () => {
    const cases: [string[], string | null, Fabric][] = [
      [["jeans"], null, "DENIM"], [["blusa_seda"], null, "SILK"], [["sweater"], null, "WOOL"], [["jaqueta_couro"], null, "LEATHER"],
      [["t_shirt"], null, "COTTON"], [[], "VIDRO", "GLASS"], [[], "ACRILICO", "GLASS"], [[], "MADEIRA", "WOOD"], [[], null, "WOOD"],
    ];
    for (const [subs, finish, want] of cases) expect(fabricOf(subs, finish)).toBe(want);
  });

  it("vibra no celular (curto para madeira e vidro, mais longo para tecido), e não com reduzir movimento", () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    feel({ haptics: true, fabric: "WOOD" });
    feel({ haptics: true, fabric: "DENIM" });
    feel({ haptics: true, fabric: "SILK", reduceMotion: true });
    expect(vibrate).toHaveBeenNthCalledWith(1, 8);
    expect(vibrate).toHaveBeenNthCalledWith(2, 14);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it("som ligado: sintetiza o ruído filtrado do tecido; desligado, nada toca", () => {
    const calls = fakeAudio();
    feel({ sound: false, fabric: "DENIM" });
    expect(calls).toEqual([]);
    for (const fabric of ["DENIM", "SILK", "WOOL", "LEATHER", "COTTON", "WOOD", "GLASS"] as Fabric[]) feel({ sound: true, fabric });
    expect(calls.filter((c) => c === "start").length).toBe(7);
  });
});
