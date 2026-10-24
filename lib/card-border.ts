import { fashionPreset } from "@/lib/aura-fashion";
import { auraMetamorphoseBrandPreset } from "@/lib/aura-metamorphose";
import type { CSSProperties } from 'react';
export type BorderMode = 'AUTO' | 'COLOR' | 'GRADIENT';
export type BorderEffect = 'AUTO' | 'NONE' | 'GLOW' | 'SHIMMER' | 'HOLO';
export interface CardBorderConfig { mode?: BorderMode; color?: string; from?: string; to?: string; effect?: BorderEffect }
const hex = (value: unknown, fallback: string) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
export function borderStyle(background?: Record<string, unknown> | null, auraHype = false): CSSProperties {
  const config = background?.border as CardBorderConfig | undefined;
  const metamorphose = background?.auraMetamorphose;
  const brandPreset = auraMetamorphoseBrandPreset(background?.auraMetamorphosePreset);
  const colors: Record<string, [string,string]> = { PRISMA:['#e6a0e8','#77dce2'],CONSTELACAO:['#b5a6ff','#f1d5ff'],FIO_VIVO:['#dc9ba3','#b0a4db'],HOLOGRAFIA:['#7ee3dc','#db9ee8'] };
  const hypeColors: Record<string,[string,string]> = {SCANNER:['#65eddf','#a3c8ff'],XRAY:['#b69bff','#81d5f3'],DOTS:['#7be3de','#c9a4f2'],STARS:['#f5d38b','#e4b9ff'],METRICS:['#91e6b8','#84cfe8']};
  const [first,second] = fashionPreset(background?.compositionPreset)?.palette ?? brandPreset?.palette ?? colors[String(metamorphose)] ?? (auraHype ? hypeColors[String(background?.auraHype)] ?? hypeColors.SCANNER : [hex(background?.color,'#c6b8a4'),'#f1e6d5']);
  const paint = config?.mode === 'COLOR' ? hex(config.color,first) : config?.mode === 'GRADIENT' ? `linear-gradient(135deg,${hex(config.from,first)},${hex(config.to,second)})` : `linear-gradient(135deg,${first},${second})`;
  return { '--card-border-paint':paint,'--card-border-glow':first } as CSSProperties;
}
