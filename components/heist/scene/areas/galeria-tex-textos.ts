/*
 * MET Gala Heist v2 — galeria (Z07): texturas de texto — atlas dos textos de parede, créditos e legendas
 * dos arcos, inscrição do friso e o atlas das etiquetas de museu (com a capa do catálogo). Saiu de galeria-tex.ts
 * sem mudança.
 */
import * as THREE from "three";
import { SANS, SERIF, drawGown, type Quality } from "../interior-tex";
import type { InteriorCopy } from "../interior-copy";
import { paint, qs, wrap, type Lang } from "./galeria-kit";
import { GAL_COPY } from "./galeria-copy";

/* ---------- textos de parede ---------- */
const GOLD = "#e3c27e", CREAM = "#f1e7d2";
function textBlock(g: CanvasRenderingContext2D, x: number, y: number, w: number, s: number, title: string, body: string, kicker = "") {
  g.textAlign = "left"; g.textBaseline = "top";
  let yy = y;
  if (kicker) { g.fillStyle = GOLD; g.font = `500 ${Math.round(26 * s)}px ${SANS}`; g.fillText(kicker, x, yy); yy += 46 * s; }
  g.fillStyle = CREAM; g.font = `600 ${Math.round(58 * s)}px ${SERIF}`;
  for (const l of wrap(g, title, w)) { g.fillText(l, x, yy); yy += 70 * s; }
  g.fillStyle = GOLD; g.fillRect(x, yy + 8 * s, 120 * s, 4 * s); yy += 44 * s;
  g.fillStyle = CREAM; g.font = `400 ${Math.round(31 * s)}px ${SERIF}`;
  for (const l of wrap(g, body, w)) { g.fillText(l, x, yy); yy += 46 * s; }
}
/**
 * Atlas dos textos de parede (2 × 2 células quadradas): introdução, seções I, II e III. Letras creme e douradas em
 * fundo transparente (vinil recortado sobre o tecido da parede).
 */
export function wallTextAtlas(q: Quality, lang: Lang): THREE.Texture {
  const T = GAL_COPY[lang];
  return paint(`galeria-textos-${lang}-${q}`, qs(q, 2048), qs(q, 2048), (g, w) => {
    const c = w / 2, s = c / 1024;
    g.clearRect(0, 0, w, w);
    // introdução: chamada, AURORA grande, subtítulo e o parágrafo
    g.textAlign = "left"; g.textBaseline = "top";
    g.fillStyle = GOLD; g.font = `500 ${Math.round(28 * s)}px ${SANS}`; g.fillText(T.intro.kicker, 70 * s, 70 * s);
    g.fillStyle = CREAM; g.font = `600 ${Math.round(150 * s)}px ${SERIF}`; g.fillText(T.intro.title, 62 * s, 120 * s);
    g.fillStyle = GOLD; g.font = `500 ${Math.round(40 * s)}px ${SERIF}`; g.fillText(T.intro.sub, 70 * s, 290 * s);
    g.fillRect(70 * s, 356 * s, 160 * s, 4 * s);
    g.fillStyle = CREAM; g.font = `400 ${Math.round(31 * s)}px ${SERIF}`;
    let y = 400 * s; for (const l of wrap(g, T.intro.body, 880 * s)) { g.fillText(l, 70 * s, y); y += 46 * s; }
    g.fillStyle = GOLD; g.font = `italic 400 ${Math.round(28 * s)}px ${SERIF}`; g.fillText(T.intro.foot, 70 * s, y + 30 * s);
    textBlock(g, c + 70 * s, 90 * s, 880 * s, s, T.s1.title, T.s1.body);
    textBlock(g, 70 * s, c + 90 * s, 880 * s, s, T.s2.title, T.s2.body);
    textBlock(g, c + 70 * s, c + 90 * s, 880 * s, s, T.s3.title, T.s3.body);
  });
}
/** Créditos (metade esquerda) e as quatro legendas dos arcos (metade direita, uma por faixa). */
export function creditsAtlas(q: Quality, lang: Lang): THREE.Texture {
  const T = GAL_COPY[lang];
  return paint(`galeria-creditos-${lang}-${q}`, qs(q, 2048), qs(q, 1024), (g, w, h) => {
    const s = h / 1024; g.clearRect(0, 0, w, h);
    g.textAlign = "left"; g.textBaseline = "top";
    let y = 80 * s;
    T.credits.forEach((l, i) => {
      if (i % 2 === 0) { g.fillStyle = GOLD; g.font = `500 ${Math.round(28 * s)}px ${SANS}`; g.fillText(l, 70 * s, y); y += 44 * s; }
      else { g.fillStyle = CREAM; g.font = `400 ${Math.round(40 * s)}px ${SERIF}`; for (const ln of wrap(g, l, 880 * s)) { g.fillText(ln, 70 * s, y); y += 52 * s; } y += 46 * s; }
    });
    T.arches.forEach((t, i) => {
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = CREAM; g.font = `500 ${Math.round(54 * s)}px ${SERIF}`;
      g.fillText(t, w * 0.75, (i + 0.5) * (h / 4));
    });
  });
}
/** Inscrição do friso (letras douradas em caixa alta, espaçadas) — título da exposição sobre o nicho. */
export function friezeText(q: Quality, copy: InteriorCopy): THREE.Texture {
  const text = `${copy.exhibitTitle}  ·  ${copy.exhibitSub}`;
  return paint(`galeria-friso-${text}-${q}`, qs(q, 4096), qs(q, 256), (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, h * 0.2, 0, h * 0.8); grd.addColorStop(0, "#fff0c4"); grd.addColorStop(0.45, "#d9ae5c"); grd.addColorStop(0.55, "#a87b34"); grd.addColorStop(1, "#e8c77f");
    g.fillStyle = grd; g.textAlign = "center"; g.textBaseline = "middle";
    let px = Math.round(h * 0.62); g.font = `600 ${px}px ${SERIF}`;
    const sp = (t: string) => [...t].join(" ");
    while (g.measureText(sp(text)).width > w * 0.94 && px > 10) { px -= 2; g.font = `600 ${px}px ${SERIF}`; }
    g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = h * 0.04; g.shadowOffsetY = h * 0.02;
    g.fillText(sp(text), w / 2, h * 0.53);
  });
}

/* ---------- etiquetas de museu ---------- */
export const LABEL_COLS = 4, LABEL_ROWS = 4;
/** Atlas das etiquetas (cartão creme, número, título, autoria, materiais e crédito). */
export function labelAtlas(q: Quality, lang: Lang): THREE.Texture {
  const T = GAL_COPY[lang];
  return paint(`galeria-etiquetas-${lang}-${q}`, qs(q, 2048), qs(q, 1024), (g, w, h) => {
    const cw = w / LABEL_COLS, ch = h / LABEL_ROWS, s = cw / 512;
    T.labels.forEach((L, i) => {
      const x = (i % LABEL_COLS) * cw, y = Math.floor(i / LABEL_COLS) * ch;
      g.fillStyle = "#efe8d8"; g.fillRect(x, y, cw, ch);
      g.strokeStyle = "rgba(60,45,25,0.25)"; g.lineWidth = 2 * s; g.strokeRect(x + 6 * s, y + 6 * s, cw - 12 * s, ch - 12 * s);
      g.textAlign = "left"; g.textBaseline = "top";
      let tx = x + 26 * s;
      if (L.n) { g.fillStyle = "#1d1a16"; g.beginPath(); g.arc(x + 46 * s, y + 50 * s, 22 * s, 0, Math.PI * 2); g.fill(); g.fillStyle = "#efe8d8"; g.font = `600 ${Math.round(20 * s)}px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(L.n, x + 46 * s, y + 51 * s); g.textAlign = "left"; g.textBaseline = "top"; tx = x + 82 * s; }
      g.fillStyle = "#1d1a16"; g.font = `700 ${Math.round(30 * s)}px ${SERIF}`;
      const tl = wrap(g, L.title, cw - (tx - x) - 20 * s); g.fillText(tl[0] ?? "", tx, y + 32 * s);
      g.font = `400 ${Math.round(20 * s)}px ${SANS}`; g.fillStyle = "#3b352c";
      let yy = y + 92 * s; for (const l of wrap(g, L.by, cw - 52 * s)) { g.fillText(l, x + 26 * s, yy); yy += 26 * s; }
      g.font = `italic 400 ${Math.round(19 * s)}px ${SERIF}`; g.fillStyle = "#4a4237";
      for (const l of wrap(g, L.mat, cw - 52 * s).slice(0, 3)) { g.fillText(l, x + 26 * s, yy); yy += 24 * s; }
      g.font = `400 ${Math.round(15 * s)}px ${SANS}`; g.fillStyle = "#6d6455"; g.fillText(L.credit, x + 26 * s, y + ch - 34 * s);
    });
    // célula 15: capa do catálogo (fundo escuro, AURORA dourado e a silhueta do vestido)
    const x = 3 * cw, y = 3 * ch, grd = g.createLinearGradient(x, y, x, y + ch); grd.addColorStop(0, "#1b1424"); grd.addColorStop(1, "#3a1d33");
    g.fillStyle = grd; g.fillRect(x, y, cw, ch);
    const au = g.createLinearGradient(0, y + ch * 0.2, 0, y + ch); au.addColorStop(0, "#fde7b8"); au.addColorStop(1, "#a88bff");
    drawGown(g, x + cw * 0.78, y + ch * 0.12, ch * 0.8, au);
    g.fillStyle = GOLD; g.textAlign = "left"; g.textBaseline = "middle"; g.font = `600 ${Math.round(64 * s)}px ${SERIF}`; g.fillText("AURORA", x + 26 * s, y + ch * 0.42);
    g.font = `400 ${Math.round(18 * s)}px ${SANS}`; g.fillStyle = CREAM; g.fillText(T.intro.sub, x + 30 * s, y + ch * 0.66);
  });
}
/** Índice da capa do catálogo no atlas das etiquetas. */
export const CATALOG_COVER = 15;
