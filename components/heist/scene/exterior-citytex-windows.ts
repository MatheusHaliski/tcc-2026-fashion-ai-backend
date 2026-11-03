/*
 * MET Gala Heist v2 — atlas das janelas dos prédios da cidade (apagadas com reflexo do céu, cortina, persiana, voal;
 * acesas com sala, cozinha, escritório, TV, plantas).
 */
import * as THREE from "three";
import { canvas, memo, prng, texFrom, type Quality } from "./exterior-tex-core";
import { box, clip, glow, rgb, vgrad, type G } from "./exterior-citytex-paint";

/* =========================================================================================================================
 * Janelas dos prédios: 8 × 4 variantes. Mapa (o que se vê no vidro) e emissivo (a luz de dentro); o caixilho é geometria.
 * ========================================================================================================================= */
export const WIN_COLS = 8, WIN_ROWS = 4;
type WinKind = "dark" | "darkCurtain" | "darkBlinds" | "darkSheer" | "litRoom" | "litCurtain" | "litSheer" | "litBlinds" | "tv" | "kitchen" | "office" | "litPlant" | "dim";
const WIN_KINDS: WinKind[] = [
  "dark", "dark", "darkCurtain", "darkBlinds", "dark", "darkSheer", "litRoom", "litCurtain",
  "litSheer", "litBlinds", "tv", "kitchen", "office", "litPlant", "dim", "litRoom",
  "dark", "darkCurtain", "litRoom", "litCurtain", "dim", "darkBlinds", "litBlinds", "kitchen",
  "dark", "office", "litSheer", "tv", "dark", "litPlant", "darkCurtain", "litRoom",
];
/** Quais células do atlas de janelas são acesas (para sortear com a proporção certa de luz na quadra). */
export const WIN_LIT = WIN_KINDS.map((k) => !k.startsWith("dark"));

function windowCell(g: G, x: number, y: number, w: number, h: number, kind: WinKind, r: () => number) {
  clip(g, x, y, w, h, () => {
    const wall = [[214, 176, 128], [196, 160, 120], [222, 196, 156], [188, 150, 112], [205, 186, 160]][Math.floor(r() * 5)];
    const room = (k: number) => {
      vgrad(g, x, y, w, h, rgb(wall[0] * k, wall[1] * k, wall[2] * k), rgb(wall[0] * k * 0.62, wall[1] * k * 0.58, wall[2] * k * 0.55));
      glow(g, x + w * (0.3 + r() * 0.4), y + h * 0.04, w * 0.9, rgb(255, 214, 160, 0.9), 0.85);
      // quadro na parede, estante de lado e o encosto do sofá embaixo
      box(g, x + w * 0.22, y + h * 0.3, w * 0.36, h * 0.16, rgb(70, 52, 40)); box(g, x + w * 0.25, y + h * 0.315, w * 0.3, h * 0.13, rgb(120 + r() * 80, 90 + r() * 60, 70 + r() * 40));
      if (r() < 0.5) { box(g, x + w * 0.78, y + h * 0.22, w * 0.22, h * 0.6, rgb(90, 64, 44)); for (let k2 = 0; k2 < 5; k2++) box(g, x + w * 0.8, y + h * (0.26 + k2 * 0.11), w * 0.18, h * 0.012, rgb(50, 36, 26)); }
      g.fillStyle = rgb(60, 44, 36); g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + h * 0.8); g.quadraticCurveTo(x + w * 0.35, y + h * 0.74, x + w * 0.7, y + h * 0.8); g.lineTo(x + w * 0.7, y + h); g.fill();
      box(g, x + w * 0.82, y + h * 0.6, w * 0.02, h * 0.4, rgb(40, 30, 24)); glow(g, x + w * 0.83, y + h * 0.58, w * 0.22, rgb(255, 200, 130), 0.8);
    };
    const curtains = (color: number[], cover: number, lit: boolean) => {
      for (const side of [0, 1]) {
        const cw = w * cover, cx = side ? x + w - cw : x;
        for (let f = 0; f < 6; f++) { const fx = cx + (cw * f) / 6, k = 0.75 + 0.25 * Math.sin(f * 1.7 + side); box(g, fx, y, cw / 6 + 1, h, rgb(color[0] * k, color[1] * k, color[2] * k, lit ? 0.92 : 1)); }
      }
    };
    switch (kind) {
      case "dark": case "darkCurtain": case "darkBlinds": case "darkSheer": {
        vgrad(g, x, y, w, h, "#2a3646", "#0b1016");
        if (kind === "darkCurtain") curtains([46, 40, 38], 0.5, false);
        if (kind === "darkBlinds") for (let s = 0; s < h; s += h / 18) box(g, x, y + s, w, h / 30, "#3a4048");
        if (kind === "darkSheer") { g.fillStyle = "rgba(200,196,190,0.14)"; g.fillRect(x, y, w, h); for (let f = 0; f < 9; f++) box(g, x + (w * f) / 9, y, w / 30, h, "rgba(255,255,255,0.06)"); }
        // reflexo do céu e das luzes da rua no vidro (faixa diagonal)
        const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0.15, "rgba(150,175,210,0)"); gr.addColorStop(0.35, "rgba(150,175,210,0.16)"); gr.addColorStop(0.5, "rgba(150,175,210,0)");
        g.fillStyle = gr; g.fillRect(x, y, w, h);
        if (r() < 0.4) glow(g, x + w * r(), y + h * (0.55 + r() * 0.4), w * 0.18, "rgba(255,170,90,0.5)", 0.6);
        break;
      }
      case "litRoom": room(1); break;
      case "litCurtain": room(1); curtains([[150, 40, 36], [60, 90, 70], [180, 150, 110]][Math.floor(r() * 3)], 0.28, true); break;
      case "litSheer": room(1.05); g.fillStyle = "rgba(255,246,230,0.5)"; g.fillRect(x, y, w, h); for (let f = 0; f < 9; f++) box(g, x + (w * f) / 9, y, w / 26, h, "rgba(255,255,255,0.18)"); break;
      case "litBlinds": room(1); { const down = h * (0.35 + r() * 0.35); for (let s = 0; s < down; s += h / 22) { box(g, x, y + s, w, h / 26, "rgb(232,212,180)"); box(g, x, y + s + h / 26, w, h / 120, "rgba(40,30,20,0.6)"); } } break;
      case "tv": vgrad(g, x, y, w, h, "#141a2a", "#06080e"); glow(g, x + w * 0.3, y + h * 0.85, w * 0.9, "rgba(110,150,255,0.95)"); glow(g, x + w * 0.5, y + h * 0.1, w * 0.6, "rgba(90,120,220,0.45)"); break;
      case "kitchen":
        vgrad(g, x, y, w, h, "#eee6d4", "#b9ad94");
        for (let tx = 0; tx < w; tx += w / 8) for (let ty = h * 0.5; ty < h * 0.75; ty += h / 24) box(g, x + tx, y + ty, w / 8 - 1, h / 24 - 1, "rgba(255,255,255,0.35)");
        box(g, x, y + h * 0.14, w, h * 0.3, "#8a6a48"); for (let k = 0; k < 3; k++) box(g, x + (w * k) / 3 + 2, y + h * 0.16, w / 3 - 4, h * 0.26, "#9d7b55");
        box(g, x, y + h * 0.75, w, h * 0.25, "#6e5a44"); glow(g, x + w * 0.5, y + h * 0.05, w * 0.8, "rgba(255,236,200,0.95)");
        break;
      case "office":
        vgrad(g, x, y, w, h, "#dfe6ee", "#9aa6b4");
        for (let k = 0; k < 2; k++) box(g, x + w * 0.1, y + h * (0.05 + k * 0.06), w * 0.8, h * 0.02, "#ffffff");
        box(g, x + w * 0.1, y + h * 0.7, w * 0.8, h * 0.05, "#4a4f58"); box(g, x + w * 0.3, y + h * 0.52, w * 0.4, h * 0.17, "#20252e"); box(g, x + w * 0.32, y + h * 0.535, w * 0.36, h * 0.14, "#7fb0e8");
        break;
      case "litPlant": room(1); for (let k = 0; k < 14; k++) { g.fillStyle = rgb(30 + r() * 30, 52 + r() * 40, 28 + r() * 20); g.beginPath(); g.ellipse(x + w * (0.1 + r() * 0.8), y + h * (0.72 + r() * 0.26), w * 0.12, h * 0.05, r() * 3, 0, Math.PI * 2); g.fill(); } break;
      case "dim": vgrad(g, x, y, w, h, "#2a2018", "#0c0907"); glow(g, x + w * (r() < 0.5 ? 0.18 : 0.82), y + h * 0.62, w * 0.75, "rgba(255,170,90,0.85)"); break;
    }
  });
}

export interface WinAtlas { map: THREE.Texture; emissive: THREE.Texture }
export function windowAtlas(q: Quality): WinAtlas {
  return memo(`city-win:${q}`, () => {
    const CW = q === "high" ? 128 : 64, CH = CW * 2, W = CW * WIN_COLS, H = CH * WIN_ROWS, r = prng(301);
    const [c, g] = canvas(W, H), [ce, ge] = canvas(W, H), [tc, tg] = canvas(CW, CH);
    ge.fillStyle = "#000"; ge.fillRect(0, 0, W, H);
    WIN_KINDS.forEach((kind, k) => {
      const x = (k % WIN_COLS) * CW, y = Math.floor(k / WIN_COLS) * CH;
      tg.clearRect(0, 0, CW, CH); windowCell(tg, 0, 0, CW, CH, kind, r);
      g.drawImage(tc, x, y);
      if (WIN_LIT[k]) { ge.drawImage(tc, x, y); g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(x, y, CW, CH); }       // o mapa acende pouco: a luz vem do emissivo
    });
    const map = texFrom(c, true), emissive = texFrom(ce, true);
    for (const t of [map, emissive]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; }
    return { map, emissive };
  });
}
