/** Conservative cutout for product photos on a uniform backdrop. Complex photos
 * are rejected instead of projecting their background onto the avatar's clothes.
 * Transparent product cutouts retain their existing alpha and details.
 */
export interface GarmentRaster { width: number; height: number; data: Uint8ClampedArray }

import { cutoutGarment, fillInteriorHoles, splitByHem } from "./garment-photo-cleanup";
export { cutoutGarment, fillInteriorHoles, splitByHem } from "./garment-photo-cleanup";
export { fabricPatch, fabricRows, fabricTile, medoid } from "./fabric-sample";

export function prepareGarmentPhoto(img: CanvasImageSource & { width: number; height: number }, opts: { keep?: "upper" | "lower" | null } = {}): HTMLCanvasElement | null {
  try {
    const c = document.createElement("canvas");
    const scale = Math.min(1, 2048 / Math.max(img.width, img.height));
    c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
    const g = c.getContext("2d", { willReadFrequently: true }); if (!g) return null;
    g.drawImage(img, 0, 0, c.width, c.height);
    const pixels = g.getImageData(0, 0, c.width, c.height);
    const cutout = cutoutGarment(pixels); if (!cutout) return null;
    if (opts.keep) splitByHem(cutout, opts.keep);                   // look inteiro sem esqueleto: fica só a parte pedida
    fillInteriorHoles(cutout);                                       // vazios de oclusão não viram buracos no molde
    pixels.data.set(cutout.data); g.putImageData(pixels, 0, 0);
    return c;
  } catch { return null; }
}

/** A foto reduzida (≤1024 px) como canvas, sem recorte — para o filtro de pessoa quando o fundo não é separável. */
function scaledCanvas(img: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement | null {
  try {
    const c = document.createElement("canvas");
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
    c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
    const g = c.getContext("2d"); if (!g) return null; g.drawImage(img, 0, 0, c.width, c.height); return c;
  } catch { return null; }
}
/** A full-length catalog model cannot be used as an upper-garment texture. */
export function fullBodyUpperPhoto(raster: GarmentRaster): boolean {
  let x0 = raster.width, x1 = -1, y0 = raster.height, y1 = -1;
  for (let y = 0; y < raster.height; y++) for (let x = 0; x < raster.width; x++) {
    if (raster.data[(y * raster.width + x) * 4 + 3] < 240) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return x1 > x0 && (y1 - y0) / (x1 - x0) > 2;
}

export type OutfitPhotoPart = "upper" | "lower" | "full" | "feet";

/** Only a verified, isolated garment can supply the photographic material. A
 * waist-up model is just as unsafe as a full-length model, regardless of aspect
 * ratio. Timeout, missing segmentation and missing pose use the measured fabric
 * color instead; they do not turn an unverified person into a clothing texture.
 */
export function canUseOutfitPhoto(result: import("@/lib/pieces/person-filter").PersonFilterResult, part: OutfitPhotoPart): boolean {
  if (!result.segmentationAvailable || result.people > 1) return false;
  if (!result.personFound) return result.people === 0;
  // Removing skin does not identify which surviving garment is the requested
  // one. Without part evidence, shoes/another garment must not become a print.
  if (!result.garments) return false;
  // With an explicit part, ‘ambiguous’ means both upper and lower garments exist,
  // not that the requested garment was left unfiltered.
  return result.garments.kept === part && (part !== "full" || !result.garments.ambiguous);
}

const outfitPhotoCache = new WeakMap<object, Map<OutfitPhotoPart, Promise<HTMLCanvasElement | null>>>();
export function prepareOutfitPhoto(img: CanvasImageSource & { width: number; height: number }, part: OutfitPhotoPart): Promise<HTMLCanvasElement | null> {
  let cache = outfitPhotoCache.get(img);
  if (!cache) { cache = new Map(); outfitPhotoCache.set(img, cache); }
  const hit = cache.get(part); if (hit) return hit;
  const task = (async () => {
    // fundo separável (recorte com alfa, estúdio liso): recorta aqui. Fundo de estúdio com molduras e sombras (foto de
    // catálogo com modelo): não dá para recortar pelos cantos — a foto segue inteira para o filtro de pessoa, que
    // separa pessoa e cenário pela segmentação; sem pessoa, não há o que aproveitar
    const cutout = prepareGarmentPhoto(img);
    const source = cutout ?? scaledCanvas(img);
    if (!source) return null;
    const hemPart = part === "upper" || part === "lower" ? part : null;
    const attempt = async (): Promise<HTMLCanvasElement | null | "timeout"> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          (async () => {
            const { stripPerson } = await import("@/lib/pieces/person-filter");
            const blob = await new Promise<Blob | null>((resolve) => source.toBlob(resolve, "image/png"));
            if (!blob) return null;
            const result = await stripPerson(new File([blob], "catalog.png", { type: "image/png" }), { keep: part });
            if (!canUseOutfitPhoto(result, part)) return null;
            // sem pessoa: só o recorte serve (a foto crua com cenário não vira textura); look inteiro → barra pela cor
            if (!result.personFound) return cutout ? prepareGarmentPhoto(cutout, { keep: hemPart }) : null;
            const { loadOriented } = await import("@/lib/avatar3d/pipeline");
            // com esqueleto o filtro já deixou só a parte pedida (a barra pela cor/cobertura só tira restos finos da
            // outra peça, p.ex. a saia da mesma estampa); sem esqueleto, é ela que separa as peças
            return prepareGarmentPhoto(await loadOriented(result.file, 1024), { keep: hemPart });
          })(),
          new Promise<"timeout">((resolve) => { timer = setTimeout(() => resolve("timeout"), 45000); }),
        ]);
      } catch { return null; } finally { if (timer) clearTimeout(timer); }
    };
    // a primeira foto da sessão paga o carregamento do segmentador: um timeout vale uma segunda tentativa
    let out = await attempt(); if (out === "timeout") out = await attempt();
    return out === "timeout" ? null : out;
  })();
  cache.set(part, task);
  void task.then(result => { if (!result && cache!.get(part) === task) cache!.delete(part); });
  return task;
}
