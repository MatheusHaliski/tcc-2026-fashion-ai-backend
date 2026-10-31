/*
 * MET Gala Heist v2 — beco (Z15): texturas procedurais próprias da área, desenhadas no navegador (nenhuma imagem baixada)
 * e guardadas com a chave "beco-…" (não se misturam com as da rua, que são de outro módulo):
 *
 *  - asfalto velho do beco: oxidado (cinza claro), agregado aparente, rede de trincas finas, couro de jacaré num trecho,
 *    trincas seladas com piche (riscos pretos e brilhantes) e manchas de óleo — ladrilho de 4 m;
 *  - remendo de asfalto novo (mais escuro e liso, borda serrada) e o concreto gasto da canaleta central;
 *  - tijolo aparente velho do prédio vizinho: tijolos queimados de tons diferentes, juntas gastas e fundas, tijolos
 *    trocados, fuligem — ladrilho de 2,4 m;
 *  - folha de decalques das paredes: pichações e grafites de nomes inventados, reboco descascado, lambe-lambes de eventos
 *    fictícios, escorridos de ferrugem e de água, fuligem do exaustor, a pintura "PROIBIDO JOGAR LIXO" e o número da casa;
 *  - folha de decalques do chão: panfletos, folhas, papelão, jornal, manchas de óleo, marca de pneu, chiclete, e a faixa
 *    de sujeira do pé da parede (areia, lodo, folhas);
 *  - poças (forma recortada com borda molhada e película de óleo furta-cor), grade de ferro, mato das frestas, bituca,
 *    tampa de bueiro, interiores das janelas acesas e as placas.
 *
 * Mapas em escala de mundo: `meters` é o tamanho que a textura cobre (a geometria usa UV em metros, repeat = 1/meters).
 * Cor em sRGB; normal e ORM (R oclusão, G rugosidade, B metal) lineares. Tudo gerado uma vez por qualidade.
 */
import * as THREE from "three";

export type Quality = "high" | "low";

const cache = new Map<string, unknown>();
function memo<T>(key: string, make: () => T): T { const k = `beco-${key}`; if (!cache.has(k)) cache.set(k, make()); return cache.get(k) as T; }

/** Sorteio com semente (mulberry32): o beco é sempre o mesmo. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- ruído periódico (emenda sem costura) ---------- */
/** Campo fbm periódico n×n em 0–1 (oitavas de ruído de valor numa rede que repete a cada `base·2^o`). */
function field(n: number, seed: number, octaves = 5, base = 4): Float32Array {
  const out = new Float32Array(n * n), r = rng(seed);
  let amp = 0.5, total = 0;
  for (let o = 0; o < octaves; o++) {
    const per = base << o, lat = new Float32Array(per * per);
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    const k = per / n;
    for (let y = 0; y < n; y++) {
      const fy = y * k, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty), y0 = (iy % per) * per, y1 = ((iy + 1) % per) * per;
      for (let x = 0; x < n; x++) {
        const fx = x * k, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx), x0 = ix % per, x1 = (ix + 1) % per;
        const a = lat[y0 + x0], b = lat[y0 + x1], c = lat[y1 + x0], d = lat[y1 + x1];
        out[y * n + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
const fieldOf = (n: number, seed: number, octaves = 5, base = 4) => memo(`f${n}:${seed}:${octaves}:${base}`, () => field(n, seed, octaves, base));
/** Amostra com repetição (bilinear) num campo de lado n, em coordenadas de pixel do campo. */
function samp(f: Float32Array, n: number, x: number, y: number): number {
  x = ((x % n) + n) % n; y = ((y % n) + n) % n;
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy, ix1 = (ix + 1) % n, iy1 = (iy + 1) % n;
  const a = f[iy * n + ix], b = f[iy * n + ix1], c = f[iy1 * n + ix], d = f[iy1 * n + ix1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
/** Hash inteiro → 0–1 (posições de células, tons de tijolo). */
function hash(i: number, j: number, seed: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/* ---------- canvas → textura ---------- */
function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return [c, c.getContext("2d", { willReadFrequently: true })!];
}
function texFrom(c: HTMLCanvasElement, srgb: boolean, meters?: number | [number, number], clamp = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.anisotropy = 8;
  if (meters !== undefined) { const [mx, my] = typeof meters === "number" ? [meters, meters] : meters; t.repeat.set(1 / mx, 1 / my); }
  t.needsUpdate = true;
  return t;
}
/** Normal (espaço tangente) pelo gradiente de um campo de altura periódico w×h. */
function normalCanvas(hf: Float32Array, w: number, h: number, strength: number, wrap = true): HTMLCanvasElement {
  const [c, g] = canvas(w, h); const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xl = wrap ? (x - 1 + w) % w : Math.max(0, x - 1), xr = wrap ? (x + 1) % w : Math.min(w - 1, x + 1);
    const yu = wrap ? (y - 1 + h) % h : Math.max(0, y - 1), yd = wrap ? (y + 1) % h : Math.min(h - 1, y + 1);
    let nx = (hf[y * w + xl] - hf[y * w + xr]) * strength, ny = (hf[yd * w + x] - hf[yu * w + x]) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * w + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return c;
}
function dataCanvas(data: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h); const img = g.createImageData(w, h); img.data.set(data); g.putImageData(img, 0, 0); return c;
}
export interface PbrSet { map: THREE.Texture; normalMap: THREE.Texture; orm: THREE.Texture; meters: [number, number] }
function pbr(w: number, h: number, meters: [number, number], color: Uint8ClampedArray, height: Float32Array, orm: Uint8ClampedArray, normalStrength: number): PbrSet {
  return { map: texFrom(dataCanvas(color, w, h), true, meters), normalMap: texFrom(normalCanvas(height, w, h, normalStrength), false, meters), orm: texFrom(dataCanvas(orm, w, h), false, meters), meters };
}
/** Lê um canvas desenhado (máscara em branco sobre preto) como 0–1 por pixel (canal vermelho). */
function maskOf(c: HTMLCanvasElement): Float32Array {
  const g = c.getContext("2d")!, d = g.getImageData(0, 0, c.width, c.height).data, out = new Float32Array(c.width * c.height);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
  return out;
}
/** Traço que dá a volta na borda (a textura emenda): desenha o caminho nas 9 posições vizinhas. */
function wrapStroke(g: CanvasRenderingContext2D, S: number, pts: [number, number][]) {
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
    g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x + ox, y + oy) : g.moveTo(x + ox, y + oy))); g.stroke();
  }
}
/** Trinca: passeio aleatório com desvios curtos (e galhos), em pixels. */
function crackPath(r: () => number, x: number, y: number, len: number, step: number, dir: number): [number, number][] {
  const pts: [number, number][] = [[x, y]];
  for (let k = 0; k < len; k++) { dir += (r() - 0.5) * 0.9; x += Math.cos(dir) * step * (0.6 + r() * 0.8); y += Math.sin(dir) * step * (0.6 + r() * 0.8); pts.push([x, y]); }
  return pts;
}

/* ======================= chão ======================= */
/** Asfalto velho do beco (4 m): oxidado e claro, agregado aparente, trincas finas com galhos, um trecho de couro de
 * jacaré, trincas seladas com piche (pretas, brilhantes, um pouco salientes), manchas de óleo e de umidade. */
export function alleyAsphalt(q: Quality): PbrSet {
  return memo(`asphalt:${q}`, () => {
    const S = q === "high" ? 1024 : 512, M = 4, k = S / 1024;
    const fine = fieldOf(512, 301, 3, 96), mid = fieldOf(256, 302, 5, 4), low = fieldOf(128, 303, 4, 2), stain = fieldOf(256, 304, 4, 6), wet = fieldOf(256, 305, 4, 3);
    const r = rng(306);
    // trincas abertas (finas) e trincas seladas com piche (largas, pretas): desenhadas como máscaras
    const [cc, cg] = canvas(S, S), [sc, sg] = canvas(S, S);
    cg.fillStyle = "#000"; cg.fillRect(0, 0, S, S); sg.fillStyle = "#000"; sg.fillRect(0, 0, S, S);
    cg.strokeStyle = "#fff"; cg.lineCap = "round"; cg.lineJoin = "round";
    for (let n = 0; n < 9; n++) {
      const main = crackPath(r, r() * S, r() * S, 40 + Math.floor(r() * 50), 9 * k, r() * Math.PI * 2);
      cg.lineWidth = (1.3 + r() * 1.4) * k; wrapStroke(cg, S, main);
      for (let b = 0; b < 3; b++) { const p = main[Math.floor(r() * main.length)]; cg.lineWidth = (0.8 + r()) * k; wrapStroke(cg, S, crackPath(r, p[0], p[1], 8 + Math.floor(r() * 14), 7 * k, r() * Math.PI * 2)); }
    }
    sg.strokeStyle = "#fff"; sg.lineCap = "round"; sg.lineJoin = "round";
    for (let n = 0; n < 4; n++) {
      const p = crackPath(r, r() * S, r() * S, 30 + Math.floor(r() * 40), 10 * k, r() * Math.PI * 2);
      sg.lineWidth = (7 + r() * 6) * k; wrapStroke(sg, S, p);
    }
    const crack = maskOf(cc), seal = maskOf(sc);
    // couro de jacaré: rede de Voronoi (células de ~22 cm) num trecho do ladrilho
    const cells = 18, gator = (u: number, v: number) => {
      const x = u * cells, y = v * cells, xi = Math.floor(x), yi = Math.floor(y); let d1 = 9, d2 = 9;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ci = ((xi + dx) % cells + cells) % cells, cj = ((yi + dy) % cells + cells) % cells;
        const px = xi + dx + hash(ci, cj, 7), py = yi + dy + hash(ci, cj, 11), d = Math.hypot(x - px, y - py);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      return 1 - smooth(0.02, 0.07, d2 - d1);
    };
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, u = x / S, v = y / S;
      const f = samp(fine, 512, u * 1024, v * 1024), m = samp(mid, 256, u * 256, v * 256), l = samp(low, 128, u * 128, v * 128);
      const st = samp(stain, 256, u * 256, v * 256), w = samp(wet, 256, u * 256, v * 256);
      const zone = smooth(0.66, 0.72, l);                                            // trecho com couro de jacaré
      const g = zone > 0.01 ? gator(u, v) * zone : 0;
      const cr = Math.max(crack[i], g * 0.9), sl = seal[i];
      const pebble = f > 0.72 ? 1 : f < 0.2 ? -1 : 0;                               // agregado claro / escuro
      const oil = smooth(0.68, 0.82, st) * 0.55, damp = smooth(0.55, 0.75, w);
      let tone = 0.3 + 0.07 * (m - 0.5) + 0.05 * (l - 0.5) + (pebble > 0 ? 0.11 : pebble < 0 ? -0.06 : 0);
      tone *= (1 - oil) * (1 - 0.28 * damp) * (1 - 0.78 * cr);
      let rr = tone * 1.0, gg = tone * 0.99, bb = tone * 0.96;
      if (sl > 0.05) { const s = 0.06 + 0.02 * f; rr = rr * (1 - sl) + s * sl; gg = gg * (1 - sl) + s * sl; bb = bb * (1 - sl) + s * 1.05 * sl; }
      const o = i * 4;
      color[o] = clamp01(rr) * 255; color[o + 1] = clamp01(gg) * 255; color[o + 2] = clamp01(bb) * 255; color[o + 3] = 255;
      height[i] = (0.55 + 0.25 * f + 0.1 * m) * (1 - 0.85 * cr) + 0.12 * sl;
      const rough = 0.86 - 0.08 * m - 0.32 * damp - 0.5 * sl - 0.25 * oil + 0.06 * (pebble > 0 ? 1 : 0);
      orm[o] = 255 * (1 - 0.6 * cr); orm[o + 1] = 255 * clamp01(rough); orm[o + 2] = 0; orm[o + 3] = 255;
    }
    return pbr(S, S, [M, M], color, height, orm, 3.2);
  });
}

/** Remendo de asfalto (mais novo: escuro, fechado, liso) — 2 m. */
export function alleyPatch(q: Quality): PbrSet {
  return memo(`patch:${q}`, () => {
    const S = q === "high" ? 512 : 256, M = 2, fine = fieldOf(512, 311, 3, 128), mid = fieldOf(256, 312, 4, 4);
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, f = samp(fine, 512, x * 512 / S, y * 512 / S), m = samp(mid, 256, x * 256 / S, y * 256 / S);
      const v = 0.13 + 0.04 * (m - 0.5) + (f > 0.78 ? 0.06 : 0), o = i * 4;
      color[o] = v * 255; color[o + 1] = v * 252; color[o + 2] = v * 250; color[o + 3] = 255;
      height[i] = 0.5 + 0.35 * f; orm[o] = 255; orm[o + 1] = 255 * (0.62 - 0.1 * m); orm[o + 2] = 0; orm[o + 3] = 255;
    }
    return pbr(S, S, [M, M], color, height, orm, 2.4);
  });
}

/** Concreto gasto da canaleta central (2 m): poros, areia exposta, lodo escuro no fundo. */
export function alleyConcrete(q: Quality): PbrSet {
  return memo(`concrete:${q}`, () => {
    const S = q === "high" ? 512 : 256, M = 2, fine = fieldOf(512, 321, 4, 64), mid = fieldOf(256, 322, 5, 4), slime = fieldOf(256, 323, 4, 3);
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, f = samp(fine, 512, x * 512 / S, y * 512 / S), m = samp(mid, 256, x * 256 / S, y * 256 / S), s = smooth(0.5, 0.75, samp(slime, 256, x * 256 / S, y * 256 / S));
      const pore = f < 0.18 ? 0.55 : 1;
      const v = (0.42 + 0.1 * (m - 0.5)) * pore * (1 - 0.45 * s), o = i * 4;
      color[o] = v * 255; color[o + 1] = v * 250 * (1 + 0.04 * s); color[o + 2] = v * 236; color[o + 3] = 255;
      height[i] = 0.5 + 0.3 * f - (pore < 1 ? 0.25 : 0); orm[o] = 255 * (pore < 1 ? 0.6 : 1); orm[o + 1] = 255 * (0.88 - 0.45 * s); orm[o + 2] = 0; orm[o + 3] = 255;
    }
    return pbr(S, S, [M, M], color, height, orm, 2.6);
  });
}

/* ======================= paredes ======================= */
/** Tijolo aparente velho (2,4 m): fiadas de 7,5 cm em amarração corrida com uma fiada de tijolos de topo a cada seis,
 * tijolos queimados de tons diferentes (alguns quase pretos, alguns trocados por tijolos novos mais claros), cantos
 * lascados, juntas de argamassa gastas e fundas, fuligem em manchas grandes. */
export function alleyBrick(q: Quality): PbrSet {
  return memo(`brick:${q}`, () => {
    const S = q === "high" ? 1024 : 512, M = 2.4, rows = 32, rh = S / rows, bw = S / 10;
    const fine = fieldOf(512, 331, 4, 32), mid = fieldOf(256, 332, 5, 4), soot = fieldOf(256, 333, 4, 2), chip = fieldOf(512, 334, 3, 64);
    const pal: [number, number, number][] = [[150, 66, 44], [128, 56, 38], [168, 84, 56], [112, 52, 40], [142, 74, 52], [96, 44, 34], [176, 100, 70], [70, 36, 30]];
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    const mort = 1.6 * S / 512;
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / rh), ry = y - row * rh, header = row % 6 === 5, w = header ? bw / 2 : bw, off = header ? bw * 0.25 : (row % 2) * bw * 0.5;
      for (let x = 0; x < S; x++) {
        const xb = (x + off) % S, col = Math.floor(xb / w), rx = xb - col * w;
        const dEdge = Math.min(rx, w - rx, ry, rh - ry);
        const ch = samp(chip, 512, x * 512 / S, y * 512 / S);
        const inMort = dEdge < mort + (ch - 0.5) * 2.2 * (S / 512);                 // canto lascado: a junta "come" o tijolo
        const f = samp(fine, 512, x * 512 / S, y * 512 / S), m = samp(mid, 256, x * 256 / S, y * 256 / S), so = smooth(0.45, 0.85, samp(soot, 256, x * 256 / S, y * 256 / S));
        const h = hash(col, row, 335), pc = pal[Math.floor(h * pal.length)], newer = hash(col, row, 336) > 0.965;
        const i = y * S + x, o = i * 4;
        if (inMort) {
          const v = (0.5 + 0.14 * f) * (1 - 0.5 * so), deep = smooth(0.45, 0.7, m);
          color[o] = 168 * v * (1 - 0.3 * deep); color[o + 1] = 160 * v * (1 - 0.3 * deep); color[o + 2] = 148 * v * (1 - 0.3 * deep);
          height[i] = 0.18 + 0.12 * f - 0.1 * deep; orm[o] = 255 * (0.55 - 0.2 * deep); orm[o + 1] = 245;
        } else {
          const t = (newer ? 1.15 : 0.85 + 0.3 * hash(col, row, 337)) * (0.82 + 0.3 * f) * (1 - 0.55 * so) * (1 - 0.12 * smooth(0, 4 * S / 512, -dEdge + 4 * S / 512));
          const [cr, cg, cb] = newer ? [186, 92, 62] : pc;
          color[o] = cr * t; color[o + 1] = cg * t; color[o + 2] = cb * t;
          height[i] = 0.82 + 0.12 * f - 0.18 * (1 - smooth(0, 3 * S / 512, dEdge - mort)); orm[o] = 255; orm[o + 1] = 255 * (0.82 + 0.1 * f);
        }
        color[o + 3] = 255; orm[o + 2] = 0; orm[o + 3] = 255;
      }
    }
    return pbr(S, S, [M, M], color, height, orm, 5);
  });
}

/** Faixa de concreto pintado (vigas, peitoris, embasamento): tinta cinza velha, descascada, com o concreto aparecendo. */
export function alleyPaintedConcrete(q: Quality): PbrSet {
  return memo(`paintconc:${q}`, () => {
    const S = q === "high" ? 512 : 256, M = 2, f1 = fieldOf(256, 341, 5, 4), f2 = fieldOf(512, 342, 4, 32), peel = fieldOf(256, 343, 4, 6);
    const color = new Uint8ClampedArray(S * S * 4), orm = new Uint8ClampedArray(S * S * 4), height = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, a = samp(f1, 256, x * 256 / S, y * 256 / S), b = samp(f2, 512, x * 512 / S, y * 512 / S), p = samp(peel, 256, x * 256 / S, y * 256 / S);
      const bare = smooth(0.62, 0.66, p), edge = smooth(0.58, 0.62, p) - bare;
      const paint = 0.55 + 0.08 * (a - 0.5), conc = 0.38 + 0.1 * b, v = paint * (1 - bare) + conc * bare - 0.12 * edge;
      const o = i * 4; color[o] = v * 255; color[o + 1] = v * 251; color[o + 2] = v * 243; color[o + 3] = 255;
      height[i] = 0.6 + 0.06 * b - 0.12 * bare; orm[o] = 255 * (1 - 0.3 * edge); orm[o + 1] = 255 * (0.7 + 0.25 * bare); orm[o + 2] = 0; orm[o + 3] = 255;
    }
    return pbr(S, S, [M, M], color, height, orm, 2.2);
  });
}

/* ======================= folhas de decalques ======================= */
export interface Rect01 { u0: number; v0: number; u1: number; v1: number }
export interface Atlas { tex: THREE.CanvasTexture; rects: Record<string, Rect01> }
const SANS = "'Helvetica Neue', Inter, Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif";
const CONDENSED = "'Arial Narrow', 'Liberation Sans Narrow', 'DejaVu Sans Condensed', Impact, 'Helvetica Neue', Arial, sans-serif";
const HANDS = "'Marker Felt', 'Bradley Hand', 'Segoe Print', 'Comic Sans MS', 'DejaVu Sans', cursive";
const IMPACT = "Impact, 'Anton', 'Arial Black', 'DejaVu Sans', sans-serif";

/** Desenha células numa folha (coordenadas lógicas `LW × LH`, escaladas para a qualidade) e devolve os retângulos UV. */
function atlas(key: string, LW: number, LH: number, scale: number, cells: [string, number, number, number, number, (g: CanvasRenderingContext2D, w: number, h: number) => void][]): Atlas {
  return memo(key, () => {
    const W = Math.round(LW * scale), H = Math.round(LH * scale), [c, g] = canvas(W, H), rects: Record<string, Rect01> = {};
    g.clearRect(0, 0, W, H);
    for (const [name, x, y, w, h, draw] of cells) {
      g.save(); g.scale(scale, scale); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip(); draw(g, w, h); g.restore();
      // meio pixel para dentro: o filtro não puxa a célula vizinha
      rects[name] = { u0: (x + 1) / LW, v0: 1 - (y + h - 1) / LH, u1: (x + w - 1) / LW, v1: 1 - (y + 1) / LH };
    }
    const tex = texFrom(c, true, undefined, true); tex.premultiplyAlpha = false;
    return { tex, rects };
  });
}
/** Spray: traço grosso com borda difusa (sombra) e pingos escorrendo. */
function sprayText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, outline: string, opt: { font?: string; skew?: number; drips?: number; seed?: number; glow?: string } = {}) {
  const r = rng(opt.seed ?? 1);
  g.save(); g.translate(x, y); g.transform(1, 0, opt.skew ?? -0.18, 1, 0, 0);
  g.font = `900 ${size}px ${opt.font ?? IMPACT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
  if (opt.glow) { g.shadowColor = opt.glow; g.shadowBlur = size * 0.25; }
  g.strokeStyle = outline; g.lineWidth = size * 0.16; g.strokeText(text, 0, 0);
  g.shadowBlur = size * 0.05; g.shadowColor = fill;
  g.fillStyle = fill; g.fillText(text, 0, 0);
  g.restore();
  // pingos: tinta escorrida debaixo das letras
  g.save(); g.strokeStyle = fill; g.lineCap = "round";
  const wTxt = size * text.length * 0.55;
  for (let k = 0; k < (opt.drips ?? 5); k++) { const dx = x - wTxt / 2 + r() * wTxt, len = size * (0.2 + r() * 0.8); g.lineWidth = 1.5 + r() * 3; g.beginPath(); g.moveTo(dx, y + size * 0.3); g.lineTo(dx + (r() - 0.5) * 2, y + size * 0.3 + len); g.stroke(); g.beginPath(); g.arc(dx, y + size * 0.3 + len, g.lineWidth * 0.8, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
  g.restore();
}
/** Mancha de spray (névoa de tinta) em volta de um traço. */
function overspray(g: CanvasRenderingContext2D, x: number, y: number, rad: number, color: string, seed: number, n = 160) {
  const r = rng(seed); g.save(); g.fillStyle = color;
  for (let k = 0; k < n; k++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad; g.globalAlpha = 0.08 + r() * 0.2; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.6 + r() * 1.6, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
/** Borda rasgada/irregular (reboco caído, cartaz rasgado): caminho com ruído no contorno de uma elipse. */
function raggedBlob(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, seed: number, jag = 0.25, n = 64) {
  const r = rng(seed); g.beginPath();
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2, j = 1 - jag * (0.5 * r() + 0.5 * Math.abs(Math.sin(a * 3 + seed)));
    const x = cx + Math.cos(a) * rx * j, y = cy + Math.sin(a) * ry * j; k ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
}
/** Papel (cartaz, panfleto): fundo com fibra e amarelado. */
function paperFill(g: CanvasRenderingContext2D, w: number, h: number, base: string, seed: number) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const r = rng(seed); g.save();
  for (let k = 0; k < (w * h) / 60; k++) { g.globalAlpha = 0.05 + r() * 0.06; g.fillStyle = r() > 0.5 ? "#000" : "#fff"; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
  const grd = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
  grd.addColorStop(0, "rgba(0,0,0,0)"); grd.addColorStop(1, "rgba(80,60,20,0.25)"); g.globalAlpha = 1; g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.restore();
}

/** Folha de decalques das paredes do beco (lógica 2048 × 1024). Nomes inventados; nenhuma marca real. */
export function wallDecals(q: Quality): Atlas {
  const s = q === "high" ? 1 : 0.5;
  return atlas(`walldecals:${q}`, 2048, 1024, s, [
    // pichação de assinatura (traço fino, preto com contorno prata)
    ["tagNox", 0, 0, 512, 256, (g, w, h) => { overspray(g, w / 2, h / 2, 150, "#111", 3, 120); sprayText(g, "NOX", w / 2, h * 0.48, 150, "#141414", "#b9bcc2", { seed: 4, drips: 7 }); }],
    // grafite de letras gordas (bomb) em dois tons
    ["throwVulto", 512, 0, 512, 256, (g, w, h) => { sprayText(g, "VULTO", w / 2, h * 0.5, 120, "#e8d34a", "#1b1b1b", { seed: 5, drips: 6, skew: -0.1, font: IMPACT }); sprayText(g, "VULTO", w / 2 + 2, h * 0.5 - 3, 120, "rgba(255,255,255,0)", "rgba(255,255,255,0.35)", { seed: 6, drips: 0, skew: -0.1 }); }],
    ["tagTrama", 1024, 0, 512, 256, (g, w, h) => { overspray(g, w * 0.5, h * 0.5, 170, "#3a6fd8", 7, 220); sprayText(g, "TRAMA·26", w / 2, h * 0.5, 96, "#3f78e0", "#f2f2f2", { seed: 8, drips: 8, skew: -0.25 }); }],
    // estêncil: corvo com a frase
    ["stencilCorvo", 1536, 0, 256, 256, (g, w, h) => {
      g.fillStyle = "rgba(20,20,22,0.92)"; g.save(); g.translate(w / 2, h * 0.44); g.beginPath();
      g.moveTo(-70, 20); g.quadraticCurveTo(-20, -40, 40, -30); g.lineTo(70, -46); g.lineTo(52, -22); g.quadraticCurveTo(60, 10, 20, 30); g.lineTo(30, 62); g.lineTo(14, 62); g.lineTo(6, 34); g.lineTo(-10, 36); g.lineTo(-4, 62); g.lineTo(-20, 62); g.lineTo(-22, 34); g.quadraticCurveTo(-60, 40, -70, 20); g.fill();
      g.fillStyle = "#e8e2d4"; g.beginPath(); g.arc(46, -30, 4, 0, Math.PI * 2); g.fill(); g.restore();
      g.fillStyle = "rgba(20,20,22,0.9)"; g.font = `700 26px ${CONDENSED}`; g.textAlign = "center"; g.fillText("OLHO VIVO", w / 2, h * 0.9);
    }],
    ["tagsSmall", 1792, 0, 256, 256, (g, w, h) => {
      sprayText(g, "LUME", w * 0.45, h * 0.28, 64, "#c23a2b", "rgba(0,0,0,0)", { seed: 9, drips: 3, font: HANDS });
      sprayText(g, "K.O.", w * 0.6, h * 0.62, 56, "#151515", "rgba(0,0,0,0)", { seed: 10, drips: 2, font: HANDS });
      g.strokeStyle = "#151515"; g.lineWidth = 3; g.beginPath(); g.arc(w * 0.25, h * 0.8, 20, 0, Math.PI * 2); g.moveTo(w * 0.25 - 14, h * 0.8 - 14); g.lineTo(w * 0.25 + 14, h * 0.8 + 14); g.stroke();
    }],
    // lambe-lambes (cartazes colados, alguns rasgados): eventos e serviços fictícios
    ["posters", 0, 256, 512, 256, (g, w, h) => {
      const items: [string, string, string, string][] = [["SAMBA NO BECO", "SEXTA · 23H", "#f2c230", "#1a1a1a"], ["BAILE ORVALHO", "SÁBADO · ENTRADA FRANCA", "#d6322b", "#fff3e0"], ["FEIRA DE VINIL", "DOMINGO · PRAÇA 7", "#1f4f8a", "#f6f1e6"]];
      items.forEach(([t1, t2, bg, ink], k) => {
        const x = 8 + k * 168, y = 10 + (k % 2) * 8, pw = 158, ph = 230;
        g.save(); g.translate(x + pw / 2, y + ph / 2); g.rotate((k - 1) * 0.03); g.translate(-pw / 2, -ph / 2);
        paperFill(g, pw, ph, bg, 20 + k);
        g.fillStyle = ink; g.textAlign = "center"; g.font = `900 30px ${IMPACT}`; g.fillText(t1.split(" ")[0], pw / 2, 60); g.font = `900 26px ${IMPACT}`; g.fillText(t1.split(" ").slice(1).join(" "), pw / 2, 94);
        g.font = `700 13px ${SANS}`; g.fillText(t2, pw / 2, 140);
        g.fillRect(20, 160, pw - 40, 3); g.font = `600 11px ${SANS}`; g.fillText("CARTAZ · NÃO RETIRAR", pw / 2, 196);
        // rasgo: um pedaço arrancado mostrando o cartaz de baixo (branco sujo)
        if (k === 1) { g.globalCompositeOperation = "destination-out"; raggedBlob(g, pw * 0.8, ph * 0.85, 40, 30, 30 + k, 0.5); g.fill(); g.globalCompositeOperation = "source-over"; }
        g.restore();
      });
    }],
    // reboco descascado (manchas de reboco velho sobre o tijolo: borda irregular, rachado, sujo)
    ["plasterA", 512, 256, 384, 256, (g, w, h) => {
      raggedBlob(g, w / 2, h / 2, w * 0.46, h * 0.42, 41, 0.35, 90); g.save(); g.clip();
      const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#bdb6a6"); grd.addColorStop(1, "#9c9483"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
      const r = rng(42); for (let k = 0; k < 900; k++) { g.globalAlpha = 0.1 + r() * 0.15; g.fillStyle = r() > 0.6 ? "#5d564b" : "#d8d2c3"; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
      g.globalAlpha = 0.7; g.strokeStyle = "#4a443a"; g.lineWidth = 1.2; for (let k = 0; k < 6; k++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let j = 0; j < 8; j++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
      g.restore(); g.globalAlpha = 0.6; g.strokeStyle = "#3a352d"; g.lineWidth = 2.5; raggedBlob(g, w / 2, h / 2, w * 0.46, h * 0.42, 41, 0.35, 90); g.stroke(); g.globalAlpha = 1;
    }],
    ["plasterB", 896, 256, 256, 256, (g, w, h) => {
      raggedBlob(g, w * 0.5, h * 0.55, w * 0.45, h * 0.4, 43, 0.45, 70); g.save(); g.clip();
      g.fillStyle = "#c9c1ad"; g.fillRect(0, 0, w, h); const r = rng(44);
      for (let k = 0; k < 500; k++) { g.globalAlpha = 0.12 + r() * 0.12; g.fillStyle = r() > 0.5 ? "#6d6455" : "#e6dfcf"; g.fillRect(r() * w, r() * h, 2, 2); }
      // pintura velha por cima do reboco (verde-água desbotado)
      g.globalAlpha = 0.55; raggedBlob(g, w * 0.45, h * 0.5, w * 0.3, h * 0.28, 45, 0.5, 60); g.fillStyle = "#7fa59a"; g.fill(); g.restore(); g.globalAlpha = 1;
    }],
    // escorridos: ferrugem sob suportes e água/sujeira sob peitoris e aparelhos de ar
    ["rustStreak", 1152, 256, 128, 384, (g, w, h) => {
      const r = rng(46); for (let k = 0; k < 14; k++) { const x = w * 0.3 + r() * w * 0.4, len = h * (0.4 + r() * 0.6); const grd = g.createLinearGradient(0, 0, 0, len); grd.addColorStop(0, "rgba(110,52,20,0.75)"); grd.addColorStop(1, "rgba(110,52,20,0)"); g.strokeStyle = grd; g.lineWidth = 2 + r() * 7; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 6, len); g.stroke(); }
    }],
    ["waterStreak", 1280, 256, 256, 384, (g, w, h) => {
      const r = rng(47); for (let k = 0; k < 30; k++) { const x = r() * w, len = h * (0.3 + r() * 0.7); const grd = g.createLinearGradient(0, 0, 0, len); grd.addColorStop(0, "rgba(20,22,18,0.55)"); grd.addColorStop(1, "rgba(20,22,18,0)"); g.strokeStyle = grd; g.lineWidth = 3 + r() * 12; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 8, len); g.stroke(); }
      const top = g.createLinearGradient(0, 0, 0, 40); top.addColorStop(0, "rgba(15,15,12,0.6)"); top.addColorStop(1, "rgba(15,15,12,0)"); g.fillStyle = top; g.fillRect(0, 0, w, 40);
    }],
    // fuligem do exaustor da cozinha (nuvem escura subindo)
    ["soot", 1536, 256, 256, 384, (g, w, h) => {
      const r = rng(48); for (let k = 0; k < 40; k++) { const y = h - r() * h, spread = (1 - y / h) * w * 0.4 + 20, x = w / 2 + (r() - 0.5) * spread; const grd = g.createRadialGradient(x, y, 0, x, y, 30 + r() * 50); grd.addColorStop(0, `rgba(12,10,8,${0.22 + 0.25 * (y / h)})`); grd.addColorStop(1, "rgba(12,10,8,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h); }
    }],
    // pintura de aviso direto no tijolo e o número da casa
    ["noTrash", 1792, 256, 256, 128, (g, w, h) => { g.fillStyle = "rgba(240,236,224,0.85)"; g.font = `900 34px ${CONDENSED}`; g.textAlign = "center"; g.fillText("PROIBIDO", w / 2, h * 0.38); g.fillText("JOGAR LIXO", w / 2, h * 0.75); g.fillStyle = "rgba(200,40,30,0.85)"; g.fillRect(16, h * 0.86, w - 32, 6); }],
    ["houseNumber", 1792, 384, 128, 128, (g, w, h) => { g.fillStyle = "#e9e3d2"; g.fillRect(8, 8, w - 16, h - 16); g.strokeStyle = "#1d2a4a"; g.lineWidth = 5; g.strokeRect(12, 12, w - 24, h - 24); g.fillStyle = "#1d2a4a"; g.font = `800 64px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("18", w / 2, h / 2 + 3); }],
    ["chalk", 1920, 384, 128, 128, (g, w, h) => { g.strokeStyle = "rgba(235,235,230,0.8)"; g.lineWidth = 3; g.font = `400 22px ${HANDS}`; g.fillStyle = "rgba(235,235,230,0.85)"; g.fillText("GÁS ↓", 14, 40); g.strokeRect(14, 60, 90, 40); g.beginPath(); g.moveTo(14, 60); g.lineTo(104, 100); g.stroke(); }],
    // eflorescência (sal branco subindo do pé da parede) e mancha de umidade
    ["efflor", 0, 512, 512, 192, (g, w, h) => {
      const r = rng(49); for (let k = 0; k < 60; k++) { const x = r() * w, y = h - r() * h * 0.8, rad = 14 + r() * 40; const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, "rgba(230,228,215,0.32)"); grd.addColorStop(1, "rgba(230,228,215,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h); }
      const wet = g.createLinearGradient(0, h, 0, 0); wet.addColorStop(0, "rgba(14,16,12,0.7)"); wet.addColorStop(0.45, "rgba(14,16,12,0.25)"); wet.addColorStop(1, "rgba(14,16,12,0)"); g.fillStyle = wet; g.fillRect(0, 0, w, h);
    }],
    // aviso de gás (placa pintada no muro sobre o abrigo) e marca de giz
    ["gasPaint", 512, 512, 384, 192, (g, w, h) => { g.fillStyle = "rgba(242,194,48,0.92)"; g.fillRect(10, 10, w - 20, h - 20); g.fillStyle = "#151515"; g.font = `900 48px ${IMPACT}`; g.textAlign = "center"; g.fillText("GLP", w / 2, h * 0.42); g.font = `800 22px ${SANS}`; g.fillText("PERIGO · INFLAMÁVEL", w / 2, h * 0.66); g.fillText("NÃO FUME", w / 2, h * 0.84); }],
    // contorno escuro de mão/encosto (gordura) em volta da porta da cozinha
    ["grease", 896, 512, 256, 256, (g, w, h) => { const r = rng(50); for (let k = 0; k < 26; k++) { const x = w * 0.2 + r() * w * 0.6, y = h * 0.2 + r() * h * 0.6, rad = 10 + r() * 30; const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, "rgba(24,18,10,0.35)"); grd.addColorStop(1, "rgba(24,18,10,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h); } }],
    // pichação de assinatura longa (corrida) e "xarpi" vertical
    ["tagRun", 1152, 640, 640, 128, (g, w, h) => { sprayText(g, "GANA · VÉU · 7Z", w / 2, h * 0.52, 64, "#1c1c1c", "rgba(0,0,0,0)", { seed: 51, drips: 9, font: HANDS, skew: -0.3 }); }],
    ["tagVert", 1792, 512, 128, 384, (g, w, h) => { g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2); sprayText(g, "ZUMBA", 0, 0, 70, "#7a2bb0", "#0d0d0d", { seed: 52, drips: 0, skew: -0.1 }); g.restore(); }],
    // grafite com fundo (peça maior): sol nascente estilizado e a palavra AURORA em letras de bloco
    ["pieceSun", 0, 704, 768, 320, (g, w, h) => {
      overspray(g, w / 2, h / 2, 300, "#2a2140", 53, 400);
      const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#f39a3c"); grd.addColorStop(1, "#c1306b"); g.fillStyle = grd;
      g.beginPath(); g.arc(w * 0.22, h * 0.62, h * 0.32, Math.PI, 0); g.fill();
      for (let k = 0; k < 9; k++) { const a = Math.PI + (k + 0.5) * (Math.PI / 9); g.strokeStyle = "#f5c04a"; g.lineWidth = 6; g.beginPath(); g.moveTo(w * 0.22 + Math.cos(a) * h * 0.36, h * 0.62 + Math.sin(a) * h * 0.36); g.lineTo(w * 0.22 + Math.cos(a) * h * 0.48, h * 0.62 + Math.sin(a) * h * 0.48); g.stroke(); }
      sprayText(g, "AMANHÃ", w * 0.62, h * 0.5, 110, "#f4efe2", "#1d1b2e", { seed: 54, drips: 6, skew: -0.08 });
    }],
  ]);
}

/** Folha de decalques do chão do beco (lógica 1024 × 1024). */
export function groundDecals(q: Quality): Atlas {
  const s = q === "high" ? 1 : 0.5;
  return atlas(`grounddecals:${q}`, 1024, 1024, s, [
    // faixa de sujeira do pé da parede (repete ao longo de u; v = 0 junto à parede)
    ["grime", 0, 0, 1024, 192, (g, w, h) => {
      const r = rng(61);
      const grd = g.createLinearGradient(0, h, 0, 0); grd.addColorStop(0, "rgba(16,14,10,0.92)"); grd.addColorStop(0.35, "rgba(26,22,16,0.65)"); grd.addColorStop(0.75, "rgba(40,34,26,0.18)"); grd.addColorStop(1, "rgba(40,34,26,0)");
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 700; k++) { const x = r() * w, y = h - Math.pow(r(), 1.7) * h; g.globalAlpha = 0.2 + r() * 0.4; g.fillStyle = ["#2b2418", "#4a3d29", "#151310", "#5b5040", "#3a4a26"][Math.floor(r() * 5)]; g.beginPath(); g.ellipse(x, y, 1 + r() * 4, 1 + r() * 2.5, r() * 3, 0, Math.PI * 2); g.fill(); }
      // folhas secas e lodo verde
      for (let k = 0; k < 40; k++) { const x = r() * w, y = h - r() * h * 0.6; g.globalAlpha = 0.75; g.fillStyle = ["#6b4a22", "#8a6630", "#4d3a1c"][k % 3]; g.save(); g.translate(x, y); g.rotate(r() * 6); g.beginPath(); g.ellipse(0, 0, 9 + r() * 6, 4 + r() * 2, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
      g.globalAlpha = 0.35; g.fillStyle = "#2f4220"; for (let k = 0; k < 30; k++) { g.beginPath(); g.ellipse(r() * w, h - r() * 30, 20 + r() * 40, 5 + r() * 6, 0, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
    }],
    // panfletos (papel, um pouco amassado/sujo): eventos e serviços inventados
    ["flyer0", 0, 192, 128, 176, (g, w, h) => { paperFill(g, w, h, "#f6f1e3", 62); g.fillStyle = "#c2185b"; g.font = `900 22px ${IMPACT}`; g.textAlign = "center"; g.fillText("BAILE", w / 2, 40); g.fillText("ORVALHO", w / 2, 66); g.fillStyle = "#222"; g.font = `600 11px ${SANS}`; g.fillText("SÁBADO · 23H", w / 2, 92); g.fillRect(14, 104, w - 28, 2); g.fillText("ENTRADA FRANCA", w / 2, 124); g.fillStyle = "rgba(60,40,20,0.25)"; g.fillRect(0, h * 0.6, w, 30); }],
    ["flyer1", 128, 192, 128, 176, (g, w, h) => { paperFill(g, w, h, "#fff04a", 63); g.fillStyle = "#151515"; g.font = `900 20px ${IMPACT}`; g.textAlign = "center"; g.fillText("PIZZA", w / 2, 36); g.fillText("DO BECO", w / 2, 60); g.font = `700 12px ${SANS}`; g.fillText("ENTREGA 24H", w / 2, 88); g.fillStyle = "#c62828"; g.beginPath(); g.arc(w / 2, 130, 26, 0, Math.PI * 2); g.fill(); g.fillStyle = "#fff"; g.font = `900 14px ${SANS}`; g.fillText("2 POR 1", w / 2, 135); }],
    ["flyer2", 256, 192, 128, 176, (g, w, h) => { paperFill(g, w, h, "#e9f0f7", 64); g.fillStyle = "#1a3a6a"; g.font = `900 16px ${SANS}`; g.textAlign = "center"; g.fillText("ALUGA-SE", w / 2, 30); g.fillText("SALÃO", w / 2, 50); g.fillStyle = "#333"; g.font = `500 10px ${SANS}`; for (let k = 0; k < 6; k++) g.fillRect(16, 70 + k * 12, w - 32 - (k % 2) * 20, 3); for (let k = 0; k < 7; k++) { g.fillStyle = "#ddd"; g.fillRect(6 + k * 17, h - 30, 12, 28); g.fillStyle = "#555"; g.fillRect(9 + k * 17, h - 28, 2, 24); } }],
    ["flyer3", 384, 192, 128, 176, (g, w, h) => { paperFill(g, w, h, "#121212", 65); g.fillStyle = "#e3b04b"; g.font = `400 14px Georgia, serif`; g.textAlign = "center"; g.fillText("GALA", w / 2, 40); g.font = `400 26px Georgia, serif`; g.fillText("LUMIÈRE", w / 2, 70); g.font = `600 9px ${SANS}`; g.fillText("CONVITE · NÃO TRANSFERÍVEL", w / 2, 100); g.strokeStyle = "#e3b04b"; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = "rgba(90,70,40,0.4)"; g.beginPath(); g.ellipse(w * 0.7, h * 0.8, 30, 14, 0.3, 0, Math.PI * 2); g.fill(); }],
    // jornal velho (colunas cinza)
    ["newspaper", 512, 192, 256, 176, (g, w, h) => { paperFill(g, w, h, "#d9d4c5", 66); g.fillStyle = "#2a2a2a"; g.font = `900 22px Georgia, serif`; g.fillText("CIDADE", 12, 30); for (let c = 0; c < 4; c++) for (let k = 0; k < 14; k++) g.fillRect(12 + c * 60, 46 + k * 9, 50 - (k % 3) * 6, 3); g.fillStyle = "#777"; g.fillRect(140, 50, 100, 60); }],
    // papelão rasgado (pedaço solto)
    ["cardboard", 768, 192, 256, 176, (g, w, h) => { raggedBlob(g, w / 2, h / 2, w * 0.46, h * 0.4, 67, 0.3); g.save(); g.clip(); g.fillStyle = "#a27c52"; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(60,40,20,0.25)"; for (let x = 0; x < w; x += 6) g.fillRect(x, 0, 2, h); g.fillStyle = "#1a1a1a"; g.font = `900 22px ${SANS}`; g.fillText("FRÁGIL", 40, 80); g.fillStyle = "rgba(40,30,20,0.5)"; g.fillRect(0, h * 0.7, w, 20); g.restore(); }],
    // manchas de óleo (escuras com borda irisada) e mancha molhada (bica do cano)
    ["oil0", 0, 368, 256, 256, (g, w, h) => { const r = rng(68); for (let k = 0; k < 9; k++) { const x = w / 2 + (r() - 0.5) * 90, y = h / 2 + (r() - 0.5) * 90, rad = 30 + r() * 60; const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, "rgba(8,8,6,0.55)"); grd.addColorStop(0.75, "rgba(12,10,8,0.3)"); grd.addColorStop(1, "rgba(12,10,8,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h); } }],
    ["oil1", 256, 368, 256, 256, (g, w, h) => { const r = rng(69); for (let k = 0; k < 24; k++) { const x = w / 2 + (r() - 0.5) * 160, y = h / 2 + (r() - 0.5) * 60, rad = 8 + r() * 26; g.fillStyle = `rgba(10,9,7,${0.3 + r() * 0.3})`; g.beginPath(); g.ellipse(x, y, rad, rad * 0.7, r() * 3, 0, Math.PI * 2); g.fill(); } }],
    ["wetStain", 512, 368, 256, 256, (g, w, h) => { raggedBlob(g, w / 2, h / 2, w * 0.45, h * 0.32, 70, 0.4, 60); const grd = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.45); grd.addColorStop(0, "rgba(10,12,10,0.7)"); grd.addColorStop(1, "rgba(10,12,10,0.15)"); g.fillStyle = grd; g.fill(); }],
    // marca de pneu (arco de borracha) e pegadas de lama
    ["tire", 768, 368, 256, 256, (g, w, h) => { g.strokeStyle = "rgba(12,12,12,0.55)"; g.lineWidth = 34; g.setLineDash([3, 5]); g.beginPath(); g.arc(-60, h * 1.1, w * 0.95, -Math.PI * 0.42, -Math.PI * 0.08); g.stroke(); g.setLineDash([]); g.lineWidth = 2; g.strokeStyle = "rgba(10,10,10,0.3)"; g.beginPath(); g.arc(-60, h * 1.1, w * 0.95 + 14, -Math.PI * 0.42, -Math.PI * 0.08); g.stroke(); }],
    ["steps", 0, 624, 256, 128, (g, w, h) => { const r = rng(71); for (let k = 0; k < 6; k++) { const x = 20 + k * 38, y = h / 2 + (k % 2 ? -18 : 18); g.save(); g.translate(x, y); g.rotate(0.1 + (r() - 0.5) * 0.2); g.fillStyle = "rgba(40,30,18,0.45)"; g.beginPath(); g.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(-16, 0, 6, 5, 0, 0, Math.PI * 2); g.fill(); g.restore(); } }],
    // folhas soltas (cada uma recortada)
    ["leaves", 256, 624, 256, 128, (g, w, h) => { const r = rng(72); for (let k = 0; k < 14; k++) { const x = 16 + r() * (w - 32), y = 16 + r() * (h - 32); g.save(); g.translate(x, y); g.rotate(r() * 6); g.fillStyle = ["#6b4a22", "#8a6630", "#4d3a1c", "#7a5a28", "#3e4a22"][k % 5]; g.beginPath(); g.moveTo(-14, 0); g.quadraticCurveTo(0, -8, 14, 0); g.quadraticCurveTo(0, 8, -14, 0); g.fill(); g.strokeStyle = "rgba(30,20,10,0.6)"; g.lineWidth = 1; g.beginPath(); g.moveTo(-14, 0); g.lineTo(14, 0); g.stroke(); g.restore(); } }],
    // chiclete e manchas pequenas (pontos escuros achatados)
    ["gum", 512, 624, 256, 128, (g, w, h) => { const r = rng(73); for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${30 + r() * 30},${28 + r() * 20},${26 + r() * 20},${0.5 + r() * 0.4})`; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 5, 0, Math.PI * 2); g.fill(); } }],
    // embalagem de salgadinho amassada e copo plástico achatado (vistos de cima)
    ["wrapper", 768, 624, 128, 128, (g, w, h) => { raggedBlob(g, w / 2, h / 2, 50, 30, 74, 0.35); g.fillStyle = "#c62f2f"; g.fill(); g.fillStyle = "#f4d03f"; g.font = `900 18px ${IMPACT}`; g.textAlign = "center"; g.fillText("CROC", w / 2, h / 2 + 6); g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.3, h * 0.3); g.lineTo(w * 0.5, h * 0.42); g.stroke(); }],
    ["cup", 896, 624, 128, 128, (g, w, h) => { g.fillStyle = "rgba(240,240,236,0.95)"; g.beginPath(); g.moveTo(20, 40); g.lineTo(108, 30); g.lineTo(100, 92); g.lineTo(28, 98); g.closePath(); g.fill(); g.strokeStyle = "rgba(120,120,120,0.6)"; g.lineWidth = 2; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(26 + k * 20, 40); g.lineTo(30 + k * 20, 96); g.stroke(); } }],
  ]);
}

/* ---------- poças ---------- */
/** Poças (lógica 1024 × 256, quatro formas): alfa = água (borda recortada e mais fina), cor = escuro com película de óleo
 * furta-cor em faixas; o material da poça é liso (reflete o ambiente da rua). */
export function puddleAtlas(q: Quality): Atlas {
  const s = q === "high" ? 1 : 0.5;
  const draw = (seed: number, oily: number) => (g: CanvasRenderingContext2D, w: number, h: number) => {
    const r = rng(seed), cx = w / 2, cy = h / 2;
    // forma: soma de 5 manchas elípticas, contorno suave
    const blobs = Array.from({ length: 5 }, () => ({ x: cx + (r() - 0.5) * w * 0.4, y: cy + (r() - 0.5) * h * 0.35, rx: w * (0.14 + r() * 0.16), ry: h * (0.12 + r() * 0.14), a: r() * 3 }));
    for (const b of blobs) {
      const grd = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, Math.max(b.rx, b.ry));
      grd.addColorStop(0, "rgba(10,12,14,1)"); grd.addColorStop(0.7, "rgba(10,12,14,0.95)"); grd.addColorStop(1, "rgba(10,12,14,0)");
      g.save(); g.translate(b.x, b.y); g.rotate(b.a); g.scale(1, b.ry / b.rx); g.translate(-b.x, -b.y); g.fillStyle = grd; g.beginPath(); g.arc(b.x, b.y, b.rx, 0, Math.PI * 2); g.fill(); g.restore();
    }
    // película de óleo: faixas de cor fina (arco-íris) dentro da poça, só onde há água
    if (oily > 0) {
      g.save(); g.globalCompositeOperation = "source-atop";
      for (let k = 0; k < 7; k++) {
        const x = cx + (r() - 0.5) * w * 0.3, y = cy + (r() - 0.5) * h * 0.3, R = 20 + r() * 60;
        const hues = ["rgba(170,60,200,", "rgba(40,140,220,", "rgba(40,200,120,", "rgba(230,200,40,", "rgba(220,90,40,"];
        for (let j = 0; j < hues.length; j++) { g.strokeStyle = `${hues[j]}${0.16 * oily})`; g.lineWidth = 5; g.beginPath(); g.ellipse(x, y, R + j * 5, (R + j * 5) * 0.6, r() * 3, 0, Math.PI * 2); g.stroke(); }
      }
      g.restore();
    }
  };
  return atlas(`puddles:${q}`, 1024, 256, s, [["p0", 0, 0, 256, 256, draw(81, 0)], ["p1", 256, 0, 256, 256, draw(82, 1)], ["p2", 512, 0, 256, 256, draw(83, 0.4)], ["p3", 768, 0, 256, 256, draw(84, 1)]]);
}

/* ---------- peças pequenas ---------- */
/** Grade (alfa recortado): tela de arame (losangos) ou chapa expandida, para a gaiola de gás, cercas e grelhas. */
export function meshAlpha(kind: "chain" | "weld" | "grate"): THREE.CanvasTexture {
  return memo(`mesh:${kind}`, () => {
    const S = 128, [c, g] = canvas(S, S); g.fillStyle = "#000"; g.fillRect(0, 0, S, S); g.strokeStyle = "#fff"; g.fillStyle = "#fff";
    if (kind === "chain") { g.lineWidth = 5; for (let k = -S; k < S * 2; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + S, S); g.stroke(); g.beginPath(); g.moveTo(k + S, 0); g.lineTo(k, S); g.stroke(); } }
    else if (kind === "weld") { for (let k = 0; k < S; k += 16) { g.fillRect(k, 0, 3, S); g.fillRect(0, k, S, 3); } }
    else { for (let k = 0; k < S; k += 21) g.fillRect(k, 0, 9, S); g.fillRect(0, 0, S, 6); g.fillRect(0, S / 2, S, 6); }
    return texFrom(c, false);
  });
}
/** Bituca: faixas ao longo do cilindro (filtro laranja pintado, papel branco sujo, ponta queimada). */
export function buttTex(): THREE.CanvasTexture {
  return memo("butt", () => {
    const [c, g] = canvas(8, 64);
    g.fillStyle = "#c98a45"; g.fillRect(0, 0, 8, 26); g.fillStyle = "rgba(90,50,20,0.5)"; for (let y = 2; y < 26; y += 5) g.fillRect(0, y, 8, 1);
    g.fillStyle = "#e4dfd2"; g.fillRect(0, 26, 8, 32); g.fillStyle = "rgba(120,110,90,0.35)"; g.fillRect(0, 40, 8, 6);
    g.fillStyle = "#2b2622"; g.fillRect(0, 58, 8, 6); g.fillStyle = "#6a625a"; g.fillRect(0, 57, 8, 2);
    return texFrom(c, true, undefined, true);
  });
}
/** Mato de fresta (cartões cruzados, alfa recortado): folhas finas de capim e uma folhinha larga. */
export function weedTex(): THREE.CanvasTexture {
  return memo("weed", () => {
    const S = 128, [c, g] = canvas(S, S), r = rng(91); g.clearRect(0, 0, S, S);
    for (let k = 0; k < 22; k++) { const x = S * (0.3 + r() * 0.4), lean = (r() - 0.5) * 50, hgt = S * (0.35 + r() * 0.55); g.strokeStyle = ["#3d5a22", "#56742c", "#2c4318", "#6b7f33"][k % 4]; g.lineWidth = 2 + r() * 2.5; g.beginPath(); g.moveTo(x, S); g.quadraticCurveTo(x + lean * 0.3, S - hgt * 0.6, x + lean, S - hgt); g.stroke(); }
    for (let k = 0; k < 5; k++) { const x = S * (0.3 + r() * 0.4), y = S * (0.6 + r() * 0.3); g.fillStyle = "#4a6a26"; g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 2); g.beginPath(); g.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    return texFrom(c, true, undefined, true);
  });
}
/** Tampa de bueiro de ferro fundido (vista de cima): anéis, losangos em relevo e a inscrição. Cor + altura. */
export function manholeTex(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  return memo("manhole", () => {
    const S = 256, [c, g] = canvas(S, S), hf = new Float32Array(S * S), r = rng(92);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S - 0.5, v = (y + 0.5) / S - 0.5, d = Math.hypot(u, v) * 2;
      const ring = d > 0.86 && d < 0.94 ? 1 : 0, dia = (Math.abs(((u + v) * 14) % 1) < 0.18 || Math.abs(((u - v) * 14 + 100) % 1) < 0.18) && d < 0.8 ? 1 : 0;
      hf[y * S + x] = d > 1 ? 0 : 0.5 + 0.3 * ring + 0.2 * dia + 0.04 * r();
    }
    const img = g.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { const h = hf[i], v = h > 0 ? 40 + h * 60 : 0; img.data[i * 4] = v * 1.05; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v * 0.92; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
    g.fillStyle = "rgba(150,140,125,0.6)"; g.font = `800 18px ${SANS}`; g.textAlign = "center"; g.fillText("ÁGUAS PLUVIAIS", S / 2, S / 2 + 6);
    // ferrugem e lama nas bordas
    for (let k = 0; k < 60; k++) { const a = r() * Math.PI * 2, d = S * (0.36 + r() * 0.1); g.fillStyle = `rgba(110,60,25,${0.15 + r() * 0.2})`; g.beginPath(); g.arc(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 3 + r() * 6, 0, Math.PI * 2); g.fill(); }
    return { map: texFrom(c, true, undefined, true), normalMap: texFrom(normalCanvas(hf, S, S, 6, false), false, undefined, true) };
  });
}

/* ---------- janelas acesas ---------- */
/** Interiores das janelas acesas (lógica 1024 × 384, quatro células): luz de teto, cortina, persiana, a luz azul de TV. */
export function windowInteriors(q: Quality): Atlas {
  const s = q === "high" ? 1 : 0.5;
  const room = (seed: number, warm: [number, number, number], kind: "curtain" | "blinds" | "tv" | "bare") => (g: CanvasRenderingContext2D, w: number, h: number) => {
    const r = rng(seed);
    const grd = g.createRadialGradient(w * (0.3 + r() * 0.4), h * 0.15, 4, w / 2, h * 0.4, h * 0.9);
    grd.addColorStop(0, `rgb(${warm[0]},${warm[1]},${warm[2]})`); grd.addColorStop(1, `rgb(${warm[0] * 0.22},${warm[1] * 0.2},${warm[2] * 0.18})`);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // móvel escuro no fundo (estante, quadro) e a silhueta de uma luminária
    g.fillStyle = "rgba(20,14,10,0.55)"; g.fillRect(w * 0.1, h * 0.55, w * 0.35, h * 0.45); g.fillRect(w * 0.62, h * 0.3, w * 0.2, h * 0.16);
    if (kind === "tv") { g.fillStyle = "rgba(90,140,255,0.9)"; g.fillRect(w * 0.55, h * 0.58, w * 0.3, h * 0.18); }
    if (kind === "curtain") { for (const [x0, x1] of [[0, 0.28], [0.74, 1]]) { const cg = g.createLinearGradient(w * x0, 0, w * x1, 0); cg.addColorStop(0, "rgba(120,40,30,0.92)"); cg.addColorStop(0.5, "rgba(170,70,50,0.85)"); cg.addColorStop(1, "rgba(110,36,28,0.92)"); g.fillStyle = cg; g.fillRect(w * x0, 0, w * (x1 - x0), h); for (let k = 0; k < 6; k++) { g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(w * x0 + k * (w * (x1 - x0) / 6), 0, 3, h); } } }
    if (kind === "blinds") { const top = h * (0.25 + r() * 0.35); for (let y = 0; y < top; y += 10) { g.fillStyle = "rgba(220,215,200,0.92)"; g.fillRect(0, y, w, 7); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, y + 7, w, 3); } }
    g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(0, h - 10, w, 10);
  };
  return atlas(`windows:${q}`, 1024, 384, s, [
    ["w0", 0, 0, 256, 384, room(101, [255, 206, 140], "curtain")], ["w1", 256, 0, 256, 384, room(102, [255, 226, 170], "blinds")],
    ["w2", 512, 0, 256, 384, room(103, [200, 210, 255], "tv")], ["w3", 768, 0, 256, 384, room(104, [255, 190, 120], "bare")],
  ]);
}

/* ---------- placas ---------- */
/** Placas do beco (lógica 1024 × 512): totem de embarque da gala (duas faces), saída de emergência do vizinho, garagem,
 * placa da cerca, placa do abrigo de gás, medidores, aviso de câmera. */
export function alleySigns(q: Quality): Atlas {
  const s = q === "high" ? 1 : 0.5;
  const GOLD = "#d9b46a", SERIF = "'Didot', 'Bodoni 72', 'Playfair Display', Georgia, 'DejaVu Serif', serif";
  return atlas(`signs:${q}`, 1024, 512, s, [
    // totem: frente (para quem chega da avenida) e verso
    ["totemFront", 0, 0, 160, 512, (g, w, h) => {
      const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#14100c"); bg.addColorStop(1, "#060505"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.strokeStyle = GOLD; g.lineWidth = 2; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = GOLD; g.textAlign = "center"; g.font = `400 13px ${SERIF}`; g.fillText("GALA", w / 2, 46); g.font = `400 24px ${SERIF}`; g.fillText("LUMIÈRE", w / 2, 74);
      g.fillRect(30, 90, w - 60, 1.5);
      g.font = `700 15px ${SANS}`; g.fillStyle = "#f3ead6"; g.fillText("EMBARQUE", w / 2, 132); g.fillText("MOTORISTAS", w / 2, 152);
      g.font = `500 10px ${SANS}`; g.fillStyle = "#bfae86"; g.fillText("CREDENCIADOS", w / 2, 170);
      // seta para dentro do beco
      g.fillStyle = GOLD; g.beginPath(); g.moveTo(w / 2, 196); g.lineTo(w / 2 + 26, 236); g.lineTo(w / 2 + 9, 236); g.lineTo(w / 2 + 9, 280); g.lineTo(w / 2 - 9, 280); g.lineTo(w / 2 - 9, 236); g.lineTo(w / 2 - 26, 236); g.closePath(); g.fill();
      g.font = `700 13px ${SANS}`; g.fillStyle = "#f3ead6"; g.fillText("SAÍDA DE", w / 2, 320); g.fillText("FUNCIONÁRIOS", w / 2, 338); g.font = `500 10px ${SANS}`; g.fillStyle = "#bfae86"; g.fillText("APÓS 01H00", w / 2, 356);
      g.strokeStyle = "rgba(217,180,106,0.6)"; g.lineWidth = 1; g.strokeRect(22, 384, w - 44, 70); g.font = `600 9px ${SANS}`; g.fillStyle = "#bfae86"; g.fillText("MUSEU VESPER", w / 2, 410); g.fillText("ENTRADA DE SERVIÇO", w / 2, 426); g.fillText("PELA DOCA · AV. VESPER", w / 2, 442);
      g.font = `400 9px ${SERIF}`; g.fillStyle = GOLD; g.fillText("04 · 12 · 2026", w / 2, h - 26);
    }],
    ["totemBack", 160, 0, 160, 512, (g, w, h) => {
      g.fillStyle = "#0b0908"; g.fillRect(0, 0, w, h); g.strokeStyle = GOLD; g.lineWidth = 2; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = GOLD; g.textAlign = "center"; g.font = `400 22px ${SERIF}`; g.fillText("✦", w / 2, 70); g.font = `400 13px ${SERIF}`; g.fillText("OBRIGADO", w / 2, 110); g.font = `600 10px ${SANS}`; g.fillStyle = "#bfae86";
      ["BOA NOITE", "E VOLTE COM CUIDADO", "", "TÁXI E APLICATIVO", "NA AV. VESPER"].forEach((t, k) => g.fillText(t, w / 2, 160 + k * 18));
      g.fillStyle = "rgba(217,180,106,0.25)"; g.fillRect(20, 300, w - 40, 150); g.fillStyle = GOLD; g.font = `400 26px ${SERIF}`; g.fillText("L", w / 2, 390);
    }],
    // saída de emergência (placa verde fotoluminescente) e "GARAGEM · NÃO ESTACIONE"
    ["exitGreen", 320, 0, 256, 96, (g, w, h) => { g.fillStyle = "#0b7a3b"; g.fillRect(0, 0, w, h); g.fillStyle = "#e9fff1"; g.font = `800 30px ${SANS}`; g.textAlign = "center"; g.fillText("SAÍDA", w * 0.42, h * 0.5 + 6); g.font = `600 13px ${SANS}`; g.fillText("DE EMERGÊNCIA", w * 0.42, h * 0.82); g.beginPath(); g.moveTo(w * 0.78, h * 0.3); g.lineTo(w * 0.92, h * 0.5); g.lineTo(w * 0.78, h * 0.7); g.closePath(); g.fill(); g.fillRect(w * 0.7, h * 0.44, w * 0.09, h * 0.12); }],
    ["garage", 576, 0, 448, 96, (g, w, h) => { g.fillStyle = "#f2f2f2"; g.fillRect(0, 0, w, h); g.strokeStyle = "#b71c1c"; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10); g.fillStyle = "#b71c1c"; g.font = `900 34px ${SANS}`; g.textAlign = "center"; g.fillText("GARAGEM", w / 2, 44); g.font = `800 18px ${SANS}`; g.fillText("NÃO ESTACIONE · 24 HORAS", w / 2, 76); }],
    // cerca do fundo e câmera (vizinho)
    ["fence", 320, 96, 320, 128, (g, w, h) => { g.fillStyle = "#e8e6df"; g.fillRect(0, 0, w, h); g.fillStyle = "#b71c1c"; g.fillRect(0, 0, w, 34); g.fillStyle = "#fff"; g.font = `900 24px ${SANS}`; g.textAlign = "center"; g.fillText("PROPRIEDADE", w / 2, 26); g.fillStyle = "#151515"; g.font = `800 22px ${SANS}`; g.fillText("PARTICULAR", w / 2, 66); g.font = `600 15px ${SANS}`; g.fillText("NÃO ENTRE · CÃES SOLTOS", w / 2, 98); }],
    ["camera", 640, 96, 192, 128, (g, w, h) => { g.fillStyle = "#f2c230"; g.fillRect(0, 0, w, h); g.fillStyle = "#151515"; g.fillRect(24, 40, 54, 34); g.beginPath(); g.moveTo(78, 46); g.lineTo(100, 36); g.lineTo(100, 78); g.lineTo(78, 68); g.fill(); g.font = `800 16px ${SANS}`; g.textAlign = "left"; g.fillText("SORRIA,", 108, 52); g.fillText("VOCÊ ESTÁ", 108, 72); g.fillText("SENDO", 108, 92); g.fillText("FILMADO", 108, 112); }],
    ["meter", 832, 96, 192, 128, (g, w, h) => { g.fillStyle = "#e9e6dc"; g.fillRect(0, 0, w, h); g.fillStyle = "#151515"; g.fillRect(20, 16, w - 40, 36); g.fillStyle = "#9fe28e"; g.font = `600 22px monospace`; g.textAlign = "center"; g.fillText("0 4 7 1 9", w / 2, 42); g.fillStyle = "#333"; g.font = `700 12px ${SANS}`; g.fillText("kWh · 220 V", w / 2, 74); g.fillStyle = "#888"; g.fillRect(30, 90, w - 60, 4); g.fillRect(30, 102, w - 90, 4); }],
    // placas de gás (abrigo) e "PROIBIDO ESTACIONAR" do museu
    ["gasSign", 320, 224, 256, 128, (g, w, h) => { g.fillStyle = "#f2c230"; g.fillRect(0, 0, w, h); g.fillStyle = "#151515"; g.beginPath(); g.moveTo(40, 100); g.lineTo(70, 30); g.lineTo(100, 100); g.closePath(); g.lineWidth = 6; g.strokeStyle = "#151515"; g.stroke(); g.font = `900 40px ${SANS}`; g.textAlign = "center"; g.fillText("!", 70, 92); g.font = `900 26px ${SANS}`; g.fillText("GÁS", 175, 58); g.font = `700 14px ${SANS}`; g.fillText("INFLAMÁVEL", 175, 84); g.fillText("NÃO FUME", 175, 104); }],
    ["noPark", 576, 224, 448, 128, (g, w, h) => { g.fillStyle = "#f2f2f2"; g.fillRect(0, 0, w, h); g.strokeStyle = "#b71c1c"; g.lineWidth = 7; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = "#b71c1c"; g.font = `900 30px ${SANS}`; g.textAlign = "center"; g.fillText("BECO · ACESSO RESTRITO", w / 2, 54); g.font = `800 22px ${SANS}`; g.fillText("PROIBIDO ESTACIONAR", w / 2, 94); }],
    // etiqueta de caçamba (empresa fictícia de coleta) e estêncil "GLP" dos botijões
    ["dumpLabel", 0, 512 - 160, 320, 160, (g, w, h) => { g.fillStyle = "rgba(240,240,232,0.92)"; g.fillRect(0, 0, w, h); g.fillStyle = "#1f4a3a"; g.font = `900 30px ${SANS}`; g.textAlign = "center"; g.fillText("COLETA", w / 2, 42); g.fillText("SÃO BENTO", w / 2, 76); g.fillStyle = "#151515"; g.font = `700 13px ${SANS}`; g.fillText("PROIBIDO DEPOSITAR ENTULHO", w / 2, 108); g.fillText("CONTÊINER Nº 0417", w / 2, 132); }],
    ["glp", 320, 352, 128, 64, (g, w, h) => { g.fillStyle = "rgba(240,240,236,0.9)"; g.font = `900 34px ${CONDENSED}`; g.textAlign = "center"; g.fillText("GLP", w / 2, 44); g.fillRect(14, 52, w - 28, 3); }],
    ["kitchen", 448, 352, 320, 96, (g, w, h) => { g.fillStyle = "#f2f2f2"; g.fillRect(0, 0, w, h); g.fillStyle = "#1d2a4a"; g.font = `800 22px ${SANS}`; g.textAlign = "center"; g.fillText("ENTRADA DE SERVIÇO", w / 2, 40); g.font = `600 14px ${SANS}`; g.fillText("COZINHA · TOQUE A CAMPAINHA", w / 2, 70); }],
    ["bins", 768, 352, 256, 96, (g, w, h) => { const cols = ["#1f5bb5", "#c62828", "#2e7d32", "#f2c230"], lab = ["PAPEL", "PLÁSTICO", "VIDRO", "METAL"]; cols.forEach((c, k) => { g.fillStyle = c; g.fillRect(k * (w / 4), 0, w / 4, h); g.fillStyle = k === 3 ? "#151515" : "#fff"; g.font = `800 ${k === 1 ? 13 : 16}px ${SANS}`; g.textAlign = "center"; g.fillText(lab[k], k * (w / 4) + w / 8, h / 2 + 6); }); }],
  ]);
}

/* ---------- materiais de objetos (ladrilhos de 1 m, tingidos pela cor por vértice) ---------- */
/** Madeira de palete (pinus serrado): veios, nós e marcas de serra, clara (a cor por vértice escurece/esverdeia). */
export function woodTex(): THREE.CanvasTexture {
  return memo("wood", () => {
    const W = 512, H = 512, [c, g] = canvas(W, H), r = rng(111), f = fieldOf(256, 112, 4, 8);
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = samp(f, 256, x * 0.5, y * 0.08), grain = 0.5 + 0.5 * Math.sin((y + n * 60) * 0.35), saw = 0.5 + 0.5 * Math.sin(x * 0.9 + y * 0.05);
      const v = 0.72 + 0.12 * grain + 0.04 * saw - 0.1 * n, i = (y * W + x) * 4;
      img.data[i] = 214 * v; img.data[i + 1] = 178 * v; img.data[i + 2] = 128 * v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (let k = 0; k < 6; k++) { const x = r() * W, y = r() * H, rad = 6 + r() * 10; const grd = g.createRadialGradient(x, y, 0, x, y, rad * 2); grd.addColorStop(0, "rgba(70,40,15,0.85)"); grd.addColorStop(0.4, "rgba(110,70,30,0.5)"); grd.addColorStop(1, "rgba(110,70,30,0)"); g.fillStyle = grd; g.beginPath(); g.ellipse(x, y, rad * 2.2, rad, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "rgba(40,30,20,0.18)"; for (let k = 0; k < 40; k++) g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3);
    return texFrom(c, true, 1);
  });
}
/** Papelão ondulado: kraft com ondas, fita adesiva, setas e "FRÁGIL" impressos, manchas de umidade. */
export function cardboardTex(): THREE.CanvasTexture {
  return memo("cardboard", () => {
    const S = 512, [c, g] = canvas(S, S), r = rng(113);
    g.fillStyle = "#b8925f"; g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 4) { g.fillStyle = `rgba(90,60,30,${0.05 + 0.04 * Math.sin(x)})`; g.fillRect(x, 0, 2, S); }
    for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(${r() > 0.5 ? "60,40,20" : "230,210,170"},${0.06 + r() * 0.08})`; g.fillRect(r() * S, r() * S, 2 + r() * 4, 1 + r() * 2); }
    g.fillStyle = "rgba(205,180,120,0.75)"; g.fillRect(0, S * 0.46, S, 46); g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(0, S * 0.46 + 6, S, 6);
    g.fillStyle = "rgba(25,25,25,0.82)"; g.font = `900 46px ${SANS}`; g.fillText("FRÁGIL", 30, 120);
    g.save(); g.translate(400, 330); for (const dx of [0, 46]) { g.beginPath(); g.moveTo(dx, -40); g.lineTo(dx + 18, -10); g.lineTo(dx + 6, -10); g.lineTo(dx + 6, 30); g.lineTo(dx - 6, 30); g.lineTo(dx - 6, -10); g.lineTo(dx - 18, -10); g.closePath(); g.fill(); } g.restore();
    g.strokeStyle = "rgba(25,25,25,0.7)"; g.lineWidth = 3; g.strokeRect(30, 360, 200, 110); g.font = `700 18px ${SANS}`; g.fillText("PESO 18 kg", 46, 400); g.fillText("LOTE 0412", 46, 440);
    const wet = g.createRadialGradient(140, 470, 10, 140, 470, 160); wet.addColorStop(0, "rgba(60,40,20,0.35)"); wet.addColorStop(1, "rgba(60,40,20,0)"); g.fillStyle = wet; g.fillRect(0, 0, S, S);
    return texFrom(c, true, 1);
  });
}
/** Tecido manchado (colchão velho, estofado): matelassê em losangos, manchas de chuva e mofo. */
export function fabricTex(): THREE.CanvasTexture {
  return memo("fabric", () => {
    const S = 512, [c, g] = canvas(S, S), r = rng(114);
    g.fillStyle = "#e6dfcc"; g.fillRect(0, 0, S, S);
    g.strokeStyle = "rgba(120,105,80,0.45)"; g.lineWidth = 2;
    for (let k = -S; k < S * 2; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + S, S); g.stroke(); g.beginPath(); g.moveTo(k + S, 0); g.lineTo(k, S); g.stroke(); }
    for (let k = 0; k < 9; k++) { const x = r() * S, y = r() * S, rad = 30 + r() * 90; const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, `rgba(${90 + r() * 40},${70 + r() * 30},${30 + r() * 20},0.45)`); grd.addColorStop(0.8, "rgba(110,90,50,0.25)"); grd.addColorStop(1, "rgba(110,90,50,0)"); g.fillStyle = grd; g.fillRect(0, 0, S, S); }
    for (let k = 0; k < 200; k++) { g.fillStyle = `rgba(40,50,30,${0.1 + r() * 0.2})`; g.beginPath(); g.arc(r() * S, S - r() * S * 0.3, 1 + r() * 3, 0, Math.PI * 2); g.fill(); }
    return texFrom(c, true, 1);
  });
}
/** Mancha de luz radial (halo das lâmpadas e a poça de luz no chão), em escala de cinza. */
export function alleyGlow(): THREE.CanvasTexture {
  return memo("glow", () => {
    const S = 128, [c, g] = canvas(S, S), grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.25, "rgba(255,255,255,0.55)"); grd.addColorStop(0.6, "rgba(255,255,255,0.14)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    return texFrom(c, false, undefined, true);
  });
}
