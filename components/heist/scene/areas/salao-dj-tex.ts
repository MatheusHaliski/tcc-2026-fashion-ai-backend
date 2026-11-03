/*
 * MET Gala Heist v2 — Grande Salão — as texturas desenhadas da festa: o tablado de nogueira da pista, o topo dos players
 * e do mixer, as ondas das faixas (correm no tique), a tela do notebook, a grade das caixas, a frente laqueada da cabine
 * com o medalhão da Gala, os ladrilhos do globo espelhado e a estrela de quatro pontas dos brilhos.
 */
import * as THREE from "three";
import type { Quality } from "../interior-tex";
import { fbm, hash2, rand, salaoTexture, surface } from "./salao-kit";

/* ======================= texturas ======================= */
/** Tablado de nogueira escura envernizada: réguas de 0,12 m com comprimentos desencontrados (textura de 1,2 × 1,2 m). */
export function danceWood(q: Quality) {
  return surface(`danceWood-${q}`, q === "high" ? 1024 : 512, (u, v, o) => {
    const rows = 10, row = Math.floor(v * rows), lv = v * rows % 1;
    const len = 0.45 + hash2(row, 1, 5) * 0.4, off = hash2(row, 2, 5), x = (u + off) / len, seg = Math.floor(x), lu = x % 1;
    const gap = lv < 0.025 || lu < 0.006, tone = hash2(row, seg, 9), grain = Math.sin((u * 60 + fbm(u * 4, v * 2, 8, 13 + row, 3) * 7) * 2.4) * 0.5 + 0.5;
    const b = 0.11 + 0.05 * tone + 0.025 * grain;
    if (gap) { o[0] = 0.02; o[1] = 0.015; o[2] = 0.01; o[3] = 0.3; o[4] = 0.6; return; }
    o[0] = b * 1.25; o[1] = b * 0.78; o[2] = b * 0.5; o[3] = 0.5 + 0.03 * grain; o[4] = 0.07 + 0.04 * grain;
  }, 0.8);
}
/** Topo de um player (sem marca): visor, prato com anel de LED, botões de play/cue, fader de tempo. */
export function cdjTop(): THREE.Texture {
  return salaoTexture("cdjTop", 400, 512, (g, w, h) => {
    g.fillStyle = "#18191c"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#2c2e33"; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = "#06090c"; g.fillRect(40, 30, w - 80, 90); g.strokeStyle = "#3a6f8f"; g.lineWidth = 2; g.strokeRect(40, 30, w - 80, 90);
    const cx = w * 0.46, cy = h * 0.6, r = w * 0.33;
    const ring = g.createRadialGradient(cx, cy, r * 0.82, cx, cy, r); ring.addColorStop(0, "#7e848c"); ring.addColorStop(1, "#c9ced4"); g.fillStyle = ring; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#0c0d0f"; g.beginPath(); g.arc(cx, cy, r * 0.84, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#1e2024"; g.lineWidth = 2; for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.35, cy + Math.sin(a) * r * 0.35); g.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); g.stroke(); }
    g.strokeStyle = "#ff8a2a"; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, r * 0.27, -0.6, 3.6); g.stroke();
    g.fillStyle = "#2a2c30"; g.beginPath(); g.arc(cx, cy, r * 0.22, 0, Math.PI * 2); g.fill();
    for (const [bx2, by, col] of [[56, h - 70, "#38e070"], [56, h - 140, "#ff9a2a"]] as [number, number, string][]) { g.fillStyle = "#2a2c30"; g.beginPath(); g.arc(bx2, by, 26, 0, Math.PI * 2); g.fill(); g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.arc(bx2, by, 26, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = "#08090a"; g.fillRect(w - 46, h * 0.36, 14, h * 0.5); g.fillStyle = "#9aa0a8"; g.fillRect(w - 56, h * 0.58, 34, 18);
    for (let k = 0; k < 8; k++) { g.fillStyle = k % 3 === 0 ? "#3a3d43" : "#2b2d32"; g.fillRect(48 + k * 38, 140, 28, 14); }
  });
}
/** Topo do mixer de quatro canais: botões giratórios, medidores de LED, faders e o crossfader. */
export function mixerTop(): THREE.Texture {
  return salaoTexture("mixerTop", 400, 500, (g, w, h) => {
    g.fillStyle = "#1a1b1e"; g.fillRect(0, 0, w, h); g.strokeStyle = "#2e3035"; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
    for (let ch = 0; ch < 4; ch++) {
      const x = 52 + ch * 82;
      for (let k = 0; k < 4; k++) { g.fillStyle = "#30333a"; g.beginPath(); g.arc(x, 50 + k * 58, 17, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#cfd3d8"; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 50 + k * 58); g.lineTo(x + 10, 40 + k * 58); g.stroke(); }
      for (let k = 0; k < 10; k++) { g.fillStyle = k < 6 ? "#1d6e3a" : k < 8 ? "#8a7a1d" : "#7a1d1d"; g.fillRect(x + 26, 300 - k * 11, 10, 8); }
      g.fillStyle = "#07080a"; g.fillRect(x - 4, 300, 8, 120);
    }
    g.fillStyle = "#07080a"; g.fillRect(110, h - 50, 180, 8);
  });
}
/** Ondas das faixas (tela dos players e do notebook): corre no tique. */
export function waveTexture(): THREE.Texture {
  const t = salaoTexture("waveform", 1024, 128, (g, w, h) => {
    g.fillStyle = "#04060a"; g.fillRect(0, 0, w, h);
    const R = rand(321);
    for (let x = 0; x < w; x++) {
      const beat = Math.max(0, Math.sin((x / w) * Math.PI * 64)) ** 6, amp = (0.25 + 0.55 * beat + 0.2 * R()) * h * 0.45;
      g.fillStyle = beat > 0.4 ? "#ff9b3d" : R() > 0.5 ? "#3ab8ff" : "#d9f2ff"; g.fillRect(x, h / 2 - amp, 1, amp * 2);
    }
    g.fillStyle = "rgba(255,255,255,0.8)"; g.fillRect(w / 2, 0, 2, h);
  });
  t.wrapS = THREE.RepeatWrapping; return t;
}
/** Tela do notebook: dois decks com as ondas, biblioteca de faixas (linhas) e botões. */
export function laptopScreen(): THREE.Texture {
  return salaoTexture("laptopScreen", 512, 320, (g, w, h) => {
    g.fillStyle = "#0b0d12"; g.fillRect(0, 0, w, h);
    for (const y of [14, 84]) { g.fillStyle = "#05070a"; g.fillRect(10, y, w - 20, 60); const R = rand(y); for (let x = 12; x < w - 12; x += 2) { const a = (0.2 + 0.8 * R()) * 26; g.fillStyle = R() > 0.6 ? "#ff9b3d" : "#3ab8ff"; g.fillRect(x, y + 30 - a, 1.5, a * 2); } }
    for (let k = 0; k < 9; k++) { g.fillStyle = k === 3 ? "#1f4d7a" : k % 2 ? "#151922" : "#11151c"; g.fillRect(10, 160 + k * 17, w - 20, 15); g.fillStyle = "#6c7684"; g.fillRect(20, 165 + k * 17, 90 + (k * 37) % 120, 5); g.fillRect(260, 165 + k * 17, 40, 5); }
  });
}
/** Grade de chapa perfurada das caixas. */
export function grille(): THREE.Texture {
  const t = salaoTexture("grille", 256, 256, (g, w, h) => {
    g.fillStyle = "#151517"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) { g.fillStyle = "#050506"; g.beginPath(); g.arc(x + 2, y + 2, 2.4, 0, Math.PI * 2); g.fill(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
/** Frente da cabine: laca negra com filete dourado e o medalhão da Gala. */
export function facade(): THREE.Texture {
  return salaoTexture("djFacade", 1024, 448, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#151417"); bg.addColorStop(1, "#070608"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#b9924a"; g.lineWidth = 4; g.strokeRect(26, 26, w - 52, h - 52); g.lineWidth = 1.5; g.strokeRect(38, 38, w - 76, h - 76);
    const cx = w / 2, cy = h / 2; g.strokeStyle = "#d8b56a"; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, 118, 0, Math.PI * 2); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 104, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#e3c27a"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "italic 600 120px 'Didot', 'Bodoni 72', Georgia, serif"; g.fillText("GL", cx, cy + 6);
    g.font = "500 30px 'Didot', 'Bodoni 72', Georgia, serif"; g.fillText("G A L A   L U M I È R E", cx, h - 74);
  });
}

/** Ladrilhos de espelho do globo (emissivo): rejunte escuro, quadradinhos em cinzas e alguns acesos com as cores da festa. */
export function ballTiles(): THREE.Texture {
  return salaoTexture("ballTiles", 512, 256, (g, w, h) => {
    g.fillStyle = "#050506"; g.fillRect(0, 0, w, h);
    const R = rand(4242), cols = 96, rows = 48, tw = w / cols, th = h / rows;
    const hot = ["#ffffff", "#ffe6c4", "#ff9bd6", "#9be8ff", "#ffd27a"];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const r = R(), l = r > 0.94 ? 1 : 0.08 + 0.3 * R() * R();
      g.fillStyle = r > 0.94 ? hot[Math.floor(R() * hot.length)] : `rgb(${Math.round(l * 255)},${Math.round(l * 250)},${Math.round(l * 245)})`;
      g.fillRect(i * tw + 0.6, j * th + 0.6, tw - 1.2, th - 1.2);
    }
  });
}

/** Estrela de quatro pontas (brilho nos espelhos do globo). */
export function glintTexture(): THREE.Texture {
  return salaoTexture("glint", 128, 128, (g, w, h) => {
    const c = w / 2, grd = g.createRadialGradient(c, c, 0, c, c, c * 0.3); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (const a of [0, Math.PI / 2]) { g.save(); g.translate(c, c); g.rotate(a); const lg = g.createLinearGradient(-c, 0, c, 0); lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, "rgba(255,255,255,1)"); lg.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = lg; g.beginPath(); g.moveTo(-c, 0); g.lineTo(0, -2.5); g.lineTo(c, 0); g.lineTo(0, 2.5); g.closePath(); g.fill(); g.restore(); }
  }, false);
}
