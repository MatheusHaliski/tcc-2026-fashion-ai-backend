import { describe, expect, it } from "vitest";
import { EMPTY_EDIT, canonicalProblems, clampToCanonical, fromRecipe, nearestAspect, scaleCrop, toRecipe, withAspect, type EditState } from "./recipe";

const edit = (over: Partial<EditState> = {}): EditState => ({ ...structuredClone(EMPTY_EDIT), ...over });

describe("fromRecipe: casos de borda", () => {
  it("sem receita devolve o estado vazio; alvo desconhecido vira canônica", () => {
    expect(fromRecipe(null)).toEqual(EMPTY_EDIT);
    expect(fromRecipe(undefined)).toEqual(EMPTY_EDIT);
    const s = fromRecipe({ target: "OUTRO" });
    expect(s.target).toBe("CANONICAL");
    expect(s.turns).toBe(0);
  });

  it("normaliza giros negativos, valores não numéricos e espelho padrão H", () => {
    const s = fromRecipe({ target: "PRESENTATION", ops: [
      { op: "rotate90", turns: -1 }, { op: "straighten", deg: "x" }, { op: "flip", axis: "Z" }, { op: "sharpen", amount: "nada" }, { op: "desconhecida" },
    ] });
    expect(s.target).toBe("PRESENTATION");
    expect(s.turns).toBe(3);
    expect(s.straighten).toBe(0);
    expect(s.flip).toBe("H");
    expect(s.sharpen).toBe(0);
    expect(fromRecipe({ ops: [{ op: "flip", axis: "V" }] }).flip).toBe("V");
  });

  it("recorte sem rect usa a própria op; sem imagem a proporção é livre e com imagem é a mais próxima", () => {
    const flat = fromRecipe({ ops: [{ op: "crop", x: 0.1, y: 0.2, w: 0.5, h: 0.5 }] });
    expect(flat.crop).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.5 });
    expect(flat.cropAspect).toBe("FREE");
    const near = fromRecipe({ ops: [{ op: "crop", rect: { x: 0, y: 0, w: 0.5, h: 0.5 } }] }, { w: 1000, h: 1000 });
    expect(near.cropAspect).toBe("1:1");
    const fixed = fromRecipe({ ops: [{ op: "crop", rect: { x: 0, y: 0, w: 0.5, h: 0.5 }, aspect: "4:5" }] }, { w: 1000, h: 1000 });
    expect(fixed.cropAspect).toBe("4:5");
  });

  it("tom, níveis, fundo e filtro usam padrões quando faltam campos", () => {
    const s = fromRecipe({ ops: [{ op: "tone" }, { op: "levels" }, { op: "background" }, { op: "heal" }, { op: "filter" }, { op: "whiteBalance", sample: ["0.3", 0.4] }] });
    expect(s.tone).toEqual({ exposureEv: 0, highlights: 0, shadows: 0, contrast: 0, saturation: 0 });
    expect(s.levels).toEqual({ black: 0, white: 1, gamma: 1 });
    expect(s.background).toEqual({ on: true, kind: "WHITE", shadow: false, strokes: [], feather: 2 });
    expect(s.heal).toEqual([]);
    expect(s.filter).toEqual({ style: "WARM", strength: 0.5 });
    expect(s.whiteBalance).toEqual([0.3, 0.4]);
    const full = fromRecipe({ ops: [{ op: "background", kind: "NEUTRAL", shadow: "SOFT", strokes: [{ mode: "add", r: 1, pts: [] }], feather: 5 }, { op: "filter", style: "MONO", strength: 1 }] });
    expect(full.background).toMatchObject({ kind: "NEUTRAL", shadow: true, feather: 5 });
    expect(full.filter).toEqual({ style: "MONO", strength: 1 });
  });
});

describe("toRecipe: todas as operações na ordem", () => {
  it("gera geometria, recorte livre, cor, níveis, fundo sem sombra, retoque, nitidez e filtro só na apresentação", () => {
    const s = edit({ target: "PRESENTATION", turns: 1, straighten: 0.04, flip: "V", crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, cropAspect: "1:1",
      whiteBalance: [0.123456, 0.5], tone: { exposureEv: 1, highlights: 0, shadows: 0, contrast: 0, saturation: 0 }, levels: { black: 0.05, white: 1, gamma: 1 },
      background: { on: true, kind: "TRANSPARENT", shadow: false, strokes: [], feather: 2 }, heal: [{ x: 0.5, y: 0.5, r: 0.01 }], sharpen: 0.2, filter: { style: "COOL", strength: 0.7 } });
    const r = toRecipe(s);
    expect(r.ops.map((o) => o.op)).toEqual(["rotate90", "flip", "crop", "whiteBalance", "tone", "levels", "background", "heal", "sharpen", "filter"]);
    expect(r.ops.find((o) => o.op === "crop")?.aspect).toBe("FREE");
    expect(r.ops.find((o) => o.op === "background")?.shadow).toBe("NONE");
    expect(r.ops.find((o) => o.op === "whiteBalance")?.sample).toEqual([0.1235, 0.5]);
  });

  it("filtro com força zero ou na canônica não entra", () => {
    expect(toRecipe(edit({ target: "PRESENTATION", filter: { style: "WARM", strength: 0 } })).ops).toEqual([]);
    expect(toRecipe(edit({ filter: { style: "WARM", strength: 1 } })).ops).toEqual([]);
  });
});

describe("canonicalProblems", () => {
  it("apresentação nunca tem problema", () => {
    expect(canonicalProblems(edit({ target: "PRESENTATION" }))).toEqual([]);
  });

  it("lista cada regra violada", () => {
    const s = edit({ straighten: -16, sharpen: 0.5, tone: { exposureEv: 0, highlights: 0, shadows: 0, contrast: 60, saturation: -20 }, levels: { black: 0.2, white: 1, gamma: 1 }, heal: [{ x: 0, y: 0, r: 0.1 }] });
    expect(canonicalProblems(s)).toEqual(["CANONICA_EXIGE_QUADRO_4_5", "ENDIREITAR_ALEM_DE_15_GRAUS", "SATURACAO_ALTERA_A_COR_DA_PECA", "CONTRASTE_FORTE_DEMAIS", "NITIDEZ_FORTE_DEMAIS", "NIVEIS_FORTE_DEMAIS", "RETOQUE_ALEM_DE_1_PORCENTO"]);
  });

  it("cada limite de níveis dispara sozinho", () => {
    const crop = { x: 0, y: 0, w: 1, h: 1 };
    expect(canonicalProblems(edit({ crop, levels: { black: 0, white: 0.8, gamma: 1 } }))).toEqual(["NIVEIS_FORTE_DEMAIS"]);
    expect(canonicalProblems(edit({ crop, levels: { black: 0, white: 1, gamma: 0.5 } }))).toEqual(["NIVEIS_FORTE_DEMAIS"]);
    expect(canonicalProblems(edit({ crop, levels: { black: 0, white: 1, gamma: 2 } }))).toEqual(["NIVEIS_FORTE_DEMAIS"]);
    expect(canonicalProblems(edit({ crop }))).toEqual([]);
  });
});

describe("clampToCanonical", () => {
  it("traz para dentro dos limites e remove o filtro", () => {
    const c = clampToCanonical(edit({ target: "PRESENTATION", straighten: 40, sharpen: 1, filter: { style: "MONO", strength: 1 }, tone: { exposureEv: 0, highlights: 0, shadows: 0, contrast: -90, saturation: 30 }, levels: { black: 0.5, white: 0.2, gamma: 3 } }));
    expect(c.target).toBe("CANONICAL");
    expect(c.filter).toBeNull();
    expect(c.straighten).toBe(15);
    expect(c.sharpen).toBe(0.3);
    expect(c.tone.contrast).toBe(-50);
    expect(c.tone.saturation).toBe(15);
    expect(c.levels).toEqual({ black: 0.1, white: 0.9, gamma: 1.25 });
    expect(clampToCanonical(edit({ levels: { black: 0, white: 1, gamma: 0.1 } })).levels.gamma).toBe(0.8);
  });
});

describe("recorte: proporção e escala", () => {
  it("nearestAspect devolve livre quando nada está perto", () => {
    expect(nearestAspect({ x: 0, y: 0, w: 1, h: 0.3 }, 1000, 1000)).toBe("FREE");
    expect(nearestAspect({ x: 0, y: 0, w: 0.75, h: 1 }, 1000, 1000)).toBe("3:4");
  });

  it("scaleCrop limita pela altura, pela largura e pelo mínimo de 10%", () => {
    const tall = scaleCrop({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 10, 1000, 1000, 0.8);
    expect(tall.h).toBe(1);
    expect(tall.w).toBe(0.8);
    const wide = scaleCrop({ x: 0, y: 0.4, w: 0.5, h: 0.1 }, 10, 1000, 1000, 16 / 9);
    expect(wide.w).toBe(1);
    expect(wide.h).toBe(0.5625);
    const tiny = scaleCrop({ x: 0.5, y: 0.5, w: 0.2, h: 0.2 }, 0.01, 1000, 1000, null);
    expect(tiny.w).toBe(0.1);
    expect(tiny.h).toBe(0.1);
  });

  it("withAspect: sem recorte usa o centralizado ou a imagem toda; livre mantém o atual", () => {
    expect(withAspect(null, "FREE", 1000, 800)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(withAspect(null, "1:1", 1000, 800)).toEqual({ x: 0.1, y: 0, w: 0.8, h: 1 });
    const c = { x: 0.1, y: 0.1, w: 0.5, h: 0.3 };
    expect(withAspect(c, "FREE", 1000, 800)).toBe(c);
    const sq = withAspect(c, "1:1", 1000, 1000);
    expect(sq.w).toBeCloseTo(sq.h, 4);
  });
});
