/*
 * Avatar 3D (RF40) — o modelo salvo: a forma do rosto da pessoa (468 pontos em pose neutra), o tom de pele e o cabelo
 * medidos na foto, e os ajustes finos que a pessoa escolheu. A textura (atlas do rosto) vai à parte, como imagem.
 * O mesmo formato é validado no backend (Avatar3dService).
 */
import type { FaceMetrics, Role } from "./geometry";
import { N } from "./geometry";
import type { BodyModel, Sex } from "./body-spec";
import { HAIR_LENGTHS, HAIR_TEXTURES, HAIR_VOLUMES, type HairLength, type HairTexture, type HairVolume } from "./hair";
import { HAIR_TONE_MAX, type HairFamily, type HairTone } from "./hair-tone";
import { HAIR_CUT_MAX } from "./hair-cut";
import { GLASSES_KINDS, IRIS_CLASSES, IRIS_PATTERNS, type AvatarEyes, type IrisColor } from "./iris";
import { BROW_SHAPES, type AvatarBrows } from "./identity/brows";

const HAIR_FAMILIES: HairFamily[] = ["natural", "ash", "golden", "copper", "red", "gray", "white"];

export const MODEL_VERSION = 1;

export interface AvatarHair {
  present: boolean; color: string | null; top: number; side: number; bottom: number | null; fringe: number; cut: boolean;
  length?: HairLength; texture?: HairTexture;            // comprimento e textura medidos na foto (lib/avatar3d/hair.ts)
  cover?: string | null;                                 // cor da cobertura de cabeça (lenço, turbante, boné), se houver
  outline?: number[];                                    // silhueta: meia-largura (cm, canônico) por altura (HAIR_LEVELS)
  tone?: HairTone | null;                                // tom medido: nível 1–10 + família (lib/avatar3d/hair-tone.ts)
  volume?: number;                                       // volume medido como fator da geometria (0,7 rente … 1,9 muito volumoso)
  volumeLevel?: HairVolume;                              // o mesmo em classe: rente, normal, volumoso, muito volumoso
}
export interface AvatarModel {
  v: number;
  shape: number[];                          // 468×3 em cm canônicos
  skin: string;                             // "#rrggbb" amostrado nas bochechas e na testa da foto
  hair: AvatarHair;
  metrics: FaceMetrics;
  views: { role: Role; yaw: number; pitch: number; roll: number }[];
  warnings: string[];                       // o que ficou estimado (ex.: DEPTH_ESTIMATED)
  body?: BodyModel | null;                  // corpo: proporções com a origem de cada uma (lib/avatar3d/body-spec.ts)
  sex?: Sex;                                // corpo base: estimado pelo rosto (sex-detect.ts) ou escolhido pela pessoa
  eyes?: AvatarEyes;                        // cor da íris medida e óculos vistos na foto (lib/avatar3d/iris.ts); antigos não têm
  brows?: AvatarBrows;                      // sobrancelhas medidas: cor, espessura, arco, densidade (identity/brows.ts)
}
/**
 * hairTone: 0 = o tom medido na foto; 1–14 = um tom da paleta (HAIR_TONES), escolhido pela pessoa.
 * hairCut: 0 = o corte medido na foto; 1–7 = um corte (HAIR_CUTS, lib/avatar3d/hair-cut.ts).
 * glasses: 1 = mostra os óculos de grau vistos na foto (acessório 3D); 0 = sem óculos. Sem óculos na foto, não faz nada.
 */
export interface AvatarAdjust { headScale: number; neck: number; hairVolume: number; skinLight: number; hairTone: number; hairCut: number; glasses: number }
export const DEFAULT_ADJUST: AvatarAdjust = { headScale: 1, neck: 0, hairVolume: 1, skinLight: 0, hairTone: 0, hairCut: 0, glasses: 1 };
/** Faixas dos ajustes: pequenas de propósito (ajuste fino, não outra pessoa). */
export const ADJUST_RANGE: Record<keyof AvatarAdjust, [number, number, number]> = {
  headScale: [0.94, 1.06, 0.01], neck: [-0.02, 0.02, 0.002], hairVolume: [0.6, 1.6, 0.05], skinLight: [-0.08, 0.08, 0.01],
  hairTone: [0, HAIR_TONE_MAX, 1], hairCut: [0, HAIR_CUT_MAX, 1], glasses: [0, 1, 1],
};
/** Ajustes desenhados como controle deslizante (o tom do cabelo é uma paleta de amostras; o corte, uma lista; os óculos, liga/desliga). */
export const SLIDER_ADJUSTS = (Object.keys(ADJUST_RANGE) as (keyof AvatarAdjust)[]).filter((k) => k !== "hairTone" && k !== "hairCut" && k !== "glasses");

const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
export function clampAdjust(a?: Partial<AvatarAdjust> | null): AvatarAdjust {
  const out = { ...DEFAULT_ADJUST };
  (Object.keys(ADJUST_RANGE) as (keyof AvatarAdjust)[]).forEach((k) => { out[k] = clamp(a?.[k], ADJUST_RANGE[k][0], ADJUST_RANGE[k][1], DEFAULT_ADJUST[k]); });
  out.hairTone = Math.round(out.hairTone); out.hairCut = Math.round(out.hairCut); out.glasses = Math.round(out.glasses);
  return out;
}

const HEX = /^#[0-9a-f]{6}$/i;
/** Aceita só um modelo bem formado (números finitos, na faixa de um rosto): nada de NaN quebrando a cena de outra pessoa. */
export function validateModel(x: unknown): AvatarModel | null {
  const m = x as AvatarModel;
  if (!m || typeof m !== "object" || m.v !== MODEL_VERSION || !Array.isArray(m.shape) || m.shape.length !== N * 3) return null;
  if (!m.shape.every((v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 40)) return null;
  if (typeof m.skin !== "string" || !HEX.test(m.skin)) return null;
  const h = m.hair; if (!h || typeof h !== "object" || (h.color !== null && !HEX.test(String(h.color)))) return null;
  if (![h.top, h.side, h.fringe].every((v) => Number.isFinite(v))) return null;
  // campos novos do cabelo: opcionais (avatares antigos não têm); valor desconhecido é descartado, não derruba o avatar
  const hair: AvatarHair = { ...h };
  if (hair.length !== undefined && !HAIR_LENGTHS.includes(hair.length)) delete hair.length;
  if (hair.texture !== undefined && !HAIR_TEXTURES.includes(hair.texture)) delete hair.texture;
  if (hair.cover !== undefined && hair.cover !== null && !HEX.test(String(hair.cover))) delete hair.cover;
  if (hair.tone !== undefined && hair.tone !== null && !(typeof hair.tone === "object" && Number.isInteger(hair.tone.level) && hair.tone.level >= 1 && hair.tone.level <= 10 && HAIR_FAMILIES.includes(hair.tone.family))) delete hair.tone;
  if (hair.volume !== undefined && !(typeof hair.volume === "number" && Number.isFinite(hair.volume) && hair.volume >= 0.5 && hair.volume <= 2.5)) delete hair.volume;
  if (hair.volumeLevel !== undefined && !HAIR_VOLUMES.includes(hair.volumeLevel)) delete hair.volumeLevel;
  if (hair.outline !== undefined && (!Array.isArray(hair.outline) || hair.outline.length > 32 || !hair.outline.every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 30))) delete hair.outline;
  const out: AvatarModel = { ...m, hair };
  if (out.sex !== undefined && out.sex !== "FEMININO" && out.sex !== "MASCULINO") delete out.sex;
  if (out.eyes !== undefined) { const e = validateEyes(out.eyes); if (e) out.eyes = e; else delete out.eyes; }
  if (out.brows !== undefined) { const b = validateBrows(out.brows); if (b) out.brows = b; else delete out.brows; }
  return out;
}

/** Sobrancelhas: cor "#rrggbb", medidas nas faixas, forma da lista. Fora disso são descartadas (o avatar fica). */
export function validateBrows(x: unknown): AvatarBrows | null {
  const b = x as AvatarBrows;
  const inRange = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
  if (!b || typeof b !== "object" || !HEX.test(String(b.color)) || !BROW_SHAPES.includes(b.shape)) return null;
  if (!inRange(b.thickness, 0, 1) || !inRange(b.arch, 0, 0.5) || !inRange(b.density, 0, 1) || !inRange(b.confidence, 0, 1)) return null;
  return { color: b.color, thickness: b.thickness, arch: b.arch, shape: b.shape, density: b.density, confidence: b.confidence };
}

/** Olhos: só cores "#rrggbb", valores das listas e confiança 0–1. Fora disso os olhos são descartados (o avatar fica). */
export function validateEyes(x: unknown): AvatarEyes | null {
  const e = x as AvatarEyes;
  if (!e || typeof e !== "object" || !HEX.test(String(e.color)) || !HEX.test(String(e.secondary))) return null;
  if (!IRIS_CLASSES.includes(e.cls) || !IRIS_PATTERNS.includes(e.pattern) || !GLASSES_KINDS.includes(e.glasses)) return null;
  if ((e.source !== "IMAGE_ANALYSIS" && e.source !== "DEFAULT") || !(typeof e.confidence === "number" && e.confidence >= 0 && e.confidence <= 1)) return null;
  const iris = (i: unknown): IrisColor | null => { const c = i as IrisColor; return c && typeof c === "object" && HEX.test(String(c.color)) && HEX.test(String(c.secondary)) ? { color: c.color, secondary: c.secondary } : null; };
  const out: AvatarEyes = { color: e.color, secondary: e.secondary, cls: e.cls, pattern: e.pattern, confidence: e.confidence, source: e.source, glasses: e.glasses };
  if (e.frame !== undefined && HEX.test(String(e.frame))) out.frame = e.frame;
  const r = iris(e.right), l = iris(e.left);
  if (r && l) { out.right = r; out.left = l; }
  return out;
}

export function roundShape(shape: ArrayLike<number>): number[] { return Array.from(shape, (v) => Math.round(v * 100) / 100); }

/** Ajuste explícito de luz no tom de pele (±8%): nunca automático; o padrão é o tom da foto. */
export function skinWithLight(hexColor: string, light: number): string {
  if (!light) return hexColor;
  const c = [1, 3, 5].map((i) => parseInt(hexColor.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const k = 1 + light * 2.2;                             // ±8% de luminância percebida ≈ ±17% em luz linear
  return "#" + c.map((v) => Math.min(1, v * k)).map((v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))
    .map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}
