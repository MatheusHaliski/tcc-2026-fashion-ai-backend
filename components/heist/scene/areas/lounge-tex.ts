/*
 * MET Gala Heist v2 — texturas do lounge (Z05), todas geradas no navegador e guardadas por chave "lounge-…": parquet em
 * espinha de peixe (tábuas de 10 × 50 cm a 45°, verniz acetinado), damasco azul-petróleo em relevo (motivo de palmeta em
 * moldura ogival), tapetes persas (medalhão, cantoneiras, barra com cartelas, franja), espelho envelhecido (prata com
 * manchas e bordas oxidadas), ônix mel (veios em faixas, para o bar retroiluminado), caixotão laqueado do teto, rótulos
 * fictícios das garrafas (atlas), cardápio, partitura, capas de livros de arte, a pintura do lounge e o biombo de laca.
 * Nenhuma marca real: os nomes dos rótulos e livros são inventados.
 */
import * as THREE from "three";
import { drawnTexture, type Quality } from "../interior-tex";
import { FAKE, areaSurface, clamp01, fbm, hash2, mix, smooth, vnoise, type AreaSurface } from "./lounge-kit";
export { rugTexture, fringeTexture } from "./lounge-tex-tapetes";
export { LABELS, labelAtlas, menuTexture, scoreTexture, BOOKS, bookAtlas, paintingTexture, screenTexture } from "./lounge-tex-papeis";

/* ======================= parquet em espinha de peixe ======================= */
/** Tábua de 10 cm × 50 cm (n = 5), a 45°: a textura repete a cada 1,414 m (40 tábuas). */
export const PARQUET_TILE = 2 * Math.SQRT2 * 5 * 0.1;
export function parquetSurface(q: Quality): AreaSurface {
  const n = 5, W = 0.1, T = PARQUET_TILE, mod = (a: number, m: number) => ((a % m) + m) % m;
  return areaSurface(`lounge-parquet-${q}`, q === "high" ? 1024 : 512, (u, v, o) => {
    // ponto do mundo (m) → referencial das tábuas (unidades de largura), girado 45°
    const X = u * T, Y = v * T, x = (X + Y) / Math.SQRT2 / W, y = (Y - X) / Math.SQRT2 / W;
    const i = Math.floor(x), j = Math.floor(y), m = mod(i + j, 2 * n);
    let s: number, t: number, id: number;
    if (m < n) { const i0 = i - m; s = x - i0; t = y - j; id = 1 + mod((i0 + j) / (2 * n), 2) * 40 + mod(i0 - j, 20) * 2; }
    else { const j0 = j - (m - n); s = y - j0; t = x - i; id = 2 + mod((i + j0 - n) / (2 * n), 2) * 40 + mod(i - j0, 20) * 2; }
    const tone = hash2(id, 7, 3), tone2 = hash2(id, 11, 5), off = hash2(id, 13, 9) * 40;
    // veio ao longo da tábua (linhas paralelas ao comprimento, onduladas) e poros finos
    const warp = vnoise((s + off) * 0.9, t * 1.5, 1e6, 17) * 1.4 + vnoise((s + off) * 3.1, t * 3, 1e6, 19) * 0.35;
    const ring = Math.sin((t * (5 + tone2 * 4) + warp) * Math.PI * 2) * 0.5 + 0.5;
    const pore = vnoise((s + off) * 26, t * 90, 1e6, 23);
    const fleck = smooth(0.82, 0.95, vnoise((s + off) * 6, t * 12, 1e6, 29));
    const base = mix(0.27, 0.42, tone) * (0.86 + 0.14 * ring) * (0.95 + 0.05 * pore) * (1 - 0.08 * fleck);
    let r = base * 1.0, g = base * 0.64, b = base * 0.38;
    // juntas: 1,5 mm escuras, com microchanfro (a borda da tábua desce)
    const e = Math.min(t, 1 - t, s / n * 5, (n - s) / n * 5), seam = e < 0.018, bev = smooth(0.018, 0.06, e);
    if (seam) { r *= 0.28; g *= 0.26; b *= 0.24; }
    else { const k = 0.8 + 0.2 * bev; r *= k; g *= k; b *= k; }
    o[0] = r; o[1] = g; o[2] = b;
    o[3] = seam ? 0.18 : 0.42 + 0.08 * bev + 0.04 * ring + 0.03 * (tone - 0.5);
    o[4] = seam ? 0.85 : 0.26 + 0.1 * (1 - ring) + 0.12 * fbm(u, v, 6, 31, 3);
  }, 1.4);
}

/* ======================= damasco azul-petróleo ======================= */
/** Palmeta do damasco (metade direita; o desenho espelha): folha central, volutas, coroa, haste e pérolas. */
function damaskMotif(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  for (const k of [1, -1]) {
    g.save(); g.translate(cx, cy); g.scale(k, 1);
    g.beginPath(); g.moveTo(0, -0.78 * s); g.bezierCurveTo(0.2 * s, -0.5 * s, 0.22 * s, -0.05 * s, 0, 0.36 * s); g.lineTo(0, -0.78 * s); g.fill();
    g.globalCompositeOperation = "destination-out";
    g.beginPath(); g.moveTo(0, -0.5 * s); g.bezierCurveTo(0.09 * s, -0.32 * s, 0.1 * s, -0.08 * s, 0, 0.12 * s); g.lineTo(0, -0.5 * s); g.fill();
    g.globalCompositeOperation = "source-over";
    g.beginPath(); g.moveTo(0, -0.38 * s); g.bezierCurveTo(0.035 * s, -0.25 * s, 0.035 * s, -0.12 * s, 0, -0.02 * s); g.lineTo(0, -0.38 * s); g.fill();
    // voluta em C com a ponta enrolada
    g.lineWidth = 0.055 * s; g.lineCap = "round";
    g.beginPath(); g.moveTo(0.04 * s, 0.3 * s); g.bezierCurveTo(0.55 * s, 0.22 * s, 0.6 * s, -0.32 * s, 0.34 * s, -0.36 * s); g.bezierCurveTo(0.22 * s, -0.38 * s, 0.2 * s, -0.24 * s, 0.3 * s, -0.22 * s); g.stroke();
    g.beginPath(); g.arc(0.3 * s, -0.22 * s, 0.045 * s, 0, Math.PI * 2); g.fill();
    // folhas da voluta (acanto estilizado)
    for (const [a, r0] of [[-0.6, 0.42], [0.2, 0.5], [0.9, 0.42]] as [number, number][]) {
      const px = 0.3 * s + Math.cos(a) * r0 * s * 0.5, py = -0.05 * s + Math.sin(a) * r0 * s * 0.5;
      g.save(); g.translate(px, py); g.rotate(a + 0.6);
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(0.08 * s, -0.04 * s, 0.16 * s, 0, 0.2 * s, 0.05 * s); g.bezierCurveTo(0.12 * s, 0.06 * s, 0.05 * s, 0.05 * s, 0, 0); g.fill(); g.restore();
    }
    // coroa: três folhas sobre a ponta
    g.beginPath(); g.moveTo(0, -0.84 * s); g.bezierCurveTo(0.05 * s, -0.95 * s, 0.03 * s, -1.02 * s, 0, -1.08 * s); g.bezierCurveTo(-0.01 * s, -1.0 * s, -0.01 * s, -0.9 * s, 0, -0.84 * s); g.fill();
    g.beginPath(); g.moveTo(0.02 * s, -0.82 * s); g.bezierCurveTo(0.14 * s, -0.88 * s, 0.2 * s, -0.98 * s, 0.24 * s, -1.0 * s); g.bezierCurveTo(0.16 * s, -0.86 * s, 0.1 * s, -0.8 * s, 0.02 * s, -0.8 * s); g.fill();
    // haste e folhas caídas
    g.lineWidth = 0.035 * s; g.beginPath(); g.moveTo(0, 0.34 * s); g.lineTo(0, 0.66 * s); g.stroke();
    g.beginPath(); g.moveTo(0, 0.46 * s); g.bezierCurveTo(0.18 * s, 0.42 * s, 0.32 * s, 0.56 * s, 0.36 * s, 0.7 * s); g.bezierCurveTo(0.24 * s, 0.6 * s, 0.12 * s, 0.56 * s, 0, 0.52 * s); g.fill();
    // pérolas ao longo da voluta
    for (let k2 = 0; k2 < 5; k2++) { const a = -1.1 + k2 * 0.42; g.beginPath(); g.arc(0.3 * s + Math.cos(a) * 0.36 * s, -0.02 * s + Math.sin(a) * 0.36 * s, 0.018 * s, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
}
/** Florzinha de quatro pétalas (o motivo menor entre as palmetas). */
function rosette(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  for (let k = 0; k < 4; k++) { g.save(); g.translate(cx, cy); g.rotate(k * Math.PI / 2); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(0.12 * s, -0.08 * s, 0.12 * s, -0.3 * s, 0, -0.36 * s); g.bezierCurveTo(-0.12 * s, -0.3 * s, -0.12 * s, -0.08 * s, 0, 0); g.fill(); g.restore(); }
  g.beginPath(); g.arc(cx, cy, 0.07 * s, 0, Math.PI * 2); g.fill();
}
/** Máscara do damasco (branco = desenho) num quadrado de lado n que repete sem emenda: palmetas em meia-gota e ogivas. */
function damaskMask(n: number): Float32Array {
  const out = new Float32Array(n * n); if (FAKE) return out;
  const c = document.createElement("canvas"); c.width = n; c.height = n; const g = c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
  g.fillStyle = "#000"; g.fillRect(0, 0, n, n); g.fillStyle = "#fff"; g.strokeStyle = "#fff";
  const s = n * 0.2;
  for (const [cx, cy] of [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]]) damaskMotif(g, cx * n, cy * n + s * 0.12, s);
  for (const [cx, cy] of [[0.5, 0], [0.5, 1], [0, 0.5], [1, 0.5]]) rosette(g, cx * n, cy * n, s * 0.38);
  // ogivas: contornos em S que envolvem cada palmeta e se tocam nas florzinhas
  g.lineWidth = n * 0.009;
  for (const [cx, cy] of [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]]) {
    const x = cx * n, y = cy * n, hw = n * 0.5, hh = n * 0.5;
    g.beginPath(); g.moveTo(x, y - hh * 0.86);
    g.bezierCurveTo(x + hw * 0.1, y - hh * 0.6, x + hw * 0.72, y - hh * 0.42, x + hw * 0.78, y);
    g.bezierCurveTo(x + hw * 0.72, y + hh * 0.42, x + hw * 0.1, y + hh * 0.6, x, y + hh * 0.86);
    g.bezierCurveTo(x - hw * 0.1, y + hh * 0.6, x - hw * 0.72, y + hh * 0.42, x - hw * 0.78, y);
    g.bezierCurveTo(x - hw * 0.72, y - hh * 0.42, x - hw * 0.1, y - hh * 0.6, x, y - hh * 0.86); g.stroke();
  }
  const d = g.getImageData(0, 0, n, n).data;
  for (let k = 0; k < n * n; k++) out[k] = d[k * 4] / 255;
  // borda macia do relevo (o desenho é flocado, não recortado): duas passadas de média 3×3 com volta
  for (let pass = 0; pass < 2; pass++) {
    const src = out.slice();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let sum = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += src[((y + dy + n) % n) * n + ((x + dx + n) % n)];
      out[y * n + x] = sum / 9;
    }
  }
  return out;
}
/** Damasco de seda azul-petróleo: fundo fosco, desenho acetinado em leve relevo e fios dourados raros. Repete a cada 0,64 m. */
export const DAMASK_TILE = 0.64;
export function damaskSurface(q: Quality): AreaSurface {
  const n = q === "high" ? 512 : 256, mask = damaskMask(FAKE ? 8 : n), N = FAKE ? 8 : n;
  return areaSurface(`lounge-damask-${q}`, n, (u, v, o) => {
    const x = Math.min(N - 1, Math.floor(u * N)), y = Math.min(N - 1, Math.floor(v * N)), d = mask[y * N + x];
    const weave = Math.sin(u * N * Math.PI * 1.5) * Math.sin(v * N * Math.PI * 0.5), fib = vnoise(u * 300, v * 300, 300, 41), n0 = fbm(u, v, 4, 43, 3);
    const t = 0.88 + 0.07 * weave * (1 - d) + 0.08 * fib + 0.06 * (n0 - 0.5);
    o[0] = mix(0.07, 0.15, d) * t; o[1] = mix(0.22, 0.36, d) * t; o[2] = mix(0.24, 0.37, d) * t;
    o[3] = 0.42 + 0.2 * d + 0.03 * fib; o[4] = mix(0.86, 0.42, d) + 0.06 * (fib - 0.5);
  }, 1.1);
}

/* ======================= espelho envelhecido ======================= */
/** Prata com manchas: nuvens de oxidação, pontos de mofo (foxing), borda que perdeu o estanho e riscos finos. */
export function agedMirrorTexture(q: Quality): THREE.Texture {
  const n = q === "high" ? 512 : 256;
  const t = drawnTexture(`lounge-agedMirror-${q}`, n, n, (g, w, h) => {
    const img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h, e = Math.min(u, 1 - u, v, 1 - v);
      const cloud = smooth(0.48, 0.78, fbm(u, v, 4, 501, 5)), edge = smooth(0.11, 0.0, e + (fbm(u, v, 10, 503, 3) - 0.5) * 0.08);
      const fox = smooth(0.8, 0.9, fbm(u, v, 24, 505, 2)) * smooth(0.4, 0.7, fbm(u, v, 3, 507, 2));
      const k = clamp01(1 - 0.45 * cloud - 0.75 * edge - 0.6 * fox);
      const kk = (y * w + x) * 4;
      d[kk] = 40 + 200 * k * (1 - 0.06 * cloud); d[kk + 1] = 38 + 196 * k * (1 - 0.1 * cloud); d[kk + 2] = 34 + 186 * k * (1 - 0.18 * cloud); d[kk + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = "rgba(255,255,255,0.08)"; g.lineWidth = 1;
    for (let k = 0; k < 40; k++) { const x = hash2(k, 1, 9) * w, y = hash2(k, 2, 9) * h, a = hash2(k, 3, 9) * Math.PI, l = 10 + hash2(k, 4, 9) * 60; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  });
  return t;
}

/* ======================= ônix mel ======================= */
/** Ônix em faixas (mel, creme, âmbar), com veios brancos: textura do bar, que acende por trás. Repete sem emenda. */
export function onyxSurface(q: Quality): AreaSurface {
  return areaSurface(`lounge-onyx-${q}`, q === "high" ? 1024 : 512, (u, v, o) => {
    // faixas largas e onduladas (o ônix mel corta em camadas de 2–8 cm), estrias finas e nuvens mais escuras
    const w1 = fbm(u, v, 2, 601, 5), w2 = fbm(u + 0.31, v, 2, 603, 4);
    const t = (v * 2 + w1 * 1.7 + Math.sin((u + w2) * Math.PI * 2) * 0.22) * 2.5;
    const band = Math.sin(t * Math.PI) * 0.5 + 0.5, fine = Math.sin(t * Math.PI * 9 + w2 * 6) * 0.5 + 0.5;
    const vein = 1 - smooth(0.0, 0.03, Math.abs(fbm(u, v, 3, 607, 4) - 0.5));
    const cloud = fbm(u, v, 4, 609, 3);
    let r = mix(0.78, 0.99, band) * (0.95 + 0.05 * fine), g = mix(0.5, 0.86, band) * (0.94 + 0.06 * fine), b = mix(0.22, 0.62, band * band) * (0.92 + 0.08 * fine);
    const dark = smooth(0.6, 0.82, cloud); r *= 1 - 0.28 * dark; g *= 1 - 0.36 * dark; b *= 1 - 0.45 * dark;
    r = mix(r, 1, vein * 0.8); g = mix(g, 0.97, vein * 0.8); b = mix(b, 0.9, vein * 0.8);
    o[0] = r; o[1] = g; o[2] = b; o[3] = 0.5 + 0.02 * fine; o[4] = 0.06 + 0.05 * cloud;
  }, 0.3);
}

/* ======================= teto ======================= */
/** Caixotão laqueado (azul-noite quase preto) com filete de folha de ouro, canto em leque e um sol raiado no centro. */
export function cofferTexture(): THREE.Texture {
  return drawnTexture("lounge-coffer", 512, 512, (g, w, h) => {
    const bg = g.createRadialGradient(w / 2, h / 2, w * 0.05, w / 2, h / 2, w * 0.7); bg.addColorStop(0, "#1b2229"); bg.addColorStop(1, "#090c10"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#b8924a"; g.lineWidth = 6; g.strokeRect(26, 26, w - 52, h - 52); g.lineWidth = 2; g.strokeRect(40, 40, w - 80, h - 80);
    g.fillStyle = "#a9853f";
    for (const [x, y, a] of [[40, 40, 0], [w - 40, 40, Math.PI / 2], [w - 40, h - 40, Math.PI], [40, h - 40, -Math.PI / 2]] as [number, number, number][]) {
      g.save(); g.translate(x, y); g.rotate(a); for (let k = 0; k < 7; k++) { const b = (k / 6) * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(b - 0.05) * 54, Math.sin(b - 0.05) * 54); g.lineTo(Math.cos(b + 0.05) * 54, Math.sin(b + 0.05) * 54); g.fill(); } g.restore();
    }
    g.save(); g.translate(w / 2, h / 2); g.strokeStyle = "rgba(184,146,74,0.75)"; g.lineWidth = 2;
    for (let k = 0; k < 32; k++) { const a = (k / 32) * Math.PI * 2, r0 = 30, r1 = k % 2 ? 78 : 104; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke(); }
    g.beginPath(); g.arc(0, 0, 28, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, 112, 0, Math.PI * 2); g.stroke(); g.restore();
  });
}

