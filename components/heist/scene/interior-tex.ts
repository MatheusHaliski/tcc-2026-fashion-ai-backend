/*
 * MET Gala Heist v2 — texturas procedurais do interior, desenhadas no navegador (nenhuma imagem baixada): pisos (terrazzo
 * com filetes de mármore amarelo do Grande Salão, xadrez de mármore do vestíbulo, assoalho escuro da exposição, carpete
 * adamascado do lounge, concreto, mármore negro da Sala das Joias, lajotas do terraço), paredes (calcário em blocos,
 * pintura de galeria, veludo adamascado, lambri, drywall, bloco de concreto) e os mapas de relevo e rugosidade de cada
 * uma. Todo ruído é periódico: a textura repete sem emenda. Também desenha os cartazes, placas e telas (canvas 2D).
 *
 * Nos testes (jsdom, contexto 2D falso) as texturas saem com 8 px: a cena monta igual, sem custo.
 */
import * as THREE from "three";

export type Quality = "high" | "low";

const FAKE = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);

/* ---------- ruído periódico ---------- */
function hash2(i: number, j: number, seed: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
/** Ruído de valor com período p (em células da rede): vnoise(x + p, y) = vnoise(x, y). */
function vnoise(x: number, y: number, p: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const i0 = ((xi % p) + p) % p, j0 = ((yi % p) + p) % p, i1 = (i0 + 1) % p, j1 = (j0 + 1) % p;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(i0, j0, seed), b = hash2(i1, j0, seed), c = hash2(i0, j1, seed), d = hash2(i1, j1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Soma de oitavas (u, v em [0, 1), período base p). */
export function fbm(u: number, v: number, p: number, seed: number, oct = 4): number {
  let s = 0, a = 0.5, n = 0, f = 1;
  for (let k = 0; k < oct; k++) { s += a * vnoise(u * p * f, v * p * f, p * f, seed + k * 31); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Gerador determinístico por semente (posições de lascas, tábuas, fitas). */
export function rand(seed: number) { let s = seed >>> 0 || 1; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }

/* ---------- superfícies ---------- */
export interface Surface { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }
/** out: r, g, b (0–1, sRGB), altura (0–1) e rugosidade (0–1). */
type PixelFn = (u: number, v: number, out: Float32Array) => void;

const surfaces = new Map<string, Surface>();

function canvas(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return { c, g: c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D };
}
function tex(c: HTMLCanvasElement, srgb: boolean, aniso = 8): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; return t;
}

/** Gera cor, relevo (normal map pelo gradiente da altura, com a borda dando a volta) e rugosidade de uma vez. */
function surface(key: string, size: number, fn: PixelFn, bump = 1.5): Surface {
  const hit = surfaces.get(key); if (hit) return hit;
  const n = FAKE ? 8 : size;
  const col = canvas(n, n), nor = canvas(n, n), rou = canvas(n, n);
  const ci = col.g.createImageData(n, n), ni = nor.g.createImageData(n, n), ri = rou.g.createImageData(n, n);
  const H = new Float32Array(n * n), out = new Float32Array(5);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    out[3] = 0.5; out[4] = 0.5;
    fn((x + 0.5) / n, (y + 0.5) / n, out);
    const k = (y * n + x) * 4;
    ci.data[k] = Math.max(0, Math.min(255, out[0] * 255)); ci.data[k + 1] = Math.max(0, Math.min(255, out[1] * 255)); ci.data[k + 2] = Math.max(0, Math.min(255, out[2] * 255)); ci.data[k + 3] = 255;
    const r = Math.max(0, Math.min(255, out[4] * 255)); ri.data[k] = r; ri.data[k + 1] = r; ri.data[k + 2] = r; ri.data[k + 3] = 255;
    H[y * n + x] = out[3];
  }
  const s = bump * n / 256;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const xl = (x - 1 + n) % n, xr = (x + 1) % n, yu = (y - 1 + n) % n, yd = (y + 1) % n;
    const dx = (H[y * n + xr] - H[y * n + xl]) * s, dy = (H[yd * n + x] - H[yu * n + x]) * s;
    const l = Math.hypot(dx, dy, 1), k = (y * n + x) * 4;
    ni.data[k] = (-dx / l * 0.5 + 0.5) * 255; ni.data[k + 1] = (dy / l * 0.5 + 0.5) * 255; ni.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[k + 3] = 255;
  }
  col.g.putImageData(ci, 0, 0); nor.g.putImageData(ni, 0, 0); rou.g.putImageData(ri, 0, 0);
  const sf = { map: tex(col.c, true), normalMap: tex(nor.c, false), roughnessMap: tex(rou.c, false) };
  surfaces.set(key, sf);
  return sf;
}

/** Veio de mármore: 1 sobre o veio, 0 fora (t = coordenada turbulenta). */
function vein(t: number, width: number) { const s = Math.abs(Math.sin(t * Math.PI)); return 1 - smooth(0, width, s); }

/** Lascas (terrazzo): célula sorteada mais perto em grade de `cells`; devolve índice da cor ou −1. */
function chip(u: number, v: number, cells: number, seed: number, fill: number): number {
  const x = u * cells, y = v * cells, xi = Math.floor(x), yi = Math.floor(y);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const ci = ((xi + dx) % cells + cells) % cells, cj = ((yi + dy) % cells + cells) % cells;
    const h = hash2(ci, cj, seed); if (h > fill) continue;
    const cx = xi + dx + hash2(ci, cj, seed + 7), cy = yi + dy + hash2(ci, cj, seed + 13);
    const r = 0.18 + 0.32 * hash2(ci, cj, seed + 19);
    const ex = (x - cx) * (1 + 0.5 * hash2(ci, cj, seed + 3)), ey = y - cy;
    if (ex * ex + ey * ey < r * r) return Math.floor(hash2(ci, cj, seed + 29) * 6);
  }
  return -1;
}
const CHIPS: [number, number, number][] = [[0.95, 0.94, 0.9], [0.62, 0.6, 0.57], [0.16, 0.15, 0.15], [0.66, 0.38, 0.26], [0.83, 0.74, 0.58], [0.74, 0.62, 0.36]];

export type FloorKey = "terrazzo" | "checker" | "parquet" | "carpet" | "stage" | "concrete" | "marbleBlack" | "pavers" | "galleryMarble";
export type WallKey = "limestone" | "galleryPaint" | "damaskGreen" | "woodPanel" | "blackPaint" | "drywall" | "cmu" | "damaskPlum" | "damaskTeal";
export type MiscKey = "plaster" | "acoustic" | "marbleWhite" | "fabric" | "brushed" | "grain" | "leather" | "crate" | "hedge";

/** Metros que uma repetição da textura cobre no mundo (u = x / tamanho). */
export const TILE: Record<FloorKey | WallKey | MiscKey, [number, number]> = {
  terrazzo: [2, 2], checker: [1.2, 1.2], parquet: [2, 2], carpet: [1.2, 1.2], stage: [3, 3], concrete: [3, 3], marbleBlack: [1.2, 1.2], pavers: [2.4, 2.4], galleryMarble: [2, 2],
  limestone: [2.4, 1.2], galleryPaint: [2, 2], damaskGreen: [0.8, 0.8], woodPanel: [1, 1.1], blackPaint: [2, 2], drywall: [2, 2], cmu: [1.6, 0.8], damaskPlum: [0.8, 0.8], damaskTeal: [0.8, 0.8],
  plaster: [2, 2], acoustic: [1.2, 1.2], marbleWhite: [1, 1], fabric: [0.5, 0.5], brushed: [1, 1], grain: [1, 1], leather: [0.4, 0.4], crate: [1.2, 1.2], hedge: [0.6, 0.6],
};

function damask(u: number, v: number): number {
  // medalhão de quatro pétalas em grade 2×2 com losangos entre eles (linha fina ~ 0–1)
  const x = (u * 2 % 1) - 0.5, y = (v * 2 % 1) - 0.5, r = Math.hypot(x, y), a = Math.atan2(y, x);
  const petal = 0.26 + 0.1 * Math.cos(4 * a) + 0.03 * Math.cos(12 * a);
  const m1 = 1 - smooth(0.012, 0.03, Math.abs(r - petal));
  const m2 = 1 - smooth(0.01, 0.025, Math.abs(r - 0.08 - 0.03 * Math.cos(8 * a)));
  const d = Math.abs(Math.abs(x) + Math.abs(y) - 0.5);
  const m3 = 1 - smooth(0.006, 0.02, d);
  const leaf = r > 0.33 && r < 0.48 ? (1 - smooth(0.0, 0.04, Math.abs(Math.sin(a * 2) * 0.12 - (r - 0.4)))) * 0.6 : 0;
  return Math.min(1, m1 + m2 + m3 * 0.8 + leaf);
}

export function floorSurface(k: FloorKey, q: Quality): Surface {
  const big = q === "high" ? 1024 : 512;
  switch (k) {
    case "terrazzo": return surface("terrazzo" + q, big, (u, v, o) => {
      const n = fbm(u, v, 6, 11, 3);
      let r = 0.6 + 0.04 * n, g = 0.55 + 0.04 * n, b = 0.48 + 0.04 * n, h = 0.5, ro = 0.11 + 0.05 * fbm(u, v, 4, 5, 2);
      const c1 = chip(u, v, 90, 3, 0.55), c2 = c1 < 0 ? chip(u, v, 34, 9, 0.35) : -1, c = c1 >= 0 ? c1 : c2;
      if (c >= 0) { const [cr, cg, cb] = CHIPS[c]; const t = 0.85 + 0.15 * fbm(u * 3, v * 3, 8, c, 2); r = cr * t; g = cg * t; b = cb * t; ro = 0.11 + 0.04 * (c % 3); }
      // filetes de mármore amarelo na borda de cada placa de 2 m (grade alinhada com a colunata)
      const w = 0.018, edge = Math.min(u, 1 - u, v, 1 - v);
      if (edge < w) { const t = fbm(u * 8, v * 8, 4, 77, 3); r = 0.8 + 0.08 * t; g = 0.62 + 0.08 * t; b = 0.27 + 0.06 * t; ro = 0.1; h = edge < 0.0025 ? 0.35 : 0.5; }
      o[0] = r; o[1] = g; o[2] = b; o[3] = h; o[4] = ro;
    }, 0.8);
    case "checker": return surface("checker" + q, big, (u, v, o) => {
      const dark = (Math.floor(u * 2) + Math.floor(v * 2)) % 2 === 1;
      const lu = u * 2 % 1, lv = v * 2 % 1, joint = Math.min(lu, 1 - lu, lv, 1 - lv) < 0.006;
      const t = fbm(u, v, 3, dark ? 41 : 43, 4) * 5 + (u * 1.3 + v * 0.7) * 3;
      const ve = vein(t, dark ? 0.05 : 0.09) * (0.55 + 0.45 * fbm(u, v, 5, 47, 2));
      const ve2 = vein(t * 2.3 + 1.7, 0.04) * 0.4;
      if (dark) { const base = 0.045 + 0.02 * fbm(u, v, 8, 51, 2); const w = Math.max(ve, ve2) * 0.85; o[0] = mix(base, 0.82, w); o[1] = mix(base, 0.8, w); o[2] = mix(base * 1.1, 0.78, w); }
      else { const base = 0.9 + 0.04 * fbm(u, v, 6, 53, 2); const w = Math.max(ve, ve2) * 0.5; o[0] = mix(base, 0.46, w); o[1] = mix(base, 0.47, w); o[2] = mix(base, 0.5, w); }
      if (joint) { o[0] = o[1] = o[2] = 0.3; }
      o[3] = joint ? 0.3 : 0.5; o[4] = joint ? 0.6 : 0.07 + 0.04 * ve;
    }, 1);
    case "parquet": {
      // tábuas corridas de nogueira, 16 fileiras por placa, emendas sorteadas por fileira
      const R = rand(91), rows = 16, cuts: number[][] = [];
      for (let i = 0; i < rows; i++) { const c: number[] = []; let x = R() * 0.4; while (x < 1) { c.push(x); x += 0.3 + R() * 0.55; } cuts.push(c); }
      return surface("parquet" + q, big, (u, v, o) => {
        const row = Math.floor(v * rows), lv = v * rows % 1, c = cuts[row];
        let k = 0; for (let i = 0; i < c.length; i++) if (u >= c[i]) k = i + 1;
        const plank = row * 13 + k, tone = hash2(plank, 1, 5), seam = lv < 0.03 || lv > 0.97 || c.some((x) => Math.abs(u - x) < 0.0016);
        const grain = Math.sin((lv * 3 + fbm(u * 0.5, v, 6, plank, 3) * 6 + u * 40) * 2.2) * 0.5 + 0.5;
        const base = 0.17 + 0.07 * tone, gr = 0.82 + 0.18 * grain;
        o[0] = base * 1.05 * gr; o[1] = base * 0.68 * gr; o[2] = base * 0.42 * gr;
        if (seam) { o[0] *= 0.35; o[1] *= 0.35; o[2] *= 0.35; }
        o[3] = seam ? 0.25 : 0.5 + 0.05 * grain; o[4] = seam ? 0.7 : 0.32 + 0.1 * (1 - grain);
      }, 1.2);
    }
    case "carpet": return surface("carpet" + q, q === "high" ? 512 : 256, (u, v, o) => {
      const fib = vnoise(u * 256, v * 256, 256, 61), d = damask(u, v), n = fbm(u, v, 4, 63, 2);
      const r = mix(0.3, 0.6, d), g = mix(0.035, 0.42, d), b = mix(0.06, 0.16, d);
      const t = 0.82 + 0.18 * fib + 0.08 * (n - 0.5);
      o[0] = r * t; o[1] = g * t; o[2] = b * t; o[3] = 0.4 + 0.25 * fib + 0.2 * d; o[4] = 0.92 - 0.12 * d;
    }, 0.9);
    case "stage": {
      const R = rand(5), tapes: [number, number, number, number, number][] = [];
      for (let i = 0; i < 14; i++) tapes.push([R(), R(), 0.012 + R() * 0.015, 0.003, Math.floor(R() * 3)]);
      const TAPE: [number, number, number][] = [[0.95, 0.3, 0.55], [0.95, 0.85, 0.2], [0.3, 0.85, 0.4]];
      return surface("stage" + q, big, (u, v, o) => {
        const sc = fbm(u, v, 12, 71, 4), streak = smooth(0.62, 0.8, fbm(u * 0.3, v * 3, 8, 73, 3));
        const b = 0.03 + 0.03 * sc + 0.05 * streak;
        o[0] = b; o[1] = b; o[2] = b * 1.1; o[3] = 0.5; o[4] = 0.6 - 0.25 * streak;
        for (const [x, y, w, h, c] of tapes) if ((Math.abs(u - x) < w && Math.abs(v - y) < h) || (Math.abs(u - x) < h && Math.abs(v - y) < w)) { [o[0], o[1], o[2]] = TAPE[c]; o[4] = 0.4; o[3] = 0.55; }
      }, 0.6);
    }
    case "concrete": return surface("concrete" + q, big, (u, v, o) => {
      const n = fbm(u, v, 5, 81, 5), st = smooth(0.55, 0.75, fbm(u, v, 3, 83, 3)), pore = vnoise(u * 400, v * 400, 400, 85) > 0.93;
      const joint = Math.min(u, 1 - u, v, 1 - v) < 0.0018;
      let b = 0.5 + 0.12 * n - 0.1 * st; if (pore) b *= 0.7; if (joint) b *= 0.45;
      o[0] = b; o[1] = b * 0.99; o[2] = b * 0.96; o[3] = joint ? 0.3 : 0.5 + 0.05 * n - (pore ? 0.1 : 0); o[4] = 0.62 - 0.22 * st + 0.08 * n;
    }, 0.8);
    case "marbleBlack": return surface("marbleBlack" + q, big, (u, v, o) => {
      const lu = u * 2 % 1, lv = v * 2 % 1, joint = Math.min(lu, 1 - lu, lv, 1 - lv) < 0.004;
      const sq = Math.floor(u * 2) + 2 * Math.floor(v * 2);
      const t = fbm(u, v, 3, 101 + sq, 5) * 6 + (sq % 2 ? u - v : u + v) * 2.4;
      const w = Math.max(vein(t, 0.035), vein(t * 1.9 + 0.4, 0.02) * 0.5) * (0.4 + 0.6 * fbm(u, v, 6, 103, 2));
      const base = 0.03 + 0.015 * fbm(u, v, 10, 105, 2);
      if (joint) { o[0] = 0.72; o[1] = 0.55; o[2] = 0.25; o[4] = 0.25; o[3] = 0.55; return; }
      o[0] = mix(base, 0.85, w); o[1] = mix(base, 0.83, w); o[2] = mix(base * 1.15, 0.8, w); o[3] = 0.5; o[4] = 0.06 + 0.03 * w;
    }, 0.6);
    case "galleryMarble": return surface("galleryMarble" + q, big, (u, v, o) => {
      // placa de 2 m de mármore creme polido com veios suaves e a faixa embutida de mármore verde-negro (referência: corredor
      // de museu com piso espelhado); juntas finas a cada 1 m
      const lu = u * 2 % 1, lv = v * 2 % 1, joint = Math.min(lu, 1 - lu, lv, 1 - lv) < 0.0035;
      const e = Math.min(u, 1 - u, v, 1 - v), band = e > 0.055 && e < 0.1, fillet = Math.abs(e - 0.05) < 0.004 || Math.abs(e - 0.105) < 0.004;
      const t = fbm(u, v, 3, 301, 5) * 5 + (u * 0.8 + v * 1.4) * 2.2;
      const w = Math.max(vein(t, 0.05) * 0.45, vein(t * 2.4 + 0.7, 0.025) * 0.25) * (0.5 + 0.5 * fbm(u, v, 6, 303, 2));
      if (band) { const tb = fbm(u * 3, v * 3, 6, 305, 3); const wb = vein(t * 1.6, 0.03) * 0.6; o[0] = mix(0.035 + 0.02 * tb, 0.5, wb); o[1] = mix(0.06 + 0.02 * tb, 0.52, wb); o[2] = mix(0.05 + 0.02 * tb, 0.48, wb); o[3] = 0.5; o[4] = 0.05; return; }
      if (fillet) { o[0] = 0.78; o[1] = 0.6; o[2] = 0.3; o[3] = 0.52; o[4] = 0.12; return; }
      const base = fbm(u, v, 5, 307, 3);
      o[0] = mix(0.86 + 0.03 * base, 0.62, w); o[1] = mix(0.8 + 0.03 * base, 0.58, w); o[2] = mix(0.68 + 0.03 * base, 0.52, w);
      if (joint) { o[0] *= 0.7; o[1] *= 0.7; o[2] *= 0.7; }
      o[3] = joint ? 0.35 : 0.5; o[4] = joint ? 0.4 : 0.05 + 0.04 * w;
    }, 0.5);
    case "pavers": {
      const R = rand(17); const tones = Array.from({ length: 64 }, () => R());
      return surface("pavers" + q, big, (u, v, o) => {
        // fiadas de 0,6 m com lajotas de 0,8 m em amarração
        const rows = 4, row = Math.floor(v * rows), lv = v * rows % 1, off = row % 2 ? 0.5 / 3 : 0;
        const cols = 3, x = ((u + off) % 1) * cols, col = Math.floor(x), lu = x % 1;
        const joint = Math.min(lv, 1 - lv) < 0.012 || Math.min(lu, 1 - lu) < 0.009;
        const tone = tones[(row * 7 + col) % 64], n = fbm(u, v, 8, 111, 4), pit = vnoise(u * 300, v * 300, 300, 113) > 0.94;
        let r = 0.66 + 0.08 * tone + 0.06 * n, g = 0.62 + 0.07 * tone + 0.05 * n, b = 0.55 + 0.06 * tone + 0.04 * n;
        if (pit) { r *= 0.8; g *= 0.8; b *= 0.8; }
        if (joint) { r = 0.22; g = 0.24; b = 0.2; }
        o[0] = r; o[1] = g; o[2] = b; o[3] = joint ? 0.2 : 0.5 + 0.08 * n - (pit ? 0.08 : 0); o[4] = joint ? 0.95 : 0.78 + 0.1 * n;
      }, 1.2);
    }
  }
}

export function wallSurface(k: WallKey, q: Quality): Surface {
  const sz = q === "high" ? 512 : 256;
  switch (k) {
    case "limestone": return surface("limestone" + q, sz * 2, (u, v, o) => {
      // blocos de 1,2 × 0,4 m em amarração (textura de 2,4 × 1,2 m: 2 colunas × 3 fiadas)
      const rows = 3, row = Math.floor(v * rows), lv = v * rows % 1, off = row % 2 ? 0.25 : 0, x = ((u + off) % 1) * 2, lu = x % 1;
      const joint = Math.min(lv, 1 - lv) < 0.012 || Math.min(lu, 1 - lu) < 0.006;
      const blk = row * 3 + Math.floor(x), tone = hash2(blk, 3, 7), n = fbm(u, v, 6, 121, 5), pit = vnoise(u * 360, v * 180, 360, 123) > 0.95;
      let r = 0.8 + 0.05 * tone + 0.06 * (n - 0.5), g = 0.74 + 0.05 * tone + 0.05 * (n - 0.5), b = 0.62 + 0.04 * tone + 0.05 * (n - 0.5);
      if (pit) { r *= 0.82; g *= 0.82; b *= 0.82; }
      if (joint) { r = 0.86; g = 0.82; b = 0.74; }
      o[0] = r; o[1] = g; o[2] = b; o[3] = joint ? 0.25 : 0.5 + 0.1 * n - (pit ? 0.1 : 0); o[4] = 0.72 + 0.12 * n;
    }, 1.4);
    case "galleryPaint": return surface("galleryPaint" + q, sz, (u, v, o) => {
      const n = fbm(u, v, 8, 131, 4), roller = vnoise(u * 3, v * 90, 3, 133);
      o[0] = 0.07 + 0.012 * n + 0.006 * roller; o[1] = 0.08 + 0.012 * n + 0.006 * roller; o[2] = 0.11 + 0.014 * n + 0.006 * roller; o[3] = 0.5 + 0.06 * n; o[4] = 0.88;
    }, 0.4);
    case "damaskGreen": case "damaskPlum": case "damaskTeal": {
      const green = k === "damaskGreen", teal = k === "damaskTeal";
      return surface(k + q, sz, (u, v, o) => {
        const d = damask(u, v), fib = vnoise(u * 200, v * 200, 200, 141), n = fbm(u, v, 4, 143, 2);
        const t = 0.86 + 0.14 * fib + 0.06 * (n - 0.5);
        if (teal) { o[0] = mix(0.085, 0.15, d) * t; o[1] = mix(0.18, 0.27, d) * t; o[2] = mix(0.22, 0.31, d) * t; }
        else if (green) { o[0] = mix(0.025, 0.06, d) * t; o[1] = mix(0.17, 0.26, d) * t; o[2] = mix(0.11, 0.14, d) * t; }
        else { o[0] = mix(0.2, 0.36, d) * t; o[1] = mix(0.03, 0.08, d) * t; o[2] = mix(0.09, 0.12, d) * t; }
        o[3] = 0.45 + 0.15 * d + 0.1 * fib; o[4] = 0.88 - 0.4 * d;
      }, 0.7);
    }
    case "woodPanel": return surface("woodPanel" + q, sz, (u, v, o) => {
      // lambri de mogno com almofada central em relevo
      const fx = Math.min(u, 1 - u), fy = Math.min(v, 1 - v), frame = Math.min(fx, fy);
      const bevel = frame < 0.08 ? 0.5 : frame < 0.12 ? 0.5 + (frame - 0.08) * 6 : 0.74;
      const grain = Math.sin((u * 2 + fbm(u, v, 5, 151, 3) * 3) * 24) * 0.5 + 0.5;
      const b = 0.24 + 0.05 * grain;
      o[0] = b * 1.05; o[1] = b * 0.42; o[2] = b * 0.22; if (frame < 0.012) { o[0] *= 0.5; o[1] *= 0.5; o[2] *= 0.5; }
      o[3] = bevel; o[4] = 0.32 + 0.1 * grain;
    }, 2.5);
    case "blackPaint": return surface("blackPaint" + q, sz, (u, v, o) => {
      const sc = smooth(0.66, 0.85, fbm(u * 2, v * 0.5, 6, 161, 4)), n = fbm(u, v, 8, 163, 3);
      const b = 0.03 + 0.012 * n + 0.04 * sc; o[0] = b; o[1] = b; o[2] = b * 1.08; o[3] = 0.5; o[4] = 0.82 - 0.2 * sc;
    }, 0.4);
    case "drywall": return surface("drywall" + q, sz, (u, v, o) => {
      const n = fbm(u, v, 6, 171, 4), scuff = smooth(0.62, 0.82, fbm(u * 3, v, 10, 173, 3)) * smooth(0.25, 0.0, 1 - v);
      const b = 0.62 + 0.03 * n - 0.18 * scuff;
      o[0] = b * 0.98; o[1] = b; o[2] = b * 0.94; o[3] = 0.5 + 0.03 * n; o[4] = 0.86 - 0.1 * scuff;
    }, 0.5);
    case "cmu": return surface("cmu" + q, sz, (u, v, o) => {
      // blocos de 0,4 × 0,2 m (textura de 1,6 × 0,8: 4 × 4), juntas fundas
      const rows = 4, row = Math.floor(v * rows), lv = v * rows % 1, off = row % 2 ? 0.125 : 0, x = ((u + off) % 1) * 4, lu = x % 1;
      const joint = Math.min(lv, 1 - lv) < 0.05 || Math.min(lu, 1 - lu) < 0.025;
      const pore = vnoise(u * 320, v * 320, 320, 181) > 0.88, n = fbm(u, v, 8, 183, 3);
      let b = 0.72 + 0.04 * n; if (pore) b *= 0.86; if (joint) b *= 0.84;
      o[0] = b; o[1] = b; o[2] = b * 0.97; o[3] = joint ? 0.2 : 0.55 - (pore ? 0.12 : 0) + 0.05 * n; o[4] = 0.9;
    }, 2.2);
  }
}

export function miscSurface(k: MiscKey, q: Quality): Surface {
  const sz = q === "high" ? 512 : 256;
  switch (k) {
    case "plaster": return surface("plaster" + q, sz, (u, v, o) => {
      const n = fbm(u, v, 6, 191, 4); o[0] = 0.86 + 0.03 * n; o[1] = 0.82 + 0.03 * n; o[2] = 0.74 + 0.03 * n; o[3] = 0.5 + 0.05 * n; o[4] = 0.85;
    }, 0.4);
    case "acoustic": return surface("acoustic" + q, sz, (u, v, o) => {
      const lu = u * 2 % 1, lv = v * 2 % 1, bar = Math.min(lu, 1 - lu, lv, 1 - lv) < 0.02, dot = vnoise(u * 180, v * 180, 180, 201) > 0.7;
      const b = bar ? 0.8 : 0.84 - (dot ? 0.08 : 0); o[0] = b; o[1] = b; o[2] = b * 0.98; o[3] = bar ? 0.6 : 0.5 - (dot ? 0.1 : 0); o[4] = bar ? 0.5 : 0.95;
    }, 0.8);
    case "marbleWhite": return surface("marbleWhite" + q, sz, (u, v, o) => {
      const t = fbm(u, v, 3, 211, 5) * 5 + (u + v * 0.4) * 2;
      const w = Math.max(vein(t, 0.06) * 0.6, vein(t * 2.1, 0.03) * 0.3) * fbm(u, v, 5, 213, 2);
      const base = 0.9 + 0.04 * fbm(u, v, 8, 215, 2); o[0] = mix(base, 0.55, w); o[1] = mix(base, 0.56, w); o[2] = mix(base, 0.6, w); o[3] = 0.5; o[4] = 0.22 + 0.08 * w;
    }, 0.4);
    case "fabric": return surface("fabric" + q, sz / 2, (u, v, o) => {
      const w = Math.sin(u * 256 * Math.PI) * Math.sin(v * 256 * Math.PI), n = fbm(u, v, 16, 221, 3);
      const b = 0.82 + 0.1 * w + 0.12 * n; o[0] = b; o[1] = b; o[2] = b; o[3] = 0.5 + 0.2 * w; o[4] = 0.85 + 0.1 * n;
    }, 0.6);
    case "brushed": return surface("brushed" + q, sz / 2, (u, v, o) => {
      const s = vnoise(u * 4, v * 220, 4, 231) * 0.6 + vnoise(u * 2, v * 600, 2, 233) * 0.4; const b = 0.75 + 0.2 * s;
      o[0] = b; o[1] = b; o[2] = b; o[3] = 0.5 + 0.1 * s; o[4] = 0.3 + 0.15 * s;
    }, 0.3);
    case "grain": return surface("grain" + q, sz, (u, v, o) => {
      const g = Math.sin((u * 3 + fbm(u, v, 4, 241, 4) * 4) * 30) * 0.5 + 0.5; const b = 0.75 + 0.25 * g;
      o[0] = b; o[1] = b; o[2] = b; o[3] = 0.5 + 0.1 * g; o[4] = 0.45 + 0.15 * g;
    }, 0.8);
    case "leather": return surface("leather" + q, sz / 2, (u, v, o) => {
      const c = 1 - Math.min(1, Math.abs(vnoise(u * 60, v * 60, 60, 251) - 0.5) * 6); const b = 0.85 + 0.15 * (1 - c);
      o[0] = b; o[1] = b; o[2] = b; o[3] = 0.5 - 0.15 * c; o[4] = 0.5 + 0.2 * c;
    }, 1);
    case "hedge": return surface("hedge" + q, sz, (u, v, o) => {
      // buxo podado: folhinhas elípticas sobrepostas (duas por célula, giradas e deslocadas) e vãos escuros entre elas
      const cells = 22, x = u * cells, y = v * cells, xi = Math.floor(x), yi = Math.floor(y);
      let best = -1, bh = 0, bt = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (let k = 0; k < 2; k++) {
        const ci = ((xi + dx) % cells + cells) % cells, cj = ((yi + dy) % cells + cells) % cells, s = 401 + k * 17;
        const cx = xi + dx + hash2(ci, cj, s), cy = yi + dy + hash2(ci, cj, s + 3), a = hash2(ci, cj, s + 5) * Math.PI;
        const px = x - cx, py = y - cy, ra = px * Math.cos(a) + py * Math.sin(a), rb = -px * Math.sin(a) + py * Math.cos(a);
        const e = (ra / 0.62) ** 2 + (rb / 0.27) ** 2; if (e >= 1) continue;
        const order = hash2(ci, cj, s + 7); if (order > best) { best = order; bh = 1 - e; bt = hash2(ci, cj, s + 11); }
      }
      if (best < 0) { o[0] = 0.03; o[1] = 0.06; o[2] = 0.03; o[3] = 0.1; o[4] = 0.95; return; }
      const sh = 0.55 + 0.45 * bh;
      o[0] = (0.1 + 0.08 * bt) * sh; o[1] = (0.24 + 0.12 * bt) * sh; o[2] = (0.09 + 0.05 * bt) * sh; o[3] = 0.3 + 0.7 * Math.sqrt(bh); o[4] = 0.55 - 0.2 * bh;
    }, 2.6);
    case "crate": return surface("crate" + q, sz, (u, v, o) => {
      // tábuas de pinho de 0,15 m com pregos
      const row = Math.floor(v * 8), lv = v * 8 % 1, gap = lv < 0.04, tone = hash2(row, 9, 3);
      const grain = Math.sin((u * 4 + fbm(u, v, 4, 261 + row, 3) * 3) * 20) * 0.5 + 0.5, nail = (Math.abs(u % 0.25 - 0.06) < 0.008 && Math.abs(lv - 0.5) < 0.05);
      const b = (0.6 + 0.12 * tone) * (0.88 + 0.12 * grain);
      o[0] = gap ? 0.12 : nail ? 0.25 : b; o[1] = gap ? 0.09 : nail ? 0.25 : b * 0.78; o[2] = gap ? 0.06 : nail ? 0.27 : b * 0.52;
      o[3] = gap ? 0.1 : 0.5 + 0.05 * grain; o[4] = gap ? 1 : 0.8;
    }, 1.2);
  }
}

/* ---------- texturas desenhadas (cartazes, placas, telas) ---------- */
const drawn = new Map<string, THREE.CanvasTexture>();
/** Canvas desenhado uma vez por chave. Nos testes sai com 8 px (contexto falso). */
export function drawnTexture(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true): THREE.CanvasTexture {
  const hit = drawn.get(key); if (hit) return hit;
  const W = FAKE ? 8 : w, Hh = FAKE ? 8 : h;
  const { c, g } = canvas(W, Hh);
  if (!FAKE) draw(g, W, Hh);
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; t.needsUpdate = true;
  drawn.set(key, t); return t;
}
export const SERIF = "'Didot', 'Bodoni 72', 'Bodoni MT', 'Playfair Display', Georgia, 'Times New Roman', 'DejaVu Serif', serif";
export const SANS = "'Helvetica Neue', 'Futura', 'Avenir Next', Arial, 'DejaVu Sans', sans-serif";
export const HAND = "'Marker Felt', 'Bradley Hand', 'Segoe Print', 'Comic Sans MS', 'DejaVu Sans', cursive";

/** Texto espaçado (letter-spacing manual: o canvas 2D não tem em todos os navegadores). */
export function spaced(g: CanvasRenderingContext2D, s: string, x: number, y: number, spacing: number, align: "center" | "left" = "center") {
  const chars = [...s]; const widths = chars.map((c) => g.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === "center" ? x - total / 2 : x; const prev = g.textAlign; g.textAlign = "left";
  chars.forEach((c, i) => { g.fillText(c, cx, y); cx += widths[i] + spacing; });
  g.textAlign = prev;
}
/** Ajusta a fonte para o texto caber na largura. */
export function fit(g: CanvasRenderingContext2D, s: string, font: (px: number) => string, px: number, maxW: number): number {
  let p = px; g.font = font(p); while (p > 8 && g.measureText(s).width > maxW) { p -= 2; g.font = font(p); } return p;
}
/** Símbolos da vitrine desenhados em vetor (sem depender de fonte com ★ ☾ ♛). */
export function drawSymbol(g: CanvasRenderingContext2D, kind: string, cx: number, cy: number, r: number) {
  g.beginPath();
  if (kind === "estrela") {
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  } else if (kind === "lua") {
    g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.save(); g.globalCompositeOperation = "destination-out"; g.beginPath(); g.arc(cx + r * 0.45, cy - r * 0.2, r * 0.86, 0, Math.PI * 2); g.fill(); g.restore();
  } else if (kind === "coroa") {
    const w = r * 1.1, top = cy - r * 0.8, base = cy + r * 0.55;
    g.moveTo(cx - w, base); g.lineTo(cx - w, top + r * 0.35); g.lineTo(cx - w * 0.5, cy - r * 0.05); g.lineTo(cx, top); g.lineTo(cx + w * 0.5, cy - r * 0.05); g.lineTo(cx + w, top + r * 0.35); g.lineTo(cx + w, base); g.closePath(); g.fill();
    g.fillRect(cx - w, base + r * 0.12, w * 2, r * 0.22);
    for (const x of [-w, 0, w]) { g.beginPath(); g.arc(cx + x, (x === 0 ? top : top + r * 0.35) - r * 0.1, r * 0.13, 0, Math.PI * 2); g.fill(); }
  } else if (kind === "coracao") {
    g.moveTo(cx, cy + r * 0.85);
    g.bezierCurveTo(cx - r * 1.4, cy - r * 0.1, cx - r * 0.6, cy - r * 1.1, cx, cy - r * 0.35);
    g.bezierCurveTo(cx + r * 0.6, cy - r * 1.1, cx + r * 1.4, cy - r * 0.1, cx, cy + r * 0.85); g.fill();
  }
}

/** Silhueta de vestido de gala (ilustração de cartaz): corpete, cintura marcada e saia rodada com cauda. */
export function drawGown(g: CanvasRenderingContext2D, cx: number, top: number, h: number, fill: string | CanvasGradient) {
  const w = h * 0.36;
  g.fillStyle = fill; g.beginPath();
  g.moveTo(cx - w * 0.16, top + h * 0.02); g.quadraticCurveTo(cx, top - h * 0.02, cx + w * 0.16, top + h * 0.02);
  g.lineTo(cx + w * 0.2, top + h * 0.2); g.quadraticCurveTo(cx + w * 0.1, top + h * 0.3, cx + w * 0.12, top + h * 0.36);
  g.bezierCurveTo(cx + w * 0.6, top + h * 0.55, cx + w * 1.0, top + h * 0.85, cx + w * 1.15, top + h);
  g.lineTo(cx - w * 0.85, top + h); g.bezierCurveTo(cx - w * 0.75, top + h * 0.8, cx - w * 0.45, top + h * 0.55, cx - w * 0.12, top + h * 0.36);
  g.quadraticCurveTo(cx - w * 0.1, top + h * 0.3, cx - w * 0.2, top + h * 0.2); g.closePath(); g.fill();
  // pregas da saia
  g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = Math.max(1, h * 0.004);
  for (let i = -3; i <= 4; i++) { g.beginPath(); g.moveTo(cx + i * w * 0.03, top + h * 0.4); g.quadraticCurveTo(cx + i * w * 0.12, top + h * 0.7, cx + i * w * 0.26, top + h * 0.99); g.stroke(); }
}

/** Ruído de papel (folha de chamada, placas). */
export function paper(g: CanvasRenderingContext2D, w: number, h: number, base: [number, number, number], seed: number) {
  const id = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm(x / w, y / h, 8, seed, 3) * 0.06 + (hash2(x, y, seed) - 0.5) * 0.03, k = (y * w + x) * 4;
    id.data[k] = (base[0] + n) * 255; id.data[k + 1] = (base[1] + n) * 255; id.data[k + 2] = (base[2] + n) * 255; id.data[k + 3] = 255;
  }
  g.putImageData(id, 0, 0);
}
