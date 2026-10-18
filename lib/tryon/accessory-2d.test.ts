/**
 * Prévia 2D de acessórios: cada subcategoria vai para o ponto certo do rosto ou do corpo, acompanha o giro da cabeça e
 * do braço, e nada é desenhado quando os pontos de que ela precisa não foram vistos.
 */
import { describe, expect, it } from "vitest";
import { accessoryKind, placeAccessory, type Detected } from "./accessory-2d";

function face(points: Record<number, [number, number]>) {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.3, z: 0 }));
  for (const [i, [x, y]] of Object.entries(points)) lm[Number(i)] = { x, y, z: 0 };
  return lm;
}
const FRONT = face({ 33: [0.45, 0.3], 263: [0.55, 0.3], 168: [0.5, 0.29], 234: [0.4, 0.32], 454: [0.6, 0.32], 10: [0.5, 0.22],
  152: [0.5, 0.42], 132: [0.42, 0.38], 361: [0.58, 0.38], 338: [0.53, 0.22] });
function pose(overrides: Record<number, [number, number, number]> = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
  const base: Record<number, [number, number, number]> = { 11: [0.62, 0.5, 0.9], 12: [0.38, 0.5, 0.9], 13: [0.66, 0.65, 0.9], 15: [0.68, 0.78, 0.9],
    14: [0.34, 0.65, 0.5], 16: [0.32, 0.78, 0.4], 19: [0.69, 0.82, 0.8], 23: [0.58, 0.8, 0.9], 24: [0.42, 0.8, 0.6] };
  for (const [i, [x, y, v]] of Object.entries({ ...base, ...overrides })) lm[Number(i)] = { x, y, z: 0, visibility: v };
  return lm;
}
const BOTH: Detected = { face: FRONT, pose: pose() };
const at = (sub: string, found = BOTH, aspect = 0.4) => placeAccessory(sub, found, 1000, 1000, aspect);

describe("prévia 2D de acessórios", () => {
  it("óculos nos olhos, com a largura da armação maior que os cantos dos olhos e sem giro com a cabeça reta", () => {
    const [p] = at("sunglasses");
    expect(p.x).toBeCloseTo(0.5, 3);
    expect(p.y).toBeLessThan(0.3); expect(p.y).toBeGreaterThan(0.29);
    expect(p.w).toBeCloseTo(0.155, 3);
    expect(p.rotate).toBeCloseTo(0, 5);
  });

  it("acompanha a cabeça inclinada", () => {
    const tilted = face({ 33: [0.45, 0.3], 263: [0.55, 0.35], 234: [0.4, 0.3], 454: [0.6, 0.36], 168: [0.5, 0.31], 10: [0.51, 0.22] });
    const [p] = at("eyeglasses", { face: tilted, pose: null });
    expect(p.rotate).toBeCloseTo(26.57, 1);
  });

  it("boné na testa: a borda de baixo perto da testa, o centro acima, mais largo que o rosto", () => {
    const [p] = at("cap");
    expect(p.w).toBeCloseTo(0.24, 3);
    expect(p.y).toBeLessThan(0.22 + 0.3 * 0.07);
    expect(p.y + (p.w * 0.4) / 2).toBeCloseTo(0.22 + 0.3 * 0.07, 3);
  });

  it("um brinco por orelha, logo abaixo do fim da mandíbula", () => {
    const pair = at("earrings", BOTH, 1.5);
    expect(pair).toHaveLength(2);
    expect(pair[0].x).toBeLessThan(0.45); expect(pair[1].x).toBeGreaterThan(0.55);
    expect(pair[0].y).toBeGreaterThan(0.36);
  });

  it("colar entre o queixo e os ombros, proporcional aos ombros", () => {
    const [p] = at("necklace");
    expect(p.y).toBeGreaterThan(0.42); expect(p.y).toBeLessThan(0.5);
    expect(p.w).toBeCloseTo(0.24 * 0.42, 3);
  });

  it("relógio no pulso mais visível, atravessado no antebraço", () => {
    const [p] = at("watch");
    expect(p.x).toBeGreaterThan(0.66); expect(p.y).toBeGreaterThan(0.75);
    const forearm = Math.atan2(0.13, 0.02) * 180 / Math.PI;
    expect(p.rotate).toBeCloseTo(forearm - 90, 3);
  });

  it("bolsa no quadril, para fora do corpo do lado mais visível", () => {
    const [p] = at("handbag");
    expect(p.x).toBeGreaterThan(0.58);
    expect(p.y).toBeGreaterThan(0.78);
  });

  it("nada é desenhado sem os pontos necessários ou para o que a prévia não sabe posicionar", () => {
    expect(at("sunglasses", { face: null, pose: pose() })).toEqual([]);
    expect(at("watch", { face: FRONT, pose: pose({ 15: [0.68, 0.78, 0.1], 16: [0.32, 0.78, 0.05] }) })).toEqual([]);
    expect(at("necklace", { face: FRONT, pose: null })).toEqual([]);
    expect(at("belt")).toEqual([]);
    expect(accessoryKind("ring")).toBeNull();
    expect(accessoryKind("tote_bag")).toBe("hip");
  });
});
