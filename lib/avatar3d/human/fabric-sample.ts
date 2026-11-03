/*
 * Foto da peça — amostras do tecido para costas e laterais: ladrilho periódico (fabricTile), retalho de trama
 * (fabricPatch), cor por altura (fabricRows) e a cor "mediana" que existe na foto (medoid).
 */
import type { GarmentRaster } from "./garment-photo";

/** A repeated textile sample, never the complete garment, label or background. */
export function fabricTile(raster: GarmentRaster, range: { fromX?: number; toX?: number } = {}): { x: number; y: number; width: number; height: number } | null {
  const { width: w, height: h, data } = raster;
  const startX = Math.max(0, Math.floor(range.fromX ?? 0)), endX = Math.min(w, Math.ceil(range.toX ?? w));
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = startX; x < endX; x++) if (data[(y * w + x) * 4 + 3] > 240) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  // A small window cannot contain two repeats of broad plaid. Try a larger
  // torso-only window before falling back to wash colours; never tile the whole photo.
  const sizes = [...new Set([
    Math.min(128, Math.floor((x1 - x0) * .28), Math.floor((y1 - y0) * .25)),
    Math.min(256, Math.floor((x1 - x0) * .85), Math.floor((y1 - y0) * .4)),
  ])].filter(size => size >= 24);
  for (const size of sizes) for (const fy of [0.56, 0.72]) for (const fx of [0.22, 0.6]) {
    const py = Math.round(y0 + (y1 - y0) * fy);
    // Flat-lay sleeves widen the global bounds. Sample the actual torso row,
    // otherwise every candidate straddles its transparent sides.
    let rowLeft = w, rowRight = -1;
    for (let x = startX; x < endX; x++) if (data[(py * w + x) * 4 + 3] > 240) { rowLeft = Math.min(rowLeft, x); rowRight = x; }
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
        if (errors[lag] < variance * 0.22 && errors[lag] + variance * 0.002 < Math.min(errors[lag - 1], errors[lag + 1])) return lag;
      }
      // Stripes repeat in one direction and are constant in the other. A plain
      // axis is not itself evidence of a pattern: require a real period on its mate.
      return errors.slice(3).every(error => error < variance * .005) ? 1 : null;
    };
    const width = period(0), height = period(1);
    if (width && height && (width > 1 || height > 1)) return { x: px, y: py, width, height };
  }
  return null;
}

/**
 * Cor "mediana" de um conjunto de pixels como VETOR: a mediana canal a canal de um conjunto bimodal (metade azul, metade
 * laranja) inventa uma cor que não existe na foto (verde); aqui vale o pixel real mais perto das medianas por canal.
 */
export function medoid(px: ArrayLike<number>[]): [number, number, number] {
  const n = px.length; if (!n) return [0, 0, 0];
  const m = [0, 1, 2].map((i) => Array.from(px, (p) => p[i]).sort((a, b) => a - b)[n >> 1]);
  let best = 0, bd = Infinity;
  for (let k = 0; k < n; k++) { const d = (px[k][0] - m[0]) ** 2 + (px[k][1] - m[1]) ** 2 + (px[k][2] - m[2]) ** 2; if (d < bd) { bd = d; best = k; } }
  return [px[best][0], px[best][1], px[best][2]];
}

/** Robust wash/color at each fabric height, excluding the backdrop and the gap between trouser legs. */
export function fabricRows(raster: GarmentRaster, opts: { fromY?: number; toY?: number; fromX?: number; toX?: number; inset?: .1 | .25 } = {}): { y: number; rgb: [number, number, number] }[] {
  const { width: w, height: h, data } = raster;
  const out: { y: number; rgb: [number, number, number] }[] = [];
  const step = Math.max(1, Math.floor(h / 64));
  // só o MIOLO de cada linha (metade central do que a linha tem de peça) e só entre a gola e a barra: os punhos nas
  // pontas e a gola em cima tingiam o painel do tecido (costas, laterais e mangas) com a cor dos acabamentos
  const y0 = Math.max(0, Math.floor(opts.fromY ?? 0)), y1 = Math.min(h, Math.ceil(opts.toY ?? h));
  const x0 = Math.max(0, Math.floor(opts.fromX ?? 0)), x1 = Math.min(w, Math.ceil(opts.toX ?? w));
  for (let y = y0; y < y1; y += step) {
    let a = -1, b = -1;
    for (let x = x0; x < x1; x++) if (data[(y * w + x) * 4 + 3] >= 240) { if (a < 0) a = x; b = x; }
    if (a < 0) continue;
    // Ranges also describe upperwear halves: do not mistake them for legs.
    // Legs explicitly opt into a wider sample so a pocket logo does not dominate.
    const inset = opts.inset ?? .25;
    const xa = Math.round(a + (b - a) * inset), xb = Math.round(a + (b - a) * (1 - inset));
    const channels: number[][] = [[], [], []];
    for (let x = xa; x <= xb; x += Math.max(1, Math.floor((xb - xa) / 80))) {
      const k = (y * w + x) * 4;
      if (data[k + 3] < 240) continue;
      for (let c = 0; c < 3; c++) channels[c].push(data[k + c]);
    }
    if (channels[0].length < 8) continue;
    out.push({ y, rgb: medoid(channels[0].map((_, k) => [channels[0][k], channels[1][k], channels[2][k]])) });
  }
  return out;
}

/**
 * Trama real da peça para as costas e laterais quando não há ladrilho periódico (fabricTile): a janela OPACA de menor
 * variância entre as que têm textura (variância ≥ 100), desde que ao menos três janelas tenham textura parecida
 * (até 4× a menor) — uma só janela texturizada num tecido liso é um logo ou uma estampa, não trama.
 */
export function fabricPatch(raster: GarmentRaster, range: { fromX?: number; toX?: number } = {}): { x: number; y: number; width: number; height: number } | null {
  const { width: w, height: h, data } = raster;
  const startX = Math.max(0, Math.floor(range.fromX ?? 0)), endX = Math.min(w, Math.ceil(range.toX ?? w));
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = startX; x < endX; x++) if (data[(y * w + x) * 4 + 3] > 240) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const size = Math.min(96, Math.floor((x1 - x0) * .3), Math.floor((y1 - y0) * .25));
  if (size < 24) return null;
  const candidates: { x: number; y: number; variance: number }[] = [];
  for (const fy of [0.4, 0.55, 0.7]) for (const fx of [0.2, 0.5, 0.8]) {
    const py = Math.round(y0 + (y1 - y0) * fy);
    let rowLeft = w, rowRight = -1;
    for (let x = startX; x < endX; x++) if (data[(py * w + x) * 4 + 3] > 240) { rowLeft = Math.min(rowLeft, x); rowRight = x; }
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
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) for (let c = 0; c < 3; c++) variance += (data[((py + y) * w + px + x) * 4 + c] - mean[c]) ** 2;
    variance /= samples * 3;
    if (variance < 100) continue;
    // trama é alta frequência: suavizada em blocos 4×4 a variância despenca; um logo ou estampa grande (áreas lisas e
    // bordas largas) mantém quase toda a variância depois de suavizar — não é trama, não vira ladrilho
    const block = 4, nb = Math.floor(size / block); let low = 0;
    for (let by = 0; by < nb; by++) for (let bx = 0; bx < nb; bx++) {
      const sum = [0, 0, 0];
      for (let y = 0; y < block; y++) for (let x = 0; x < block; x++) { const k = ((py + by * block + y) * w + px + bx * block + x) * 4; for (let c = 0; c < 3; c++) sum[c] += data[k + c]; }
      for (let c = 0; c < 3; c++) low += (sum[c] / (block * block) - mean[c]) ** 2;
    }
    low /= nb * nb * 3;
    if (low / variance > 0.5) continue;
    candidates.push({ x: px, y: py, variance });
  }
  if (candidates.length < 3) return null;
  candidates.sort((a, b) => a.variance - b.variance);
  if (candidates.filter((c) => c.variance <= candidates[0].variance * 4).length < 3) return null;
  return { x: candidates[0].x, y: candidates[0].y, width: size, height: size };
}
