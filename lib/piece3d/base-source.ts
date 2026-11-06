import { mediaUrl } from '@/lib/api/client';
import { loadBasePiece } from '@/lib/atelier3d/base-pieces';
import { EMPTY_DOCUMENT, loadGlb, type LoadedAsset, type SceneDocument } from '@/lib/atelier3d/document';
import type { Customization, EditSource } from './customization';

/**
 * Escolha da base da edição. Toda peça com categoria conhecida tem uma peça base da subcategoria (GLB publicado pela
 * equipe ou base procedural); a pessoa modela por cima dela, ou do GLB próprio da peça quando existe. A personalização
 * gravada diz sobre qual base foi feita, por isso o editor reabre na mesma base.
 */
export type AssetOrigin = 'PIECE_GLB' | 'STATIC_GLB' | 'PROCEDURAL';
export interface LoadedSource { asset: LoadedAsset; origin: AssetOrigin; bytes: ArrayBuffer }

export function availableSources(info: Customization): EditSource[] {
  const out: EditSource[] = [];
  if (info.basePiece?.available) out.push('base');
  if (info.baseModelUrl) out.push('glb');
  return out;
}

export function baseKeyFor(info: Customization, source: EditSource): string | null {
  return source === 'glb' ? info.baseModelUrl : info.basePiece?.key ?? null;
}

/** Reabre sobre a base gravada; sem gravação, o GLB da peça tem prioridade e a peça base é o padrão. */
export function defaultSource(info: Customization): EditSource | null {
  const sources = availableSources(info);
  if (!sources.length) return null;
  const saved = sources.find((source) => info.savedBaseKey && baseKeyFor(info, source) === info.savedBaseKey);
  return saved ?? (sources.includes('glb') ? 'glb' : 'base');
}

/** O documento gravado só vale sobre a base em que foi feito; em outra base a edição começa vazia. */
export function documentFor(info: Customization, source: EditSource): SceneDocument {
  return info.savedBaseKey && baseKeyFor(info, source) === info.savedBaseKey ? structuredClone(info.document) : structuredClone(EMPTY_DOCUMENT);
}

export async function loadSource(info: Customization, source: EditSource, fetchFn: typeof fetch = fetch): Promise<LoadedSource> {
  if (source === 'glb') {
    if (!info.baseModelUrl) throw new Error('GLB');
    const response = await fetchFn(mediaUrl(info.baseModelUrl) ?? info.baseModelUrl);
    if (!response.ok) throw new Error('GLB');
    const bytes = await response.arrayBuffer();
    return { asset: await loadGlb(bytes), origin: 'PIECE_GLB', bytes };
  }
  const base = await loadBasePiece(info.category ?? '', info.subcategory ?? '', /^#[0-9a-f]{6}$/i.test(info.colorHex ?? '') ? info.colorHex : '#999999', fetchFn);
  return { asset: await loadGlb(base.bytes), origin: base.source, bytes: base.bytes };
}
