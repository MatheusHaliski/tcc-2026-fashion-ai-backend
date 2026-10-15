export const AURA_FAMILIES = ['COMMON','ELECTRO','SPLASH','HYPE','METAMORPHOSE'] as const;
export type AuraFamily = typeof AURA_FAMILIES[number];
export interface FashionPreset { id: string; name: string; family: AuraFamily; image: string; video?: string; palette: [string,string]; source?: string; license?: string }
/** Only locally published raster assets: remote URLs and executable SVG cannot enter the card renderer. */
export function fashionPreset(value: unknown): FashionPreset | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as FashionPreset;
  return /^[a-z0-9-]{1,80}$/.test(p.id ?? '') && typeof p.name === 'string' && p.name.length <= 160 && AURA_FAMILIES.includes(p.family) && p.image === `/aura/fashion-curated/${p.id}.webp` && (!p.video || p.video === `/aura/fashion-curated/${p.id}.mp4`) && Array.isArray(p.palette) && p.palette.length === 2 && p.palette.every(c => /^#[a-f0-9]{6}$/i.test(c)) ? p : null;
}

const BRAND_COLORS: Record<string,string> = { preto:'#0b0b0b',black:'#0b0b0b',branco:'#f3f3f3',white:'#f3f3f3',laranja:'#f4511e',orange:'#f4511e',volt:'#d7ff1f',amarelo:'#d7ff1f',azul:'#1e4fd8',blue:'#1e4fd8',vermelho:'#d62828',red:'#d62828',verde:'#0f7a4a',green:'#0f7a4a',bege:'#d8c3a5',beige:'#d8c3a5',cinza:'#7c7f86',gray:'#7c7f86',grey:'#7c7f86' };
const norm = (v?: string | null) => (v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');
const rgb = (h: string) => [1,3,5].map(i => parseInt(h.slice(i,i+2),16));
/** AURA Metamorfose: detects brand + color of the piece and ranks the 'brand-<brand>-<color>' presets (best first). */
export function suggestBrandAuras(presets: FashionPreset[], brandName?: string | null, colorHex?: string | null, colorName?: string | null): FashionPreset[] {
  const brand = norm(brandName); if (!brand) return [];
  const mine = presets.filter(p => p.family === 'METAMORPHOSE' && p.id.startsWith('brand-') && brand.includes(norm(p.id.slice(6).split('-').slice(0, p.id.startsWith('brand-new-') ? 2 : 1).join(''))));
  const named = BRAND_COLORS[norm(colorName)] ?? (colorHex && /^#[\da-f]{6}$/i.test(colorHex) ? colorHex : null);
  if (!named) return mine;
  const target = rgb(named), dist = (p: FashionPreset) => { const c = rgb(p.palette[0]); return c.reduce((a,v,i) => a + (v-target[i])**2, 0); };
  return [...mine].sort((a,b) => dist(a)-dist(b));
}
