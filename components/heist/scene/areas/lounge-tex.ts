/*
 * MET Gala Heist v2 — texturas do lounge (Z05), todas geradas no navegador e guardadas por chave "lounge-…": parquet em
 * espinha de peixe (tábuas de 10 × 50 cm a 45°, verniz acetinado), damasco azul-petróleo em relevo (motivo de palmeta em
 * moldura ogival), tapetes persas (medalhão, cantoneiras, barra com cartelas, franja), espelho envelhecido (prata com
 * manchas e bordas oxidadas), ônix mel (veios em faixas, para o bar retroiluminado), caixotão laqueado do teto, rótulos
 * fictícios das garrafas (atlas), cardápio, partitura, capas de livros de arte, a pintura do lounge e o biombo de laca.
 * Nenhuma marca real: os nomes dos rótulos e livros são inventados.
 */
import * as THREE from "three";
import { drawnTexture, SANS, SERIF, fit, spaced, type Quality } from "../interior-tex";
import { FAKE, areaSurface, clamp01, fbm, hash2, mix, smooth, vnoise, type AreaSurface } from "./lounge-kit";
import type { LoungeCopy } from "./lounge-copy";

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

/* ======================= tapetes persas ======================= */
interface RugPal { field: string; field2: string; border: string; guard: string; ivory: string; gold: string; ink: string; accent: string }
const RUGS: Record<"a" | "b", RugPal> = {
  // Tabriz de campo vermelho com medalhão azul-marinho; Kashan de campo azul-noite com medalhão salmão
  a: { field: "#6f161b", field2: "#5a1015", border: "#132447", guard: "#d8c9a6", ivory: "#e9dcbd", gold: "#c2913f", ink: "#0e1830", accent: "#2f6a6a" },
  b: { field: "#13213d", field2: "#0e1a32", border: "#6b1a20", guard: "#d4c39b", ivory: "#e6d6b2", gold: "#b98a3a", ink: "#3a0c10", accent: "#c76b55" },
};
/** Tapete persa desenhado (urdidura na vertical): campo com arabescos, medalhão de 16 lóbulos, pingentes, cantoneiras,
 * barra principal com cartelas e rosetas, guardas e o desgaste (abrash e trama aparecendo). Proporção 2 : 3. */
export function rugTexture(kind: "a" | "b", q: Quality, aspect = 1.5): THREE.Texture {
  const W = q === "high" ? 768 : 384, H = Math.round(W * aspect), p = RUGS[kind];
  return drawnTexture(`lounge-rug-${kind}-${q}-${aspect}`, W, H, (g, w, h) => {
    const sc = w / 768;
    g.fillStyle = p.field; g.fillRect(0, 0, w, h);
    // abrash: faixas de tingimento ao longo da urdidura
    for (let k = 0; k < 9; k++) { g.fillStyle = k % 2 ? p.field2 : p.field; g.globalAlpha = 0.35; g.fillRect(0, (k / 9) * h, w, h / 9 * (0.6 + 0.4 * hash2(k, 1, 7))); }
    g.globalAlpha = 1;
    const bw = 92 * sc, gw = 18 * sc, inner = bw + gw * 2;
    // arabescos do campo: gavinhas e florzinhas em grade deslocada
    const fx0 = inner + 10 * sc, fy0 = inner + 10 * sc, fw = w - 2 * fx0, fh = h - 2 * fy0;
    const rows = Math.round(9 * aspect * 1.05);
    for (let yy = 0; yy < rows; yy++) for (let xx = 0; xx < 9; xx++) {
      const x = fx0 + (xx + (yy % 2) * 0.5) / 9 * fw, y = fy0 + yy / (rows - 1) * fh; if (x > fx0 + fw) continue;
      g.strokeStyle = p.gold; g.globalAlpha = 0.55; g.lineWidth = 2.2 * sc;
      g.beginPath(); g.moveTo(x - 22 * sc, y); g.bezierCurveTo(x - 10 * sc, y - 16 * sc, x + 10 * sc, y + 16 * sc, x + 22 * sc, y); g.stroke();
      g.globalAlpha = 1; g.fillStyle = (xx + yy) % 3 === 0 ? p.ivory : (xx + yy) % 3 === 1 ? p.accent : p.ink;
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * 5 * sc, y + Math.sin(a) * 5 * sc, 4.5 * sc, 2.2 * sc, a, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = p.gold; g.beginPath(); g.arc(x, y, 2.4 * sc, 0, Math.PI * 2); g.fill();
    }
    // medalhão central (16 lóbulos) com pingentes
    const cx = w / 2, cy = h / 2, R = w * (aspect > 1.2 ? 0.27 : 0.22), stretch = aspect > 1.2 ? 1.25 : 1;
    const lobed = (r: number, amp: number, lobes: number) => { g.beginPath(); for (let k = 0; k <= 360; k++) { const a = (k / 360) * Math.PI * 2, rr = r * (1 + amp * Math.abs(Math.cos(a * lobes / 2)) ** 0.6) ; const yy = cy + Math.sin(a) * rr * stretch, xx = cx + Math.cos(a) * rr; if (k) g.lineTo(xx, yy); else g.moveTo(xx, yy); } g.closePath(); };
    for (const s of [-1, 1]) { g.fillStyle = p.border; g.beginPath(); g.moveTo(cx - 34 * sc, cy + s * R * 1.18); g.lineTo(cx, cy + s * R * 1.62); g.lineTo(cx + 34 * sc, cy + s * R * 1.18); g.closePath(); g.fill(); g.fillStyle = p.ivory; g.beginPath(); g.arc(cx, cy + s * R * 1.62, 14 * sc, 0, Math.PI * 2); g.fill(); }
    lobed(R, 0.12, 16); g.fillStyle = p.border; g.fill(); g.lineWidth = 5 * sc; g.strokeStyle = p.gold; g.stroke();
    lobed(R * 0.78, 0.1, 16); g.fillStyle = p.ivory; g.fill();
    lobed(R * 0.6, 0.14, 8); g.fillStyle = p.field; g.fill(); g.lineWidth = 3 * sc; g.strokeStyle = p.ink; g.stroke();
    lobed(R * 0.3, 0.2, 8); g.fillStyle = p.border; g.fill();
    g.fillStyle = p.gold; g.beginPath(); g.arc(cx, cy, R * 0.1, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; g.fillStyle = k % 2 ? p.accent : p.field; g.beginPath(); g.ellipse(cx + Math.cos(a) * R * 0.69, cy + Math.sin(a) * R * 0.69 * stretch, 9 * sc, 4.5 * sc, a, 0, Math.PI * 2); g.fill(); }
    // cantoneiras (quartos de medalhão)
    for (const [x, y] of [[fx0, fy0], [fx0 + fw, fy0], [fx0, fy0 + fh], [fx0 + fw, fy0 + fh]]) {
      g.save(); g.beginPath(); g.rect(fx0 - 10 * sc, fy0 - 10 * sc, fw + 20 * sc, fh + 20 * sc); g.clip();
      g.fillStyle = p.border; g.beginPath(); g.ellipse(x, y, R * 0.62, R * 0.78, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = p.gold; g.lineWidth = 4 * sc; g.stroke();
      g.fillStyle = p.ivory; g.beginPath(); g.ellipse(x, y, R * 0.36, R * 0.46, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    // guardas e barra principal
    const band = (o: number, ww: number, col: string) => { g.fillStyle = col; g.fillRect(o, o, w - 2 * o, ww); g.fillRect(o, h - o - ww, w - 2 * o, ww); g.fillRect(o, o, ww, h - 2 * o); g.fillRect(w - o - ww, o, ww, h - 2 * o); };
    band(0, gw, p.guard); band(gw, bw, p.border); band(gw + bw, gw, p.guard);
    // reciprocal (dentes) nas guardas
    g.fillStyle = p.ink;
    for (const o of [0, gw + bw]) {
      for (let x = o; x < w - o; x += 14 * sc) { g.beginPath(); g.moveTo(x, o + gw * 0.2); g.lineTo(x + 7 * sc, o + gw * 0.8); g.lineTo(x + 14 * sc, o + gw * 0.2); g.fill(); g.beginPath(); g.moveTo(x, h - o - gw * 0.2); g.lineTo(x + 7 * sc, h - o - gw * 0.8); g.lineTo(x + 14 * sc, h - o - gw * 0.2); g.fill(); }
      for (let y = o; y < h - o; y += 14 * sc) { g.beginPath(); g.moveTo(o + gw * 0.2, y); g.lineTo(o + gw * 0.8, y + 7 * sc); g.lineTo(o + gw * 0.2, y + 14 * sc); g.fill(); g.beginPath(); g.moveTo(w - o - gw * 0.2, y); g.lineTo(w - o - gw * 0.8, y + 7 * sc); g.lineTo(w - o - gw * 0.2, y + 14 * sc); g.fill(); }
    }
    // cartelas e rosetas na barra principal
    const mid = gw + bw / 2;
    const cart = (x: number, y: number, rot: number, k: number) => {
      g.save(); g.translate(x, y); g.rotate(rot);
      if (k % 2) { g.fillStyle = p.field; g.beginPath(); g.ellipse(0, 0, 34 * sc, 22 * sc, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = p.gold; g.lineWidth = 3 * sc; g.stroke(); g.fillStyle = p.ivory; g.beginPath(); g.ellipse(0, 0, 16 * sc, 9 * sc, 0, 0, Math.PI * 2); g.fill(); }
      else { g.fillStyle = p.ivory; for (let j = 0; j < 8; j++) { const a = (j / 8) * Math.PI * 2; g.beginPath(); g.ellipse(Math.cos(a) * 12 * sc, Math.sin(a) * 12 * sc, 10 * sc, 5 * sc, a, 0, Math.PI * 2); g.fill(); } g.fillStyle = p.gold; g.beginPath(); g.arc(0, 0, 7 * sc, 0, Math.PI * 2); g.fill(); }
      g.restore();
    };
    let k = 0; for (let x = gw + bw + 40 * sc; x < w - gw - bw - 20 * sc; x += 78 * sc) { cart(x, mid, 0, k); cart(x, h - mid, 0, k++); }
    k = 1; for (let y = gw + bw + 50 * sc; y < h - gw - bw - 20 * sc; y += 82 * sc) { cart(mid, y, Math.PI / 2, k); cart(w - mid, y, Math.PI / 2, k++); }
    // desgaste: lã gasta (trama clara aparecendo) nas passagens e a textura do nó
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const kk = (y * w + x) * 4, knot = ((x >> 1) + (y >> 1)) % 2 ? 0.96 : 1.03, wear = smooth(0.62, 0.86, fbm(x / w, y / h, 5, 77, 4)) * 0.35, sp = hash2(x, y, 5) * 0.08;
      for (let c = 0; c < 3; c++) d[kk + c] = Math.min(255, (d[kk + c] * knot * (1 - sp)) * (1 - wear) + 190 * wear * (c === 0 ? 0.95 : c === 1 ? 0.86 : 0.7));
    }
    g.putImageData(img, 0, 0);
  });
}
/** Franja de lã (fios com nó, transparência por recorte): faixa de 1 × 0,1 m que repete ao longo da ponta do tapete. */
export function fringeTexture(): THREE.Texture {
  const t = drawnTexture("lounge-fringe", 256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let x = 1; x < w; x += 3) {
      const len = h * (0.78 + 0.22 * hash2(x, 3, 1)), sway = (hash2(x, 5, 2) - 0.5) * 3, c = 205 + Math.floor(hash2(x, 7, 3) * 35);
      g.strokeStyle = `rgb(${c},${c - 14},${c - 40})`; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + sway, len * 0.5, x + sway * 1.6, len); g.stroke();
    }
    g.fillStyle = "rgb(214,200,168)"; g.fillRect(0, 0, w, h * 0.16);
    for (let x = 0; x < w; x += 12) { g.fillStyle = "rgb(190,174,140)"; g.beginPath(); g.ellipse(x + 6, h * 0.18, 5, 3, 0, 0, Math.PI * 2); g.fill(); }
  });
  t.wrapS = THREE.RepeatWrapping; return t;
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

/* ======================= rótulos e papéis ======================= */
/** Rótulos fictícios (atlas 8 × 2 de 128 × 256 px): nome da marca inventada (não muda de idioma), fundo e tinta; a
 *  descrição vem de lounge-copy.ts (labelSubs, na mesma ordem). */
export const LABELS = [
  ["VESPER", "#1d1208", "#d9b46a"], ["LUMIÈRE", "#f2efe6", "#1d3b52"], ["NOIR 1957", "#120c0a", "#c9a25a"], ["CELESTE", "#1f3a5c", "#e8d8b0"],
  ["CAIRN 18", "#e9dfc6", "#5a2a16"], ["ROSSO", "#7a1420", "#f1e2c4"], ["FÉE VERTE", "#0f3a24", "#e6e0b8"], ["SOMBRA", "#d8d2c2", "#262220"],
  ["AURORA", "#f0e6cc", "#7a4a12"], ["ROSA", "#f1d6db", "#6a1f33"], ["PORTO 1963", "#2a0d10", "#d8b56c"], ["FINO", "#efe7cf", "#3b5a2a"],
  ["MARQUISE", "#0e0e10", "#d6b46a"], ["ORCHIDÉE", "#3a2550", "#e8dcf0"], ["BERGAMOTA", "#f2e8b8", "#305a3a"], ["NUIT", "#1a1410", "#e0c48a"],
] as const;
export function labelAtlas(T: LoungeCopy): THREE.Texture {
  return drawnTexture(`lounge-labels-${T.menuSub}`, 1024, 512, (g, w, h) => {
    const cw = w / 8, ch = h / 2;
    LABELS.forEach(([name, bg, ink], k) => {
      const sub = T.labelSubs[k] ?? "";
      const x = (k % 8) * cw, y = Math.floor(k / 8) * ch;
      g.fillStyle = bg; g.fillRect(x, y, cw, ch);
      g.strokeStyle = ink; g.lineWidth = 3; g.strokeRect(x + 8, y + 10, cw - 16, ch - 20); g.lineWidth = 1; g.strokeRect(x + 13, y + 15, cw - 26, ch - 30);
      g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle";
      g.beginPath(); g.arc(x + cw / 2, y + ch * 0.27, 20, 0, Math.PI * 2); g.lineWidth = 2; g.stroke();
      g.font = `600 18px ${SERIF}`; g.fillText(name.slice(0, 1), x + cw / 2, y + ch * 0.27 + 1);
      fit(g, name, (p) => `700 ${p}px ${SERIF}`, 24, cw - 28); g.fillText(name, x + cw / 2, y + ch * 0.5);
      g.font = `italic 400 12px ${SERIF}`; g.fillText(sub, x + cw / 2, y + ch * 0.62);
      g.font = `400 10px ${SANS}`; g.fillText(T.labelFoot.replace("{abv}", String(40 + (k % 5))), x + cw / 2, y + ch * 0.82);
      g.fillRect(x + cw * 0.3, y + ch * 0.7, cw * 0.4, 1.5);
    });
  });
}
/** Cardápio de coquetéis do Bar Lumière (dobrado em tenda sobre o balcão). */
export function menuTexture(T: LoungeCopy): THREE.Texture {
  return drawnTexture(`lounge-menu-${T.menuSub}`, 256, 384, (g, w, h) => {
    g.fillStyle = "#efe6d2"; g.fillRect(0, 0, w, h); g.strokeStyle = "#a9853f"; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = "#2a1d10"; g.textAlign = "center"; g.font = `600 22px ${SERIF}`; spaced(g, T.menuTitle.toUpperCase(), w / 2, 46, 3);
    g.font = `italic 400 13px ${SERIF}`; g.fillText(T.menuSub, w / 2, 68);
    T.cocktails.forEach((r, k) => { g.font = `500 15px ${SERIF}`; g.textAlign = "left"; g.fillText(r, 26, 106 + k * 42); g.textAlign = "right"; g.fillText(String(38 + k * 4), w - 26, 106 + k * 42); g.font = `400 10px ${SANS}`; g.textAlign = "left"; g.fillStyle = "#6a5a40"; g.fillText(T.ingredients, 26, 122 + k * 42); g.fillStyle = "#2a1d10"; });
  });
}
/** Partitura aberta na estante do piano. */
export function scoreTexture(T: LoungeCopy): THREE.Texture {
  return drawnTexture(`lounge-score-${T.score}`, 512, 360, (g, w, h) => {
    g.fillStyle = "#efe8d6"; g.fillRect(0, 0, w, h); g.fillStyle = "#d8cfba"; g.fillRect(w / 2 - 2, 0, 4, h);
    g.strokeStyle = "#222"; g.fillStyle = "#222";
    for (const x0 of [16, w / 2 + 14]) for (let s = 0; s < 6; s++) {
      const y0 = 40 + s * 52; g.lineWidth = 1; for (let l = 0; l < 5; l++) { g.beginPath(); g.moveTo(x0, y0 + l * 6); g.lineTo(x0 + w / 2 - 30, y0 + l * 6); g.stroke(); }
      for (let k = 0; k < 12; k++) { const x = x0 + 20 + k * 18, y = y0 + 3 + hash2(k, s, 3) * 24; g.beginPath(); g.ellipse(x, y, 3.6, 2.6, -0.4, 0, Math.PI * 2); g.fill(); g.fillRect(x + 3, y - 18, 1.2, 18); }
    }
    g.font = `italic 600 16px ${SERIF}`; g.textAlign = "center"; g.fillText(T.score, w / 4, 22);
  });
}
/** Capas de livros de arte (atlas 4 × 1): fundo e tinta; os títulos (inventados) vêm de lounge-copy.ts. */
export const BOOKS = [["#1b1b1d", "#d8b46a"], ["#e8e1d2", "#7a1a20"], ["#3a2a1a", "#efe2c4"], ["#14303a", "#e6d6a8"]] as const;
export function bookAtlas(T: LoungeCopy): THREE.Texture {
  return drawnTexture(`lounge-books-${T.books[0]}`, 1024, 256, (g, w, h) => {
    const cw = w / 4;
    BOOKS.forEach(([bg, ink], k) => {
      const t = T.books[k];
      const x = k * cw; g.fillStyle = bg; g.fillRect(x, 0, cw, h);
      g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle";
      fit(g, t, (p) => `600 ${p}px ${SERIF}`, 26, cw - 30); g.fillText(t, x + cw / 2, h * 0.3);
      g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); g.moveTo(x + cw * 0.25, h * 0.42); g.lineTo(x + cw * 0.75, h * 0.42); g.stroke();
      // ilustração: silhueta de vestido / arco / coluna
      g.globalAlpha = 0.85; g.beginPath(); g.moveTo(x + cw / 2, h * 0.5); g.quadraticCurveTo(x + cw * 0.62, h * 0.7, x + cw * 0.7, h * 0.92); g.lineTo(x + cw * 0.3, h * 0.92); g.quadraticCurveTo(x + cw * 0.38, h * 0.7, x + cw / 2, h * 0.5); g.fill(); g.globalAlpha = 1;
    });
  });
}
/** A pintura do lounge: noturno do porto com lampiões refletidos na água (óleo fictício, pinceladas em camadas). */
export function paintingTexture(): THREE.Texture {
  return drawnTexture("lounge-painting", 768, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.6); sky.addColorStop(0, "#0d1622"); sky.addColorStop(0.7, "#23354a"); sky.addColorStop(1, "#6a5a48"); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const sea = g.createLinearGradient(0, h * 0.58, 0, h); sea.addColorStop(0, "#1b2a36"); sea.addColorStop(1, "#070b10"); g.fillStyle = sea; g.fillRect(0, h * 0.58, w, h * 0.42);
    // casario e cais
    for (let k = 0; k < 26; k++) { const x = k * w / 26, bh = h * (0.08 + hash2(k, 1, 3) * 0.16); g.fillStyle = `rgb(${20 + k % 4 * 4},${22 + k % 3 * 4},${28 + k % 5 * 3})`; g.fillRect(x, h * 0.58 - bh, w / 26 + 1, bh); if (hash2(k, 2, 3) > 0.4) { g.fillStyle = "#f1c06a"; g.fillRect(x + 6, h * 0.58 - bh * 0.6, 4, 6); } }
    // lampiões e reflexos em pinceladas
    for (let k = 0; k < 9; k++) {
      const x = w * (0.08 + k * 0.105), y = h * 0.54;
      const gl = g.createRadialGradient(x, y, 1, x, y, 26); gl.addColorStop(0, "rgba(255,214,140,0.95)"); gl.addColorStop(1, "rgba(255,180,90,0)"); g.fillStyle = gl; g.fillRect(x - 26, y - 26, 52, 52);
      for (let s = 0; s < 14; s++) { g.fillStyle = `rgba(255,${190 + s * 3},120,${0.5 - s * 0.03})`; g.fillRect(x - 6 + Math.sin(s * 1.7) * 6, h * 0.6 + s * 12, 12 - s * 0.5, 3); }
    }
    // textura da tinta: pinceladas diagonais
    g.globalAlpha = 0.08; for (let k = 0; k < 900; k++) { const x = hash2(k, 5, 1) * w, y = hash2(k, 6, 1) * h; g.strokeStyle = hash2(k, 7, 1) > 0.5 ? "#ffffff" : "#000000"; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y - 4); g.stroke(); }
    g.globalAlpha = 1;
  });
}
/** Biombo de laca negra com garças e ramos em folha de ouro (três folhas lado a lado). */
export function screenTexture(): THREE.Texture {
  return drawnTexture("lounge-screen", 1024, 640, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#14100c"); bg.addColorStop(1, "#060505"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#b8924a"; g.lineWidth = 6; for (let k = 0; k < 3; k++) g.strokeRect(k * w / 3 + 14, 14, w / 3 - 28, h - 28);
    // ramos dourados atravessando as três folhas
    g.strokeStyle = "#c9a14f"; g.lineCap = "round";
    for (let b = 0; b < 3; b++) { g.lineWidth = 7 - b * 2; g.beginPath(); g.moveTo(0, h * (0.75 - b * 0.18)); g.bezierCurveTo(w * 0.3, h * (0.55 - b * 0.1), w * 0.6, h * (0.8 - b * 0.2), w, h * (0.45 - b * 0.08)); g.stroke(); }
    g.fillStyle = "#d8b46a";
    for (let k = 0; k < 70; k++) { const x = hash2(k, 1, 4) * w, y = h * (0.25 + hash2(k, 2, 4) * 0.55); g.beginPath(); g.ellipse(x, y, 9, 4, hash2(k, 3, 4) * 3, 0, Math.PI * 2); g.fill(); }
    // garças em voo
    g.fillStyle = "#efe2c0";
    for (const [x, y, s] of [[0.2, 0.3, 1], [0.55, 0.2, 0.8], [0.8, 0.35, 0.9]] as [number, number, number][]) {
      g.save(); g.translate(x * w, y * h); g.scale(s, s);
      g.beginPath(); g.moveTo(-60, 0); g.quadraticCurveTo(-20, -40, 0, -6); g.quadraticCurveTo(20, -44, 64, -4); g.quadraticCurveTo(20, -10, 6, 8); g.quadraticCurveTo(-4, 14, -60, 0); g.fill();
      g.beginPath(); g.moveTo(4, 6); g.quadraticCurveTo(16, 18, 34, 22); g.lineTo(30, 26); g.quadraticCurveTo(12, 22, 0, 10); g.fill();
      g.restore();
    }
  });
}
