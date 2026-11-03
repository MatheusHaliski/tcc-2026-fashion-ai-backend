/*
 * MET Gala Heist v2 — textos e pinturas do Grande Salão (interior-hall.ts): os estandartes da Gala Lumière, o
 * cartaz-pista do Vestido Aurora (o ano do teclado da doca) e os caixotões das cúpulas.
 */
import * as THREE from "three";
import { SERIF, drawGown, drawnTexture, fit, spaced } from "./interior-tex";
import type { InteriorCopy } from "./interior-copy";

/* ---------- textos do salão ---------- */
export function bannerTexture(copy: InteriorCopy, kind: "a" | "b"): THREE.Texture {
  return drawnTexture(`hallBanner-${kind}-${copy.bannerA}-${copy.posterTitle}`, 512, 640, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#2b0b1c"); grd.addColorStop(0.55, "#6d1e3d"); grd.addColorStop(1, "#c86b7a"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#d8b56a"; g.lineWidth = 6; g.strokeRect(18, 18, w - 36, h - 36);
    g.fillStyle = "#f3dfb4"; g.textAlign = "center"; g.textBaseline = "middle";
    if (kind === "a") {
      fit(g, copy.bannerA, (p) => `600 ${p}px ${SERIF}`, 74, w - 90); spaced(g, copy.bannerA, w / 2, h * 0.22, 6);
      const au = g.createLinearGradient(0, h * 0.35, 0, h * 0.95); au.addColorStop(0, "#f7e3b5"); au.addColorStop(0.5, "#f1a8bf"); au.addColorStop(1, "#b9a3ff");
      drawGown(g, w / 2, h * 0.34, h * 0.56, au);
    } else {
      g.font = `italic 400 ${Math.round(h * 0.16)}px ${SERIF}`; g.fillText(copy.bannerB, w / 2, h * 0.42);
      g.font = `400 ${Math.round(h * 0.045)}px ${SERIF}`; spaced(g, copy.exhibitSub, w / 2, h * 0.6, 5);
      g.font = `600 ${Math.round(h * 0.06)}px ${SERIF}`; spaced(g, copy.bannerA, w / 2, h * 0.84, 6);
    }
  });
}
/** Cartaz-pista do salão: "VESTIDO AURORA · CASA ORVALHO" com o ano bem grande (o código do teclado da doca). */
export function posterTexture(copy: InteriorCopy): THREE.Texture {
  return drawnTexture(`posterAurora-${copy.posterTitle}-${copy.posterFoot}`, 768, 1152, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#160a14"); bg.addColorStop(0.5, "#3a1430"); bg.addColorStop(1, "#140810"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const glowG = g.createRadialGradient(w / 2, h * 0.5, 20, w / 2, h * 0.5, w * 0.7); glowG.addColorStop(0, "rgba(255,190,150,0.45)"); glowG.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = glowG; g.fillRect(0, 0, w, h);
    const au = g.createLinearGradient(0, h * 0.28, 0, h * 0.75); au.addColorStop(0, "#fde7b8"); au.addColorStop(0.45, "#f3a3b8"); au.addColorStop(1, "#a88bff");
    drawGown(g, w / 2, h * 0.27, h * 0.46, au);
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#e9cf94";
    g.font = `500 ${Math.round(h * 0.024)}px ${SERIF}`; spaced(g, copy.posterKicker, w / 2, h * 0.06, 10);
    fit(g, copy.posterTitle, (p) => `600 ${p}px ${SERIF}`, Math.round(h * 0.07), w * 0.86); spaced(g, copy.posterTitle, w / 2, h * 0.13, 4);
    g.font = `400 ${Math.round(h * 0.03)}px ${SERIF}`; spaced(g, copy.posterHouse, w / 2, h * 0.2, 12);
    // o ano: o maior elemento do cartaz
    g.fillStyle = "#ffe2a6"; g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = 18;
    g.font = `700 ${Math.round(h * 0.2)}px ${SERIF}`; g.fillText(copy.posterYear, w / 2, h * 0.84);
    g.shadowBlur = 0; g.fillStyle = "#d9bf86"; g.font = `400 ${Math.round(h * 0.022)}px ${SERIF}`; g.fillText(copy.posterFoot, w / 2, h * 0.955);
    g.strokeStyle = "#c9a45a"; g.lineWidth = 4; g.strokeRect(14, 14, w - 28, h - 28);
  });
}
export function domeTexture(): THREE.Texture {
  return drawnTexture("domeCoffers", 1024, 512, (g, w, h) => {
    g.fillStyle = "#d9cdb3"; g.fillRect(0, 0, w, h);
    const rows = [[0.18, 0.32], [0.36, 0.5], [0.54, 0.68], [0.72, 0.86]], cols = 24;
    for (const [a, b] of rows) for (let c = 0; c < cols; c++) {
      const x0 = (c / cols) * w + 6, x1 = ((c + 1) / cols) * w - 6, y0 = a * h, y1 = b * h;
      const grd = g.createLinearGradient(0, y0, 0, y1); grd.addColorStop(0, "#9c8b6e"); grd.addColorStop(1, "#c9b993"); g.fillStyle = grd; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.fillStyle = "#e9dfc6"; g.fillRect(x0 + 5, y0 + 5, x1 - x0 - 10, y1 - y0 - 10);
      g.fillStyle = "#c39a4a"; g.beginPath(); g.arc((x0 + x1) / 2, (y0 + y1) / 2, Math.min(x1 - x0, y1 - y0) * 0.16, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#b58f45"; g.fillRect(0, h * 0.9, w, h * 0.04); g.fillRect(0, h * 0.13, w, h * 0.02);
    const ocu = g.createLinearGradient(0, 0, 0, h * 0.13); ocu.addColorStop(0, "#fff1cf"); ocu.addColorStop(1, "#d9c08a"); g.fillStyle = ocu; g.fillRect(0, 0, w, h * 0.13);
  });
}
