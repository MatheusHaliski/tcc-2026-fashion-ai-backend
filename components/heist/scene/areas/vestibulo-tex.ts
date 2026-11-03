/*
 * MET Gala Heist v2 — Vestíbulo: a base das texturas e dos materiais da área. Ruído periódico (cópia de interior-tex.ts,
 * que não o exporta), o gerador de superfícies procedurais (cor + relevo + rugosidade de uma vez), o cache de materiais
 * com chave "vestibulo-…" (nada dividido com outra área), os atalhos de material/textura/geometria da área e a união de
 * geometrias. Nos testes (jsdom) as texturas saem com 8 px.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { geo } from "../interior-batch";
import { fabric, glow, solid } from "../interior-mats";
import { drawnTexture, type Quality } from "../interior-tex";

const FAKE = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);

/* ======================= ruído periódico (cópia de interior-tex) ======================= */
export function hash2(i: number, j: number, seed: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function vnoise(x: number, y: number, p: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const i0 = ((xi % p) + p) % p, j0 = ((yi % p) + p) % p, i1 = (i0 + 1) % p, j1 = (j0 + 1) % p;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(i0, j0, seed), b = hash2(i1, j0, seed), c = hash2(i0, j1, seed), d = hash2(i1, j1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(u: number, v: number, p: number, seed: number, oct = 4): number {
  let s = 0, a = 0.5, n = 0, f = 1;
  for (let k = 0; k < oct; k++) { s += a * vnoise(u * p * f, v * p * f, p * f, seed + k * 31); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
export const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Veio de mármore: 1 sobre o veio (t = coordenada turbulenta). */
export const vein = (t: number, w: number) => 1 - smooth(0, w, Math.abs(Math.sin(t * Math.PI)));

/* ======================= superfícies (cor + relevo + rugosidade) ======================= */
export interface VSurface { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }
/** out: r, g, b (0–1, sRGB), altura (0–1), rugosidade (0–1). */
export type PixelFn = (u: number, v: number, out: Float32Array) => void;
const surfaces = new Map<string, VSurface>();
function canvas(w: number, h: number) { const c = document.createElement("canvas"); c.width = w; c.height = h; return { c, g: c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D }; }
function tex(c: HTMLCanvasElement, srgb: boolean, wrap = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; return t;
}
/** Gera as três texturas de uma vez (w × h px). O relevo vem do gradiente da altura (a borda dá a volta se `wrap`). */
export function vSurface(key: string, w: number, h: number, fn: PixelFn, bump = 1.2, wrap = true): VSurface {
  const k = `vestibulo-${key}`, hit = surfaces.get(k); if (hit) return hit;
  const W = FAKE ? 8 : w, Hh = FAKE ? 8 : h;
  const col = canvas(W, Hh), nor = canvas(W, Hh), rou = canvas(W, Hh);
  const ci = col.g.createImageData(W, Hh), ni = nor.g.createImageData(W, Hh), ri = rou.g.createImageData(W, Hh);
  const H = new Float32Array(W * Hh), out = new Float32Array(5);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    out[3] = 0.5; out[4] = 0.5; fn((x + 0.5) / W, (y + 0.5) / Hh, out);
    const i = (y * W + x) * 4;
    ci.data[i] = Math.max(0, Math.min(255, out[0] * 255)); ci.data[i + 1] = Math.max(0, Math.min(255, out[1] * 255)); ci.data[i + 2] = Math.max(0, Math.min(255, out[2] * 255)); ci.data[i + 3] = 255;
    const r = Math.max(0, Math.min(255, out[4] * 255)); ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = r; ri.data[i + 3] = 255;
    H[y * W + x] = out[3];
  }
  const s = bump * Math.max(W, Hh) / 256;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const xl = wrap ? (x - 1 + W) % W : Math.max(0, x - 1), xr = wrap ? (x + 1) % W : Math.min(W - 1, x + 1);
    const yu = wrap ? (y - 1 + Hh) % Hh : Math.max(0, y - 1), yd = wrap ? (y + 1) % Hh : Math.min(Hh - 1, y + 1);
    const dx = (H[y * W + xr] - H[y * W + xl]) * s, dy = (H[yd * W + x] - H[yu * W + x]) * s, l = Math.hypot(dx, dy, 1), i = (y * W + x) * 4;
    ni.data[i] = (-dx / l * 0.5 + 0.5) * 255; ni.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; ni.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[i + 3] = 255;
  }
  col.g.putImageData(ci, 0, 0); nor.g.putImageData(ni, 0, 0); rou.g.putImageData(ri, 0, 0);
  const sf = { map: tex(col.c, true, wrap), normalMap: tex(nor.c, false, wrap), roughnessMap: tex(rou.c, false, wrap) };
  surfaces.set(k, sf); return sf;
}
const mats = new Map<string, THREE.Material>();
/** Material cacheado da área (nome "vestibulo-…"). */
export function vMat<T extends THREE.Material>(key: string, make: () => T): T {
  const k = `vestibulo-${key}`, hit = mats.get(k) as T | undefined; if (hit) return hit;
  const m = make(); m.name = k; mats.set(k, m); return m;
}
/** Material PBR com as três texturas de uma superfície. */
export function vSurfMat(key: string, sf: VSurface, o: { tint?: string; metal?: number; rough?: number; normal?: number; env?: number; vertex?: boolean; clearcoat?: number; side?: THREE.Side; repeat?: [number, number] } = {}): THREE.MeshStandardMaterial {
  return vMat(key, () => {
    const args = {
      map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, normalScale: new THREE.Vector2(o.normal ?? 1, o.normal ?? 1),
      color: new THREE.Color(o.tint ?? "#ffffff"), metalness: o.metal ?? 0, roughness: o.rough ?? 1, envMapIntensity: o.env ?? 1, vertexColors: o.vertex ?? false,
      side: o.side ?? THREE.FrontSide, shadowSide: THREE.DoubleSide,
    };
    const m = o.clearcoat ? new THREE.MeshPhysicalMaterial({ ...args, clearcoat: o.clearcoat, clearcoatRoughness: 0.08 }) : new THREE.MeshStandardMaterial(args);
    if (o.repeat) for (const t of [sf.map, sf.normalMap, sf.roughnessMap]) t.repeat.set(...o.repeat);
    return m;
  });
}
/** Textura desenhada uma vez (canvas 2D) com a chave da área. */
export const vTex = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) => drawnTexture(`vestibulo-${key}`, w, h, draw, srgb);
export const vSolid = (key: string, color: string, o: Parameters<typeof solid>[2] = {}) => solid(`vestibulo-${key}`, color, o);
export const vFabric = (key: string, color: string, q: Quality, o: Parameters<typeof fabric>[3] = {}) => fabric(`vestibulo-${key}`, color, q, o);
export const vGlow = (key: string, color: string, k = 1, o: Parameters<typeof glow>[3] = {}) => glow(`vestibulo-${key}`, color, k, o);
export const vGeo = (key: string, make: () => THREE.BufferGeometry) => geo(`vestibulo-${key}`, make);
/** Une geometrias (posição, normal, uv; sem índice). */
export function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g.clone(); if (!n.getAttribute("normal")) n.computeVertexNormals();
    const out = new THREE.BufferGeometry(); out.setAttribute("position", n.getAttribute("position")); out.setAttribute("normal", n.getAttribute("normal"));
    out.setAttribute("uv", n.getAttribute("uv") ?? new THREE.BufferAttribute(new Float32Array(n.getAttribute("position").count * 2), 2)); return out;
  });
  return mergeGeometries(flat, false) ?? new THREE.BufferGeometry();
}

