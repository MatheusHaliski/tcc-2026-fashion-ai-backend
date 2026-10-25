// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// MediaPipe falso: cada modelo devolve o que o teste pôs em `mp`
const mp = vi.hoisted(() => ({
  face: null as unknown, faceErr: false as boolean, seg: null as unknown, segErr: false as boolean, pose: null as unknown,
  created: [] as string[], segInputs: [] as { width: number; height: number }[],
}));
vi.mock("@mediapipe/tasks-vision", () => {
  const segmenter = { segment: (img: { width: number; height: number }) => { mp.segInputs.push({ width: img.width, height: img.height }); if (mp.segErr) throw new Error("seg"); return mp.seg; } };
  return {
    FilesetResolver: { forVisionTasks: vi.fn(async (p: string) => ({ wasm: p })) },
    FaceLandmarker: { createFromOptions: vi.fn(async (_fs: unknown, o: { baseOptions: { modelAssetPath: string } }) => { mp.created.push(o.baseOptions.modelAssetPath); return { detect: () => { if (mp.faceErr) throw new Error("face"); return mp.face; } }; }) },
    PoseLandmarker: { createFromOptions: vi.fn(async (_fs: unknown, o: { baseOptions: { modelAssetPath: string } }) => { mp.created.push(o.baseOptions.modelAssetPath); return { detect: () => mp.pose }; }) },
    ImageSegmenter: { createFromOptions: vi.fn(async (_fs: unknown, o: { baseOptions: { modelAssetPath: string } }) => { mp.created.push(o.baseOptions.modelAssetPath); return segmenter; }) },
  };
});

import { detectFace, faceLandmarker, segmentHair } from "./detect";
import { detectBody, multiclassSegmenter, poseLandmarker, segmentClasses } from "./body-detect";

const canvas = (width: number, height: number) => { const c = document.createElement("canvas"); c.width = width; c.height = height; return c; };
// rosto com largura (234 → 454) = w em coordenadas normalizadas
const faceOf = (w: number, x = 0.5) => { const f = Array.from({ length: 478 }, () => ({ x, y: 0.5, z: 0.1 })); f[234] = { x: x - w / 2, y: 0.5, z: 0 }; f[454] = { x: x + w / 2, y: 0.5, z: 0 }; f[152] = { x, y: 0.8, z: 0 }; return f; };
const closeSpy = vi.fn();
const confMask = (w: number, h: number, v: number) => ({ width: w, height: h, getAsFloat32Array: () => new Float32Array(w * h).fill(v) });
const catMask = (w: number, h: number) => ({ width: w, height: h, getAsUint8Array: () => new Uint8Array(w * h).fill(4) });
const body = (top: number, bottom: number) => Array.from({ length: 33 }, (_, i) => ({ x: 0.5, y: i === 0 ? top : i === 32 ? bottom : (top + bottom) / 2, z: 0, visibility: 0.9 }));

beforeEach(() => {
  Object.assign(mp, { face: { faceLandmarks: [] }, faceErr: false, seg: null, segErr: false, pose: { landmarks: [] }, segInputs: [] });
  closeSpy.mockClear();
});

describe("detecção do rosto (MediaPipe no aparelho)", () => {
  it("os modelos são criados uma vez só e vêm de /mediapipe", async () => {
    const a = await faceLandmarker(); const b = await faceLandmarker();
    expect(a).toBe(b);
    await poseLandmarker(); await multiclassSegmenter();
    expect(mp.created).toEqual(expect.arrayContaining(["/mediapipe/face_landmarker.task", "/mediapipe/pose_landmarker_full.task", "/mediapipe/selfie_multiclass_256x256.tflite"]));
    expect(mp.created.filter((p) => p.endsWith("face_landmarker.task"))).toHaveLength(1);
  });

  it("sem rosto: zero rostos, sem pontos", async () => {
    expect(await detectFace(canvas(100, 100))).toEqual({ faces: 0, lm: null, blend: {} });
    mp.face = {};
    expect((await detectFace(canvas(100, 100))).faces).toBe(0);
  });

  it("rosto ao fundo bem menor não conta; o principal é o maior e leva as expressões dele", async () => {
    mp.face = { faceLandmarks: [faceOf(0.1, 0.2), faceOf(0.4, 0.6)], faceBlendshapes: [{ categories: [{ categoryName: "x", score: 9 }] }, { categories: [{ categoryName: "mouthSmile", score: 0.7 }] }] };
    const r = await detectFace(canvas(200, 100));
    expect(r.faces).toBe(1);
    expect(r.lm![234].x).toBeCloseTo(0.4);
    expect(r.blend).toEqual({ mouthSmile: 0.7 });
  });

  it("dois rostos parecidos contam como dois; sem expressões fica vazio", async () => {
    mp.face = { faceLandmarks: [faceOf(0.3), faceOf(0.25)] };
    const r = await detectFace(canvas(100, 100));
    expect(r.faces).toBe(2);
    expect(r.blend).toEqual({});
  });
});

describe("máscara de cabelo", () => {
  it("usa a segunda máscara (cabelo) quando há duas e fecha o resultado", async () => {
    mp.seg = { confidenceMasks: [confMask(4, 3, 0.1), confMask(4, 3, 0.8)], close: closeSpy };
    const m = await segmentHair(canvas(4, 3));
    expect(m).toHaveLength(12);
    expect(m![0]).toBeCloseTo(0.8);
    expect(closeSpy).toHaveBeenCalled();
  });

  it("uma máscara só é usada; tamanho diferente da imagem ou nenhuma máscara dão null", async () => {
    mp.seg = { confidenceMasks: [confMask(4, 3, 0.5)], close: closeSpy };
    expect((await segmentHair(canvas(4, 3)))![0]).toBeCloseTo(0.5);
    expect(await segmentHair(canvas(5, 3))).toBeNull();
    mp.seg = { close: closeSpy };
    expect(await segmentHair(canvas(4, 3))).toBeNull();
  });

  it("segmentador que falha dá null", async () => {
    mp.segErr = true;
    expect(await segmentHair(canvas(4, 3))).toBeNull();
  });
});

describe("detecção do corpo", () => {
  it("sem pessoa: sem pose, sem máscara e sem queixo", async () => {
    mp.pose = {}; mp.segErr = true; mp.faceErr = true;
    const r = await detectBody(canvas(100, 200));
    expect(r).toMatchObject({ people: 0, pose: null, world: null, mask: null, chin: null });
    expect(r.ms).toBeGreaterThanOrEqual(0);
  });

  it("escolhe a pessoa maior, conta só as de tamanho parecido, traz metros, máscara e queixo", async () => {
    mp.pose = { landmarks: [body(0.4, 0.6), body(0.1, 0.9), body(0.2, 0.8)], worldLandmarks: [[], body(-1, 1), []] };
    mp.seg = { categoryMask: catMask(2, 2), close: closeSpy };
    mp.face = { faceLandmarks: [faceOf(0.2)] };
    const r = await detectBody(canvas(100, 200));
    expect(r.people).toBe(2);
    expect(r.pose![0].y).toBeCloseTo(0.1);
    expect(r.world![32].y).toBe(1);
    expect(r.mask).toEqual({ width: 2, height: 2, data: new Uint8Array(4).fill(4) });
    expect(r.chin).toEqual({ x: 0.5, y: 0.8, visibility: 1 });
    expect(mp.segInputs.at(-1)).toEqual({ width: 100, height: 200 });
  });

  it("foto grande é reduzida a 720 px para a segmentação; sem pontos em metros e sem máscara de categoria", async () => {
    mp.pose = { landmarks: [body(0.1, 0.9)] };
    mp.seg = { close: closeSpy };
    const r = await detectBody(canvas(1440, 720));
    expect(mp.segInputs.at(-1)).toEqual({ width: 720, height: 360 });
    expect(r.world).toBeNull();
    expect(r.mask).toBeNull();
    expect(r.chin).toBeNull();
  });

  it("máscara de classes avulsa: reduz foto grande, devolve a máscara ou null", async () => {
    mp.seg = { categoryMask: catMask(3, 1), close: closeSpy };
    expect(await segmentClasses(canvas(3, 1))).toEqual({ width: 3, height: 1, data: new Uint8Array(3).fill(4) });
    expect(await segmentClasses(canvas(2000, 100))).not.toBeNull();
    expect(mp.segInputs.at(-1)).toEqual({ width: 720, height: 36 });
    mp.seg = { close: closeSpy };
    expect(await segmentClasses(canvas(3, 1))).toBeNull();
    mp.segErr = true;
    expect(await segmentClasses(canvas(3, 1))).toBeNull();
  });
});
