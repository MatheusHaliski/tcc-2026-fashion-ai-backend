/*
 * MET Gala Heist v2 — texturas desenhadas do interior (interior-tex.ts): o canvas 2D desenhado uma vez por chave
 * (cartazes, placas, telas) e os utilitários de desenho que os textos diegéticos compartilham — fontes, texto espaçado,
 * ajuste de fonte à largura, símbolos da vitrine em vetor, silhueta de vestido de gala e o ruído de papel.
 */
import * as THREE from "three";
import { fbm, hash2 } from "./interior-tex-noise";
import { FAKE, canvas } from "./interior-tex-surface";

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
