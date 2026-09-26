/*
 * Avatar 3D (RF40) — o modelo salvo: a forma do rosto da pessoa (468 pontos em pose neutra), o tom de pele e o cabelo
 * medidos na foto, e os ajustes finos que a pessoa escolheu. A textura (atlas do rosto) vai à parte, como imagem.
 * O mesmo formato é validado no backend (Avatar3dService).
 */
import type { FaceMetrics, Role } from "./geometry";
import { N } from "./geometry";

export const MODEL_VERSION = 1;

export interface AvatarHair { present: boolean; color: string | null; top: number; side: number; bottom: number | null; fringe: number; cut: boolean }
export interface AvatarModel {
  v: number;
  shape: number[];                          // 468×3 em cm canônicos
  skin: string;                             // "#rrggbb" amostrado nas bochechas e na testa da foto
  hair: AvatarHair;
  metrics: FaceMetrics;
  views: { role: Role; yaw: number; pitch: number; roll: number }[];
  warnings: string[];                       // o que ficou estimado (ex.: DEPTH_ESTIMATED)
}
export interface AvatarAdjust { headScale: number; neck: number; hairVolume: number; skinLight: number }
export const DEFAULT_ADJUST: AvatarAdjust = { headScale: 1, neck: 0, hairVolume: 1, skinLight: 0 };
/** Faixas dos ajustes: pequenas de propósito (ajuste fino, não outra pessoa). */
export const ADJUST_RANGE: Record<keyof AvatarAdjust, [number, number, number]> = {
  headScale: [0.94, 1.06, 0.01], neck: [-0.02, 0.02, 0.002], hairVolume: [0.6, 1.6, 0.05], skinLight: [-0.08, 0.08, 0.01],
};

const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
export function clampAdjust(a?: Partial<AvatarAdjust> | null): AvatarAdjust {
  const out = { ...DEFAULT_ADJUST };
  (Object.keys(ADJUST_RANGE) as (keyof AvatarAdjust)[]).forEach((k) => { out[k] = clamp(a?.[k], ADJUST_RANGE[k][0], ADJUST_RANGE[k][1], DEFAULT_ADJUST[k]); });
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
  return m;
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
