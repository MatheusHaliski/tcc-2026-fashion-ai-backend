/*
 * MET Gala Heist v2 — ferramentas da área de serviço (bastidores Z11, labirinto de serviço e copa Z10, sala de segurança
 * Z09), usadas pelos três módulos dela:
 *  - superfícies PBR próprias (cor, relevo e rugosidade gerados no navegador, sem imagem baixada): azulejo branco com
 *    rejunte, cerâmica antiderrapante vermelha, granilite cinza com juntas, forro mineral removível com perfil T, forro de
 *    PVC, drywall pintado com barra lavável e marcas de carrinho, vinílico técnico, pintura da segurança, piso de palco
 *    preto em chapas parafusadas e parede preta dos bastidores (copiado e adaptado de interior-tex: `surface`);
 *  - um referencial local (Fr) para montar móveis com espessura, perfis e chanfros em lotes e instâncias;
 *  - a leitura das faces de parede, quinas e vãos de piso do labirinto (rodapés, para-choques, cantoneiras, azulejos e o
 *    forro a 3,2 m), a partir da grade de 0,5 m do mundo (lib/heist/world.ts, só leitura);
 *  - o atlas das placas da área (um material só para toda a sinalização) com os textos nos três idiomas do cenário.
 * Chaves de cache sempre com o prefixo da área ("srv-", "bk-", "seg-").
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { CELL, GH, GW, X0, Z0, buildWorld } from "@/lib/heist/world";
import { MAZE, ROOMS } from "@/lib/heist/level";
import { BOX0, CYL, CYL0, SPH, geo, mat, mul, type Batch, type Instances } from "../interior-batch";
import { miscMat, solid } from "../interior-mats";
import { COPY, type InteriorCopy, type SceneLocale } from "../interior-copy";
import { HAND, SANS, drawnTexture, fbm, fit, type Quality } from "../interior-tex";
import type { LightAnchor } from "../interior-props";
import type { InteriorRoom } from "../interior-shell";

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
  o[0] = 0.56 * k; o[1] = 0.23 * k; o[2] = 0.14 * k; o[3] = 0.35 + 0.15 * edge + 0.1 * grit; o[4] = 0.62 + 0.2 * grit - 0.2 * grease;
}, 1.6);
/** Granilite cinza polido com lascas brancas, pretas e ocres e juntas plásticas a cada 1 m (textura = 2 × 2 m). */
export const texGranilite = (q: Quality) => pbr(`srv-granilite-${q}`, big(q), big(q), (u, v, o) => {
  const ju = Math.min(u % 0.5, 0.5 - (u % 0.5)), jv = Math.min(v % 0.5, 0.5 - (v % 0.5)), joint = Math.min(ju, jv) < 0.0018;
  const n = fbm(u, v, 6, 41, 4), wear = sm(0.42, 0.72, fbm(u, v, 3, 43, 3)), dirt = sm(0.55, 0.85, fbm(u, v, 5, 45, 3));
  let r = 0.47 + 0.05 * n, g = 0.47 + 0.05 * n, b = 0.46 + 0.05 * n, ro = 0.26 + 0.24 * wear, h = 0.5;
  const c1 = chip(u, v, 64, 47, 0.42, 0.2, 0.42), c = c1 >= 0 ? c1 : chip(u, v, 180, 49, 0.55, 0.18, 0.4);
  if (c >= 0) { const C = [[0.86, 0.85, 0.82], [0.12, 0.12, 0.13], [0.33, 0.33, 0.34], [0.62, 0.55, 0.44], [0.72, 0.71, 0.69]][c]; const t = 0.9 + 0.1 * n; r = C[0] * t; g = C[1] * t; b = C[2] * t; ro = 0.2 + 0.18 * wear; h = 0.52; }
  r *= 1 - 0.16 * dirt; g *= 1 - 0.16 * dirt; b *= 1 - 0.15 * dirt;
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

/* ======================= materiais da área ======================= */
const mats = new Map<string, THREE.Material>();
export function once<T extends THREE.Material>(key: string, make: () => T): T { const hit = mats.get(key) as T | undefined; if (hit) return hit; const m = make(); m.name = key; mats.set(key, m); return m; }
/** Material com superfície PBR da área (tinta, metal, relevo e cores por vértice opcionais). */
export function pbrMat(key: string, sf: Pbr, o: { tint?: string; metal?: number; rough?: number; normal?: number; vertex?: boolean; env?: number; offset?: boolean } = {}): THREE.MeshStandardMaterial {
  return once(key, () => new THREE.MeshStandardMaterial({
    map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, normalScale: new THREE.Vector2(o.normal ?? 1, o.normal ?? 1),
    color: new THREE.Color(o.tint ?? "#ffffff"), metalness: o.metal ?? 0, roughness: o.rough ?? 1, vertexColors: o.vertex ?? false, envMapIntensity: o.env ?? 1,
    polygonOffset: !!o.offset, polygonOffsetFactor: o.offset ? -1 : 0, polygonOffsetUnits: o.offset ? -1 : 0,
  }));
}
/** Paleta da área: metais, plásticos, borrachas e tintas (chaves "srv-"). */
export function SM(q: Quality) {
  return {
    inox: miscMat("brushed", q, "#d5d9dd", { metal: 1, env: 1.2 }),
    inoxDark: miscMat("brushed", q, "#8d9298", { metal: 1, env: 1 }),
    galv: solid("srv-galv", "#9da3a6", { metal: 0.85, rough: 0.48 }),
    alu: solid("srv-alu", "#c4c8cc", { metal: 0.9, rough: 0.32 }),
    chrome: solid("srv-chrome", "#e4e6e8", { metal: 1, rough: 0.1 }),
    steelBlack: solid("srv-steelBlack", "#1d1f22", { metal: 0.6, rough: 0.45 }),
    paintRed: solid("srv-paintRed", "#b3141b", { metal: 0.3, rough: 0.35 }),
    paintGrey: solid("srv-paintGrey", "#6b7177", { metal: 0.3, rough: 0.5 }),
    paintCream: solid("srv-paintCream", "#d9d5c8", { metal: 0.2, rough: 0.45 }),
    paintWhite: solid("srv-paintWhite", "#eceae4", { metal: 0.1, rough: 0.4 }),
    paintYellow: solid("srv-paintYellow", "#e7b21a", { rough: 0.55 }),
    pipeRed: solid("srv-pipeRed", "#a3191d", { metal: 0.35, rough: 0.42 }),
    rubber: solid("srv-rubber", "#141415", { rough: 0.92 }),
    rubberGrey: solid("srv-rubberGrey", "#3b3d40", { rough: 0.85 }),
    vinylGrey: solid("srv-vinylGrey", "#8e9296", { rough: 0.55 }),
    vinylDark: solid("srv-vinylDark", "#4a4e53", { rough: 0.5 }),
    plasticWhite: solid("srv-plasticWhite", "#e6e6e1", { rough: 0.38 }),
    plasticBlack: solid("srv-plasticBlack", "#1a1b1d", { rough: 0.42 }),
    plasticGrey: solid("srv-plasticGrey", "#6f7378", { rough: 0.45 }),
    plasticBlue: solid("srv-plasticBlue", "#1f4f8f", { rough: 0.45 }),
    plasticRed: solid("srv-plasticRed", "#b5191f", { rough: 0.42 }),
    plasticGreen: solid("srv-plasticGreen", "#2c6b3a", { rough: 0.45 }),
    plasticYellow: solid("srv-plasticYellow", "#f1c21b", { rough: 0.45 }),
    opal: solid("srv-opal", "#f4f7fb", { rough: 0.3, emissive: "#eef4ff", emissiveIntensity: 1.6 }),
    opalWarm: solid("srv-opalWarm", "#fff3df", { rough: 0.3, emissive: "#ffe9c4", emissiveIntensity: 1.5 }),
    poly: solid("srv-poly", "#c9ced2", { rough: 0.25, transparent: true, opacity: 0.55 }),
    glassDark: solid("srv-glassDark", "#1b2229", { metal: 0.3, rough: 0.08, env: 1.4 }),
    white: solid("srv-white", "#f1f0ec", { rough: 0.55 }),
    porcelain: solid("srv-porcelain", "#f6f5f1", { rough: 0.16, env: 1.2 }),
    cardboard: solid("srv-cardboard", "#9d7a52", { rough: 0.95 }),
    paper: solid("srv-paper", "#efece4", { rough: 0.9 }),
    wood: miscMat("grain", q, "#8a6844"),
    cork: solid("srv-cork", "#a8794d", { rough: 0.95 }),
    cable: solid("srv-cable", "#121213", { rough: 0.6 }),
    cableGrey: solid("srv-cableGrey", "#5d6166", { rough: 0.55 }),
    brass: solid("srv-brass", "#b8933f", { metal: 1, rough: 0.3 }),
    fabricBlack: solid("srv-fabricBlack", "#121214", { rough: 0.95 }),
    glassClear: solid("srv-glassClear", "#dbe6ea", { rough: 0.04, env: 1.6, transparent: true, opacity: 0.32 }),
    stripPvc: solid("srv-stripPvc", "#cfe0e6", { rough: 0.15, env: 1.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  };
}
export type SPalette = ReturnType<typeof SM>;

/* ======================= referencial local ======================= */
/** Lote e instâncias de uma sala (o que RoomsCtx e PropsCtx têm em comum). */
export interface Sink { batch: Batch; inst: Instances }
/** Peças num referencial local (a frente do móvel olha para +z local): caixas com a base em y, cilindros, geometrias. */
export class Fr {
  constructor(readonly c: Sink, readonly room: string, readonly at: THREE.Matrix4) {}
  static at(c: Sink, room: string, x: number, y: number, z: number, ry = 0) { return new Fr(c, room, mat(x, y, z, ry)); }
  /** sub-referencial (gaveta, porta, prateleira…) */
  sub(x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) { return new Fr(this.c, this.room, mul(this.at, mat(x, y, z, ry, 1, 1, 1, rx, rz))); }
  m(x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) { return mul(this.at, mat(x, y, z, ry, sx, sy, sz, rx, rz)); }
  /** caixa: base em y, largura x, altura y, profundidade z */
  box(m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, cast = false) { this.c.batch.add(this.room, m, BOX0(), this.m(x, y, z, ry, sx, sy, sz), { cast }); }
  /** caixa de cantos boleados (raio r) */
  rbox(m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, r = 0.01, ry = 0, cast = false) { this.c.batch.add(this.room, m, rbox(sx, sy, sz, r), this.m(x, y, z, ry), { cast }); }
  /** cilindro em pé com a base em y */
  cyl(m: THREE.Material, x: number, y: number, z: number, r: number, h: number, seg = 16) { this.c.batch.add(this.room, m, CYL0(seg), this.m(x, y, z, 0, r, h, r)); }
  /** cilindro deitado ao longo de x (centrado) */
  cylX(m: THREE.Material, x: number, y: number, z: number, r: number, len: number, seg = 12) { this.c.batch.add(this.room, m, CYL(seg), this.m(x, y, z, 0, r, len, r, 0, Math.PI / 2)); }
  /** cilindro deitado ao longo de z (centrado) */
  cylZ(m: THREE.Material, x: number, y: number, z: number, r: number, len: number, seg = 12) { this.c.batch.add(this.room, m, CYL(seg), this.m(x, y, z, 0, r, len, r, Math.PI / 2)); }
  /** geometria qualquer */
  g(m: THREE.Material, g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0, cast = false) { this.c.batch.add(this.room, m, g, this.m(x, y, z, ry, sx, sy, sz, rx, rz), { cast }); }
  /** peça repetida (instância) */
  i(key: string, g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0, color?: THREE.Color) { this.c.inst.add(this.room, key, g, m, this.m(x, y, z, ry, sx, sy, sz, rx, rz), color); }
  /** ponto do mundo */
  p(x: number, y: number, z: number) { return new THREE.Vector3(x, y, z).applyMatrix4(this.at); }
}
/** Caixa boleada com a base em y = 0 (uma geometria por medida). */
export function rbox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const k = (n: number) => n.toFixed(3);
  return geo(`srv-rbox-${k(w)}-${k(h)}-${k(d)}-${k(r)}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)).translate(0, h / 2, 0));
}
/** Torneado (perfil [raio, altura]) com chave da área. */
export const lathe = (key: string, pts: [number, number][], seg = 18) => geo(`srv-lathe-${key}`, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg));
/** Tubo por pontos (cabos, mangueiras, alças). */
export const tube = (pts: [number, number, number][], r: number, seg = 24, rad = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z))), seg, r, rad, false);
/** Luz-âncora a partir de um ponto do mundo (para PropsCtx e RoomsCtx). */
export function light(c: { anchors: LightAnchor[] }, room: InteriorRoom, p: THREE.Vector3, color: string, intensity: number, distance: number, o: Partial<LightAnchor> = {}) { c.anchors.push({ x: p.x, y: p.y, z: p.z, color, intensity, distance, room, ...o }); }
export const SPHg = (seg = 10) => SPH(seg);

/* ======================= o labirinto lido da grade ======================= */
export type MazeRoom = "servico" | "seguranca";
/** Face de parede que dá para o piso: plano x = const (axis "x", vai de z a até b) ou z = const (axis "z", vai de x a até b);
 * `dir` = para onde a face olha; `outer` = parede do prédio (3,6 m), senão divisória (3,2 m). */
export interface WFace { axis: "x" | "z"; plane: number; dir: 1 | -1; a: number; b: number; room: MazeRoom; outer: boolean }
/** Quina saliente (canto vivo de parede entre dois lados de piso): vértice e o quadrante do piso (sx, sz). */
export interface WCorner { x: number; z: number; sx: number; sz: number; room: MazeRoom }
export interface FloorRect { x0: number; z0: number; x1: number; z1: number; room: MazeRoom; zone: string }
export interface MazeInfo { faces: WFace[]; corners: WCorner[]; floors: FloorRect[] }
/** Célula do labirinto (coluna, linha) de um ponto. */
export const mazeCellOf = (x: number, z: number): [number, number] => [Math.max(0, Math.min(MAZE.cols - 1, Math.floor((x - MAZE.x0) / MAZE.cell))), Math.max(0, Math.min(MAZE.rows - 1, Math.floor((z - MAZE.z0) / MAZE.cell)))];
/** Zonas de acabamento da copa (azulejo, cerâmica e forro de PVC) por célula do labirinto. */
export const COPA_ZONES: Record<string, [number, number][]> = {
  cozinha: [[0, 0], [1, 0], [0, 1], [0, 2], [1, 1], [1, 2], [2, 1], [2, 2], [0, 3], [1, 3]],
  montagem: [[3, 6], [4, 6]], bar: [[3, 8]], lavagem: [[3, 3]],
};
export function zoneOf(x: number, z: number): string {
  const [c, r] = mazeCellOf(x, z);
  for (const [k, cells] of Object.entries(COPA_ZONES)) if (cells.some(([a, b]) => a === c && b === r)) return k;
  return "corredor";
}
let mazeCache: MazeInfo | null = null;
export function mazeInfo(): MazeInfo {
  if (mazeCache) return mazeCache;
  const w = buildWorld(), idx = (i: number, j: number) => j * GW + i;
  const sec = ROOMS.find((r) => r.id === "seguranca")!.rect, srv = ROOMS.find((r) => r.id === "servico")!.rect;
  const cx = (i: number) => X0 + (i + 0.5) * CELL, cz = (j: number) => Z0 + (j + 0.5) * CELL;
  const inR = (r: { x0: number; z0: number; x1: number; z1: number }, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
  const floorRoom = (i: number, j: number): MazeRoom | null => {
    if (i < 0 || j < 0 || i >= GW || j >= GH || w.grid[idx(i, j)] !== 1) return null;
    const x = cx(i), z = cz(j); return inR(sec, x, z) ? "seguranca" : inR(srv, x, z) ? "servico" : null;
  };
  const isWall = (i: number, j: number) => i >= 0 && j >= 0 && i < GW && j < GH && w.grid[idx(i, j)] === 0;
  const i0 = Math.round((srv.x0 - X0) / CELL) - 1, i1 = Math.round((srv.x1 - X0) / CELL), j0 = Math.round((srv.z0 - Z0) / CELL) - 1, j1 = Math.round((srv.z1 - Z0) / CELL);
  // faces: por célula de piso e lado com parede; depois junta as vizinhas no mesmo plano
  const runs = new Map<string, { f: Omit<WFace, "a" | "b">; iv: [number, number][] }>();
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const room = floorRoom(i, j); if (!room) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (!isWall(i + di, j + dj)) continue;
      const nx = cx(i + di), nz = cz(j + dj), outer = !inR(srv, nx, nz) || nx < srv.x0 || nx > srv.x1 || nz < srv.z0 || nz > srv.z1;
      const axis = di !== 0 ? "x" : "z", plane = axis === "x" ? X0 + (i + (di > 0 ? 1 : 0)) * CELL : Z0 + (j + (dj > 0 ? 1 : 0)) * CELL;
      const dir = (axis === "x" ? -di : -dj) as 1 | -1, a = axis === "x" ? Z0 + j * CELL : X0 + i * CELL;
      const key = `${axis}|${plane.toFixed(3)}|${dir}|${room}|${outer}`;
      let e = runs.get(key); if (!e) { e = { f: { axis, plane, dir, room, outer }, iv: [] }; runs.set(key, e); } e.iv.push([a, a + CELL]);
    }
  }
  const faces: WFace[] = [];
  for (const { f, iv } of runs.values()) {
    iv.sort((p, q) => p[0] - q[0]);
    let cur: [number, number] | null = null;
    for (const s of iv) { if (cur && Math.abs(cur[1] - s[0]) < 1e-6) cur[1] = s[1]; else { if (cur) faces.push({ ...f, a: cur[0], b: cur[1] }); cur = [s[0], s[1]]; } }
    if (cur) faces.push({ ...f, a: cur[0], b: cur[1] });
  }
  // quinas salientes: célula de parede com piso dos dois lados perpendiculares e na diagonal
  const corners: WCorner[] = [];
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (!isWall(i, j)) continue;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const a = floorRoom(i + sx, j), b = floorRoom(i, j + sz), d = floorRoom(i + sx, j + sz);
      if (a && b && d && a === b && b === d) corners.push({ x: X0 + (i + (sx > 0 ? 1 : 0)) * CELL, z: Z0 + (j + (sz > 0 ? 1 : 0)) * CELL, sx, sz, room: a });
    }
  }
  // vãos de piso (para o forro): faixas por linha da grade, por sala e zona, juntadas na vertical
  const floors: FloorRect[] = [];
  let open: FloorRect[] = [];
  for (let j = j0; j <= j1; j++) {
    const row: FloorRect[] = [];
    let s: FloorRect | null = null;
    for (let i = i0; i <= i1 + 1; i++) {
      const room = i <= i1 ? floorRoom(i, j) : null, zone = room === "servico" ? zoneOf(cx(i), cz(j)) : room ?? "";
      if (s && (room !== s.room || zone !== s.zone)) { row.push(s); s = null; }
      if (room && !s) s = { x0: X0 + i * CELL, x1: X0 + (i + 1) * CELL, z0: Z0 + j * CELL, z1: Z0 + (j + 1) * CELL, room, zone };
      else if (room && s) s.x1 = X0 + (i + 1) * CELL;
    }
    const next: FloorRect[] = [];
    for (const r of row) {
      const k = open.findIndex((o) => Math.abs(o.x0 - r.x0) < 1e-6 && Math.abs(o.x1 - r.x1) < 1e-6 && o.room === r.room && o.zone === r.zone && Math.abs(o.z1 - r.z0) < 1e-6);
      if (k >= 0) { const o = open.splice(k, 1)[0]; o.z1 = r.z1; next.push(o); } else next.push(r);
    }
    floors.push(...open); open = next;
  }
  floors.push(...open);
  mazeCache = { faces, corners, floors };
  return mazeCache;
}

/* ======================= textos e placas ======================= */
export interface SrvText {
  copa: string; kitchen: string; dish: string; bar: string; cold: string; toHall: string; toDock: string; toSec: string; toKitchen: string;
  noSmoking: string; hairnet: string; handWash: string; wetFloor: [string, string]; hot: [string, string]; keepClear: string; extinguisher: string; hose: string;
  alarm: string; stageEntry: string; quickChange: string; wardrobe: string; makeup: string; production: string; monitoring: string; highVoltage: [string, string];
  orders: string[]; duty: string[]; drinks: string[]; temp: string[]; staffEntrance: string;
}
export const SRV_TEXT: Record<SceneLocale, SrvText> = {
  "pt-BR": {
    copa: "COPA DE MONTAGEM", kitchen: "COZINHA DO BUFÊ", dish: "LAVAGEM", bar: "BAR DE SERVIÇO", cold: "CÂMARA FRIA", toHall: "GRANDE SALÃO", toDock: "DOCA · SAÍDA", toSec: "SEGURANÇA", toKitchen: "COZINHA",
    noSmoking: "PROIBIDO FUMAR", hairnet: "USO OBRIGATÓRIO DE TOUCA", handWash: "LAVE AS MÃOS", wetFloor: ["CUIDADO", "PISO MOLHADO"], hot: ["ATENÇÃO", "SUPERFÍCIE QUENTE"],
    keepClear: "MANTENHA O CORREDOR LIVRE", extinguisher: "EXTINTOR", hose: "HIDRANTE", alarm: "ALARME DE INCÊNDIO", stageEntry: "ENTRADA DE CENA", quickChange: "TROCA RÁPIDA",
    wardrobe: "FIGURINO", makeup: "CAMARIM", production: "PRODUÇÃO", monitoring: "CENTRAL DE MONITORAMENTO", highVoltage: ["PERIGO", "ALTA TENSÃO"],
    orders: ["PEDIDOS · GALA LUMIÈRE", "22:00  canapés frios — 320", "22:30  mini risoto — 180", "23:00  sobremesas — 300", "bar: +6 cx espumante", "mesa 4: sem glúten!"],
    duty: ["ESCALA DE PLANTÃO", "Nunes — supervisor", "Rui — labirinto sul", "Otávio — duto / norte", "Cida — copa", "troca de turno 23:10"],
    drinks: ["DRINQUES DA NOITE", "Lumière Spritz", "Aurora Sour", "Vesper Negroni", "Orvalho sem álcool"],
    temp: ["CONTROLE DE TEMPERATURA", "18h  2 °C   ok", "20h  3 °C   ok", "22h  3 °C   ok"], staffEntrance: "ACESSO DA EQUIPE",
  },
  en: {
    copa: "PLATING PANTRY", kitchen: "CATERING KITCHEN", dish: "DISHWASH", bar: "SERVICE BAR", cold: "WALK-IN COOLER", toHall: "GREAT HALL", toDock: "DOCK · EXIT", toSec: "SECURITY", toKitchen: "KITCHEN",
    noSmoking: "NO SMOKING", hairnet: "HAIR NETS REQUIRED", handWash: "WASH YOUR HANDS", wetFloor: ["CAUTION", "WET FLOOR"], hot: ["CAUTION", "HOT SURFACE"],
    keepClear: "KEEP CORRIDOR CLEAR", extinguisher: "FIRE EXTINGUISHER", hose: "FIRE HOSE", alarm: "FIRE ALARM", stageEntry: "STAGE ENTRANCE", quickChange: "QUICK CHANGE",
    wardrobe: "WARDROBE", makeup: "MAKEUP", production: "PRODUCTION", monitoring: "MONITORING CENTER", highVoltage: ["DANGER", "HIGH VOLTAGE"],
    orders: ["ORDERS · GALA LUMIÈRE", "22:00  cold canapés — 320", "22:30  mini risotto — 180", "23:00  desserts — 300", "bar: +6 cases bubbly", "table 4: gluten free!"],
    duty: ["DUTY ROSTER", "Nunes — supervisor", "Rui — south maze", "Otávio — vent / north", "Cida — pantry", "shift change 23:10"],
    drinks: ["TONIGHT'S DRINKS", "Lumière Spritz", "Aurora Sour", "Vesper Negroni", "Orvalho (alcohol free)"],
    temp: ["TEMPERATURE LOG", "6 PM  2 °C  ok", "8 PM  3 °C  ok", "10 PM  3 °C  ok"], staffEntrance: "STAFF ENTRANCE",
  },
  es: {
    copa: "OFFICE DE MONTAJE", kitchen: "COCINA DEL CATERING", dish: "LAVADO", bar: "BAR DE SERVICIO", cold: "CÁMARA FRIGORÍFICA", toHall: "GRAN SALÓN", toDock: "MUELLE · SALIDA", toSec: "SEGURIDAD", toKitchen: "COCINA",
    noSmoking: "PROHIBIDO FUMAR", hairnet: "USO OBLIGATORIO DE COFIA", handWash: "LÁVESE LAS MANOS", wetFloor: ["CUIDADO", "PISO MOJADO"], hot: ["ATENCIÓN", "SUPERFICIE CALIENTE"],
    keepClear: "MANTENGA EL PASILLO LIBRE", extinguisher: "EXTINTOR", hose: "HIDRANTE", alarm: "ALARMA DE INCENDIO", stageEntry: "ENTRADA A ESCENA", quickChange: "CAMBIO RÁPIDO",
    wardrobe: "VESTUARIO", makeup: "MAQUILLAJE", production: "PRODUCCIÓN", monitoring: "CENTRAL DE MONITOREO", highVoltage: ["PELIGRO", "ALTA TENSIÓN"],
    orders: ["PEDIDOS · GALA LUMIÈRE", "22:00  canapés fríos — 320", "22:30  mini risotto — 180", "23:00  postres — 300", "bar: +6 cajas espumante", "mesa 4: ¡sin gluten!"],
    duty: ["TURNOS DE GUARDIA", "Nunes — supervisor", "Rui — laberinto sur", "Otávio — ducto / norte", "Cida — office", "cambio de turno 23:10"],
    drinks: ["TRAGOS DE LA NOCHE", "Lumière Spritz", "Aurora Sour", "Vesper Negroni", "Orvalho sin alcohol"],
    temp: ["CONTROL DE TEMPERATURA", "18h  2 °C   ok", "20h  3 °C   ok", "22h  3 °C   ok"], staffEntrance: "ACCESO DEL PERSONAL",
  },
};
/** Idioma do cenário a partir dos textos do interior que a montagem recebeu. */
export const localeOf = (copy: InteriorCopy): SceneLocale => (Object.keys(COPY) as SceneLocale[]).find((k) => COPY[k] === copy) ?? "pt-BR";
export const textOf = (copy: InteriorCopy): SrvText => SRV_TEXT[localeOf(copy)];

/** Placas do atlas: retângulo em unidades de uma grade 16 × 16. */
export type SignId = "staffOnly" | "restricted" | "copa" | "kitchen" | "dish" | "bar" | "cold" | "toHall" | "toDock" | "toSec" | "keepClear" | "monitoring"
  | "stageEntry" | "quickChange" | "wardrobe" | "makeup" | "production" | "silence" | "toKitchen" | "exit" | "hot" | "highVoltage" | "arrow" | "exitArrow"
  | "noSmoking" | "hairnet" | "handWash" | "wetFloor" | "extinguisher" | "hose" | "alarm" | "orders" | "duty" | "drinks" | "temp" | "staffEntrance";
const SLOTS: Record<SignId, [number, number, number, number]> = {
  staffOnly: [0, 0, 4, 1], restricted: [4, 0, 4, 1], copa: [8, 0, 4, 1], kitchen: [12, 0, 4, 1],
  dish: [0, 1, 4, 1], bar: [4, 1, 4, 1], cold: [8, 1, 4, 1], toHall: [12, 1, 4, 1],
  toDock: [0, 2, 4, 1], toSec: [4, 2, 4, 1], keepClear: [8, 2, 4, 1], monitoring: [12, 2, 4, 1],
  stageEntry: [0, 3, 4, 1], quickChange: [4, 3, 4, 1], wardrobe: [8, 3, 4, 1], makeup: [12, 3, 4, 1],
  production: [0, 4, 4, 1], silence: [4, 4, 8, 1], toKitchen: [12, 4, 4, 1],
  exit: [0, 5, 4, 2], hot: [4, 5, 4, 2], highVoltage: [8, 5, 4, 2], arrow: [12, 5, 2, 2], exitArrow: [14, 5, 2, 2],
  noSmoking: [0, 7, 2, 3], hairnet: [2, 7, 2, 3], handWash: [4, 7, 2, 3], wetFloor: [6, 7, 2, 3], extinguisher: [8, 7, 2, 3], hose: [10, 7, 2, 3], alarm: [12, 7, 2, 2], staffEntrance: [12, 9, 4, 1],
  orders: [0, 10, 6, 4], duty: [6, 10, 6, 4], drinks: [12, 10, 4, 6], temp: [0, 14, 4, 2],
};
type G = CanvasRenderingContext2D;
function plate(g: G, x: number, y: number, w: number, h: number, bg: string, fg: string, text: string, o: { border?: string; font?: number; icon?: (cx: number, cy: number, s: number) => void; sub?: string } = {}) {
  g.fillStyle = bg; g.fillRect(x, y, w, h);
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = h * 0.06; g.strokeRect(x + h * 0.06, y + h * 0.06, w - h * 0.12, h * 0.88); }
  const ix = o.icon ? h * 0.95 : 0;
  if (o.icon) o.icon(x + h * 0.55, y + h / 2, h * 0.34);
  g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
  const px = fit(g, text, (p) => `700 ${p}px ${SANS}`, Math.round(h * (o.font ?? 0.46)), w - ix - h * 0.4);
  g.font = `700 ${px}px ${SANS}`; g.fillText(text, x + ix + (w - ix) / 2, y + h * (o.sub ? 0.38 : 0.53));
  if (o.sub) { g.font = `500 ${Math.round(h * 0.2)}px ${SANS}`; g.fillText(o.sub, x + ix + (w - ix) / 2, y + h * 0.75); }
}
const ico = {
  cutlery: (g: G, cx: number, cy: number, s: number, c: string) => { g.fillStyle = c; g.fillRect(cx - s * 0.5, cy - s, s * 0.14, s * 2); for (const k of [-0.75, -0.5, -0.25]) g.fillRect(cx - s * 0.5 + k * s * 0.4 + s * 0.05, cy - s, s * 0.06, s * 0.7); g.beginPath(); g.ellipse(cx + s * 0.45, cy - s * 0.35, s * 0.18, s * 0.65, 0, 0, Math.PI * 2); g.fill(); g.fillRect(cx + s * 0.4, cy, s * 0.12, s); },
  flake: (g: G, cx: number, cy: number, s: number, c: string) => { g.strokeStyle = c; g.lineWidth = s * 0.16; g.lineCap = "round"; for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(cx - Math.cos(a) * s, cy - Math.sin(a) * s); g.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); g.stroke(); } },
  person: (g: G, cx: number, cy: number, s: number, c: string, run = false) => {
    g.fillStyle = c; g.strokeStyle = c; g.lineCap = "round"; g.lineWidth = s * 0.26;
    g.beginPath(); g.arc(cx + (run ? s * 0.25 : 0), cy - s * 0.78, s * 0.2, 0, Math.PI * 2); g.fill();
    const line = (pts: number[][]) => { g.beginPath(); g.moveTo(cx + pts[0][0] * s, cy + pts[0][1] * s); for (const p of pts.slice(1)) g.lineTo(cx + p[0] * s, cy + p[1] * s); g.stroke(); };
    if (run) { line([[0.15, -0.5], [-0.1, 0.15]]); line([[-0.1, 0.15], [0.35, 0.45], [0.25, 0.95]]); line([[-0.1, 0.15], [-0.35, 0.55], [-0.75, 0.6]]); line([[0.1, -0.4], [0.5, -0.15], [0.7, -0.35]]); line([[0.1, -0.4], [-0.25, -0.2], [-0.5, -0.45]]); }
    else { line([[0, -0.5], [0, 0.2]]); line([[0, 0.2], [0.25, 0.95]]); line([[0, 0.2], [-0.25, 0.95]]); line([[0, -0.4], [0.4, 0]]); line([[0, -0.4], [-0.4, 0]]); }
  },
  arrow: (g: G, cx: number, cy: number, s: number, c: string) => { g.fillStyle = c; g.beginPath(); g.moveTo(cx - s, cy - s * 0.25); g.lineTo(cx + s * 0.1, cy - s * 0.25); g.lineTo(cx + s * 0.1, cy - s * 0.7); g.lineTo(cx + s, cy); g.lineTo(cx + s * 0.1, cy + s * 0.7); g.lineTo(cx + s * 0.1, cy + s * 0.25); g.lineTo(cx - s, cy + s * 0.25); g.closePath(); g.fill(); },
  tri: (g: G, cx: number, cy: number, s: number) => { g.fillStyle = "#111"; g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s * 1.1, cy + s * 0.85); g.lineTo(cx - s * 1.1, cy + s * 0.85); g.closePath(); g.fill(); g.fillStyle = "#f2c21b"; g.beginPath(); g.moveTo(cx, cy - s * 0.66); g.lineTo(cx + s * 0.8, cy + s * 0.68); g.lineTo(cx - s * 0.8, cy + s * 0.68); g.closePath(); g.fill(); },
};
const atlasMats = new Map<string, { face: THREE.MeshStandardMaterial; lit: THREE.MeshBasicMaterial }>();
/** O atlas das placas da área no idioma do cenário: material das placas (levemente autoiluminado) e o aceso (saída). */
export function signAtlas(copy: InteriorCopy, q: Quality) {
  const loc = localeOf(copy), key = `srv-signs-${loc}-${q}`, hit = atlasMats.get(key); if (hit) return hit;
  const t = SRV_TEXT[loc], S = q === "high" ? 2048 : 1024, U = S / 16;
  const tex = drawnTexture(key, S, S, (g) => {
    g.fillStyle = "#777"; g.fillRect(0, 0, S, S);
    const r = (id: SignId) => { const [x, y, w, h] = SLOTS[id]; return [x * U, y * U, w * U, h * U] as const; };
    const zone = (id: SignId, text: string, icon?: (cx: number, cy: number, s: number) => void) => { const [x, y, w, h] = r(id); plate(g, x, y, w, h, "#24282d", "#f4f4f2", text, { border: "#f4f4f2", icon, font: 0.4 }); };
    { const [x, y, w, h] = r("staffOnly"); plate(g, x, y, w, h, "#b0121b", "#ffffff", copy.staffOnly, { font: 0.44 }); }
    { const [x, y, w, h] = r("restricted"); plate(g, x, y, w, h, "#b0121b", "#ffffff", copy.restricted, { font: 0.44 }); }
    zone("copa", t.copa, (cx, cy, s) => ico.cutlery(g, cx, cy, s, "#f4f4f2")); zone("kitchen", t.kitchen, (cx, cy, s) => ico.cutlery(g, cx, cy, s, "#f4f4f2"));
    zone("dish", t.dish); zone("bar", t.bar); zone("toHall", t.toHall); zone("toDock", t.toDock); zone("toSec", t.toSec); zone("toKitchen", t.toKitchen);
    { const [x, y, w, h] = r("cold"); plate(g, x, y, w, h, "#1d5a9c", "#ffffff", t.cold, { icon: (cx, cy, s) => ico.flake(g, cx, cy, s, "#ffffff"), font: 0.42 }); }
    { const [x, y, w, h] = r("keepClear"); g.fillStyle = "#f2c21b"; g.fillRect(x, y, w, h); g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = "#111"; for (let k = -2; k < 24; k++) { g.beginPath(); g.moveTo(x + k * h * 0.5, y + h); g.lineTo(x + k * h * 0.5 + h * 0.25, y + h); g.lineTo(x + k * h * 0.5 + h * 0.5, y); g.lineTo(x + k * h * 0.5 + h * 0.25, y); g.fill(); } g.restore(); g.fillStyle = "#f2c21b"; g.fillRect(x + h * 0.25, y + h * 0.18, w - h * 0.5, h * 0.64); g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle"; const px = fit(g, t.keepClear, (p) => `800 ${p}px ${SANS}`, Math.round(h * 0.38), w - h * 0.7); g.font = `800 ${px}px ${SANS}`; g.fillText(t.keepClear, x + w / 2, y + h * 0.52); }
    { const [x, y, w, h] = r("monitoring"); plate(g, x, y, w, h, "#0f2a44", "#cfe8ff", t.monitoring, { border: "#5fa8e6", font: 0.36 }); }
    for (const [id, text] of [["stageEntry", t.stageEntry], ["quickChange", t.quickChange], ["wardrobe", t.wardrobe], ["makeup", t.makeup], ["production", t.production]] as [SignId, string][]) { const [x, y, w, h] = r(id); plate(g, x, y, w, h, "#0d0d0e", "#f0c75a", text, { border: "#f0c75a", font: 0.42 }); }
    { const [x, y, w, h] = r("silence"); plate(g, x, y, w, h, "#9e0f18", "#ffffff", copy.silence, { font: 0.5 }); }
    { const [x, y, w, h] = r("staffEntrance"); plate(g, x, y, w, h, "#24282d", "#f4f4f2", t.staffEntrance, { border: "#f4f4f2", font: 0.4 }); }
    { const [x, y, w, h] = r("exit"); g.fillStyle = "#0b8a41"; g.fillRect(x, y, w, h); g.strokeStyle = "#e9fff1"; g.lineWidth = h * 0.05; g.strokeRect(x + h * 0.08, y + h * 0.08, w - h * 0.16, h * 0.84); ico.person(g, x + h * 0.55, y + h * 0.52, h * 0.32, "#ffffff", true); g.fillStyle = "#ffffff"; g.fillRect(x + h * 0.95, y + h * 0.2, h * 0.06, h * 0.6); g.textAlign = "center"; g.textBaseline = "middle"; const px = fit(g, copy.exit, (p) => `800 ${p}px ${SANS}`, Math.round(h * 0.4), w - h * 1.4); g.font = `800 ${px}px ${SANS}`; g.fillText(copy.exit, x + h * 1.05 + (w - h * 1.05) / 2, y + h * 0.53); }
    for (const [id, lines] of [["hot", t.hot], ["highVoltage", t.highVoltage]] as [SignId, [string, string]][]) {
      const [x, y, w, h] = r(id); g.fillStyle = "#f2c21b"; g.fillRect(x, y, w, h); g.strokeStyle = "#111"; g.lineWidth = h * 0.05; g.strokeRect(x + h * 0.06, y + h * 0.06, w - h * 0.12, h * 0.88);
      ico.tri(g, x + h * 0.5, y + h * 0.5, h * 0.3); g.fillStyle = "#111"; g.font = `800 ${Math.round(h * 0.26)}px ${SANS}`; g.textAlign = "center"; g.fillText(id === "hot" ? "!" : "ϟ", x + h * 0.5, y + h * 0.56);
      g.textBaseline = "middle"; const px = fit(g, lines[1], (p) => `800 ${p}px ${SANS}`, Math.round(h * 0.22), w - h * 1.15); g.font = `800 ${Math.round(h * 0.26)}px ${SANS}`; g.fillText(lines[0], x + h + (w - h) / 2, y + h * 0.36); g.font = `800 ${px}px ${SANS}`; g.fillText(lines[1], x + h + (w - h) / 2, y + h * 0.66);
    }
    { const [x, y, w, h] = r("arrow"); g.fillStyle = "#24282d"; g.fillRect(x, y, w, h); ico.arrow(g, x + w / 2, y + h / 2, w * 0.36, "#f4f4f2"); }
    { const [x, y, w, h] = r("exitArrow"); g.fillStyle = "#0b8a41"; g.fillRect(x, y, w, h); ico.arrow(g, x + w / 2, y + h / 2, w * 0.36, "#ffffff"); }
    const portrait = (id: SignId, ring: string, bg: string, lines: string[], icon: (cx: number, cy: number, s: number) => void, slash = false) => {
      const [x, y, w, h] = r(id); g.fillStyle = bg; g.fillRect(x, y, w, h); g.strokeStyle = "#cfcfcf"; g.lineWidth = w * 0.02; g.strokeRect(x + w * 0.03, y + w * 0.03, w * 0.94, h - w * 0.06);
      const cx = x + w / 2, cy = y + w * 0.52, R = w * 0.36; g.fillStyle = ring; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill(); g.fillStyle = bg === "#ffffff" && slash ? "#ffffff" : bg; if (slash) { g.beginPath(); g.arc(cx, cy, R * 0.8, 0, Math.PI * 2); g.fill(); }
      icon(cx, cy, R * 0.62);
      if (slash) { g.strokeStyle = ring; g.lineWidth = R * 0.2; g.beginPath(); g.moveTo(cx - R * 0.58, cy - R * 0.58); g.lineTo(cx + R * 0.58, cy + R * 0.58); g.stroke(); }
      g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle";
      lines.forEach((s, k) => { const px = fit(g, s, (p) => `800 ${p}px ${SANS}`, Math.round(w * 0.13), w * 0.86); g.font = `800 ${px}px ${SANS}`; g.fillText(s, cx, y + w * 1.02 + k * w * 0.17); });
    };
    const split = (s: string) => { const m = s.split(" "); if (m.length < 2) return [s]; const k = Math.ceil(m.length / 2); return [m.slice(0, k).join(" "), m.slice(k).join(" ")]; };
    portrait("noSmoking", "#c4141c", "#ffffff", split(t.noSmoking), (cx, cy, s) => { g.fillStyle = "#222"; g.fillRect(cx - s, cy - s * 0.12, s * 1.5, s * 0.24); g.fillStyle = "#e07a2a"; g.fillRect(cx + s * 0.5, cy - s * 0.12, s * 0.3, s * 0.24); }, true);
    portrait("hairnet", "#1d5a9c", "#ffffff", split(t.hairnet), (cx, cy, s) => { g.fillStyle = "#ffffff"; g.beginPath(); g.arc(cx, cy + s * 0.15, s * 0.55, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(cx, cy - s * 0.35, s * 0.75, s * 0.45, 0, Math.PI, 0); g.fill(); });
    portrait("handWash", "#1d5a9c", "#ffffff", split(t.handWash), (cx, cy, s) => { g.fillStyle = "#ffffff"; g.beginPath(); g.ellipse(cx - s * 0.3, cy + s * 0.2, s * 0.32, s * 0.6, 0.5, 0, Math.PI * 2); g.ellipse(cx + s * 0.3, cy + s * 0.2, s * 0.32, s * 0.6, -0.5, 0, Math.PI * 2); g.fill(); for (const k of [-0.4, 0, 0.4]) { g.beginPath(); g.arc(cx + k * s, cy - s * 0.7, s * 0.1, 0, Math.PI * 2); g.fill(); } });
    { const [x, y, w, h] = r("wetFloor"); g.fillStyle = "#f2c21b"; g.fillRect(x, y, w, h); ico.tri(g, x + w / 2, y + w * 0.5, w * 0.34); g.lineWidth = w * 0.035; ico.person(g, x + w / 2, y + w * 0.58, w * 0.16, "#111", true); g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle"; t.wetFloor.forEach((s, k) => { const px = fit(g, s, (p) => `800 ${p}px ${SANS}`, Math.round(w * 0.15), w * 0.86); g.font = `800 ${px}px ${SANS}`; g.fillText(s, x + w / 2, y + w * 1.05 + k * w * 0.19); }); }
    const fire = (id: SignId, text: string, icon: (cx: number, cy: number, s: number) => void) => { const [x, y, w, h] = r(id); g.fillStyle = "#c4141c"; g.fillRect(x, y, w, h); icon(x + w / 2, y + h * 0.4, w * 0.3); g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle"; const px = fit(g, text, (p) => `800 ${p}px ${SANS}`, Math.round(w * 0.15), w * 0.9); g.font = `800 ${px}px ${SANS}`; g.fillText(text, x + w / 2, y + h * 0.84); };
    fire("extinguisher", t.extinguisher, (cx, cy, s) => { g.fillStyle = "#ffffff"; g.beginPath(); g.roundRect(cx - s * 0.32, cy - s * 0.55, s * 0.64, s * 1.5, s * 0.25); g.fill(); g.fillRect(cx - s * 0.12, cy - s * 0.85, s * 0.24, s * 0.3); g.fillRect(cx - s * 0.6, cy - s * 0.85, s * 0.7, s * 0.12); g.lineWidth = s * 0.1; g.strokeStyle = "#ffffff"; g.beginPath(); g.moveTo(cx + s * 0.12, cy - s * 0.75); g.quadraticCurveTo(cx + s * 0.75, cy - s * 0.6, cx + s * 0.55, cy + s * 0.4); g.stroke(); });
    fire("hose", t.hose, (cx, cy, s) => { g.strokeStyle = "#ffffff"; g.lineWidth = s * 0.14; for (const rr of [0.85, 0.62, 0.4]) { g.beginPath(); g.arc(cx, cy, s * rr, 0, Math.PI * 2); g.stroke(); } g.beginPath(); g.moveTo(cx + s * 0.85, cy); g.lineTo(cx + s * 0.85, cy + s * 0.95); g.stroke(); });
    { const [x, y, w, h] = r("alarm"); g.fillStyle = "#c4141c"; g.fillRect(x, y, w, h); g.fillStyle = "#ffffff"; g.fillRect(x + w * 0.2, y + h * 0.18, w * 0.6, h * 0.42); g.fillStyle = "#c4141c"; g.font = `800 ${Math.round(h * 0.3)}px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("!", x + w / 2, y + h * 0.4); g.fillStyle = "#ffffff"; const px = fit(g, t.alarm, (p) => `800 ${p}px ${SANS}`, Math.round(h * 0.11), w * 0.9); g.font = `800 ${px}px ${SANS}`; g.fillText(t.alarm, x + w / 2, y + h * 0.78); }
    const board = (id: SignId, lines: string[], bg: string, ink: string, head: string) => {
      const [x, y, w, h] = r(id); g.fillStyle = bg; g.fillRect(x, y, w, h);
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(120,120,120,${0.02 + (k % 5) * 0.008})`; g.fillRect(x + ((k * 97) % w), y + ((k * 53) % h), w * 0.2, h * 0.02); }
      g.textAlign = "left"; g.textBaseline = "top"; g.fillStyle = head; const hp = fit(g, lines[0], (p) => `700 ${p}px ${SANS}`, Math.round(h * 0.1), w * 0.9); g.font = `700 ${hp}px ${SANS}`; g.fillText(lines[0], x + w * 0.05, y + h * 0.06);
      g.fillStyle = head; g.fillRect(x + w * 0.05, y + h * 0.19, w * 0.9, h * 0.008);
      g.fillStyle = ink; lines.slice(1).forEach((s, k) => { const px = fit(g, s, (p) => `600 ${p}px ${HAND}`, Math.round(h * 0.11), w * 0.9); g.font = `600 ${px}px ${HAND}`; g.save(); g.translate(x + w * 0.06, y + h * (0.24 + k * 0.14)); g.rotate(((k % 3) - 1) * 0.012); g.fillText(s, 0, 0); g.restore(); });
    };
    board("orders", t.orders, "#f3f3ef", "#1b3f8f", "#b3121e"); board("duty", t.duty, "#f3f3ef", "#1d1d1d", "#1b3f8f"); board("drinks", t.drinks, "#151517", "#f2efe4", "#e0b85a"); board("temp", t.temp, "#f7f5ec", "#1d1d1d", "#1d1d1d");
  });
  tex.anisotropy = 8;
  const out = {
    face: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissiveMap: tex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.22 }),
    lit: new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.9, 1.9, 1.9) }),
  };
  out.face.name = `${key}-face`; out.lit.name = `${key}-lit`;
  atlasMats.set(key, out); return out;
}
/** Plano da placa (largura 1, altura 1, olhando para +z) com as coordenadas do atlas. */
export function signGeo(id: SignId): THREE.BufferGeometry {
  return geo(`srv-signGeo-${id}`, () => {
    const g = new THREE.PlaneGeometry(1, 1), [x, y, w, h] = SLOTS[id], uv = g.getAttribute("uv") as THREE.BufferAttribute;
    const u0 = x / 16, u1 = (x + w) / 16, v1 = 1 - y / 16, v0 = 1 - (y + h) / 16, e = 0.002;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, mix(u0 + e, u1 - e, uv.getX(k)), mix(v0 + e, v1 - e, uv.getY(k)));
    return g;
  });
}
/** Proporção (largura / altura) da placa no atlas. */
export const signAspect = (id: SignId) => SLOTS[id][2] / SLOTS[id][3];
/**
 * Placa de PVC parafusada: chapa com espessura (3 mm) e a face do atlas, centrada em (x, y, z) da parede, olhando para
 * `ry`; `h` = altura (a largura sai da proporção); `rot` gira a face no próprio plano (setas). `lit`: caixa de luz (saída).
 */
export function sign(c: Sink & { copy: InteriorCopy; q: Quality }, room: string, id: SignId, x: number, y: number, z: number, ry: number, h: number, o: { rot?: number; lit?: boolean; depth?: number } = {}) {
  signOn(c, Fr.at(c, room, x, y, z, ry), id, 0, 0, 0, h, o);
}
/** A mesma placa num referencial qualquer (abas inclinadas, portas, carrinhos): centro (x, y, z) local, olhando para +z. */
export function signOn(c: Sink & { copy: InteriorCopy; q: Quality }, f: Fr, id: SignId, x: number, y: number, z: number, h: number, o: { rot?: number; lit?: boolean; depth?: number } = {}) {
  const w = h * signAspect(id), A = signAtlas(c.copy, c.q), d = o.depth ?? 0.004, S = SM(c.q), room = f.room;
  if (o.lit) { c.batch.add(room, S.plasticWhite, BOX0(), f.m(x, y - h / 2 - 0.02, z, 0, w + 0.06, h + 0.04, 0.05)); c.batch.add(room, A.lit, signGeo(id), f.m(x, y, z + 0.051, 0, w, h, 1, 0, o.rot ?? 0)); return; }
  c.batch.add(room, S.plasticWhite, BOX0(), f.m(x, y - h / 2, z + d / 2, 0, w + 0.004, h + 0.004, d));
  c.batch.add(room, A.face, signGeo(id), f.m(x, y, z + d + 0.0015, 0, w, h, 1, 0, o.rot ?? 0));
}
/** Ponto do mundo como tupla (para espalhar em parâmetros x, y, z). */
export const xyz = (v: THREE.Vector3): [number, number, number] => [v.x, v.y, v.z];
