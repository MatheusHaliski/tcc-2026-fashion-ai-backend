/*
 * MET Gala Heist v2 — atlas dos letreiros das lojas (fachada, sanefa e lona dos toldos) com o brilho do neon num atlas
 * gêmeo; as lojas e os textos são fictícios (os nomes vêm de exterior-copy.ts, por idioma).
 */
import * as THREE from "three";
import { sceneLocale, type SceneLocale } from "./interior-copy";
import { STORE_COPY } from "./exterior-copy";
import { canvas, memo, texFrom, type Quality } from "./exterior-tex-core";
import { SANS, SERIF } from "./exterior-tex-type";
import { box, clip, SCRIPT, text, vgrad } from "./exterior-citytex-paint";
import { SHOP_KINDS, type ShopKind } from "./exterior-citytex-interior";

/* =========================================================================================================================
 * Letreiros: 4 × 8 células 4:1 — 0–15 o letreiro de cada loja (na ordem de SHOP_KINDS), 16–23 sanefas dos toldos, 24–31 a
 * lona dos toldos. O atlas gêmeo (glow) tem só o que acende: neon, letra retroiluminada, caixa de luz.
 * ========================================================================================================================= */
export const SIGN_COLS = 4, SIGN_ROWS = 8;
export interface ShopDef { kind: ShopKind; bg: string; ink: string; font: "serif" | "sans" | "script"; neon?: string; lightbox?: boolean; awning?: number }
/** As lojas da quadra (todas fictícias): o letreiro, as cores, o neon e, quando tem, o toldo (índice 0–7 nas sanefas/lonas). */
export const SHOPS: Record<ShopKind, ShopDef> = {
  fashion: { kind: "fashion", bg: "#0e0e10", ink: "#e8d3a2", font: "serif", lightbox: true },
  jewelry: { kind: "jewelry", bg: "#0d1626", ink: "#d7b56d", font: "serif", lightbox: true },
  cafe: { kind: "cafe", bg: "#1d3a2c", ink: "#fff1d6", font: "script", neon: "#ffe2b0", awning: 0 },
  pharmacy: { kind: "pharmacy", bg: "#f4f7f6", ink: "#14834a", font: "sans", neon: "#3dff8c", lightbox: true },
  books: { kind: "books", bg: "#13233c", ink: "#e9dcc0", font: "serif", awning: 1 },
  bakery: { kind: "bakery", bg: "#6a1c1c", ink: "#f6e3c0", font: "serif", awning: 2 },
  florist: { kind: "florist", bg: "#24402c", ink: "#f3f0e6", font: "script", awning: 3 },
  bistro: { kind: "bistro", bg: "#3c0f16", ink: "#f2d9a6", font: "serif", neon: "#ffb36a", awning: 4 },
  bar: { kind: "bar", bg: "#14090c", ink: "#ff6fae", font: "script", neon: "#ff4fa0" },
  shoes: { kind: "shoes", bg: "#111111", ink: "#f0f0f0", font: "sans", awning: 5 },
  perfume: { kind: "perfume", bg: "#f1d8d4", ink: "#5a2a30", font: "serif", lightbox: true, awning: 6 },
  optics: { kind: "optics", bg: "#e9edf0", ink: "#1c2a3a", font: "sans", lightbox: true },
  gallery: { kind: "gallery", bg: "#f4f3f0", ink: "#151515", font: "sans" },
  lobby: { kind: "lobby", bg: "#1a2a20", ink: "#e9d9a6", font: "serif", awning: 7 },
  closed: { kind: "closed", bg: "#f2c230", ink: "#151515", font: "sans" },
  atelier: { kind: "atelier", bg: "#f1ebe2", ink: "#6a4a3a", font: "script", lightbox: true },
};
/** Lona de cada toldo: [cor A, cor B, listrada?]. */
const AWNINGS: [string, string, boolean][] = [["#17382a", "#17382a", false], ["#13233c", "#e9dcc0", true], ["#8e1a1a", "#f3ead8", true], ["#24402c", "#f3f0e6", true], ["#3c0f16", "#3c0f16", false], ["#111111", "#f0f0f0", true], ["#d9a8a4", "#f6e8e4", true], ["#1a2a20", "#1a2a20", false]];
export const SIGN = { valance: (a: number) => 16 + a, cloth: (a: number) => 24 + a } as const;

export interface SignAtlas { map: THREE.Texture; glow: THREE.Texture }
export function signAtlas(q: Quality, locale: SceneLocale = sceneLocale()): SignAtlas {
  const copy = STORE_COPY[locale];
  return memo(`city-sign:${q}:${locale}`, () => {
    const CW = q === "high" ? 512 : 256, CH = CW / 4, W = CW * SIGN_COLS, H = CH * SIGN_ROWS;
    const [c, g] = canvas(W, H), [ce, ge] = canvas(W, H);
    ge.fillStyle = "#000"; ge.fillRect(0, 0, W, H);
    const fam = (f: ShopDef["font"]) => (f === "serif" ? SERIF : f === "script" ? SCRIPT : SANS);
    SHOP_KINDS.forEach((kind, k) => {
      const s = { ...SHOPS[kind], ...copy[kind] }, x = (k % SIGN_COLS) * CW, y = Math.floor(k / SIGN_COLS) * CH;
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
      const s = { ...SHOPS[kind], ...copy[kind] }; if (s.awning === undefined) return;
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
