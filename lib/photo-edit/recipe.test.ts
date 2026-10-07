import { describe, expect, it } from "vitest";
import { EMPTY_EDIT, canonicalProblems, centeredCrop, clampToCanonical, fromRecipe, moveCrop, scaleCrop, toRecipe, type EditState } from "./recipe";

const edited = (): EditState => ({ ...structuredClone(EMPTY_EDIT), turns: 1, straighten: 3.2, crop: { x: 0.1, y: 0, w: 0.6, h: 0.75 },
  background: { on: true, kind: "NEUTRAL", shadow: true, strokes: [{ mode: "add", r: 0.02, pts: [[0.5, 0.5]] }] },
  whiteBalance: [0.05, 0.04], tone: { exposureEv: 0.3, highlights: -10, shadows: 5, contrast: 4, saturation: 0 }, heal: [{ x: 0.5, y: 0.6, r: 0.005 }], sharpen: 0.2 });

describe("receita do editor (RF15)", () => {
  it("gera as operações na ordem do servidor e volta ao mesmo estado", () => {
    const r = toRecipe(edited());
    expect(r.ops.map((o) => o.op)).toEqual(["rotate90", "straighten", "crop", "whiteBalance", "tone", "background", "heal", "sharpen"]);
    expect(r.ops.find((o) => o.op === "crop")!.aspect).toBe("4:5");
    expect(fromRecipe(r)).toEqual(edited());
  });

  it("receita vazia = foto original; filtro só entra na versão de apresentação", () => {
    expect(toRecipe(EMPTY_EDIT).ops).toEqual([]);
    const withFilter: EditState = { ...structuredClone(EMPTY_EDIT), filter: { style: "MONO", strength: 1 } };
    expect(toRecipe(withFilter).ops).toEqual([]);
    expect(toRecipe({ ...withFilter, target: "PRESENTATION" }).ops.map((o) => o.op)).toEqual(["filter"]);
  });

  it("avisa o que a canônica recusaria e devolve os valores para dentro do limite", () => {
    const wild: EditState = { ...structuredClone(EMPTY_EDIT), target: "PRESENTATION", straighten: 20, sharpen: 0.9, tone: { ...EMPTY_EDIT.tone, saturation: 60 }, filter: { style: "WARM", strength: 1 } };
    expect(canonicalProblems({ ...wild, target: "CANONICAL" })).toEqual(expect.arrayContaining(["CANONICA_EXIGE_QUADRO_4_5", "ENDIREITAR_ALEM_DE_15_GRAUS", "SATURACAO_ALTERA_A_COR_DA_PECA", "NITIDEZ_FORTE_DEMAIS"]));
    const c = clampToCanonical(wild);
    expect(c.filter).toBeNull();
    expect(c.straighten).toBe(15);
    expect(c.tone.saturation).toBe(15);
    expect(canonicalProblems({ ...c, crop: centeredCrop(1000, 1000) })).toEqual([]);
  });

  it("quadro 4:5 em pixels: centralizado, movido e redimensionado sem sair da foto", () => {
    const c = centeredCrop(1000, 800);
    expect(c.w * 1000 / (c.h * 800)).toBeCloseTo(0.8, 3);
    expect(moveCrop(c, 1, 1).x + c.w).toBeCloseTo(1, 4);
    const big = scaleCrop(c, 5, 1000, 800);
    expect(big.h).toBeLessThanOrEqual(1);
    expect(big.w * 1000 / (big.h * 800)).toBeCloseTo(0.8, 2);
    const small = scaleCrop(c, 0.5, 1000, 800);
    expect(small.w).toBeLessThan(c.w);
  });
});
