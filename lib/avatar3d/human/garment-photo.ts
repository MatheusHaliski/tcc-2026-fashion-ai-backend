/** Conservative cutout for product photos on a uniform backdrop. Complex photos
 * are rejected instead of projecting their background onto the avatar's clothes.
 * Transparent product cutouts retain their existing alpha and details.
 */
export interface GarmentRaster { width: number; height: number; data: Uint8ClampedArray }

/** A repeated textile sample, never the complete garment, label or background. */
export function fabricTile(raster: GarmentRaster): { x: number; y: number; width: number; height: number } | null {
  const { width: w, height: h, data } = raster;
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 240) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const size = Math.min(128, Math.floor((x1 - x0) * 0.28), Math.floor((y1 - y0) * 0.25));
  if (size < 24) return null;
  for (const fy of [0.56, 0.72]) for (const fx of [0.22, 0.6]) {
    const py = Math.round(y0 + (y1 - y0) * fy);
    // Flat-lay sleeves widen the global bounds. Sample the actual torso row,
    // otherwise every candidate straddles its transparent sides.
    let rowLeft = w, rowRight = -1;
    for (let x = 0; x < w; x++) if (data[(py * w + x) * 4 + 3] > 240) { rowLeft = Math.min(rowLeft, x); rowRight = x; }
    if (rowRight - rowLeft < size) continue;
    const px = Math.round(rowLeft + (rowRight - rowLeft - size) * fx);
    if (px + size > w || py + size > h) continue;
    const mean = [0, 0, 0]; let opaque = true;
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) {
      const k = ((py + y) * w + px + x) * 4;
      if (data[k + 3] < 240) opaque = false;
      for (let c = 0; c < 3; c++) mean[c] += data[k + c];
    }
    if (!opaque) continue;
    const samples = Math.ceil(size / 2) ** 2; for (let c = 0; c < 3; c++) mean[c] /= samples;
    let variance = 0;
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) for (let c = 0; c < 3; c++) {
      variance += (data[((py + y) * w + px + x) * 4 + c] - mean[c]) ** 2;
    }
    variance /= samples * 3;
    if (variance < 100) continue; // plain fabric: keep the measured color, don't repeat photographic shadows
    const period = (axis: 0 | 1) => {
      const errors: number[] = [];
      for (let lag = 3; lag <= Math.floor(size / 2) + 1; lag++) {
        let error = 0, n = 0;
        for (let y = 0; y < size - (axis === 1 ? lag : 0); y++) for (let x = 0; x < size - (axis === 0 ? lag : 0); x++) {
          const a = ((py + y) * w + px + x) * 4;
          const b = a + (axis === 0 ? lag * 4 : lag * w * 4);
          for (let c = 0; c < 3; c++) error += (data[a + c] - data[b + c]) ** 2;
          n += 3;
        }
        errors[lag] = error / n;
      }
      for (let lag = 4; lag <= Math.floor(size / 2); lag++) {
        if (errors[lag] < variance * 0.22 && errors[lag] + variance * 0.02 < Math.min(errors[lag - 1], errors[lag + 1])) return lag;
      }
      return null;
    };
    const width = period(0), height = period(1);
    if (width && height) return { x: px, y: py, width, height };
  }
  return null;
}

/** Robust wash/color at each fabric height, excluding the backdrop and the gap between trouser legs. */
export function fabricRows(raster: GarmentRaster): { y: number; rgb: [number, number, number] }[] {
  const { width: w, height: h, data } = raster;
  const out: { y: number; rgb: [number, number, number] }[] = [];
  const step = Math.max(1, Math.floor(h / 64));
  for (let y = 0; y < h; y += step) {
    const channels: number[][] = [[], [], []];
    for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 160))) {
      const k = (y * w + x) * 4;
      if (data[k + 3] < 240) continue;
      for (let c = 0; c < 3; c++) channels[c].push(data[k + c]);
    }
    if (channels[0].length < 8) continue;
    out.push({ y, rgb: channels.map((channel) => channel.sort((a, b) => a - b)[channel.length >> 1]) as [number, number, number] });
  }
  return out;
}

export function cutoutGarment(raster: GarmentRaster): GarmentRaster | null {
  const { width: w, height: h, data } = raster;
  if (w < 8 || h < 8 || data.length !== w * h * 4) return null;
  let transparent = 0;
  for (let p = 3; p < data.length; p += 4) if (data[p] < 128) transparent++;
  if (transparent > w * h * 0.05) return raster;
  const corners = [0, w - 1, (h - 1) * w, h * w - 1];
  const bg = [0, 1, 2].map((c) => corners.reduce((sum, p) => sum + data[p * 4 + c], 0) / 4);
  const distance = (p: number) => Math.hypot(...bg.map((v, c) => data[p * 4 + c] - v));
  if (corners.some((p) => distance(p) > 24)) return null;
  const seen = new Uint8Array(w * h), queue = new Int32Array(w * h);
  let count = 0, read = 0;
  const visit = (p: number) => {
    if (seen[p]) return;
    seen[p] = 1;
    if (data[p * 4 + 3] < 128 || distance(p) < 38) queue[count++] = p;
  };
  for (let x = 0; x < w; x++) { visit(x); visit((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { visit(y * w); visit(y * w + w - 1); }
  const result = new Uint8ClampedArray(data);
  while (read < count) {
    const p = queue[read++]; result[p * 4 + 3] = 0;
    const x = p % w, y = Math.floor(p / w);
    if (x > 0) visit(p - 1); if (x < w - 1) visit(p + 1);
    if (y > 0) visit(p - w); if (y < h - 1) visit(p + w);
  }
  const coverage = 1 - count / (w * h);
  if (coverage < 0.04 || coverage > 0.9) return null;
  return { width: w, height: h, data: result };
}

export function prepareGarmentPhoto(img: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement | null {
  try {
    const c = document.createElement("canvas");
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
    c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
    const g = c.getContext("2d", { willReadFrequently: true }); if (!g) return null;
    g.drawImage(img, 0, 0, c.width, c.height);
    const pixels = g.getImageData(0, 0, c.width, c.height);
    const cutout = cutoutGarment(pixels); if (!cutout) return null;
    pixels.data.set(cutout.data); g.putImageData(pixels, 0, 0);
    return c;
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

const outfitPhotoCache = new WeakMap<object, Map<string, Promise<HTMLCanvasElement | null>>>();
/** Reuse local person segmentation for full-length upper-piece catalog photos.
 * If the selected garment cannot be isolated, use the piece's fabric color instead of painting the model onto it.
 */
export function prepareOutfitPhoto(img: CanvasImageSource & { width: number; height: number }, upper: boolean): Promise<HTMLCanvasElement | null> {
  let cache = outfitPhotoCache.get(img);
  if (!cache) { cache = new Map(); outfitPhotoCache.set(img, cache); }
  const key = upper ? "upper" : "other";
  const hit = cache.get(key); if (hit) return hit;
  const task = (async () => {
    const cutout = prepareGarmentPhoto(img);
    if (!cutout || !upper) return cutout;
    const pixels = cutout.getContext("2d", { willReadFrequently: true })?.getImageData(0, 0, cutout.width, cutout.height);
    if (!pixels || !fullBodyUpperPhoto(pixels)) return cutout;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          const { stripPerson } = await import("@/lib/pieces/person-filter");
          const blob = await new Promise<Blob | null>((resolve) => cutout.toBlob(resolve, "image/png"));
          if (!blob) return null;
          const result = await stripPerson(new File([blob], "catalog.png", { type: "image/png" }), { keep: "upper" });
          if (!result.personFound || result.garments?.kept !== "upper" || result.garments.ambiguous) return null;
          const { loadOriented } = await import("@/lib/avatar3d/pipeline");
          return prepareGarmentPhoto(await loadOriented(result.file, 1024));
        })(),
        new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 5000); }),
      ]);
    } catch { return null; } finally { if (timer) clearTimeout(timer); }
  })();
  cache.set(key, task); return task;
}
