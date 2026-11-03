/*
 * MET Gala Heist v2 — texturas do lounge (Z05): rótulos fictícios das garrafas, cardápio, partitura,
 * capas de livros de arte, a pintura do lounge e o biombo de laca. Saiu de lounge-tex.ts sem mudança.
 */
import * as THREE from "three";
import { drawnTexture, SANS, SERIF, fit, spaced } from "../interior-tex";
import { hash2 } from "./lounge-kit";

/* ======================= rótulos e papéis ======================= */
/** Rótulos fictícios (atlas 8 × 2 de 128 × 256 px): destilados e licores inventados. */
export const LABELS = [
  ["VESPER", "Cognac XO", "#1d1208", "#d9b46a"], ["LUMIÈRE", "London Dry Gin", "#f2efe6", "#1d3b52"], ["NOIR 1957", "Rum envelhecido", "#120c0a", "#c9a25a"], ["CELESTE", "Amaro", "#1f3a5c", "#e8d8b0"],
  ["CAIRN 18", "Single malt", "#e9dfc6", "#5a2a16"], ["ROSSO", "Vermute di Gala", "#7a1420", "#f1e2c4"], ["FÉE VERTE", "Absinto", "#0f3a24", "#e6e0b8"], ["SOMBRA", "Mezcal joven", "#d8d2c2", "#262220"],
  ["AURORA", "Cachaça de alambique", "#f0e6cc", "#7a4a12"], ["ROSA", "Licor de pétalas", "#f1d6db", "#6a1f33"], ["PORTO 1963", "Vintage", "#2a0d10", "#d8b56c"], ["FINO", "Xerez seco", "#efe7cf", "#3b5a2a"],
  ["MARQUISE", "Champagne brut", "#0e0e10", "#d6b46a"], ["ORCHIDÉE", "Crème de violette", "#3a2550", "#e8dcf0"], ["BERGAMOTA", "Licor cítrico", "#f2e8b8", "#305a3a"], ["NUIT", "Bourbon de pequeno lote", "#1a1410", "#e0c48a"],
] as const;
export function labelAtlas(): THREE.Texture {
  return drawnTexture("lounge-labels", 1024, 512, (g, w, h) => {
    const cw = w / 8, ch = h / 2;
    LABELS.forEach(([name, sub, bg, ink], k) => {
      const x = (k % 8) * cw, y = Math.floor(k / 8) * ch;
      g.fillStyle = bg; g.fillRect(x, y, cw, ch);
      g.strokeStyle = ink; g.lineWidth = 3; g.strokeRect(x + 8, y + 10, cw - 16, ch - 20); g.lineWidth = 1; g.strokeRect(x + 13, y + 15, cw - 26, ch - 30);
      g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle";
      g.beginPath(); g.arc(x + cw / 2, y + ch * 0.27, 20, 0, Math.PI * 2); g.lineWidth = 2; g.stroke();
      g.font = `600 18px ${SERIF}`; g.fillText(name.slice(0, 1), x + cw / 2, y + ch * 0.27 + 1);
      fit(g, name, (p) => `700 ${p}px ${SERIF}`, 24, cw - 28); g.fillText(name, x + cw / 2, y + ch * 0.5);
      g.font = `italic 400 12px ${SERIF}`; g.fillText(sub, x + cw / 2, y + ch * 0.62);
      g.font = `400 10px ${SANS}`; g.fillText(`${40 + (k % 5)}% vol · 700 ml`, x + cw / 2, y + ch * 0.82);
      g.fillRect(x + cw * 0.3, y + ch * 0.7, cw * 0.4, 1.5);
    });
  });
}
/** Cardápio de coquetéis do Bar Lumière (dobrado em tenda sobre o balcão). */
export function menuTexture(title: string): THREE.Texture {
  return drawnTexture(`lounge-menu-${title}`, 256, 384, (g, w, h) => {
    g.fillStyle = "#efe6d2"; g.fillRect(0, 0, w, h); g.strokeStyle = "#a9853f"; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = "#2a1d10"; g.textAlign = "center"; g.font = `600 22px ${SERIF}`; spaced(g, title.toUpperCase(), w / 2, 46, 3);
    g.font = `italic 400 13px ${SERIF}`; g.fillText("coquetéis da casa", w / 2, 68);
    const rows = ["Vesper Lumière", "Rosa de Gala", "Noite no Museu", "Sombra & Mel", "Diamante Negro", "Aurora Tropical"];
    rows.forEach((r, k) => { g.font = `500 15px ${SERIF}`; g.textAlign = "left"; g.fillText(r, 26, 106 + k * 42); g.textAlign = "right"; g.fillText(String(38 + k * 4), w - 26, 106 + k * 42); g.font = `400 10px ${SANS}`; g.textAlign = "left"; g.fillStyle = "#6a5a40"; g.fillText("gin · vermute · casca de laranja", 26, 122 + k * 42); g.fillStyle = "#2a1d10"; });
  });
}
/** Partitura aberta na estante do piano. */
export function scoreTexture(): THREE.Texture {
  return drawnTexture("lounge-score", 512, 360, (g, w, h) => {
    g.fillStyle = "#efe8d6"; g.fillRect(0, 0, w, h); g.fillStyle = "#d8cfba"; g.fillRect(w / 2 - 2, 0, 4, h);
    g.strokeStyle = "#222"; g.fillStyle = "#222";
    for (const x0 of [16, w / 2 + 14]) for (let s = 0; s < 6; s++) {
      const y0 = 40 + s * 52; g.lineWidth = 1; for (let l = 0; l < 5; l++) { g.beginPath(); g.moveTo(x0, y0 + l * 6); g.lineTo(x0 + w / 2 - 30, y0 + l * 6); g.stroke(); }
      for (let k = 0; k < 12; k++) { const x = x0 + 20 + k * 18, y = y0 + 3 + hash2(k, s, 3) * 24; g.beginPath(); g.ellipse(x, y, 3.6, 2.6, -0.4, 0, Math.PI * 2); g.fill(); g.fillRect(x + 3, y - 18, 1.2, 18); }
    }
    g.font = `italic 600 16px ${SERIF}`; g.textAlign = "center"; g.fillText("Noturno em mi bemol", w / 4, 22);
  });
}
/** Capas de livros de arte (atlas 4 × 1): títulos inventados. */
export const BOOKS = [["MODA E RUÍNA", "#1b1b1d", "#d8b46a"], ["ATELIÊS DE PARIS", "#e8e1d2", "#7a1a20"], ["LUMIÈRE · 1957", "#3a2a1a", "#efe2c4"], ["O CORTE PERFEITO", "#14303a", "#e6d6a8"]] as const;
export function bookAtlas(): THREE.Texture {
  return drawnTexture("lounge-books", 1024, 256, (g, w, h) => {
    const cw = w / 4;
    BOOKS.forEach(([t, bg, ink], k) => {
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
