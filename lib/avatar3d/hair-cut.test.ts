import { describe, expect, it } from "vitest";
import { HAIR_CUTS, hairWithCut } from "./hair-cut";
import { clampAdjust } from "./model";
import type { AvatarHair } from "./model";

const measured: AvatarHair = { present: true, color: "#664631", top: 15.2, side: 9.1, bottom: -18, fringe: 0.2, cut: false, length: "long", texture: "wavy", outline: [0, 7, 8, 8.5, 9, 9, 9, 9, 9, 9, 8.5, 8, 8, 8, 7.5, 7, 6, 5, 0, 0, 0] };
const bald: AvatarHair = { present: false, color: null, top: 0, side: 0, bottom: null, fringe: 0, cut: false, length: "bald" };

describe("corte de cabelo escolhido", () => {
  it("0 (ou ausente) mantém o cabelo medido", () => {
    expect(hairWithCut(measured, 0)).toBe(measured);
    expect(hairWithCut(measured, undefined)).toBe(measured);
  });

  it("chanel corta a silhueta na linha do queixo e mantém cor e textura", () => {
    const c = hairWithCut(measured, HAIR_CUTS.find((x) => x.key === "chanel")!.id);
    expect(c.length).toBe("medium"); expect(c.bottom).toBeCloseTo(-9.8);
    expect(c.color).toBe(measured.color); expect(c.texture).toBe("wavy");
    // HAIR_LEVELS: 16, 14, … — abaixo de −10,8 cm não sobra silhueta
    expect(c.outline!.slice(14).every((w) => w === 0)).toBe(true);
    expect(c.outline![3]).toBe(8.5);
  });

  it("curto e topete: laterais batidas (sem o volume lateral da foto); topete sobe o alto", () => {
    const curto = hairWithCut(measured, 2), topete = hairWithCut(measured, 3);
    expect(curto.outline!.every((w) => w === 0)).toBe(true);
    expect(topete.top).toBeGreaterThan(curto.top);
    expect(topete.length).toBe("short");
  });

  it("careca que escolhe um corte ganha cabelo (castanho médio até escolher o tom)", () => {
    const c = hairWithCut(bald, HAIR_CUTS.find((x) => x.key === "medio")!.id);
    expect(c.present).toBe(true); expect(c.length).toBe("medium"); expect(c.color).toBe("#4a3323");
  });

  it("cobertura de cabeça (lenço, turbante) não é trocada por corte", () => {
    const covered = { ...measured, cover: "#4a482b" };
    expect(hairWithCut(covered, 5)).toBe(covered);
  });

  it("ajuste do corte é inteiro e limitado", () => {
    expect(clampAdjust({ hairCut: 3.4 }).hairCut).toBe(3);
    expect(clampAdjust({ hairCut: 99 }).hairCut).toBe(HAIR_CUTS.length);
    expect(clampAdjust({}).hairCut).toBe(0);
  });
});
