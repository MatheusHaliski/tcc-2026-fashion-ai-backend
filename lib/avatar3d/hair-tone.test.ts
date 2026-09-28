import { describe, expect, test } from "vitest";
import { HAIR_TONES, familyOf, hairColorFor, hexToLab, labToHex, levelOf, measureTone, paletteId, renderColor, rgbToLab } from "./hair-tone";

/** Pixels de cabelo "fotografados": a cor do fio com sombra (×0,45) e reflexo (+claro) misturados. */
function photo(hex: string, n = 400): number[][] {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const k = i % 10 < 3 ? 0.45 : i % 10 > 8 ? 1.5 : 0.9 + (i % 7) * 0.03;
    out.push(c.map((v) => Math.min(255, v * k)));
  }
  return out;
}

describe("tom do cabelo (RF40)", () => {
  test("Lab ida e volta", () => {
    for (const h of ["#16120f", "#a57e52", "#e9dab6", "#9a4d27"]) expect(labToHex(...hexToLab(h))).toBe(h);
  });

  test("a paleta é monotônica e cada tom é distinguível do vizinho (ΔE ≥ 5)", () => {
    const L = HAIR_TONES.slice(0, 10).map((t) => hexToLab(t.color)[0]);
    for (let i = 1; i < L.length; i++) expect(L[i]).toBeGreaterThan(L[i - 1] + 4);
    for (let i = 1; i < HAIR_TONES.length; i++) {
      const a = hexToLab(HAIR_TONES[i - 1].color), b = hexToLab(HAIR_TONES[i].color);
      expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeGreaterThan(5);
    }
  });

  test("preto continua preto (a faixa clara antiga puxava para castanho médio)", () => {
    const m = measureTone(photo("#1c1814"))!;
    expect(m.tone.level).toBeLessThanOrEqual(2);
    expect(hexToLab(m.color)[0]).toBeLessThan(15);
  });

  test("castanho escuro × castanho claro × loiro escuro × loiro claro saem em níveis diferentes e em ordem", () => {
    const tones = ["#3a2a1e", "#6a4a34", "#8f6c48", "#c9a676"].map((h) => measureTone(photo(h))!.tone.level);
    for (let i = 1; i < tones.length; i++) expect(tones[i]).toBeGreaterThan(tones[i - 1]);
    const colors = ["#3a2a1e", "#6a4a34", "#8f6c48", "#c9a676"].map((h) => hexToLab(measureTone(photo(h))!.color)[0]);
    for (let i = 1; i < colors.length; i++) expect(colors[i]).toBeGreaterThan(colors[i - 1] + 5);
  });

  test("famílias: acobreado, ruivo, grisalho, branco, acinzentado, dourado", () => {
    expect(familyOf(...rgbToLab(170, 85, 45))).toBe("copper");
    expect(familyOf(...rgbToLab(120, 40, 30))).toBe("red");
    expect(familyOf(...rgbToLab(140, 138, 136))).toBe("gray");
    expect(familyOf(...rgbToLab(222, 220, 216))).toBe("white");
    expect(familyOf(...rgbToLab(80, 74, 68))).toBe("ash");
    expect(familyOf(...rgbToLab(200, 165, 90))).toBe("golden");
    expect(paletteId({ level: 6, family: "copper" })).toBe(11);
    expect(paletteId({ level: 3, family: "natural" })).toBe(3);
  });

  test("a cor desenhada fica no L* do nível e perto do matiz medido", () => {
    const ash = renderColor({ level: 7, family: "ash" }, rgbToLab(150, 145, 135));
    const gold = renderColor({ level: 7, family: "golden" }, rgbToLab(190, 150, 80));
    expect(Math.abs(hexToLab(ash)[0] - hexToLab(gold)[0])).toBeLessThan(1.5);
    expect(Math.hypot(hexToLab(gold)[1], hexToLab(gold)[2])).toBeGreaterThan(Math.hypot(hexToLab(ash)[1], hexToLab(ash)[2]));
  });

  test("níveis por L*", () => {
    expect(levelOf(8)).toBe(1); expect(levelOf(25)).toBe(3); expect(levelOf(46)).toBe(6); expect(levelOf(80)).toBe(10);
  });

  test("a escolha da pessoa vence a medida; 0 = a medida", () => {
    expect(hairColorFor("#123456", 0)).toBe("#123456");
    expect(hairColorFor("#123456", 8)).toBe(HAIR_TONES[7].color);
    expect(hairColorFor(null, 99)).toBe(null);
  });

  test("poucos pixels: sem medida", () => { expect(measureTone(photo("#333333", 10))).toBeNull(); });
});
