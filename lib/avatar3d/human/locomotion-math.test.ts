import { describe, expect, it } from "vitest";
import { clamp, D, hash, mix, pulse, smooth } from "./locomotion-math";

describe("funções escalares da locomoção do avatar", () => {
  it("clamp prende o valor no intervalo", () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
    expect(clamp(7, 0, 1)).toBe(1);
  });

  it("smooth faz a curva suave de 0 a 1 entre as bordas", () => {
    expect(smooth(0, 1, -5)).toBe(0);
    expect(smooth(0, 1, 0.5)).toBeCloseTo(0.5);
    expect(smooth(0, 1, 2)).toBe(1);
    expect(smooth(0, 1, 0.25)).toBeLessThan(0.25);
  });

  it("mix interpola linearmente entre dois valores", () => {
    expect(mix(10, 20, 0)).toBe(10);
    expect(mix(10, 20, 0.5)).toBe(15);
    expect(mix(10, 20, 1)).toBe(20);
  });

  it("hash é determinístico e fica entre 0 e 1", () => {
    for (let i = 0; i < 50; i++) {
      const v = hash(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(hash(i)).toBe(v);
    }
    expect(hash(1)).not.toBe(hash(2));
  });

  it("pulse sobe, se mantém em 1 e desce dentro da janela", () => {
    expect(pulse(0, 1, 0.2, -0.1)).toBe(0);
    expect(pulse(0, 1, 0.2, 0.5)).toBe(1);
    expect(pulse(0, 1, 0.2, 1.1)).toBe(0);
    expect(pulse(0, 1, 0.2, 0.1)).toBeGreaterThan(0);
    expect(pulse(0, 1, 0.2, 0.1)).toBeLessThan(1);
  });

  it("D converte graus em radianos", () => {
    expect(180 * D).toBeCloseTo(Math.PI);
  });
});
