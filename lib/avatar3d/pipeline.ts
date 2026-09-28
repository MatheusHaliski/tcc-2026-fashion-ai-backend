/*
 * Avatar 3D (RF40) — do arquivo ao modelo: foto em pé (EXIF aplicado pelo navegador), pontos do rosto, pose,
 * qualidade, cabelo, forma fundida, tom de pele e textura. Tudo no navegador; só o resultado (modelo + atlas) vai
 * para o servidor, e só com o consentimento da pessoa.
 */
import { detectFace, segmentHair } from "./detect";
import { N, faceMetrics, fitView, fuseShape, type Landmark, type Role, type ViewFit } from "./geometry";
import { faceStats, fit2D, hairStats, occlusion, sampleSkin, type FaceStats, type HairStats, type Pt } from "./image-stats";
import { checkPhoto, checkSet, blocking, type Issue } from "./quality";
import { bakeAtlas } from "./atlas";
import { MODEL_VERSION, roundShape, type AvatarModel } from "./model";
import { hairProfile, type HairProfile } from "./hair";
import { segmentClasses } from "./body-detect";
import type { ClassMask } from "./body";

export const MAX_SIDE = 1600;

/** Arquivo → canvas em pé (o navegador aplica a orientação EXIF) com o lado maior em até 1600 px. */
export async function loadOriented(file: Blob, max = MAX_SIDE): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext("2d", { willReadFrequently: true })!; g.imageSmoothingQuality = "high"; g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
  return c;
}

export interface AnalyzedPhoto {
  role: Role; canvas: HTMLCanvasElement; width: number; height: number;
  faces: number; lm: Landmark[] | null; px: Pt[] | null; fit: ViewFit | null; stats: FaceStats | null;
  blend: Record<string, number>; issues: Issue[]; hairMask: Float32Array | null;
  skin: [number, number, number] | null; occlusion: number | null; classMask: ClassMask | null;
}

/**
 * Analisa uma foto. Para as fotos de lado o papel (esquerdo/direito) vem da própria pose: yaw > 0 mostra o lado
 * direito do rosto da pessoa.
 */
export async function analyzePhoto(src: Blob | HTMLCanvasElement, role: Role | "side"): Promise<AnalyzedPhoto> {
  const canvas = src instanceof HTMLCanvasElement ? src : await loadOriented(src);
  const { width, height } = canvas;
  const det = await detectFace(canvas);
  let fit: ViewFit | null = null, stats: FaceStats | null = null, px: Pt[] | null = null; let r: Role = role === "side" ? "left" : role;
  let skin: [number, number, number] | null = null, occ: number | null = null;
  if (det.lm && det.faces === 1) {
    px = det.lm.map((p) => [p.x * width, p.y * height] as Pt);
    fit = fitView(det.lm, width, height, "front");
    if (role === "side") r = fit.pose.yaw > 0 ? "right" : "left";
    fit.role = r;
    const g = canvas.getContext("2d", { willReadFrequently: true })!; const img = g.getImageData(0, 0, width, height);
    stats = faceStats(img, px); skin = sampleSkin(img, px).rgb; occ = occlusion(img, px, skin);
  }
  const inFrame = det.lm ? det.lm.slice(0, N).every((p) => p.x > 0.005 && p.x < 0.995 && p.y > 0.005 && p.y < 0.995) : undefined;
  const issues = checkPhoto({ role: r, faces: det.faces, width, height, inFrame, pose: fit?.pose, stats: stats ?? undefined, blend: det.blend, rms: fit?.rms, occlusion: occ ?? undefined });
  const hairMask = r === "front" && det.faces === 1 ? await segmentHair(canvas) : null;
  const classMask = r === "front" && det.faces === 1 ? await segmentClasses(canvas) : null;
  return { role: r, canvas, width, height, faces: det.faces, lm: det.lm, px, fit, stats, blend: det.blend, issues, hairMask, skin, occlusion: occ, classMask };
}

export interface BuiltAvatar { model: AvatarModel; atlas: HTMLCanvasElement; hair: HairStats | null; hairProfile: HairProfile | null; set: ReturnType<typeof checkSet>; lightEvened: boolean }

/** Junta as fotos aprovadas (frente obrigatória, lados opcionais) num avatar. */
export function buildAvatar(photos: AnalyzedPhoto[]): BuiltAvatar | null {
  const ok = photos.filter((p) => p.fit && p.px && !blocking(p.issues));
  const front = ok.find((p) => p.role === "front");
  const sides = ok.filter((p) => p.role !== "front").slice(0, 2);
  const g0 = front?.canvas.getContext("2d", { willReadFrequently: true });
  const toCanon = front?.fit && front.px ? fit2D(front.px.slice(0, N), Array.from({ length: N }, (_, i) => [front.fit!.shape[i * 3], front.fit!.shape[i * 3 + 1]] as Pt)) : null;
  const img0 = front && g0 ? g0.getImageData(0, 0, front.width, front.height) : null;
  const hair = front && img0 && front.hairMask && toCanon ? hairStats(img0, front.hairMask, front.px!, toCanon, front.fit!.shape[10 * 3 + 1], front.skin ?? undefined) : null;
  const profile: HairProfile | null = hair && img0 && toCanon && front?.skin ? hairProfile(img0, front.hairMask!, front.classMask, front.px!, toCanon, front.fit!.shape[10 * 3 + 1], front.skin, hair) : null;
  const set = checkSet(photos.map((p) => ({ role: p.role, issues: p.issues })), hair);
  if (!front || !g0) return null;
  const views = [front, ...sides];
  const shape = fuseShape(views.map((v) => v.fit!));
  const skin = sampleSkin(g0.getImageData(0, 0, front.width, front.height), front.px!);
  const baked = bakeAtlas(views.map((v) => ({ role: v.role, canvas: v.canvas, px: v.px!, sim: v.fit!.sim })), skin.hex);
  const model: AvatarModel = {
    v: MODEL_VERSION, shape: roundShape(shape), skin: skin.hex,
    hair: hair ? { present: hair.present && !hair.unsure, color: profile?.color ?? hair.color, top: +hair.top.toFixed(2), side: +hair.side.toFixed(2), bottom: hair.bottom === null ? null : +hair.bottom.toFixed(2), fringe: +hair.fringe.toFixed(2), cut: hair.cutTop,
      ...(profile ? { length: profile.length, texture: profile.texture, cover: profile.cover, outline: profile.outline, tone: profile.tone } : {}) }
      : { present: false, color: null, top: 0, side: 0, bottom: null, fringe: 0, cut: false },
    metrics: faceMetrics(shape),
    views: views.map((v) => ({ role: v.role, yaw: +v.fit!.pose.yaw.toFixed(1), pitch: +v.fit!.pose.pitch.toFixed(1), roll: +v.fit!.pose.roll.toFixed(1) })),
    warnings: [...new Set([...set.issues.filter((i) => i.severity === "warn").map((i) => i.code), ...views.flatMap((v) => v.issues.filter((i) => i.severity === "warn").map((i) => i.code))])],
  };
  return { model, atlas: baked.canvas, hair, hairProfile: profile, set, lightEvened: baked.light.applied };
}

export const atlasBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("atlas"))), "image/jpeg", 0.9));
