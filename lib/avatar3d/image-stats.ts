/*
 * Avatar 3D (RF40) — medidas da foto em cima dos pixels (RGBA), sem DOM: luz e nitidez do rosto, tom de pele e cabelo.
 * O tom de pele é o que a foto mostra (mediana nas bochechas e na testa, sem clarear, escurecer nem "corrigir"); só
 * reflexos estourados e sombras profundas ficam de fora da amostra.
 */
import { measureTone, type ToneMeasure } from "./hair-tone";
import { FACE_OVAL } from "./canonical-face";

export interface Raster { data: Uint8ClampedArray | Uint8Array; width: number; height: number }
export type Pt = [number, number];

export const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
export const hex = (rgb: number[]) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
export const rgbOf = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

/** Máscara de polígono por varredura (1 dentro, 0 fora). */
export function polygonMask(w: number, h: number, poly: Pt[]): Uint8Array {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const yc = y + 0.5; const xs: number[] = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > yc) !== (yj > yc)) xs.push(xi + ((yc - yi) / (yj - yi)) * (xj - xi));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.ceil(xs[k] - 0.5)), x1 = Math.min(w - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = x0; x <= x1; x++) m[y * w + x] = 1;
    }
  }
  return m;
}

export function median(v: number[]): number {
  if (!v.length) return NaN;
  const s = v.slice().sort((a, b) => a - b); const k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}
export function percentile(v: number[], p: number): number {
  if (!v.length) return NaN;
  const s = v.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
}

export interface FaceStats {
  lum: number;          // luminância média do rosto (0–255)
  contrast: number;     // desvio padrão da luminância
  clipHigh: number;     // fração estourada (> 250)
  clipLow: number;      // fração preta (< 8)
  balance: number;      // razão entre o lado mais claro e o mais escuro do rosto (1 = luz por igual)
  sharpness: number;    // variância do laplaciano no rosto reduzido a 256 px de largura
  faceWidthPx: number;  // largura do rosto na foto (234↔454)
}

export function facePolygon(px: Pt[]): Pt[] { return FACE_OVAL.map((i) => px[i]); }

export function faceStats(img: Raster, px: Pt[]): FaceStats {
  const { width: w, height: h, data } = img;
  const mask = polygonMask(w, h, facePolygon(px));
  // divisória do rosto: a reta da testa (10) ao queixo (152); cada lado é comparado com o outro
  const [ax, ay] = px[10], [bx, by] = px[152];
  let n = 0, s = 0, s2 = 0, hi = 0, lo = 0, nl = 0, sl = 0, nr = 0, sr = 0;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    const o = (y * w + x) * 4; const L = luma(data[o], data[o + 1], data[o + 2]);
    n++; s += L; s2 += L * L; if (L > 250) hi++; if (L < 8) lo++;
    const side = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (side > 0) { nl++; sl += L; } else { nr++; sr += L; }
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const lum = n ? s / n : 0; const ml = nl ? sl / nl : lum, mr = nr ? sr / nr : lum;
  return {
    lum, contrast: n ? Math.sqrt(Math.max(0, s2 / n - lum * lum)) : 0, clipHigh: n ? hi / n : 0, clipLow: n ? lo / n : 0,
    balance: Math.max(ml, mr) / Math.max(1, Math.min(ml, mr)), sharpness: n ? laplacianVariance(img, mask, x0, y0, x1, y1) : 0,
    faceWidthPx: Math.hypot(px[234][0] - px[454][0], px[234][1] - px[454][1]),
  };
}

/** Nitidez: variância do laplaciano na caixa do rosto, reduzida (média de caixa) para 256 px de largura. */
export function laplacianVariance(img: Raster, mask: Uint8Array | null, x0: number, y0: number, x1: number, y1: number): number {
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1; if (bw < 8 || bh < 8) return 0;
  const k = Math.max(1, bw / 256); const W = Math.max(3, Math.floor(bw / k)), H = Math.max(3, Math.floor(bh / k));
  const g = new Float32Array(W * H); const inside = new Uint8Array(W * H);
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    let acc = 0, c = 0, ins = 0;
    const sx0 = Math.floor(x0 + X * k), sy0 = Math.floor(y0 + Y * k), sx1 = Math.max(sx0 + 1, Math.floor(x0 + (X + 1) * k)), sy1 = Math.max(sy0 + 1, Math.floor(y0 + (Y + 1) * k));
    for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) {
      const o = (y * img.width + x) * 4; acc += luma(img.data[o], img.data[o + 1], img.data[o + 2]); c++;
      if (!mask || mask[y * img.width + x]) ins++;
    }
    g[Y * W + X] = acc / Math.max(1, c); inside[Y * W + X] = ins * 2 >= c ? 1 : 0;
  }
  let n = 0, s = 0, s2 = 0;
  for (let Y = 1; Y < H - 1; Y++) for (let X = 1; X < W - 1; X++) {
    const i = Y * W + X; if (!inside[i] || !inside[i - 1] || !inside[i + 1] || !inside[i - W] || !inside[i + W]) continue;
    const l = g[i - 1] + g[i + 1] + g[i - W] + g[i + W] - 4 * g[i]; n++; s += l; s2 += l * l;
  }
  return n ? s2 / n - (s / n) ** 2 : 0;
}

/** Pontos de pele (bochechas, maçãs, testa, entre os olhos e o nariz, lados do queixo). */
export const SKIN_POINTS = [50, 280, 205, 425, 101, 330, 151, 108, 337, 6, 199, 421, 201] as const;

/**
 * Tom de pele da foto: mediana por canal dos pixels em volta dos pontos de pele. Fora da amostra só o que não é pele
 * visível de verdade: reflexo estourado, sombra funda e o que foge muito da mediana (barba, sobrancelha, óculos).
 */
export function sampleSkin(img: Raster, px: Pt[]): { hex: string; rgb: [number, number, number]; n: number } {
  const fw = Math.hypot(px[234][0] - px[454][0], px[234][1] - px[454][1]); const r = Math.max(2, Math.round(fw * 0.045));
  const cand: number[][] = [];
  for (const i of SKIN_POINTS) {
    const [cx, cy] = px[i];
    for (let y = Math.round(cy - r); y <= cy + r; y++) for (let x = Math.round(cx - r); x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= img.width || y >= img.height || (x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const o = (y * img.width + x) * 4; const L = luma(img.data[o], img.data[o + 1], img.data[o + 2]);
      if (L > 245 || L < 12) continue;
      cand.push([img.data[o], img.data[o + 1], img.data[o + 2], L]);
    }
  }
  if (!cand.length) return { hex: "#b08a6e", rgb: [176, 138, 110], n: 0 };
  const mL = median(cand.map((c) => c[3]));
  const keep = cand.filter((c) => Math.abs(c[3] - mL) < 45);
  const use = keep.length > cand.length * 0.3 ? keep : cand;
  const rgb: [number, number, number] = [median(use.map((c) => c[0])), median(use.map((c) => c[1])), median(use.map((c) => c[2]))];
  return { hex: hex(rgb), rgb, n: use.length };
}

const EYE_L = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const EYE_R = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
const BROW_L = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
const BROW_R = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276];
const LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
const NOSTRILS = [98, 97, 2, 326, 327, 460, 94, 240];
const grow = (poly: Pt[], k: number): Pt[] => { const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length; return poly.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]); };

/**
 * Oclusão: fração da pele do rosto (fora olhos, sobrancelhas, boca e narinas) que não parece pele — mão, manga,
 * armação de óculos, cabelo sobre o rosto, sombra funda. O que cobre o rosto iria parar "pintado" na textura.
 */
export function occlusion(img: Raster, px: Pt[], skin: [number, number, number]): number {
  const { width: w, height: h, data } = img;
  const face = polygonMask(w, h, grow(facePolygon(px), 0.92));
  const holes = [grow(EYE_L.map((i) => px[i]), 1.7), grow(EYE_R.map((i) => px[i]), 1.7), grow(BROW_L.map((i) => px[i]), 1.5), grow(BROW_R.map((i) => px[i]), 1.5), grow(LIPS.map((i) => px[i]), 1.25), grow(NOSTRILS.map((i) => px[i]), 1.3)].map((p) => polygonMask(w, h, p));
  const S = skin[0] + skin[1] + skin[2] || 1; const cr = skin[0] / S, cg = skin[1] / S; const Ls = luma(...skin) || 1;
  const step = Math.max(1, Math.round(Math.sqrt((w * h) / 400000)));
  let n = 0, bad = 0;
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    const i = y * w + x; if (!face[i] || holes.some((m) => m[i])) continue;
    const o = i * 4; const r = data[o], g = data[o + 1], b = data[o + 2]; const T = r + g + b || 1; const L = luma(r, g, b);
    n++;
    if (Math.hypot(r / T - cr, g / T - cg) > 0.05 || L < 0.3 * Ls || L > 1.5 * Ls) bad++;
  }
  return n ? bad / n : 0;
}

/** Semelhança 2D (números complexos): leva pontos da imagem (y para baixo) ao plano do canônico (y para cima). */
export interface Sim2D { a: number; b: number; tx: number; ty: number }
export function fit2D(img: Pt[], canon: Pt[]): Sim2D {
  const n = img.length; let mx = 0, my = 0, cx = 0, cy = 0;
  for (let i = 0; i < n; i++) { mx += img[i][0]; my += -img[i][1]; cx += canon[i][0]; cy += canon[i][1]; }
  mx /= n; my /= n; cx /= n; cy /= n;
  let re = 0, im = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const sx = img[i][0] - mx, sy = -img[i][1] - my, dx = canon[i][0] - cx, dy = canon[i][1] - cy;
    re += dx * sx + dy * sy; im += dy * sx - dx * sy; den += sx * sx + sy * sy;
  }
  const a = re / den, b = im / den;
  return { a, b, tx: cx - (a * mx - b * my), ty: cy - (b * mx + a * my) };
}
export const apply2D = (t: Sim2D, x: number, y: number): Pt => [t.a * x - t.b * -y + t.tx, t.b * x + t.a * -y + t.ty];

/** Alturas (canônico, cm) em que a silhueta do cabelo é medida: do alto da cabeça até abaixo dos ombros. */
export const HAIR_LEVELS = Array.from({ length: 21 }, (_, i) => 16 - 2 * i);

export interface HairStats {
  present: boolean;
  color: string | null;
  coverage: number;        // área de cabelo / área do rosto
  top: number;             // altura do cabelo no canônico (cm): o ponto mais alto (percentil 98)
  side: number;            // meia-largura do cabelo na altura dos olhos e da testa
  bottom: number | null;   // ponto mais baixo do cabelo ao lado do rosto (cabelo longo: abaixo do queixo)
  fringe: number;          // fração da testa coberta (franja)
  cutTop: boolean;         // o cabelo encosta no topo da foto: a altura real é desconhecida
  outline: number[];       // meia-largura do cabelo (cm) em HAIR_LEVELS (y = 16, 14, …, −24 no canônico); 0 = sem cabelo
  unsure: boolean;         // acima da testa há algo que não é pele nem cabelo reconhecido (peruca, chapéu, fundo)
  tone?: ToneMeasure | null; // tom (nível 1–10 + família) pelos meios-tons em CIELAB (lib/avatar3d/hair-tone.ts)
}

/**
 * Cabelo pela máscara do segmentador (confiança 0–1 por pixel, do tamanho da imagem), levado ao canônico pela
 * semelhança 2D da foto de frente. Só vale o cabelo ligado ao alto da cabeça (crescimento a partir da faixa logo acima
 * da testa): manchas escuras do fundo, soltas, não viram cabelo. A cor é a mediana desse cabelo (nunca a parede).
 */
export function hairStats(img: Raster, mask: ArrayLike<number>, px: Pt[], toCanon: Sim2D, foreheadY: number, skin?: [number, number, number]): HairStats {
  const { width: w, height: h, data } = img;
  const face = polygonMask(w, h, facePolygon(px)); let faceArea = 0; for (let i = 0; i < face.length; i++) faceArea += face[i];
  const step = Math.max(1, Math.round(Math.sqrt((w * h) / 250000)));
  const W = Math.ceil(w / step), H = Math.ceil(h / step);
  const hair = new Uint8Array(W * H), seed: number[] = [], seedCol: number[][] = [];
  let fr = 0, frN = 0;
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) {
    const x = gx * step, y = gy * step, i = y * w + x; const [X, Y] = apply2D(toCanon, x, y);
    if (Y > foreheadY - 3.5 && Y < foreheadY && Math.abs(X) < 4 && face[i]) { frN++; if (mask[i] > 0.5) fr++; }
    if (Math.abs(X) > 18 || Y < -30) continue;           // longe demais da cabeça (meia-largura do rosto + 10 cm)
    const isHair = mask[i] > 0.5 && !face[i]; if (isHair) hair[gy * W + gx] = 1;
    if (Y > foreheadY + 0.4 && Y < foreheadY + 3 && Math.abs(X) < 3) { if (isHair) seed.push(gy * W + gx); else if (!face[i]) { const o = i * 4; seedCol.push([data[o], data[o + 1], data[o + 2]]); } }
  }
  // crescimento a partir do alto da testa
  const reach = new Uint8Array(W * H); const q = [...seed]; q.forEach((c) => { reach[c] = 1; });
  while (q.length) {
    const c = q.pop()!; const gx = c % W, gy = (c - gx) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = gx + dx, ny = gy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const k = ny * W + nx; if (hair[k] && !reach[k]) { reach[k] = 1; q.push(k); } }
  }
  const rs: number[] = [], gs: number[] = [], bs: number[] = []; const tops: number[] = [], sides: number[] = [], bottoms: number[] = [];
  const near: number[][] = [], all: number[][] = [];
  let area = 0, cutTop = false; const byLevel: number[][] = HAIR_LEVELS.map(() => []);
  for (let c = 0; c < W * H; c++) {
    if (!reach[c]) continue; const gx = c % W, gy = (c - gx) / W; const x = gx * step, y = gy * step, i = y * w + x; const [X, Y] = apply2D(toCanon, x, y);
    area += step * step;
    if (mask[i] > 0.75) {
      const o = i * 4; const c = [data[o], data[o + 1], data[o + 2]]; if (Math.abs(X) <= 13) all.push(c);
      if (Y > foreheadY - 2 && Math.abs(X) < 10) { near.push(c); rs.push(c[0]); gs.push(c[1]); bs.push(c[2]); }   // cor: o cabelo junto da cabeça
    }
    if (Math.abs(X) < 6) tops.push(Y);
    if (Y > -3 && Y < 8) sides.push(Math.abs(X));
    if (Math.abs(X) > 5.5) bottoms.push(Y);
    const lv = Math.round((16 - Y) / 2); if (lv >= 0 && lv < HAIR_LEVELS.length) byLevel[lv].push(Math.abs(X));
    if (y <= Math.max(2, h * 0.015) && Math.abs(X) < 7) cutTop = true;
  }
  const coverage = faceArea ? area / faceArea : 0; let present = coverage > 0.08 && rs.length > 20;
  // a região "de cabelo" vazou para o fundo? (cor longe da do cabelo junto à cabeça) → não confiável
  let leaked = false;
  if (present && all.length > 50) {
    const mN = [0, 1, 2].map((k) => median(near.map((c) => c[k]))), mA = [0, 1, 2].map((k) => median(all.map((c) => c[k])));
    leaked = Math.hypot(mN[0] - mA[0], mN[1] - mA[1], mN[2] - mA[2]) > 45;
  }
  // sem cabelo acima da testa: careca (pele) ou algo não reconhecido (peruca, chapéu, fundo) — aí não se inventa cabelo
  let unsure = leaked; if (leaked) present = false;
  if (!present && !leaked && skin && seedCol.length > 10) {
    const m = [median(seedCol.map((c) => c[0])), median(seedCol.map((c) => c[1])), median(seedCol.map((c) => c[2]))];
    const S = skin[0] + skin[1] + skin[2] || 1, T = m[0] + m[1] + m[2] || 1; const ratio = luma(m[0], m[1], m[2]) / (luma(...skin) || 1);
    unsure = Math.hypot(m[0] / T - skin[0] / S, m[1] / T - skin[1] / S) > 0.05 || ratio < 0.6 || ratio > 1.5;
  }
  const tone = present ? measureTone(near) : null;
  return {
    present, color: present ? tone?.color ?? hex([median(rs), median(gs), median(bs)]) : null, tone, coverage,
    top: tops.length ? percentile(tops, 98) : 0, side: sides.length ? percentile(sides.filter((v) => v <= 13), 98) || 0 : 0,
    outline: byLevel.map((v) => (v.length > 6 ? +percentile(v, 97).toFixed(1) : 0)),
    bottom: bottoms.length > 30 ? percentile(bottoms, 3) : null, fringe: frN ? fr / frN : 0, cutTop, unsure,
  };
}
