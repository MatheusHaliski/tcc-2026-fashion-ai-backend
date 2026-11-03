/*
 * MET Gala Heist v2 — texturas procedurais da cena externa (canvas, sem baixar imagens): pedra calcária em fiadas,
 * cantaria rusticada, granito, asfalto molhado com poças, calçada de placas de concreto, tapete da gala, tijolo, fachadas
 * de apartamentos com janelas acesas, folhagem, banners da exposição, letreiros e manchas de luz.
 *
 * Cada textura sai em escala de mundo: o tamanho em metros que ela cobre está em `meters`, e a geometria usa UV em metros
 * (exterior-geometry.ts), então `repeat = 1 / meters`. Mapas de cor em sRGB; normal e ORM (R oclusão, G rugosidade,
 * B metal) lineares. Tudo é gerado uma vez por qualidade e fica em cache no módulo (remontar a cena não refaz nada).
 */
import * as THREE from "three";
import { canvas, fieldOf, memo, prng, samp, texFrom, type Quality } from "./exterior-tex-core";

/* a base (cache, ruído, canvas → textura), os conjuntos PBR e as texturas com texto ficam em módulos próprios */
export { canvas, fieldOf, memo, normalFrom, prng, samp, smooth, texFrom, type PbrSet, type Quality } from "./exterior-tex-core";
export { asphaltSet, brickSet, carpetSet, grainNormal, graniteSet, sidewalkSet, stoneSet } from "./exterior-tex-pbr";
export { fitFont, SANS, SERIF, SIGNAGE, spaced } from "./exterior-tex-type";
export { bannerTex, cateringTex, fanSignTex, inscriptionTex, plaqueTex, signTex, type BannerKind } from "./exterior-tex-signs";

/* ---------- fachadas da vizinhança ---------- */
export interface FacadeTex { map: THREE.Texture; emissive: THREE.Texture; bays: number; floors: number; bay: number; floor: number }
/** Fachada de prédio de apartamentos: 8 vãos × 8 andares por textura (2,4 m × 3,2 m cada). Janelas acesas (âmbar,
 * algumas azuladas de TV), cortinas, persianas meio baixadas, escuras com reflexo do céu. `style`: pré-guerra em calcário,
 * tijolo com vergas claras ou vidro e esquadrias escuras. */
export function facadeTex(q: Quality, style: "limestone" | "brick" | "modern", seed: number): FacadeTex {
  return memo(`facade:${q}:${style}:${seed}`, () => {
    const B = 8, F = 8, S = q === "high" ? 1024 : 512, bw = S / B, fh = S / F, r = prng(seed);
    const [c, g] = canvas(S, S); const [ce, ge] = canvas(S, S);
    const wall = style === "limestone" ? "#b9ab92" : style === "brick" ? "#7b3b2c" : "#2a2e35";
    g.fillStyle = wall; g.fillRect(0, 0, S, S);
    const noise = fieldOf(256, seed, 5, 4);
    const id = g.getImageData(0, 0, S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const k = 0.85 + 0.3 * samp(noise, 256, x * 256 / S, y * 256 / S); const o = (y * S + x) * 4; id.data[o] *= k; id.data[o + 1] *= k; id.data[o + 2] *= k; }
    g.putImageData(id, 0, 0);
    ge.fillStyle = "#000"; ge.fillRect(0, 0, S, S);
    for (let f = 0; f < F; f++) {
      // cornija de andar (calcário) / verga (tijolo)
      if (style !== "modern") { g.fillStyle = style === "limestone" ? "rgba(70,60,45,0.35)" : "rgba(210,200,180,0.55)"; g.fillRect(0, f * fh + fh * 0.06, S, fh * 0.03); }
      for (let b = 0; b < B; b++) {
        const x0 = b * bw + bw * (style === "modern" ? 0.08 : 0.24), w = bw * (style === "modern" ? 0.84 : 0.52), y0 = f * fh + fh * 0.2, h = fh * (style === "modern" ? 0.72 : 0.62);
        const lit = r() < 0.38, tv = lit && r() < 0.18, blinds = r();
        if (style === "brick") { g.fillStyle = "#cfc4ae"; g.fillRect(x0 - 3, y0 - fh * 0.06, w + 6, fh * 0.06); g.fillRect(x0 - 2, y0 + h, w + 4, fh * 0.035); }
        if (style === "limestone") { g.fillStyle = "rgba(60,52,40,0.55)"; g.fillRect(x0 - 4, y0 - 4, w + 8, h + 8); }
        // vidro escuro com o céu refletido
        const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, "#1d2533"); gr.addColorStop(1, "#0b0e14");
        g.fillStyle = gr; g.fillRect(x0, y0, w, h);
        if (lit) {
          const warm = tv ? [120, 150, 255] : [255, 196 - r() * 40, 120 - r() * 50];
          const eg = ge.createRadialGradient(x0 + w / 2, y0 + h * 0.65, 2, x0 + w / 2, y0 + h * 0.5, h * 0.8);
          eg.addColorStop(0, `rgb(${warm[0]},${warm[1]},${warm[2]})`); eg.addColorStop(1, `rgb(${warm[0] * 0.45},${warm[1] * 0.42},${warm[2] * 0.38})`);
          ge.fillStyle = eg; ge.fillRect(x0, y0, w, h);
          g.fillStyle = `rgb(${warm[0] * 0.8},${warm[1] * 0.7},${warm[2] * 0.6})`; g.fillRect(x0, y0, w, h);
          // cortina e persiana (sombras na luz)
          if (blinds < 0.5) { ge.fillStyle = "rgba(0,0,0,0.55)"; ge.fillRect(x0, y0, w * (0.2 + r() * 0.2), h); ge.fillRect(x0 + w * (0.75 + r() * 0.1), y0, w, h); }
          if (blinds > 0.7) { ge.fillStyle = "rgba(0,0,0,0.75)"; ge.fillRect(x0, y0, w, h * (0.25 + r() * 0.4)); }
        }
        // caixilho
        g.strokeStyle = style === "modern" ? "#11151b" : "#2c2620"; g.lineWidth = Math.max(1, S / 512);
        g.strokeRect(x0, y0, w, h); g.beginPath(); g.moveTo(x0 + w / 2, y0); g.lineTo(x0 + w / 2, y0 + h); g.moveTo(x0, y0 + h * 0.5); g.lineTo(x0 + w, y0 + h * 0.5); g.stroke();
        ge.strokeStyle = "#000"; ge.lineWidth = Math.max(1, S / 512); ge.strokeRect(x0, y0, w, h); ge.beginPath(); ge.moveTo(x0 + w / 2, y0); ge.lineTo(x0 + w / 2, y0 + h); ge.stroke();
      }
    }
    const map = texFrom(c, true), emissive = texFrom(ce, true);
    return { map, emissive, bays: B, floors: F, bay: 2.4, floor: 3.2 };
  });
}

/* ---------- vegetação ---------- */
/** Cachos de folhas com fundo transparente (cartões da copa das árvores e cercas vivas). */
export function leafTex(q: Quality, hue: "green" | "dark" = "green"): THREE.Texture {
  return memo(`leaf:${q}:${hue}`, () => {
    const S = q === "high" ? 256 : 128, [c, g] = canvas(S, S), r = prng(hue === "green" ? 81 : 82);
    g.clearRect(0, 0, S, S);
    for (let k = 0; k < 46; k++) {
      const x = S * (0.12 + r() * 0.76), y = S * (0.12 + r() * 0.76), a = r() * Math.PI * 2, l = S * (0.07 + r() * 0.06), w = l * 0.55;
      const base = hue === "green" ? [52 + r() * 40, 82 + r() * 50, 30 + r() * 25] : [26 + r() * 20, 46 + r() * 26, 24 + r() * 14];
      g.save(); g.translate(x, y); g.rotate(a);
      const gr = g.createLinearGradient(-w, 0, w, 0); gr.addColorStop(0, `rgb(${base[0] * 0.7},${base[1] * 0.7},${base[2] * 0.7})`); gr.addColorStop(1, `rgb(${base[0] * 1.2},${base[1] * 1.15},${base[2]})`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, -l); g.quadraticCurveTo(w, -l * 0.2, 0, l); g.quadraticCurveTo(-w, -l * 0.2, 0, -l); g.fill();
      g.strokeStyle = `rgba(20,30,10,0.45)`; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -l); g.lineTo(0, l); g.stroke();
      g.restore();
    }
    const t = texFrom(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

/* ---------- luz ---------- */
/** Mancha de luz radial (poças de luz dos postes, halo de lâmpadas, flash). */
/** Cabeça de flor para cartões cruzados (arranjos da escadaria): quatro camadas de pétalas, do contorno solto ao miolo
 * fechado, com a base de cada pétala na sombra e a borda clara; em cinza, para a cor de cada instância tingir. Alfa recortado. */
export function bloomTex(q: Quality): THREE.Texture {
  return memo(`bloom:${q}`, () => {
    const S = q === "high" ? 256 : 128, [c, g] = canvas(S, S), r = prng(61), cx = S / 2;
    for (let layer = 0; layer < 4; layer++) {
      const n = 9 - layer, R = S * (0.47 - layer * 0.095), w = R * (0.6 - layer * 0.04), base = 160 + layer * 24;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + layer * 0.7 + (r() - 0.5) * 0.45, len = R * (0.88 + r() * 0.12);
        g.save(); g.translate(cx, cx); g.rotate(a);
        const grd = g.createLinearGradient(0, 0, len, 0), lo = Math.round(base * 0.5), mid = base, hi = Math.min(255, base + 45);
        grd.addColorStop(0, `rgb(${lo},${lo},${lo})`); grd.addColorStop(0.55, `rgb(${mid},${mid},${mid})`); grd.addColorStop(1, `rgb(${hi},${hi},${hi})`);
        g.fillStyle = grd;
        g.beginPath(); g.moveTo(0, 0);
        g.bezierCurveTo(len * 0.3, -w, len * 0.92, -w * 0.85, len, (r() - 0.5) * w * 0.2);
        g.bezierCurveTo(len * 0.92, w * 0.85, len * 0.3, w, 0, 0);
        g.fill();
        g.strokeStyle = "rgba(40,40,40,0.22)"; g.lineWidth = Math.max(1, S / 170); g.stroke();
        g.restore();
      }
    }
    const core = g.createRadialGradient(cx, cx, 0, cx, cx, S * 0.09);
    core.addColorStop(0, "rgb(96,90,84)"); core.addColorStop(1, "rgba(150,144,138,0)");
    g.fillStyle = core; g.beginPath(); g.arc(cx, cx, S * 0.09, 0, Math.PI * 2); g.fill();
    const t = texFrom(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
    return t;
  });
}

export function glowTex(kind: "soft" | "star" = "soft"): THREE.Texture {
  return memo(`glow:${kind}`, () => {
    const S = 128, [c, g] = canvas(S, S);
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(kind === "star" ? 0.12 : 0.25, "rgba(255,255,255,0.55)"); gr.addColorStop(0.6, "rgba(255,255,255,0.12)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    if (kind === "star") {
      g.globalCompositeOperation = "lighter";
      for (const a of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
        g.save(); g.translate(S / 2, S / 2); g.rotate(a);
        const lg = g.createLinearGradient(-S / 2, 0, S / 2, 0); lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, a % (Math.PI / 2) === 0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.35)"); lg.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = lg; g.fillRect(-S / 2, -1.2, S, 2.4); g.restore();
      }
    }
    const t = texFrom(c, false); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}
