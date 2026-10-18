/**
 * Roupa pendurada de verdade: o tipo vem da categoria/subcategoria gravadas (nunca do nome), a silhueta cabe no cabide e
 * no comprimento pedido, o perfil de lado dá volume (cheio no ombro, afinando; vestido e saia abrem) e o giro próprio
 * de cada peça no varão é pequeno e estável.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { HUNG_LENGTH, clothFolds, hangJitter, hungKindOf, hungProfile, hungShape, type HungKind } from "./hung-garment";

describe("roupa pendurada", () => {
  it("tipo pela categoria e subcategoria gravadas", () => {
    expect(hungKindOf({ category: "upper_piece", subcategory: "t_shirt" })).toBe("top");
    expect(hungKindOf({ category: "upper_piece", subcategory: "shirt" })).toBe("longTop");
    expect(hungKindOf({ category: "upper_piece", subcategory: "blazer" })).toBe("coat");
    expect(hungKindOf({ category: "full_body_piece", subcategory: "outra" })).toBe("dress");
    expect(hungKindOf({ category: "lower_piece", subcategory: "jeans" })).toBe("pants");
    expect(hungKindOf({ category: "lower_piece", subcategory: "skirt" })).toBe("skirt");
    expect(hungKindOf({ category: "lower_piece", subcategory: "bermuda" })).toBe("shorts");
    expect(hungKindOf({ category: "shoes_piece", subcategory: "sneakers" })).toBe("shelf");
    expect(hungKindOf({ category: "accessory_piece", subcategory: "bolsa" })).toBe("shelf");
  });

  it("a silhueta começa no cabide e termina no comprimento pedido, numa largura de cabide", () => {
    for (const kind of Object.keys(HUNG_LENGTH) as Exclude<HungKind, "shelf">[]) {
      const pts = hungShape(kind).getPoints(), box = new THREE.Box2().setFromPoints(pts);
      expect(box.max.y).toBeLessThanOrEqual(0);
      expect(box.min.y).toBeCloseTo(-HUNG_LENGTH[kind] - (kind === "pants" ? 0 : 0), 1);
      expect(box.max.x - box.min.x).toBeLessThan(0.6);
      expect(box.max.x).toBeCloseTo(-box.min.x, 6);                                         // simétrica
    }
    const short = new THREE.Box2().setFromPoints(hungShape("coat", 0.5).getPoints());
    expect(short.min.y).toBeGreaterThanOrEqual(-0.5 - 1e-9);                                  // peça longa dobra para caber
  });

  it("volume de lado: cheio no ombro e afinando; vestido e saia abrem para a barra", () => {
    expect(hungProfile("top", 0.1, 0)).toBeGreaterThan(hungProfile("top", 1, 0));
    expect(hungProfile("dress", 1, 0)).toBeGreaterThan(hungProfile("dress", 0, 0));
    for (const t of [0, 0.3, 0.7, 1]) expect(hungProfile("pants", t, 0.1)).toBeGreaterThan(0.4);
  });

  it("giro próprio pequeno e estável por peça", () => {
    expect(hangJitter("abc")).toBe(hangJitter("abc"));
    for (const id of ["a", "peça-1", "x".repeat(40), "9f1e"]) expect(Math.abs(hangJitter(id))).toBeLessThanOrEqual(0.17);
  });

  it("o pano dobra: dobras rasas no cabide que aprofundam até a barra, sem passar de 2 cm", () => {
    const amp = (t: number) => Math.max(...Array.from({ length: 200 }, (_, i) => Math.abs(clothFolds(t, -0.3 + i * 0.003, 0.4))));
    expect(amp(1)).toBeGreaterThan(amp(0.05) * 2);
    for (const t of [0, 0.5, 1]) expect(amp(t)).toBeLessThanOrEqual(0.02);
  });
});
