/*
 * MET Gala Heist v2 — texturas da cidade em volta da avenida (canvas, geradas uma vez por qualidade e guardadas no cache de
 * exterior-textures.ts com chaves "city-…"): o atlas das janelas dos prédios (apagadas com reflexo do céu, cortina,
 * persiana, voal; acesas com sala, cozinha, escritório, TV, plantas), o atlas dos interiores das lojas vistos pela vitrine
 * (parede do fundo de cada ramo, paredes laterais, tetos, pisos e as frentes de prateleira dos móveis de loja), o atlas dos
 * letreiros (fachada, sanefa e lona dos toldos) com o brilho do neon num atlas gêmeo, os panfletos e cartazes, a porta de
 * enrolar, a grade de janelas do skyline e o painel de fotos da gala.
 *
 * Todos os nomes de loja, marca e evento são fictícios (nada de marca real). Os atlas têm uma grade fixa: quem monta a
 * geometria pede a célula pelo índice e recebe o retângulo de UV (cellUV).
 */
import * as THREE from "three";
import { canvas, fitFont, memo, prng, SANS, SERIF, spaced, texFrom, type Quality } from "./exterior-textures";

/** Retângulo de UV [u0, v0, u1, v1] da célula k numa grade cols × rows (linha 0 em cima; v do three cresce para cima). */
export function cellUV(k: number, cols: number, rows: number, inset = 0.004): [number, number, number, number] {
  const c = k % cols, r = Math.floor(k / cols);
  return [c / cols + inset / cols, 1 - (r + 1) / rows + inset / rows, (c + 1) / cols - inset / cols, 1 - r / rows - inset / rows];
}

/* ---------- auxiliares de pintura ---------- */
type G = CanvasRenderingContext2D;
const rgb = (r: number, g: number, b: number, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
function vgrad(g: G, x: number, y: number, w: number, h: number, top: string, bottom: string) { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(x, y, w, h); }
function glow(g: G, x: number, y: number, r: number, color: string, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, color); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.save(); g.globalAlpha = a; g.globalCompositeOperation = "lighter"; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}
function box(g: G, x: number, y: number, w: number, h: number, c: string) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function clip(g: G, x: number, y: number, w: number, h: number, draw: () => void) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); draw(); g.restore(); }
function text(g: G, s: string, x: number, y: number, w: number, size: number, family: string, color: string, weight = "600", spacing = 0) {
  g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle";
  fitFont(g, s, family, weight, size, w, spacing); spaced(g, s, x, y, spacing);
}
const SCRIPT = "'Snell Roundhand', 'Brush Script MT', 'Segoe Script', 'URW Chancery L', 'DejaVu Serif', cursive";

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

/* =========================================================================================================================
 * Interiores das lojas (vistos pela vitrine): 4 × 8 células 2:1. Uma textura só faz mapa e emissivo (luz "assada").
 * ========================================================================================================================= */
export const INT_COLS = 4, INT_ROWS = 8;
export const SHOP_KINDS = ["fashion", "jewelry", "cafe", "pharmacy", "books", "bakery", "florist", "bistro", "bar", "shoes", "perfume", "optics", "gallery", "lobby", "closed", "atelier"] as const;
export type ShopKind = (typeof SHOP_KINDS)[number];
/** Células extras do atlas de interiores. */
export const INT = { sideWarm: 16, sideCool: 17, sideDark: 18, ceilWarm: 19, ceilCool: 20, floorWood: 21, floorTile: 22, floorStone: 23, pharmacyShelf: 24, bookShelf: 25, bottleShelf: 26, bread: 27, shoeShelf: 28, garments: 29, flowers: 30, magazines: 31 } as const;

function shopWall(g: G, x: number, y: number, w: number, h: number, kind: ShopKind, r: () => number) {
  const floorLine = (c: string) => box(g, x, y + h * 0.9, w, h * 0.1, c);
  switch (kind) {
    case "fashion": {
      vgrad(g, x, y, w, h, "#a8977f", "#5e5244");
      for (let k = 0; k < 3; k++) {
        const cx = x + w * (0.2 + k * 0.3), nw = w * 0.2, top = y + h * 0.16;
        g.fillStyle = "#e9dcc6"; g.beginPath(); g.moveTo(cx - nw / 2, y + h * 0.88); g.lineTo(cx - nw / 2, top + nw / 2); g.arc(cx, top + nw / 2, nw / 2, Math.PI, 0); g.lineTo(cx + nw / 2, y + h * 0.88); g.fill();
        g.strokeStyle = "#b79a5e"; g.lineWidth = Math.max(1, w / 300); g.stroke();
        glow(g, cx, top + nw * 0.2, nw * 0.9, "rgba(255,226,180,0.85)");
        // vestido no cabide (silhueta com caimento)
        const col = [[120, 14, 30], [16, 70, 52], [20, 20, 24], [176, 140, 70]][(k + Math.floor(r() * 4)) % 4];
        g.fillStyle = rgb(col[0], col[1], col[2]); g.beginPath();
        g.moveTo(cx - nw * 0.08, top + nw * 0.55); g.lineTo(cx + nw * 0.08, top + nw * 0.55); g.lineTo(cx + nw * 0.11, top + nw * 1.0); g.quadraticCurveTo(cx + nw * 0.42, y + h * 0.7, cx + nw * 0.36, y + h * 0.84); g.lineTo(cx - nw * 0.36, y + h * 0.84); g.quadraticCurveTo(cx - nw * 0.42, y + h * 0.7, cx - nw * 0.11, top + nw * 1.0); g.closePath(); g.fill();
        g.strokeStyle = "rgba(255,240,220,0.35)"; g.beginPath(); g.moveTo(cx - nw * 0.05, top + nw); g.quadraticCurveTo(cx - nw * 0.1, y + h * 0.7, cx - nw * 0.2, y + h * 0.83); g.stroke();
        box(g, cx - nw * 0.12, top + nw * 0.5, nw * 0.24, nw * 0.04, "#b79a5e");
      }
      box(g, x, y + h * 0.88, w, h * 0.012, "#b79a5e"); floorLine("#9b8a72");
      break;
    }
    case "jewelry": {
      vgrad(g, x, y, w, h, "#16233a", "#080d16"); box(g, x, y + h * 0.62, w, h * 0.38, "#3a2416");
      for (let k = 0; k < 5; k++) {
        const cx = x + w * (0.12 + k * 0.19), nw = w * 0.1, ny = y + h * 0.28;
        box(g, cx - nw / 2, ny, nw, h * 0.22, "#f3e2c0"); glow(g, cx, ny + h * 0.04, nw, "rgba(255,240,210,0.9)");
        for (let s = 0; s < 6; s++) { const sx = cx + (r() - 0.5) * nw * 0.7, sy = ny + h * (0.08 + r() * 0.12); g.fillStyle = r() < 0.5 ? "#ffffff" : "#ffd98a"; g.fillRect(sx, sy, 2, 2); }
        g.strokeStyle = "#c9a24a"; g.lineWidth = Math.max(1, w / 400); g.strokeRect(cx - nw / 2, ny, nw, h * 0.22);
      }
      text(g, "O", x + w * 0.5, y + h * 0.13, w * 0.1, h * 0.14, SERIF, "#d7b56d", "400");
      floorLine("#1a120c");
      break;
    }
    case "cafe": {
      box(g, x, y, w, h, "#1f3a2e"); for (let ty = y + h * 0.45; ty < y + h * 0.9; ty += h / 28) for (let tx = x + ((ty / (h / 28)) % 2) * (w / 60); tx < x + w; tx += w / 30) box(g, tx, ty, w / 30 - 1, h / 28 - 1, "#e9e3d6");
      for (let k = 0; k < 2; k++) { const sy = y + h * (0.2 + k * 0.14); box(g, x + w * 0.05, sy, w * 0.5, h * 0.015, "#6b4a2c"); for (let c = 0; c < 14; c++) { g.fillStyle = ["#e9e3d6", "#c46d3a", "#2f2a26", "#d8b46a"][Math.floor(r() * 4)]; g.fillRect(x + w * (0.07 + c * 0.034), sy - h * 0.06, w * 0.022, h * 0.06); } }
      box(g, x + w * 0.62, y + h * 0.12, w * 0.3, h * 0.36, "#151a17"); g.strokeStyle = "#8a6a44"; g.lineWidth = w / 200; g.strokeRect(x + w * 0.62, y + h * 0.12, w * 0.3, h * 0.36);
      ["CAFÉ  6", "CAPPUCCINO  9", "PÃO DE QUEIJO  5", "BOLO DO DIA  8"].forEach((s, k) => text(g, s, x + w * 0.77, y + h * (0.18 + k * 0.075), w * 0.26, h * 0.05, SANS, "#efe9dc", "500"));
      for (let k = 0; k < 3; k++) { const lx = x + w * (0.2 + k * 0.3); box(g, lx, y, 1, h * 0.06, "#222"); glow(g, lx, y + h * 0.08, w * 0.16, "rgba(255,196,120,0.95)"); }
      floorLine("#3a2a1c");
      break;
    }
    case "pharmacy": {
      vgrad(g, x, y, w, h, "#f4f7f8", "#d5dde0");
      for (let s = 0; s < 5; s++) { const sy = y + h * (0.18 + s * 0.14); box(g, x + w * 0.03, sy + h * 0.1, w * 0.94, h * 0.012, "#b9c2c6"); for (let c = 0; c < 46; c++) { const bw = w * (0.012 + r() * 0.01); g.fillStyle = ["#e2e8ec", "#4fa3d1", "#e85c5c", "#7cc47a", "#f2c14e", "#ffffff", "#8e7cc3"][Math.floor(r() * 7)]; g.fillRect(x + w * 0.04 + c * w * 0.02, sy + h * (0.1 - 0.04 - r() * 0.04), bw, h * 0.1); } }
      box(g, x + w * 0.45, y + h * 0.03, w * 0.1, h * 0.12, "#1f9d55"); box(g, x + w * 0.485, y + h * 0.045, w * 0.03, h * 0.09, "#e8fff0"); box(g, x + w * 0.465, y + h * 0.075, w * 0.07, h * 0.03, "#e8fff0");
      floorLine("#c9d1d4");
      break;
    }
    case "books": case "atelier": {
      vgrad(g, x, y, w, h, "#4a3220", "#24170e");
      if (kind === "books") {
        for (let s = 0; s < 6; s++) { const sy = y + h * (0.07 + s * 0.14); box(g, x, sy + h * 0.12, w, h * 0.02, "#6b4a2c"); let bx = x + 2; while (bx < x + w - 4) { const bw = w * (0.006 + r() * 0.012), bh = h * (0.08 + r() * 0.04); g.fillStyle = rgb(60 + r() * 150, 40 + r() * 90, 30 + r() * 80); g.fillRect(bx, sy + h * 0.12 - bh, bw, bh); bx += bw + 1; } }
        glow(g, x + w * 0.5, y, w * 0.6, "rgba(255,200,130,0.6)");
      } else {
        vgrad(g, x, y, w, h, "#efe4d6", "#cdbba4");
        for (let k = 0; k < 9; k++) { g.fillStyle = rgb(160 + r() * 90, 120 + r() * 100, 110 + r() * 100); g.fillRect(x + w * (0.05 + k * 0.045), y + h * 0.2, w * 0.035, h * 0.55); }
        g.fillStyle = "#f8f4ec"; g.beginPath(); g.ellipse(x + w * 0.72, y + h * 0.42, w * 0.06, h * 0.14, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(x + w * 0.66, y + h * 0.5); g.quadraticCurveTo(x + w * 0.6, y + h * 0.86, x + w * 0.58, y + h * 0.88); g.lineTo(x + w * 0.86, y + h * 0.88); g.quadraticCurveTo(x + w * 0.84, y + h * 0.7, x + w * 0.78, y + h * 0.5); g.fill();
        glow(g, x + w * 0.72, y + h * 0.1, w * 0.3, "rgba(255,230,190,0.8)");
      }
      floorLine("#2a1c12");
      break;
    }
    case "bakery": {
      vgrad(g, x, y, w, h, "#d9a35c", "#8a5a2a");
      for (let s = 0; s < 3; s++) { const sy = y + h * (0.25 + s * 0.18); box(g, x + w * 0.05, sy, w * 0.9, h * 0.02, "#5a3a1c"); for (let k = 0; k < 16; k++) { g.fillStyle = rgb(200 + r() * 40, 140 + r() * 40, 70 + r() * 30); g.beginPath(); g.ellipse(x + w * (0.09 + k * 0.054), sy - h * 0.035, w * 0.024, h * 0.032, 0, 0, Math.PI * 2); g.fill(); } }
      text(g, "PÃES · DOCES · CAFÉ", x + w * 0.5, y + h * 0.1, w * 0.6, h * 0.08, SERIF, "#3a1e0c", "600", 2);
      floorLine("#4a2e18");
      break;
    }
    case "florist": {
      vgrad(g, x, y, w, h, "#2b3d2c", "#141d14");
      for (let t = 0; t < 3; t++) { const ty = y + h * (0.4 + t * 0.17); box(g, x + w * 0.04, ty, w * 0.92, h * 0.03, "#4b3a2a"); for (let k = 0; k < 12; k++) { const bx = x + w * (0.07 + k * 0.075); box(g, bx - w * 0.02, ty - h * 0.06, w * 0.04, h * 0.06, "#7f8a8c"); const col = [[240, 120, 150], [250, 250, 240], [250, 210, 80], [200, 40, 60], [180, 120, 220]][Math.floor(r() * 5)]; for (let f = 0; f < 9; f++) { g.fillStyle = rgb(col[0] * (0.8 + r() * 0.2), col[1] * (0.8 + r() * 0.2), col[2] * (0.8 + r() * 0.2)); g.beginPath(); g.arc(bx + (r() - 0.5) * w * 0.05, ty - h * (0.08 + r() * 0.06), w * 0.008, 0, Math.PI * 2); g.fill(); } } }
      glow(g, x + w * 0.3, y + h * 0.05, w * 0.4, "rgba(255,230,190,0.6)"); glow(g, x + w * 0.75, y + h * 0.05, w * 0.4, "rgba(255,230,190,0.6)");
      floorLine("#1d1a14");
      break;
    }
    case "bistro": case "bar": {
      box(g, x, y, w, h, kind === "bar" ? "#1a1014" : "#2a1a12");
      for (let k = 0; k < 24; k++) box(g, x + (w * k) / 24, y + h * 0.5, w / 24 - 1, h * 0.4, kind === "bar" ? "#2a1a1a" : "#4a2e1c");
      if (kind === "bistro") {
        box(g, x + w * 0.25, y + h * 0.08, w * 0.5, h * 0.36, "#c9a24a"); vgrad(g, x + w * 0.265, y + h * 0.1, w * 0.47, h * 0.32, "#6a5038", "#2a1c12");
        ["PRATO DO DIA", "STEAK FRITES", "VINHO DA CASA"].forEach((s, k) => text(g, s, x + w * 0.5, y + h * (0.17 + k * 0.08), w * 0.4, h * 0.055, SERIF, "#f3e6c8", "500"));
        for (let k = 0; k < 4; k++) glow(g, x + w * (0.12 + k * 0.25), y + h * 0.05, w * 0.12, "rgba(255,190,110,0.9)");
      } else {
        for (let s = 0; s < 3; s++) { const sy = y + h * (0.12 + s * 0.12); glow(g, x + w * 0.5, sy, w * 0.5, "rgba(255,160,70,0.35)"); box(g, x + w * 0.1, sy + h * 0.08, w * 0.8, h * 0.012, "#7a5530"); for (let k = 0; k < 22; k++) { g.fillStyle = rgb(80 + r() * 150, 40 + r() * 80, 20 + r() * 40, 0.95); g.fillRect(x + w * (0.12 + k * 0.035), sy + h * (0.08 - 0.07 - r() * 0.02), w * 0.012, h * 0.075); } }
      }
      floorLine("#120a08");
      break;
    }
    case "shoes": {
      vgrad(g, x, y, w, h, "#f2eee8", "#cfc6ba");
      for (let s = 0; s < 4; s++) { const sy = y + h * (0.22 + s * 0.17); box(g, x + w * 0.06, sy, w * 0.88, h * 0.012, "#bba98f"); for (let k = 0; k < 9; k++) { const sx = x + w * (0.1 + k * 0.095); g.fillStyle = ["#111", "#7a1020", "#c9a24a", "#e8e2d8", "#2c3e5a"][Math.floor(r() * 5)]; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + w * 0.05, sy); g.lineTo(sx + w * 0.05, sy - h * 0.03); g.quadraticCurveTo(sx + w * 0.02, sy - h * 0.035, sx + w * 0.012, sy - h * 0.07); g.lineTo(sx, sy - h * 0.07); g.fill(); } }
      floorLine("#a89a88");
      break;
    }
    case "perfume": {
      vgrad(g, x, y, w, h, "#f3d9d6", "#c49c98");
      text(g, "ÉTER", x + w * 0.5, y + h * 0.14, w * 0.3, h * 0.14, SERIF, "#5a2a30", "400", 8);
      for (let s = 0; s < 3; s++) { const sy = y + h * (0.38 + s * 0.17); box(g, x + w * 0.08, sy, w * 0.84, h * 0.01, "rgba(255,255,255,0.8)"); for (let k = 0; k < 14; k++) { const bx = x + w * (0.11 + k * 0.058), bh = h * (0.05 + r() * 0.04); g.fillStyle = `rgba(${200 + r() * 55},${150 + r() * 80},${120 + r() * 100},0.85)`; g.fillRect(bx, sy - bh, w * 0.024, bh); box(g, bx + w * 0.006, sy - bh - h * 0.015, w * 0.012, h * 0.015, "#c9a24a"); box(g, bx + w * 0.004, sy - bh, w * 0.004, bh, "rgba(255,255,255,0.6)"); } }
      floorLine("#9a7470");
      break;
    }
    case "optics": {
      vgrad(g, x, y, w, h, "#e6e8ea", "#b8bcc0");
      for (let s = 0; s < 5; s++) for (let k = 0; k < 10; k++) { const cx = x + w * (0.1 + k * 0.088), cy = y + h * (0.2 + s * 0.13); g.strokeStyle = ["#111", "#6a3a1c", "#c9a24a", "#2c3e5a"][Math.floor(r() * 4)]; g.lineWidth = Math.max(1, w / 260); g.beginPath(); g.ellipse(cx - w * 0.016, cy, w * 0.014, h * 0.025, 0, 0, Math.PI * 2); g.ellipse(cx + w * 0.016, cy, w * 0.014, h * 0.025, 0, 0, Math.PI * 2); g.stroke(); }
      floorLine("#8f9498");
      break;
    }
    case "gallery": {
      vgrad(g, x, y, w, h, "#f4f3f0", "#d6d4cf");
      for (let k = 0; k < 3; k++) {
        const fx = x + w * (0.1 + k * 0.3), fw = w * 0.2, fh = h * 0.42, fy = y + h * 0.22;
        box(g, fx - 3, fy - 3, fw + 6, fh + 6, "#1a1a1a");
        const cols = [[200, 60, 40], [30, 60, 120], [230, 180, 60], [20, 20, 20], [240, 230, 210]];
        for (let b = 0; b < 3; b++) { const c = cols[Math.floor(r() * cols.length)]; box(g, fx, fy + (fh * b) / 3, fw, fh / 3 + 1, rgb(c[0], c[1], c[2])); }
        glow(g, fx + fw / 2, fy - h * 0.06, fw * 0.9, "rgba(255,245,225,0.75)");
      }
      floorLine("#bdb8b0");
      break;
    }
    case "lobby": {
      vgrad(g, x, y, w, h, "#d8ccb8", "#a8987e");
      for (let k = 0; k < 8; k++) { g.strokeStyle = "rgba(120,100,80,0.35)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x + r() * w, y); g.bezierCurveTo(x + r() * w, y + h * 0.3, x + r() * w, y + h * 0.6, x + r() * w, y + h); g.stroke(); }
      for (let c = 0; c < 6; c++) for (let rr = 0; rr < 5; rr++) { box(g, x + w * (0.05 + c * 0.035), y + h * (0.35 + rr * 0.07), w * 0.03, h * 0.06, "#b58a3c"); box(g, x + w * (0.055 + c * 0.035), y + h * (0.37 + rr * 0.07), w * 0.02, h * 0.01, "#3a2a1a"); }
      vgrad(g, x + w * 0.42, y + h * 0.22, w * 0.16, h * 0.66, "#c7cdd2", "#7d858c"); box(g, x + w * 0.499, y + h * 0.22, 2, h * 0.66, "#4a5056"); box(g, x + w * 0.42, y + h * 0.18, w * 0.16, h * 0.04, "#b58a3c");
      glow(g, x + w * 0.5, y + h * 0.06, w * 0.4, "rgba(255,226,170,0.95)"); glow(g, x + w * 0.85, y + h * 0.4, w * 0.15, "rgba(255,210,150,0.6)");
      floorLine("#6e5e48");
      break;
    }
    case "closed": {
      vgrad(g, x, y, w, h, "#15161a", "#08090b");
      for (let k = 0; k < 3; k++) box(g, x + w * (0.2 + k * 0.12), y + h * (0.62 + (k % 2) * 0.08), w * 0.1, h * 0.28, "#24201a");
      box(g, x + w * 0.85, y + h * 0.12, w * 0.06, h * 0.05, "#0f6a3a"); glow(g, x + w * 0.88, y + h * 0.145, w * 0.06, "rgba(80,255,150,0.5)");
      break;
    }
  }
}

function interiorExtra(g: G, x: number, y: number, w: number, h: number, k: number, r: () => number) {
  switch (k) {
    case INT.sideWarm: vgrad(g, x, y, w, h, "#b8a68a", "#6a5a46"); glow(g, x + w * 0.5, y, w * 0.6, "rgba(255,220,170,0.45)"); break;
    case INT.sideCool: vgrad(g, x, y, w, h, "#eef2f4", "#b9c3c8"); break;
    case INT.sideDark: vgrad(g, x, y, w, h, "#2a2220", "#100c0a"); break;
    case INT.ceilWarm: box(g, x, y, w, h, "#4a4238"); for (let k = 0; k < 8; k++) { glow(g, x + w * (0.07 + k * 0.125), y + h * 0.5, h * 0.42, "rgba(255,226,180,0.85)"); box(g, x + w * (0.07 + k * 0.125) - 3, y + h * 0.5 - 3, 6, 6, "#fff6e6"); } break;
    case INT.ceilCool: box(g, x, y, w, h, "#8a9298"); for (let k = 0; k < 3; k++) box(g, x + w * 0.05, y + h * (0.2 + k * 0.28), w * 0.9, h * 0.08, "#ffffff"); break;
    case INT.floorWood: for (let k = 0; k < 16; k++) { const c = 120 + r() * 40; box(g, x, y + (h * k) / 16, w, h / 16 - 1, rgb(c, c * 0.68, c * 0.42)); } g.fillStyle = "rgba(255,230,190,0.18)"; g.fillRect(x, y, w, h * 0.5); break;
    case INT.floorTile: for (let i = 0; i < 16; i++) for (let j = 0; j < 8; j++) box(g, x + (w * i) / 16, y + (h * j) / 8, w / 16, h / 8, (i + j) % 2 ? "#1a1a1a" : "#e8e4dc"); break;
    case INT.floorStone: for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) { const c = 150 + r() * 30; box(g, x + (w * i) / 8 + 1, y + (h * j) / 4 + 1, w / 8 - 2, h / 4 - 2, rgb(c, c * 0.97, c * 0.92)); } break;
    case INT.pharmacyShelf: case INT.shoeShelf: case INT.bookShelf: case INT.bottleShelf: case INT.bread: case INT.garments: case INT.flowers: case INT.magazines: {
      const bg = { [INT.pharmacyShelf]: "#eef2f3", [INT.shoeShelf]: "#efe9e0", [INT.bookShelf]: "#3a2618", [INT.bottleShelf]: "#24160e", [INT.bread]: "#6a4524", [INT.garments]: "#2a2420", [INT.flowers]: "#2a3a26", [INT.magazines]: "#202020" }[k]!;
      box(g, x, y, w, h, bg);
      for (let s = 0; s < 4; s++) {
        const sy = y + (h * s) / 4, sh = h / 4;
        box(g, x, sy + sh - 3, w, 3, "rgba(0,0,0,0.5)");
        let px = x + 2;
        while (px < x + w - 2) {
          const pw = k === INT.garments ? w * (0.025 + r() * 0.02) : k === INT.magazines ? w * 0.07 : w * (0.012 + r() * 0.02), ph = sh * (k === INT.garments ? 0.95 : 0.5 + r() * 0.35);
          const col = k === INT.bread ? rgb(200 + r() * 40, 140 + r() * 40, 70 + r() * 30) : k === INT.flowers ? rgb(150 + r() * 105, 60 + r() * 190, 80 + r() * 160) : k === INT.bottleShelf ? rgb(90 + r() * 150, 50 + r() * 90, 20 + r() * 40) : rgb(40 + r() * 215, 40 + r() * 200, 40 + r() * 200);
          if (k === INT.magazines) { box(g, px, sy + sh * 0.1, pw - 3, sh * 0.82, col); box(g, px + 2, sy + sh * 0.14, pw - 7, sh * 0.12, "rgba(255,255,255,0.85)"); box(g, px + 2, sy + sh * 0.5, (pw - 7) * 0.7, sh * 0.06, "rgba(0,0,0,0.5)"); }
          else if (k === INT.flowers) { g.fillStyle = col; g.beginPath(); g.arc(px + pw / 2, sy + sh * 0.45, pw * 0.9, 0, Math.PI * 2); g.fill(); }
          else box(g, px, sy + sh - 3 - ph, pw, ph, col);
          px += pw + (k === INT.magazines ? 3 : 1);
        }
      }
      break;
    }
  }
}

export function interiorAtlas(q: Quality): THREE.Texture {
  return memo(`city-int:${q}`, () => {
    const CW = q === "high" ? 512 : 256, CH = CW / 2, W = CW * INT_COLS, H = CH * INT_ROWS, r = prng(411);
    const [c, g] = canvas(W, H);
    for (let k = 0; k < INT_COLS * INT_ROWS; k++) {
      const x = (k % INT_COLS) * CW, y = Math.floor(k / INT_COLS) * CH;
      clip(g, x, y, CW, CH, () => { if (k < SHOP_KINDS.length) shopWall(g, x, y, CW, CH, SHOP_KINDS[k], r); else interiorExtra(g, x, y, CW, CH, k, r); });
    }
    const t = texFrom(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
    return t;
  });
}

/* =========================================================================================================================
 * Letreiros: 4 × 8 células 4:1 — 0–15 o letreiro de cada loja (na ordem de SHOP_KINDS), 16–23 sanefas dos toldos, 24–31 a
 * lona dos toldos. O atlas gêmeo (glow) tem só o que acende: neon, letra retroiluminada, caixa de luz.
 * ========================================================================================================================= */
export const SIGN_COLS = 4, SIGN_ROWS = 8;
export interface ShopDef { kind: ShopKind; name: string; sub?: string; bg: string; ink: string; font: "serif" | "sans" | "script"; neon?: string; lightbox?: boolean; awning?: number }
/** As lojas da quadra (todas fictícias): o letreiro, as cores, o neon e, quando tem, o toldo (índice 0–7 nas sanefas/lonas). */
export const SHOPS: Record<ShopKind, ShopDef> = {
  fashion: { kind: "fashion", name: "MAISON VERANE", sub: "ALTA COSTURA · PRÊT-À-PORTER", bg: "#0e0e10", ink: "#e8d3a2", font: "serif", lightbox: true },
  jewelry: { kind: "jewelry", name: "OPALINE", sub: "JOALHERIA", bg: "#0d1626", ink: "#d7b56d", font: "serif", lightbox: true },
  cafe: { kind: "cafe", name: "Café Lumen", bg: "#1d3a2c", ink: "#fff1d6", font: "script", neon: "#ffe2b0", awning: 0 },
  pharmacy: { kind: "pharmacy", name: "FARMÁCIA AVENIDA", sub: "24 HORAS", bg: "#f4f7f6", ink: "#14834a", font: "sans", neon: "#3dff8c", lightbox: true },
  books: { kind: "books", name: "LIVRARIA VESPERTINA", sub: "LIVROS · DISCOS · CAFÉ", bg: "#13233c", ink: "#e9dcc0", font: "serif", awning: 1 },
  bakery: { kind: "bakery", name: "PADARIA ESTRELA", sub: "DESDE 1931", bg: "#6a1c1c", ink: "#f6e3c0", font: "serif", awning: 2 },
  florist: { kind: "florist", name: "ÍRIS FLORES", bg: "#24402c", ink: "#f3f0e6", font: "script", awning: 3 },
  bistro: { kind: "bistro", name: "BISTRÔ 1957", bg: "#3c0f16", ink: "#f2d9a6", font: "serif", neon: "#ffb36a", awning: 4 },
  bar: { kind: "bar", name: "BAR ALVORADA", bg: "#14090c", ink: "#ff6fae", font: "script", neon: "#ff4fa0" },
  shoes: { kind: "shoes", name: "SAPATARIA PRIMA", bg: "#111111", ink: "#f0f0f0", font: "sans", awning: 5 },
  perfume: { kind: "perfume", name: "ÉTER", sub: "PERFUMARIA", bg: "#f1d8d4", ink: "#5a2a30", font: "serif", lightbox: true, awning: 6 },
  optics: { kind: "optics", name: "ÓTICA CLARIDADE", bg: "#e9edf0", ink: "#1c2a3a", font: "sans", lightbox: true },
  gallery: { kind: "gallery", name: "GALERIA NOVE", bg: "#f4f3f0", ink: "#151515", font: "sans" },
  lobby: { kind: "lobby", name: "EDIFÍCIO SERENO", bg: "#1a2a20", ink: "#e9d9a6", font: "serif", awning: 7 },
  closed: { kind: "closed", name: "ALUGA-SE", sub: "TRATAR NO LOCAL", bg: "#f2c230", ink: "#151515", font: "sans" },
  atelier: { kind: "atelier", name: "ATELIÊ NOIVAS DO PARQUE", bg: "#f1ebe2", ink: "#6a4a3a", font: "script", lightbox: true },
};
/** Lona de cada toldo: [cor A, cor B, listrada?]. */
const AWNINGS: [string, string, boolean][] = [["#17382a", "#17382a", false], ["#13233c", "#e9dcc0", true], ["#8e1a1a", "#f3ead8", true], ["#24402c", "#f3f0e6", true], ["#3c0f16", "#3c0f16", false], ["#111111", "#f0f0f0", true], ["#d9a8a4", "#f6e8e4", true], ["#1a2a20", "#1a2a20", false]];
export const SIGN = { valance: (a: number) => 16 + a, cloth: (a: number) => 24 + a } as const;

export interface SignAtlas { map: THREE.Texture; glow: THREE.Texture }
export function signAtlas(q: Quality): SignAtlas {
  return memo(`city-sign:${q}`, () => {
    const CW = q === "high" ? 512 : 256, CH = CW / 4, W = CW * SIGN_COLS, H = CH * SIGN_ROWS;
    const [c, g] = canvas(W, H), [ce, ge] = canvas(W, H);
    ge.fillStyle = "#000"; ge.fillRect(0, 0, W, H);
    const fam = (f: ShopDef["font"]) => (f === "serif" ? SERIF : f === "script" ? SCRIPT : SANS);
    SHOP_KINDS.forEach((kind, k) => {
      const s = SHOPS[kind], x = (k % SIGN_COLS) * CW, y = Math.floor(k / SIGN_COLS) * CH;
      clip(g, x, y, CW, CH, () => {
        box(g, x, y, CW, CH, s.bg);
        g.strokeStyle = s.ink; g.globalAlpha = 0.6; g.lineWidth = CH * 0.03; g.strokeRect(x + CH * 0.08, y + CH * 0.1, CW - CH * 0.16, CH * 0.8); g.globalAlpha = 1;
        const mainY = s.sub ? y + CH * 0.42 : y + CH * 0.52, size = s.sub ? CH * 0.46 : CH * 0.62;
        text(g, s.name, x + CW / 2, mainY, CW * 0.82, size, fam(s.font), s.ink, s.font === "sans" ? "700" : "500", s.font === "script" ? 0 : CH * 0.04);
        if (s.sub) text(g, s.sub, x + CW / 2, y + CH * 0.76, CW * 0.7, CH * 0.16, SANS, s.ink, "600", CH * 0.03);
      });
      if (s.neon || s.lightbox) clip(ge, x, y, CW, CH, () => {
        const col = s.neon ?? s.ink;
        if (s.lightbox && !s.neon) { ge.globalAlpha = 0.18; box(ge, x, y, CW, CH, s.bg === "#0e0e10" || s.bg.startsWith("#0") || s.bg.startsWith("#1") ? "#222" : s.bg); ge.globalAlpha = 1; }
        const mainY = s.sub ? y + CH * 0.42 : y + CH * 0.52, size = s.sub ? CH * 0.46 : CH * 0.62;
        if (s.neon) { ge.shadowColor = col; ge.shadowBlur = CH * 0.18; }
        text(ge, s.name, x + CW / 2, mainY, CW * 0.82, size, fam(s.font), col, s.font === "sans" ? "700" : "500", s.font === "script" ? 0 : CH * 0.04);
        if (s.sub) text(ge, s.sub, x + CW / 2, y + CH * 0.76, CW * 0.7, CH * 0.16, SANS, col, "600", CH * 0.03);
        ge.shadowBlur = 0;
        if (kind === "pharmacy") { const cx = x + CW * 0.08, cy = y + CH / 2, a = CH * 0.32, b = CH * 0.11; box(ge, cx - b, cy - a, b * 2, a * 2, col); box(ge, cx - a, cy - b, a * 2, b * 2, col); box(g, cx - b, cy - a, b * 2, a * 2, "#14834a"); box(g, cx - a, cy - b, a * 2, b * 2, "#14834a"); }
      });
    });
    // sanefas (nome na faixa da frente do toldo) e lonas
    SHOP_KINDS.forEach((kind) => {
      const s = SHOPS[kind]; if (s.awning === undefined) return;
      const [a, b, striped] = AWNINGS[s.awning];
      for (const [cell, label] of [[SIGN.valance(s.awning), true], [SIGN.cloth(s.awning), false]] as const) {
        const x = (cell % SIGN_COLS) * CW, y = Math.floor(cell / SIGN_COLS) * CH;
        clip(g, x, y, CW, CH, () => {
          const n = striped ? 16 : 1;
          for (let k = 0; k < n; k++) box(g, x + (CW * k) / n, y, CW / n + 1, CH, k % 2 ? b : a);
          // tecido: trama e sujeira de chuva embaixo
          for (let k = 0; k < 60; k++) box(g, x, y + (CH * k) / 60, CW, 1, "rgba(0,0,0,0.05)");
          vgrad(g, x, y + CH * 0.6, CW, CH * 0.4, "rgba(0,0,0,0)", "rgba(0,0,0,0.22)");
          if (label) {
            box(g, x + CW * 0.2, y + CH * 0.18, CW * 0.6, CH * 0.64, striped ? a : "rgba(0,0,0,0)");
            text(g, s.name.toUpperCase(), x + CW / 2, y + CH * 0.52, CW * 0.56, CH * 0.5, s.font === "script" ? SERIF : fam(s.font), striped && a === "#f3ead8" ? "#8e1a1a" : "#f3ead8", "600", CH * 0.05);
          }
        });
      }
    });
    const map = texFrom(c, true), glowT = texFrom(ce, true);
    for (const t of [map, glowT]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; }
    return { map, glow: glowT };
  });
}

/* =========================================================================================================================
 * Panfletos e cartazes (4 × 4): festas, shows, a própria gala, liquidação, aulas, gato perdido — tudo fictício.
 * ========================================================================================================================= */
export const FLYER_COLS = 4, FLYER_ROWS = 4;
const FLYERS: { bg: string; ink: string; accent: string; title: string; lines: string[]; font: "serif" | "sans" | "script" }[] = [
  { bg: "#111111", ink: "#ff4fa0", accent: "#3df2ff", title: "FESTA NEON", lines: ["SÁBADO · 23H", "CLUBE SUBSOLO", "DJ ÍRIS · DJ KOBALT"], font: "sans" },
  { bg: "#f2e6c8", ink: "#3a1e0c", accent: "#b8913f", title: "Noite de Jazz", lines: ["QUINTETO ALVORADA", "SEX · 22H · BAR ALVORADA"], font: "script" },
  { bg: "#3c0711", ink: "#f3dca6", accent: "#d9b779", title: "GALA LUMIÈRE", lines: ["PROGRAMA DA NOITE", "MUSEU VESPER · 04.12"], font: "serif" },
  { bg: "#ffe14d", ink: "#151515", accent: "#e0201c", title: "LIQUIDAÇÃO", lines: ["ATÉ 70% OFF", "SAPATARIA PRIMA"], font: "sans" },
  { bg: "#f7f3ec", ink: "#1d2a4a", accent: "#c1121f", title: "AULAS DE TANGO", lines: ["INICIANTES · TER E QUI", "ESTÚDIO 3º ANDAR"], font: "serif" },
  { bg: "#ffffff", ink: "#111111", accent: "#555555", title: "PROCURA-SE", lines: ["GATO CINZA · MIMI", "RECOMPENSA"], font: "sans" },
  { bg: "#1d2a4a", ink: "#f2d38f", accent: "#ffffff", title: "AS VESPERTINAS", lines: ["TURNÊ DE INVERNO", "TEATRO ORVALHO · 21H"], font: "serif" },
  { bg: "#e8f4ea", ink: "#1f6b3a", accent: "#e85c5c", title: "FEIRA DE VINIL", lines: ["DOMINGO NA PRAÇA", "ENTRADA LIVRE"], font: "sans" },
  { bg: "#6a1fb0", ink: "#fff36b", accent: "#ffffff", title: "CIRCO ESTRELA", lines: ["ÚLTIMA SEMANA", "LONA DO PARQUE"], font: "sans" },
  { bg: "#0f2c35", ink: "#f3e2b8", accent: "#cdb98c", title: "AURORA", lines: ["EXPOSIÇÃO · CASA ORVALHO", "MUSEU VESPER"], font: "serif" },
  { bg: "#ff6b35", ink: "#111111", accent: "#ffffff", title: "CORRIDA 5K", lines: ["NOTURNA · 15/11", "INSCRIÇÕES ABERTAS"], font: "sans" },
  { bg: "#f1ebe2", ink: "#6a4a3a", accent: "#b79a5e", title: "Ateliê Noivas", lines: ["PROVA SEM HORA MARCADA", "AV. VESPER, 210"], font: "script" },
  { bg: "#202020", ink: "#e9e9e9", accent: "#ffcc00", title: "O BAILE", lines: ["UMA PEÇA EM 3 ATOS", "ESTREIA DIA 20"], font: "serif" },
  { bg: "#d8f0ff", ink: "#0d47a1", accent: "#e91e63", title: "AULA DE YOGA", lines: ["NO TERRAÇO · 7H", "PRIMEIRA AULA GRÁTIS"], font: "sans" },
  { bg: "#2b2b2b", ink: "#ff3b3b", accent: "#ffffff", title: "SHOW PUNK", lines: ["OS SEM NOME", "GARAGEM · 20H"], font: "sans" },
  { bg: "#f6e3c0", ink: "#6a1c1c", accent: "#b8913f", title: "Pão de Queijo", lines: ["SAINDO AGORA!", "PADARIA ESTRELA"], font: "script" },
];
/** Proporção do panfleto dentro da célula (retrato A5 no centro). */
export const FLYER_ASPECT = 0.707;
export function flyerAtlas(q: Quality): THREE.Texture {
  return memo(`city-flyer:${q}`, () => {
    const S = q === "high" ? 256 : 128, W = S * FLYER_COLS, H = S * FLYER_ROWS, [c, g] = canvas(W, H), r = prng(503);
    g.clearRect(0, 0, W, H);
    FLYERS.forEach((f, k) => {
      const cx = (k % FLYER_COLS) * S, cy = Math.floor(k / FLYER_COLS) * S, fw = S * FLYER_ASPECT, x = cx + (S - fw) / 2, y = cy;
      clip(g, x, y, fw, S, () => {
        box(g, x, y, fw, S, f.bg);
        // grafismo: faixas, círculos ou raios
        g.globalAlpha = 0.5; g.fillStyle = f.accent;
        if (k % 3 === 0) for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(x + fw * r(), y + S * r(), S * (0.05 + r() * 0.15), 0, Math.PI * 2); g.fill(); }
        else if (k % 3 === 1) for (let i = 0; i < 5; i++) g.fillRect(x, y + S * (0.55 + i * 0.07), fw, S * 0.025);
        else { g.save(); g.translate(x + fw / 2, y + S * 0.35); for (let i = 0; i < 18; i++) { g.rotate(Math.PI / 9); g.fillRect(0, -1, S * 0.5, 2); } g.restore(); }
        g.globalAlpha = 1;
        const fam = f.font === "serif" ? SERIF : f.font === "script" ? SCRIPT : SANS;
        text(g, f.title, x + fw / 2, y + S * 0.3, fw * 0.86, S * 0.16, fam, f.ink, f.font === "sans" ? "800" : "600");
        f.lines.forEach((l, i) => text(g, l, x + fw / 2, y + S * (0.62 + i * 0.1), fw * 0.84, S * 0.065, SANS, f.ink, "600"));
        // amassado e sujeira (papel na calçada)
        for (let i = 0; i < 5; i++) { g.strokeStyle = `rgba(0,0,0,${0.06 + r() * 0.08})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x + fw * r(), y); g.lineTo(x + fw * r(), y + S); g.stroke(); }
        const dirt = g.createRadialGradient(x + fw * r(), y + S * r(), 0, x + fw * 0.5, y + S * 0.5, S * 0.7); dirt.addColorStop(0, "rgba(60,50,40,0)"); dirt.addColorStop(1, "rgba(60,50,40,0.28)");
        g.fillStyle = dirt; g.fillRect(x, y, fw, S);
      });
    });
    const t = texFrom(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
    return t;
  });
}
/** Retângulo de UV do panfleto k (só o papel, sem a margem transparente da célula). */
export function flyerUV(k: number): [number, number, number, number] {
  const [u0, v0, u1, v1] = cellUV(k % (FLYER_COLS * FLYER_ROWS), FLYER_COLS, FLYER_ROWS, 0);
  const m = ((u1 - u0) * (1 - FLYER_ASPECT)) / 2;
  return [u0 + m + 0.001, v0 + 0.001, u1 - m - 0.001, v1 - 0.001];
}

/* ---------- porta de enrolar (aço ondulado, com cadeado e pichação fraca) ---------- */
export function gateTex(q: Quality): { map: THREE.Texture; normalMap: THREE.Texture } {
  return memo(`city-gate:${q}`, () => {
    const S = q === "high" ? 256 : 128, [c, g] = canvas(S, S), [cn, gn] = canvas(S, S);
    vgrad(g, 0, 0, S, S, "#8d9296", "#6c7176");
    for (let y = 0; y < S; y += S / 16) { vgrad(g, 0, y, S, S / 16, "#a3a8ac", "#5d6266"); box(g, 0, y + S / 16 - 1, S, 1, "#3a3e42"); }
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(90,60,40,${0.05 + Math.random() * 0.1})`; g.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 10, 1 + Math.random() * 4); }
    for (let y = 0; y < S; y += S / 16) { const gr = gn.createLinearGradient(0, y, 0, y + S / 16); gr.addColorStop(0, "rgb(128,200,200)"); gr.addColorStop(0.5, "rgb(128,128,255)"); gr.addColorStop(1, "rgb(128,56,200)"); gn.fillStyle = gr; gn.fillRect(0, y, S, S / 16); }
    const map = texFrom(c, true), normalMap = texFrom(cn, false);
    return { map, normalMap };
  });
}

/* ---------- skyline: grade de janelas com padrão irregular de luz (andares de escritório acesos, apartamentos salpicados) ---------- */
export function skylineTex(q: Quality, seed: number): { map: THREE.Texture; emissive: THREE.Texture; meters: [number, number] } {
  return memo(`city-sky:${q}:${seed}`, () => {
    const S = q === "high" ? 512 : 256, COLS = 16, ROWS = 20, cw = S / COLS, ch = S / ROWS, r = prng(seed);
    const [c, g] = canvas(S, S), [ce, ge] = canvas(S, S);
    vgrad(g, 0, 0, S, S, "#1b2029", "#11151b"); box(ge, 0, 0, S, S, "#000");
    for (let row = 0; row < ROWS; row++) {
      const office = r() < 0.18, warmth = r();
      for (let col = 0; col < COLS; col++) {
        const lit = office ? r() < 0.85 : r() < 0.2, x = col * cw + cw * 0.18, y = row * ch + ch * 0.2, w = cw * 0.64, h = ch * 0.58;
        box(g, x, y, w, h, "#2a3340");
        if (lit) { const col2 = office ? (warmth < 0.5 ? "#e8eeff" : "#fff2d8") : ["#ffcf8a", "#ffd9a0", "#ffe6c0", "#9fb8ff"][Math.floor(r() * 4)]; box(ge, x, y, w, h, col2); ge.globalAlpha = 0.5 + r() * 0.5; box(ge, x, y, w, h, "#000"); ge.globalAlpha = 1; }
      }
    }
    const map = texFrom(c, true), emissive = texFrom(ce, true);
    return { map, emissive, meters: [COLS * 3, ROWS * 3.4] };
  });
}

/* ---------- painel de fotos da gala (step-and-repeat): logotipos repetidos em diagonal ---------- */
export function stepRepeatTex(q: Quality): THREE.Texture {
  return memo(`city-step:${q}`, () => {
    const W = q === "high" ? 1024 : 512, H = W * 0.8, [c, g] = canvas(W, H);
    vgrad(g, 0, 0, W, H, "#f7f1e6", "#ece3d3");
    const cols = 5, rows = 6, cw = W / cols, rh = H / rows;
    for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) {
      const x = cc * cw + (rr % 2 ? cw / 2 : 0), y = rr * rh + rh / 2, k = (rr + cc) % 3;
      if (k === 0) { text(g, "GALA", x, y - rh * 0.14, cw * 0.5, rh * 0.18, SANS, "#8a6a2f", "600", 3); text(g, "LUMIÈRE", x, y + rh * 0.1, cw * 0.7, rh * 0.32, SERIF, "#3c0711", "400", 1); }
      else if (k === 1) { text(g, "MUSEU VESPER", x, y, cw * 0.75, rh * 0.2, SANS, "#151515", "700", 4); }
      else { text(g, "Casa Orvalho", x, y, cw * 0.7, rh * 0.32, SCRIPT, "#0f2c35", "500"); }
    }
    const t = texFrom(c, true); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
    return t;
  });
}
