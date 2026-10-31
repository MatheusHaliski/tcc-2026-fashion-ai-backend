/*
 * MET Gala Heist v2 — texturas procedurais da cena externa (canvas, sem baixar imagens): pedra calcária em fiadas,
 * cantaria rusticada, granito, asfalto molhado com poças, calçada de placas de concreto, tapete da gala, tijolo, fachadas
 * de apartamentos com janelas acesas, folhagem, banners da exposição, letreiros e manchas de luz.
 *
 * Cada textura sai em escala de mundo: o tamanho em metros que ela cobre está em `meters`, e a geometria usa UV em metros
 * (exterior-geometry.ts), então `repeat = 1 / meters`. Mapas de cor em sRGB; normal e ORM (R oclusão, G rugosidade,
 * B metal) lineares. Tudo é gerado uma vez por qualidade e fica em cache no módulo (remontar a cena não refaz nada).
 */
import * as THREE from "three";

export type Quality = "high" | "low";

const cache = new Map<string, unknown>();
/** Cache das texturas do módulo (as da cidade também guardam aqui: chave com o prefixo "city-"). */
export function memo<T>(key: string, make: () => T): T { if (!cache.has(key)) cache.set(key, make()); return cache.get(key) as T; }

/** Sorteio com semente (mulberry32): a rua é sempre a mesma. */
export function prng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- ruído periódico (as texturas emendam sem costura) ---------- */
/** Campo fbm periódico size×size em 0–1: soma de oitavas de ruído de valor numa rede que repete a cada `base·2^o`. */
function field(size: number, seed: number, octaves = 5, base = 4): Float32Array {
  const out = new Float32Array(size * size); const r = prng(seed);
  let amp = 0.5, total = 0;
  for (let o = 0; o < octaves; o++) {
    const per = base << o, lat = new Float32Array(per * per);
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    const k = per / size;
    for (let y = 0; y < size; y++) {
      const fy = y * k, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty), y0 = (iy % per) * per, y1 = ((iy + 1) % per) * per;
      for (let x = 0; x < size; x++) {
        const fx = x * k, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx), x0 = ix % per, x1 = (ix + 1) % per;
        const a = lat[y0 + x0], b = lat[y0 + x1], c = lat[y1 + x0], d = lat[y1 + x1];
        out[y * size + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
export const fieldOf = (size: number, seed: number, octaves = 5, base = 4) => memo(`f${size}:${seed}:${octaves}:${base}`, () => field(size, seed, octaves, base));
/** Amostra o campo com repetição (bilinear), em coordenadas de pixel de um campo de lado n. */
export function samp(f: Float32Array, n: number, x: number, y: number): number {
  x = ((x % n) + n) % n; y = ((y % n) + n) % n;
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy, ix1 = (ix + 1) % n, iy1 = (iy + 1) % n;
  const a = f[iy * n + ix], b = f[iy * n + ix1], c = f[iy1 * n + ix], d = f[iy1 * n + ix1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ---------- saída: canvas → textura ---------- */
export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return [c, c.getContext("2d", { willReadFrequently: false })!];
}
export function texFrom(c: HTMLCanvasElement, srgb: boolean, meters?: number | [number, number]): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (meters !== undefined) { const [mx, my] = typeof meters === "number" ? [meters, meters] : meters; t.repeat.set(1 / mx, 1 / my); }
  t.needsUpdate = true;
  return t;
}
/** Escreve RGBA num canvas a partir de uma função por pixel. */
function paint(w: number, h: number, px: (x: number, y: number, o: Uint8ClampedArray, i: number) => void): HTMLCanvasElement {
  const [c, g] = canvas(w, h); const img = g.createImageData(w, h); const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(x, y, d, (y * w + x) * 4);
  g.putImageData(img, 0, 0); return c;
}
/** Mapa normal (espaço tangente, +Y para cima) a partir de um campo de altura periódico. */
export function normalFrom(hf: Float32Array, w: number, h: number, strength: number): HTMLCanvasElement {
  return paint(w, h, (x, y, d, i) => {
    const l = hf[y * w + ((x - 1 + w) % w)], r = hf[y * w + ((x + 1) % w)], u = hf[((y - 1 + h) % h) * w + x], b = hf[((y + 1) % h) * w + x];
    let nx = (l - r) * strength, ny = (b - u) * strength, nz = 1; const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  });
}
export interface PbrSet { map: THREE.Texture; normalMap: THREE.Texture; orm: THREE.Texture; meters: [number, number] }
function pbr(w: number, h: number, meters: [number, number], color: Uint8ClampedArray, height: Float32Array, orm: Uint8ClampedArray, normalStrength: number): PbrSet {
  const toCanvas = (data: Uint8ClampedArray) => { const [c, g] = canvas(w, h); const img = g.createImageData(w, h); img.data.set(data); g.putImageData(img, 0, 0); return c; };
  return { map: texFrom(toCanvas(color), true, meters), normalMap: texFrom(normalFrom(height, w, h, normalStrength), false, meters), orm: texFrom(toCanvas(orm), false, meters), meters };
}

/* ---------- cantaria ---------- */
/** Pedra calcária em fiadas (fachada): blocos de 0,9–1,8 m em fiadas de `course` m, juntas finas, veios, manchas de chuva
 * escorrendo e sujeira nas juntas. `rustic`: canais fundos em V nas fiadas (embasamento rusticado). `plain`: sem juntas
 * (fustes das colunas, molduras, cornijas). */
export function stoneSet(q: Quality, kind: "ashlar" | "rustic" | "plain"): PbrSet {
  return memo(`stone:${q}:${kind}`, () => {
    const S = q === "high" ? 1024 : 512, M = 3.6, ppm = S / M;
    const course = kind === "rustic" ? 0.8 : 0.6, rows = Math.round(M / course), rowH = S / rows;
    const fine = fieldOf(512, 11, 6, 8), mid = fieldOf(256, 12, 5, 4), streak = fieldOf(256, 13, 4, 4);
    const r = prng(kind === "rustic" ? 41 : 42);
    // juntas verticais de cada fiada (emendam no limite da textura) e o tom de cada bloco
    const joints: number[][] = [], tones: number[][] = [];
    for (let row = 0; row < rows; row++) {
      const xs: number[] = []; let x = r() * 1.2 * ppm;
      const start = x;
      while (x < start + S - 0.8 * ppm) { xs.push(x % S); x += (0.9 + r() * 0.9) * ppm; }
      joints.push(xs); tones.push(xs.map(() => 0.9 + r() * 0.16));
    }
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    const jw = kind === "plain" ? 0 : (kind === "rustic" ? 3.2 : 1.6) * (S / 1024), hw = kind === "rustic" ? 14 * (S / 1024) : 2.2 * (S / 1024);
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / rowH), ry = y - row * rowH;
      const dyJ = Math.min(ry, rowH - ry);                                  // distância até a junta horizontal
      const xs = joints[row], ts = tones[row];
      for (let x = 0; x < S; x++) {
        let dxJ = 1e9, block = 0;
        for (let k = 0; k < xs.length; k++) { let d = Math.abs(x - xs[k]); d = Math.min(d, S - d); if (d < dxJ) dxJ = d; }
        for (let k = 0; k < xs.length; k++) if (x >= xs[k]) block = k;
        const tone = kind === "plain" ? 1 : ts[block] ?? 1;
        const n = samp(fine, 512, x * 512 / S * 2, y * 512 / S * 2), m = samp(mid, 256, x * 256 / S, y * 256 / S);
        const st = samp(streak, 256, x * 256 / S * 6, y * 256 / S * 0.35);
        // altura: face do bloco com picotado fino; chanfro até a junta; rusticado = canal em V largo na horizontal
        let hgt = 1 - n * 0.06 - (m - 0.5) * 0.04;
        if (kind !== "plain") {
          const dh = kind === "rustic" ? dyJ : Math.min(dyJ, dxJ);
          const edge = kind === "rustic" ? Math.min(smooth(0, hw, dyJ), smooth(0, 2.2 * (S / 1024) + jw, dxJ)) : smooth(jw * 0.5, jw + hw, dh);
          hgt = hgt * (0.35 + 0.65 * edge);
        }
        const i = y * S + x; height[i] = hgt;
        const inJoint = kind === "plain" ? 0 : 1 - smooth(jw * 0.4, jw + 0.8, kind === "rustic" ? Math.min(dyJ * 0.25, dxJ) : Math.min(dyJ, dxJ));
        // cor: calcário quente, veios, mancha de chuva escorrendo (mais escura embaixo da fiada), juntas sujas
        const rain = smooth(0.48, 0.8, st) * (0.5 + 0.5 * (ry / rowH));
        let v = tone * (0.86 + 0.18 * m + 0.08 * (n - 0.5)) * (1 - 0.18 * rain) * (1 - 0.35 * inJoint);
        v = Math.max(0, v);
        const o = i * 4;
        color[o] = 206 * v; color[o + 1] = 196 * v; color[o + 2] = 176 * v * (0.97 + 0.04 * m); color[o + 3] = 255;
        orm[o] = 255 * (1 - 0.55 * inJoint - (kind === "rustic" ? 0.25 * (1 - smooth(0, hw, dyJ)) : 0)); orm[o + 1] = 255 * (0.78 + 0.16 * n + 0.06 * rain); orm[o + 2] = 0; orm[o + 3] = 255;
      }
    }
    return pbr(S, S, [M, M], color, height, orm, kind === "rustic" ? 6 : 3.2);
  });
}

/** Granito cinza de meio-fio e degraus: grãos pretos e brancos, polido gasto. */
export function graniteSet(q: Quality): PbrSet {
  return memo(`granite:${q}`, () => {
    const S = q === "high" ? 512 : 256, M = 1.2;
    const g1 = fieldOf(512, 21, 3, 64), g2 = fieldOf(512, 22, 3, 96), m = fieldOf(256, 23, 4, 4);
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const a = samp(g1, 512, x * 512 / S, y * 512 / S), b = samp(g2, 512, x * 512 / S, y * 512 / S), c = samp(m, 256, x * 256 / S, y * 256 / S);
      let v = 0.52 + 0.1 * (c - 0.5); if (a > 0.68) v *= 0.35; if (b > 0.72) v = Math.min(1, v * 1.45);
      const i = y * S + x, o = i * 4;
      color[o] = 150 * v + 8; color[o + 1] = 148 * v + 8; color[o + 2] = 146 * v + 10; color[o + 3] = 255;
      height[i] = a * 0.3 + b * 0.2; orm[o] = 255; orm[o + 1] = 255 * (0.42 + 0.2 * c); orm[o + 2] = 0; orm[o + 3] = 255;
    }
    return pbr(S, S, [M, M], color, height, orm, 1.2);
  });
}

/* ---------- chão da rua ---------- */
/** Asfalto da avenida depois da chuva: agregado claro, remendos, trincas, manchas de óleo e poças rasas (quase espelho). */
export function asphaltSet(q: Quality): PbrSet {
  return memo(`asphalt:${q}`, () => {
    const S = q === "high" ? 1024 : 512, M = 10;
    const fine = fieldOf(512, 31, 3, 96), mid = fieldOf(256, 32, 5, 4), low = fieldOf(256, 33, 4, 2), stain = fieldOf(256, 34, 4, 6);
    const r = prng(35); const patches: { x0: number; y0: number; x1: number; y1: number; t: number }[] = [];
    for (let k = 0; k < 5; k++) { const x0 = r() * S, y0 = r() * S, w = (0.6 + r() * 1.8) * S / M, h = (0.5 + r() * 1.2) * S / M; patches.push({ x0, y0, x1: x0 + w, y1: y0 + h, t: 0.82 + r() * 0.3 }); }
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const f = samp(fine, 512, x * 512 / S * 2, y * 512 / S * 2), m = samp(mid, 256, x * 256 / S, y * 256 / S), l = samp(low, 256, x * 256 / S, y * 256 / S);
      const s = samp(stain, 256, x * 256 / S, y * 256 / S);
      let tone = 1; for (const p of patches) if (x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1) tone = p.t;
      const puddle = smooth(0.6, 0.66, l * 0.75 + m * 0.25);                 // poça: só onde o piso é mais baixo
      const oil = smooth(0.7, 0.8, s) * 0.4;
      const pebble = f > 0.74 ? 1 : 0;
      let v = (0.15 + 0.06 * (m - 0.5) + 0.07 * pebble) * tone * (1 - oil);
      v *= 1 - 0.35 * puddle;                                                  // molhado escurece
      const i = y * S + x, o = i * 4;
      color[o] = 255 * v; color[o + 1] = 255 * v * 1.01; color[o + 2] = 255 * v * 1.05; color[o + 3] = 255;
      height[i] = (1 - puddle) * (f * 0.6 + m * 0.2);
      orm[o] = 255 * (1 - 0.15 * (1 - f)); orm[o + 1] = 255 * (0.62 - 0.12 * m - 0.5 * puddle + 0.05 * f); orm[o + 2] = 0; orm[o + 3] = 255;
    }
    return pbr(S, S, [M, M], color, height, orm, 2.2);
  });
}

/** Calçada de placas de concreto de 1,5 m: juntas, tom por placa, manchas, chiclete, partes úmidas mais lisas. */
export function sidewalkSet(q: Quality): PbrSet {
  return memo(`sidewalk:${q}`, () => {
    const S = q === "high" ? 1024 : 512, M = 4.5, slab = S / 3;
    const fine = fieldOf(512, 41, 4, 32), mid = fieldOf(256, 42, 5, 4), damp = fieldOf(256, 43, 4, 3);
    const r = prng(44); const tones = Array.from({ length: 9 }, () => 0.9 + r() * 0.16);
    // chiclete e pingos escuros: carimbados num mapa antes (sem varrer a lista em cada pixel)
    const gum = new Float32Array(S * S), gr = 3.5 * S / 1024;
    for (let k = 0; k < (q === "high" ? 70 : 35); k++) {
      const gx = r() * S, gy = r() * S;
      for (let y = Math.floor(gy - gr); y <= gy + gr; y++) for (let x = Math.floor(gx - gr); x <= gx + gr; x++) {
        const d = Math.hypot(x - gx, y - gy); if (d >= gr) continue;
        const i = ((y + S) % S) * S + ((x + S) % S); gum[i] = Math.max(gum[i], 1 - d / gr);
      }
    }
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    const jw = 2.2 * S / 1024;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const sx = Math.floor(x / slab), sy = Math.floor(y / slab), dx = Math.min(x - sx * slab, (sx + 1) * slab - x), dy = Math.min(y - sy * slab, (sy + 1) * slab - y);
      const dj = Math.min(dx, dy), joint = 1 - smooth(jw * 0.5, jw * 2, dj);
      const f = samp(fine, 512, x * 512 / S, y * 512 / S), m = samp(mid, 256, x * 256 / S, y * 256 / S), w = smooth(0.55, 0.72, samp(damp, 256, x * 256 / S, y * 256 / S));
      const spot = gum[y * S + x];
      let v = tones[sy * 3 + sx] * (0.5 + 0.08 * (m - 0.5) + 0.05 * (f - 0.5)) * (1 - 0.45 * joint) * (1 - 0.22 * w) * (1 - 0.55 * spot);
      v = Math.max(0, v);
      const i = y * S + x, o = i * 4;
      color[o] = 255 * v * 1.02; color[o + 1] = 255 * v; color[o + 2] = 255 * v * 0.96; color[o + 3] = 255;
      height[i] = (1 - joint) * (0.8 + 0.2 * f);
      orm[o] = 255 * (1 - 0.5 * joint); orm[o + 1] = 255 * (0.82 - 0.4 * w + 0.08 * f); orm[o + 2] = 0; orm[o + 3] = 255;
    }
    return pbr(S, S, [M, M], color, height, orm, 3);
  });
}

/** Tapete da gala (bordô com estêncil de losangos e duas faixas douradas nas bordas). u atravessa a largura (0–1); v anda
 * ao longo do tapete, 1 = 2 m. */
export function carpetSet(q: Quality): PbrSet {
  return memo(`carpet:${q}`, () => {
    const W = q === "high" ? 512 : 256, H = W, weave = fieldOf(512, 51, 2, 128), mid = fieldOf(256, 52, 4, 4);
    const color = new Uint8ClampedArray(W * H * 4), orm = new Uint8ClampedArray(W * H * 4), height = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      // losangos do estêncil: 10 colunas pela largura, 4 por 2 m de comprimento
      const cu = (u * 10) % 1, cv = (v * 4) % 1, dia = Math.abs(cu - 0.5) + Math.abs(cv - 0.5);
      const motif = smooth(0.34, 0.31, dia) - smooth(0.24, 0.21, dia) * 0.6;
      const edge = Math.min(u, 1 - u);
      const gold = (edge > 0.025 && edge < 0.04) || (edge > 0.052 && edge < 0.058) ? 1 : 0;
      const w = samp(weave, 512, x * 512 / W * 4, y * 512 / H * 4), m = samp(mid, 256, x * 256 / W, y * 256 / H);
      const i = y * W + x, o = i * 4;
      const base = 0.85 + 0.15 * w + 0.1 * (m - 0.5);
      if (gold) { color[o] = 196 * base; color[o + 1] = 152 * base; color[o + 2] = 74 * base; }
      else if (edge < 0.02) { color[o] = 62 * base; color[o + 1] = 8 * base; color[o + 2] = 16 * base; }
      else { const k = 1 + 0.22 * motif; color[o] = 118 * base * k; color[o + 1] = 16 * base * k; color[o + 2] = 30 * base * k; }
      color[o + 3] = 255; height[i] = w * 0.6 + motif * 0.15;
      orm[o] = 255; orm[o + 1] = 255 * (gold ? 0.5 : 0.93); orm[o + 2] = gold ? 120 : 0; orm[o + 3] = 255;
    }
    return pbr(W, H, [1, 2], color, height, orm, 1.6);
  });
}

/** Tijolo em amarração corrida (beco e prédios vizinhos): tons de vermelho queimado, argamassa clara recuada. */
export function brickSet(q: Quality, tint: "red" | "brown" = "red"): PbrSet {
  return memo(`brick:${q}:${tint}`, () => {
    const S = q === "high" ? 512 : 256, M = 2.4, rows = 36, bw = 0.215 * S / M, rh = S / rows;
    const fine = fieldOf(512, 61, 4, 32), r = prng(tint === "red" ? 62 : 63);
    const tone = Array.from({ length: 64 * rows }, () => 0.75 + r() * 0.4);
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    const [cr, cg, cb] = tint === "red" ? [150, 62, 44] : [112, 72, 52];
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / rh), ry = y - row * rh, off = (row % 2) * bw * 0.5;
      for (let x = 0; x < S; x++) {
        const xb = (x + off) % S, col = Math.floor(xb / bw), rx = xb - col * bw;
        const mort = ry < 1.2 * S / 512 || rx < 1.4 * S / 512;
        const f = samp(fine, 512, x * 512 / S, y * 512 / S), t = tone[(row * 64 + col) % tone.length];
        const i = y * S + x, o = i * 4;
        if (mort) { const v = 0.55 + 0.1 * f; color[o] = 150 * v; color[o + 1] = 146 * v; color[o + 2] = 138 * v; height[i] = 0.2 + 0.1 * f; orm[o] = 170; orm[o + 1] = 245; }
        else { const v = t * (0.85 + 0.25 * f); color[o] = cr * v; color[o + 1] = cg * v; color[o + 2] = cb * v; height[i] = 0.85 + 0.15 * f; orm[o] = 255; orm[o + 1] = 230; }
        color[o + 3] = 255; orm[o + 2] = 0; orm[o + 3] = 255;
      }
    }
    return pbr(S, S, [M, M], color, height, orm, 4);
  });
}

/** Normal de ruído fino (ferro fundido, pintura, plástico): só quebra o reflexo liso. */
export function grainNormal(q: Quality): THREE.Texture {
  return memo(`grain:${q}`, () => { const S = q === "high" ? 256 : 128; const f = fieldOf(S, 71, 4, 16); return texFrom(normalFrom(f, S, S, 2.4), false, 0.5); });
}

/* ---------- fachadas da vizinhança ---------- */
export interface FacadeTex { map: THREE.Texture; emissive: THREE.Texture; bays: number; floors: number; bay: number; floor: number }
/** Fachada de prédio de apartamentos: 8 vãos × 8 andares por textura (2,4 m × 3,2 m cada). Janelas acesas (âmbar,
 * algumas azuladas de TV), cortinas, persianas meio baixadas, escuras com reflexo do céu. `style`: pré-guerra em calcário,
 * tijolo com vergas claras ou vidro e esquadrias escuras. */
export function facadeTex(q: Quality, style: "limestone" | "brick" | "modern", seed: number): FacadeTex {
  return memo(`facade:${q}:${style}:${seed}`, () => {
    const B = 8, F = 8, S = q === "high" ? 1024 : 512, bw = S / B, fh = S / F, r = prng(seed);
    const [c, g] = canvas(S, S); const [ce, ge] = canvas(S, S);
    const wall = style === "limestone" ? "#b9ab92" : style === "brick" ? "#7b3b2c" : "#2a2e35";
    g.fillStyle = wall; g.fillRect(0, 0, S, S);
    const noise = fieldOf(256, seed, 5, 4);
    const id = g.getImageData(0, 0, S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const k = 0.85 + 0.3 * samp(noise, 256, x * 256 / S, y * 256 / S); const o = (y * S + x) * 4; id.data[o] *= k; id.data[o + 1] *= k; id.data[o + 2] *= k; }
    g.putImageData(id, 0, 0);
    ge.fillStyle = "#000"; ge.fillRect(0, 0, S, S);
    for (let f = 0; f < F; f++) {
      // cornija de andar (calcário) / verga (tijolo)
      if (style !== "modern") { g.fillStyle = style === "limestone" ? "rgba(70,60,45,0.35)" : "rgba(210,200,180,0.55)"; g.fillRect(0, f * fh + fh * 0.06, S, fh * 0.03); }
      for (let b = 0; b < B; b++) {
        const x0 = b * bw + bw * (style === "modern" ? 0.08 : 0.24), w = bw * (style === "modern" ? 0.84 : 0.52), y0 = f * fh + fh * 0.2, h = fh * (style === "modern" ? 0.72 : 0.62);
        const lit = r() < 0.38, tv = lit && r() < 0.18, blinds = r();
        if (style === "brick") { g.fillStyle = "#cfc4ae"; g.fillRect(x0 - 3, y0 - fh * 0.06, w + 6, fh * 0.06); g.fillRect(x0 - 2, y0 + h, w + 4, fh * 0.035); }
        if (style === "limestone") { g.fillStyle = "rgba(60,52,40,0.55)"; g.fillRect(x0 - 4, y0 - 4, w + 8, h + 8); }
        // vidro escuro com o céu refletido
        const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, "#1d2533"); gr.addColorStop(1, "#0b0e14");
        g.fillStyle = gr; g.fillRect(x0, y0, w, h);
        if (lit) {
          const warm = tv ? [120, 150, 255] : [255, 196 - r() * 40, 120 - r() * 50];
          const eg = ge.createRadialGradient(x0 + w / 2, y0 + h * 0.65, 2, x0 + w / 2, y0 + h * 0.5, h * 0.8);
          eg.addColorStop(0, `rgb(${warm[0]},${warm[1]},${warm[2]})`); eg.addColorStop(1, `rgb(${warm[0] * 0.45},${warm[1] * 0.42},${warm[2] * 0.38})`);
          ge.fillStyle = eg; ge.fillRect(x0, y0, w, h);
          g.fillStyle = `rgb(${warm[0] * 0.8},${warm[1] * 0.7},${warm[2] * 0.6})`; g.fillRect(x0, y0, w, h);
          // cortina e persiana (sombras na luz)
          if (blinds < 0.5) { ge.fillStyle = "rgba(0,0,0,0.55)"; ge.fillRect(x0, y0, w * (0.2 + r() * 0.2), h); ge.fillRect(x0 + w * (0.75 + r() * 0.1), y0, w, h); }
          if (blinds > 0.7) { ge.fillStyle = "rgba(0,0,0,0.75)"; ge.fillRect(x0, y0, w, h * (0.25 + r() * 0.4)); }
        }
        // caixilho
        g.strokeStyle = style === "modern" ? "#11151b" : "#2c2620"; g.lineWidth = Math.max(1, S / 512);
        g.strokeRect(x0, y0, w, h); g.beginPath(); g.moveTo(x0 + w / 2, y0); g.lineTo(x0 + w / 2, y0 + h); g.moveTo(x0, y0 + h * 0.5); g.lineTo(x0 + w, y0 + h * 0.5); g.stroke();
        ge.strokeStyle = "#000"; ge.lineWidth = Math.max(1, S / 512); ge.strokeRect(x0, y0, w, h); ge.beginPath(); ge.moveTo(x0 + w / 2, y0); ge.lineTo(x0 + w / 2, y0 + h); ge.stroke();
      }
    }
    const map = texFrom(c, true), emissive = texFrom(ce, true);
    return { map, emissive, bays: B, floors: F, bay: 2.4, floor: 3.2 };
  });
}

/* ---------- vegetação ---------- */
/** Cachos de folhas com fundo transparente (cartões da copa das árvores e cercas vivas). */
export function leafTex(q: Quality, hue: "green" | "dark" = "green"): THREE.Texture {
  return memo(`leaf:${q}:${hue}`, () => {
    const S = q === "high" ? 256 : 128, [c, g] = canvas(S, S), r = prng(hue === "green" ? 81 : 82);
    g.clearRect(0, 0, S, S);
    for (let k = 0; k < 46; k++) {
      const x = S * (0.12 + r() * 0.76), y = S * (0.12 + r() * 0.76), a = r() * Math.PI * 2, l = S * (0.07 + r() * 0.06), w = l * 0.55;
      const base = hue === "green" ? [52 + r() * 40, 82 + r() * 50, 30 + r() * 25] : [26 + r() * 20, 46 + r() * 26, 24 + r() * 14];
      g.save(); g.translate(x, y); g.rotate(a);
      const gr = g.createLinearGradient(-w, 0, w, 0); gr.addColorStop(0, `rgb(${base[0] * 0.7},${base[1] * 0.7},${base[2] * 0.7})`); gr.addColorStop(1, `rgb(${base[0] * 1.2},${base[1] * 1.15},${base[2]})`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, -l); g.quadraticCurveTo(w, -l * 0.2, 0, l); g.quadraticCurveTo(-w, -l * 0.2, 0, -l); g.fill();
      g.strokeStyle = `rgba(20,30,10,0.45)`; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -l); g.lineTo(0, l); g.stroke();
      g.restore();
    }
    const t = texFrom(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

/* ---------- luz ---------- */
/** Mancha de luz radial (poças de luz dos postes, halo de lâmpadas, flash). */
/** Cabeça de flor para cartões cruzados (arranjos da escadaria): quatro camadas de pétalas, do contorno solto ao miolo
 * fechado, com a base de cada pétala na sombra e a borda clara; em cinza, para a cor de cada instância tingir. Alfa recortado. */
export function bloomTex(q: Quality): THREE.Texture {
  return memo(`bloom:${q}`, () => {
    const S = q === "high" ? 256 : 128, [c, g] = canvas(S, S), r = prng(61), cx = S / 2;
    for (let layer = 0; layer < 4; layer++) {
      const n = 9 - layer, R = S * (0.47 - layer * 0.095), w = R * (0.6 - layer * 0.04), base = 160 + layer * 24;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + layer * 0.7 + (r() - 0.5) * 0.45, len = R * (0.88 + r() * 0.12);
        g.save(); g.translate(cx, cx); g.rotate(a);
        const grd = g.createLinearGradient(0, 0, len, 0), lo = Math.round(base * 0.5), mid = base, hi = Math.min(255, base + 45);
        grd.addColorStop(0, `rgb(${lo},${lo},${lo})`); grd.addColorStop(0.55, `rgb(${mid},${mid},${mid})`); grd.addColorStop(1, `rgb(${hi},${hi},${hi})`);
        g.fillStyle = grd;
        g.beginPath(); g.moveTo(0, 0);
        g.bezierCurveTo(len * 0.3, -w, len * 0.92, -w * 0.85, len, (r() - 0.5) * w * 0.2);
        g.bezierCurveTo(len * 0.92, w * 0.85, len * 0.3, w, 0, 0);
        g.fill();
        g.strokeStyle = "rgba(40,40,40,0.22)"; g.lineWidth = Math.max(1, S / 170); g.stroke();
        g.restore();
      }
    }
    const core = g.createRadialGradient(cx, cx, 0, cx, cx, S * 0.09);
    core.addColorStop(0, "rgb(96,90,84)"); core.addColorStop(1, "rgba(150,144,138,0)");
    g.fillStyle = core; g.beginPath(); g.arc(cx, cx, S * 0.09, 0, Math.PI * 2); g.fill();
    const t = texFrom(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
    return t;
  });
}

export function glowTex(kind: "soft" | "star" = "soft"): THREE.Texture {
  return memo(`glow:${kind}`, () => {
    const S = 128, [c, g] = canvas(S, S);
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(kind === "star" ? 0.12 : 0.25, "rgba(255,255,255,0.55)"); gr.addColorStop(0.6, "rgba(255,255,255,0.12)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    if (kind === "star") {
      g.globalCompositeOperation = "lighter";
      for (const a of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
        g.save(); g.translate(S / 2, S / 2); g.rotate(a);
        const lg = g.createLinearGradient(-S / 2, 0, S / 2, 0); lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, a % (Math.PI / 2) === 0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.35)"); lg.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = lg; g.fillRect(-S / 2, -1.2, S, 2.4); g.restore();
      }
    }
    const t = texFrom(c, false); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

/* ---------- letreiros, banners e cartazes (texto diegético: nomes ficcionais do mundo do jogo) ---------- */
/** Textos que aparecem pintados no cenário. Ficam juntos aqui para, se um dia forem traduzidos, passarem todos por t(). */
export const SIGNAGE = {
  gala: "GALA LUMIÈRE", year: "2026", date: "04 · 12 · 2026", museum: "MUSEU VESPER", institute: "INSTITUTO DO TRAJE",
  aurora: "AURORA", auroraHouse: "CASA ORVALHO · 1957", exhibit: "EXPOSIÇÃO", restricted: "ÁREA RESTRITA · CREDENCIADOS",
  caterer: "BUFÊ LUMIÈRE", catererSub: "ALTA GASTRONOMIA PARA EVENTOS", police: "POLÍCIA", dock: "DOCA · ENTREGAS", staffOnly: "SOMENTE FUNCIONÁRIOS",
  exit: "SAÍDA DE EMERGÊNCIA", vendor: "ACHADOS DE GRIFE", vendorSub: "COMPRO · TROCO · VENDO", vendorTag: "SEM PERGUNTAS",
  avenue: "AV. VESPER", street: "R. ORVALHO", closed: "VIA INTERDITADA", fans: ["ÍCONE ✦", "OLHA PRA CÁ!", "LENDA", "TE AMO ♥", "MUSA", "BRILHA!"],
  invite: "ACESSO SOMENTE COM CONVITE", reception: "RECEPÇÃO", press: "IMPRENSA CREDENCIADA", service: "ENTRADA DE SERVIÇO", serviceArrow: "◀", noParking: "PROIBIDO ESTACIONAR",
  queue: "FILA DE CONVIDADOS", alley: "BECO · ACESSO RESTRITO",
} as const;

export const SERIF = "'Didot', 'Bodoni 72', 'Playfair Display', 'Libre Bodoni', Georgia, 'DejaVu Serif', serif";
export const SANS = "'Helvetica Neue', Inter, Arial, 'Liberation Sans', sans-serif";
export function spaced(g: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  const chars = [...text]; const widths = chars.map((ch) => g.measureText(ch).width); const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = x - total / 2; const align = g.textAlign; g.textAlign = "left";
  chars.forEach((ch, k) => { g.fillText(ch, cx, y); cx += widths[k] + spacing; }); g.textAlign = align;
}
export function fitFont(g: CanvasRenderingContext2D, text: string, family: string, weight: string, max: number, width: number, spacing = 0) {
  let size = max; g.font = `${weight} ${size}px ${family}`;
  while (size > 8 && g.measureText(text).width + spacing * text.length > width) { size -= 2; g.font = `${weight} ${size}px ${family}`; }
  return size;
}
/** Tecido do banner: trama fina e sombra das dobras (o banner pendurado ondula pouco). */
function fabric(g: CanvasRenderingContext2D, w: number, h: number) {
  const f = fieldOf(256, 91, 3, 8); const id = g.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fold = 0.93 + 0.07 * Math.sin((x / w) * Math.PI * 7 + samp(f, 256, x * 0.2, y * 0.05) * 2), weave = 0.97 + 0.03 * samp(f, 256, x * 2.5, y * 2.5);
    const o = (y * w + x) * 4; const k = fold * weave; id.data[o] *= k; id.data[o + 1] *= k; id.data[o + 2] *= k;
  }
  g.putImageData(id, 0, 0);
}
/** Silhueta estilizada de um vestido de gala (o Aurora) em dourado-marfim, para o banner da exposição. */
function gownArt(g: CanvasRenderingContext2D, cx: number, top: number, h: number) {
  const w = h * 0.62;
  const rays = g.createRadialGradient(cx, top + h * 0.35, 0, cx, top + h * 0.35, h * 0.8);
  rays.addColorStop(0, "rgba(255,226,170,0.38)"); rays.addColorStop(1, "rgba(255,226,170,0)");
  g.fillStyle = rays; g.fillRect(cx - h, top - h * 0.2, h * 2, h * 1.4);
  const gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  gr.addColorStop(0, "#9c7a3e"); gr.addColorStop(0.35, "#f4dfae"); gr.addColorStop(0.55, "#fff4d8"); gr.addColorStop(1, "#8a6a35");
  g.fillStyle = gr; g.beginPath();
  const waist = top + h * 0.3, neck = top + h * 0.04;
  g.moveTo(cx - w * 0.07, neck); g.quadraticCurveTo(cx - w * 0.16, top + h * 0.1, cx - w * 0.1, waist);   // corpete
  g.bezierCurveTo(cx - w * 0.22, top + h * 0.55, cx - w * 0.62, top + h * 0.85, cx - w * 0.5, top + h);  // saia rodada
  g.quadraticCurveTo(cx, top + h * 1.04, cx + w * 0.5, top + h);
  g.bezierCurveTo(cx + w * 0.62, top + h * 0.85, cx + w * 0.22, top + h * 0.55, cx + w * 0.1, waist);
  g.quadraticCurveTo(cx + w * 0.16, top + h * 0.1, cx + w * 0.07, neck); g.closePath(); g.fill();
  // pregas da saia
  g.strokeStyle = "rgba(120,90,40,0.5)"; g.lineWidth = Math.max(1, h / 300);
  for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(cx + k * w * 0.012, waist + h * 0.02); g.quadraticCurveTo(cx + k * w * 0.05, top + h * 0.7, cx + k * w * 0.1, top + h * 0.99); g.stroke(); }
  g.fillStyle = "rgba(255,250,235,0.9)"; g.fillRect(cx - w * 0.11, waist - h * 0.008, w * 0.22, h * 0.016);           // cinto
}
export type BannerKind = "aurora" | "lumiere" | "institute" | "marquee";
/** Banners da fachada. aurora/lumiere/institute: verticais (1:2); marquee: faixa horizontal sobre o arco central. */
export function bannerTex(q: Quality, kind: BannerKind): THREE.Texture {
  return memo(`banner:${q}:${kind}`, () => {
    const hi = q === "high"; const W = kind === "marquee" ? (hi ? 1536 : 768) : hi ? 768 : 384, H = kind === "marquee" ? (hi ? 384 : 192) : hi ? 1536 : 768;
    const [c, g] = canvas(W, H); g.textAlign = "center"; g.textBaseline = "alphabetic";
    if (kind === "aurora") {
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#0f2c35"); bg.addColorStop(0.6, "#0a1c24"); bg.addColorStop(1, "#05100f"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      gownArt(g, W / 2, H * 0.2, H * 0.52);
      g.fillStyle = "#f3e2b8"; let s = fitFont(g, SIGNAGE.aurora, SERIF, "400", W * 0.24, W * 0.86, W * 0.03); spaced(g, SIGNAGE.aurora, W / 2, H * 0.84, W * 0.03);
      g.fillStyle = "#cdb98c"; s = fitFont(g, SIGNAGE.auroraHouse, SANS, "500", W * 0.055, W * 0.8, 4); spaced(g, SIGNAGE.auroraHouse, W / 2, H * 0.84 + s * 1.9, W * 0.012);
      g.fillStyle = "#e9dcc0"; fitFont(g, SIGNAGE.exhibit, SANS, "600", W * 0.05, W * 0.6); spaced(g, SIGNAGE.exhibit, W / 2, H * 0.12, W * 0.02);
      g.fillStyle = "#9fb0aa"; fitFont(g, SIGNAGE.museum, SANS, "600", W * 0.045, W * 0.7); spaced(g, SIGNAGE.museum, W / 2, H * 0.965, W * 0.02);
    } else if (kind === "lumiere") {
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#5a0d1b"); bg.addColorStop(0.5, "#3c0711"); bg.addColorStop(1, "#1d0308"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.save(); g.translate(W / 2, H * 0.38); g.globalAlpha = 0.5;
      for (let k = 0; k < 48; k++) { g.rotate((Math.PI * 2) / 48); const lg = g.createLinearGradient(0, 0, 0, -H * 0.5); lg.addColorStop(0, "rgba(255,214,140,0.7)"); lg.addColorStop(1, "rgba(255,214,140,0)"); g.fillStyle = lg; g.fillRect(-W * 0.004, 0, W * 0.008, -H * (0.32 + 0.14 * (k % 3))); }
      g.restore(); g.globalAlpha = 1;
      g.fillStyle = "#f7e2b0"; g.beginPath(); g.arc(W / 2, H * 0.38, W * 0.08, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#f3dca6"; fitFont(g, SIGNAGE.gala.split(" ")[0], SANS, "600", W * 0.07, W * 0.6); spaced(g, SIGNAGE.gala.split(" ")[0], W / 2, H * 0.62, W * 0.04);
      fitFont(g, SIGNAGE.gala.split(" ")[1], SERIF, "400", W * 0.22, W * 0.9, W * 0.01); spaced(g, SIGNAGE.gala.split(" ")[1], W / 2, H * 0.74, W * 0.01);
      g.fillStyle = "#d9b779"; fitFont(g, SIGNAGE.date, SANS, "500", W * 0.06, W * 0.8); spaced(g, SIGNAGE.date, W / 2, H * 0.83, W * 0.015);
      g.fillStyle = "#b99b6b"; fitFont(g, SIGNAGE.museum, SANS, "600", W * 0.045, W * 0.7); spaced(g, SIGNAGE.museum, W / 2, H * 0.965, W * 0.02);
    } else if (kind === "institute") {
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#efe7d6"); bg.addColorStop(1, "#d8cdb6"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = "#1b1b1b"; g.lineWidth = W * 0.006; g.strokeRect(W * 0.07, H * 0.04, W * 0.86, H * 0.92);
      // vestido em traço (croqui) e o nome da exposição
      g.save(); g.globalAlpha = 0.9; gownArt(g, W / 2, H * 0.2, H * 0.46); g.restore();
      g.fillStyle = "#151515"; fitFont(g, SIGNAGE.institute, SERIF, "400", W * 0.11, W * 0.8); spaced(g, SIGNAGE.institute, W / 2, H * 0.79, W * 0.005);
      g.fillStyle = "#6b5a3a"; fitFont(g, SIGNAGE.aurora, SANS, "600", W * 0.06, W * 0.6); spaced(g, SIGNAGE.aurora, W / 2, H * 0.86, W * 0.03);
      g.fillStyle = "#151515"; fitFont(g, SIGNAGE.museum, SANS, "600", W * 0.045, W * 0.7); spaced(g, SIGNAGE.museum, W / 2, H * 0.93, W * 0.02);
    } else {
      const bg = g.createLinearGradient(0, 0, W, 0); bg.addColorStop(0, "#120a06"); bg.addColorStop(0.5, "#22140a"); bg.addColorStop(1, "#120a06"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = "#c9a24a"; g.lineWidth = H * 0.025; g.strokeRect(H * 0.08, H * 0.1, W - H * 0.16, H * 0.8);
      g.fillStyle = "#f2d38f"; fitFont(g, SIGNAGE.gala, SERIF, "400", H * 0.42, W * 0.7, H * 0.04); spaced(g, SIGNAGE.gala, W / 2, H * 0.58, H * 0.04);
      g.fillStyle = "#c9a24a"; fitFont(g, SIGNAGE.date, SANS, "600", H * 0.13, W * 0.4); spaced(g, SIGNAGE.date, W / 2, H * 0.8, H * 0.02);
    }
    fabric(g, W, H);
    const t = texFrom(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

/** Placa de bronze fundido: fundo escuro com pátina, borda em relevo, quatro rosetas e as letras romanas claras. */
export function plaqueTex(q: Quality, key: string, lines: readonly string[]): THREE.Texture {
  return memo(`plaque:${q}:${key}`, () => {
    const W = q === "high" ? 768 : 384, H = Math.round(W * 0.62), [c, g] = canvas(W, H);
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#3a2a18"); bg.addColorStop(0.5, "#5a4024"); bg.addColorStop(1, "#2e2214"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(70,110,90,${0.04 + Math.random() * 0.05})`; g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 4 + Math.random() * 30, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = "#b38a4a"; g.lineWidth = H * 0.035; g.strokeRect(H * 0.05, H * 0.05, W - H * 0.1, H - H * 0.1);
    g.strokeStyle = "#1c140c"; g.lineWidth = H * 0.012; g.strokeRect(H * 0.09, H * 0.09, W - H * 0.18, H - H * 0.18);
    for (const [x, y] of [[H * 0.13, H * 0.13], [W - H * 0.13, H * 0.13], [H * 0.13, H - H * 0.13], [W - H * 0.13, H - H * 0.13]]) { const rg = g.createRadialGradient(x - 2, y - 2, 1, x, y, H * 0.035); rg.addColorStop(0, "#f0d39a"); rg.addColorStop(1, "#6a4a24"); g.fillStyle = rg; g.beginPath(); g.arc(x, y, H * 0.035, 0, Math.PI * 2); g.fill(); }
    g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach((l, k) => {
      const big = k === 0, size = fitFont(g, l, "'Trajan Pro', 'Cinzel', Georgia, 'DejaVu Serif', serif", "600", big ? H * 0.2 : H * 0.085, W * 0.78, H * 0.02);
      const y = H * (lines.length === 1 ? 0.5 : big ? 0.38 : 0.58 + (k - 1) * 0.13);
      g.font = `600 ${size}px 'Trajan Pro', 'Cinzel', Georgia, 'DejaVu Serif', serif`;
      g.fillStyle = "#1a120a"; spaced(g, l, W / 2 + 2, y + 2, H * 0.02);
      g.fillStyle = "#e3c27f"; spaced(g, l, W / 2, y, H * 0.02);
    });
    const t = texFrom(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

/** Inscrição gravada no friso (letras romanas cavadas na pedra, iluminadas de baixo). */
export function inscriptionTex(q: Quality, text: string): THREE.Texture {
  return memo(`inscr:${q}:${text}`, () => {
    const W = q === "high" ? 2048 : 1024, H = W / 16, [c, g] = canvas(W, H);
    g.clearRect(0, 0, W, H); g.textAlign = "center"; g.textBaseline = "middle";
    const size = fitFont(g, text, "'Trajan Pro', 'Cinzel', Georgia, 'DejaVu Serif', serif", "500", H * 0.7, W * 0.9, H * 0.25);
    g.font = `500 ${size}px 'Trajan Pro', 'Cinzel', Georgia, 'DejaVu Serif', serif`;
    g.fillStyle = "rgba(40,30,20,0.85)"; spaced(g, text, W / 2, H * 0.52, H * 0.25);          // fundo da letra (sombra)
    g.fillStyle = "rgba(255,240,210,0.35)"; spaced(g, text, W / 2, H * 0.52 + size * 0.06, H * 0.25);   // borda de baixo pega a luz
    const t = texFrom(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

/** Placas e letreiros pequenos (texto centralizado em uma ou duas linhas, cores de fundo/tinta). */
export function signTex(key: string, lines: readonly string[], opt: { w: number; h: number; bg: string; ink: string; font?: "serif" | "sans" | "hand"; border?: string; glow?: boolean }): THREE.Texture {
  return memo(`sign:${key}`, () => {
    const [c, g] = canvas(opt.w, opt.h); g.fillStyle = opt.bg; g.fillRect(0, 0, opt.w, opt.h);
    if (opt.border) { g.strokeStyle = opt.border; g.lineWidth = opt.h * 0.05; g.strokeRect(opt.h * 0.06, opt.h * 0.06, opt.w - opt.h * 0.12, opt.h - opt.h * 0.12); }
    const fam = opt.font === "serif" ? SERIF : opt.font === "hand" ? "'Marker Felt', 'Comic Sans MS', 'Chalkboard', 'DejaVu Sans', sans-serif" : SANS;
    g.fillStyle = opt.ink; g.textAlign = "center"; g.textBaseline = "middle";
    const n = lines.length;
    lines.forEach((line, k) => { const size = fitFont(g, line, fam, opt.font === "hand" ? "700" : "700", opt.h / (n + 0.6) * (k === 0 ? 1 : 0.72), opt.w * 0.88, opt.h * 0.02); g.font = `700 ${size}px ${fam}`; spaced(g, line, opt.w / 2, opt.h * ((k + 0.5) / n) + size * 0.33, opt.h * 0.02); });
    const t = texFrom(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

/** Lateral do caminhão do bufê: branco com o logotipo dourado e preto. */
export function cateringTex(q: Quality): THREE.Texture {
  return memo(`catering:${q}`, () => {
    const W = q === "high" ? 1024 : 512, H = W * 0.37, [c, g] = canvas(W, H);
    g.fillStyle = "#f1efe9"; g.fillRect(0, 0, W, H);
    const band = g.createLinearGradient(0, 0, W, 0); band.addColorStop(0, "#1a1a1a"); band.addColorStop(1, "#2a2420"); g.fillStyle = band; g.fillRect(0, H * 0.78, W, H * 0.22);
    g.fillStyle = "#b8913f"; g.fillRect(0, H * 0.76, W, H * 0.02);
    // cloche estilizada
    g.fillStyle = "#b8913f"; g.beginPath(); g.arc(W * 0.16, H * 0.5, H * 0.17, Math.PI, 0); g.fill(); g.fillRect(W * 0.16 - H * 0.21, H * 0.5, H * 0.42, H * 0.03); g.beginPath(); g.arc(W * 0.16, H * 0.31, H * 0.025, 0, Math.PI * 2); g.fill();
    g.textAlign = "center"; g.fillStyle = "#151515"; fitFont(g, SIGNAGE.caterer, SERIF, "400", H * 0.26, W * 0.55, H * 0.02); spaced(g, SIGNAGE.caterer, W * 0.58, H * 0.5, H * 0.02);
    g.fillStyle = "#8a6c2f"; fitFont(g, SIGNAGE.catererSub, SANS, "600", H * 0.07, W * 0.55); spaced(g, SIGNAGE.catererSub, W * 0.58, H * 0.64, H * 0.012);
    const t = texFrom(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

/** Cartazes feitos à mão dos fãs (papel-cartão, caneta grossa). */
export function fanSignTex(k: number): THREE.Texture {
  const text = SIGNAGE.fans[k % SIGNAGE.fans.length];
  const bgs = ["#f7f1e3", "#ffd6e7", "#fff3a8", "#d8f0ff", "#f7f1e3", "#e9ffd8"], inks = ["#c2185b", "#1a237e", "#111111", "#6a1b9a", "#b71c1c", "#0d47a1"];
  return signTex(`fan:${k}`, [text], { w: 256, h: 160, bg: bgs[k % bgs.length], ink: inks[k % inks.length], font: "hand" });
}
