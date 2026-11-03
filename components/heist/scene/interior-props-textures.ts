/*
 * MET Gala Heist v2 — textos e telas desenhados dos móveis do interior (interior-props.ts): o telão do salão, a folha de
 * chamada dos bastidores (pistas da doca e do cofre), a placa da exposição (a ordem dos símbolos), as plaquinhas das
 * vitrines e as imagens das câmeras de segurança.
 */
import * as THREE from "three";
import { SANS, SERIF, drawSymbol, drawnTexture, fit, paper, rand, spaced } from "./interior-tex";
import type { InteriorCopy } from "./interior-copy";
import { CODES, RING_SYMBOLS } from "@/lib/heist/level";

/* ---------- textos desenhados dos móveis ---------- */
export function screenTexture(copy: InteriorCopy): THREE.Texture {
  return drawnTexture(`ledwall-${copy.screenB}`, 1024, 600, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, "#1a0420"); bg.addColorStop(0.5, "#43103d"); bg.addColorStop(1, "#0a0618"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 220; k++) { const x = (k * 97) % w, y = (k * 53) % h; g.fillStyle = `rgba(255,${200 + (k % 50)},${180 + (k % 70)},${0.08 + (k % 7) * 0.02})`; g.beginPath(); g.arc(x, y, 1 + (k % 3), 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#f6dfaa"; g.textAlign = "center"; g.textBaseline = "middle";
    fit(g, copy.screenA, (p) => `600 ${p}px ${SERIF}`, 120, w * 0.8); spaced(g, copy.screenA, w / 2, h * 0.42, 14);
    g.font = `400 ${Math.round(h * 0.07)}px ${SERIF}`; spaced(g, copy.screenB, w / 2, h * 0.64, 8);
    g.strokeStyle = "rgba(246,223,170,0.5)"; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.3, h * 0.53); g.lineTo(w * 0.7, h * 0.53); g.stroke();
  });
}
/** Folha de chamada sobre a mesa da produção (pista do teclado da doca e do cofre da segurança). */
export function callSheetTexture(copy: InteriorCopy): THREE.Texture {
  return drawnTexture(`callsheet-${copy.sheetTitle}`, 600, 820, (g, w, h) => {
    paper(g, w, h, [0.95, 0.94, 0.9], 7);
    g.fillStyle = "#1c1c1c"; g.textBaseline = "top"; g.textAlign = "left";
    fit(g, copy.sheetTitle, (p) => `700 ${p}px ${SANS}`, 30, w - 60); g.fillText(copy.sheetTitle, 30, 30);
    g.font = `400 22px ${SANS}`; g.fillStyle = "#444"; g.fillText(copy.sheetDate, 30, 74);
    g.fillStyle = "#222"; g.fillRect(30, 108, w - 60, 2);
    g.font = `500 24px ${SANS}`; copy.sheetRows.forEach((r, i) => { g.fillStyle = "#222"; g.fillText(r, 30, 128 + i * 40); });
    // anotações à mão (as pistas): marcador vermelho, sublinhadas
    g.font = `600 34px 'Marker Felt', 'Bradley Hand', 'Segoe Print', 'Comic Sans MS', 'DejaVu Sans', cursive`; g.fillStyle = "#b3121e";
    g.save(); g.translate(40, 380); g.rotate(-0.03); g.fillText(copy.sheetNoteDock, 0, 0); g.fillRect(0, 44, Math.min(w - 80, g.measureText(copy.sheetNoteDock).width), 4); g.restore();
    g.save(); g.translate(40, 470); g.rotate(0.02); g.fillText(copy.sheetNoteSafe, 0, 0); g.fillRect(0, 44, Math.min(w - 80, g.measureText(copy.sheetNoteSafe).width), 4); g.restore();
    g.font = `400 22px ${SANS}`; g.fillStyle = "#555"; g.fillText(copy.sheetRadio, 30, h - 70);
    g.strokeStyle = "rgba(120,80,40,0.25)"; g.lineWidth = 10; g.beginPath(); g.arc(w - 120, h - 140, 52, 0, Math.PI * 2); g.stroke();   // marca de copo de café
  });
}
/** Placa da exposição diante da vitrine (a ordem dos símbolos da vitrine do diamante). */
export function placardTexture(copy: InteriorCopy): THREE.Texture {
  return drawnTexture(`placard-${copy.placardTitle}`, 800, 520, (g, w, h) => {
    g.fillStyle = "#14110f"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#b8924a"; g.lineWidth = 6; g.strokeRect(16, 16, w - 32, h - 32);
    g.fillStyle = "#d8b46a"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `500 26px ${SERIF}`; spaced(g, copy.placardKicker, w / 2, 62, 8);
    fit(g, copy.placardTitle, (p) => `600 ${p}px ${SERIF}`, 40, w - 90); g.fillStyle = "#f2e6cf"; g.fillText(copy.placardTitle, w / 2, 118);
    g.font = `italic 400 24px ${SERIF}`; g.fillStyle = "#cbbd9f"; g.fillText(copy.placardLine, w / 2, 164);
    g.font = `500 22px ${SANS}`; g.fillStyle = "#b8924a"; spaced(g, copy.placardSeal.toUpperCase(), w / 2, 224, 4);
    // a ordem: ★ ☾ ♛ (CODES.rings sobre RING_SYMBOLS), com o nome embaixo
    const order = CODES.rings.map((i) => RING_SYMBOLS[i]);
    order.forEach((sym, k) => {
      const x = w / 2 + (k - 1) * 210, y = 330;
      g.strokeStyle = "#b8924a"; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 66, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#f3d58e"; drawSymbol(g, sym, x, y, 40);
      g.fillStyle = "#e9dcc0"; g.font = `500 22px ${SANS}`; g.fillText(copy.placardSymbols[k], x, y + 100);
      g.fillStyle = "#8d7a55"; g.font = `600 20px ${SANS}`; g.fillText(String(k + 1), x, y - 92);
    });
  });
}
export function labelTexture(text: string, sub = ""): THREE.Texture {
  return drawnTexture(`label-${text}-${sub}`, 512, 256, (g, w, h) => {
    g.fillStyle = "#f1ece2"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#1d1b18"; g.textAlign = "left"; g.textBaseline = "top";
    fit(g, text, (p) => `600 ${p}px ${SERIF}`, 40, w - 50); g.fillText(text, 26, 40);
    if (sub) { g.font = `400 26px ${SANS}`; g.fillStyle = "#555"; g.fillText(sub, 26, 120); }
  });
}
/** Imagens das câmeras de segurança (corredores, vitrines) em verde-monocromático com carimbo de hora. */
export function cctvTexture(k: number): THREE.CanvasTexture {
  return drawnTexture(`cctv-${k}`, 320, 200, (g, w, h) => {
    const R = rand(400 + k);
    g.fillStyle = "#06120b"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(120,220,160,0.55)"; g.lineWidth = 2;
    // perspectiva de corredor/sala: pontos de fuga e caixas
    const vx = w * (0.35 + R() * 0.3), vy = h * (0.35 + R() * 0.2);
    for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(vx, vy); g.stroke(); }
    for (let i = 0; i < 4; i++) { const s = 0.2 + i * 0.2; g.strokeRect(vx - w * s * 0.5, vy - h * s * 0.5, w * s, h * s); }
    for (let i = 0; i < 3; i++) { const x = R() * w, y = h * (0.55 + R() * 0.3); g.fillStyle = "rgba(160,255,190,0.35)"; g.fillRect(x, y - 30, 10, 30); g.beginPath(); g.arc(x + 5, y - 36, 6, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#9cffbe"; g.font = "600 14px monospace"; g.fillText(`CAM ${String(k + 1).padStart(2, "0")}`, 10, 18); g.fillText("23:0" + (k % 10) + ":14", w - 86, h - 10);
    g.fillStyle = "#ff3b3b"; g.beginPath(); g.arc(w - 16, 14, 5, 0, Math.PI * 2); g.fill();
  }) as THREE.CanvasTexture;
}
