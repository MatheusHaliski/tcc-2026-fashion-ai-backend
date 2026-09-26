/*
 * Avatar 3D (RF40) — detecção no próprio navegador (a foto não sai do aparelho para um serviço de terceiros):
 * MediaPipe Face Landmarker (478 pontos + expressões) e Hair Segmenter (máscara de cabelo). Modelos e WASM ficam em
 * /public/mediapipe (servidos pelo próprio site; scripts/avatar3d/copy-mediapipe.mjs copia o WASM do pacote).
 */
import type { FaceLandmarker, ImageSegmenter } from "@mediapipe/tasks-vision";
import type { Landmark } from "./geometry";

const BASE = "/mediapipe";
type Vision = typeof import("@mediapipe/tasks-vision");
let mpP: Promise<{ mp: Vision; fs: Awaited<ReturnType<Vision["FilesetResolver"]["forVisionTasks"]>> }> | null = null;
function vision() {
  if (!mpP) mpP = import("@mediapipe/tasks-vision").then(async (mp) => ({ mp, fs: await mp.FilesetResolver.forVisionTasks(`${BASE}/wasm`) }));
  return mpP;
}

let faceP: Promise<FaceLandmarker> | null = null;
export function faceLandmarker(): Promise<FaceLandmarker> {
  if (!faceP) faceP = vision().then(({ mp, fs }) => mp.FaceLandmarker.createFromOptions(fs, {
    baseOptions: { modelAssetPath: `${BASE}/face_landmarker.task`, delegate: "CPU" }, runningMode: "IMAGE",
    numFaces: 3, outputFaceBlendshapes: true, minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5,
  }));
  return faceP;
}

let hairP: Promise<ImageSegmenter> | null = null;
export function hairSegmenter(): Promise<ImageSegmenter> {
  if (!hairP) hairP = vision().then(({ mp, fs }) => mp.ImageSegmenter.createFromOptions(fs, {
    baseOptions: { modelAssetPath: `${BASE}/hair_segmenter.tflite`, delegate: "CPU" }, runningMode: "IMAGE",
    outputConfidenceMasks: true, outputCategoryMask: false,
  }));
  return hairP;
}

export interface FaceDetection { faces: number; lm: Landmark[] | null; blend: Record<string, number> }

/**
 * Rostos na foto. Um rosto bem menor que o principal (alguém ao fundo, um pôster) não conta como "mais de um";
 * dois rostos de tamanho parecido contam: aí não dá para saber de quem é o avatar.
 */
export async function detectFace(img: HTMLCanvasElement): Promise<FaceDetection> {
  const r = (await faceLandmarker()).detect(img);
  const faces = r.faceLandmarks ?? [];
  if (!faces.length) return { faces: 0, lm: null, blend: {} };
  const width = (f: Landmark[]) => Math.hypot((f[234].x - f[454].x) * img.width, (f[234].y - f[454].y) * img.height);
  const order = faces.map((f, i) => ({ i, w: width(f) })).sort((a, b) => b.w - a.w);
  const main = order[0]; const count = order.filter((o) => o.w >= main.w * 0.45).length;
  const blend: Record<string, number> = {};
  (r.faceBlendshapes?.[main.i]?.categories ?? []).forEach((c) => { blend[c.categoryName] = c.score; });
  return { faces: count, lm: faces[main.i].map((p) => ({ x: p.x, y: p.y, z: p.z })), blend };
}

/** Confiança de cabelo por pixel (0–1), do tamanho da imagem; null se o segmentador falhar. */
export async function segmentHair(img: HTMLCanvasElement): Promise<Float32Array | null> {
  try {
    const r = (await hairSegmenter()).segment(img);
    const masks = r.confidenceMasks ?? [];
    const m = masks[masks.length > 1 ? 1 : 0];
    const out = m && m.width === img.width && m.height === img.height ? Float32Array.from(m.getAsFloat32Array()) : null;
    r.close();
    return out;
  } catch { return null; }
}
