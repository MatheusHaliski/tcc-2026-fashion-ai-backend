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
import { canvas, memo, prng, texFrom, type Quality } from "./exterior-tex-core";
import { SANS, SERIF } from "./exterior-tex-type";
import { box, SCRIPT, text, vgrad } from "./exterior-citytex-paint";

/* cada atlas fica no seu módulo; este reexporta todos para quem monta a cidade */
export { cellUV } from "./exterior-citytex-paint";
export { WIN_COLS, WIN_LIT, WIN_ROWS, windowAtlas, type WinAtlas } from "./exterior-citytex-windows";
export { INT, INT_COLS, INT_ROWS, interiorAtlas, SHOP_KINDS, type ShopKind } from "./exterior-citytex-interior";
export { SHOPS, SIGN, SIGN_COLS, SIGN_ROWS, signAtlas, type ShopDef, type SignAtlas } from "./exterior-citytex-signs";
export { FLYER_ASPECT, FLYER_COLS, FLYER_ROWS, flyerAtlas, flyerUV } from "./exterior-citytex-flyers";

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
