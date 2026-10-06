/**
 * Tom de pele intrínseco (AVATAR-ID I3; auditoria de identidade, seção 7).
 *
 * A foto mistura a cor da pele com a cor da luz: luz quente deixa a pele alaranjada, luz fria azulada, fluorescente
 * esverdeada. Antes, o tom era a mediana dos pixels sem correção (a cor da luz deslocava a estimativa em ΔE 2–20).
 *
 *  - estimateIlluminant: a cor da luz pela ESCLERA (o branco do olho, quase neutro em qualquer pessoa), sem a íris, os
 *    cílios e o reflexo; sem esclera utilizável (olhos pequenos, fechados, óculos escuros), "gray-world" fraco na
 *    imagem toda; sem nada, nenhuma correção;
 *  - os ganhos corrigem a CROMATICIDADE e preservam a luminância (a pele não fica mais clara nem mais escura);
 *  - skinProfile: tom base em CIELAB, subtom (contínuo pelo ângulo de matiz + classe), nível de melanina e de
 *    vermelhidão, cada um com confiança e origem.
 *
 * Nada aqui vai para log: cor de pele é dado pessoal.
 */
import type { Pt, Raster } from "./image-stats";
import { rgbToLab, type Lab } from "./identity/metrics";
import type { Source, Trait } from "./identity/face-profile";

export type Gains = [number, number, number];
export interface Illuminant { gains: Gains; source: "SCLERA" | "GRAY_WORLD" | "NONE"; confidence: number; samples: number }

/** Contorno de cada olho (MediaPipe, em ordem) e a íris (centro + 4 pontos do anel; só existe com os 478 pontos). */
const EYE_L = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const EYE_R = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
const IRIS_L = { c: 468, ring: [469, 470, 471, 472] }, IRIS_R = { c: 473, ring: [474, 475, 476, 477] };

/** Esclera de referência: branco levemente quente (R:G:B ≈ 1,03 : 1 : 0,96). */
export const SCLERA_REF: Gains = [1.03, 1, 0.96];
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function inPoly(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

/** Pixels de esclera dos dois olhos: dentro do contorno, fora da íris, no meio-alto da luminância (sem cílio nem reflexo). */
export function scleraPixels(img: Raster, px: Pt[]): number[][] {
  if (px.length < 478) return [];
  const all: number[][] = [];
  for (const [eye, iris] of [[EYE_L, IRIS_L], [EYE_R, IRIS_R]] as const) {
    const poly = eye.map((i) => px[i]);
    const [cx, cy] = px[iris.c]; const ir = iris.ring.reduce((s, i) => s + Math.hypot(px[i][0] - cx, px[i][1] - cy), 0) / iris.ring.length;
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(img.height - 1, Math.ceil(Math.max(...ys))); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(img.width - 1, Math.ceil(Math.max(...xs))); x++) {
        if (!inPoly(x + 0.5, y + 0.5, poly) || Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < ir * 1.18) continue;
        const o = (y * img.width + x) * 4; all.push([img.data[o], img.data[o + 1], img.data[o + 2], luma(img.data[o], img.data[o + 1], img.data[o + 2])]);
      }
    }
  }
  if (all.length < 8) return [];
  const Ls = all.map((p) => p[3]).sort((a, b) => a - b);
  const lo = Ls[Math.floor(Ls.length * 0.55)], hi = Ls[Math.floor(Ls.length * 0.95)];
  return all.filter((p) => p[3] >= lo && p[3] <= hi && p[3] < 250);
}

/** Ganhos que levam `rgb` à cromaticidade `ref`, preservando a luminância; limitados e aplicados com `strength`. */
export function chromaGains(rgb: [number, number, number], ref: Gains, strength: number): Gains {
  const g = rgb[1] || 1;
  const raw: Gains = [ref[0] * g / Math.max(1, rgb[0]), ref[1] * g / Math.max(1, rgb[1]), ref[2] * g / Math.max(1, rgb[2])];
  const l = luma(raw[0], raw[1], raw[2]) || 1;
  return raw.map((v) => { const n = v / l; return 1 + (Math.min(1.35, Math.max(0.74, n)) - 1) * strength; }) as Gains;
}

export function estimateIlluminant(img: Raster, px: Pt[], strength = 0.95): Illuminant {
  const sc = scleraPixels(img, px);
  if (sc.length >= 24) {
    const mean = [0, 1, 2].map((k) => sc.reduce((s, p) => s + p[k], 0) / sc.length) as [number, number, number];
    return { gains: chromaGains(mean, SCLERA_REF, strength), source: "SCLERA", confidence: Math.min(0.9, 0.5 + sc.length / 400), samples: sc.length };
  }
  // reserva: gray-world fraco (a média de uma cena raramente é neutra; metade da correção)
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < img.data.length; i += 16) { const L = luma(img.data[i], img.data[i + 1], img.data[i + 2]); if (L < 20 || L > 235) continue; r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++; }
  if (n < 100) return { gains: [1, 1, 1], source: "NONE", confidence: 0, samples: 0 };
  return { gains: chromaGains([r / n, g / n, b / n], [1, 1, 1], 0.5), source: "GRAY_WORLD", confidence: 0.35, samples: n };
}

export const applyGains = (rgb: readonly number[], g: Gains): [number, number, number] =>
  [0, 1, 2].map((k) => Math.max(0, Math.min(255, Math.round(rgb[k] * g[k])))) as [number, number, number];

/** Corrige a imagem inteira (em lugar). */
export function balanceRaster(img: Raster, g: Gains): void {
  if (g[0] === 1 && g[1] === 1 && g[2] === 1) return;
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = Math.min(255, d[i] * g[0]); d[i + 1] = Math.min(255, d[i + 1] * g[1]); d[i + 2] = Math.min(255, d[i + 2] * g[2]); }
}

export type Undertone = "COOL" | "NEUTRAL" | "WARM" | "OLIVE";
export interface SkinProfile {
  baseTone: Trait<Lab>;
  undertone: Trait<Undertone> & { hueAngle: number };
  melaninLevel: Trait<number>;
  rednessLevel: Trait<number>;
}

/** Subtom pelo ângulo de matiz (h = atan2(b*, a*)) e pela saturação: azul-rosado → frio; amarelo → quente; amarelo-esverdeado de baixa croma → oliva. */
export function undertoneOf(lab: Lab): { cls: Undertone; hue: number } {
  const hue = (Math.atan2(lab.b, lab.a) * 180) / Math.PI; const chroma = Math.hypot(lab.a, lab.b);
  if (hue > 68 && chroma < 26) return { cls: "OLIVE", hue };
  if (hue < 50) return { cls: "COOL", hue };
  if (hue < 58) return { cls: "NEUTRAL", hue };
  return { cls: "WARM", hue };
}

export function skinProfile(rgb: [number, number, number], wb: Illuminant): SkinProfile {
  const lab = rgbToLab(rgb[0], rgb[1], rgb[2]); const u = undertoneOf(lab);
  const conf = wb.source === "SCLERA" ? 0.85 : wb.source === "GRAY_WORLD" ? 0.6 : 0.45;
  const source: Source = "IMAGE_ANALYSIS";
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    baseTone: { value: { L: r1(lab.L), a: r1(lab.a), b: r1(lab.b) }, confidence: conf, source },
    undertone: { value: u.cls, hueAngle: r1(u.hue), confidence: Math.round(conf * 0.8 * 100) / 100, source },
    melaninLevel: { value: Math.round(Math.min(1, Math.max(0, (85 - lab.L) / 65)) * 100) / 100, confidence: conf, source },
    rednessLevel: { value: Math.round(Math.min(1, Math.max(0, (lab.a - 5) / 25)) * 100) / 100, confidence: Math.round(conf * 0.8 * 100) / 100, source },
  };
}
