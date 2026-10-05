/**
 * Métricas de fidelidade da identidade (AVATAR-ID I0; docs/avatar3d/auditoria-identidade-avatar, seção 15).
 *
 * Tudo aqui é número agregado: nenhuma função devolve pontos, forma, cor nem imagem. As entradas sensíveis (forma
 * medida, marcos do avatar, máscaras) entram e saem só como medidas em mm, razões ou ΔE.
 *
 *  - faceFidelity: reprojeção por região (mm), preservação da forma e da assimetria, entre os 468 pontos medidos na
 *    foto (cm canônicos, AvatarModel.shape) e os mesmos pontos sobre a malha do avatar (m, escala real);
 *  - deltaE2000 / hexToLab: diferença de cor perceptual (pele, íris, cabelo);
 *  - maskIoU: silhueta do cabelo renderizada × máscara da foto.
 */
import { CANON_POS } from "@/lib/avatar3d/canonical-face";
import { similarity } from "@/lib/avatar3d/geometry";
import { proportionErrorPct } from "./face-profile";

export const N_LM = 468;

/** Regiões pelos índices do MediaPipe Face Mesh. */
export const FACE_REGIONS = {
  eyes: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466],
  brows: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46, 300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
  nose: [1, 2, 4, 5, 6, 19, 94, 97, 98, 168, 195, 197, 326, 327, 328, 129, 358, 49, 279],
  mouth: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 78, 308, 13, 14],
  contour: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
} as const;
export type FaceRegion = keyof typeof FACE_REGIONS;

let MIRROR: Int32Array | null = null;
/** Para cada ponto, o ponto do outro lado do rosto (pelo rosto canônico, simétrico em x). Pontos da linha média: ele mesmo. */
export function mirrorIndex(): Int32Array {
  if (MIRROR) return MIRROR;
  const m = new Int32Array(N_LM);
  for (let i = 0; i < N_LM; i++) {
    let best = i, bd = Infinity;
    for (let j = 0; j < N_LM; j++) {
      const d = (CANON_POS[j * 3] + CANON_POS[i * 3]) ** 2 + (CANON_POS[j * 3 + 1] - CANON_POS[i * 3 + 1]) ** 2 + (CANON_POS[j * 3 + 2] - CANON_POS[i * 3 + 2]) ** 2;
      if (d < bd) { bd = d; best = j; }
    }
    m[i] = best;
  }
  MIRROR = m; return m;
}

/** `src` levado sobre `dst` por semelhança (escala, rotação, translação). */
export function alignOnto(src: ArrayLike<number>, dst: ArrayLike<number>, n = N_LM): Float64Array {
  const s = similarity(src, dst, n); const out = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) for (let r = 0; r < 3; r++) out[i * 3 + r] = s.s * (s.R[r * 3] * src[i * 3] + s.R[r * 3 + 1] * src[i * 3 + 1] + s.R[r * 3 + 2] * src[i * 3 + 2]) + s.t[r];
  return out;
}

/**
 * Vetor de assimetria (3 por ponto fora da linha média): a diferença entre o ponto e o reflexo do seu par (a mesma
 * medida da auditoria, em que "assimetria medida > 1 mm" foi calibrada). Num rosto
 * perfeitamente simétrico em torno de x = 0, é zero. Só faz sentido com o rosto alinhado ao referencial do avatar
 * (linha média em x = 0).
 */
export function asymmetryField(p: ArrayLike<number>): Float64Array {
  const m = mirrorIndex(); const out = new Float64Array(N_LM * 3);
  for (let i = 0; i < N_LM; i++) {
    const j = m[i]; if (j === i) continue;
    out[i * 3] = p[i * 3] + p[j * 3]; out[i * 3 + 1] = p[i * 3 + 1] - p[j * 3 + 1]; out[i * 3 + 2] = p[i * 3 + 2] - p[j * 3 + 2];
  }
  return out;
}
const norm2 = (v: ArrayLike<number>, xyOnly: boolean) => { let s = 0; for (let i = 0; i < v.length; i++) if (!xyOnly || i % 3 < 2) s += v[i] * v[i]; return s; };

export interface FaceFidelity {
  /** RMS (mm, plano da imagem) entre os pontos medidos alinhados e os do avatar, por região */
  reprojectionMm: Record<FaceRegion | "all", number>;
  /** 1 − resíduo² / desvio² do rosto médio: quanto do que diferencia a pessoa do rosto médio sobreviveu (0–1) */
  shapePreservation: number;
  /** assimetria média medida e no avatar (mm) e a fração preservada na direção certa (projeção; 0 = perdida, 1 = toda) */
  asymmetry: { measuredMm: number; avatarMm: number; preservation: number };
  /**
   * Com o rosto do avatar ANTES do ajuste (`baseM`): quanto da diferença entre o rosto genérico do corpo e o da pessoa
   * foi capturado (1 − resíduo² depois / resíduo² antes). É a medida que a camada de resíduo (I2) leva perto de 1.
   */
  capture?: number;
  /** erro médio das medidas nomeadas do rosto (relativas à altura do rosto), em % (face-profile.ts) */
  proportionErrorPct: number;
}

/**
 * Fidelidade do rosto: `measuredCm` = os 468 pontos frontalizados da foto (cm canônicos); `avatarM` = os mesmos 468
 * pontos sobre a malha do avatar (m, escala real; landmarksOn). A profundidade conta só na assimetria (numa foto de
 * frente ela é estimada).
 */
export function faceFidelity(measuredCm: ArrayLike<number>, avatarM: ArrayLike<number>, baseM?: ArrayLike<number>): FaceFidelity {
  const U = Float64Array.from({ length: N_LM * 3 }, (_, i) => measuredCm[i] * 0.01);
  const T = alignOnto(U, avatarM);                                     // medido, no referencial do avatar
  const C = Float64Array.from({ length: N_LM * 3 }, (_, i) => CANON_POS[i] * 0.01);
  const T0 = alignOnto(C, avatarM);                                    // rosto médio, no mesmo referencial
  const rms = (idx: readonly number[] | null) => {
    let s = 0, n = 0; const it = idx ?? Array.from({ length: N_LM }, (_, i) => i);
    for (const i of it) { s += (avatarM[i * 3] - T[i * 3]) ** 2 + (avatarM[i * 3 + 1] - T[i * 3 + 1]) ** 2; n++; }
    return Math.round(Math.sqrt(s / Math.max(1, n)) * 10000) / 10;
  };
  const reprojectionMm = { all: rms(null) } as Record<FaceRegion | "all", number>;
  for (const k of Object.keys(FACE_REGIONS) as FaceRegion[]) reprojectionMm[k] = rms(FACE_REGIONS[k]);
  let res = 0, dev = 0;
  for (let i = 0; i < N_LM; i++) for (let r = 0; r < 2; r++) { res += (avatarM[i * 3 + r] - T[i * 3 + r]) ** 2; dev += (T[i * 3 + r] - T0[i * 3 + r]) ** 2; }
  const shapePreservation = dev > 1e-12 ? Math.max(0, Math.min(1, 1 - res / dev)) : 1;
  const aM = asymmetryField(T), aA = asymmetryField(avatarM);
  const pairs = Array.from(mirrorIndex()).filter((j, i) => j !== i).length;
  const mean = (a: Float64Array) => { let s = 0; for (let i = 0; i < N_LM; i++) s += Math.hypot(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]); return (s / Math.max(1, pairs)) * 1000; };
  let dot = 0; for (let i = 0; i < aM.length; i++) dot += aM[i] * aA[i];
  const den = norm2(aM, false);
  let capture: number | undefined;
  if (baseM) {
    const T1 = alignOnto(U, baseM); let r0 = 0;
    for (let i = 0; i < N_LM; i++) for (let r = 0; r < 2; r++) r0 += (baseM[i * 3 + r] - T1[i * 3 + r]) ** 2;
    capture = r0 > 1e-14 ? Math.round(Math.max(0, Math.min(1, 1 - res / r0)) * 1000) / 1000 : 1;
  }
  return {
    capture, proportionErrorPct: proportionErrorPct(measuredCm, avatarM), reprojectionMm, shapePreservation: Math.round(shapePreservation * 1000) / 1000,
    asymmetry: { measuredMm: Math.round(mean(aM) * 100) / 100, avatarMm: Math.round(mean(aA) * 100) / 100, preservation: den > 1e-14 ? Math.round(Math.max(0, dot / den) * 1000) / 1000 : 1 },
  };
}

// ================================================================== cor

export type Lab = { L: number; a: number; b: number };

/** sRGB "#rrggbb" → CIELAB (D65). */
export function hexToLab(hex: string): Lab {
  const n = parseInt(hex.slice(1), 16);
  return rgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
}
export function rgbToLab(r8: number, g8: number, b8: number): Lab {
  const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const r = lin(r8), g = lin(g8), b = lin(b8);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIEDE2000 (Sharma, Wu e Dalal, 2005). */
export function deltaE2000(c1: Lab, c2: Lab): number {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(c1.a, c1.b), C2 = Math.hypot(c2.a, c2.b), Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1 = (1 + G) * c1.a, a2 = (1 + G) * c2.a;
  const C1p = Math.hypot(a1, c1.b), C2p = Math.hypot(a2, c2.b);
  const h = (b: number, a: number) => { if (a === 0 && b === 0) return 0; const v = Math.atan2(b, a) * deg; return v < 0 ? v + 360 : v; };
  const h1 = h(c1.b, a1), h2 = h(c2.b, a2);
  const dL = c2.L - c1.L, dC = C2p - C1p;
  let dh = 0; if (C1p * C2p !== 0) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * rad);
  const Lm = (c1.L + c2.L) / 2, Cmp = (C1p + C2p) / 2;
  let hm = h1 + h2; if (C1p * C2p !== 0) { if (Math.abs(h1 - h2) > 180) hm += h1 + h2 < 360 ? 360 : -360; hm /= 2; }
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2), Sc = 1 + 0.045 * Cmp, Sh = 1 + 0.015 * Cmp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

// ================================================================== silhueta

/** Interseção sobre união de duas máscaras do mesmo tamanho (valor > 0 = dentro). Duas vazias: 1. */
export function maskIoU(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) throw new Error("máscaras de tamanhos diferentes");
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] > 0, y = b[i] > 0; if (x && y) inter++; if (x || y) uni++; }
  return uni ? inter / uni : 1;
}
