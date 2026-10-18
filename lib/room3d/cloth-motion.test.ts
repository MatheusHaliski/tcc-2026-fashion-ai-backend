/**
 * Movimento natural das roupas: a peça na mão balança para trás quando a mão acelera e volta ao repouso; solta, cai
 * mais devagar que em queda livre (arrasto do tecido), deita ao chegar ao chão e assenta; o gesto de pendurar sobe e
 * volta.
 */
import { describe, expect, it } from "vitest";
import { SWING_REST, fallPose, hangReach, stepFall, stepSwing } from "./cloth-motion";

describe("pêndulo da peça na mão", () => {
  it("a barra fica para trás quando a mão acelera para a frente e volta ao repouso quando a mão para", () => {
    let s = { ...SWING_REST };
    for (let i = 0; i < 12; i++) s = stepSwing(s, { x: 0, z: 3 }, 1 / 60);                       // anda para a frente
    expect(s.ax).toBeGreaterThan(0.02);                                                           // gira +x: barra para −z (para trás)
    for (let i = 0; i < 600; i++) s = stepSwing(s, { x: 0, z: 0 }, 1 / 60);                       // 10 s parado
    expect(Math.abs(s.ax)).toBeLessThan(1e-3); expect(Math.abs(s.vx)).toBeLessThan(1e-3);
  });
  it("aceleração para o lado leva a barra para o outro lado, e o ângulo nunca passa do limite", () => {
    let s = { ...SWING_REST };
    for (let i = 0; i < 10; i++) s = stepSwing(s, { x: 4, z: 0 }, 1 / 60);
    expect(s.az).toBeLessThan(0);
    for (let i = 0; i < 200; i++) s = stepSwing(s, { x: 500, z: -500 }, 1 / 60);
    expect(Math.abs(s.az)).toBeLessThanOrEqual(0.9); expect(Math.abs(s.ax)).toBeLessThanOrEqual(0.9);
  });
});

describe("queda da peça solta", () => {
  it("cai com arrasto (mais devagar que a queda livre), chega ao chão e conta o tempo pousada", () => {
    let f = { y: 1.2, vy: 0, landed: -1 }, t = 0;
    while (f.landed < 0 && t < 3) { f = stepFall(f, 0.03, 1 / 60); t += 1 / 60; }
    expect(f.y).toBe(0.03); expect(t).toBeGreaterThan(Math.sqrt((2 * 1.17) / 9.81));             // queda livre levaria ~0,49 s
    f = stepFall(f, 0.03, 0.1); expect(f.landed).toBeGreaterThan(0);
  });
  it("começa pendurada, deita ao chegar ao chão, quica de leve e o tecido assenta", () => {
    expect(fallPose(1.2, 1.2, 0.03, -1, 0.5).tiltX).toBeCloseTo(0, 6);
    expect(fallPose(1.2, 0.6, 0.03, -1, 0.5).tiltX).toBeLessThan(0);
    const landed = fallPose(1.2, 0.03, 0.03, 0, 0.5); expect(landed.tiltX).toBeCloseTo(-Math.PI / 2, 6); expect(landed.squash).toBeCloseTo(1, 6);
    const later = fallPose(1.2, 0.03, 0.03, 1.5, 0.5); expect(later.squash).toBeLessThan(0.5); expect(Math.abs(later.tiltX + Math.PI / 2)).toBeLessThan(0.01);
    expect(later.spinZ).toBeCloseTo(0.5, 6);
  });
});

it("pendurar no varão: a mão sobe até o varão e volta", () => {
  expect(hangReach(0)).toBeCloseTo(0, 6); expect(hangReach(0.55)).toBeCloseTo(1, 6); expect(hangReach(1)).toBeCloseTo(0, 6);
});
