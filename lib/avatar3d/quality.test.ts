import { describe, expect, test } from "vitest";
import { blocking, checkPhoto, checkSet, type Issue } from "./quality";
import { clampAdjust, roundShape, skinWithLight, validateModel, MODEL_VERSION } from "./model";
import { N } from "./geometry";

const good = { lum: 140, contrast: 30, clipHigh: 0, clipLow: 0, balance: 1.1, sharpness: 40, faceWidthPx: 400 };
const front = { role: "front" as const, faces: 1, width: 1000, height: 1300, inFrame: true, pose: { yaw: 2, pitch: -3, roll: 1 }, stats: good, blend: { eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1, jawOpen: 0.05 }, rms: 0.3 };
const codes = (is: Issue[]) => is.map((i) => `${i.code}:${i.severity}`);

describe("uma foto", () => {
  test("foto boa passa sem avisos", () => { expect(checkPhoto(front)).toEqual([]); });
  test("sem rosto ou com mais de um: bloqueia e não avalia o resto", () => {
    expect(codes(checkPhoto({ ...front, faces: 0 }))).toEqual(["NO_FACE:block"]);
    expect(codes(checkPhoto({ ...front, faces: 2 }))).toEqual(["MULTIPLE_FACES:block"]);
  });
  test("rosto pequeno, cortado, escuro, estourado, desfocado", () => {
    expect(codes(checkPhoto({ ...front, stats: { ...good, faceWidthPx: 120 } }))).toContain("FACE_SMALL:block");
    expect(codes(checkPhoto({ ...front, stats: { ...good, faceWidthPx: 200 } }))).toContain("FACE_SMALL:warn");
    expect(codes(checkPhoto({ ...front, inFrame: false }))).toContain("FACE_CUT:block");
    expect(codes(checkPhoto({ ...front, stats: { ...good, lum: 40 } }))).toContain("TOO_DARK:block");
    expect(codes(checkPhoto({ ...front, stats: { ...good, lum: 65 } }))).toContain("TOO_DARK:warn");
    expect(codes(checkPhoto({ ...front, stats: { ...good, clipHigh: 0.3 } }))).toContain("TOO_BRIGHT:block");
    expect(codes(checkPhoto({ ...front, stats: { ...good, clipLow: 0.2 } }))).toContain("DEEP_SHADOWS:block");
    expect(codes(checkPhoto({ ...front, stats: { ...good, balance: 2.8 } }))).toContain("SIDE_LIGHT:block");
    expect(codes(checkPhoto({ ...front, stats: { ...good, balance: 2.2 } }))).toContain("SIDE_LIGHT:warn");
    expect(codes(checkPhoto({ ...front, stats: { ...good, balance: 1.5 } }))).toContain("SIDE_LIGHT:warn");
    expect(codes(checkPhoto({ ...front, stats: { ...good, sharpness: 3 } }))).toContain("BLURRY:block");
  });
  test("pose: de frente exige olhar para a câmera; de 3/4 exige virar o bastante, não demais", () => {
    expect(codes(checkPhoto({ ...front, pose: { yaw: 30, pitch: 0, roll: 0 } }))).toContain("LOOK_AT_CAMERA:block");
    expect(codes(checkPhoto({ ...front, pose: { yaw: 15, pitch: 0, roll: 0 } }))).toContain("LOOK_AT_CAMERA:warn");
    expect(codes(checkPhoto({ ...front, role: "left", pose: { yaw: 10, pitch: 0, roll: 0 } }))).toContain("TURN_MORE:block");
    expect(codes(checkPhoto({ ...front, role: "left", pose: { yaw: 40, pitch: 0, roll: 0 } }))).toEqual([]);
    expect(codes(checkPhoto({ ...front, role: "right", pose: { yaw: -75, pitch: 0, roll: 0 } }))).toContain("TURN_LESS:block");
    expect(codes(checkPhoto({ ...front, pose: { yaw: 0, pitch: 30, roll: 0 } }))).toContain("HEAD_UP_DOWN:block");
    expect(codes(checkPhoto({ ...front, pose: { yaw: 0, pitch: 0, roll: 35 } }))).toContain("HEAD_TILT:warn");
  });
  test("olhos fechados bloqueia; boca aberta e rosto tampado avisam", () => {
    expect(codes(checkPhoto({ ...front, blend: { eyeBlinkLeft: 0.8, eyeBlinkRight: 0.7 } }))).toContain("EYES_CLOSED:block");
    // óculos escuros (I4): o detector "vê" olhos fechados atrás da lente; a foto segue (a lente sai da textura)
    expect(codes(checkPhoto({ ...front, glasses: "SUNGLASSES", blend: { eyeBlinkLeft: 0.8, eyeBlinkRight: 0.7 } }))).not.toContain("EYES_CLOSED:block");
    expect(codes(checkPhoto({ ...front, blend: { eyeBlinkLeft: 0.8, eyeBlinkRight: 0.1 } }))).toEqual([]);   // piscada de um olho só não é "fechados"
    expect(codes(checkPhoto({ ...front, blend: { jawOpen: 0.5 } }))).toContain("MOUTH_OPEN:warn");
    expect(codes(checkPhoto({ ...front, rms: 1.5 }))).toContain("FACE_OCCLUDED:warn");
    expect(codes(checkPhoto({ ...front, occlusion: 0.13 }))).toContain("FACE_OCCLUDED:warn");   // armação de óculos
    expect(codes(checkPhoto({ ...front, occlusion: 0.25 }))).toContain("FACE_OCCLUDED:warn");   // mão e manga na testa: avisa
    expect(codes(checkPhoto({ ...front, occlusion: 0.51 }))).toContain("FACE_OCCLUDED:warn");   // barba grisalha: avisa, não recusa
    expect(codes(checkPhoto({ ...front, occlusion: 0.08 }))).toEqual([]);
  });
});

describe("o conjunto de fotos", () => {
  test("só a frente: pronto, mas avisa que a profundidade é estimada e pede as fotos de 3/4", () => {
    const r = checkSet([{ role: "front", issues: [] }]);
    expect(r.ready).toBe(true); expect(codes(r.issues)).toEqual([]); expect(r.ask).toEqual([]);
  });
  test("frente bloqueada: não gera e pede outra foto de frente", () => {
    const r = checkSet([{ role: "front", issues: [{ code: "BLURRY", severity: "block" }] }, { role: "left", issues: [] }]);
    expect(r.ready).toBe(false); expect(r.ask).toContain("front");
  });
  test("uma foto basta: nunca pede foto de 3/4 ou de lado", () => {
    expect(checkSet([{ role: "front", issues: [] }, { role: "left", issues: [] }]).ask).toEqual([]);
    const full = checkSet([{ role: "front", issues: [] }, { role: "left", issues: [] }, { role: "right", issues: [] }]);
    expect(full.ready).toBe(true); expect(full.issues).toEqual([]); expect(full.ask).toEqual([]);
  });
  test("cabelo cortado pela foto pede uma foto com a cabeça inteira", () => {
    const r = checkSet([{ role: "front", issues: [] }, { role: "left", issues: [] }, { role: "right", issues: [] }], { present: true, color: "#000000", coverage: 1, top: 9, side: 8, bottom: null, fringe: 0, cutTop: true, unsure: false, outline: [] });
    expect(codes(r.issues)).toEqual(["HAIR_CUT:warn"]); expect(r.ask).toEqual(["front-head"]);
  });
  test("peruca, chapéu ou fundo onde deveria haver cabelo: não inventa cabelo e pede outra foto", () => {
    const r = checkSet([{ role: "front", issues: [] }, { role: "left", issues: [] }, { role: "right", issues: [] }], { present: false, color: null, coverage: 0, top: 0, side: 0, bottom: null, fringe: 0, cutTop: false, unsure: true, outline: [] });
    expect(codes(r.issues)).toEqual(["HAIR_UNSURE:warn"]); expect(r.ask).toEqual(["front-hair"]);
  });
  test("blocking", () => { expect(blocking([{ code: "X", severity: "warn" }])).toBe(false); expect(blocking([{ code: "X", severity: "block" }])).toBe(true); });
});

describe("modelo salvo", () => {
  const model = { v: MODEL_VERSION, shape: new Array(N * 3).fill(1.5), skin: "#c8966e", hair: { present: true, color: "#3a2a1e", top: 9, side: 8, bottom: null, fringe: 0.2, cut: false }, metrics: {} as never, views: [], warnings: [] };
  test("aceita um modelo bem formado e recusa NaN, cor inválida, tamanho errado e versão desconhecida", () => {
    expect(validateModel(model)).not.toBeNull();
    expect(validateModel({ ...model, shape: [...model.shape.slice(1), NaN] })).toBeNull();
    expect(validateModel({ ...model, shape: model.shape.slice(1) })).toBeNull();
    expect(validateModel({ ...model, skin: "red" })).toBeNull();
    expect(validateModel({ ...model, hair: { ...model.hair, color: "#12" } })).toBeNull();
    expect(validateModel({ ...model, v: 99 })).toBeNull();
    expect(validateModel(null)).toBeNull();
    // olhos (I4): opcionais; inválidos saem sem derrubar o avatar
    const eyes = { color: "#5a7896", secondary: "#6b5a3a", cls: "BLUE", pattern: "RING", confidence: 0.8, source: "IMAGE_ANALYSIS", glasses: "PRESCRIPTION", frame: "#1c1a1e" } as const;
    expect(validateModel({ ...model, eyes })?.eyes).toEqual(eyes);
    expect(validateModel({ ...model, eyes: { ...eyes, cls: "ROXO" } })).not.toHaveProperty("eyes");
    expect(validateModel({ ...model, eyes: { ...eyes, confidence: 2 } })).not.toHaveProperty("eyes");
    expect(validateModel({ ...model, eyes: { ...eyes, frame: "preto" } })?.eyes).not.toHaveProperty("frame");
    expect(validateModel({ ...model, eyes: { ...eyes, right: { color: "#5a7896", secondary: "#6b5a3a" } } })?.eyes).not.toHaveProperty("right");   // só com os dois
    const brows = { color: "#3a2a1e", thickness: 0.22, arch: 0.06, shape: "SOFT_ARCH", density: 0.8, confidence: 0.8 } as const;
    expect(validateModel({ ...model, brows })?.brows).toEqual(brows);
    expect(validateModel({ ...model, brows: { ...brows, shape: "ONDA" } })).not.toHaveProperty("brows");
  });
  test("ajustes ficam nas faixas pequenas; ausentes voltam ao padrão", () => {
    expect(clampAdjust({ headScale: 3, neck: -1, hairVolume: 0, skinLight: 0.5 })).toEqual({ headScale: 1.06, neck: -0.02, hairVolume: 0.6, skinLight: 0.08, hairTone: 0, hairCut: 0, glasses: 1 });
    expect(clampAdjust({ headScale: NaN })).toEqual({ headScale: 1, neck: 0, hairVolume: 1, skinLight: 0, hairTone: 0, hairCut: 0, glasses: 1 });
    expect(clampAdjust({ hairTone: 7.6 }).hairTone).toBe(8); expect(clampAdjust({ hairTone: 40 }).hairTone).toBe(14);
    expect(clampAdjust(null).headScale).toBe(1);
    // óculos de grau (I4): 1 = mostra os da foto (padrão), 0 = sem; inteiro
    expect(clampAdjust({ glasses: 0 }).glasses).toBe(0); expect(clampAdjust({ glasses: 0.4 }).glasses).toBe(0); expect(clampAdjust({ glasses: 7 }).glasses).toBe(1);
  });
  test("tom de pele: só muda com ajuste explícito, e pouco", () => {
    expect(skinWithLight("#c8966e", 0)).toBe("#c8966e");
    const lighter = skinWithLight("#c8966e", 0.08), darker = skinWithLight("#c8966e", -0.08);
    const L = (h: string) => parseInt(h.slice(3, 5), 16);
    expect(L(lighter)).toBeGreaterThan(L("#c8966e")); expect(L(darker)).toBeLessThan(L("#c8966e"));
    expect(L(lighter) - L("#c8966e")).toBeLessThan(20);
    expect(roundShape([1.23456, -0.001])).toEqual([1.23, -0]);
  });
});
