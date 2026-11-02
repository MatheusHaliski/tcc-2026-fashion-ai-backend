/*
 * MET Gala Heist v2 — galeria (Z07): o atlas da arte emoldurada — croquis a grafite e aquarela e desenhos
 * de joia a guache. Saiu de galeria-tex.ts sem mudança.
 */
import * as THREE from "three";
import { HAND, drawGown, rand, type Quality } from "../interior-tex";
import { paint, qs } from "./galeria-kit";

/* ---------- croquis e guaches ---------- */
export const ART_COLS = 4, ART_ROWS = 2;
function croquis(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number) {
  const R = rand(900 + k * 17);
  // papel creme com fibras e manchas de tempo
  g.fillStyle = "#efe6d1"; g.fillRect(x, y, w, h);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(120,95,60,${0.02 + R() * 0.04})`; g.fillRect(x + R() * w, y + R() * h, 1 + R() * 3, 1 + R() * 3); }
  const cx = x + w * (0.42 + R() * 0.12), top = y + h * 0.1, H = h * 0.78, wash = ["rgba(168,139,255,0.45)", "rgba(16,24,48,0.5)", "rgba(160,20,40,0.45)", "rgba(220,190,120,0.45)"][k % 4];
  // aguada de aquarela (borda irregular) e a silhueta do vestido a grafite, com traços repetidos
  g.save(); g.globalCompositeOperation = "multiply";
  const fill = g.createLinearGradient(0, top + H * 0.25, 0, top + H); fill.addColorStop(0, wash); fill.addColorStop(1, wash.replace(/[\d.]+\)$/, "0.2)"));
  drawGown(g, cx, top + H * 0.18, H * 0.8, fill); g.restore();
  g.strokeStyle = "rgba(40,36,32,0.75)"; g.lineWidth = Math.max(1, w * 0.004);
  for (let p = 0; p < 3; p++) {
    const j = (R() - 0.5) * w * 0.01;
    g.beginPath(); g.ellipse(cx + j, top + H * 0.07, w * 0.035, H * 0.045, 0.1, 0, Math.PI * 2); g.stroke();                       // cabeça
    g.beginPath(); g.moveTo(cx - w * 0.07 + j, top + H * 0.17); g.quadraticCurveTo(cx + j, top + H * 0.15, cx + w * 0.07 + j, top + H * 0.17);   // ombros
    g.moveTo(cx - w * 0.07 + j, top + H * 0.17); g.quadraticCurveTo(cx - w * 0.12, top + H * 0.3, cx - w * 0.09 + j, top + H * 0.42);           // braço
    g.moveTo(cx + w * 0.07 + j, top + H * 0.17); g.quadraticCurveTo(cx + w * 0.15, top + H * 0.25, cx + w * 0.2 + j, top + H * 0.2);            // braço erguido
    g.stroke();
    // saia: duas curvas e pregas
    g.beginPath(); g.moveTo(cx - w * 0.03, top + H * 0.36); g.bezierCurveTo(cx - w * 0.2, top + H * 0.6, cx - w * 0.3, top + H * 0.85, cx - w * 0.34 + j, top + H * 0.98);
    g.moveTo(cx + w * 0.03, top + H * 0.36); g.bezierCurveTo(cx + w * 0.2, top + H * 0.6, cx + w * 0.34, top + H * 0.85, cx + w * 0.4 + j, top + H * 0.98); g.stroke();
  }
  g.lineWidth = Math.max(1, w * 0.002); g.strokeStyle = "rgba(40,36,32,0.45)";
  for (let i = 0; i < 9; i++) { const t = i / 8; g.beginPath(); g.moveTo(cx - w * 0.02 + t * w * 0.04, top + H * 0.4); g.quadraticCurveTo(cx - w * 0.2 + t * w * 0.4, top + H * 0.7, cx - w * 0.33 + t * w * 0.72, top + H * 0.97); g.stroke(); }
  // anotações à mão e a amostra presa com alfinete
  g.fillStyle = "rgba(50,40,30,0.85)"; g.font = `400 ${Math.round(w * 0.05)}px ${HAND}`; g.textAlign = "left"; g.textBaseline = "top";
  const notes = [["tule lilás → ouro", "11 camadas", "prova 3"], ["veludo de seda", "luva até o cotovelo", "costas nuas"], ["babados em 5 níveis", "tule carmim", "cauda curta"], ["cetim duquesa", "cinto bordado", "corrigir decote"]][k % 4];
  notes.forEach((n, i) => g.fillText(n, x + w * 0.58, y + h * (0.12 + i * 0.07)));
  g.save(); g.translate(x + w * 0.7, y + h * 0.62); g.rotate(-0.12 + R() * 0.2);
  g.fillStyle = ["#b9a4f0", "#1b2a52", "#a8162e", "#e2cf9b"][k % 4]; g.fillRect(0, 0, w * 0.18, h * 0.11);
  g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 1; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(i * w * 0.015, 0); g.lineTo(i * w * 0.015 + 3, -3); g.stroke(); }
  g.fillStyle = "#c9cdd2"; g.fillRect(w * 0.02, h * 0.02, w * 0.14, 2); g.fillStyle = "#b3121e"; g.beginPath(); g.arc(w * 0.02, h * 0.02 + 1, 4, 0, Math.PI * 2); g.fill();
  g.restore();
  g.font = `400 ${Math.round(w * 0.04)}px ${HAND}`; g.fillStyle = "rgba(50,40,30,0.7)"; g.fillText(`Orvalho · ${1955 + (k % 3)}`, x + w * 0.08, y + h * 0.92);
}
function gouache(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number) {
  const R = rand(1300 + k * 23);
  g.fillStyle = "#55575c"; g.fillRect(x, y, w, h);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${0.01 + R() * 0.03})`; g.fillRect(x + R() * w, y + R() * h, 1 + R() * 2, 1 + R() * 2); }
  const cx = x + w / 2, cy = y + h * 0.42, stone = (sx: number, sy: number, r: number, col: string) => {
    const grd = g.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.1, sx, sy, r); grd.addColorStop(0, "#ffffff"); grd.addColorStop(0.35, col); grd.addColorStop(1, "#202226");
    g.fillStyle = grd; g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#d9b866"; g.lineWidth = Math.max(1, r * 0.18); g.stroke();
  };
  if (k % 4 === 0) {            // colar em cascata
    for (let i = 0; i <= 18; i++) { const a = Math.PI * (0.12 + 0.76 * i / 18), sx = cx + Math.cos(a) * w * 0.34, sy = cy - h * 0.12 + Math.sin(a) * h * 0.26; stone(sx, sy, w * 0.022, "#e9eef5"); if (i % 3 === 0) stone(sx, sy + w * 0.06, w * 0.016, "#f0a8c0"); }
    stone(cx, cy + h * 0.2, w * 0.05, "#f3a3b8");
  } else if (k % 4 === 1) {     // tiara
    g.strokeStyle = "#d9b866"; g.lineWidth = w * 0.01; g.beginPath(); g.ellipse(cx, cy + h * 0.1, w * 0.36, h * 0.14, 0, Math.PI, 0); g.stroke();
    for (let i = 0; i < 9; i++) { const t = i / 8, a = Math.PI + t * Math.PI, sx = cx + Math.cos(a) * w * 0.36, sy = cy + h * 0.1 + Math.sin(a) * h * 0.14, tall = 1 - Math.abs(t - 0.5) * 1.4; stone(sx, sy - h * 0.12 * tall, w * (0.018 + 0.02 * tall), "#eef3ff"); }
  } else if (k % 4 === 2) {     // brincos em gota
    for (const s of [-1, 1]) { stone(cx + s * w * 0.18, cy - h * 0.1, w * 0.03, "#eef3ff"); stone(cx + s * w * 0.18, cy + h * 0.02, w * 0.05, "#9fb8ff"); stone(cx + s * w * 0.18, cy + h * 0.15, w * 0.035, "#eef3ff"); }
  } else {                      // broche em flor
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; stone(cx + Math.cos(a) * w * 0.12, cy + Math.sin(a) * w * 0.12, w * 0.05, "#f3d0dc"); }
    stone(cx, cy, w * 0.06, "#ffd27a");
  }
  g.fillStyle = "rgba(235,235,235,0.85)"; g.font = `400 ${Math.round(w * 0.045)}px ${HAND}`; g.textAlign = "left"; g.textBaseline = "top";
  g.fillText(["Alvorada — colar", "Tiara Orvalho", "Gotas de orvalho", "Broche Aurora"][k % 4], x + w * 0.08, y + h * 0.84);
  g.fillText("guache · 1957", x + w * 0.08, y + h * 0.9);
}
/** Atlas da arte emoldurada: quatro croquis (papel creme) e quatro desenhos de joia a guache (papel cinza). */
export function artAtlas(q: Quality): THREE.Texture {
  return paint(`galeria-arte-${q}`, qs(q, 2048), qs(q, 1536), (g, w, h) => {
    const cw = w / ART_COLS, ch = h / ART_ROWS;
    for (let k = 0; k < 4; k++) croquis(g, k * cw, 0, cw, ch, k);
    for (let k = 0; k < 4; k++) gouache(g, k * cw, ch, cw, ch, k);
  });
}
