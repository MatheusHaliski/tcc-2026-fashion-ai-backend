/** Conservative cutout for product photos on a uniform backdrop. Complex photos
 * are rejected instead of projecting their background onto the avatar's clothes.
 * Transparent product cutouts retain their existing alpha and details.
 */
export interface GarmentRaster { width: number; height: number; data: Uint8ClampedArray }

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
