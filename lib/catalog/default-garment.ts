import manifest from '@/lib/assets/default-garments.json';
import type { PhotoFraming } from '@/lib/photo-framing';
export const DEFAULT_ASSET_VERSION = manifest.version;
export function defaultGarmentSource(category?: string | null, subcategory?: string | null): string {
 const sub = manifest.subcategories[subcategory as keyof typeof manifest.subcategories];
 return sub && sub.category === category ? sub.url : manifest.categories[category as keyof typeof manifest.categories] ?? manifest.generic;
}
export function defaultGarmentColor(hex?: string | null, color?: string | null): string {
 const value = hex?.trim();
 return value && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : (manifest.colors[color as keyof typeof manifest.colors] ?? '#8c8a87').toLowerCase();
}
/** Frontend-owned route: never prefix with the Java API origin. */
export function defaultGarmentUrl(category?: string | null, subcategory?: string | null, hex?: string | null, color?: string | null, framing: PhotoFraming = 'WHOLE'): string {
 return `/api/catalog/default-asset?${new URLSearchParams({category:category ?? '',subcategory:subcategory ?? '',color:defaultGarmentColor(hex,color),framing,v:DEFAULT_ASSET_VERSION})}`;
}
