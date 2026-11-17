import { describe, expect, it } from "vitest";
import { CURB_Z, DOCK_RAMP, FAR_CURB_Z, floorY, ROAD_Y, SIDEWALK_Y, STAIRS } from "./level-floor";

describe("MET Gala Heist — altura do piso", () => {
  it("dentro do prédio o piso fica no zero", () => {
    expect(floorY({ x: 0, z: 0 })).toBe(0);
    expect(floorY({ x: 22, z: 24 })).toBe(0);
  });

  it("o beco ao lado do prédio fica na altura da calçada", () => {
    expect(floorY({ x: 22.5, z: 10 })).toBe(SIDEWALK_Y);
    expect(floorY({ x: 30, z: 0 })).toBe(SIDEWALK_Y);
  });

  it("a pista entre os dois meios-fios é mais baixa que a calçada", () => {
    expect(floorY({ x: 40, z: (CURB_Z + FAR_CURB_Z) / 2 })).toBe(ROAD_Y);
    expect(ROAD_Y).toBeLessThan(SIDEWALK_Y);
    expect(floorY({ x: 40, z: CURB_Z })).toBe(SIDEWALK_Y);       // o meio-fio ainda é calçada
    expect(floorY({ x: 40, z: FAR_CURB_Z })).toBe(SIDEWALK_Y);
    expect(floorY({ x: 40, z: FAR_CURB_Z + 5 })).toBe(SIDEWALK_Y);
  });

  it("a escadaria desce em degraus do patamar até a calçada", () => {
    expect(floorY({ x: 0, z: STAIRS.top })).toBe(0);                // patamar
    expect(floorY({ x: 0, z: STAIRS.bottom })).toBeCloseTo(SIDEWALK_Y);
    const run = (STAIRS.bottom - STAIRS.top) / STAIRS.steps;
    expect(floorY({ x: 0, z: STAIRS.top + run * 0.5 })).toBeCloseTo(SIDEWALK_Y / STAIRS.steps);   // primeiro degrau
    expect(floorY({ x: 0, z: STAIRS.top + run * 5.5 })).toBeCloseTo((SIDEWALK_Y * 6) / STAIRS.steps);
  });

  it("os degraus nunca sobem quando se anda para a rua", () => {
    let antes = floorY({ x: STAIRS.x1, z: STAIRS.top });
    for (let z = STAIRS.top; z <= STAIRS.bottom; z += 0.1) {
      const agora = floorY({ x: STAIRS.x1, z });
      expect(agora).toBeLessThanOrEqual(antes + 1e-12);
      antes = agora;
    }
  });

  it("fora da largura da escadaria é calçada comum", () => {
    expect(floorY({ x: STAIRS.x1 + 1, z: 28 })).toBe(SIDEWALK_Y);
  });

  it("a rampa da doca desce em linha reta até a calçada", () => {
    const meio = (DOCK_RAMP.z0 + DOCK_RAMP.z1) / 2;
    expect(floorY({ x: -19, z: DOCK_RAMP.z0 })).toBeCloseTo(0);
    expect(floorY({ x: -19, z: meio })).toBeCloseTo(SIDEWALK_Y / 2);
    expect(floorY({ x: -19, z: DOCK_RAMP.z1 })).toBeCloseTo(SIDEWALK_Y);
    expect(floorY({ x: DOCK_RAMP.x0 - 1, z: meio })).toBe(SIDEWALK_Y);
  });
});
