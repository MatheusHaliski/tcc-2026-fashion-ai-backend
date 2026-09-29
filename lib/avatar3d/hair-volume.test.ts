import { describe, expect, it } from "vitest";
import { hairVolume, skullHalf } from "./hair";
import { HAIR_LEVELS } from "./image-stats";

/** Silhueta sintética: o crânio + `extra` cm de cabelo das têmporas para cima; `hang` = cabelo pendurado abaixo. */
const outline = (extra: number, hang = 0) => HAIR_LEVELS.map((y) => (y > 14 ? 0 : y >= 4 ? skullHalf(y) + extra : hang ? skullHalf(y) + hang : 0));

describe("volume do cabelo pela silhueta", () => {
  it("classes: rente, normal, volumoso, muito volumoso", () => {
    const at = (extra: number, top = 14) => hairVolume({ present: true, cutTop: false, top, outline: outline(extra) });
    expect(at(0.6).level).toBe("flat");
    expect(at(1.8).level).toBe("normal");
    expect(at(3.8).level).toBe("full");
    expect(at(7, 18).level).toBe("big");
    expect(at(0.6).factor).toBeLessThan(1); expect(at(7, 18).factor).toBeGreaterThan(1.5);
  });

  it("cabelo longo pendurado ao lado do rosto não conta como volume", () => {
    const sleek = hairVolume({ present: true, cutTop: false, top: 14, outline: outline(1, 8) });
    expect(sleek.level).toBe("flat");
  });

  it("o alto cortado na foto não vale; o alto medido pesa", () => {
    expect(hairVolume({ present: true, cutTop: true, top: 20, outline: outline(1) }).top).toBe(0);
    expect(hairVolume({ present: true, cutTop: false, top: 19.5, outline: outline(1) }).level).toBe("full");
  });

  it("sem cabelo medido: normal (fator 1)", () => {
    expect(hairVolume({ present: false, cutTop: false, top: 0, outline: [] })).toMatchObject({ level: "normal", factor: 1 });
  });
});
