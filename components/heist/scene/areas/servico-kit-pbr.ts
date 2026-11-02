/*
 * MET Gala Heist v2 — superfícies PBR da área de serviço (ruído, gerador cor/relevo/rugosidade e as texturas): azulejo
 * branco com rejunte, cerâmica antiderrapante vermelha, granilite cinza com juntas, forro mineral removível com perfil
 * T, forro de PVC, drywall pintado com barra lavável e marcas de carrinho, vinílico técnico, pintura da segurança, piso
 * de palco preto em chapas parafusadas e parede preta dos bastidores (copiado e adaptado de interior-tex: `surface`).
 * Geradas no navegador, sem imagem baixada; chaves de cache com o prefixo da área ("srv-", "bk-", "seg-").
 * Saiu de servico-kit.ts sem mudança (servico-kit.ts continua reexportando tudo).
 */
import * as THREE from "three";
import { fbm, type Quality } from "../interior-tex";

/* ======================= ruído e superfícies PBR ======================= */
const FAKE = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);
/** Hash inteiro → [0, 1]. */
export function hsh(i: number, j: number, seed: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
/** Ruído de valor periódico (período p em células). */
export function vn(x: number, y: number, p: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const i0 = ((xi % p) + p) % p, j0 = ((yi % p) + p) % p, i1 = (i0 + 1) % p, j1 = (j0 + 1) % p;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hsh(i0, j0, seed), b = hsh(i1, j0, seed), c = hsh(i0, j1, seed), d = hsh(i1, j1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export interface Pbr { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }
/** out: r, g, b (0–1, sRGB), altura (0–1) e rugosidade (0–1). `v` = 0 é o TOPO da imagem (no mundo, uv.v = 1). */
type PixelFn = (u: number, v: number, out: Float32Array) => void;
const pbrs = new Map<string, Pbr>();
function cnv(w: number, h: number) { const c = document.createElement("canvas"); c.width = w; c.height = h; return { c, g: c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D }; }
function ctex(c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; return t;
}
/** Gera cor, relevo (normal pelo gradiente da altura, dando a volta na borda) e rugosidade de uma vez (w × h px). */
export function pbr(key: string, w: number, h: number, fn: PixelFn, bump = 1.5): Pbr {
  const hit = pbrs.get(key); if (hit) return hit;
  const W = FAKE ? 8 : w, H = FAKE ? 8 : h;
  const col = cnv(W, H), nor = cnv(W, H), rou = cnv(W, H);
  const ci = col.g.createImageData(W, H), ni = nor.g.createImageData(W, H), ri = rou.g.createImageData(W, H);
  const Hm = new Float32Array(W * H), out = new Float32Array(5);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    out[3] = 0.5; out[4] = 0.5; fn((x + 0.5) / W, (y + 0.5) / H, out);
    const k = (y * W + x) * 4;
    ci.data[k] = Math.max(0, Math.min(255, out[0] * 255)); ci.data[k + 1] = Math.max(0, Math.min(255, out[1] * 255)); ci.data[k + 2] = Math.max(0, Math.min(255, out[2] * 255)); ci.data[k + 3] = 255;
    const r = Math.max(0, Math.min(255, out[4] * 255)); ri.data[k] = r; ri.data[k + 1] = r; ri.data[k + 2] = r; ri.data[k + 3] = 255;
    Hm[y * W + x] = out[3];
  }
  const s = bump * W / 256;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const xl = (x - 1 + W) % W, xr = (x + 1) % W, yu = (y - 1 + H) % H, yd = (y + 1) % H;
    const dx = (Hm[y * W + xr] - Hm[y * W + xl]) * s, dy = (Hm[yd * W + x] - Hm[yu * W + x]) * s;
    const l = Math.hypot(dx, dy, 1), k = (y * W + x) * 4;
    ni.data[k] = (-dx / l * 0.5 + 0.5) * 255; ni.data[k + 1] = (dy / l * 0.5 + 0.5) * 255; ni.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[k + 3] = 255;
  }
  col.g.putImageData(ci, 0, 0); nor.g.putImageData(ni, 0, 0); rou.g.putImageData(ri, 0, 0);
  const sf = { map: ctex(col.c, true), normalMap: ctex(nor.c, false), roughnessMap: ctex(rou.c, false) };
  pbrs.set(key, sf); return sf;
}
/** Lascas de granilite (célula sorteada mais perto): índice da cor ou −1. */
function chip(u: number, v: number, cells: number, seed: number, fill: number, rMin: number, rMax: number): number {
  const x = u * cells, y = v * cells, xi = Math.floor(x), yi = Math.floor(y);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const ci = ((xi + dx) % cells + cells) % cells, cj = ((yi + dy) % cells + cells) % cells;
    if (hsh(ci, cj, seed) > fill) continue;
    const cx = xi + dx + hsh(ci, cj, seed + 7), cy = yi + dy + hsh(ci, cj, seed + 13), r = rMin + (rMax - rMin) * hsh(ci, cj, seed + 19);
    const a = hsh(ci, cj, seed + 3) * Math.PI, px = x - cx, py = y - cy, ra = px * Math.cos(a) + py * Math.sin(a), rb = -px * Math.sin(a) + py * Math.cos(a);
    if ((ra / (r * 1.35)) ** 2 + (rb / r) ** 2 < 1) return Math.floor(hsh(ci, cj, seed + 29) * 5);
  }
  return -1;
}
const big = (q: Quality) => (q === "high" ? 1024 : 512), mid = (q: Quality) => (q === "high" ? 512 : 256);

/** Azulejo branco 15 × 15 cm com rejunte de 3 mm e borda boleada do esmalte (textura = 0,6 × 0,6 m). */
export const texTileWhite = (q: Quality) => pbr(`srv-azulejo-${q}`, mid(q), mid(q), (u, v, o) => {
  const n = 4, x = u * n, y = v * n, i = Math.floor(x), j = Math.floor(y), lu = x - i, lv = y - j, e = Math.min(lu, 1 - lu, lv, 1 - lv);
  if (e < 0.011) { const d = fbm(u, v, 16, 23, 2); o[0] = 0.6 - 0.1 * d; o[1] = 0.59 - 0.1 * d; o[2] = 0.56 - 0.1 * d; o[3] = 0.15; o[4] = 0.92; return; }
  const edge = sm(0.011, 0.075, e), tone = hsh(i, j, 17), wav = fbm(u, v, 4, 19, 3), b = 0.89 + 0.04 * tone + 0.025 * (wav - 0.5);
  o[0] = b * 0.985; o[1] = b * 0.995; o[2] = b; o[3] = 0.3 + 0.22 * edge + 0.03 * wav; o[4] = 0.08 + 0.1 * (1 - edge) + 0.06 * wav;
}, 1.8);
/** Cerâmica técnica antiderrapante vermelha 15 × 15 cm, rejunte escuro de 5 mm, grão áspero (textura = 0,6 m). */
export const texQuarry = (q: Quality) => pbr(`srv-ceramica-${q}`, mid(q), mid(q), (u, v, o) => {
  const n = 4, x = u * n, y = v * n, i = Math.floor(x), j = Math.floor(y), lu = x - i, lv = y - j, e = Math.min(lu, 1 - lu, lv, 1 - lv);
  const grit = vn(u * 220, v * 220, 220, 31), grease = sm(0.5, 0.8, fbm(u, v, 3, 33, 3));
  if (e < 0.018) { o[0] = 0.17 + 0.03 * grit; o[1] = 0.16 + 0.03 * grit; o[2] = 0.15 + 0.03 * grit; o[3] = 0.12; o[4] = 0.96; return; }
  const tone = hsh(i, j, 37), edge = sm(0.018, 0.05, e), k = (0.82 + 0.22 * tone) * (0.93 + 0.1 * grit) * (1 - 0.18 * grease);
  o[0] = 0.64 * k; o[1] = 0.27 * k; o[2] = 0.17 * k; o[3] = 0.35 + 0.15 * edge + 0.1 * grit; o[4] = 0.62 + 0.2 * grit - 0.2 * grease;
}, 1.6);
/** Granilite cinza polido com lascas brancas, pretas e ocres e juntas plásticas a cada 1 m (textura = 2 × 2 m). */
export const texGranilite = (q: Quality) => pbr(`srv-granilite-${q}`, big(q), big(q), (u, v, o) => {
  const ju = Math.min(u % 0.5, 0.5 - (u % 0.5)), jv = Math.min(v % 0.5, 0.5 - (v % 0.5)), joint = Math.min(ju, jv) < 0.0018;
  const n = fbm(u, v, 6, 41, 4), wear = sm(0.42, 0.72, fbm(u, v, 3, 43, 3)), dirt = sm(0.55, 0.85, fbm(u, v, 5, 45, 3));
  let r = 0.6 + 0.05 * n, g = 0.6 + 0.05 * n, b = 0.585 + 0.05 * n, ro = 0.26 + 0.24 * wear, h = 0.5;
  const c1 = chip(u, v, 64, 47, 0.42, 0.2, 0.42), c = c1 >= 0 ? c1 : chip(u, v, 180, 49, 0.55, 0.18, 0.4);
  if (c >= 0) { const C = [[0.86, 0.85, 0.82], [0.12, 0.12, 0.13], [0.33, 0.33, 0.34], [0.62, 0.55, 0.44], [0.72, 0.71, 0.69]][c]; const t = 0.9 + 0.1 * n; r = C[0] * t; g = C[1] * t; b = C[2] * t; ro = 0.2 + 0.18 * wear; h = 0.52; }
  r *= 1 - 0.1 * dirt; g *= 1 - 0.1 * dirt; b *= 1 - 0.09 * dirt;
  if (joint) { r = 0.3; g = 0.3; b = 0.31; ro = 0.5; h = 0.38; }
  o[0] = r; o[1] = g; o[2] = b; o[3] = h; o[4] = ro;
}, 0.7);
/** Forro mineral removível 0,6 × 0,6 m em perfil T branco de 24 mm, com fissuras e furinhos (textura = 1,2 m). */
export const texCeilMineral = (q: Quality) => pbr(`srv-forro-mineral-${q}`, mid(q), mid(q), (u, v, o) => {
  const n = 2, x = u * n, y = v * n, lu = x - Math.floor(x), lv = y - Math.floor(y), e = Math.min(lu, 1 - lu, lv, 1 - lv);
  if (e < 0.02) { o[0] = 0.92; o[1] = 0.92; o[2] = 0.91; o[3] = 0.8; o[4] = 0.32; return; }
  if (e < 0.03) { o[0] = 0.4; o[1] = 0.4; o[2] = 0.4; o[3] = 0.25; o[4] = 0.9; return; }
  const f = Math.abs(vn(u * 70, v * 70, 70, 51) - 0.5) < 0.018 && vn(u * 30, v * 30, 30, 52) > 0.45, pin = vn(u * 300, v * 300, 300, 53) > 0.84;
  const b = 0.83 + 0.035 * fbm(u, v, 8, 55, 3) - 0.04 * (1 - sm(0.03, 0.2, e));
  o[0] = b * (f || pin ? 0.72 : 1); o[1] = b * (f || pin ? 0.72 : 1); o[2] = b * 0.985 * (f || pin ? 0.72 : 1); o[3] = 0.5 - (f ? 0.12 : 0) - (pin ? 0.1 : 0); o[4] = 0.95;
}, 1.2);
/** Forro de PVC da copa (lavável): réguas de 20 cm com friso em V (textura = 1,2 m). */
export const texCeilPvc = (q: Quality) => pbr(`srv-forro-pvc-${q}`, mid(q), mid(q), (u, v, o) => {
  const x = u * 6, lu = x - Math.floor(x), g = Math.min(lu, 1 - lu), groove = 1 - sm(0.006, 0.03, g), n = fbm(u, v, 6, 57, 2);
  const b = 0.9 + 0.025 * n - 0.32 * groove; o[0] = b; o[1] = b; o[2] = b * 0.99; o[3] = 0.5 - 0.3 * groove; o[4] = 0.3 + 0.3 * groove;
}, 1.4);
/** Drywall do corredor (textura = 3 × 3,6 m, alinhada com a altura): barra lavável acetinada até 1,1 m, tinta fosca em
 * cima, textura do rolo, marcas de rodas e alças de carrinho e sujeira perto do rodapé. */
export const texDrywallSrv = (q: Quality) => pbr(`srv-drywall-${q}`, big(q), big(q), (u, v, o) => {
  const y = 3.6 * (1 - v), st = fbm(u, v, 24, 61, 3), low = y < 1.1;
  let r = low ? 0.6 : 0.82, g = low ? 0.6 : 0.815, b = low ? 0.57 : 0.78, ro = low ? 0.48 : 0.86, h = 0.5 + 0.08 * (st - 0.5);
  r += 0.025 * (st - 0.5); g += 0.025 * (st - 0.5); b += 0.025 * (st - 0.5);
  if (Math.abs(y - 1.1) < 0.005) { r *= 0.75; g *= 0.75; b *= 0.75; }
  const band = sm(0.1, 0.18, y) * (1 - sm(0.48, 0.58, y)) + 0.8 * sm(0.76, 0.82, y) * (1 - sm(0.98, 1.05, y));
  if (band > 0) {
    // marcas esparsas: só em alguns trechos da parede (onde os carrinhos raspam), riscos finos e borracha preta curta
    const zone = sm(0.52, 0.72, fbm(u * 2, v * 0.5, 4, 65, 2)), streak = sm(0.72, 0.9, vn(u * 9, y * 80, 9, 67)) * zone, rub = sm(0.9, 0.965, vn(u * 22, y * 40, 22, 71)) * zone;
    const dk = band * (streak * 0.26 + rub * 0.5);
    r *= 1 - dk; g *= 1 - dk; b *= 1 - dk * 0.95; ro = mix(ro, 0.72, band * streak); h -= 0.06 * band * streak;
  }
  const grime = (1 - sm(0, 0.3, y)) * 0.3 * fbm(u, v, 14, 73, 3); r *= 1 - grime; g *= 1 - grime; b *= 1 - grime;
  o[0] = r; o[1] = g; o[2] = b; o[3] = h; o[4] = ro;
}, 0.6);
/** Vinílico técnico da segurança: placas de 60 cm com veio em direções alternadas e respingos (textura = 1,2 m). */
export const texVinyl = (q: Quality) => pbr(`seg-vinilico-${q}`, mid(q), mid(q), (u, v, o) => {
  const n = 2, x = u * n, y = v * n, i = Math.floor(x), j = Math.floor(y), lu = x - i, lv = y - j, e = Math.min(lu, 1 - lu, lv, 1 - lv);
  if (e < 0.004) { o[0] = 0.32; o[1] = 0.33; o[2] = 0.34; o[3] = 0.35; o[4] = 0.7; return; }
  const rot = (i + j) % 2 === 1, a = rot ? lv : lu, bb = rot ? lu : lv, vein = sm(0.55, 0.85, vn(a * 3 + i * 7, bb * 26, 64, 81)), tone = hsh(i, j, 83);
  const sp = vn(u * 240, v * 240, 240, 85), dark = sp > 0.9, light = sp < 0.07;
  let b = 0.6 + 0.04 * tone - 0.03 * vein; if (dark) b -= 0.1; if (light) b += 0.07;
  o[0] = b * 0.98; o[1] = b; o[2] = b * 1.03; o[3] = 0.5 + 0.02 * vein; o[4] = 0.42 + 0.12 * fbm(u, v, 4, 87, 2);
}, 0.5);
/** Pintura técnica da segurança (textura = 2 × 3,2 m): barra grafite até 1,05 m e cinza-azulado fosco em cima. */
export const texPaintSeg = (q: Quality) => pbr(`seg-pintura-${q}`, mid(q), mid(q) * 2, (u, v, o) => {
  const y = 3.2 * (1 - v), st = fbm(u, v, 16, 91, 3), low = y < 1.05;
  const r = (low ? 0.17 : 0.34) + 0.02 * (st - 0.5), g = (low ? 0.18 : 0.37) + 0.02 * (st - 0.5), b = (low ? 0.2 : 0.41) + 0.02 * (st - 0.5);
  const line = Math.abs(y - 1.05) < 0.006 ? 0.7 : 1;
  o[0] = r * line; o[1] = g * line; o[2] = b * line; o[3] = 0.5 + 0.06 * (st - 0.5); o[4] = low ? 0.55 : 0.85;
}, 0.5);
/** Piso de palco dos bastidores: duas chapas pretas de 1,22 × 2,44 m parafusadas, desgaste e arranhões (textura = 2,44 m). */
export const texStage = (q: Quality) => pbr(`bk-palco-${q}`, big(q), big(q), (u, v, o) => {
  const X = u * 2.44, Y = v * 2.44, sx = X % 1.22, seam = Math.min(sx, 1.22 - sx) < 0.0016 || Math.min(Y, 2.44 - Y) < 0.0016;
  const near = (d: number) => d < 0.0045;
  let screw = false;
  for (const ex of [0.022, 1.198]) if (Math.abs(sx - ex) < 0.006) { const k = (Y + 0.15) % 0.3; if (near(Math.hypot(sx - ex, Math.min(k, 0.3 - k)))) screw = true; }
  const sc = sm(0.6, 0.86, fbm(u * 1.5, v * 0.6, 6, 101, 4)), scratch = sm(0.9, 0.97, vn(u * 120, v * 9, 120, 103)), wear = sm(0.62, 0.9, fbm(u, v, 3, 105, 3));
  const chipB = vn(u * 160, v * 160, 160, 107) > 0.93 && wear > 0.3;
  let b = 0.035 + 0.02 * fbm(u, v, 12, 109, 3) + 0.07 * sc + 0.05 * wear + 0.1 * scratch;
  let r = b, g = b, bl = b * 1.06, ro = 0.5 + 0.25 * sc + 0.15 * scratch, h = 0.5 - 0.05 * scratch;
  if (chipB) { r = 0.24; g = 0.17; bl = 0.11; ro = 0.9; h = 0.42; }
  if (screw) { r = g = bl = 0.18; ro = 0.4; h = 0.3; }
  if (seam) { r = g = bl = 0.01; ro = 0.95; h = 0.25; }
  o[0] = r; o[1] = g; o[2] = bl; o[3] = h; o[4] = ro;
}, 0.8);
/** Parede preta dos bastidores (textura = 2,5 × 4,6 m): tinta fosca com marcas de rolo, esfolados embaixo e restos de fita. */
export const texWallBk = (q: Quality) => pbr(`bk-parede-${q}`, mid(q), mid(q) * 2, (u, v, o) => {
  const y = 4.6 * (1 - v), roll = vn(u * 36, v * 3, 36, 111), n = fbm(u, v, 10, 113, 3);
  const scuff = (1 - sm(0.8, 1.4, y)) * sm(0.62, 0.85, fbm(u * 2, v, 8, 115, 3)), tx = Math.floor(u * 9), ty = Math.floor(v * 7);
  const tape = hsh(tx, ty, 117) > 0.9 && Math.abs((u * 9) % 1 - 0.5) < 0.12 && Math.abs((v * 7) % 1 - 0.5) < 0.03;
  let b = 0.03 + 0.012 * n + 0.012 * roll + 0.09 * scuff; if (tape) b = 0.2;
  o[0] = b; o[1] = b; o[2] = b * 1.05; o[3] = 0.5 + 0.03 * roll + (tape ? 0.04 : 0); o[4] = tape ? 0.6 : 0.9 - 0.15 * scuff;
}, 0.5);
