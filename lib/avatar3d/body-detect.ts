/*
 * Avatar 3D — detecção do corpo no próprio navegador (a foto não sai do aparelho): MediaPipe Pose Landmarker
 * (33 pontos + pontos em metros) e Selfie Multiclass Segmenter (fundo, cabelo, pele do corpo, pele do rosto, roupa,
 * acessórios). Os modelos ficam em /public/mediapipe e só são baixados quando a pessoa envia a foto de corpo inteiro.
 */
import type { ImageSegmenter, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { ClassMask, PosePoint } from "./body";
import { faceLandmarker } from "./detect";

const BASE = "/mediapipe";
type Vision = typeof import("@mediapipe/tasks-vision");
let mpP: Promise<{ mp: Vision; fs: Awaited<ReturnType<Vision["FilesetResolver"]["forVisionTasks"]>> }> | null = null;
function vision() {
  if (!mpP) mpP = import("@mediapipe/tasks-vision").then(async (mp) => ({ mp, fs: await mp.FilesetResolver.forVisionTasks(`${BASE}/wasm`) }));
  return mpP;
}

let poseP: Promise<PoseLandmarker> | null = null;
export function poseLandmarker(): Promise<PoseLandmarker> {
  if (!poseP) poseP = vision().then(({ mp, fs }) => mp.PoseLandmarker.createFromOptions(fs, {
    baseOptions: { modelAssetPath: `${BASE}/pose_landmarker_full.task`, delegate: "CPU" }, runningMode: "IMAGE",
    numPoses: 2, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, outputSegmentationMasks: false,
  }));
  return poseP;
}

let segP: Promise<ImageSegmenter> | null = null;
export function multiclassSegmenter(): Promise<ImageSegmenter> {
  if (!segP) segP = vision().then(({ mp, fs }) => mp.ImageSegmenter.createFromOptions(fs, {
    baseOptions: { modelAssetPath: `${BASE}/selfie_multiclass_256x256.tflite`, delegate: "CPU" }, runningMode: "IMAGE",
    outputCategoryMask: true, outputConfidenceMasks: false,
  }));
  return segP;
}

export interface BodyDetection { people: number; pose: PosePoint[] | null; world: PosePoint[] | null; mask: ClassMask | null; chin: PosePoint | null; ms: number }

/** Pontos do corpo, pontos em metros, máscara de classes (na resolução da imagem, limitada a 720 px) e o queixo. */
export async function detectBody(img: HTMLCanvasElement): Promise<BodyDetection> {
  const t0 = performance.now();
  const r = (await poseLandmarker()).detect(img);
  const all = r.landmarks ?? [];
  // duas pessoas de tamanho parecido: não dá para saber de quem é o corpo
  const size = (lm: { x: number; y: number }[]) => { const ys = lm.map((p) => p.y); return Math.max(...ys) - Math.min(...ys); };
  const order = all.map((lm, i) => ({ i, s: size(lm) })).sort((a, b) => b.s - a.s);
  const people = order.filter((o) => o.s >= (order[0]?.s ?? 0) * 0.6).length;
  const main = order[0]?.i;
  const pose = main === undefined ? null : all[main].map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility }));
  const world = main === undefined || !r.worldLandmarks?.[main] ? null : r.worldLandmarks[main].map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility }));
  let mask: ClassMask | null = null;
  try {
    const k = Math.min(1, 720 / Math.max(img.width, img.height));
    const src = k < 1 ? scaled(img, k) : img;
    const seg = (await multiclassSegmenter()).segment(src);
    const cm = seg.categoryMask;
    if (cm) mask = { width: cm.width, height: cm.height, data: Uint8Array.from(cm.getAsUint8Array()) };
    seg.close();
  } catch { mask = null; }
  let chin: PosePoint | null = null;
  try {
    const f = (await faceLandmarker()).detect(img).faceLandmarks?.[0];
    if (f) chin = { x: f[152].x, y: f[152].y, visibility: 1 };
  } catch { chin = null; }
  return { people, pose, world, mask, chin, ms: Math.round(performance.now() - t0) };
}

function scaled(img: HTMLCanvasElement, k: number): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height); return c;
}
