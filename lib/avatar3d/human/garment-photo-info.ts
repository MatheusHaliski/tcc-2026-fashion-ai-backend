/*
 * Avatar 3D (RF40) / Provador — o que a foto da peça diz para a projeção: máscara (recorte ou fundo liso), caixa,
 * larguras por altura, gola, marcos da silhueta, pernas separadas e as mangas caídas ao lado do tronco.
 */
import * as THREE from "three";
import { silhouetteLandmarks, separatedLegRows, type GarmentLandmarks, type PhotoLegRow } from "./photo-landmarks";

export interface PhotoInfo {
  torsoWidthAt?: (fy: number) => { x0: number; x1: number } | null;
  landmarks?: GarmentLandmarks | null;
  legRows?: PhotoLegRow[];
  width: number; height: number; box: { x0: number; y0: number; x1: number; y1: number }; widthAt: (fy: number) => { x0: number; x1: number } | null;
  collarRow: number | null;
  neckDrop: number | null;
  cutout: boolean; backdrop: [number, number, number] | null;
  isBackView?: boolean;
}

export const BACKDROP_TOLERANCE = 32;
export const isBackdrop = (d: Uint8ClampedArray, o: number, backdrop: [number, number, number] | null): boolean =>
  !!backdrop && Math.hypot(d[o] - backdrop[0], d[o + 1] - backdrop[1], d[o + 2] - backdrop[2]) <= BACKDROP_TOLERANCE;

export function srgbBytes(color: string): [number, number, number] {
  const h = new THREE.Color(color).getHex();
  return [(h >> 16) & 255, (h >> 8) & 255, h & 255];
}

export interface PhotoMask { W: number; H: number; data: Uint8ClampedArray; mask: Uint8Array; cutout: boolean; backdrop: [number, number, number] | null }

export function photoMask(img: CanvasImageSource & { width: number; height: number }, W = 256): PhotoMask | null {
  if (typeof document === "undefined") return null;
  const H = Math.max(1, Math.round((W * img.height) / img.width));
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d", { willReadFrequently: true }); if (!g) return null;
  g.drawImage(img, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
  const n = W * H; const mask = new Uint8Array(n); let transparent = 0;
  for (let i = 0; i < n; i++) if (d[i * 4 + 3] <= 32) transparent++;
  if (transparent >= n * 0.01) {
    for (let i = 0; i < n; i++) mask[i] = d[i * 4 + 3] > 32 ? 1 : 0;
    return { W, H, data: d, mask, cutout: true, backdrop: null };
  }
  const ring: number[][] = [[], [], []];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) { const o = (y * W + x) * 4; ring[0].push(d[o]); ring[1].push(d[o + 1]); ring[2].push(d[o + 2]); }
  const med = (arr: number[]) => { const v = [...arr].sort((a, b) => a - b); return v[v.length >> 1]; };
  const backdrop: [number, number, number] = [med(ring[0]), med(ring[1]), med(ring[2])];
  let on = 0;
  for (let i = 0; i < n; i++) { const far = d[i * 4 + 3] > 32 && !isBackdrop(d, i * 4, backdrop); mask[i] = far ? 1 : 0; on += far ? 1 : 0; }
  if (on > n * 0.98 || on < n * 0.002) { for (let i = 0; i < n; i++) mask[i] = d[i * 4 + 3] > 32 ? 1 : 0; return { W, H, data: d, mask, cutout: true, backdrop: null }; }
  return { W, H, data: d, mask, cutout: false, backdrop };
}

export function photoInfo(img: CanvasImageSource & { width: number; height: number }): PhotoInfo | null {
  const pm = photoMask(img); if (!pm) return null;
  const { W, H, data: d, mask } = pm;
  const rows = new Uint16Array(H), cols = new Uint16Array(W);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { rows[y]++; cols[x]++; }
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let x = 0; x < W; x++) if (cols[x] >= 2) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  for (let y = 0; y < H; y++) if (rows[y] >= 2) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0 || y1 < 0) return null;
  const k = img.width / W;
  const px = (x: number, y: number) => { const o = (y * W + x) * 4; return mask[y * W + x] ? [d[o], d[o + 1], d[o + 2]] : null; };
  const cx0 = Math.round(x0 + (x1 - x0) * 0.45), cx1 = Math.round(x0 + (x1 - x0) * 0.55);
  const body: number[][] = []; for (let y = Math.round(y0 + (y1 - y0) * 0.35); y < y0 + (y1 - y0) * 0.6; y++) for (let x = cx0; x <= cx1; x++) { const p = px(x, y); if (p) body.push(p); }
  let collarRow: number | null = null;
  if (body.length > 10) {
    const med = [0, 1, 2].map((i) => body.map((p) => p[i]).sort((a, b) => a - b)[body.length >> 1]);
    let last = -1, gap = 0;
    for (let y = y0; y < y0 + (y1 - y0) * 0.22; y++) {
      let diff = 0, cnt = 0;
      for (let x = cx0; x <= cx1; x++) { const p = px(x, y); if (!p) { diff++; cnt++; continue; } cnt++; if (Math.hypot(p[0] - med[0], p[1] - med[1], p[2] - med[2]) > 55) diff++; }
      if (cnt && diff / cnt > 0.5) { last = y; gap = 0; } else if (last >= 0 && ++gap > 2) break;
    }
    if (last > y0) collarRow = (last + 1 - y0) / Math.max(1, y1 - y0);
  }
  const topAt = (a: number, b: number, deepest: boolean): number | null => {
    const xa = Math.round(x0 + (x1 - x0) * a), xb = Math.round(x0 + (x1 - x0) * b); let best: number | null = null;
    for (let x = xa; x <= xb; x++) for (let y = y0; y <= y1; y++) if (mask[y * W + x]) { best = best === null ? y : deepest ? Math.max(best, y) : Math.min(best, y); break; }
    return best;
  };
  let neckDrop: number | null = null;
  if (y1 - y0 >= 24 && x1 - x0 >= 24) {
    const mid = topAt(0.44, 0.56, true), l = topAt(0.2, 0.32, false), rr = topAt(0.68, 0.8, false);
    if (mid !== null && l !== null && rr !== null) neckDrop = Math.max(0, (mid - Math.min(l, rr)) / Math.max(1, y1 - y0));
  }
  
  const isBackView = collarRow === null || (neckDrop !== null && neckDrop < 0.02);

  return {
    landmarks: (() => { const points = silhouetteLandmarks(mask, W, H, { x0, y0, x1, y1 }); if (!points) return null;
      return Object.fromEntries(Object.entries(points).map(([name, p]) => [name, { x: p.x * k, y: p.y * k }])) as unknown as GarmentLandmarks; })(),
    legRows: separatedLegRows(mask,W,H,{x0,y0,x1,y1}).map(row=>({y:row.y*k,left:{x0:row.left.x0*k,x1:row.left.x1*k},right:{x0:row.right.x0*k,x1:row.right.x1*k}})),
    collarRow: collarRow ?? 0.03, neckDrop, cutout: pm.cutout, backdrop: pm.backdrop, isBackView,
    width: img.width, height: img.height, box: { x0: x0 * k, y0: y0 * k, x1: (x1 + 1) * k, y1: (y1 + 1) * k },
    widthAt: (fy) => {
      const y = Math.min(H - 1, Math.round(y0 + (y1 - y0) * fy)); let a = -1, b = -1;
      for (let x = 0; x < W; x++) if (mask[y * W + x]) { if (a < 0) a = x; b = x; }
      return a < 0 ? null : { x0: a * k, x1: (b + 1) * k };
    },
    torsoWidthAt: (fy) => {
      const y = Math.min(H - 1, Math.max(0, Math.round(y0 + (y1 - y0) * fy)));
      const points = silhouetteLandmarks(mask, W, H, { x0, y0, x1, y1 });
      if (!points) return null;
      const center = Math.round((points.neckline.x + points.hem.x) / 2);
      if (!mask[y * W + center]) return null;
      let a = center, b = center;
      while (a > 0 && mask[y * W + a - 1]) a--;
      while (b < W - 1 && mask[y * W + b + 1]) b++;
      return b - a < 8 ? null : { x0: a * k, x1: (b + 1) * k };
    },
  };
}

export interface SleeveSource { isSleeve: (v: number) => boolean; along: (v: number) => number }
export interface SleeveSpan { fy: number; x0: number; x1: number }

export function photoSleeves(photo: PhotoInfo): { left: SleeveSpan[] | null; right: SleeveSpan[] | null } | null {
  if (!photo.torsoWidthAt) return null;
  const bw = photo.box.x1 - photo.box.x0; const left: SleeveSpan[] = [], right: SleeveSpan[] = [];
  for (let i = 0; i <= 50; i++) {
    const fy = i / 50; const full = photo.widthAt(fy); const torso = photo.torsoWidthAt(fy);
    if (!full || !torso) continue;
    if (torso.x0 - full.x0 > bw * 0.03) left.push({ fy, x0: full.x0, x1: torso.x0 });
    if (full.x1 - torso.x1 > bw * 0.03) right.push({ fy, x0: torso.x1, x1: full.x1 });
  }
  const usable = (rows: SleeveSpan[]) => rows.length >= 2 && rows[rows.length - 1].fy - rows[0].fy >= 0.15
    && rows.every((r, k) => k === 0 || r.fy - rows[k - 1].fy <= 0.1) ? rows : null;
  const l = usable(left), r = usable(right);
  return l || r ? { left: l, right: r } : null;
}
