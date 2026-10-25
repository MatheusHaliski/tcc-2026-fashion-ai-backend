// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const fa = vi.hoisted(() => ({ load: vi.fn(async () => {}), preds: [] as unknown[], fail: false as boolean, inputs: [] as { width: number; height: number }[] }));
vi.mock("@vladmandic/face-api", () => ({
  nets: { ageGenderNet: { loadFromUri: fa.load, predictAgeAndGender: vi.fn(async (c: HTMLCanvasElement) => { if (fa.fail) throw new Error("rede"); fa.inputs.push({ width: c.width, height: c.height }); return fa.preds.shift(); }) } },
}));

import { detectSex } from "./sex-detect";

// rosto 100 × 120 px de frente, olhos na horizontal
const PX: [number, number][] = Array.from({ length: 478 }, () => [100, 100]);
PX[33] = [70, 80]; PX[133] = [90, 80]; PX[362] = [110, 80]; PX[263] = [130, 80];
PX[234] = [50, 90]; PX[454] = [150, 90]; PX[152] = [100, 200]; PX[70] = [60, 70]; PX[300] = [140, 70];
const canvas = () => { const c = document.createElement("canvas"); c.width = 200; c.height = 220; return c; };

beforeEach(() => { fa.preds = []; fa.fail = false; fa.inputs = []; });

describe("sexo estimado pela rede do face-api", () => {
  it("roda na foto e no espelho e combina: 'female' vira 1 − probabilidade", async () => {
    fa.preds = [{ gender: "male", genderProbability: 0.9, age: 30 }, { gender: "female", genderProbability: 0.3, age: 34 }];
    const g = await detectSex(canvas(), PX);
    expect(g).toEqual({ sex: "MASCULINO", confidence: 0.8, pMale: 0.8, age: 32 });
    expect(fa.load).toHaveBeenCalledWith("/mediapipe/face-api");
    expect(fa.inputs).toHaveLength(2);
    expect(Math.max(fa.inputs[0].width, fa.inputs[0].height)).toBe(160);
  });

  it("o modelo é carregado uma vez só (a segunda estimativa não recarrega)", async () => {
    fa.preds = [{ gender: "female", genderProbability: 0.8, age: 20 }, { gender: "female", genderProbability: 0.8, age: 20 }];
    expect((await detectSex(canvas(), PX))!.sex).toBe("FEMININO");
    expect(fa.load).not.toHaveBeenCalled(); // as chamadas são limpas entre testes; o carregamento ficou no primeiro
  });

  it("rede que falha dá null", async () => {
    fa.fail = true;
    expect(await detectSex(canvas(), PX)).toBeNull();
  });
});
