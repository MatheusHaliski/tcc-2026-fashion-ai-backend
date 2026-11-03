/*
 * MET Gala Heist v2 — beco (Z15): folhas de decalques — tipos (Rect01, Atlas), fontes e o desenho das células numa folha, mais os
 * traços de pichação (spray, névoa de tinta), bordas rasgadas e o papel dos cartazes.
 */
import * as THREE from "three";
import { memo, rng } from "./exterior-alley-tex-noise";
import { canvas, texFrom } from "./exterior-alley-tex-canvas";

/* ======================= folhas de decalques ======================= */
export interface Rect01 { u0: number; v0: number; u1: number; v1: number }
export interface Atlas { tex: THREE.CanvasTexture; rects: Record<string, Rect01> }
export const SANS = "'Helvetica Neue', Inter, Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif";
export const CONDENSED = "'Arial Narrow', 'Liberation Sans Narrow', 'DejaVu Sans Condensed', Impact, 'Helvetica Neue', Arial, sans-serif";
export const HANDS = "'Marker Felt', 'Bradley Hand', 'Segoe Print', 'Comic Sans MS', 'DejaVu Sans', cursive";
export const IMPACT = "Impact, 'Anton', 'Arial Black', 'DejaVu Sans', sans-serif";

/** Desenha células numa folha (coordenadas lógicas `LW × LH`, escaladas para a qualidade) e devolve os retângulos UV. */
export function atlas(key: string, LW: number, LH: number, scale: number, cells: [string, number, number, number, number, (g: CanvasRenderingContext2D, w: number, h: number) => void][]): Atlas {
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
export function sprayText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, outline: string, opt: { font?: string; skew?: number; drips?: number; seed?: number; glow?: string } = {}) {
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
export function overspray(g: CanvasRenderingContext2D, x: number, y: number, rad: number, color: string, seed: number, n = 160) {
  const r = rng(seed); g.save(); g.fillStyle = color;
  for (let k = 0; k < n; k++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad; g.globalAlpha = 0.08 + r() * 0.2; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.6 + r() * 1.6, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
/** Borda rasgada/irregular (reboco caído, cartaz rasgado): caminho com ruído no contorno de uma elipse. */
export function raggedBlob(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, seed: number, jag = 0.25, n = 64) {
  const r = rng(seed); g.beginPath();
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2, j = 1 - jag * (0.5 * r() + 0.5 * Math.abs(Math.sin(a * 3 + seed)));
    const x = cx + Math.cos(a) * rx * j, y = cy + Math.sin(a) * ry * j; k ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
}
/** Papel (cartaz, panfleto): fundo com fibra e amarelado. */
export function paperFill(g: CanvasRenderingContext2D, w: number, h: number, base: string, seed: number) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const r = rng(seed); g.save();
  for (let k = 0; k < (w * h) / 60; k++) { g.globalAlpha = 0.05 + r() * 0.06; g.fillStyle = r() > 0.5 ? "#000" : "#fff"; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
  const grd = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
  grd.addColorStop(0, "rgba(0,0,0,0)"); grd.addColorStop(1, "rgba(80,60,20,0.25)"); g.globalAlpha = 1; g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.restore();
}
