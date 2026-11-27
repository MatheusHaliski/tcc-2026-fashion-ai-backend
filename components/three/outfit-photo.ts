"use client";
/*
 * Foto de cada peça do look para o provador (extraída de human-outfit.tsx): a parte do corpo da peça (cima, baixo,
 * inteira, pés), as URLs candidatas e a foto isolada (sem pessoa nem outra roupa), em cache por peça × tentativa.
 */
import { api, mediaUrl } from "@/lib/api/client";
import { loadTexture } from "@/components/three/common";
import type { OutfitItem } from "@/components/three/human-outfit";
import type { GarmentKind } from "@/lib/avatar3d/human/garments";
import { isBundledGarmentPhoto } from "@/lib/tryon/reference-photo";
import { garmentPhotoKey, garmentPhotoUrls, isIsolatedCatalogPhoto } from "@/lib/tryon/garment-photo-source";
import { prepareGarmentPhoto, prepareOutfitPhoto, type OutfitPhotoPart } from "@/lib/avatar3d/human/garment-photo";

export type Img = CanvasImageSource & { width: number; height: number };

/** Garment category remains explicit throughout person/other-outfit isolation. */
export function photoPart(kind: GarmentKind): OutfitPhotoPart {
  if (kind === "dress" || kind === "jumpsuit" || kind === "romper") return "full";
  if (kind === "shoes" || kind === "boots") return "feet";
  if (["pants", "shorts", "bermuda", "culottes", "leggings", "skirt"].includes(kind)) return "lower";
  return "upper";
}

export const photoUrls = garmentPhotoUrls;
// Reusing an item in another look must not rerun segmentation. Failures remain retryable.
const isolatedPhotos = new Map<string, { pending: Promise<Img | null>; createdAt: number }>();
export function outfitPhoto(i: OutfitItem, retry = 0): Promise<Img | null> {
  const key = garmentPhotoKey(photoPart(i.spec.kind), i.piece, retry);
  const cached = isolatedPhotos.get(key);
  if (cached && Date.now() - cached.createdAt < 5 * 60_000) return cached.pending;
  const pending = (async () => {
    for (const url of photoUrls(i.piece, retry)) {
      let temporary: string | null = null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const resolved = url.startsWith("/api/catalog/products/") ? (temporary = await api.blobUrl(url, { signal: controller.signal })) : mediaUrl(url);
        if (controller.signal.aborted) continue;
        const texture = resolved ? await loadTexture(resolved) : null;
        const image = texture?.image as Img | undefined;
        if (!image || controller.signal.aborted) continue;
        // Trust only the exact bundled source that actually loaded; remote images still require isolation.
        // This exact authenticated endpoint refuses raw photographs when isolation
        // is unavailable. Do not segment its verified pixels a second time.
        const isolated = isIsolatedCatalogPhoto(i.piece, url, retry);
        const prepared = isBundledGarmentPhoto(url) || isolated ? prepareGarmentPhoto(image) : await prepareOutfitPhoto(image, photoPart(i.spec.kind));
        if (prepared) return prepared;
      } catch { /* Try the processed alternative, without projecting an unchecked image. */ }
      finally { clearTimeout(timeout); if (temporary) URL.revokeObjectURL(temporary); }
    }
    return null;
  })();
  isolatedPhotos.set(key, { pending, createdAt: Date.now() });
  if (isolatedPhotos.size > 64) isolatedPhotos.delete(isolatedPhotos.keys().next().value!);
  void pending.then(image => { if (!image && isolatedPhotos.get(key)?.pending === pending) isolatedPhotos.delete(key); });
  return pending;
}
