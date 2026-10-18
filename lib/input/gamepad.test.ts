/**
 * Controle de videogame: zona morta do analógico, só o mapeamento padrão conta, o direcional anda quando o analógico
 * está parado e L1/R1 somam ao giro da câmera.
 */
import { describe, expect, it } from "vitest";
import { deadzone, PAD, padLook, padMove, standardPad } from "./gamepad";

const pad = (axes: number[], pressed: number[] = [], mapping = "standard") =>
  ({ axes, mapping, connected: true, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) }) as unknown as Gamepad;

describe("controle de videogame", () => {
  it("ignora o analógico dentro da zona morta e reescala o resto de 0 a 1", () => {
    expect(deadzone(.05, .02)).toEqual({ x: 0, y: 0 });
    expect(deadzone(1, 0).x).toBeCloseTo(1, 5);
    expect(deadzone(.54, 0).x).toBeCloseTo(.5, 5);
  });
  it("usa o primeiro controle no mapeamento padrão", () => {
    const other = pad([0, 0], [], ""), ds = pad([0, 0]);
    expect(standardPad([null, other, ds])).toBe(ds);
    expect(standardPad([other])).toBeNull();
    expect(standardPad(null)).toBeNull();
  });
  it("anda pelo analógico esquerdo ou, parado, pelo direcional (diagonal do mesmo tamanho)", () => {
    expect(padMove(pad([0, -1]))).toEqual({ x: 0, y: -1 });
    const diagonal = padMove(pad([0, 0], [PAD.up, PAD.right]));
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 5); expect(diagonal.y).toBeLessThan(0);
  });
  it("gira a câmera pelo analógico direito e por L1/R1", () => {
    expect(padLook(pad([0, 0, 0, 0], [PAD.r1])).x).toBe(1);
    expect(padLook(pad([0, 0, 0, 0], [PAD.l1])).x).toBe(-1);
  });
});
