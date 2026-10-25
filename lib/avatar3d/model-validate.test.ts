import { describe, expect, it } from "vitest";
import { MODEL_VERSION, clampAdjust, roundShape, skinWithLight, validateBrows, validateEyes, validateModel } from "./model";
import { N } from "./geometry";

const EYES = { color: "#3a6ea5", secondary: "#2a4e75", cls: "BLUE", pattern: "RADIAL", confidence: 0.8, source: "IMAGE_ANALYSIS", glasses: "NONE" };
const BROWS = { color: "#2a1d14", thickness: 0.2, arch: 0.1, shape: "SOFT_ARCH", density: 0.6, confidence: 0.9 };
const model = (over: Record<string, unknown> = {}, hair: Record<string, unknown> = {}) => ({
  v: MODEL_VERSION, shape: Array.from({ length: N * 3 }, () => 1), skin: "#c08a6a", metrics: {}, views: [], warnings: [],
  hair: { present: true, color: "#222222", top: 14, side: 9, bottom: null, fringe: 0, cut: false, ...hair }, ...over,
});

describe("validação do modelo salvo do avatar", () => {
  it("recusa o que não é um modelo bem formado", () => {
    expect(validateModel(null)).toBeNull();
    expect(validateModel("x")).toBeNull();
    expect(validateModel(model({ v: 99 }))).toBeNull();
    expect(validateModel(model({ shape: [1, 2, 3] }))).toBeNull();
    expect(validateModel(model({ shape: Array.from({ length: N * 3 }, (_, i) => (i === 5 ? NaN : 1)) }))).toBeNull();
    expect(validateModel(model({ shape: Array.from({ length: N * 3 }, (_, i) => (i === 5 ? 80 : 1)) }))).toBeNull();
    expect(validateModel(model({ skin: "vermelho" }))).toBeNull();
    expect(validateModel(model({ skin: 3 }))).toBeNull();
    expect(validateModel(model({ hair: null }))).toBeNull();
    expect(validateModel(model({}, { color: "azul" }))).toBeNull();
    expect(validateModel(model({}, { top: Infinity }))).toBeNull();
  });

  it("aceita cabelo sem cor e mantém os campos novos válidos", () => {
    const hair = { color: null, length: "long", texture: "wavy", cover: "#ff0000", tone: { level: 3, family: "ash" }, volume: 1.2, volumeLevel: "full", part: 0.3, variation: 0.4, fringeStyle: "side", outline: [1, 2, 3] };
    const m = validateModel(model({ sex: "MASCULINO", bodySkin: "#aa8866", eyes: EYES, brows: BROWS }, hair))!;
    expect(m.hair).toMatchObject(hair);
    expect(m.sex).toBe("MASCULINO");
    expect(m.bodySkin).toBe("#aa8866");
    expect(m.eyes).toMatchObject({ cls: "BLUE" });
    expect(m.brows).toMatchObject({ shape: "SOFT_ARCH" });
  });

  it("descarta só os campos inválidos, sem derrubar o avatar", () => {
    const hair = { length: "enorme", texture: "x", cover: "pano", tone: { level: 11, family: "ash" }, volume: 9, volumeLevel: "gigante", part: 2, variation: -1, fringeStyle: "torta", outline: [1, -2] };
    const m = validateModel(model({ sex: "OUTRO", bodySkin: "pele", eyes: { ...EYES, cls: "ROXO" }, brows: { ...BROWS, shape: "ONDA" } }, hair))!;
    for (const k of Object.keys(hair)) expect(m.hair).not.toHaveProperty(k);
    expect(m).not.toHaveProperty("sex");
    expect(m).not.toHaveProperty("bodySkin");
    expect(m).not.toHaveProperty("eyes");
    expect(m).not.toHaveProperty("brows");
    // tom que não é objeto, contorno que não é lista ou longo demais
    expect(validateModel(model({}, { tone: "escuro", outline: "x" }))!.hair).not.toHaveProperty("tone");
    expect(validateModel(model({}, { outline: Array.from({ length: 40 }, () => 1) }))!.hair).not.toHaveProperty("outline");
    expect(validateModel(model({}, { tone: null, cover: null }))!.hair).toMatchObject({ tone: null, cover: null });
  });
});

describe("validação dos olhos", () => {
  it("recusa cores, listas, origem e confiança fora do formato", () => {
    expect(validateEyes(null)).toBeNull();
    expect(validateEyes({ ...EYES, color: "azul" })).toBeNull();
    expect(validateEyes({ ...EYES, secondary: "x" })).toBeNull();
    expect(validateEyes({ ...EYES, pattern: "X" })).toBeNull();
    expect(validateEyes({ ...EYES, glasses: "MONOCULO" })).toBeNull();
    expect(validateEyes({ ...EYES, source: "CHUTE" })).toBeNull();
    expect(validateEyes({ ...EYES, confidence: 2 })).toBeNull();
    expect(validateEyes({ ...EYES, confidence: "alta" })).toBeNull();
  });

  it("guarda armação e heterocromia só quando os dois olhos vêm bem formados", () => {
    const right = { color: "#3a6ea5", secondary: "#2a4e75" }, left = { color: "#6b4b2a", secondary: "#4b3b1a" };
    const e = validateEyes({ ...EYES, source: "DEFAULT", frame: "#111111", right, left, extra: 1 })!;
    expect(e).toEqual({ ...EYES, source: "DEFAULT", frame: "#111111", right, left });
    const half = validateEyes({ ...EYES, frame: "preta", right, left: { color: "x" } })!;
    expect(half).not.toHaveProperty("frame");
    expect(half).not.toHaveProperty("right");
    expect(validateEyes({ ...EYES, right: null, left })).not.toHaveProperty("left");
  });
});

describe("validação das sobrancelhas", () => {
  it("recusa medidas fora das faixas", () => {
    expect(validateBrows(undefined)).toBeNull();
    expect(validateBrows({ ...BROWS, color: "#12" })).toBeNull();
    expect(validateBrows({ ...BROWS, thickness: 2 })).toBeNull();
    expect(validateBrows({ ...BROWS, arch: 0.9 })).toBeNull();
    expect(validateBrows({ ...BROWS, density: -1 })).toBeNull();
    expect(validateBrows({ ...BROWS, confidence: NaN })).toBeNull();
  });

  it("fatias: ficam com 5 espessuras e 5 cores (alguma válida); senão caem só elas", () => {
    const zones = { thickness: [0.1, 0.2, 0.3, 0.2, 0.1], color: ["#111111", "nada", null, "#222222", "#333333", "#444444"] };
    expect(validateBrows({ ...BROWS, zones })!.zones).toEqual({ thickness: zones.thickness, color: ["#111111", null, null, "#222222", "#333333"] });
    expect(validateBrows({ ...BROWS, zones: { thickness: [0.1, 2, 0.3, 0.2, 0.1], color: zones.color } })).not.toHaveProperty("zones");
    expect(validateBrows({ ...BROWS, zones: { thickness: zones.thickness, color: [null, null, null, null, null] } })).not.toHaveProperty("zones");
    expect(validateBrows({ ...BROWS, zones: { thickness: "x", color: [] } })).not.toHaveProperty("zones");
  });
});

describe("ajustes e utilidades do modelo", () => {
  it("clampAdjust: limita às faixas, arredonda as escolhas e troca lixo pelo padrão", () => {
    const a = clampAdjust({ headScale: 2, neck: -1, hairTone: 3.6, hairCut: NaN, glasses: 0.4, hairFringe: 1.6, skinLight: "x" as unknown as number });
    expect(a).toMatchObject({ headScale: 1.06, neck: -0.02, hairTone: 4, hairCut: 0, glasses: 0, hairFringe: 2, skinLight: 0 });
    expect(clampAdjust(null).headScale).toBe(1);
  });

  it("roundShape arredonda para centésimos", () => {
    expect(roundShape(new Float32Array([1.234, -0.005, 2]))).toEqual([1.23, -0, 2].map((v) => Math.round(v * 100) / 100));
  });

  it("skinWithLight: sem luz devolve o tom; com luz clareia ou escurece, sem passar do branco", () => {
    expect(skinWithLight("#c08a6a", 0)).toBe("#c08a6a");
    const lighter = skinWithLight("#c08a6a", 0.08), darker = skinWithLight("#c08a6a", -0.08);
    expect(parseInt(lighter.slice(1, 3), 16)).toBeGreaterThan(0xc0);
    expect(parseInt(darker.slice(1, 3), 16)).toBeLessThan(0xc0);
    expect(skinWithLight("#ffffff", 0.08)).toBe("#ffffff");
    expect(skinWithLight("#010101", -0.08)).toMatch(/^#0[01]0[01]0[01]$/);
  });
});
