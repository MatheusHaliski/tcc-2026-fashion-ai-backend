/*
 * Avatar 3D (RF40) / Provador — cores lidas da foto da peça: calçado (cabedal, sola, detalhe), acabamentos (barra,
 * punhos), tecido e ribana da gola.
 */
import * as THREE from "three";
import { medoid } from "./garment-photo";
import { isBackdrop, photoInfo, srgbBytes, type PhotoInfo } from "./garment-photo-info";

export function shoeColors(img: (CanvasImageSource & { width: number; height: number }) | null | undefined, fallback?: string | null, info?: PhotoInfo | null): { upper: string; sole: string; accent?: string | null } {
  const base = fallback && /^#[0-9a-f]{6}$/i.test(fallback) ? fallback : "#5a5a5a";
  if (!img || typeof document === "undefined") return { upper: base, sole: "#e8e4dc" };
  const W = 96, H = Math.max(8, Math.round((96 * img.height) / img.width));
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d", { willReadFrequently: true }); if (!g) return { upper: base, sole: "#e8e4dc" };
  g.drawImage(img, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
  const backdrop = info?.backdrop ?? null;
  let y0 = H, y1 = -1; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; if (d[o + 3] > 128 && !isBackdrop(d, o, backdrop)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
  if (y1 < 0) return { upper: base, sole: "#e8e4dc" };
  const hgt = y1 - y0;
  const up = dominants(d, W, [y0 + Math.round(hgt * 0.35), y0 + Math.round(hgt * 0.75)], false, backdrop);
  const top = dominants(d, W, [y0, y0 + Math.round(hgt * 0.35)], false, backdrop);
  const upper = up[0] ?? base;
  const accent = [...up.slice(1), ...top].find((c2) => colorDist(c2, upper) > 90) ?? null;
  return { upper, sole: dominants(d, W, [y1 - Math.max(1, Math.round(hgt * 0.14)), y1], true, backdrop)[0] ?? "#e8e4dc", accent };
}

function colorDist(a: string, b: string): number {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

function dominants(d: Uint8ClampedArray, W: number, ys: [number, number], allowNeutral: boolean, backdrop: [number, number, number] | null = null): string[] {
  const bins = new Map<number, { w: number; r: number; g: number; b: number }>();
  for (let y = ys[0]; y <= ys[1]; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4; if (d[o + 3] < 200 || isBackdrop(d, o, backdrop)) continue;
    const r = d[o], gg = d[o + 1], b = d[o + 2]; const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); const sat = mx ? (mx - mn) / mx : 0; const l = (mx + mn) / 510;
    if (!allowNeutral && (l > 0.9 || l < 0.08)) continue;
    let hue = 0; if (mx !== mn) { hue = mx === r ? ((gg - b) / (mx - mn)) % 6 : mx === gg ? (b - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4; }
    const key = sat < 0.15 ? 100 + Math.min(4, Math.floor(l * 5)) : Math.floor(((hue + 6) % 6) * 2);
    const e = bins.get(key) ?? { w: 0, r: 0, g: 0, b: 0 };
    e.w += 1; e.r += r; e.g += gg; e.b += b; bins.set(key, e);
  }
  return [...bins.values()].filter((e) => e.w >= 3).sort((p, q) => q.w - p.w)
    .map((e) => "#" + [e.r, e.g, e.b].map((v) => Math.round(v / e.w).toString(16).padStart(2, "0")).join(""));
}

export function trimColors(img: (CanvasImageSource & { width: number; height: number }) | null | undefined, fabric: string, info?: PhotoInfo | null): { hem: string | null; cuff: string | null; cuffLeft: string | null; cuffRight: string | null } {
  const empty = { hem: null, cuff: null, cuffLeft: null, cuffRight: null };
  if (!img || typeof document === "undefined") return empty;
  try {
    const W = 128, H = Math.max(8, Math.round((128 * img.height) / img.width));
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d", { willReadFrequently: true }); if (!g) return empty;
    g.drawImage(img, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
    const backdrop = info?.backdrop ?? null;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; if (d[o + 3] > 128 && !isBackdrop(d, o, backdrop)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
    if (x1 < 0) return empty;
    const fr = srgbBytes(fabric);
    const med = (xs: [number, number], ys: [number, number]) => {
      const px: number[][] = [];
      for (let y = Math.max(0, Math.floor(ys[0])); y <= Math.min(H - 1, Math.ceil(ys[1])); y++) for (let x = Math.max(0, Math.floor(xs[0])); x <= Math.min(W - 1, Math.ceil(xs[1])); x++) {
        const o = (y * W + x) * 4; if (d[o + 3] > 200 && !isBackdrop(d, o, backdrop)) px.push([d[o], d[o + 1], d[o + 2]]);
      }
      if (px.length < 4) return null;
      const m = medoid(px);
      return Math.hypot(m[0] - fr[0], m[1] - fr[1], m[2] - fr[2]) < 45 ? null : "#" + m.map((v) => v.toString(16).padStart(2, "0")).join("");
    };
    const bw = x1 - x0, bh = y1 - y0;
    let hem = null as string | null; for (let k = 1; k <= 3 && !hem; k++) hem = med([x0 + bw * 0.3, x0 + bw * 0.7], [y1 - k * 1.2, y1 - (k - 1) * 1.2]);
    const cuffL = med([x0, x0 + bw * 0.04], [y0 + bh * 0.05, y0 + bh * 0.45]); const cuffR = med([x1 - bw * 0.04, x1], [y0 + bh * 0.05, y0 + bh * 0.45]);
    return { hem, cuff: cuffL ?? cuffR, cuffLeft: cuffL, cuffRight: cuffR };
  } catch { return empty; }
}

export function fabricColor(img: (CanvasImageSource & { width: number; height: number }) | null | undefined, fallback?: string | null, info?: PhotoInfo | null): string {
  const base = fallback && /^#[0-9a-f]{6}$/i.test(fallback) ? fallback : "#8a8a8a";
  if (!img || typeof document === "undefined") return base;
  try {
    const c = document.createElement("canvas"); c.width = 48; c.height = 48; const g = c.getContext("2d", { willReadFrequently: true }); if (!g) return base;
    if (info && info.box.x1 - info.box.x0 >= 4 && info.box.y1 - info.box.y0 >= 4) g.drawImage(img, info.box.x0, info.box.y0, info.box.x1 - info.box.x0, info.box.y1 - info.box.y0, 0, 0, 48, 48);
    else g.drawImage(img, 0, 0, 48, 48);
    const d = g.getImageData(8, 8, 32, 32).data; const ch: number[][] = [[], [], []];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && !isBackdrop(d, i, info?.backdrop ?? null)) { ch[0].push(d[i]); ch[1].push(d[i + 1]); ch[2].push(d[i + 2]); }
    if (ch[0].length < 20) return base;
    const m = medoid(ch[0].map((_, k) => [ch[0][k], ch[1][k], ch[2][k]]));
    return "#" + m.map((v) => v.toString(16).padStart(2, "0")).join("");
  } catch { return base; }
}

export function ribColor(img: (CanvasImageSource & { width: number; height: number }) | null | undefined, fabric: string, given?: PhotoInfo | null, opts: { wide?: boolean } = {}): string {
  const darker = () => { const f = new THREE.Color(fabric); f.multiplyScalar(0.86); return `#${f.getHexString()}`; };
  if (!img || typeof document === "undefined") return darker();
  try {
    const info = given ?? photoInfo(img); if (!info || info.collarRow === null) return darker();
    const W = 256, H = Math.max(8, Math.round((256 * img.height) / img.width));
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d", { willReadFrequently: true }); if (!g) return darker();
    g.drawImage(img, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
    const k = W / img.width; const bx0 = info.box.x0 * k, bx1 = info.box.x1 * k, by0 = info.box.y0 * k, bh = (info.box.y1 - info.box.y0) * k;
    const yEnd = by0 + bh * info.collarRow, yStart = opts.wide ? by0 : Math.max(by0, yEnd - bh * 0.03);
    const x0 = bx0 + (bx1 - bx0) * (opts.wide ? 0.25 : 0.4), x1 = bx0 + (bx1 - bx0) * (opts.wide ? 0.75 : 0.6);
    let px: number[][] = [];
    for (let y = Math.floor(yStart); y < yEnd; y++) for (let x = Math.floor(x0); x < x1; x++) {
      const o = (y * W + x) * 4; if (d[o + 3] > 200 && !isBackdrop(d, o, info.backdrop)) px.push([d[o], d[o + 1], d[o + 2]]);
    }
    if (px.length < 6) return darker();
    if (opts.wide) { const lum = px.map((p) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]).sort((a, b) => a - b); const cut = lum[Math.floor(lum.length * 0.35)]; px = px.filter((p) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2] >= cut); }
    const med = medoid(px);
    const f = srgbBytes(fabric);
    if (Math.hypot(med[0] - f[0], med[1] - f[1], med[2] - f[2]) < 40) return darker();
    return "#" + med.map((v) => v.toString(16).padStart(2, "0")).join("");
  } catch { return darker(); }
}
