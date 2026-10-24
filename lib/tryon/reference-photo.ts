import { ACERVO, acervoLook } from './acervo';
import { DEFAULT_PIECES } from '@/lib/avatar3d/human/default-outfit';

/** Exact immutable local product-only references. An id, alpha channel or /media URL is not proof of isolation. */
const BUNDLED_PHOTOS=new Set([
 ...ACERVO.map(p=>acervoLook(p).imageUrl),
 ...Object.values(DEFAULT_PIECES).map(p=>p.imageUrl),
].filter((url):url is string=>!!url));
export function isBundledGarmentPhoto(loadedUrl:string|null|undefined):boolean {
 return !!loadedUrl&&BUNDLED_PHOTOS.has(loadedUrl);
}
