/*
 * MET Gala Heist v2 — Sala das Joias (Z08): texturas e materiais próprios, gerados no navegador.
 *  · piso de mármore Nero Marquina em placas de 75 cm com veios brancos ramificados e juntas finas, polido; faixa de
 *    Rosso Levanto junto às paredes; mármore Thassos e latão na rosácea sob o pedestal;
 *  · parede de seda adamascada ameixa (o desenho acetinado brilha, o fundo é fosco: só a rugosidade muda);
 *  · laca ameixa-negra do teto e do friso, anéis da trava do pedestal com os símbolos gravados, a ficha do laudo de
 *    conservação e as etiquetas (gavetas, caixas livres de ácido, vitrines).
 */
import * as THREE from "three";
import { RING_SYMBOLS } from "@/lib/heist/level";
import { HAND, SANS, SERIF, drawSymbol, type Quality } from "../interior-tex";
import { fbm, mix, once, paint, qs, smooth, surf, surfMat, vein, vnoise, wrap, type Lang } from "./galeria-kit";
import { GAL_COPY } from "./galeria-copy";

/* ---------- mármores ---------- */
function nero(u: number, v: number, o: Float32Array) {
  const lu = u * 2 % 1, lv = v * 2 % 1, j = Math.min(lu, 1 - lu, lv, 1 - lv), sq = Math.floor(u * 2) + 2 * Math.floor(v * 2);
  const t = fbm(u, v, 3, 611 + sq, 5) * 5.5 + (sq % 2 ? u - v : u + v) * 2.6 + sq * 0.37;
  const w = Math.max(vein(t, 0.03), vein(t * 2.2 + 0.4, 0.016) * 0.6, vein(t * 0.5 + 1.3, 0.05) * 0.22) * (0.35 + 0.65 * fbm(u, v, 6, 613, 2));
  const base = 0.022 + 0.014 * fbm(u, v, 10, 615, 2);
  if (j < 0.0022) { o[0] = 0.24; o[1] = 0.22; o[2] = 0.2; o[3] = 0.42; o[4] = 0.35; return; }
  o[0] = mix(base, 0.84, w); o[1] = mix(base, 0.82, w); o[2] = mix(base * 1.12, 0.8, w); o[3] = 0.5; o[4] = 0.045 + 0.05 * w;
}
/** Placas de Nero Marquina (1,5 m por repetição: 2 × 2 placas de 75 cm). */
export const NERO_TILE = 1.5;
export const neroSurf = (q: Quality) => surf(`cofre-nero-${q}`, qs(q, 1024), nero, 0.6);
export const floorNero = (q: Quality) => surfMat(`cofre-piso-${q}`, neroSurf(q), { vertex: true, env: 1.1 });
/** O mesmo mármore sem cores por vértice (rodapé, pedestal, plinto das vitrines). */
export const neroMat = (q: Quality) => surfMat(`cofre-neroPeca-${q}`, neroSurf(q), { env: 1.2 });
function rosso(u: number, v: number, o: Float32Array) {
  const t = fbm(u, v, 4, 621, 5) * 6 + u * 3.2, w = Math.max(vein(t, 0.04), vein(t * 1.7 + 0.8, 0.02) * 0.7) * (0.4 + 0.6 * fbm(u, v, 5, 623, 2));
  const n = fbm(u, v, 8, 625, 3), green = smooth(0.62, 0.8, fbm(u * 2, v, 4, 627, 3)) * 0.4;
  const r = 0.3 + 0.08 * n - 0.15 * green, g = 0.07 + 0.03 * n + 0.08 * green, b = 0.07 + 0.02 * n + 0.04 * green;
  o[0] = mix(r, 0.86, w); o[1] = mix(g, 0.82, w); o[2] = mix(b, 0.78, w); o[3] = 0.5; o[4] = 0.06 + 0.04 * w;
}
/** Faixa de Rosso Levanto; `mirror` = reflexo planar no "high" (como o piso). */
export function rossoMat(q: Quality, mirror = false): THREE.MeshStandardMaterial {
  const m = surfMat(`cofre-rosso-${q}-${mirror ? "m" : "s"}`, surf(`cofre-rosso-${q}`, qs(q, 512), rosso, 0.5), { env: 1.1 });
  if (mirror && q === "high") m.userData.mirror = [0.9, 0.05];
  return m;
}
function thassos(u: number, v: number, o: Float32Array) {
  const t = fbm(u, v, 3, 631, 4) * 4 + v * 2, w = vein(t, 0.02) * 0.45 * fbm(u, v, 5, 633, 2), b = 0.74 + 0.05 * fbm(u, v, 8, 635, 2);
  o[0] = mix(b, 0.66, w); o[1] = mix(b, 0.64, w); o[2] = mix(b * 0.99, 0.62, w); o[3] = 0.5; o[4] = 0.06 + 0.05 * w;
}
export function thassosMat(q: Quality, mirror = false): THREE.MeshStandardMaterial {
  const m = surfMat(`cofre-thassos-${q}-${mirror ? "m" : "s"}`, surf(`cofre-thassos-${q}`, qs(q, 512), thassos, 0.4), { env: 1.1 });
  if (mirror && q === "high") m.userData.mirror = [0.9, 0.05];
  return m;
}
/** Latão da rosácea (embutido no piso: reflexo planar no "high"). */
export function inlayBrass(q: Quality): THREE.MeshStandardMaterial {
  const m = once(`cofre-lataoPiso-${q}`, () => new THREE.MeshStandardMaterial({ color: "#c9a24b", metalness: 1, roughness: 0.22 }));
  if (q === "high") m.userData.mirror = [0.6, 0.5];
  return m;
}

/* ---------- seda adamascada ---------- */
function damask(u: number, v: number): number {
  // medalhão de oito pétalas com folhas nas diagonais, em grade 2 × 2 deslocada (o desenho clássico de adamascado)
  const cell = (uu: number, vv: number) => {
    const x = (uu * 2 % 1) - 0.5, y = (vv * 2 % 1) - 0.5, r = Math.hypot(x, y), a = Math.atan2(y, x);
    const petal = 0.22 + 0.09 * Math.cos(8 * a) + 0.03 * Math.cos(16 * a), fill = r < petal ? 1 : 0;
    const ring = 1 - smooth(0.008, 0.02, Math.abs(r - 0.3 - 0.015 * Math.cos(12 * a)));
    const heart = r < 0.06 + 0.02 * Math.cos(4 * a) ? 0 : 1;
    const leaf = r > 0.36 && r < 0.5 ? 1 - smooth(0.02, 0.05, Math.abs(Math.abs(Math.sin(a * 2)) * 0.11 - (r - 0.42))) : 0;
    return Math.min(1, fill * heart * 0.9 + ring + leaf * 0.85);
  };
  return Math.max(cell(u, v), cell(u + 0.25, v + 0.25) * 0.55);
}
function silk(u: number, v: number, o: Float32Array) {
  const d = damask(u, v), fib = vnoise(u * 220, v * 220, 220, 641), n = fbm(u, v, 4, 643, 2), tw = 0.5 + 0.5 * Math.sin((u * 300 + v * 40) * Math.PI);
  const t = 0.88 + 0.08 * fib + 0.05 * (n - 0.5);
  o[0] = mix(0.24, 0.34, d) * t; o[1] = mix(0.045, 0.075, d) * t; o[2] = mix(0.12, 0.15, d) * t;
  o[3] = 0.42 + 0.18 * d + 0.04 * tw; o[4] = mix(0.86, 0.36, d) - 0.06 * tw * d;
}
/** Seda adamascada ameixa das paredes (0,64 m por repetição); `vertex`: escurecimento da casca no pé e no alto. */
export const DAMASK_TILE = 0.64;
export const damaskMat = (q: Quality, vertex = true) => surfMat(`cofre-damasco-${q}-${vertex ? "v" : "p"}`, surf(`cofre-damasco-${q}`, qs(q, 1024), silk, 0.9), { vertex, env: 0.7, normal: 0.8 });

/* ---------- laca, nogueira e veludo ---------- */
/** Laca ameixa-negra com verniz (teto, friso, cornija). */
export const lacquerPlum = () => once("cofre-laca", () => new THREE.MeshPhysicalMaterial({ color: "#1c0d17", roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 1.2 }));

/* ---------- anéis da trava (símbolos) ---------- */
/** Faixa de latão com os quatro símbolos (★ ☾ ♛ ♥) gravados em volta, quatro vezes. */
export function ringTex(): THREE.Texture {
  return paint("cofre-aneis", 1024, 64, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#8a6a2a"); grd.addColorStop(0.5, "#6b4f1d"); grd.addColorStop(1, "#4a3512");
    g.fillStyle = grd; g.fillRect(0, 0, w, h); g.fillStyle = "#f2d38a";
    for (let k = 0; k < 16; k++) drawSymbol(g, RING_SYMBOLS[k % 4], (k + 0.5) * (w / 16), h / 2, h * 0.32);
    g.fillStyle = "rgba(255,240,200,0.5)"; g.fillRect(0, 2, w, 2); g.fillRect(0, h - 4, w, 2);
  });
}

/* ---------- papéis ---------- */
/** Laudo de conservação na prancheta (título, campos preenchidos à mão e o esquema da tiara com marcações). */
export function reportTex(lang: Lang): THREE.Texture {
  const T = GAL_COPY[lang].report;
  return paint(`cofre-laudo-${lang}`, 512, 700, (g, w, h) => {
    g.fillStyle = "#f3f0e6"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#1d1b18"; g.font = `700 30px ${SANS}`; g.textAlign = "left"; g.textBaseline = "top"; g.fillText(T.title, 30, 28);
    g.fillRect(30, 72, w - 60, 3);
    T.rows.forEach((r, i) => { g.font = `400 21px ${SANS}`; g.fillStyle = "#3b352c"; const [k, v] = r.split(": "); g.fillText(`${k}:`, 30, 96 + i * 40); g.font = `400 24px ${HAND}`; g.fillStyle = "#1c3a8a"; g.fillText(v ?? "", 40 + g.measureText(`${k}:  `).width, 94 + i * 40); g.strokeStyle = "rgba(0,0,0,0.15)"; g.lineWidth = 1; g.beginPath(); g.moveTo(30, 124 + i * 40); g.lineTo(w - 30, 124 + i * 40); g.stroke(); });
    // esquema da tiara com dois círculos vermelhos (os engastes frouxos)
    g.strokeStyle = "#2a2a2a"; g.lineWidth = 3; g.beginPath(); g.ellipse(w / 2, 600, 170, 70, 0, Math.PI, 0); g.stroke();
    for (let k = 0; k <= 8; k++) { const a = Math.PI + (k / 8) * Math.PI, x = w / 2 + Math.cos(a) * 170, y = 600 + Math.sin(a) * 70, t = 1 - Math.abs(k / 8 - 0.5) * 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 40 * t - 10); g.stroke(); g.beginPath(); g.arc(x, y - 40 * t - 16, 6, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = "#c0141e"; g.lineWidth = 3; for (const k of [2, 6]) { const a = Math.PI + (k / 8) * Math.PI, x = w / 2 + Math.cos(a) * 170, y = 600 + Math.sin(a) * 70 - 40; g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.stroke(); }
  });
}
export const LABEL_N = 16;
/**
 * Etiquetas pequenas num atlas 4 × 4 (512 × 128 cada): 0–9 gavetas da mapoteca, 10 caixa livre de ácido, 11 placa da
 * conservação, 12–15 as vitrines de parede (tiaras, pérolas, brincos e broches, anéis).
 */
export function tagAtlas(q: Quality, lang: Lang): THREE.Texture {
  const T = GAL_COPY[lang];
  return paint(`cofre-etiquetas-${lang}-${q}`, qs(q, 2048), qs(q, 512), (g, w, h) => {
    const cw = w / 4, ch = h / 4, s = cw / 512;
    for (let i = 0; i < 16; i++) {
      const x = (i % 4) * cw, y = Math.floor(i / 4) * ch;
      if (i < 10) { g.fillStyle = "#f4f1e8"; g.fillRect(x, y, cw, ch); g.fillStyle = "#1d1b18"; g.font = `600 ${Math.round(44 * s)}px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(`${T.drawers} ${String(i + 1).padStart(2, "0")}`, x + cw / 2, y + ch / 2); continue; }
      if (i === 10) { g.fillStyle = "#e9e4d6"; g.fillRect(x, y, cw, ch); g.fillStyle = "#3b352c"; g.font = `600 ${Math.round(40 * s)}px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(T.box, x + cw / 2, y + ch * 0.4); g.font = `400 ${Math.round(26 * s)}px ${HAND}`; g.fillText("lote 07 · 3/4", x + cw / 2, y + ch * 0.75); continue; }
      if (i === 11) { g.fillStyle = "#1c3a8a"; g.fillRect(x, y, cw, ch); g.fillStyle = "#ffffff"; g.font = `700 ${Math.round(34 * s)}px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; const l = wrap(g, T.conservation, cw * 0.92); l.forEach((t, k) => g.fillText(t, x + cw / 2, y + ch / 2 + (k - (l.length - 1) / 2) * 40 * s)); continue; }
      const grd = g.createLinearGradient(x, y, x, y + ch); grd.addColorStop(0, "#d9b66a"); grd.addColorStop(0.5, "#a77f37"); grd.addColorStop(1, "#e2c27a");
      g.fillStyle = grd; g.fillRect(x, y, cw, ch); g.strokeStyle = "#5e451a"; g.lineWidth = 6 * s; g.strokeRect(x + 8 * s, y + 8 * s, cw - 16 * s, ch - 16 * s);
      g.fillStyle = "#2c1f0a"; g.font = `600 ${Math.round(40 * s)}px ${SERIF}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(T.jewels[i - 12], x + cw / 2, y + ch / 2);
    }
  });
}
