/*
 * MET Gala Heist v2 — mobiliário da avenida: textos pintados do mobiliário (mapa da linha de ônibus e as placas), memorizados por hook.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { bannerTex, inscriptionTex, prng, type Quality, SIGNAGE, signTex } from "./exterior-textures";

/* ---------- textos pintados ---------- */
/** Mapa da linha no abrigo: o traçado das quatro linhas, os pontos e o "você está aqui". */
export function routeMapTex(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = 256; c.height = 360; const g = c.getContext("2d")!;
  g.fillStyle = "#f4f2ec"; g.fillRect(0, 0, 256, 360); g.fillStyle = "#123a6b"; g.fillRect(0, 0, 256, 44);
  g.fillStyle = "#ffffff"; g.font = "700 22px Arial, sans-serif"; g.textAlign = "center"; g.fillText("LINHAS NOTURNAS", 128, 30);
  const r = prng(88), cols = ["#e0201c", "#1d6fd1", "#f2a900", "#2e9e4f"];
  cols.forEach((col, k) => { g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); let x = 30 + k * 10, y = 70; g.moveTo(x, y); for (let s = 0; s < 6; s++) { x = Math.min(226, Math.max(30, x + (r() - 0.5) * 80)); y += 45; g.lineTo(x, y); } g.stroke(); });
  for (let k = 0; k < 14; k++) { g.fillStyle = "#ffffff"; g.strokeStyle = "#222"; g.lineWidth = 2; g.beginPath(); g.arc(30 + r() * 196, 70 + r() * 260, 5, 0, Math.PI * 2); g.fill(); g.stroke(); }
  g.fillStyle = "#e0201c"; g.beginPath(); g.arc(128, 200, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = "#111"; g.font = "600 13px Arial, sans-serif"; g.fillText("VOCÊ ESTÁ AQUI", 128, 226);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function useTextures(q: Quality) {
  return useMemo(() => ({
    ad: bannerTex(q, "lumiere"),
    busSign: signTex("bus-stop", ["PONTO DE ÔNIBUS", "207 · 315 · 422 · NOTURNO N12"], { w: 256, h: 256, bg: "#123a6b", ink: "#ffffff", font: "sans" }),
    kioskSign: signTex("kiosk", ["BANCA DA AVENIDA", "JORNAIS · REVISTAS · CIGARROS · BALAS"], { w: 768, h: 128, bg: "#0f3d2a", ink: "#f3e9c8", font: "sans" }),
    parkSign: signTex("no-parking", ["PROIBIDO ESTACIONAR", "EVENTO · 18H ÀS 4H", "GUINCHO"], { w: 256, h: 320, bg: "#f2f2f2", ink: "#c1121f", font: "sans", border: "#c1121f" }),
    valetSign: signTex("valet", ["MANOBRISTA", "GALA LUMIÈRE"], { w: 512, h: 256, bg: "#0c0b0a", ink: "#d9b779", font: "serif", border: "#b8913f" }),
    totem: signTex("totem", ["GALA", "LUMIÈRE", "CONVIDADOS"], { w: 192, h: 448, bg: "#0c0b0a", ink: "#e8cf96", font: "serif" }),
    street: signTex("street-names", [SIGNAGE.avenue, SIGNAGE.street], { w: 512, h: 192, bg: "#0f5a32", ink: "#ffffff", font: "sans", border: "#ffffff" }),
    inscription: inscriptionTex(q, "MUSEU VESPER · MCMXXXI"),
    routeMap: routeMapTex(),
  }), [q]);
}
