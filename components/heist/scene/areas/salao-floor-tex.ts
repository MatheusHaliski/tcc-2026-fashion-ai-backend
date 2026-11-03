/*
 * MET Gala Heist v2 — Grande Salão — as superfícies do piso: a placa de Botticino polido com frisos de granito negro,
 * filete de latão e losango de Rosso (o material do piso da casca), a rosácea de 16 pontas em mármores em volta da
 * instalação floral, a barra grega de granito e mármore creme ao longo das paredes e o tapete redondo de Aubusson
 * desenhado em canvas sob as mesas dos patronos.
 */
import * as THREE from "three";
import type { Quality } from "../interior-tex";
import { fbm, hash2, mix, rand, salaoTexture, surface, surfaceMat, vein, vnoise } from "./salao-kit";

/* ======================= piso ======================= */
/** Placa de 2,4 m (2 × 2 placas de 1,2 m): Botticino polido, frisos de granito negro com filete de latão, losango Rosso. */
export function floorSurfaceSalao(q: Quality) {
  return surface(`floor-${q}`, q === "high" ? 1024 : 512, (u, v, o) => {
    const eu = Math.min(u, 1 - u), ev = Math.min(v, 1 - v), band = 0.0146, fil = 0.0026;
    const du = Math.abs(u - 0.5), dv = Math.abs(v - 0.5);
    // losango de Rosso Levanto no cruzamento dos frisos
    if (eu + ev < 0.062) {
      const t = fbm(u * 6, v * 6, 8, 41, 3), w = vein(t * 7 + u * 9, 0.08);
      o[0] = mix(0.42, 0.86, w * 0.6); o[1] = mix(0.11, 0.78, w * 0.6); o[2] = mix(0.09, 0.72, w * 0.6); o[3] = 0.5; o[4] = 0.08; return;
    }
    if (Math.abs(eu + ev - 0.062) < 0.004) { o[0] = 0.78; o[1] = 0.6; o[2] = 0.28; o[3] = 0.52; o[4] = 0.22; return; }   // contorno de latão
    if (eu < band || ev < band) {
      // friso de granito negro com cristais claros
      const sp = hash2(Math.floor(u * 900), Math.floor(v * 900), 7), c = sp > 0.93 ? 0.55 + 0.3 * sp : 0.05 + 0.04 * vnoise(u * 300, v * 300, 300, 9);
      o[0] = c * 0.92; o[1] = c * 1.02; o[2] = c * 0.97; o[3] = 0.48; o[4] = 0.1 + 0.05 * sp; return;
    }
    if (eu < band + fil || ev < band + fil) { o[0] = 0.8; o[1] = 0.62; o[2] = 0.3; o[3] = 0.52; o[4] = 0.24; return; }      // filete de latão
    // junta fina entre as quatro placas de 1,2 m
    if (du < 0.0011 || dv < 0.0011) { o[0] = 0.5; o[1] = 0.46; o[2] = 0.4; o[3] = 0.32; o[4] = 0.45; return; }
    // Botticino: fundo creme nuvem, veios finos castanhos e cinza, tom diferente por placa
    const slab = (u < 0.5 ? 0 : 1) + (v < 0.5 ? 0 : 2), tone = (hash2(slab, 3, 17) - 0.5) * 0.05;
    const cloud = fbm(u, v, 5, 23 + slab, 4), t = fbm(u, v, 3, 29 + slab, 5) * 6 + (u * 1.3 - v * 0.7) * 3;
    const w = Math.max(vein(t, 0.04) * 0.5, vein(t * 2.3 + 1.7, 0.02) * 0.3) * (0.4 + 0.6 * fbm(u, v, 7, 31, 2));
    const b = 0.84 + tone + 0.05 * (cloud - 0.5);
    o[0] = mix(b, 0.6, w); o[1] = mix(b * 0.94, 0.52, w); o[2] = mix(b * 0.82, 0.44, w);
    o[3] = 0.5 + 0.02 * cloud; o[4] = 0.05 + 0.04 * cloud + 0.05 * w;
  }, 0.9);
}
/** Material do piso do salão (troca o terrazzo da casca: areas/types → surfaces). */
export const floorMaterialSalao = (q: Quality) => surfaceMat(`floor-${q}`, floorSurfaceSalao(q), { env: 1, mirror: [0.8, 0.05] });

/** Raio externo da rosácea (a pista de dança começa logo depois, em x 3,2). */
export const RO = 3.05;
/** Rosácea em volta da instalação floral (anel de 1,6 a 3,05 m): rosa dos ventos de 16 pontas em mármores. */
export function rosetteSurface(q: Quality) {
  return surface(`rosette-${q}`, q === "high" ? 1024 : 512, (u, v, o) => {
    const x = (u - 0.5) * 2 * RO, y = (v - 0.5) * 2 * RO, r = Math.hypot(x, y), a = Math.atan2(y, x);
    const cream = () => { const t = fbm(u * 3, v * 3, 6, 51, 4) * 5 + u * 4; const w = vein(t, 0.04) * 0.4; o[0] = mix(0.85, 0.6, w); o[1] = mix(0.8, 0.52, w); o[2] = mix(0.7, 0.44, w); o[4] = 0.06; };
    const black = () => { const sp = hash2(Math.floor(u * 1500), Math.floor(v * 1500), 3); const c = sp > 0.94 ? 0.6 : 0.05; o[0] = c * 0.9; o[1] = c; o[2] = c * 0.95; o[4] = 0.1; };
    const rosso = () => { const t = fbm(u * 5, v * 5, 6, 57, 3) * 6 + a; const w = vein(t, 0.06) * 0.5; o[0] = mix(0.44, 0.85, w); o[1] = mix(0.11, 0.78, w); o[2] = mix(0.1, 0.72, w); o[4] = 0.08; };
    const green = () => { const t = fbm(u * 5, v * 5, 6, 59, 3) * 7 - a; const w = vein(t, 0.05) * 0.5; o[0] = mix(0.04, 0.55, w); o[1] = mix(0.16, 0.65, w); o[2] = mix(0.11, 0.58, w); o[4] = 0.07; };
    const brass = () => { o[0] = 0.8; o[1] = 0.62; o[2] = 0.3; o[4] = 0.22; };
    o[3] = 0.5;
    if (r > RO || r < 1.6) { cream(); return; }
    if (Math.abs(r - (RO - 0.05)) < 0.022 || Math.abs(r - (RO - 0.36)) < 0.02 || Math.abs(r - 1.67) < 0.02) { brass(); o[3] = 0.52; return; }
    if (r > RO - 0.36) {                                                            // banda negra com losangos Rosso
      const k = ((a / (Math.PI * 2)) * 40 + 40) % 1, d = Math.abs(k - 0.5) * 2 + Math.abs((r - (RO - 0.2)) / 0.14);
      if (d < 0.75) rosso(); else black(); return;
    }
    // estrela de 16 pontas: pontas longas (verde) e curtas (Rosso) sobre o creme, divididas ao meio (claro/escuro)
    const n = 16, seg = ((a / (Math.PI * 2)) * n + n) % 1, ang = Math.abs(seg - 0.5) * 2;   // 0 no eixo da ponta
    const idx = Math.floor(((a / (Math.PI * 2)) * n + n) % n), long = idx % 2 === 0;
    const reach = long ? RO - 0.4 : RO - 0.85, inner = 1.75, tip = (r - inner) / (reach - inner);
    if (tip >= 0 && tip <= 1 && ang < (1 - tip) * 0.92) { const half = seg < 0.5; if (long) { if (half) green(); else { green(); o[0] *= 0.6; o[1] *= 0.6; o[2] *= 0.6; } } else { if (half) rosso(); else { rosso(); o[0] *= 0.72; o[1] *= 0.72; o[2] *= 0.72; } } o[3] = 0.5; return; }
    if (r < 1.95) { rosso(); return; }
    cream();
  }, 0.6, false);
}
/** Barra grega (meandro) de granito e mármore creme, 0,45 m, ao longo das paredes. */
export function meanderSurface(q: Quality) {
  return surface(`meander-${q}`, q === "high" ? 512 : 256, (u, v, o) => {
    // a textura cobre 0,9 m de comprimento (u) × 0,45 m (v); meandro de 8 × 8 células por repetição
    const black = () => { const sp = hash2(Math.floor(u * 700), Math.floor(v * 700), 11); const c = sp > 0.94 ? 0.55 : 0.05; o[0] = c * 0.92; o[1] = c; o[2] = c * 0.95; o[4] = 0.1; };
    const cream = () => { const t = fbm(u, v, 4, 61, 3) * 4; const w = vein(t, 0.05) * 0.3; o[0] = mix(0.85, 0.62, w); o[1] = mix(0.8, 0.54, w); o[2] = mix(0.7, 0.46, w); o[4] = 0.06; };
    o[3] = 0.5;
    if (v < 0.05 || v > 0.95) { cream(); return; }
    if (v < 0.075 || v > 0.925) { o[0] = 0.8; o[1] = 0.62; o[2] = 0.3; o[4] = 0.22; o[3] = 0.53; return; }
    const cx = Math.floor(u * 16), cy = Math.floor((v - 0.075) / 0.85 * 8), lx = cx % 8, ly = Math.min(7, Math.max(0, cy));
    // traçado do meandro numa célula 8 × 8 (1 = faixa de mármore creme)
    const G = ["11111111", "10000001", "10111101", "10100101", "10100101", "10000101", "11111101", "00000001"];
    if (G[ly][lx] === "1") cream(); else black();
  }, 0.5);
}
/** Tapete redondo de lã sob as mesas dos patronos: campo ameixa, medalhão e barra dourada. */
/**
 * Tapete redondo de Aubusson (Ø 3,7 m) sob a mesa dos patronos: guarda dourada, barra azul-noite com rosetas e folhas,
 * guarda marfim, campo bordô com abrash (faixas de tingimento), treliça dourada com florzinhas nos nós, medalhão central
 * de doze lóbulos em camadas e quatro pingentes; por cima, o pelo da lã (pontinhos claros e escuros).
 */
export function rugTexture(): THREE.Texture {
  return salaoTexture("rugAubusson", 1024, 1024, (g, w, h) => {
    const c = w / 2, TAU = Math.PI * 2, R = rand(5);
    g.clearRect(0, 0, w, h);
    const disc = (r: number, col: string) => { g.fillStyle = col; g.beginPath(); g.arc(c, c, r, 0, TAU); g.fill(); };
    const lobed = (r: number, n: number, amp: number, col: string, stroke?: string, rot = 0) => {
      g.beginPath(); for (let k = 0; k <= 180; k++) { const a = (k / 180) * TAU, rr = r * (1 + amp * Math.cos(n * a + rot)); const x = c + Math.cos(a) * rr, y = c + Math.sin(a) * rr; if (k === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.closePath(); g.fillStyle = col; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 4; g.stroke(); }
    };
    const flower = (x: number, y: number, r: number, petal: string, heart: string, n = 6, rot = 0) => {
      g.fillStyle = petal; for (let k = 0; k < n; k++) { const a = rot + (k / n) * TAU; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.26, a, 0, TAU); g.fill(); }
      g.fillStyle = heart; g.beginPath(); g.arc(x, y, r * 0.28, 0, TAU); g.fill();
    };
    // guardas e barra
    disc(c, "#b8914c"); disc(c * 0.982, "#3a2a18"); disc(c * 0.972, "#1b2340");
    const bR = c * 0.878;
    for (let k = 0; k < 30; k++) {
      const a = (k / 30) * TAU, x = c + Math.cos(a) * bR, y = c + Math.sin(a) * bR;
      flower(x, y, c * 0.05, k % 2 ? "#e9c9b4" : "#c9576a", "#d8b05c", 8, a);
      const a2 = a + TAU / 60, x2 = c + Math.cos(a2) * bR, y2 = c + Math.sin(a2) * bR;          // folhas entre as rosetas
      g.fillStyle = "#4f6b3c"; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x2 + Math.cos(a2 + s * 1.2) * c * 0.022, y2 + Math.sin(a2 + s * 1.2) * c * 0.022, c * 0.03, c * 0.011, a2 + s * 0.9, 0, TAU); g.fill(); }
      g.fillStyle = "#c9a25a"; g.beginPath(); g.arc(x2, y2, c * 0.008, 0, TAU); g.fill();
    }
    disc(c * 0.785, "#b8914c"); disc(c * 0.772, "#efe2c6"); disc(c * 0.752, "#b8914c"); disc(c * 0.742, "#5b1325");
    // campo: abrash em faixas horizontais suaves e a treliça dourada com flores nos nós (recortado no círculo)
    g.save(); g.beginPath(); g.arc(c, c, c * 0.742, 0, TAU); g.clip();
    for (let y = 0; y < h; y += 4) { const t = Math.sin(y * 0.021) * 0.5 + Math.sin(y * 0.0071 + 1.3) * 0.5; g.fillStyle = t > 0 ? `rgba(255,120,120,${0.035 * t})` : `rgba(0,0,0,${-0.06 * t})`; g.fillRect(0, y, w, 4); }
    const P = 74; g.strokeStyle = "rgba(201,162,90,0.42)"; g.lineWidth = 2.2;
    for (let k = -w; k < 2 * w; k += P) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k, h); g.lineTo(k + h, 0); g.stroke(); }
    for (let y = 0; y <= h; y += P) for (let x = (y / P) % 2 ? P / 2 : 0; x <= w; x += P) flower(x, y, 9, "#a8445a", "#d8b05c", 4, Math.PI / 4);
    g.restore();
    // medalhão central em camadas e os quatro pingentes
    lobed(c * 0.4, 12, 0.07, "#b8914c"); lobed(c * 0.385, 12, 0.07, "#1b2340"); lobed(c * 0.3, 12, 0.09, "#b8914c", undefined, Math.PI / 12); lobed(c * 0.288, 12, 0.09, "#efe2c6", undefined, Math.PI / 12);
    lobed(c * 0.2, 16, 0.12, "#a8445a", "#b8914c"); disc(c * 0.11, "#1b2340"); flower(c, c, c * 0.1, "#efe2c6", "#d8b05c", 8);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; flower(c + Math.cos(a) * c * 0.34, c + Math.sin(a) * c * 0.34, c * 0.03, "#c9576a", "#efe2c6", 5, a); }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + Math.PI / 4, x = c + Math.cos(a) * c * 0.58, y = c + Math.sin(a) * c * 0.58;
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = "#b8914c"; g.beginPath(); g.moveTo(-c * 0.09, 0); g.quadraticCurveTo(0, -c * 0.07, c * 0.09, 0); g.quadraticCurveTo(0, c * 0.07, -c * 0.09, 0); g.fill();
      g.fillStyle = "#1b2340"; g.beginPath(); g.moveTo(-c * 0.07, 0); g.quadraticCurveTo(0, -c * 0.05, c * 0.07, 0); g.quadraticCurveTo(0, c * 0.05, -c * 0.07, 0); g.fill(); g.restore();
      flower(x, y, c * 0.035, "#efe2c6", "#a8445a", 6, a);
    }
    // pelo da lã
    for (let k = 0; k < 26000; k++) { const x = R() * w, y = R() * h; if (Math.hypot(x - c, y - c) > c - 1) continue; g.fillStyle = R() > 0.5 ? "rgba(255,240,220,0.06)" : "rgba(0,0,0,0.1)"; g.fillRect(x, y, 1.6, 1.6); }
  });
}
