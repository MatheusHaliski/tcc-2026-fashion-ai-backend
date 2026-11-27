import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { Vec3 } from "../document";
import { falloffWeight, sculptContext, sculptDab, type SculptBrushParams } from "./sculpt";
import { boundsOf, fitPoints, mirrorPoints, regionWeight } from "./fit";

/** Plano 1x1 subdividido (z = 0), com costura duplicada na coluna central para testar a solda. */
function grid(n = 8) {
  const g = new THREE.PlaneGeometry(1, 1, n, n);
  const original = Float32Array.from(g.getAttribute("position").array);
  const index = Array.from(g.index!.array);
  const points = Array.from({ length: original.length / 3 }, (_, i) => [original[i * 3], original[i * 3 + 1], original[i * 3 + 2]] as Vec3);
  return { original, index, points };
}
const brush = (change: Partial<SculptBrushParams> = {}): SculptBrushParams => ({ mode: "pull", radius: 0.3, strength: 1, falloff: "smooth", mirror: false, ...change });

describe("pincel de escultura", () => {
  it("queda: 1 no centro, 0 na borda, monotônica em todos os perfis", () => {
    for (const f of ["smooth", "linear", "sharp"] as const) {
      expect(falloffWeight(0, f)).toBe(1);
      expect(falloffWeight(1, f)).toBe(0);
      expect(falloffWeight(0.3, f)).toBeGreaterThan(falloffWeight(0.6, f));
    }
  });

  it("puxar move ao longo da normal com força decrescente; longe do pincel nada muda", () => {
    const { original, index, points } = grid();
    const ctx = sculptContext(original, index);
    const next = sculptDab(points, ctx, [0, 0, 0], [0, 0, 1], brush());
    const center = next.findIndex((p, i) => points[i][0] === 0 && points[i][1] === 0);
    const near = next.findIndex((_, i) => Math.abs(points[i][0] - 0.125) < 1e-6 && points[i][1] === 0);
    expect(next[center][2]).toBeGreaterThan(0);
    expect(next[center][2]).toBeGreaterThan(next[near][2]);
    const corner = next.findIndex((_, i) => points[i][0] === 0.5 && points[i][1] === 0.5);
    expect(next[corner]).toEqual(points[corner]);
    const pushed = sculptDab(points, ctx, [0, 0, 0], [0, 0, 1], brush({ mode: "push" }));
    expect(pushed[center][2]).toBeCloseTo(-next[center][2]);
  });

  it("simetria em X repete o carimbo no lado espelhado", () => {
    const { original, index, points } = grid();
    const ctx = sculptContext(original, index);
    const next = sculptDab(points, ctx, [0.25, 0, 0], [0, 0, 1], brush({ radius: 0.15, mirror: true }));
    const left = next.findIndex((_, i) => Math.abs(points[i][0] + 0.25) < 1e-6 && points[i][1] === 0);
    const right = next.findIndex((_, i) => Math.abs(points[i][0] - 0.25) < 1e-6 && points[i][1] === 0);
    expect(next[left][2]).toBeCloseTo(next[right][2]);
    expect(next[left][2]).toBeGreaterThan(0);
  });

  it("suavizar aproxima um pico dos vizinhos; inflar usa a normal de cada vértice", () => {
    const { original, index, points } = grid();
    const ctx = sculptContext(original, index);
    const center = points.findIndex((p) => p[0] === 0 && p[1] === 0);
    const spiky = points.map((p, i) => (i === center ? [0, 0, 0.3] : p) as Vec3);
    const smoothed = sculptDab(spiky, ctx, [0, 0, 0.3], [0, 0, 1], brush({ mode: "smooth" }));
    expect(smoothed[center][2]).toBeLessThan(0.3);
    const inflated = sculptDab(points, ctx, [0, 0, 0], [1, 0, 0], brush({ mode: "inflate" }));
    expect(Math.abs(inflated[center][2])).toBeGreaterThan(0);
    expect(inflated[center][0]).toBeCloseTo(0);
  });
});

describe("ajustes de roupa por região", () => {
  const { original, points } = grid();
  const b = boundsOf(original);

  it("regiões têm pesos suaves e complementares", () => {
    expect(regionWeight([0, 0.5, 0], b, "upper")).toBe(1);
    expect(regionWeight([0, -0.5, 0], b, "upper")).toBe(0);
    expect(regionWeight([0, 0, 0], b, "upper") + regionWeight([0, 0, 0], b, "lower")).toBeCloseTo(1);
    expect(regionWeight([-0.5, 0, 0], b, "left")).toBe(1);
    expect(regionWeight([0.5, 0, 0], b, "left")).toBe(0);
  });

  it("barra alonga só embaixo; folga alarga; manga avança as pontas; decote desce o centro do topo", () => {
    const hem = fitPoints(points, original, "hem", 0.1);
    const bottom = points.findIndex((p) => p[1] === -0.5), top = points.findIndex((p) => p[1] === 0.5);
    expect(hem[bottom][1]).toBeCloseTo(-0.6);
    expect(hem[top][1]).toBe(0.5);
    const ease = fitPoints(points, original, "ease", 0.2);
    const edge = points.findIndex((p) => p[0] === 0.5);
    expect(ease[edge][0]).toBeCloseTo(0.6);
    const sleeve = fitPoints(points, original, "sleeve", 0.2);
    expect(sleeve[edge][0]).toBeGreaterThan(0.5);
    const neckCenter = points.findIndex((p) => p[0] === 0 && p[1] === 0.5);
    const neck = fitPoints(points, original, "neckline", 0.2);
    expect(neck[neckCenter][1]).toBeLessThan(0.5);
    expect(neck[edge][1]).toBe(points[edge][1]);
    const onlyLeft = fitPoints(points, original, "ease", 0.2, "left");
    expect(onlyLeft[edge][0]).toBeCloseTo(0.5);
    expect(() => fitPoints(points, original, "hem", 5)).toThrow("ATELIER_COMMAND_VALUE");
  });

  it("espelhar copia a deformação de um lado para o outro", () => {
    const left = points.findIndex((p) => p[0] === -0.25 && p[1] === 0);
    const right = points.findIndex((p) => p[0] === 0.25 && p[1] === 0);
    const bent = points.map((p, i) => (i === left ? [-0.3, 0, 0.2] : p) as Vec3);
    const mirrored = mirrorPoints(bent, original, "left");
    expect(mirrored[right]).toEqual([0.3, 0, 0.2]);
    expect(mirrored[left]).toEqual([-0.3, 0, 0.2]);
  });
});
