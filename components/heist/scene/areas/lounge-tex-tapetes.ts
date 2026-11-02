/*
 * MET Gala Heist v2 — texturas do lounge (Z05): os tapetes persas (medalhão, cantoneiras, barra com
 * cartelas, desgaste) e a franja de lã. Saiu de lounge-tex.ts sem mudança.
 */
import * as THREE from "three";
import { drawnTexture, type Quality } from "../interior-tex";
import { fbm, hash2, smooth } from "./lounge-kit";

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
