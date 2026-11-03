/*
 * MET Gala Heist v2 — rosto sintético: textura no UV canônico (sobrancelhas, lábios, delineado, sombra, blush e barba por
 * fazer) pintada em canvas; o corpo a assa como faria com a foto (skin-bake.ts). Ninguém é parecido com uma pessoa real.
 */
import { CANON_UV } from "@/lib/avatar3d/canonical-face";
import { EYES } from "@/lib/avatar3d/iris";
import { BROW_LINES } from "@/lib/avatar3d/identity/brows";
import type { FaceStyle } from "./looks";

const OUTER_LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
const INNER_LIPS = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];
/** Contorno da barba (queixo, mandíbula e buço). */
const BEARD = [132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 435, 410, 322, 391, 393, 164, 167, 165, 92, 186, 215, 138];

/**
 * Textura do rosto no UV canônico (lado `size`): pele lisa no tom, sobrancelhas, lábios, delineado, sombra, blush e barba
 * por fazer. O corpo a assa como se fosse a foto (bakeSkin iguala a luz de baixa frequência e preserva lábios e traços).
 */
export function paintFace(skin: string, f: FaceStyle, size = 1024): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = size; c.height = size;
  const g = c.getContext("2d")!;
  const pt = (i: number): [number, number] => [CANON_UV[i * 2] * size, CANON_UV[i * 2 + 1] * size];
  const poly = (ids: readonly number[]) => { g.beginPath(); ids.forEach((i, k) => { const [x, y] = pt(i); if (k) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); };
  const line = (ids: readonly number[]) => { g.beginPath(); ids.forEach((i, k) => { const [x, y] = pt(i); if (k) g.lineTo(x, y); else g.moveTo(x, y); }); };
  g.fillStyle = skin; g.fillRect(0, 0, size, size);
  // sombreado suave: laterais do nariz e abaixo das maçãs (o 3D faz a luz; aqui só um toque)
  g.filter = `blur(${size / 60}px)`;
  g.globalAlpha = 0.12; g.fillStyle = "#000000";
  for (const i of [129, 358]) { const [x, y] = pt(i); g.beginPath(); g.ellipse(x, y - size * 0.02, size * 0.012, size * 0.04, 0, 0, Math.PI * 2); g.fill(); }
  if (f.blush) { g.globalAlpha = 0.28; g.fillStyle = f.blush; for (const i of [50, 280]) { const [x, y] = pt(i); g.beginPath(); g.ellipse(x, y, size * 0.05, size * 0.032, 0, 0, Math.PI * 2); g.fill(); } }
  if (f.shadow) {
    g.globalAlpha = 0.5; g.fillStyle = f.shadow;
    for (const side of ["right", "left"] as const) {
      const lid = side === "right" ? [33, 246, 161, 160, 159, 158, 157, 173, 133, 55, 65, 52, 53, 46] : [263, 466, 388, 387, 386, 385, 384, 398, 362, 285, 295, 282, 283, 276];
      poly(lid); g.fill();
    }
  }
  if (f.stubble > 0) {
    g.globalAlpha = 0.14 + 0.26 * f.stubble; g.fillStyle = "#2a201a"; g.filter = `blur(${size / 140}px)`; poly(BEARD); g.fill();
    // pontinhos de barba por fazer
    g.filter = "none"; g.globalAlpha = 0.18 * f.stubble; g.fillStyle = "#140e0b";
    const [cx, cy] = pt(152), [jx] = pt(132), [kx] = pt(361); let s = 1;
    for (let k = 0; k < 2600 * f.stubble; k++) { s = (s * 16807) % 2147483647; const u = s / 2147483647; s = (s * 16807) % 2147483647; const v = s / 2147483647;
      const x = jx + (kx - jx) * u, y = cy - (cy - pt(164)[1]) * v * 1.05; if (Math.abs(x - cx) / (kx - jx) + 0.0 > 0.62 && y < cy - size * 0.06) continue; g.fillRect(x, y, 1.2, 1.2); }
  }
  g.filter = `blur(${size / 700}px)`;
  // sobrancelhas: polígono entre a linha de cima e a de baixo
  g.globalAlpha = 0.9; g.fillStyle = f.brows;
  for (const side of ["right", "left"] as const) { const b = BROW_LINES[side]; poly([...b.upper, ...[...b.lower].reverse()]); g.fill(); }
  // delineado na pálpebra de cima (gatinho: puxado para fora)
  if (f.liner) {
    g.globalAlpha = 0.9; g.strokeStyle = "#0e0a09"; g.lineWidth = size / 260; g.lineCap = "round";
    for (const side of ["right", "left"] as const) {
      const ct = EYES[side].contour; const upper = [ct[0], ...ct.slice(9).reverse(), ct[8]];
      line(upper); g.stroke();
      if (f.liner === 2) { const [x0, y0] = pt(ct[0]); const dx = side === "right" ? -1 : 1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + dx * size * 0.018, y0 - size * 0.012); g.stroke(); }
    }
  }
  // lábios com a linha entre eles mais escura e um brilho
  g.globalAlpha = f.stubble > 0 ? 0.55 : 0.92; g.fillStyle = f.lips; poly(OUTER_LIPS); g.fill();
  g.globalAlpha = 0.45; g.strokeStyle = "#2a0e0e"; g.lineWidth = size / 400; line(INNER_LIPS.slice(0, 11)); g.stroke();
  g.globalAlpha = 0.18; g.fillStyle = "#ffffff"; { const [x, y] = pt(14); g.beginPath(); g.ellipse(x, y + size * 0.006, size * 0.012, size * 0.004, 0, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1; g.filter = "none";
  return c;
}
