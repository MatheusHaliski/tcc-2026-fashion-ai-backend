/*
 * MET Gala Heist v2 — base dos atlas da cidade: o retângulo de UV de cada célula da grade e os auxiliares de pintura no
 * canvas (cor, degradê vertical, brilho aditivo, retângulo, recorte e texto ajustado à largura).
 */
import { fitFont, spaced } from "./exterior-tex-type";

/** Retângulo de UV [u0, v0, u1, v1] da célula k numa grade cols × rows (linha 0 em cima; v do three cresce para cima). */
export function cellUV(k: number, cols: number, rows: number, inset = 0.004): [number, number, number, number] {
  const c = k % cols, r = Math.floor(k / cols);
  return [c / cols + inset / cols, 1 - (r + 1) / rows + inset / rows, (c + 1) / cols - inset / cols, 1 - r / rows - inset / rows];
}

/* ---------- auxiliares de pintura ---------- */
export type G = CanvasRenderingContext2D;
export const rgb = (r: number, g: number, b: number, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
export function vgrad(g: G, x: number, y: number, w: number, h: number, top: string, bottom: string) { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(x, y, w, h); }
export function glow(g: G, x: number, y: number, r: number, color: string, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, color); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.save(); g.globalAlpha = a; g.globalCompositeOperation = "lighter"; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}
export function box(g: G, x: number, y: number, w: number, h: number, c: string) { g.fillStyle = c; g.fillRect(x, y, w, h); }
export function clip(g: G, x: number, y: number, w: number, h: number, draw: () => void) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); draw(); g.restore(); }
export function text(g: G, s: string, x: number, y: number, w: number, size: number, family: string, color: string, weight = "600", spacing = 0) {
  g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle";
  fitFont(g, s, family, weight, size, w, spacing); spaced(g, s, x, y, spacing);
}
export const SCRIPT = "'Snell Roundhand', 'Brush Script MT', 'Segoe Script', 'URW Chancery L', 'DejaVu Serif', cursive";
