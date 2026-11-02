/*
 * MET Gala Heist v2 — Doca (Z12): superfícies, desenhos e materiais próprios da área (chaves "doca-…"), gerados no
 * navegador (nos testes, jsdom, saem com 8 px como os do interior):
 *
 *  - piso: concreto polido em placas de 3 m com juntas serradas, agregado aparente fino, marcas de desempenadeira,
 *    riscos de borracha, manchas de óleo e trincas finas nas quinas das juntas — ladrilho de 6 m;
 *  - parede: bloco de concreto (0,4 × 0,2 m) pintado — barrado cinza-grafite até 1,2 m com o filete amarelo, cinza-claro
 *    em cima, escurecendo de fuligem perto do teto, raspões de carrinho no barrado — ladrilho de 3,2 × 6 m;
 *  - teto: telha de aço trapezoidal (steel deck) galvanizada, com poeira e manchas de água — ladrilho de 2 m;
 *  - laminado preto texturizado dos flight cases;
 *  - a folha de desenhos (placas de segurança, quadro de escalas, mural, mapa de rota de fuga com a planta do museu,
 *    relógio de ponto, prancheta, estênceis dos cases e da caixa de obra, fitas gaffer, caixas, colete refletivo) e as
 *    marcas do piso (zebrado, faixas, setas, quadrado do extintor, "não obstruir", marcas de pneu, vaga de palete).
 */
import type { Quality } from "../interior-tex";
import { rng, fieldOf, samp, smooth, hash, type Surface, surface, walk } from "./doca-tex-base";
export type { Surface } from "./doca-tex-base";
export { docaAtlas } from "./doca-tex-folha";
export type { Rect } from "./doca-tex-folha";

/** Concreto polido da doca (ladrilho de 6 m: placas de 3 m). Máscara: R = juntas serradas, trincas e riscos de borracha. */
export const FLOOR_TILE: [number, number] = [6, 6];
export function floorSurface(q: Quality): Surface {
  const S = q === "high" ? 1024 : 512;
  const low = fieldOf(128, 701, 4, 2), mid = fieldOf(256, 702, 5, 4), fine = fieldOf(256, 703, 3, 64), burn = fieldOf(256, 704, 4, 6), oil = fieldOf(256, 705, 4, 5);
  return surface(`floor-${q}`, S, S, (u, v, _x, _y, o) => {
    const l = samp(low, 128, u, v), m = samp(mid, 256, u, v), f = samp(fine, 256, u, v, 4, 4), b = samp(burn, 256, u, v);
    const pu = (u * 2) % 1, pv = (v * 2) % 1, panel = Math.floor(u * 2) + 2 * Math.floor(v * 2), tone = hash(panel, 3, 707);
    const swirl = 0.5 + 0.5 * Math.sin((pu * 9 + Math.sin(pv * 7 + m * 4) * 0.8 + m * 3) * 3.1);   // marcas de desempenadeira
    const speck = f > 0.8 ? 1 : f < 0.12 ? -1 : 0;                                                   // agregado aparente
    const stain = smooth(0.7, 0.86, samp(oil, 256, u, v)), mk = o[5];
    let t = 0.53 + 0.05 * (l - 0.5) + 0.04 * (tone - 0.5) + 0.025 * (swirl - 0.5) + (speck > 0 ? 0.07 : speck < 0 ? -0.08 : 0) - 0.06 * smooth(0.55, 0.8, b);
    t *= 1 - 0.45 * stain; t *= 1 - 0.75 * mk;
    o[0] = t * 1.0; o[1] = t * 0.99; o[2] = t * 0.955;
    o[3] = 0.55 + 0.04 * f - 0.4 * mk + 0.02 * (speck > 0 ? 1 : 0);
    o[4] = 0.26 + 0.12 * swirl * 0.5 + 0.2 * smooth(0.5, 0.85, b) + 0.6 * mk - 0.08 * stain;
  }, 1.4, (g, w, h) => {
    const r = rng(708), jw = Math.max(1.2, w / 520);
    // juntas serradas a cada 3 m (meio ladrilho), com a borda lascada
    g.strokeStyle = "#fff";
    for (const k of [0, 0.5]) { g.lineWidth = jw; g.beginPath(); g.moveTo(k * w, 0); g.lineTo(k * w, h); g.moveTo(0, k * h); g.lineTo(w, k * h); g.stroke(); }
    g.strokeStyle = "rgba(255,255,255,0.55)";
    for (let k = 0; k < 40; k++) { const along = r() < 0.5, p = (r() < 0.5 ? 0 : 0.5) * (along ? w : h), q = r() * (along ? h : w); g.lineWidth = 1 + r() * 2; g.beginPath(); if (along) { g.moveTo(p - 2, q); g.lineTo(p + 2 + r() * 2, q + 3 + r() * 6); } else { g.moveTo(q, p - 2); g.lineTo(q + 3 + r() * 6, p + 2 + r() * 2); } g.stroke(); }
    // trincas finas saindo das quinas das juntas
    g.strokeStyle = "rgba(255,255,255,0.7)";
    for (const [cx, cy] of [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]]) for (let k = 0; k < 2; k++) walk(g, w, h, r, cx * w + (r() - 0.5) * 8, cy * h + (r() - 0.5) * 8, 10 + Math.floor(r() * 16), w / 180, r() * Math.PI * 2, Math.max(0.8, w / 900));
    // riscos de borracha (rodízios, paleteira, solados): arcos curtos e meio apagados
    for (let k = 0; k < 70; k++) { g.strokeStyle = `rgba(255,255,255,${0.12 + r() * 0.25})`; g.lineWidth = 1 + r() * 2.5; const x = r() * w, y = r() * h, rad = 20 + r() * 120, a = r() * Math.PI * 2; g.beginPath(); g.arc(x, y, rad, a, a + 0.2 + r() * 0.6); g.stroke(); }
  });
}

/** Bloco de concreto pintado (ladrilho de 3,2 m × 6 m: 8 × 30 blocos), barrado grafite até 1,2 m com filete amarelo. */
export const WALL_TILE: [number, number] = [3.2, 6];
export function wallSurface(q: Quality): Surface {
  const W = q === "high" ? 1024 : 512, H = W;
  const pore = fieldOf(256, 711, 3, 64), mid = fieldOf(256, 712, 5, 4), soot = fieldOf(128, 713, 4, 3), scuff = fieldOf(256, 714, 4, 16);
  return surface(`wall-${q}`, W, H, (u, v, _x, _y, o) => {
    const ym = (1 - v) * 6;                                                     // altura em metros (v = 0 no topo do canvas)
    const row = Math.floor(ym / 0.2), ly = ym / 0.2 - row, off = row % 2 ? 0.5 : 0, xb = u * 8 + off, col = Math.floor(xb), lx = xb - col;
    const jy = Math.min(ly, 1 - ly) * 0.2, jx = Math.min(lx, 1 - lx) * 0.4, j = Math.min(jx, jy);           // distância à junta (m)
    const joint = 1 - smooth(0.004, 0.009, j), p = samp(pore, 256, u, v, 2, 4), m = samp(mid, 256, u, v);
    const band = ym < 1.2, stripe = ym >= 1.2 && ym < 1.26;
    const blockTone = hash(col, row, 715) * 0.04;
    let r: number, g: number, b: number;
    if (stripe) { r = 0.86; g = 0.68; b = 0.12; }
    else if (band) { r = 0.27; g = 0.29; b = 0.305; }
    else { r = 0.67; g = 0.685; b = 0.67; }
    const k = (0.94 + blockTone + 0.05 * (m - 0.5)) * (1 - 0.18 * joint) * (p < 0.15 ? 0.82 : 1);
    r *= k; g *= k; b *= k;
    // barrado: raspões de carrinho (preto de borracha) e lascas mostrando o bloco cinza
    if (band) {
      const sc = samp(scuff, 256, u, v, 3, 1);
      if (ym < 0.6 && sc > 0.72) { const t = smooth(0.72, 0.8, sc); r *= 1 - 0.5 * t; g *= 1 - 0.5 * t; b *= 1 - 0.5 * t; }
      if (sc < 0.12 && ym > 0.15 && ym < 1.0) { r = 0.55; g = 0.55; b = 0.53; }
    } else if (!stripe) {
      const s = smooth(0.4, 1, samp(soot, 128, u, v)) * smooth(2.5, 6, ym); r *= 1 - 0.32 * s; g *= 1 - 0.32 * s; b *= 1 - 0.3 * s;
      // retoques de tinta (painéis de outro tom onde a parede foi consertada) e escorridos de sujeira descendo do alto
      const pc = hash(Math.floor(u * 3), Math.floor(ym / 1.5), 716);
      if (pc > 0.8) { const t = 1 + (pc - 0.9) * 0.5; r *= t; g *= t; b *= t * 1.01; }
      const sx = u * 24, si = Math.floor(sx);
      if (hash(si, 3, 717) > 0.8) {
        const len = 1.2 + 2.8 * hash(si, 4, 717), top = 6 - 0.3 * hash(si, 5, 717), d = sx - si - 0.5;
        if (ym > top - len && ym < top) { const e = Math.exp(-(d * d) / 0.015) * ((ym - (top - len)) / len) * 0.16; r *= 1 - e; g *= 1 - e; b *= 1 - e * 0.9; }
      }
    }
    o[0] = r; o[1] = g; o[2] = b; o[3] = 0.6 - 0.35 * joint + 0.04 * p; o[4] = band ? 0.55 : stripe ? 0.45 : 0.82;
  }, 2.2);
}

/** Telha de aço trapezoidal galvanizada (ladrilho de 2 m; nervuras a cada 0,25 m ao longo de v). */
export function deckSurface(q: Quality): Surface {
  const S = q === "high" ? 512 : 256, dust = fieldOf(128, 721, 4, 3), stain = fieldOf(128, 722, 4, 4);
  return surface(`deck-${q}`, S, S, (u, v, _x, _y, o) => {
    const p = (u * 8) % 1, d = samp(dust, 128, u, v), st = smooth(0.66, 0.8, samp(stain, 128, u, v));
    // perfil: mesa de cima (0–0,35), alma inclinada, mesa de baixo (0,5–0,85), alma de volta
    const hgt = p < 0.35 ? 1 : p < 0.5 ? 1 - (p - 0.35) / 0.15 : p < 0.85 ? 0 : (p - 0.85) / 0.15;
    const slope = (p >= 0.35 && p < 0.5) || p >= 0.85, lap = Math.abs(v * 2 % 1 - 0.5) < 0.004;
    const t = (0.48 + 0.08 * hgt - (slope ? 0.1 : 0) + 0.05 * (d - 0.5)) * (1 - 0.35 * st) * (lap ? 0.7 : 1);
    o[0] = t * 0.97; o[1] = t; o[2] = t * 1.04; o[3] = hgt * 0.8 + 0.1; o[4] = 0.5 + 0.2 * d + 0.2 * st;
  }, 3.2);
}

/** Laminado preto "martelado" dos flight cases (ladrilho de 0,25 m): bolhas finas. */
export function laminateSurface(q: Quality): Surface {
  const S = q === "high" ? 256 : 128;
  return surface(`laminate-${q}`, S, S, (u, v, _x, _y, o) => {
    const cells = 14, x = u * cells, y = v * cells, xi = Math.floor(x), yi = Math.floor(y); let d1 = 9;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const ci = ((xi + dx) % cells + cells) % cells, cj = ((yi + dy) % cells + cells) % cells; const d = Math.hypot(x - (xi + dx + hash(ci, cj, 731)), y - (yi + dy + hash(ci, cj, 733))); if (d < d1) d1 = d; }
    const bump = 1 - smooth(0, 0.7, d1); o[0] = o[1] = o[2] = 0.09 + 0.02 * bump; o[3] = 0.4 + 0.4 * bump; o[4] = 0.45 + 0.15 * (1 - bump);
  }, 2.5);
}

