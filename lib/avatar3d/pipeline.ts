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
import { HAIR_FALLBACK, hairProfile, type HairProfile } from "./hair";
import { renderColor } from "./hair-tone";
import { segmentClasses } from "./body-detect";
import type { ClassMask } from "./body";
import { bodySex, detectSex, type SexGuess } from "./sex-detect";
import type { Sex } from "./body-spec";

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
  sex: SexGuess | null;                                   // sexo estimado pelo rosto (lib/avatar3d/sex-detect.ts)
}

/**
 * Recorte da cabeça e do cabelo (até abaixo dos ombros) quando o rosto ocupa pouco da foto. Os segmentadores enxergam
 * a imagem em 512 px (cabelo) e 256 px (classes): numa foto de ambiente, com o rosto pequeno, a cabeça inteira vira
 * poucas dezenas de pixels e o cabelo — sobretudo o claro sobre fundo claro — some. Recortado, ocupa a entrada toda.
 * null quando o recorte seria quase a foto inteira (rosto grande: nada a ganhar).
 */
export function headCrop(px: Pt[], w: number, h: number): { x: number; y: number; w: number; h: number } | null {
  const fw = Math.hypot(px[234][0] - px[454][0], px[234][1] - px[454][1]);
  const fh = Math.hypot(px[10][0] - px[152][0], px[10][1] - px[152][1]);
  const cx = (px[234][0] + px[454][0]) / 2;
  const x0 = Math.max(0, Math.floor(cx - fw * 2.2)), x1 = Math.min(w, Math.ceil(cx + fw * 2.2));
  const y0 = Math.max(0, Math.floor(Math.min(px[10][1], px[152][1]) - fh * 1.2)), y1 = Math.min(h, Math.ceil(Math.max(px[10][1], px[152][1]) + fh * 2.8));
  if (x1 - x0 < 32 || y1 - y0 < 32 || (x1 - x0) * (y1 - y0) > w * h * 0.5) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function cropCanvas(src: HTMLCanvasElement, r: { x: number; y: number; w: number; h: number }): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = r.w; c.height = r.h;
  c.getContext("2d")!.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h); return c;
}

/** Máscaras de cabelo e de classes da foto inteira, calculadas no recorte da cabeça quando o rosto é pequeno. */
async function headMasks(canvas: HTMLCanvasElement, px: Pt[]): Promise<{ hair: Float32Array | null; classes: ClassMask | null }> {
  const { width: w, height: h } = canvas; const r = headCrop(px, w, h);
  if (!r) return { hair: await segmentHair(canvas), classes: await segmentClasses(canvas) };
  const crop = cropCanvas(canvas, r);
  const [hc, cc] = [await segmentHair(crop), await segmentClasses(crop)];
  let hair: Float32Array | null = null;
  if (hc) { hair = new Float32Array(w * h); for (let y = 0; y < r.h; y++) hair.set(hc.subarray(y * r.w, (y + 1) * r.w), (r.y + y) * w + r.x); }
  let classes: ClassMask | null = null;
  if (cc) {
    // a máscara do recorte tem a própria escala (até 720 px): a da foto inteira fica nessa mesma escala, fundo fora dele
    const f = cc.width / r.w; const W = Math.max(1, Math.round(w * f)), H = Math.max(1, Math.round(h * f));
    const data = new Uint8Array(W * H); const ox = Math.round(r.x * f), oy = Math.round(r.y * f);
    for (let y = 0; y < cc.height; y++) for (let x = 0; x < cc.width; x++) { const X = ox + x, Y = oy + y; if (X < W && Y < H) data[Y * W + X] = cc.data[y * cc.width + x]; }
    classes = { width: W, height: H, data };
  }
  return { hair, classes };
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
  const masks = r === "front" && det.faces === 1 && px ? await headMasks(canvas, px) : { hair: null, classes: null };
  const sex = r === "front" && det.faces === 1 && px ? await detectSex(canvas, px) : null;
  return { role: r, canvas, width, height, faces: det.faces, lm: det.lm, px, fit, stats, blend: det.blend, issues, hairMask: masks.hair, skin, occlusion: occ, classMask: masks.classes, sex };
}

/** Máscara de cabelo (0/1, do tamanho da foto) a partir da classe "cabelo" do segmentador de classes. */
export function classHairMask(cls: ClassMask, w: number, h: number): Float32Array {
  const m = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = Math.min(cls.height - 1, Math.floor((y * cls.height) / h)) * cls.width;
    for (let x = 0; x < w; x++) if (cls.data[row + Math.min(cls.width - 1, Math.floor((x * cls.width) / w))] === 1) m[y * w + x] = 1;
  }
  return m;
}

export interface BuiltAvatar { model: AvatarModel; atlas: HTMLCanvasElement; hair: HairStats | null; hairProfile: HairProfile | null; set: ReturnType<typeof checkSet>; lightEvened: boolean; sexGuess: SexGuess | null }

/**
 * Junta as fotos aprovadas (frente obrigatória, lados opcionais) num avatar. `sex`: o corpo base escolhido pela
 * pessoa; sem ele, o estimado pelo rosto (quando seguro) ou o do cadastro (`profileSex`).
 */
export function buildAvatar(photos: AnalyzedPhoto[], opts: { sex?: Sex | null; profileSex?: Sex | null } = {}): BuiltAvatar | null {
  const ok = photos.filter((p) => p.fit && p.px && !blocking(p.issues));
  const front = ok.find((p) => p.role === "front");
  const sides = ok.filter((p) => p.role !== "front").slice(0, 2);
  const g0 = front?.canvas.getContext("2d", { willReadFrequently: true });
  const toCanon = front?.fit && front.px ? fit2D(front.px.slice(0, N), Array.from({ length: N }, (_, i) => [front.fit!.shape[i * 3], front.fit!.shape[i * 3 + 1]] as Pt)) : null;
  const img0 = front && g0 ? g0.getImageData(0, 0, front.width, front.height) : null;
  let hairMask = front?.hairMask ?? null;
  let hair = front && img0 && hairMask && toCanon ? hairStats(img0, hairMask, front.px!, toCanon, front.fit!.shape[10 * 3 + 1], front.skin ?? undefined) : null;
  // o segmentador fino não viu cabelo (escuro sobre fundo escuro, claro sobre claro): a classe "cabelo" do segmentador
  // de classes dá a segunda opinião, com a mesma medida (comprimento, silhueta) — antes isso virava "raspado" ou careca
  if (front && img0 && toCanon && front.classMask && (!hair || !hair.present)) {
    const alt = classHairMask(front.classMask, front.width, front.height);
    const h2 = hairStats(img0, alt, front.px!, toCanon, front.fit!.shape[10 * 3 + 1], front.skin ?? undefined);
    if (h2.present) { hair = h2; hairMask = alt; }
  }
  // sem máscara nenhuma (segmentador indisponível): o perfil ainda decide pelas classes e pelo corpo base, nunca careca à toa
  if (front && img0 && toCanon && !hair) { hairMask = new Float32Array(front.width * front.height); hair = hairStats(img0, hairMask, front.px!, toCanon, front.fit!.shape[10 * 3 + 1], front.skin ?? undefined); }
  const sexGuess = front?.sex ?? null;
  const sex: Sex = opts.sex ?? bodySex(sexGuess, opts.profileSex);
  const profile: HairProfile | null = hair && img0 && toCanon && front?.skin ? hairProfile(img0, hairMask!, front.classMask, front.px!, toCanon, front.fit!.shape[10 * 3 + 1], front.skin, hair, HAIR_FALLBACK[sex].length) : null;
  const set = checkSet(photos.map((p) => ({ role: p.role, issues: p.issues })), hair);
  if (!front || !g0) return null;
  const views = [front, ...sides];
  const shape = fuseShape(views.map((v) => v.fit!));
  const skin = sampleSkin(g0.getImageData(0, 0, front.width, front.height), front.px!);
  const baked = bakeAtlas(views.map((v) => ({ role: v.role, canvas: v.canvas, px: v.px!, sim: v.fit!.sim })), skin.hex);
  // cabelo presente: o que o perfil decidiu (cabelo medido, raspado visto pela classe, ou suposto sem evidência de
  // careca). Antes valia só o segmentador fino — e cabelo que ele não via virava cabeça careca.
  const hairColor = profile ? profile.color ?? (profile.estimated && profile.tone ? renderColor(profile.tone) : null) : hair?.color ?? null;
  const present = profile ? profile.length !== "bald" && !!hairColor : !!hair && hair.present && !hair.unsure;
  const bottom = profile?.estimated ? HAIR_FALLBACK[sex].bottom : hair?.bottom ?? null;
  const model: AvatarModel = {
    v: MODEL_VERSION, shape: roundShape(shape), skin: skin.hex, sex,
    hair: hair ? { present, color: hairColor, top: +hair.top.toFixed(2), side: +hair.side.toFixed(2), bottom: bottom === null ? null : +bottom.toFixed(2), fringe: +hair.fringe.toFixed(2), cut: hair.cutTop,
      ...(profile ? { length: profile.length, texture: profile.texture, cover: profile.cover, outline: profile.outline, tone: profile.tone } : {}),
      ...(profile?.volumeLevel ? { volume: profile.volumeFactor, volumeLevel: profile.volumeLevel } : {}) }
      : { present: false, color: null, top: 0, side: 0, bottom: null, fringe: 0, cut: false },
    metrics: faceMetrics(shape),
    views: views.map((v) => ({ role: v.role, yaw: +v.fit!.pose.yaw.toFixed(1), pitch: +v.fit!.pose.pitch.toFixed(1), roll: +v.fit!.pose.roll.toFixed(1) })),
    warnings: [...new Set([...set.issues.filter((i) => i.severity === "warn").map((i) => i.code), ...views.flatMap((v) => v.issues.filter((i) => i.severity === "warn").map((i) => i.code)), ...(profile?.estimated ? ["HAIR_ESTIMATED"] : [])])],
  };
  return { model, atlas: baked.canvas, hair, hairProfile: profile, set, lightEvened: baked.light.applied, sexGuess };
}

export const atlasBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("atlas"))), "image/jpeg", 0.9));
