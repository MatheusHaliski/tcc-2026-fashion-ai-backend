export const AURA_FAMILIES = ['COMMON','ELECTRO','SPLASH','HYPE','METAMORPHOSE'] as const;
export type AuraFamily = typeof AURA_FAMILIES[number];
export interface FashionPreset { id: string; name: string; family: AuraFamily; image: string; palette: [string,string]; source?: string; license?: string }
/** Only locally published raster assets: remote URLs and executable SVG cannot enter the card renderer. */
export function fashionPreset(value: unknown): FashionPreset | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as FashionPreset;
  return /^[a-z0-9-]{1,80}$/.test(p.id ?? '') && typeof p.name === 'string' && p.name.length <= 160 && AURA_FAMILIES.includes(p.family) && p.image === `/aura/fashion-curated/${p.id}.webp` && Array.isArray(p.palette) && p.palette.length === 2 && p.palette.every(c => /^#[a-f0-9]{6}$/i.test(c)) ? p : null;
}
