/*
 * MET Gala Heist v2 — atlas dos panfletos e cartazes colados na cidade (textos de exterior-copy.ts, por idioma) e o
 * retângulo de UV de cada panfleto.
 */
import * as THREE from "three";
import { sceneLocale, type SceneLocale } from "./interior-copy";
import { FLYER_COPY } from "./exterior-copy";
import { canvas, memo, prng, texFrom, type Quality } from "./exterior-tex-core";
import { SANS, SERIF } from "./exterior-tex-type";
import { box, cellUV, clip, SCRIPT, text } from "./exterior-citytex-paint";

/* =========================================================================================================================
 * Panfletos e cartazes (4 × 4): festas, shows, a própria gala, liquidação, aulas, gato perdido — tudo fictício.
 * ========================================================================================================================= */
export const FLYER_COLS = 4, FLYER_ROWS = 4;
/** Estilo de cada panfleto (cores e fonte); os textos vêm de exterior-copy.ts, por idioma, na mesma ordem. */
const FLYER_STYLES: { bg: string; ink: string; accent: string; font: "serif" | "sans" | "script" }[] = [
  { bg: "#111111", ink: "#ff4fa0", accent: "#3df2ff", font: "sans" },
  { bg: "#f2e6c8", ink: "#3a1e0c", accent: "#b8913f", font: "script" },
  { bg: "#3c0711", ink: "#f3dca6", accent: "#d9b779", font: "serif" },
  { bg: "#ffe14d", ink: "#151515", accent: "#e0201c", font: "sans" },
  { bg: "#f7f3ec", ink: "#1d2a4a", accent: "#c1121f", font: "serif" },
  { bg: "#ffffff", ink: "#111111", accent: "#555555", font: "sans" },
  { bg: "#1d2a4a", ink: "#f2d38f", accent: "#ffffff", font: "serif" },
  { bg: "#e8f4ea", ink: "#1f6b3a", accent: "#e85c5c", font: "sans" },
  { bg: "#6a1fb0", ink: "#fff36b", accent: "#ffffff", font: "sans" },
  { bg: "#0f2c35", ink: "#f3e2b8", accent: "#cdb98c", font: "serif" },
  { bg: "#ff6b35", ink: "#111111", accent: "#ffffff", font: "sans" },
  { bg: "#f1ebe2", ink: "#6a4a3a", accent: "#b79a5e", font: "script" },
  { bg: "#202020", ink: "#e9e9e9", accent: "#ffcc00", font: "serif" },
  { bg: "#d8f0ff", ink: "#0d47a1", accent: "#e91e63", font: "sans" },
  { bg: "#2b2b2b", ink: "#ff3b3b", accent: "#ffffff", font: "sans" },
  { bg: "#f6e3c0", ink: "#6a1c1c", accent: "#b8913f", font: "script" },
];
/** Proporção do panfleto dentro da célula (retrato A5 no centro). */
export const FLYER_ASPECT = 0.707;
export function flyerAtlas(q: Quality, locale: SceneLocale = sceneLocale()): THREE.Texture {
  const copy = FLYER_COPY[locale];
  return memo(`city-flyer:${q}:${locale}`, () => {
    const S = q === "high" ? 256 : 128, W = S * FLYER_COLS, H = S * FLYER_ROWS, [c, g] = canvas(W, H), r = prng(503);
    g.clearRect(0, 0, W, H);
    FLYER_STYLES.forEach((f, k) => {
      const c = copy[k];
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
        text(g, c.title, x + fw / 2, y + S * 0.3, fw * 0.86, S * 0.16, fam, f.ink, f.font === "sans" ? "800" : "600");
        c.lines.forEach((l, i) => text(g, l, x + fw / 2, y + S * (0.62 + i * 0.1), fw * 0.84, S * 0.065, SANS, f.ink, "600"));
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
