/*
 * MET Gala Heist v2 — atlas dos interiores das lojas vistos pela vitrine: a parede do fundo de cada ramo
 * (exterior-citytex-shopwall.ts), as paredes laterais, os tetos, os pisos e as frentes de prateleira dos móveis de loja.
 */
import * as THREE from "three";
import { canvas, memo, prng, texFrom, type Quality } from "./exterior-tex-core";
import { box, clip, glow, rgb, vgrad, type G } from "./exterior-citytex-paint";
import { shopWall } from "./exterior-citytex-shopwall";

/* =========================================================================================================================
 * Interiores das lojas (vistos pela vitrine): 4 × 8 células 2:1. Uma textura só faz mapa e emissivo (luz "assada").
 * ========================================================================================================================= */
export const INT_COLS = 4, INT_ROWS = 8;
export const SHOP_KINDS = ["fashion", "jewelry", "cafe", "pharmacy", "books", "bakery", "florist", "bistro", "bar", "shoes", "perfume", "optics", "gallery", "lobby", "closed", "atelier"] as const;
export type ShopKind = (typeof SHOP_KINDS)[number];
/** Células extras do atlas de interiores. */
export const INT = { sideWarm: 16, sideCool: 17, sideDark: 18, ceilWarm: 19, ceilCool: 20, floorWood: 21, floorTile: 22, floorStone: 23, pharmacyShelf: 24, bookShelf: 25, bottleShelf: 26, bread: 27, shoeShelf: 28, garments: 29, flowers: 30, magazines: 31 } as const;

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
