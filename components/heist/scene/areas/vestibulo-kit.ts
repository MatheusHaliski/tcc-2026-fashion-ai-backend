/*
 * MET Gala Heist v2 — Vestíbulo (Z02/Z03/Z14): ferramentas da área. Materiais e texturas com chave "vestibulo-…" (nada
 * dividido com outra área), o gerador de superfícies procedurais (cor + relevo + rugosidade de uma vez, ruído periódico:
 * copiado de interior-tex.ts, que não o exporta), perfis de moldura extrudados (cimalha, rodapé, chapim, corrimão), almofadas
 * em relevo, a matriz "na parede" de cada face da sala e os textos desenhados nos três idiomas do cenário.
 *
 * A sala: x −8…8, z 14,5…24, pé-direito 6,5 m. Porta da rua (front) no sul (x −2…2), porta do salão (main) no norte
 * (x −2…2, 4 m de altura), porta da doca (side) no oeste (z 20…22,5). Nos testes (jsdom) as texturas saem com 8 px.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { geo, mat } from "../interior-batch";
import { fabric, glow, solid } from "../interior-mats";
import { drawnTexture, type Quality } from "../interior-tex";
import { COPY, type InteriorCopy, type SceneLocale } from "../interior-copy";

export const ROOM = "vestibulo" as const;
/** Pé-direito, limites da sala e a altura da galeria sobre a porta do salão (26 degraus de 17 cm). */
export const VH = 6.5, X0 = -8, X1 = 8, Z0 = 14.5, Z1 = 24, RISE = 0.17, GOING = 0.3, GALLERY_Y = 26 * 0.17;

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

/* ======================= materiais da área ======================= */
/** Paleta própria do vestíbulo (pedras, metais, madeira, tecidos) — os nomes dizem o material de verdade. */
export function VM(q: Quality) {
  const hi = q === "high";
  return {
    /** mármore de Carrara polido (degraus, soleiras, lambri, balaústres) */
    carrara: vSurfMat(`carrara-${q}`, carraraSurface(hi ? 512 : 256), { rough: 1, env: 1.1, normal: 0.6 }),
    /** mármore creme de Botticino (almofadas do lambri, nichos) */
    botticino: vSurfMat(`botticino-${q}`, botticinoSurface(hi ? 512 : 256), { rough: 1, env: 0.9, normal: 0.5 }),
    /** mármore negro de veio branco (rodapé, faixas, base do balcão) */
    nero: vSurfMat(`nero-${q}`, neroSurface(hi ? 512 : 256), { rough: 1, env: 1.2, normal: 0.5 }),
    /** calcário claro liso de moldura (pilastras, cimalha, arcos dos nichos) */
    stoneMold: vSurfMat(`stoneMold-${q}`, moldStoneSurface(hi ? 512 : 256), { rough: 1, env: 0.7, normal: 0.8 }),
    /** gesso do teto (caixotões) e o fundo pintado */
    plaster: vSolid("plaster", "#e9dfcb", { rough: 0.86, env: 0.5 }),
    plasterShade: vSolid("plasterShade", "#cdbf9f", { rough: 0.9, env: 0.4 }),
    gilt: vSolid("gilt", "#c79b45", { metal: 1, rough: 0.32, env: 1.2 }),
    giltBright: vSolid("giltBright", "#e6c06a", { metal: 1, rough: 0.2, env: 1.3 }),
    brass: vSolid("brass", "#c9a24b", { metal: 1, rough: 0.24, env: 1.2 }),
    brassAged: vSolid("brassAged", "#9c7a3c", { metal: 1, rough: 0.42 }),
    bronze: vSolid("bronze", "#5b4128", { metal: 0.95, rough: 0.38, env: 1.1 }),
    bronzeDark: vSolid("bronzeDark", "#2f2418", { metal: 0.9, rough: 0.45 }),
    blackLacquer: vMat("blackLacquer", () => new THREE.MeshPhysicalMaterial({ color: "#07070a", roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2 })),
    walnut: vSurfMat(`walnut-${q}`, woodSurface(hi ? 512 : 256, 0.22, 0.13, 0.07, 41), { rough: 1, env: 0.8, normal: 0.6, clearcoat: 0.6 }),
    mahogany: vSurfMat(`mahogany-${q}`, woodSurface(hi ? 512 : 256, 0.3, 0.1, 0.06, 43), { rough: 1, env: 0.8, normal: 0.6, clearcoat: 0.7 }),
    redCarpet: vFabric("redCarpet", "#7a0c16", q, { sheen: "#ff5a6a", rough: 0.92 }),
    velvetRed: vFabric("velvetRope", "#6e0a14", q, { sheen: "#ff6a7a", rough: 0.7 }),
    velvetSeat: vFabric("velvetSeat", "#16384a", q, { sheen: "#6fb0d0", rough: 0.75 }),
    leather: vSolid("leather", "#20140e", { rough: 0.55, env: 0.8 }),
    glass: vMat("glass", () => new THREE.MeshPhysicalMaterial({ color: "#e4eef0", roughness: 0.04, transparent: true, opacity: 0.2, clearcoat: 1, clearcoatRoughness: 0.03, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6 })),
    crystal: vSolid("crystal", "#f4f2ff", { metal: 0.1, rough: 0.02, env: 2.4, transparent: true, opacity: 0.86 }),
    paper: vSolid("paper", "#f2ece0", { rough: 0.92 }),
    steelBrushed: vSolid("steelBrushed", "#a9adb2", { metal: 0.9, rough: 0.34 }),
    blackMatte: vSolid("blackMatte", "#0d0d0f", { rough: 0.62 }),
    bulb: vGlow("bulb", "#ffdcaa", 2.4),
    flameBulb: vGlow("flameBulb", "#ffd08a", 2.8),
    ledGreen: vGlow("ledGreen", "#2bff7a", 2.2),
    ledRed: vGlow("ledRed", "#ff3030", 2.2),
    ledWarm: vGlow("ledWarm", "#ffcf8a", 2.0),
  };
}
export type VPalette = ReturnType<typeof VM>;

/* ======================= superfícies das pedras e madeiras ======================= */
export function carraraSurface(n: number): VSurface {
  return vSurface(`carrara${n}`, n, n, (u, v, o) => {
    const t = fbm(u, v, 3, 501, 5) * 5 + (u * 1.4 + v * 0.6) * 2.2;
    const w = Math.max(vein(t, 0.045) * 0.55, vein(t * 2.2 + 0.9, 0.022) * 0.3) * (0.45 + 0.55 * fbm(u, v, 5, 503, 2));
    const base = 0.9 + 0.035 * fbm(u, v, 7, 505, 3);
    o[0] = mix(base, 0.5, w); o[1] = mix(base, 0.52, w); o[2] = mix(base * 1.01, 0.56, w); o[3] = 0.5; o[4] = 0.1 + 0.08 * w;
  }, 0.3);
}
export function botticinoSurface(n: number): VSurface {
  return vSurface(`botticino${n}`, n, n, (u, v, o) => {
    const t = fbm(u, v, 4, 511, 5) * 6 + v * 3;
    const w = vein(t, 0.03) * 0.45 * fbm(u, v, 6, 513, 2), cloud = fbm(u, v, 5, 515, 4);
    o[0] = mix(0.86 + 0.05 * cloud, 0.62, w); o[1] = mix(0.78 + 0.05 * cloud, 0.55, w); o[2] = mix(0.64 + 0.05 * cloud, 0.45, w); o[3] = 0.5; o[4] = 0.16 + 0.1 * w;
  }, 0.3);
}
export function neroSurface(n: number): VSurface {
  return vSurface(`nero${n}`, n, n, (u, v, o) => {
    const t = fbm(u, v, 3, 521, 5) * 6 + (u - v) * 2.6;
    const w = Math.max(vein(t, 0.03), vein(t * 1.8 + 0.3, 0.015) * 0.55) * (0.35 + 0.65 * fbm(u, v, 6, 523, 2));
    const base = 0.025 + 0.015 * fbm(u, v, 10, 525, 2);
    o[0] = mix(base, 0.86, w); o[1] = mix(base, 0.84, w); o[2] = mix(base * 1.15, 0.8, w); o[3] = 0.5; o[4] = 0.07 + 0.04 * w;
  }, 0.3);
}
export function moldStoneSurface(n: number): VSurface {
  return vSurface(`moldStone${n}`, n, n, (u, v, o) => {
    const nn = fbm(u, v, 6, 531, 5), pit = vnoise(u * 300, v * 300, 300, 533) > 0.94, fos = vnoise(u * 90, v * 90, 90, 535) > 0.9;
    let r = 0.86 + 0.05 * (nn - 0.5), g = 0.8 + 0.05 * (nn - 0.5), b = 0.68 + 0.05 * (nn - 0.5);
    if (pit) { r *= 0.85; g *= 0.85; b *= 0.85; } if (fos) { r *= 0.95; g *= 0.94; b *= 0.92; }
    o[0] = r; o[1] = g; o[2] = b; o[3] = 0.5 + 0.08 * nn - (pit ? 0.12 : 0); o[4] = 0.7 + 0.1 * nn;
  }, 0.9);
}
/** Madeira com veio (tingida: r, g, b de base) e poros. */
export function woodSurface(n: number, r: number, g: number, b: number, seed: number): VSurface {
  return vSurface(`wood${n}-${seed}`, n, n, (u, v, o) => {
    const ring = Math.sin((u * 6 + fbm(u * 0.5, v, 4, seed, 4) * 5) * 9) * 0.5 + 0.5, pore = vnoise(u * 40, v * 400, 40, seed + 7) > 0.8;
    const k = 0.78 + 0.32 * ring - (pore ? 0.12 : 0);
    o[0] = r * k; o[1] = g * k; o[2] = b * k; o[3] = 0.5 + 0.06 * ring - (pore ? 0.08 : 0); o[4] = 0.32 + 0.12 * (1 - ring);
  }, 0.5);
}

/* ======================= geometria ======================= */
/** Revolução (raio, altura) com `seg` lados. */
export const lathe = (key: string, pts: [number, number][], seg = 24) => vGeo(`lathe-${key}-${seg}`, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg));
/**
 * Perfil de moldura extrudado ao longo de x (comprimento `len`, centrado em x = 0): `pts` = (saliência para +z, altura y)
 * de baixo para cima, fechado contra a parede (z = 0). As coordenadas de textura saem em metros (sem esticar).
 */
export function profileGeo(key: string, pts: [number, number][], len: number): THREE.BufferGeometry {
  return vGeo(`profile-${key}-${len.toFixed(3)}`, () => {
    const s = new THREE.Shape(); s.moveTo(0, pts[0][1]);
    for (const [z, y] of pts) s.lineTo(z, y);
    s.lineTo(0, pts[pts.length - 1][1]); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 6 });
    // a forma está no plano (x = saliência, y = altura); extrudada em z → gira para o comprimento ficar em x
    g.translate(0, 0, -len / 2); g.rotateY(-Math.PI / 2); g.computeVertexNormals(); return g;
  });
}
/** Pontos de um quarto de círculo (côncavo ou convexo) para compor perfis: de (z0, y0) a (z1, y1). */
export function arcPts(z0: number, y0: number, z1: number, y1: number, convex: boolean, n = 5): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 1; k <= n; k++) {
    const a = (k / n) * Math.PI / 2, s = Math.sin(a), c = 1 - Math.cos(a);
    out.push(convex ? [z0 + (z1 - z0) * s, y0 + (y1 - y0) * c] : [z0 + (z1 - z0) * c, y0 + (y1 - y0) * s]);
  }
  return out;
}
/** Almofada em relevo (campo levantado com chanfro), w × h, espessura `d`, chanfro `b`; frente para +z, base em z = 0. */
export function raisedPanel(key: string, w: number, h: number, d: number, b: number): THREE.BufferGeometry {
  return vGeo(`panel-${key}-${w.toFixed(3)}-${h.toFixed(3)}-${d}-${b}`, () => {
    const s = new THREE.Shape(), x = w / 2 - b, y = h / 2 - b;
    s.moveTo(-x, -y); s.lineTo(x, -y); s.lineTo(x, y); s.lineTo(-x, y); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - b), bevelEnabled: true, bevelSize: b, bevelThickness: b * 0.6, bevelSegments: 2 });
    g.computeVertexNormals(); return g;
  });
}
/** Moldura retangular (quadro) de largura `fw` e saliência `d`, com chanfro: o vão interno fica vazio. */
export function frameGeo(key: string, w: number, h: number, fw: number, d: number, b = 0.006): THREE.BufferGeometry {
  return vGeo(`frame-${key}-${w.toFixed(3)}-${h.toFixed(3)}-${fw}-${d}`, () => {
    const s = new THREE.Shape(), x = w / 2, y = h / 2;
    s.moveTo(-x, -y); s.lineTo(x, -y); s.lineTo(x, y); s.lineTo(-x, y); s.closePath();
    const hole = new THREE.Path(), ix = x - fw, iy = y - fw; hole.moveTo(-ix, -iy); hole.lineTo(-ix, iy); hole.lineTo(ix, iy); hole.lineTo(ix, -iy); hole.closePath(); s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - b), bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 2 });
    g.computeVertexNormals(); return g;
  });
}
/** Arco pleno (contorno) extrudado: vão de raio `r`, largura da moldura `t`, montantes até `spring`. */
export function archFrameGeo(key: string, r: number, t: number, spring: number, depth: number, sill = 0): THREE.BufferGeometry {
  return vGeo(`arch-${key}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-r - t, sill); s.lineTo(-r - t, spring); s.absarc(0, spring, r + t, Math.PI, 0, true); s.lineTo(r + t, sill); s.lineTo(r, sill); s.lineTo(r, spring); s.absarc(0, spring, r, 0, Math.PI, false); s.lineTo(-r, sill); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 28 }); g.computeVertexNormals(); return g;
  });
}

/** Prisma vertical: polígono no plano (x, z) extrudado de y0 a y1 (o sentido do polígono não importa). */
export function prism(pts: [number, number][], y0: number, y1: number): THREE.BufferGeometry {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], -pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], -pts[i][1]); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, y1 - y0), bevelEnabled: false, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); return g;
}
/** Caixa centrada unitária (para peças alinhadas a um segmento com `beam`). */
export const BOXC = () => vGeo("boxC", () => new THREE.BoxGeometry(1, 1, 1));
/** Matriz da peça reta entre dois pontos (caixa centrada de seção w × h, comprimento = |b − a|). */
export function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, h: number): THREE.Matrix4 {
  const d = b.clone().sub(a), len = d.length(), m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.clone().normalize());
  m.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(len, h, w)); return m;
}

/* ======================= posição nas paredes ======================= */
export type Side = "N" | "S" | "W" | "E";
/**
 * Matriz no referencial da parede: x local ao longo da parede (para a direita de quem olha a parede de dentro), y para
 * cima, z local saindo da parede para dentro da sala. `s` = coordenada do mundo ao longo da parede (x no N/S, z no O/L).
 */
export function onWall(w: Side, s: number, y: number, off = 0): THREE.Matrix4 {
  switch (w) {
    case "N": return mat(s, y, Z0 + off, 0);
    case "S": return mat(s, y, Z1 - off, Math.PI);
    case "W": return mat(X0 + off, y, s, Math.PI / 2);
    case "E": return mat(X1 - off, y, s, -Math.PI / 2);
  }
}
/** Sentido de `s` na parede (+1: x local cresce com s). */
export const wallDir = (w: Side) => (w === "N" || w === "E" ? 1 : -1);

/* ======================= textos desenhados ======================= */
export interface VestCopy {
  hall: string; dock: string; staff: string; coat: string; checkin: string; welcome: string; gallery: string; floors: [string, string][];
  founded: string; museum: string; guestBook: string; wristbands: string; totemTitle: string; totemLines: string[]; youAreHere: string; quiet: string;
}
const VCOPY: Record<SceneLocale, VestCopy> = {
  "pt-BR": {
    hall: "GRANDE SALÃO", dock: "DOCA · SERVIÇO", staff: "SOMENTE FUNCIONÁRIOS", coat: "CHAPELARIA", checkin: "CREDENCIAMENTO", welcome: "BEM-VINDOS À GALA LUMIÈRE", gallery: "GALERIA",
    floors: [["2", "Galeria superior · Camarote"], ["1", "Grande Salão · Lounge e Bar"], ["1", "Instituto do Traje · Sala das Joias"], ["T", "Vestíbulo · Credenciamento · Chapelaria"]],
    founded: "MUSEU VESPER · FUNDADO EM MCMXII", museum: "MUSEU VESPER", guestBook: "Livro de presença", wristbands: "Pulseiras · acesso ao salão",
    totemTitle: "VOCÊ ESTÁ AQUI", totemLines: ["Grande Salão  ↑", "Chapelaria  →", "Credenciamento  ←", "Galeria  ↑ escadas"], youAreHere: "Vestíbulo", quiet: "Por favor, apresente o convite",
  },
  en: {
    hall: "GREAT HALL", dock: "DOCK · SERVICE", staff: "STAFF ONLY", coat: "COAT CHECK", checkin: "CHECK-IN", welcome: "WELCOME TO THE GALA LUMIÈRE", gallery: "GALLERY",
    floors: [["2", "Upper gallery · Balcony"], ["1", "Great Hall · Lounge and Bar"], ["1", "Costume Institute · Jewel Room"], ["G", "Vestibule · Check-in · Coat check"]],
    founded: "VESPER MUSEUM · FOUNDED MCMXII", museum: "VESPER MUSEUM", guestBook: "Guest book", wristbands: "Wristbands · hall access",
    totemTitle: "YOU ARE HERE", totemLines: ["Great Hall  ↑", "Coat check  →", "Check-in  ←", "Gallery  ↑ stairs"], youAreHere: "Vestibule", quiet: "Please present your invitation",
  },
  es: {
    hall: "GRAN SALÓN", dock: "MUELLE · SERVICIO", staff: "SOLO PERSONAL", coat: "GUARDARROPA", checkin: "ACREDITACIÓN", welcome: "BIENVENIDOS A LA GALA LUMIÈRE", gallery: "GALERÍA",
    floors: [["2", "Galería superior · Palco"], ["1", "Gran Salón · Lounge y Bar"], ["1", "Instituto del Traje · Sala de las Joyas"], ["PB", "Vestíbulo · Acreditación · Guardarropa"]],
    founded: "MUSEO VESPER · FUNDADO EN MCMXII", museum: "MUSEO VESPER", guestBook: "Libro de invitados", wristbands: "Pulseras · acceso al salón",
    totemTitle: "USTED ESTÁ AQUÍ", totemLines: ["Gran Salón  ↑", "Guardarropa  →", "Acreditación  ←", "Galería  ↑ escaleras"], youAreHere: "Vestíbulo", quiet: "Por favor, presente la invitación",
  },
};
/** Idioma do cenário a partir dos textos que a montagem recebeu. */
export function vLocale(copy: InteriorCopy): SceneLocale { return (Object.keys(COPY) as SceneLocale[]).find((k) => COPY[k] === copy) ?? "pt-BR"; }
export const vCopy = (copy: InteriorCopy): VestCopy => VCOPY[vLocale(copy)];
