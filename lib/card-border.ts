import { fashionPreset } from "@/lib/aura-fashion";
import { auraMetamorphoseBrandPreset } from "@/lib/aura-metamorphose";
import type { CSSProperties } from 'react';
export type BorderMode = 'AUTO' | 'COLOR' | 'GRADIENT';
export type BorderEffect = 'AUTO' | 'NONE' | 'GLOW' | 'SHIMMER' | 'HOLO';
export interface CardBorderConfig { mode?: BorderMode; color?: string; from?: string; to?: string; effect?: BorderEffect }
/** Borda padrão do card quando a pessoa não escolhe cor nem degradê e a arte não sugere outra paleta: champanhe → linho. */
export const DEFAULT_BORDER: { from: string; to: string } = { from: '#c6b8a4', to: '#f1e6d5' };
export const BORDER_EFFECTS: BorderEffect[] = ['AUTO', 'NONE', 'GLOW', 'SHIMMER', 'HOLO'];
export const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const hex = (value: unknown, fallback: string) => isHexColor(value) ? value : fallback;
/** Par de cores do modo AUTO: paleta da composição/marca/metamorfose/Aura Hype; sem nenhuma delas, a borda padrão. */
export function autoBorderPair(background?: Record<string, unknown> | null, auraHype = false): [string, string] {
  const metamorphose = background?.auraMetamorphose;
  const brandPreset = auraMetamorphoseBrandPreset(background?.auraMetamorphosePreset);
  const colors: Record<string, [string,string]> = { PRISMA:['#e6a0e8','#77dce2'],CONSTELACAO:['#b5a6ff','#f1d5ff'],FIO_VIVO:['#dc9ba3','#b0a4db'],HOLOGRAFIA:['#7ee3dc','#db9ee8'] };
  const hypeColors: Record<string,[string,string]> = {SCANNER:['#65eddf','#a3c8ff'],XRAY:['#b69bff','#81d5f3'],DOTS:['#7be3de','#c9a4f2'],STARS:['#f5d38b','#e4b9ff'],METRICS:['#91e6b8','#84cfe8']};
  const palette = fashionPreset(background?.compositionPreset)?.palette ?? brandPreset?.palette ?? colors[String(metamorphose)];
  if (palette) return [palette[0], palette[1]];
  if (auraHype) return hypeColors[String(background?.auraHype)] ?? hypeColors.SCANNER;
  return [hex(background?.color, DEFAULT_BORDER.from), DEFAULT_BORDER.to];
}
/** Tinta da borda: cor sólida, degradê escolhido ou, sem escolha (AUTO), o par automático/padrão. */
export function borderPaint(background?: Record<string, unknown> | null, auraHype = false): { paint: string; glow: string } {
  const config = background?.border as CardBorderConfig | undefined;
  const [first, second] = autoBorderPair(background, auraHype);
  if (config?.mode === 'COLOR' && isHexColor(config.color)) return { paint: config.color, glow: config.color };
  if (config?.mode === 'GRADIENT') return { paint: `linear-gradient(135deg,${hex(config.from, first)},${hex(config.to, second)})`, glow: hex(config.from, first) };
  return { paint: `linear-gradient(135deg,${first},${second})`, glow: first };
}
export function borderStyle(background?: Record<string, unknown> | null, auraHype = false): CSSProperties {
  const { paint, glow } = borderPaint(background, auraHype);
  return { '--card-border-paint': paint, '--card-border-glow': glow } as CSSProperties;
}
