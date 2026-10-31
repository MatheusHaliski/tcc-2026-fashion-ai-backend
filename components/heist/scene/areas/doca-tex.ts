/*
 * MET Gala Heist v2 — Doca (Z12): superfícies, desenhos e materiais próprios da área (chaves "doca-…"), gerados no
 * navegador (nos testes, jsdom, saem com 8 px como os do interior):
 *
 *  - piso: concreto polido em placas de 3 m com juntas serradas, agregado aparente fino, marcas de desempenadeira,
 *    riscos de borracha, manchas de óleo e trincas finas nas quinas das juntas — ladrilho de 6 m;
 *  - parede: bloco de concreto (0,4 × 0,2 m) pintado — barrado cinza-grafite até 1,2 m com o filete amarelo, cinza-claro
 *    em cima, escurecendo de fuligem perto do teto, raspões de carrinho no barrado — ladrilho de 3,2 × 6 m;
 *  - teto: telha de aço trapezoidal (steel deck) galvanizada, com poeira e manchas de água — ladrilho de 2 m;
 *  - laminado preto texturizado dos flight cases;
 *  - a folha de desenhos (placas de segurança, quadro de escalas, mural, mapa de rota de fuga com a planta do museu,
 *    relógio de ponto, prancheta, estênceis dos cases e da caixa de obra, fitas gaffer, caixas, colete refletivo) e as
 *    marcas do piso (zebrado, faixas, setas, quadrado do extintor, "não obstruir", marcas de pneu, vaga de palete).
 */
import * as THREE from "three";
import { DOORS, ROOMS } from "@/lib/heist/level";
import { HAND, SANS, SERIF, drawnTexture, fit, type Quality } from "../interior-tex";

const FAKE = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);
const cache = new Map<string, unknown>();
function memo<T>(key: string, make: () => T): T { const k = `doca-${key}`; if (!cache.has(k)) cache.set(k, make()); return cache.get(k) as T; }

/* ---------- ruído periódico rápido (rede pré-calculada + amostra bilinear) ---------- */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function field(n: number, seed: number, octaves = 5, base = 4): Float32Array {
  const out = new Float32Array(n * n), r = rng(seed); let amp = 0.5, total = 0;
  for (let o = 0; o < octaves; o++) {
    const per = base << o, lat = new Float32Array(per * per); for (let i = 0; i < lat.length; i++) lat[i] = r();
    const k = per / n;
    for (let y = 0; y < n; y++) {
      const fy = y * k, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty), y0 = (iy % per) * per, y1 = ((iy + 1) % per) * per;
      for (let x = 0; x < n; x++) { const fx = x * k, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx), x0 = ix % per, x1 = (ix + 1) % per; const a = lat[y0 + x0], b = lat[y0 + x1], c = lat[y1 + x0], d = lat[y1 + x1]; out[y * n + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy); }
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
const fieldOf = (n: number, seed: number, octaves = 5, base = 4) => memo(`f${n}:${seed}:${octaves}:${base}`, () => field(n, seed, octaves, base));
/** Amostra o campo (lado n) em u, v ∈ [0, 1) com repetição; `ku`, `kv` = quantas vezes o campo cabe no ladrilho. */
function samp(f: Float32Array, n: number, u: number, v: number, ku = 1, kv = 1): number {
  let x = u * n * ku, y = v * n * kv; x = ((x % n) + n) % n; y = ((y % n) + n) % n;
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy, ix1 = (ix + 1) % n, iy1 = (iy + 1) % n;
  const a = f[iy * n + ix], b = f[iy * n + ix1], c = f[iy1 * n + ix], d = f[iy1 * n + ix1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (i: number, j: number, seed: number) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed + 1, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

/* ---------- superfície (cor + relevo + rugosidade) ---------- */
export interface Surface { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }
type PixelFn = (u: number, v: number, x: number, y: number, out: Float32Array) => void;
function cv(w: number, h: number) { const c = document.createElement("canvas"); c.width = w; c.height = h; return { c, g: c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D }; }
function tex(c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; return t; }
/** Gera cor, normal (gradiente da altura, dando a volta na borda) e rugosidade; `pre` desenha máscaras num canvas do
 * mesmo tamanho antes (juntas, riscos), lidas por pixel no canal vermelho. */
function surface(key: string, W: number, H: number, fn: PixelFn, bump: number, pre?: (g: CanvasRenderingContext2D, w: number, h: number) => void): Surface {
  return memo(`sf-${key}`, () => {
    const w = FAKE ? 8 : W, h = FAKE ? 8 : H;
    const col = cv(w, h), nor = cv(w, h), rou = cv(w, h);
    const ci = col.g.createImageData(w, h), ni = nor.g.createImageData(w, h), ri = rou.g.createImageData(w, h);
    let mask: Uint8ClampedArray | null = null;
    if (pre && !FAKE) { const m = cv(w, h); m.g.fillStyle = "#000"; m.g.fillRect(0, 0, w, h); pre(m.g, w, h); mask = m.g.getImageData(0, 0, w, h).data; }
    const Hf = new Float32Array(w * h), out = new Float32Array(6);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x; out[3] = 0.5; out[4] = 0.5; out[5] = mask ? mask[k * 4] / 255 : 0;
      fn((x + 0.5) / w, (y + 0.5) / h, x, y, out);
      ci.data[k * 4] = clamp01(out[0]) * 255; ci.data[k * 4 + 1] = clamp01(out[1]) * 255; ci.data[k * 4 + 2] = clamp01(out[2]) * 255; ci.data[k * 4 + 3] = 255;
      const rr = clamp01(out[4]) * 255; ri.data[k * 4] = rr; ri.data[k * 4 + 1] = rr; ri.data[k * 4 + 2] = rr; ri.data[k * 4 + 3] = 255;
      Hf[k] = out[3];
    }
    const s = bump * w / 256;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w, xr = (x + 1) % w, yu = (y - 1 + h) % h, yd = (y + 1) % h;
      const dx = (Hf[y * w + xr] - Hf[y * w + xl]) * s, dy = (Hf[yd * w + x] - Hf[yu * w + x]) * s, l = Math.hypot(dx, dy, 1), k = (y * w + x) * 4;
      ni.data[k] = (-dx / l * 0.5 + 0.5) * 255; ni.data[k + 1] = (dy / l * 0.5 + 0.5) * 255; ni.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[k + 3] = 255;
    }
    col.g.putImageData(ci, 0, 0); nor.g.putImageData(ni, 0, 0); rou.g.putImageData(ri, 0, 0);
    return { map: tex(col.c, true), normalMap: tex(nor.c, false), roughnessMap: tex(rou.c, false) };
  });
}
/** Passeio aleatório (trincas, riscos) desenhado com volta na borda. */
function walk(g: CanvasRenderingContext2D, w: number, h: number, r: () => number, x: number, y: number, n: number, step: number, dir: number, width: number) {
  const pts: [number, number][] = [[x, y]];
  for (let k = 0; k < n; k++) { dir += (r() - 0.5) * 0.8; x += Math.cos(dir) * step; y += Math.sin(dir) * step; pts.push([x, y]); }
  g.lineWidth = width;
  for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { g.beginPath(); pts.forEach(([a, b], k) => (k ? g.lineTo(a + ox, b + oy) : g.moveTo(a + ox, b + oy))); g.stroke(); }
}

/** Concreto polido da doca (ladrilho de 6 m: placas de 3 m). Máscara: R = juntas serradas, trincas e riscos de borracha. */
export const FLOOR_TILE: [number, number] = [6, 6];
export function floorSurface(q: Quality): Surface {
  const S = q === "high" ? 1024 : 512;
  const low = fieldOf(128, 701, 4, 2), mid = fieldOf(256, 702, 5, 4), fine = fieldOf(256, 703, 3, 64), burn = fieldOf(256, 704, 4, 6), oil = fieldOf(256, 705, 4, 5);
  return surface(`floor-${q}`, S, S, (u, v, _x, _y, o) => {
    const l = samp(low, 128, u, v), m = samp(mid, 256, u, v), f = samp(fine, 256, u, v, 4, 4), b = samp(burn, 256, u, v);
    const pu = (u * 2) % 1, pv = (v * 2) % 1, panel = Math.floor(u * 2) + 2 * Math.floor(v * 2), tone = hash(panel, 3, 707);
    const swirl = 0.5 + 0.5 * Math.sin((pu * 9 + Math.sin(pv * 7 + m * 4) * 0.8 + m * 3) * 3.1);   // marcas de desempenadeira
    const speck = f > 0.8 ? 1 : f < 0.12 ? -1 : 0;                                                   // agregado aparente
    const stain = smooth(0.7, 0.86, samp(oil, 256, u, v)), mk = o[5];
    let t = 0.53 + 0.05 * (l - 0.5) + 0.04 * (tone - 0.5) + 0.025 * (swirl - 0.5) + (speck > 0 ? 0.07 : speck < 0 ? -0.08 : 0) - 0.06 * smooth(0.55, 0.8, b);
    t *= 1 - 0.45 * stain; t *= 1 - 0.75 * mk;
    o[0] = t * 1.0; o[1] = t * 0.99; o[2] = t * 0.955;
    o[3] = 0.55 + 0.04 * f - 0.4 * mk + 0.02 * (speck > 0 ? 1 : 0);
    o[4] = 0.26 + 0.12 * swirl * 0.5 + 0.2 * smooth(0.5, 0.85, b) + 0.6 * mk - 0.08 * stain;
  }, 1.4, (g, w, h) => {
    const r = rng(708), jw = Math.max(1.2, w / 520);
    // juntas serradas a cada 3 m (meio ladrilho), com a borda lascada
    g.strokeStyle = "#fff";
    for (const k of [0, 0.5]) { g.lineWidth = jw; g.beginPath(); g.moveTo(k * w, 0); g.lineTo(k * w, h); g.moveTo(0, k * h); g.lineTo(w, k * h); g.stroke(); }
    g.strokeStyle = "rgba(255,255,255,0.55)";
    for (let k = 0; k < 40; k++) { const along = r() < 0.5, p = (r() < 0.5 ? 0 : 0.5) * (along ? w : h), q = r() * (along ? h : w); g.lineWidth = 1 + r() * 2; g.beginPath(); if (along) { g.moveTo(p - 2, q); g.lineTo(p + 2 + r() * 2, q + 3 + r() * 6); } else { g.moveTo(q, p - 2); g.lineTo(q + 3 + r() * 6, p + 2 + r() * 2); } g.stroke(); }
    // trincas finas saindo das quinas das juntas
    g.strokeStyle = "rgba(255,255,255,0.7)";
    for (const [cx, cy] of [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]]) for (let k = 0; k < 2; k++) walk(g, w, h, r, cx * w + (r() - 0.5) * 8, cy * h + (r() - 0.5) * 8, 10 + Math.floor(r() * 16), w / 180, r() * Math.PI * 2, Math.max(0.8, w / 900));
    // riscos de borracha (rodízios, paleteira, solados): arcos curtos e meio apagados
    for (let k = 0; k < 70; k++) { g.strokeStyle = `rgba(255,255,255,${0.12 + r() * 0.25})`; g.lineWidth = 1 + r() * 2.5; const x = r() * w, y = r() * h, rad = 20 + r() * 120, a = r() * Math.PI * 2; g.beginPath(); g.arc(x, y, rad, a, a + 0.2 + r() * 0.6); g.stroke(); }
  });
}

/** Bloco de concreto pintado (ladrilho de 3,2 m × 6 m: 8 × 30 blocos), barrado grafite até 1,2 m com filete amarelo. */
export const WALL_TILE: [number, number] = [3.2, 6];
export function wallSurface(q: Quality): Surface {
  const W = q === "high" ? 1024 : 512, H = W;
  const pore = fieldOf(256, 711, 3, 64), mid = fieldOf(256, 712, 5, 4), soot = fieldOf(128, 713, 4, 3), scuff = fieldOf(256, 714, 4, 16);
  return surface(`wall-${q}`, W, H, (u, v, _x, _y, o) => {
    const ym = (1 - v) * 6;                                                     // altura em metros (v = 0 no topo do canvas)
    const row = Math.floor(ym / 0.2), ly = ym / 0.2 - row, off = row % 2 ? 0.5 : 0, xb = u * 8 + off, col = Math.floor(xb), lx = xb - col;
    const jy = Math.min(ly, 1 - ly) * 0.2, jx = Math.min(lx, 1 - lx) * 0.4, j = Math.min(jx, jy);           // distância à junta (m)
    const joint = 1 - smooth(0.004, 0.009, j), p = samp(pore, 256, u, v, 2, 4), m = samp(mid, 256, u, v);
    const band = ym < 1.2, stripe = ym >= 1.2 && ym < 1.26;
    const blockTone = hash(col, row, 715) * 0.04;
    let r: number, g: number, b: number;
    if (stripe) { r = 0.86; g = 0.68; b = 0.12; }
    else if (band) { r = 0.27; g = 0.29; b = 0.305; }
    else { r = 0.72; g = 0.735; b = 0.72; }
    const k = (0.94 + blockTone + 0.05 * (m - 0.5)) * (1 - 0.18 * joint) * (p < 0.15 ? 0.82 : 1);
    r *= k; g *= k; b *= k;
    // barrado: raspões de carrinho (preto de borracha) e lascas mostrando o bloco cinza
    if (band) {
      const sc = samp(scuff, 256, u, v, 3, 1);
      if (ym < 0.6 && sc > 0.72) { const t = smooth(0.72, 0.8, sc); r *= 1 - 0.5 * t; g *= 1 - 0.5 * t; b *= 1 - 0.5 * t; }
      if (sc < 0.12 && ym > 0.15 && ym < 1.0) { r = 0.55; g = 0.55; b = 0.53; }
    } else if (!stripe) {
      const s = smooth(0.4, 1, samp(soot, 128, u, v)) * smooth(2.5, 6, ym); r *= 1 - 0.32 * s; g *= 1 - 0.32 * s; b *= 1 - 0.3 * s;
    }
    o[0] = r; o[1] = g; o[2] = b; o[3] = 0.6 - 0.35 * joint + 0.04 * p; o[4] = band ? 0.55 : stripe ? 0.45 : 0.82;
  }, 2.2);
}

/** Telha de aço trapezoidal galvanizada (ladrilho de 2 m; nervuras a cada 0,25 m ao longo de v). */
export function deckSurface(q: Quality): Surface {
  const S = q === "high" ? 512 : 256, dust = fieldOf(128, 721, 4, 3), stain = fieldOf(128, 722, 4, 4);
  return surface(`deck-${q}`, S, S, (u, v, _x, _y, o) => {
    const p = (u * 8) % 1, d = samp(dust, 128, u, v), st = smooth(0.66, 0.8, samp(stain, 128, u, v));
    // perfil: mesa de cima (0–0,35), alma inclinada, mesa de baixo (0,5–0,85), alma de volta
    const hgt = p < 0.35 ? 1 : p < 0.5 ? 1 - (p - 0.35) / 0.15 : p < 0.85 ? 0 : (p - 0.85) / 0.15;
    const slope = (p >= 0.35 && p < 0.5) || p >= 0.85, lap = Math.abs(v * 2 % 1 - 0.5) < 0.004;
    const t = (0.48 + 0.08 * hgt - (slope ? 0.1 : 0) + 0.05 * (d - 0.5)) * (1 - 0.35 * st) * (lap ? 0.7 : 1);
    o[0] = t * 0.97; o[1] = t; o[2] = t * 1.04; o[3] = hgt * 0.8 + 0.1; o[4] = 0.5 + 0.2 * d + 0.2 * st;
  }, 3.2);
}

/** Laminado preto "martelado" dos flight cases (ladrilho de 0,25 m): bolhas finas. */
export function laminateSurface(q: Quality): Surface {
  const S = q === "high" ? 256 : 128;
  return surface(`laminate-${q}`, S, S, (u, v, _x, _y, o) => {
    const cells = 14, x = u * cells, y = v * cells, xi = Math.floor(x), yi = Math.floor(y); let d1 = 9;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const ci = ((xi + dx) % cells + cells) % cells, cj = ((yi + dy) % cells + cells) % cells; const d = Math.hypot(x - (xi + dx + hash(ci, cj, 731)), y - (yi + dy + hash(ci, cj, 733))); if (d < d1) d1 = d; }
    const bump = 1 - smooth(0, 0.7, d1); o[0] = o[1] = o[2] = 0.09 + 0.02 * bump; o[3] = 0.4 + 0.4 * bump; o[4] = 0.45 + 0.15 * (1 - bump);
  }, 2.5);
}

/* ======================= folha de desenhos ======================= */
export interface Rect { u0: number; v0: number; u1: number; v1: number }
type Cell = [string, number, number, number, number, (g: CanvasRenderingContext2D, w: number, h: number) => void];
const LW = 2048, LH = 2048;
const YEL = "#f2c230", BLK = "#151515", RED = "#c3141a", GRN = "#0b7a3b", BLU = "#1d4f9c";
const STEN = "'Stencil', 'Stardos Stencil', 'Arial Black', Impact, 'DejaVu Sans', sans-serif";

function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, color: string, o: { font?: string; weight?: string; align?: CanvasTextAlign; max?: number } = {}) {
  g.fillStyle = color; g.textAlign = o.align ?? "center"; g.textBaseline = "middle";
  const fam = o.font ?? SANS, wgt = o.weight ?? "700";
  if (o.max) fit(g, s, (p) => `${wgt} ${p}px ${fam}`, px, o.max); else g.font = `${wgt} ${px}px ${fam}`;
  g.fillText(s, x, y);
}
function pictoExtinguisher(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  g.fillStyle = color; g.beginPath(); g.roundRect(cx - s * 0.18, cy - s * 0.3, s * 0.36, s * 0.75, s * 0.12); g.fill();
  g.fillRect(cx - s * 0.08, cy - s * 0.45, s * 0.16, s * 0.16); g.lineWidth = s * 0.07; g.strokeStyle = color; g.beginPath(); g.moveTo(cx + s * 0.06, cy - s * 0.38); g.quadraticCurveTo(cx + s * 0.4, cy - s * 0.4, cx + s * 0.34, cy + s * 0.1); g.stroke();
}
function pictoPerson(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string, run = false) {
  g.fillStyle = color; g.strokeStyle = color; g.lineCap = "round"; g.lineWidth = s * 0.12;
  g.beginPath(); g.arc(cx + (run ? s * 0.1 : 0), cy - s * 0.42, s * 0.11, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(cx, cy - s * 0.28); g.lineTo(cx - (run ? s * 0.06 : 0), cy + s * 0.08);
  if (run) { g.lineTo(cx + s * 0.22, cy + s * 0.42); g.moveTo(cx - s * 0.06, cy + s * 0.08); g.lineTo(cx - s * 0.3, cy + s * 0.3); g.moveTo(cx, cy - s * 0.2); g.lineTo(cx + s * 0.28, cy - s * 0.05); g.moveTo(cx, cy - s * 0.2); g.lineTo(cx - s * 0.26, cy - s * 0.12); }
  else { g.lineTo(cx - s * 0.12, cy + s * 0.45); g.moveTo(cx, cy + s * 0.08); g.lineTo(cx + s * 0.12, cy + s * 0.45); g.moveTo(cx - s * 0.22, cy - s * 0.12); g.lineTo(cx + s * 0.22, cy - s * 0.12); }
  g.stroke();
}
function tapeStrip(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = "rgba(235,232,215,0.85)"; g.fillRect(-w / 2, -h / 2, w, h); g.restore(); }
function pin(g: CanvasRenderingContext2D, x: number, y: number, c: string) { g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.arc(x + 2, y + 3, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(255,255,255,0.6)"; g.beginPath(); g.arc(x - 2, y - 2, 2, 0, Math.PI * 2); g.fill(); }
function sheet(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number, draw: () => void, bg = "#f4f1e8") {
  g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(a); g.translate(-w / 2, -h / 2);
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(3, 4, w, h); g.fillStyle = bg; g.fillRect(0, 0, w, h); draw(); g.restore();
}

/** Planta simplificada do museu para o mapa de rota de fuga (as salas do jogo, a doca destacada, setas para as saídas). */
function evacMap(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = "#f6f4ee"; g.fillRect(0, 0, w, h); g.strokeStyle = GRN; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  g.fillStyle = GRN; g.fillRect(0, 0, w, 54); text(g, "ROTA DE FUGA", w / 2, 28, 30, "#fff", { weight: "800" });
  const X0 = -23, X1 = 31, Z0 = -24, Z1 = 26, mx = 20, my = 70, sx = (w - mx * 2) / (X1 - X0), sz = (h - my - 40) / (Z1 - Z0), s = Math.min(sx, sz);
  const P = (x: number, z: number): [number, number] => [mx + (x - X0) * s, my + (z - Z0) * s];
  for (const r of ROOMS) {
    if (r.id === "rua" || r.id === "beiral" || r.id === "seguranca") continue;
    const [a, b] = P(r.rect.x0, r.rect.z0), [c, d] = P(r.rect.x1, r.rect.z1);
    g.fillStyle = r.id === "doca" ? "#ffe69a" : r.outdoor ? "#e3eadf" : "#ffffff"; g.fillRect(a, b, c - a, d - b);
    g.strokeStyle = "#333"; g.lineWidth = 2; g.strokeRect(a, b, c - a, d - b);
  }
  for (const d of DOORS) { if (d.lock === "climb" || d.lock === "vent") continue; const [a, b] = P(d.rect.x0, d.rect.z0), [c, e] = P(d.rect.x1, d.rect.z1); g.fillStyle = "#ffffff"; g.fillRect(a - 1, b - 1, c - a + 2, e - b + 2); }
  // saídas (portão da doca e portas da frente) e as setas verdes
  g.strokeStyle = GRN; g.fillStyle = GRN; g.lineWidth = 4;
  const arrow = (x0: number, z0: number, x1: number, z1: number) => { const [a, b] = P(x0, z0), [c, d] = P(x1, z1), an = Math.atan2(d - b, c - a); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); g.beginPath(); g.moveTo(c, d); g.lineTo(c - 12 * Math.cos(an - 0.4), d - 12 * Math.sin(an - 0.4)); g.lineTo(c - 12 * Math.cos(an + 0.4), d - 12 * Math.sin(an + 0.4)); g.closePath(); g.fill(); };
  arrow(-15, 19.5, -19, 25.5); arrow(-11, 21.2, -7.6, 21.2); arrow(0, 19, 0, 25.5); arrow(0, 6, 0, 12.6); arrow(17, 9, 13, 10);
  const [yx, yy] = P(-10.2, 18.4); g.fillStyle = RED; g.beginPath(); g.arc(yx, yy, 9, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke();
  text(g, "VOCÊ ESTÁ AQUI", yx + 70, yy - 16, 15, RED, { weight: "800" });
  text(g, "SAÍDA", P(-19, 26)[0], P(-19, 26)[1] + 6, 15, GRN, { weight: "800" }); text(g, "SAÍDA", P(0, 26)[0], P(0, 26)[1] + 6, 15, GRN, { weight: "800" });
  g.fillStyle = "#555"; g.font = `500 12px ${SANS}`; g.textAlign = "left"; g.fillText("Museu Vesper · térreo · em caso de incêndio não use o elevador", 16, h - 16);
}

const CELLS: Cell[] = [
  /* ----- placas ----- */
  ["dockTitle", 0, 0, 1024, 192, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 0, w, h); g.fillStyle = BLK; for (let x = -h; x < w + h; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 24, 0); g.lineTo(x + 24 - 24, 22); g.lineTo(x - 24, 22); g.fill(); g.beginPath(); g.moveTo(x, h - 22); g.lineTo(x + 24, h - 22); g.lineTo(x, h); g.lineTo(x - 24, h); g.fill(); } text(g, "DOCA 1 · CARGA E DESCARGA", w / 2, h * 0.43, 74, BLK, { weight: "900", max: w - 80 }); text(g, "ENTREGAS DA GALA · SOMENTE COM CREDENCIAL", w / 2, h * 0.74, 30, BLK, { weight: "700", max: w - 80 }); }],
  ["clearance", 1024, 0, 512, 192, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = BLK; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14); text(g, "ALTURA LIVRE", w / 2, h * 0.32, 44, BLK, { weight: "900" }); text(g, "4,20 m", w / 2, h * 0.68, 70, RED, { weight: "900" }); }],
  ["booth", 1536, 0, 512, 96, (g, w, h) => { g.fillStyle = "#1d2a4a"; g.fillRect(0, 0, w, h); text(g, "PORTARIA · CONTROLE DE ACESSO", w / 2, h / 2, 30, "#fff", { weight: "800", max: w - 30 }); }],
  ["visitors", 1536, 96, 512, 96, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 0, w, h); text(g, "MOTORISTAS: APRESENTEM-SE NA PORTARIA", w / 2, h / 2, 24, BLK, { weight: "800", max: w - 30 }); }],
  ["epi", 0, 256, 256, 384, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = BLU; g.beginPath(); g.arc(w / 2, 120, 100, 0, Math.PI * 2); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.ellipse(w / 2, 108, 50, 34, 0, Math.PI, 0); g.fill(); g.fillRect(w / 2 - 64, 106, 128, 12); g.fillRect(w / 2 - 34, 140, 68, 50); text(g, "USO OBRIGATÓRIO", w / 2, 262, 26, BLU, { weight: "900" }); text(g, "DE EPI", w / 2, 296, 34, BLU, { weight: "900" }); text(g, "capacete · colete · botina", w / 2, 340, 18, "#333", { weight: "600" }); }],
  ["noSmoking", 256, 256, 256, 384, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = RED; g.lineWidth = 22; g.beginPath(); g.arc(w / 2, 120, 92, 0, Math.PI * 2); g.stroke(); g.fillStyle = BLK; g.fillRect(w / 2 - 70, 112, 110, 22); g.fillStyle = "#e8e2d0"; g.fillRect(w / 2 + 40, 112, 26, 22); g.strokeStyle = "#999"; g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2 + 60, 104); g.quadraticCurveTo(w / 2 + 74, 84, w / 2 + 60, 64); g.stroke(); g.strokeStyle = RED; g.lineWidth = 22; g.beginPath(); g.moveTo(w / 2 - 65, 55); g.lineTo(w / 2 + 65, 185); g.stroke(); text(g, "PROIBIDO", w / 2, 270, 34, RED, { weight: "900" }); text(g, "FUMAR", w / 2, 310, 34, RED, { weight: "900" }); text(g, "Lei estadual", w / 2, 350, 16, "#555", { weight: "500" }); }],
  ["forklift", 512, 256, 256, 384, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = YEL; g.strokeStyle = BLK; g.lineWidth = 12; g.beginPath(); g.moveTo(w / 2, 22); g.lineTo(w - 18, 210); g.lineTo(18, 210); g.closePath(); g.fill(); g.stroke(); g.fillStyle = BLK; g.fillRect(w / 2 - 40, 120, 56, 46); g.fillRect(w / 2 + 16, 80, 8, 90); g.fillRect(w / 2 + 16, 160, 40, 6); g.beginPath(); g.arc(w / 2 - 28, 176, 12, 0, Math.PI * 2); g.arc(w / 2 + 6, 176, 12, 0, Math.PI * 2); g.fill(); text(g, "CUIDADO", w / 2, 262, 36, BLK, { weight: "900" }); text(g, "EMPILHADEIRA E", w / 2, 304, 22, BLK, { weight: "800" }); text(g, "PALETEIRA EM MANOBRA", w / 2, 332, 18, BLK, { weight: "800", max: w - 20 }); }],
  ["extinguisher", 768, 256, 256, 256, (g, w, h) => { g.fillStyle = RED; g.fillRect(0, 0, w, h); g.strokeStyle = "#fff"; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); pictoExtinguisher(g, w * 0.42, h * 0.48, h * 0.62, "#fff"); text(g, "EXTINTOR", w / 2, h * 0.9, 26, "#fff", { weight: "900" }); }],
  ["speed", 1024, 256, 256, 256, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = RED; g.lineWidth = 22; g.beginPath(); g.arc(w / 2, h / 2 - 10, 100, 0, Math.PI * 2); g.stroke(); text(g, "5", w / 2, h / 2 - 22, 96, BLK, { weight: "900" }); text(g, "km/h", w / 2, h / 2 + 38, 26, BLK, { weight: "800" }); }],
  ["exit", 1280, 256, 384, 160, (g, w, h) => { g.fillStyle = GRN; g.fillRect(0, 0, w, h); pictoPerson(g, 70, h / 2 + 6, 110, "#f1fff4", true); g.fillStyle = "#f1fff4"; g.fillRect(118, 30, 6, h - 60); text(g, "SAÍDA", 250, h / 2 + 2, 64, "#f1fff4", { weight: "900" }); g.beginPath(); g.moveTo(w - 30, h / 2); g.lineTo(w - 60, h / 2 - 26); g.lineTo(w - 60, h / 2 + 26); g.fill(); }],
  ["maxLoad", 1280, 416, 384, 128, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 0, w, h); g.strokeStyle = BLK; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10); text(g, "CARGA MÁXIMA", w / 2, h * 0.36, 34, BLK, { weight: "900" }); text(g, "300 kg POR PRATELEIRA", w / 2, h * 0.72, 26, BLK, { weight: "800" }); }],
  ["clock", 1664, 256, 256, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#dedbd2"); grd.addColorStop(1, "#c9c5ba"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    text(g, "PONTO ELETRÔNICO", w / 2, 26, 18, "#333", { weight: "800" }); g.fillStyle = "#0f1a12"; g.fillRect(28, 46, w - 56, 70); text(g, "23:47", w / 2, 82, 50, "#9cff8a", { font: "monospace", weight: "700" });
    text(g, "SÁB 04/12  ·  APROXIME O CRACHÁ", w / 2, 132, 13, "#333", { weight: "700", max: w - 20 });
    for (let k = 0; k < 12; k++) { g.fillStyle = "#3a3a3a"; g.fillRect(40 + (k % 3) * 62, 152 + Math.floor(k / 3) * 24, 52, 18); }
    g.fillStyle = "#c62828"; g.beginPath(); g.arc(w - 30, 30, 6, 0, Math.PI * 2); g.fill();
  }],
  ["cards", 1664, 512, 256, 128, (g, w, h) => { g.fillStyle = "#5c6066"; g.fillRect(0, 0, w, h); const r = rng(741); for (let k = 0; k < 8; k++) { g.fillStyle = r() < 0.2 ? "#ffd75a" : "#f4f2ec"; g.fillRect(8 + k * 31, 10 + (r() < 0.5 ? 0 : 6), 26, h - 26); g.fillStyle = "#333"; g.fillRect(12 + k * 31, 18, 18, 3); g.fillRect(12 + k * 31, 26, 14, 2); } }],
  /* ----- quadro de escalas, mural, mapa, prancheta ----- */
  ["schedule", 0, 640, 1024, 640, (g, w, h) => {
    g.fillStyle = "#f7f8f6"; g.fillRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, "rgba(255,255,255,0.6)"); grd.addColorStop(0.4, "rgba(255,255,255,0)"); grd.addColorStop(1, "rgba(200,205,210,0.3)"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(120,130,140,0.18)"; for (let k = 0; k < 6; k++) g.fillRect(80 + k * 150, 40 + (k % 3) * 160, 120, 20);     // marcas de apagador
    text(g, "ESCALA · DOCA · GALA LUMIÈRE · SÁB 04/12", w / 2, 50, 40, "#1b3a8a", { font: HAND, weight: "700", max: w - 60 });
    g.strokeStyle = "#1b1b1b"; g.lineWidth = 3; const cols = [40, 170, 390, 690, 830, 980], top = 96, rowH = 50;
    for (const x of cols) { g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + rowH * 6); g.stroke(); }
    for (let k = 0; k <= 6; k++) { g.beginPath(); g.moveTo(cols[0], top + k * rowH); g.lineTo(cols[cols.length - 1], top + k * rowH); g.stroke(); }
    const rows = [["TURNO", "NOME", "FUNÇÃO", "ENTRA", "SAI"], ["NOITE", "Gil", "Portão / chave", "18:00", "02:00"], ["NOITE", "Sônia", "Ronda da doca", "18:00", "02:00"], ["NOITE", "Dorival", "Portaria", "18:00", "06:00"], ["BUFÊ", "Márcia", "Conferência", "17:00", "01:00"], ["BUFÊ", "Tião", "Carga e descarga", "17:00", "01:00"]];
    rows.forEach((r, k) => r.forEach((s, j) => { g.fillStyle = k === 0 ? "#b3121e" : "#1b1b1b"; g.textAlign = "left"; g.textBaseline = "middle"; g.font = `${k === 0 ? 700 : 400} 30px ${HAND}`; g.fillText(s, cols[j] + 12, top + k * rowH + rowH / 2 + 2); }));
    g.font = `400 28px ${HAND}`; g.fillStyle = "#1b3a8a"; g.textAlign = "left";
    ["ENTREGAS:", "21:00  Bufê Lumière — câmara fria  ✓", "21:40  Gelo, 40 sacos  ✓", "22:30  Flores (arranjo extra)", "00:30  Recolhimento dos cases"].forEach((s, k) => g.fillText(s, 52, 432 + k * 34));
    g.fillStyle = "#b3121e"; g.font = `700 34px ${HAND}`; g.fillText("23:10  TROCA DE TURNO DA SEGURANÇA", 520, 470); g.fillRect(520, 492, 440, 4);
    g.font = `400 26px ${HAND}`; g.fillText("portão SÓ com o Gil!", 600, 540);
    // ímãs e a bandeja de canetas
    for (const [x, y, c] of [[150, 130, "#e53935"], [300, 300, "#43a047"], [860, 180, "#1e88e5"], [930, 520, "#fdd835"]] as [number, number, string][]) { g.fillStyle = c; g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.arc(x - 4, y - 4, 4, 0, Math.PI * 2); g.fill(); }
    sheet(g, 760, 360, 180, 120, 0.05, () => { text(g, "CAFÉ", 90, 40, 26, "#333", { font: HAND }); text(g, "na copa ↑", 90, 80, 22, "#555", { font: HAND }); }, "#fff59d");
  }],
  ["notices", 1024, 640, 512, 384, (g, w, h) => {
    const r = rng(751); g.fillStyle = "#b98a56"; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(${r() < 0.5 ? "90,60,30" : "220,180,120"},${0.15 + r() * 0.2})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    g.strokeStyle = "#5a3e22"; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
    sheet(g, 30, 30, 170, 220, -0.04, () => { g.fillStyle = BLU; g.fillRect(0, 0, 170, 40); text(g, "CIPA", 85, 21, 24, "#fff", { weight: "900" }); text(g, "SEMANA DE", 85, 70, 16, "#222"); text(g, "PREVENÇÃO", 85, 92, 18, "#222", { weight: "800" }); for (let k = 0; k < 6; k++) { g.fillStyle = "#999"; g.fillRect(16, 120 + k * 14, 138 - (k % 2) * 30, 4); } });
    sheet(g, 220, 24, 150, 110, 0.03, () => { text(g, "RAMAIS", 75, 18, 18, BLK, { weight: "900" }); ["Portaria 201", "Segurança 202", "Bufê 230", "Produção 245"].forEach((s, k) => text(g, s, 75, 42 + k * 18, 14, "#222", { weight: "600" })); });
    sheet(g, 380, 40, 110, 140, -0.06, () => { g.fillStyle = "#8a8d92"; g.fillRect(10, 10, 90, 90); g.fillStyle = "#c9b9a0"; g.beginPath(); g.arc(55, 48, 18, 0, Math.PI * 2); g.fill(); g.fillRect(30, 70, 50, 30); text(g, "aniversariante", 55, 118, 12, "#333", { font: HAND }); }, "#fff");
    sheet(g, 220, 160, 270, 150, 0.02, () => { g.fillStyle = RED; g.fillRect(0, 0, 270, 34); text(g, "AVISO", 135, 18, 22, "#fff", { weight: "900" }); text(g, "PROIBIDO ESTACIONAR", 135, 62, 18, BLK, { weight: "800" }); text(g, "NA RAMPA DA DOCA", 135, 86, 18, BLK, { weight: "800" }); text(g, "— Administração", 160, 126, 14, "#444", { font: HAND }); });
    sheet(g, 40, 270, 160, 90, 0.05, () => { text(g, "MARMITA ✓", 80, 30, 22, "#222", { font: HAND }); text(g, "sexta: feijoada", 80, 62, 16, "#444", { font: HAND }); }, "#fff59d");
    for (const [x, y, c] of [[115, 34, RED], [295, 28, "#1e88e5"], [435, 44, "#43a047"], [355, 164, "#fdd835"], [120, 274, RED]] as [number, number, string][]) pin(g, x, y, c);
  }],
  ["evac", 1536, 640, 512, 384, (g, w, h) => evacMap(g, w, h)],
  ["clipboard", 1152, 1664, 256, 384, (g, w, h) => {
    g.fillStyle = "#6b4a2a"; g.fillRect(0, 0, w, h); g.fillStyle = "#f6f3ea"; g.fillRect(14, 40, w - 28, h - 54);
    g.fillStyle = "#9aa0a6"; g.fillRect(w / 2 - 50, 8, 100, 40); g.fillStyle = "#6c7177"; g.fillRect(w / 2 - 30, 18, 60, 10);
    text(g, "CONFERÊNCIA DE CARGA", w / 2, 66, 17, BLK, { weight: "900", max: w - 40 }); text(g, "Bufê Lumière · NF 0412", w / 2, 88, 13, "#444", { weight: "600" });
    ["Câmara fria (3)", "Cubas inox (24)", "Taças (12 cx)", "Toalhas (6 fardos)", "Gelo (40 sacos)", "Flores (extra)", "Cases de luz (8)"].forEach((s, k) => { const y = 118 + k * 28; g.strokeStyle = "#333"; g.lineWidth = 2; g.strokeRect(26, y - 9, 16, 16); g.fillStyle = "#222"; g.textAlign = "left"; g.font = `500 15px ${SANS}`; g.fillText(s, 52, y); if (k < 5) { g.strokeStyle = "#1b3a8a"; g.lineWidth = 3; g.beginPath(); g.moveTo(28, y); g.lineTo(34, y + 6); g.lineTo(44, y - 10); g.stroke(); } });
    g.strokeStyle = "#333"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(30, h - 40); g.lineTo(w - 30, h - 40); g.stroke(); text(g, "Márcia", w / 2, h - 52, 22, "#1b3a8a", { font: HAND });
  }],
  ["hiVis", 1280, 1024, 256, 256, (g, w, h) => { g.fillStyle = "#c8f526"; g.fillRect(0, 0, w, h); for (const y of [h * 0.38, h * 0.62]) { g.fillStyle = "#c9cdd2"; g.fillRect(0, y, w, h * 0.08); g.fillStyle = "rgba(255,255,255,0.5)"; for (let x = 0; x < w; x += 6) g.fillRect(x, y + 2, 3, h * 0.08 - 4); } text(g, "STAFF", w / 2, h * 0.22, 34, "#1b1b1b", { weight: "900" }); }],
  ["cateringBox", 1536, 1024, 256, 256, (g, w, h) => { g.fillStyle = "#f1efe9"; g.fillRect(0, 0, w, h); g.fillStyle = "#b8913f"; g.beginPath(); g.arc(w / 2, h * 0.44, 46, Math.PI, 0); g.fill(); g.fillRect(w / 2 - 58, h * 0.44, 116, 8); g.beginPath(); g.arc(w / 2, h * 0.44 - 50, 7, 0, Math.PI * 2); g.fill(); text(g, "BUFÊ LUMIÈRE", w / 2, h * 0.68, 26, "#151515", { font: SERIF, weight: "400" }); text(g, "MANTER REFRIGERADO", w / 2, h * 0.84, 14, "#8a6c2f", { weight: "700" }); g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4); }],
  ["kraftBox", 1792, 1024, 256, 256, (g, w, h) => { g.fillStyle = "#b48d5d"; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 5) { g.fillStyle = "rgba(80,55,25,0.07)"; g.fillRect(x, 0, 2, h); } g.fillStyle = "rgba(225,210,170,0.85)"; g.fillRect(0, h * 0.45, w, 30); text(g, "FRÁGIL", w * 0.36, h * 0.2, 34, "rgba(20,20,20,0.85)", { weight: "900" }); g.fillStyle = "rgba(20,20,20,0.85)"; for (const dx of [0, 34]) { const x = w * 0.75 + dx, y = h * 0.78; g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x + 14, y - 8); g.lineTo(x + 5, y - 8); g.lineTo(x + 5, y + 22); g.lineTo(x - 5, y + 22); g.lineTo(x - 5, y - 8); g.lineTo(x - 14, y - 8); g.closePath(); g.fill(); } g.fillStyle = "#fff"; g.fillRect(20, h * 0.66, 100, 60); g.fillStyle = "#333"; for (let k = 0; k < 4; k++) g.fillRect(28, h * 0.66 + 10 + k * 12, 80 - k * 10, 4); }],
  /* ----- estênceis e etiquetas ----- */
  ["caseLight", 0, 1280, 512, 128, (g, w, h) => { text(g, "ILUMINAÇÃO · CASE 07", w / 2, h * 0.42, 44, "rgba(238,238,232,0.95)", { font: STEN, weight: "900", max: w - 30 }); text(g, "GALA LUMIÈRE · PRODUÇÃO", w / 2, h * 0.8, 22, "rgba(238,238,232,0.85)", { font: STEN, weight: "700" }); }],
  ["caseSound", 512, 1280, 512, 128, (g, w, h) => { text(g, "SOM · CASE 12", w / 2, h * 0.42, 48, "rgba(238,238,232,0.95)", { font: STEN, weight: "900", max: w - 30 }); text(g, "PA · LADO L", w / 2, h * 0.8, 24, "rgba(238,238,232,0.85)", { font: STEN, weight: "700" }); }],
  ["caseCostume", 1024, 1280, 512, 128, (g, w, h) => { text(g, "FIGURINO · CASE 21", w / 2, h * 0.42, 44, "rgba(238,238,232,0.95)", { font: STEN, weight: "900", max: w - 30 }); text(g, "DESFILE FINAL · AURORA", w / 2, h * 0.8, 22, "rgba(242,194,48,0.9)", { font: STEN, weight: "700" }); }],
  ["caseCables", 1536, 1280, 512, 128, (g, w, h) => { text(g, "CABOS · CASE 03", w / 2, h * 0.42, 48, "rgba(238,238,232,0.95)", { font: STEN, weight: "900", max: w - 30 }); text(g, "NÃO EMPILHAR SOBRE ESTE", w / 2, h * 0.8, 22, "rgba(238,238,232,0.85)", { font: STEN, weight: "700" }); }],
  ["artCrate", 0, 1408, 512, 256, (g, w, h) => {
    text(g, "MUSEU VESPER", w / 2, 36, 40, "rgba(18,18,18,0.88)", { font: STEN, weight: "900" }); text(g, "INSTITUTO DO TRAJE · OBRA 1957-04", w / 2, 78, 22, "rgba(18,18,18,0.85)", { font: STEN, weight: "800", max: w - 30 });
    g.fillStyle = "rgba(18,18,18,0.88)"; for (const dx of [-50, 0]) { const x = w / 2 + dx + 25, y = 150; g.beginPath(); g.moveTo(x, y - 34); g.lineTo(x + 18, y - 8); g.lineTo(x + 7, y - 8); g.lineTo(x + 7, y + 26); g.lineTo(x - 7, y + 26); g.lineTo(x - 7, y - 8); g.lineTo(x - 18, y - 8); g.closePath(); g.fill(); }
    text(g, "FRÁGIL · ESTE LADO PARA CIMA · MANTER SECO", w / 2, 206, 18, "rgba(18,18,18,0.85)", { font: STEN, weight: "800", max: w - 30 });
    g.fillStyle = "#f4f4f0"; g.fillRect(16, 116, 70, 70); g.fillStyle = "#d32f2f"; g.beginPath(); g.arc(51, 146, 18, 0, Math.PI * 2); g.fill(); g.fillStyle = "#222"; g.font = `700 10px ${SANS}`; g.textAlign = "center"; g.fillText("TILT", 51, 180);
    g.fillStyle = "#e3f2fd"; g.fillRect(w - 86, 116, 70, 70); for (let k = 0; k < 3; k++) { g.fillStyle = ["#90caf9", "#f8bbd0", "#90caf9"][k]; g.beginPath(); g.arc(w - 51, 132 + k * 20, 8, 0, Math.PI * 2); g.fill(); }
  }],
  ["gaffer0", 512, 1408, 256, 64, (g, w, h) => { g.fillStyle = "#ece9df"; g.fillRect(0, 6, w, h - 12); text(g, "LUZ PALCO", w / 2, h / 2 + 2, 30, "#111", { font: HAND, weight: "700" }); }],
  ["gaffer1", 512, 1472, 256, 64, (g, w, h) => { g.fillStyle = "#ece9df"; g.fillRect(0, 6, w, h - 12); text(g, "NÃO ABRIR!", w / 2, h / 2 + 2, 30, "#b3121e", { font: HAND, weight: "700" }); }],
  ["gaffer2", 512, 1536, 256, 64, (g, w, h) => { g.fillStyle = "#ece9df"; g.fillRect(0, 6, w, h - 12); text(g, "SOM L/R", w / 2, h / 2 + 2, 30, "#111", { font: HAND, weight: "700" }); }],
  ["gaffer3", 512, 1600, 256, 64, (g, w, h) => { g.fillStyle = "#ece9df"; g.fillRect(0, 6, w, h - 12); text(g, "DOCA → SALÃO", w / 2, h / 2 + 2, 28, "#111", { font: HAND, weight: "700" }); }],
  /* ----- marcas do piso (fundo transparente) ----- */
  ["hazard", 768, 1408, 512, 128, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 0, w, h); g.fillStyle = BLK; for (let x = -h; x < w + h; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 32, 0); g.lineTo(x + 32 - h, h); g.lineTo(x - h, h); g.closePath(); g.fill(); } wear(g, w, h, 761); }],
  ["lineYellow", 768, 1536, 256, 32, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 4, w, h - 8); wear(g, w, h, 762); }],
  ["lineWhite", 768, 1568, 256, 32, (g, w, h) => { g.fillStyle = "#eeeeea"; g.fillRect(0, 4, w, h - 8); wear(g, w, h, 763); }],
  ["arrow", 1024, 1536, 128, 128, (g, w, h) => { g.fillStyle = "#eeeeea"; g.beginPath(); g.moveTo(w / 2, 8); g.lineTo(w - 18, 56); g.lineTo(w / 2 + 16, 56); g.lineTo(w / 2 + 16, h - 8); g.lineTo(w / 2 - 16, h - 8); g.lineTo(w / 2 - 16, 56); g.lineTo(18, 56); g.closePath(); g.fill(); wear(g, w, h, 764); }],
  ["pedestres", 1152, 1536, 256, 96, (g, w, h) => { text(g, "PEDESTRES", w / 2, h / 2 + 4, 44, "#eeeeea", { font: STEN, weight: "900", max: w - 10 }); wear(g, w, h, 765); }],
  ["extFloor", 1280, 1408, 128, 128, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 0, w, h); g.fillStyle = RED; g.fillRect(14, 14, w - 28, h - 28); wear(g, w, h, 766); }],
  ["keepClear", 1408, 1408, 256, 256, (g, w, h) => { g.strokeStyle = YEL; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14); g.save(); g.beginPath(); g.rect(14, 14, w - 28, h - 28); g.clip(); g.lineWidth = 10; for (let k = -h; k < w; k += 36) { g.beginPath(); g.moveTo(k, h); g.lineTo(k + h, 0); g.stroke(); } g.restore(); g.fillStyle = "rgba(0,0,0,0.6)"; g.fillRect(40, h / 2 - 22, w - 80, 44); text(g, "NÃO OBSTRUIR", w / 2, h / 2 + 2, 28, YEL, { weight: "900" }); wear(g, w, h, 767); }],
  ["tire", 1664, 1408, 256, 256, (g, w) => { g.strokeStyle = "rgba(12,12,12,0.5)"; for (const [r, lw] of [[w * 0.8, 10], [w * 0.8 - 46, 10]] as [number, number][]) { g.lineWidth = lw; g.beginPath(); g.arc(-40, w * 1.05, r, -Math.PI * 0.45, -Math.PI * 0.05); g.stroke(); } }],
  ["palletBox", 0, 1664, 256, 256, (g, w, h) => { g.strokeStyle = "#eeeeea"; g.lineWidth = 12; const L = 60; for (const [x, y, sx, sy] of [[8, 8, 1, 1], [w - 8, 8, -1, 1], [8, h - 8, 1, -1], [w - 8, h - 8, -1, -1]]) { g.beginPath(); g.moveTo(x, y + sy * L); g.lineTo(x, y); g.lineTo(x + sx * L, y); g.stroke(); } wear(g, w, h, 768); }],
  ["stain", 256, 1664, 128, 128, (g, w, h) => { const r = rng(769); for (let k = 0; k < 8; k++) { const x = w / 2 + (r() - 0.5) * 50, y = h / 2 + (r() - 0.5) * 50, rad = 14 + r() * 30; const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, "rgba(10,9,7,0.5)"); grd.addColorStop(1, "rgba(10,9,7,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h); } }],
  ["vest", 384, 1664, 128, 192, (g, w, h) => { g.fillStyle = "#c8f526"; g.beginPath(); g.moveTo(14, 20); g.lineTo(44, 4); g.lineTo(54, 40); g.lineTo(74, 40); g.lineTo(84, 4); g.lineTo(114, 20); g.lineTo(118, h - 8); g.lineTo(10, h - 8); g.closePath(); g.fill(); for (const y of [h * 0.55, h * 0.75]) { g.fillStyle = "#cfd3d8"; g.fillRect(10, y, 108, 14); } g.fillStyle = "rgba(0,0,0,0.15)"; g.fillRect(62, 40, 4, h - 48); }],
  ["jacket", 512, 1664, 128, 192, (g, w, h) => { g.fillStyle = "#1c2433"; g.beginPath(); g.moveTo(10, 24); g.lineTo(46, 4); g.lineTo(64, 30); g.lineTo(82, 4); g.lineTo(118, 24); g.lineTo(122, h - 6); g.lineTo(6, h - 6); g.closePath(); g.fill(); g.fillStyle = "#e8e6df"; g.fillRect(16, h * 0.35, 30, 12); text(g, "SEGURANÇA", 64, h * 0.62, 13, "#e8e6df", { weight: "900" }); g.fillStyle = "rgba(255,255,255,0.15)"; g.fillRect(62, 30, 4, h - 36); }],
  ["electric", 768, 1664, 128, 128, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = YEL; g.strokeStyle = BLK; g.lineWidth = 7; g.beginPath(); g.moveTo(w / 2, 10); g.lineTo(w - 10, h - 30); g.lineTo(10, h - 30); g.closePath(); g.fill(); g.stroke(); g.fillStyle = BLK; g.beginPath(); g.moveTo(w / 2 + 6, 34); g.lineTo(w / 2 - 12, 66); g.lineTo(w / 2, 66); g.lineTo(w / 2 - 6, 88); g.lineTo(w / 2 + 12, 56); g.lineTo(w / 2, 56); g.closePath(); g.fill(); text(g, "PERIGO 220/380 V", w / 2, h - 13, 13, BLK, { weight: "900", max: w - 8 }); }],
  ["gateWarn", 896, 1664, 256, 96, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 0, w, h); g.strokeStyle = BLK; g.lineWidth = 5; g.strokeRect(4, 4, w - 8, h - 8); text(g, "PORTÃO AUTOMÁTICO", w / 2, h * 0.38, 22, BLK, { weight: "900", max: w - 20 }); text(g, "NÃO PERMANEÇA SOB A PORTA", w / 2, h * 0.72, 15, BLK, { weight: "800", max: w - 20 }); }],
  ["buttons", 896, 1760, 128, 160, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 0, w, h); for (const [k, c, s] of [[0, "#2e7d32", "ABRE"], [1, "#c62828", "PARA"], [2, "#212121", "FECHA"]] as [number, string, string][]) { const y = 30 + k * 44; g.fillStyle = "#333"; g.beginPath(); g.arc(36, y, 17, 0, Math.PI * 2); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(36, y, 13, 0, Math.PI * 2); g.fill(); text(g, s, 88, y, 16, BLK, { weight: "900" }); } }],
  ["apron", 640, 1664, 128, 192, (g, w, h) => { g.fillStyle = "#f2f0ea"; g.beginPath(); g.moveTo(30, 6); g.lineTo(98, 6); g.lineTo(98, 60); g.lineTo(118, 80); g.lineTo(110, h - 6); g.lineTo(18, h - 6); g.lineTo(10, 80); g.lineTo(30, 60); g.closePath(); g.fill(); g.fillStyle = "#b8913f"; g.fillRect(40, 96, 48, 6); text(g, "BUFÊ", 64, 120, 14, "#8a6c2f", { font: SERIF, weight: "400" }); }],
  // plaqueta de capacidade da empilhadeira patolada (com a numeração da frota da doca e os avisos), gasta nas bordas
  ["stacker", 1408, 1664, 384, 192, (g, w, h) => {
    g.fillStyle = YEL; g.fillRect(0, 0, w, h); g.strokeStyle = BLK; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = BLK; g.fillRect(10, 10, w - 20, 40); text(g, "EMPILHADEIRA ELÉTRICA  Nº 03", w / 2, 31, 22, YEL, { weight: "900", max: w - 40 });
    text(g, "CAPACIDADE 1.200 kg", w / 2, 80, 34, BLK, { weight: "900", max: w - 30 });
    text(g, "CENTRO DE CARGA 600 mm  ·  ELEVAÇÃO 1,6 m", w / 2, 113, 15, BLK, { weight: "800", max: w - 30 });
    g.save(); g.beginPath(); g.rect(10, 128, w - 20, 22); g.clip(); for (let x = -22; x < w; x += 28) { g.beginPath(); g.moveTo(x, 150); g.lineTo(x + 14, 150); g.lineTo(x + 36, 128); g.lineTo(x + 22, 128); g.closePath(); g.fill(); } g.restore();
    text(g, "SÓ OPERADOR TREINADO · NÃO TRANSPORTE PESSOAS", w / 2, 168, 14, BLK, { weight: "800", max: w - 30 });
    const r = rng(771); for (let k = 0; k < 26; k++) { g.fillStyle = `rgba(52,44,30,${0.05 + r() * 0.12})`; g.beginPath(); g.arc(r() * w, r() < 0.5 ? r() * 18 + h - 18 : r() * h, 2 + r() * 9, 0, Math.PI * 2); g.fill(); }
  }],
];
/** Desgaste da tinta do piso: falhas e riscos (transparência). */
function wear(g: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const r = rng(seed); g.save(); g.globalCompositeOperation = "destination-out";
  for (let k = 0; k < (w * h) / 220; k++) { g.globalAlpha = 0.25 + r() * 0.6; g.beginPath(); g.ellipse(r() * w, r() * h, 1 + r() * 5, 0.6 + r() * 2, r() * 3, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

/** A folha (lógica 2048 × 2048; 1024 no "low") e os retângulos UV de cada desenho. */
export function docaAtlas(q: Quality): { tex: THREE.CanvasTexture; rects: Record<string, Rect> } {
  return memo(`atlas-${q}`, () => {
    const s = q === "high" ? 1 : 0.5;
    const t = drawnTexture(`doca-atlas-${q}`, LW * s, LH * s, (g) => {
      g.clearRect(0, 0, LW * s, LH * s);
      for (const [, x, y, w, h, draw] of CELLS) { g.save(); g.scale(s, s); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip(); draw(g, w, h); g.restore(); }
    });
    t.anisotropy = 8;
    const rects: Record<string, Rect> = {};
    for (const [name, x, y, w, h] of CELLS) rects[name] = { u0: (x + 1) / LW, v0: 1 - (y + h - 1) / LH, u1: (x + w - 1) / LW, v1: 1 - (y + 1) / LH };
    return { tex: t, rects };
  });
}
