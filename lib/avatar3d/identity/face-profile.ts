/**
 * Perfil do rosto com medidas nomeadas (AVATAR-ID I2; auditoria de identidade, seção 5).
 *
 * As medidas saem dos 468 pontos frontalizados (AvatarModel.shape, cm canônicos). Como uma foto não dá o tamanho real,
 * cada medida é guardada também relativa à altura do rosto (testa 10 → queixo 152). A classe do formato (`shapeClass`)
 * é DERIVADA das proporções, só para busca e rótulos: a malha usa as medidas, nunca a classe.
 *
 * Cada característica tem valor, confiança (0–1) e origem. Dado biométrico: fica com o modelo, nunca em log.
 */
import { asymmetryField, FACE_REGIONS, N_LM } from "./metrics";

export type Source = "IMAGE_ANALYSIS" | "MULTI_VIEW" | "USER_CONFIRMED" | "USER_EDITED" | "DEFAULT";
export interface Trait<T> { value: T; confidence: number; source: Source }

/** Pares de pontos (MediaPipe Face Mesh) de cada medida. */
export const PROPORTION_PAIRS = {
  faceWidth: [234, 454], faceHeight: [10, 152], foreheadWidth: [54, 284], cheekboneWidth: [116, 345], jawWidth: [172, 397],
  chinWidth: [149, 378], chinHeight: [17, 152], noseLength: [168, 2], noseWidth: [129, 358], bridgeWidth: [122, 351],
  mouthWidth: [61, 291], upperLip: [0, 13], lowerLip: [14, 17], eyeSpacing: [133, 362], eyeWidthL: [33, 133],
  eyeWidthR: [362, 263], eyeHeightL: [159, 145], eyeHeightR: [386, 374],
} as const;
export type ProportionKey = keyof typeof PROPORTION_PAIRS;
export type FaceProportions = Record<ProportionKey, number> & { jawAngle: number };

const dist = (p: ArrayLike<number>, a: number, b: number) => Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);

/** Medidas na unidade dos pontos (cm para AvatarModel.shape) e o ângulo da mandíbula (graus, média dos dois lados). */
export function faceProportions(p: ArrayLike<number>): FaceProportions {
  const out = {} as FaceProportions;
  for (const k of Object.keys(PROPORTION_PAIRS) as ProportionKey[]) { const [a, b] = PROPORTION_PAIRS[k]; out[k] = dist(p, a, b); }
  // ângulo no gônio: do canto da face (234/454) ao gônio (172/397) e dele ao queixo (152)
  const ang = (top: number, go: number) => {
    const ux = p[top * 3] - p[go * 3], uy = p[top * 3 + 1] - p[go * 3 + 1], vx = p[152 * 3] - p[go * 3], vy = p[152 * 3 + 1] - p[go * 3 + 1];
    return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1)))) * 180) / Math.PI;
  };
  out.jawAngle = Math.round(((ang(234, 172) + ang(454, 397)) / 2) * 10) / 10;
  return out;
}

/** Cada medida dividida pela altura do rosto (independe do tamanho da foto). */
export function relativeProportions(f: FaceProportions): Record<ProportionKey, number> {
  const out = {} as Record<ProportionKey, number>;
  for (const k of Object.keys(PROPORTION_PAIRS) as ProportionKey[]) out[k] = f.faceHeight > 0 ? f[k] / f.faceHeight : 0;
  return out;
}

export type ShapeClass = "OVAL" | "ROUND" | "SQUARE" | "RECTANGULAR" | "OBLONG" | "HEART" | "DIAMOND" | "TRIANGULAR";

/** Classe do formato, derivada das proporções (rótulo e busca; a malha não usa). */
export function shapeClass(f: FaceProportions): ShapeClass {
  const r = f.faceHeight / Math.max(1e-6, f.faceWidth), jw = f.jawWidth / Math.max(1e-6, f.cheekboneWidth), fw = f.foreheadWidth / Math.max(1e-6, f.cheekboneWidth);
  if (r < 1.12) return jw > 0.9 ? "SQUARE" : "ROUND";
  if (r > 1.5) return "OBLONG";
  if (fw > 1 && jw < 0.82) return "HEART";
  if (fw < 0.86 && jw < 0.86) return "DIAMOND";
  if (jw > fw + 0.1) return "TRIANGULAR";
  if (jw > 0.92) return "RECTANGULAR";
  return "OVAL";
}

const CHEEK = [50, 101, 118, 123, 187, 205, 280, 330, 347, 352, 411, 425];
const JAW = [58, 132, 136, 138, 149, 150, 152, 169, 170, 171, 172, 175, 176, 288, 361, 365, 367, 378, 379, 394, 395, 396, 397, 400];

/** Assimetria por região (mm, na escala dos pontos × 10 para cm → mm): média da diferença ponto × reflexo do par. */
export function regionalAsymmetry(p: ArrayLike<number>, unitToMm = 10): { eye: number; brow: number; cheek: number; jaw: number; mouth: number } {
  const a = asymmetryField(p);
  const mean = (idx: readonly number[]) => { let s = 0; for (const i of idx) s += Math.hypot(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]); return Math.round((s / idx.length) * unitToMm * 100) / 100; };
  return { eye: mean(FACE_REGIONS.eyes), brow: mean(FACE_REGIONS.brows), cheek: mean(CHEEK), jaw: mean(JAW), mouth: mean(FACE_REGIONS.mouth) };
}

export interface FaceProfile {
  shapeClass: Trait<ShapeClass>;
  proportions: Trait<FaceProportions>;
  asymmetry: Trait<{ eye: number; brow: number; cheek: number; jaw: number; mouth: number }>;
}

/**
 * Perfil do rosto a partir do modelo: confiança alta para medidas no plano da foto, menor com avisos de qualidade
 * (rosto pequeno, virado, ocluído) e maior com mais de uma vista.
 */
export function faceProfile(shapeCm: ArrayLike<number>, opts: { views?: number; warnings?: string[] } = {}): FaceProfile | null {
  if (!shapeCm || shapeCm.length !== N_LM * 3) return null;
  const views = opts.views ?? 1; const w = new Set(opts.warnings ?? []);
  let conf = views > 1 ? 0.9 : 0.8;
  for (const c of ["FACE_SMALL", "HEAD_TILT", "LOOK_AT_CAMERA", "HEAD_UP_DOWN"]) if (w.has(c)) conf -= 0.1;
  if (w.has("FACE_OCCLUDED")) conf -= 0.3;
  conf = Math.max(0.2, Math.min(0.95, conf));
  const source: Source = views > 1 ? "MULTI_VIEW" : "IMAGE_ANALYSIS";
  const raw = faceProportions(shapeCm);
  const proportions = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Math.round(v * 100) / 100])) as FaceProportions;
  // a assimetria precisa de mais confiança: com uma foto só, abaixo de 0,5 mm é ruído da reconstrução
  const asym = regionalAsymmetry(shapeCm);
  return {
    shapeClass: { value: shapeClass(proportions), confidence: Math.round(conf * 0.9 * 100) / 100, source },
    proportions: { value: proportions, confidence: Math.round(conf * 100) / 100, source },
    asymmetry: { value: asym, confidence: Math.round(conf * (views > 1 ? 1 : 0.8) * 100) / 100, source },
  };
}

/**
 * Erro de proporção (%): média do erro relativo das medidas (relativas à altura do rosto) entre o rosto medido e os
 * mesmos pontos no avatar. A métrica `faceProportionError` da seção 15.
 */
export function proportionErrorPct(measured: ArrayLike<number>, avatar: ArrayLike<number>): number {
  const a = relativeProportions(faceProportions(measured)), b = relativeProportions(faceProportions(avatar));
  let s = 0, n = 0;
  for (const k of Object.keys(PROPORTION_PAIRS) as ProportionKey[]) { if (k === "faceHeight" || a[k] <= 0) continue; s += Math.abs(b[k] - a[k]) / a[k]; n++; }
  return Math.round((s / Math.max(1, n)) * 1000) / 10;
}
