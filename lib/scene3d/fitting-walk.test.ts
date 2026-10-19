/**
 * Provador 3D: andar pela cabine relativo à câmera, sem sair das paredes nem atravessar o espelho, e chegar à frente
 * do vidro (zona do espelho) pela caminhada automática.
 */
import { describe, expect, it } from "vitest";
import { atMirror, CABIN, confine, faceMirror, FITTING_MIRROR, mirrorSpot, placeOf, walkStep, walkToward } from "./fitting-walk";

describe("andar na cabine do provador", () => {
  it("para cima anda para onde a câmera olha (câmera de frente: para o fundo; câmera à direita: para a esquerda)", () => {
    const front = walkStep({ x: 0, z: 0 }, { x: 0, y: -1 }, .05, 0)!;
    expect(front.at.z).toBeLessThan(0); expect(Math.abs(front.at.x)).toBeLessThan(1e-9);
    const side = walkStep({ x: 0, z: 0 }, { x: 0, y: -1 }, .05, Math.PI / 2)!;
    expect(side.at.x).toBeLessThan(0);
    expect(walkStep({ x: 0, z: 0 }, { x: 0, y: 0 }, .05, 0)).toBeNull();
  });
  it("não sai das paredes nem entra no espelho", () => {
    expect(confine({ x: 9, z: -9 })).toEqual({ x: CABIN.maxX, z: CABIN.minZ });
    const pushed = confine({ x: FITTING_MIRROR.x - .1, z: FITTING_MIRROR.z + .05 });
    expect(Math.hypot(pushed.x - FITTING_MIRROR.x, pushed.z - FITTING_MIRROR.z)).toBeGreaterThanOrEqual(.49);
  });
  it("a caminhada automática chega à frente do espelho, que vira a zona do espelho, e o avatar olha para o vidro", () => {
    let p = { x: 0, z: 0 }, arrived = false;
    for (let i = 0; i < 400 && !arrived; i++) ({ at: p, arrived } = walkToward(p, mirrorSpot(), 1 / 30));
    expect(arrived).toBe(true); expect(atMirror(p)).toBe(true); expect(placeOf(p)).toBe("mirror");
    const yaw = faceMirror(p), toMirror = { x: FITTING_MIRROR.x - p.x, z: FITTING_MIRROR.z - p.z };
    expect(Math.sin(yaw) * toMirror.x + Math.cos(yaw) * toMirror.z).toBeGreaterThan(0);
    expect(placeOf({ x: 0, z: 0 })).toBe("center"); expect(placeOf({ x: -1, z: 1 })).toBe("free");
  });
  it("atrás do espelho não conta como estar na frente dele", () => {
    expect(atMirror({ x: FITTING_MIRROR.x + .4, z: FITTING_MIRROR.z - .9 })).toBe(false);
  });
});
