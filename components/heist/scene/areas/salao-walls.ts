/*
 * MET Gala Heist v2 — Grande Salão — piso, paredes, teto e mezanino no padrão dos salões de castelo (Resident Evil
 * Village como linguagem): mármore Botticino polido em placas de 1,2 m com frisos de granito negro, filete de latão e
 * losangos de Rosso nas esquinas; a rosácea de mármores em volta da instalação floral; a barra grega de granito ao longo
 * das paredes; tapetes redondos sob as mesas dos patronos; lambri de nogueira com almofadas em relevo e molduras de
 * pedra nos panos livres das paredes; lustres "Coroa Celeste" (anéis de bronze, cristais em fios e guirlandas de contas)
 * nas naves norte e sul; camarotes com poltronas no mezanino; o painel de veludo com estrelas atrás do DJ.
 */
import * as THREE from "three";
import { BOX0, CYL, CYL0, SPH, geo, mat, mul } from "../interior-batch";
import { BALC_Y, HALL_H } from "../interior-hall";
import type { Quality } from "../interior-tex";
import { type RoomsCtx, A } from "./kit";
import { ROOM, fbm, hash2, lathe, mix, rand, raisedPanel, salaoFabric, salaoGlow, salaoMat, salaoSolid, salaoTexture, sparkleTexture, surface, surfaceMat, tube, vein, vnoise } from "./salao-kit";

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
const RO = 3.05;
/** Rosácea em volta da instalação floral (anel de 1,6 a 3,05 m): rosa dos ventos de 16 pontas em mármores. */
function rosetteSurface(q: Quality) {
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
function meanderSurface(q: Quality) {
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
function rugTexture(): THREE.Texture {
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

/** Rosácea, barra grega ao longo das paredes e tapetes sob as mesas dos patronos (sobre o piso, com o mesmo reflexo). */
function floorInlays(c: RoomsCtx) {
  const q = c.q;
  // rosácea: anel em volta da base da instalação floral (r 1,6), com o reflexo do piso polido
  const ros = surfaceMat(`rosette-${q}`, rosetteSurface(q), { mirror: [0.8, 0.05], polygonOffset: true });
  c.batch.add(ROOM, ros, geo("salao-rosetteRing", () => {
    const g = new THREE.RingGeometry(1.6, RO, 96, 2), p = g.getAttribute("position") as THREE.BufferAttribute, uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * RO) + 0.5, p.getY(i) / (2 * RO) + 0.5);
    return g.rotateX(-Math.PI / 2);
  }), mat(0, 0.003, 4.5), { receive: true });
  // barra grega: 0,45 m, a 0,35 m das paredes (passa sob os móveis encostados, interrompe nas portas)
  const mm = surfaceMat(`meander-${q}`, meanderSurface(q), { mirror: [0.7, 0.05], polygonOffset: true });
  const strip = (x0: number, z0: number, x1: number, z1: number) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = alongX ? x1 - x0 : z1 - z0, w = 0.45;
    const g = new THREE.PlaneGeometry(len, w).rotateX(-Math.PI / 2), uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 0.9, uv.getY(i));
    c.batch.add(ROOM, mm, g, mat((x0 + x1) / 2, 0.003, (z0 + z1) / 2, alongX ? 0 : Math.PI / 2), { receive: true });
  };
  // (as faixas norte/sul vão de canto a canto; as leste/oeste começam onde aquelas terminam, sem sobrepor)
  const o = 0.35 + 0.225, e = o - 0.225, i = o + 0.225;
  for (const [x0, x1] of [[-12 + e, -3.2], [3.2, 12 - e]]) { strip(x0, -6 + o, x1, -6 + o); strip(x0, 14 - o, x1, 14 - o); }
  for (const [z0, z1] of [[-6 + i, 8.1], [11.9, 14 - i]]) { strip(-12 + o, z0, -12 + o, z1); strip(12 - o, z0, 12 - o, z1); }
  // tapetes redondos de lã (1,2 cm) sob as mesas dos patronos, sem reflexo
  const rug = salaoMat("rugMat", () => new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.96, transparent: true, alphaTest: 0.5, envMapIntensity: 0.3 }));
  for (const [x, z] of [[-6.8, -3.5], [-6.6, 2.0], [-6.6, 7.2]]) {
    c.batch.add(ROOM, rug, geo("salao-rugDisc", () => new THREE.CylinderGeometry(1.85, 1.86, 0.012, 64, 1).translate(0, 0.006, 0)), mat(x, 0.002, z), { receive: true });
  }
}

/* ======================= paredes ======================= */
/** Cantaria de calcário quente: blocos de 1,2 × 0,6 m com junta chanfrada, poros e veladura. */
export function wallSurfaceSalao(q: Quality) {
  return surface(`stone-${q}`, q === "high" ? 1024 : 512, (u, v, o) => {
    // a textura cobre 2,4 × 1,2 m: 2 fiadas de 0,6 m, blocos de 1,2 m desencontrados
    const row = Math.floor(v * 2), lv = v * 2 % 1, off = row % 2 ? 0.25 : 0, lu = ((u + off) % 1) * 2 % 1;
    const jv = Math.min(lv, 1 - lv), ju = Math.min(lu, 1 - lu), j = Math.min(jv * 0.5, ju);
    const n = fbm(u, v, 6, 71, 4), pores = vnoise(u * 160, v * 80, 160, 73) > 0.86 ? 0.88 : 1, block = Math.floor((u + off) * 2) + row * 7;
    const tone = (hash2(block, row, 75) - 0.5) * 0.06, b = (0.76 + tone + 0.06 * (n - 0.5)) * pores;
    if (j < 0.004) { o[0] = 0.46; o[1] = 0.4; o[2] = 0.33; o[3] = 0.25; o[4] = 0.95; return; }
    const ch = Math.min(1, j / 0.012);                                               // chanfro da junta
    o[0] = b * 1.02; o[1] = b * 0.94; o[2] = b * 0.8; o[3] = 0.35 + 0.15 * ch + 0.05 * n; o[4] = 0.78 - 0.1 * n;
  }, 1.6);
}
export const wallMaterialSalao = (q: Quality) => surfaceMat(`stone-${q}`, wallSurfaceSalao(q), { env: 0.6, normal: 1.1 });

type Side = "N" | "S" | "W" | "E";
/** Matriz num ponto da face interna: s ao longo da parede, y, afastado `off`; a face local olha para +z (dentro da sala). */
const onWall = (w: Side, s: number, y: number, off: number) => {
  switch (w) {
    case "N": return mat(s, y, -6 + off, 0);
    case "S": return mat(s, y, 14 - off, Math.PI);
    case "W": return mat(-12 + off, y, s, Math.PI / 2);
    case "E": return mat(12 - off, y, s, -Math.PI / 2);
  }
};
/** Trechos ocupados de cada parede (arcos com moldura, portas, pilastras, telão, cartaz-pista). */
const BUSY: Record<Side, [number, number][]> = {
  N: [[-11.7, -10.9], [-11.1, -4.9], [-4.4, -3.6], [-3.1, 3.1], [2.7, 3.5], [8.9, 9.7], [10.9, 11.7]],
  S: [[-11.7, -10.9], [-11.1, -4.9], [-4.4, -3.6], [-3.1, 3.1], [3.6, 4.4], [4.9, 11.1], [10.9, 11.7]],
  W: [[-5.0, -4.2], [-0.9, 5.9], [6.2, 7.8], [7.9, 12.1], [12.5, 13.3]],
  E: [[-5.6, -4.8], [-4.9, 2.9], [3.4, 4.2], [7.0, 7.8], [7.9, 12.1], [12.5, 13.3]],
};
const SPAN: Record<Side, [number, number]> = { N: [-12, 12], S: [-12, 12], W: [-6, 14], E: [-6, 14] };
function freeSpans(w: Side, min = 0.9): [number, number][] {
  const busy = BUSY[w].slice().sort((a, b) => a[0] - b[0]), out: [number, number][] = [];
  let a = SPAN[w][0];
  for (const [b0, b1] of busy) { if (b0 - a >= min) out.push([a, b0]); a = Math.max(a, b1); }
  if (SPAN[w][1] - a >= min) out.push([a, SPAN[w][1]]);
  return out;
}
/**
 * Lambri de nogueira (0–1,06 m) com almofadas em relevo, rodapé de mármore negro e chapim, e acima dele quadros de
 * moldura dupla de pedra até 4,2 m nos panos livres; atrás do telão (norte) e do DJ (leste) só o lambri.
 */
function boiserie(c: RoomsCtx) {
  const P = c.P, walnut = P.walnut, plinth = P.marbleDark, mold = salaoSolid("stoneMold", "#d8ccb4", { rough: 0.62, env: 0.6 }), gold = P.gold;
  for (const w of ["N", "S", "W", "E"] as Side[]) for (const [a0, a1] of freeSpans(w)) {
    const len = a1 - a0, mid = (a0 + a1) / 2, at = (s: number, y: number, off: number) => onWall(w, s, y, off);
    c.batch.add(ROOM, plinth, BOX0(), mul(at(mid, 0, 0.02), mat(0, 0, 0, 0, len, 0.16, 0.04)));                          // rodapé
    c.batch.add(ROOM, walnut, BOX0(), mul(at(mid, 0.16, 0.012), mat(0, 0, 0, 0, len, 0.86, 0.024)), { cast: true });     // fundo do lambri
    c.batch.add(ROOM, walnut, BOX0(), mul(at(mid, 0.16, 0.03), mat(0, 0, 0, 0, len, 0.07, 0.03)));                       // travessa de baixo
    c.batch.add(ROOM, walnut, BOX0(), mul(at(mid, 0.93, 0.03), mat(0, 0, 0, 0, len, 0.07, 0.03)));                       // travessa de cima
    c.batch.add(ROOM, walnut, geo("salao-chairRail", () => new THREE.CylinderGeometry(0.03, 0.03, 1, 10, 1).rotateZ(Math.PI / 2).translate(0, 0.03, 0)), mul(at(mid, 1.0, 0.04), mat(0, 0, 0, 0, len, 1, 1)));
    c.batch.add(ROOM, walnut, BOX0(), mul(at(mid, 1.0, 0.025), mat(0, 0, 0, 0, len, 0.06, 0.05)));                      // chapim
    const n = Math.max(1, Math.round(len / 0.95)), pw = len / n;
    for (let k = 0; k < n; k++) {
      const s = a0 + (k + 0.5) * pw;
      c.batch.add(ROOM, walnut, BOX0(), mul(at(a0 + k * pw, 0.23, 0.03), mat(0, 0, 0, 0, 0.07, 0.7, 0.03)));              // montante
      c.inst.add(ROOM, `salao-dado-${Math.round(pw * 20)}`, raisedPanel(`dado${Math.round(pw * 20)}`, pw - 0.14, 0.62, 0.03, 0.035), walnut, mul(at(s, 0.575, 0.024), mat(0, 0, 0)));
    }
    c.batch.add(ROOM, walnut, BOX0(), mul(at(a1, 0.23, 0.03), mat(0, 0, 0, 0, 0.07, 0.7, 0.03)));
    // quadros de pedra (moldura dupla) acima do lambri — menos atrás do telão e do painel do DJ
    const hidden = (w === "N" && a0 > 3 && a1 < 9.1) || (w === "E" && a0 > 3.5 && a1 < 7.2);
    if (hidden || len < 1.3) continue;
    for (const [inset, t] of [[0.18, 0.07], [0.32, 0.035]] as [number, number][]) {
      const x0 = a0 + inset, x1 = a1 - inset, y0 = 1.45 + inset - 0.18, y1 = 4.35 - inset + 0.18, fw = x1 - x0, fh = y1 - y0;
      c.batch.add(ROOM, mold, BOX0(), mul(at((x0 + x1) / 2, y0, 0.03), mat(0, 0, 0, 0, fw, t, 0.045)));
      c.batch.add(ROOM, mold, BOX0(), mul(at((x0 + x1) / 2, y1 - t, 0.03), mat(0, 0, 0, 0, fw, t, 0.045)));
      c.batch.add(ROOM, mold, BOX0(), mul(at(x0 + t / 2, y0, 0.03), mat(0, 0, 0, 0, t, fh, 0.045)));
      c.batch.add(ROOM, mold, BOX0(), mul(at(x1 - t / 2, y0, 0.03), mat(0, 0, 0, 0, t, fh, 0.045)));
    }
    // florão dourado no centro de cada quadro
    c.inst.add(ROOM, "salao-boss", geo("salao-bossGeo", () => new THREE.SphereGeometry(0.11, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2)), gold, mul(at(mid, 2.9, 0.03), mat(0, 0, 0)));
  }
}

/* ======================= painel atrás do DJ ======================= */
/** Veludo negro com um céu de pontinhos (fibra ótica) e o monograma da Gala em latão iluminado. */
function djBackdrop(c: RoomsCtx) {
  const velvet = salaoFabric("djVelvet", "#08070b", c.q, { sheen: "#3a2a55", rough: 0.85 });
  const drape = geo("salao-djDrape", () => {
    const g = new THREE.PlaneGeometry(4.4, 4.8, 64, 4), p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, 0.05 * Math.sin(p.getX(i) * 9) + 0.02 * Math.sin(p.getX(i) * 23));
    g.translate(0, 2.4, 0); g.computeVertexNormals(); return g;
  });
  c.batch.add(ROOM, velvet, drape, mat(11.72, 0.08, 4.5, -Math.PI / 2), { cast: false });
  c.batch.add(ROOM, c.P.gold, CYL(12), mat(11.7, 4.92, 4.5, 0, 0.03, 4.6, 0.03, Math.PI / 2));          // varão de latão
  for (const z of [2.25, 6.75]) c.batch.add(ROOM, c.P.gold, SPH(12), mat(11.7, 4.92, z, 0, 0.06));
  // fibra ótica: pontinhos que cintilam (o mesmo campo dos globos, aditivo, girando devagar no tique)
  const stars = salaoGlow("djStars", "#cfd8ff", 1.3, { additive: true, map: sparkleTexture() });
  const sp = new THREE.Mesh(geo("salao-djStarsGeo", () => new THREE.PlaneGeometry(4.2, 4.2)), stars);
  sp.position.set(11.6, 2.6, 4.5); sp.rotation.y = -Math.PI / 2; sp.userData.room = ROOM; sp.renderOrder = 3; c.group.add(sp);
  const st = stars.map!; st.repeat.set(2, 2);
  c.ticks.push({ room: ROOM, tick: (t) => { st.offset.set(t * 0.004, Math.sin(t * 0.3) * 0.01); stars.opacity = 0.75 + 0.25 * Math.sin(t * 2.7); } });
  // monograma "GL" num medalhão de latão com luz por trás
  const mono = salaoTexture("monogram", 512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); const cx = w / 2;
    const grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx); grd.addColorStop(0, "rgba(255,214,150,0.55)"); grd.addColorStop(0.62, "rgba(255,190,110,0.25)"); grd.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#f2d08a"; g.lineWidth = 10; g.beginPath(); g.arc(cx, cx, cx * 0.62, 0, Math.PI * 2); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(cx, cx, cx * 0.56, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#f6dc9c"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `italic 600 ${Math.round(h * 0.32)}px 'Didot', 'Bodoni 72', Georgia, serif`; g.fillText("GL", cx, cx + h * 0.02);
  }, true);
  const mm = salaoGlow("monogramGlow", "#ffffff", 1.4, { additive: true, map: mono });
  c.batch.add(ROOM, mm, geo("salao-monoPlane", () => new THREE.PlaneGeometry(1.6, 1.6)), mat(11.66, 3.25, 4.5, -Math.PI / 2));
  A(c, ROOM, 11.0, 3.4, 4.5, "#ffc983", 4, 4);
}

/* ======================= lustres "Coroa Celeste" ======================= */
/**
 * Lustre de três anéis de bronze escalonados (Ø 1,9 / 1,4 / 0,85 m · s), braços em S com velas, fios de cristais
 * pendentes de cada braço, guirlandas de contas entre os braços, coroa de pontas no alto, florão no teto e corrente.
 */
export function crownChandelier(c: RoomsCtx, x: number, y: number, z: number, ceiling: number, s = 1) {
  const P = c.P, bronze = salaoSolid("bronze", "#8a6430", { metal: 1, rough: 0.32 }), crys = salaoSolid("crystal", "#f4f6ff", { metal: 0.1, rough: 0.02, env: 2.4, transparent: true, opacity: 0.86 });
  const prism = geo("salao-prism", () => new THREE.OctahedronGeometry(1, 0).scale(0.45, 1.35, 0.45)), bead = SPH(8);
  // florão no teto, corrente (elos alternados) e haste
  c.batch.add(ROOM, P.gold, lathe("ceilRose", [[0, 0], [0.32, 0], [0.34, -0.03], [0.26, -0.07], [0.12, -0.1], [0.05, -0.16], [0, -0.17]], 32), mat(x, ceiling, z, 0, s));
  const top = y + 1.05 * s, links = Math.max(2, Math.floor((ceiling - 0.17 - top) / 0.09));
  for (let k = 0; k < links; k++) c.inst.add(ROOM, "salao-chainLink", geo("salao-linkGeo", () => new THREE.TorusGeometry(0.03, 0.008, 6, 12).scale(1, 1.6, 1)), bronze, mat(x, ceiling - 0.2 - k * 0.09, z, (k % 2) * Math.PI / 2, s));
  c.batch.add(ROOM, bronze, lathe("chColumn", [[0, 0], [0.07, 0], [0.09, 0.08], [0.05, 0.2], [0.08, 0.35], [0.05, 0.55], [0.1, 0.7], [0.06, 0.9], [0.04, 1.05], [0, 1.05]], 20), mat(x, y, z, 0, s));
  // coroa no alto
  c.batch.add(ROOM, bronze, geo("salao-crownRing", () => new THREE.TorusGeometry(0.3, 0.018, 6, 40).rotateX(Math.PI / 2)), mat(x, y + 0.98 * s, z, 0, s));
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; c.inst.add(ROOM, "salao-crownPoint", geo("salao-crownPointGeo", () => new THREE.ConeGeometry(0.025, 0.12, 6).translate(0, 0.06, 0)), bronze, mat(x + Math.cos(a) * 0.3 * s, y + 0.98 * s, z + Math.sin(a) * 0.3 * s, 0, s)); }
  const tiers: [number, number, number][] = [[0.95, 0.28, 12], [0.7, 0.55, 8], [0.42, 0.78, 6]];
  for (const [rr, h, n] of tiers) {
    const R = rr * s, Y = y + h * s;
    c.batch.add(ROOM, bronze, geo(`salao-tierRing${rr}`, () => new THREE.TorusGeometry(rr, 0.022, 6, 64).rotateX(Math.PI / 2)), mat(x, Y, z, 0, s));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, cx = x + Math.cos(a) * R, cz = z + Math.sin(a) * R;
      // braço em S do anel até o bocal da vela
      c.batch.add(ROOM, bronze, tube(`chArm${rr}`, [[0, 0, 0], [0.05, 0.06, 0], [0.12, 0.02, 0], [0.16, 0.1, 0]], 0.012, 10, 5), mul(mat(cx, Y, cz, -a, s), mat(0, 0, 0)));
      const bx = cx + Math.cos(a) * 0.16 * s, bz = cz + Math.sin(a) * 0.16 * s;
      c.inst.add(ROOM, "salao-bobeche", geo("salao-bobecheGeo", () => new THREE.CylinderGeometry(0.045, 0.02, 0.025, 12).translate(0, 0.012, 0)), bronze, mat(bx, Y + 0.1 * s, bz, 0, s));
      c.inst.add(ROOM, "salao-chCandle", CYL0(8), P.candle, mat(bx, Y + 0.12 * s, bz, 0, 0.016 * s, 0.12 * s, 0.016 * s));
      c.inst.add(ROOM, "salao-chBulb", geo("salao-flameBulb", () => new THREE.SphereGeometry(1, 8, 6).scale(0.55, 1.35, 0.55)), P.bulbWarm, mat(bx, Y + 0.27 * s, bz, 0, 0.028 * s));
      // fio de cristais pendente de cada braço
      for (let d = 0; d < (c.q === "high" ? 5 : 3); d++) c.inst.add(ROOM, "salao-prism", prism, crys, mat(cx, Y - (0.06 + d * 0.075) * s, cz, a, 0.022 * s));
      // guirlanda de contas até o próximo braço (catenária)
      const b = ((k + 1) / n) * Math.PI * 2, ex = x + Math.cos(b) * R, ez = z + Math.sin(b) * R, nb = c.q === "high" ? 9 : 5;
      for (let i = 1; i < nb; i++) { const t = i / nb, px = cx + (ex - cx) * t, pz = cz + (ez - cz) * t, sag = Math.sin(Math.PI * t) * 0.12 * s; c.inst.add(ROOM, "salao-bead", bead, crys, mat(px, Y - 0.02 * s - sag, pz, 0, 0.011 * s)); }
    }
  }
  // gota final de cristal
  c.inst.add(ROOM, "salao-prismBig", prism, crys, mat(x, y - 0.12 * s, z, 0, 0.06 * s));
  c.inst.add(ROOM, "salao-ball", SPH(14), crys, mat(x, y - 0.02 * s, z, 0, 0.07 * s));
}

/* ======================= camarotes no mezanino ======================= */
/** Poltronas bergère aos pares com mesinha e abajur, no mezanino norte e sul (fora da área jogável: só vista). */
function mezzanineBoxes(c: RoomsCtx) {
  const P = c.P, top = BALC_Y + 0.4, frame = P.gold, velvet = salaoFabric("boxVelvet", "#5b1430", c.q, { sheen: "#c27a95" });
  const seat = geo("salao-bergSeat", () => new THREE.BoxGeometry(0.62, 0.14, 0.56, 2, 1, 2).translate(0, 0.07, 0));
  const back = geo("salao-bergBack", () => { const s = new THREE.Shape(); s.moveTo(-0.3, 0); s.lineTo(0.3, 0); s.lineTo(0.3, 0.45); s.quadraticCurveTo(0, 0.68, -0.3, 0.45); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }); });
  const arm = geo("salao-bergArm", () => new THREE.CapsuleGeometry(0.05, 0.42, 4, 8).rotateX(Math.PI / 2));
  const leg = geo("salao-bergLeg", () => new THREE.CylinderGeometry(0.022, 0.014, 0.3, 8).translate(0, 0.15, 0));
  const shade = salaoFabric("boxShade", "#f1d9a6", c.q, { side: THREE.DoubleSide });
  const groups: [Side, number][] = [["N", -9.6], ["N", -2.4], ["N", 6.0], ["S", -9.4], ["S", -1.6], ["S", 6.6]];
  for (const [w, s] of groups) {
    const base = mul(onWall(w, s, top, 0), mat(0, 0, 0.62));                      // a 0,62 m da parede, olhando para a balaustrada
    for (const dx of [-0.48, 0.48]) {
      const at = mul(base, mat(dx, 0, 0, dx > 0 ? -0.25 : 0.25));
      for (const [lx, lz] of [[-0.26, -0.22], [0.26, -0.22], [-0.26, 0.22], [0.26, 0.22]]) c.inst.add(ROOM, "salao-bergLegs", leg, frame, mul(at, mat(lx, 0, lz)));
      c.inst.add(ROOM, "salao-bergSeat", seat, velvet, mul(at, mat(0, 0.3, 0)));
      c.inst.add(ROOM, "salao-bergBack", back, velvet, mul(at, mat(0, 0.42, -0.31)));
      c.inst.add(ROOM, "salao-bergFrame", geo("salao-bergFrameGeo", () => new THREE.TorusGeometry(0.33, 0.016, 6, 24, Math.PI).translate(0, 0.0, 0)), frame, mul(at, mat(0, 0.86, -0.25, 0, 1, 0.75, 1)));
      for (const sx of [-0.33, 0.33]) c.inst.add(ROOM, "salao-bergArm", arm, velvet, mul(at, mat(sx, 0.56, 0)));
    }
    // mesinha redonda de mármore com abajur
    c.batch.add(ROOM, frame, lathe("boxTableFoot", [[0, 0], [0.16, 0], [0.04, 0.05], [0.03, 0.55], [0.05, 0.6], [0, 0.6]], 16), mul(base, mat(0, 0, -0.05)));
    c.batch.add(ROOM, P.marbleDark, CYL0(24), mul(base, mat(0, 0.6, -0.05, 0, 0.22, 0.025, 0.22)));
    c.batch.add(ROOM, frame, lathe("boxLamp", [[0, 0], [0.06, 0], [0.02, 0.03], [0.015, 0.25], [0, 0.25]], 12), mul(base, mat(0, 0.625, -0.05)));
    c.inst.add(ROOM, "salao-boxShade", geo("salao-boxShadeGeo", () => new THREE.CylinderGeometry(0.07, 0.11, 0.13, 16, 1, true)), shade, mul(base, mat(0, 0.92, -0.05)));
    c.inst.add(ROOM, "salao-boxBulb", SPH(8), P.bulbWarm, mul(base, mat(0, 0.9, -0.05, 0, 0.03)));
    const lp = new THREE.Vector3(0, 0.95, -0.05).applyMatrix4(base); A(c, ROOM, lp.x, lp.y, lp.z, "#ffc77f", 2.2, 3, { flicker: 0.2 });
  }
}

/** Decoração da arquitetura do salão (piso, paredes, teto, mezanino). */
/* ======================= cortinas pesadas nos arcos dos doces e do bufê ======================= */
/**
 * Painel de cortina preso por abraçadeira: largura `w` no varão, pregas fundas (0,16 m), estrangulado na abraçadeira
 * (a 1,1 m) e abrindo um pouco até o chão. x vai da borda de fora (0) para dentro (+x); o bojo sai para −z (o salão).
 */
function drapePanel(w: number, h: number): THREE.BufferGeometry {
  return geo(`salao-drape-${w}-${h}`, () => {
    const nu = 28, nv = 22, ht = 1.1, pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const gather = (y: number) => y >= ht ? Math.pow((h - y) / (h - ht), 1.5) : 1 - 0.28 * ((ht - y) / ht);
    for (let j = 0; j <= nv; j++) {
      const t = j / nv, y = ht + (t < 0.5 ? -ht * (1 - t * 2) : (h - ht) * (t * 2 - 1)), gth = gather(y), width = w * (1 - 0.74 * gth);
      for (let i = 0; i <= nu; i++) {
        const u = i / nu, amp = 0.035 + 0.035 * gth, sag = gth * 0.06 * Math.sin(u * Math.PI);
        pos.push(u * width, y, amp * Math.sin(u * Math.PI * 2 * (w / 0.16)) - sag); uv.push(u * w / 0.5, y / 1.0);
      }
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + nu + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals(); return g;
  });
}
/** Cortinas de veludo bordô com bandô, galão e borla dourados nos arcos sudoeste (doces) e sudeste (bufê). */
function drapes(c: RoomsCtx) {
  const P = c.P, velvet = salaoFabric("drapeVelvet", "#4a0d18", c.q, { sheen: "#c2455a", rough: 0.82, side: THREE.DoubleSide });
  const Z = 13.78, top = 4.42, outer = 2.88, w = 0.92;                                   // cortina a 0,2 m da parede sul (o salão fica em −z)
  const tassel = lathe("tassel", [[0, 0], [0.035, 0.01], [0.05, 0.1], [0.022, 0.14], [0.03, 0.17], [0.012, 0.2], [0, 0.2]], 10);
  for (const s of [-8, 8]) {
    for (const side of [-1, 1]) {
      // painel: espelhado do lado direito (a borda de fora fica no flanco do arco)
      const x0 = s + side * outer;
      c.batch.add(ROOM, velvet, drapePanel(w, top), mat(x0, 0, Z, 0, -side, 1, 1), { cast: true });
      // abraçadeira (cordão dourado) e a borla pendurada
      const xt = x0 - side * w * 0.26 * 0.5;
      c.batch.add(ROOM, P.gold, geo("salao-tieback", () => new THREE.TorusGeometry(0.14, 0.014, 6, 20).rotateX(Math.PI / 2).scale(1, 1, 0.55)), mat(xt, 1.1, Z - 0.01, 0));
      c.batch.add(ROOM, P.gold, tassel, mat(xt + side * 0.05, 0.86, Z - 0.1, 0));
      // gancho de parede da abraçadeira
      c.batch.add(ROOM, P.gold, SPH(8), mat(x0 + side * 0.02, 1.1, 13.93, 0, 0.035, 0.035, 0.035));
    }
    // bandô: caixa de veludo sobre o varão, galão e franja de borlas pequenas
    const bw = outer * 2 + 0.2;
    c.batch.add(ROOM, velvet, BOX0(), mat(s, top - 0.02, 13.78, 0, bw, 0.44, 0.24), { cast: true });
    for (const y of [top + 0.04, top + 0.36]) c.batch.add(ROOM, P.gold, BOX0(), mat(s, y, 13.655, 0, bw + 0.01, 0.025, 0.012));
    for (let k = 0; k <= 22; k++) c.inst.add(ROOM, "salao-fringe", geo("salao-fringeCone", () => new THREE.ConeGeometry(0.018, 0.09, 6).rotateX(Math.PI)), P.gold, mat(s - bw / 2 + 0.1 + k * (bw - 0.2) / 22, top - 0.065, 13.68, 0));
  }
}

export function dressWalls(c: RoomsCtx) {
  floorInlays(c);
  boiserie(c);
  djBackdrop(c);
  mezzanineBoxes(c);
  drapes(c);
  // lustres "Coroa Celeste": sobre a mesa dos patronos ao norte, diante do telão, e sobre os doces e o bufê ao sul
  for (const [x, y, z, s] of [[-6.8, 6.4, -3.5, 1.0], [6.0, 6.5, -3.4, 0.9], [-8, 6.6, 11.6, 0.9], [8, 6.6, 11.6, 0.9]] as [number, number, number, number][]) {
    crownChandelier(c, x, y, z, HALL_H - 0.02, s);
    A(c, ROOM, x, y + 0.35, z, "#ffd29a", 26, 12);
  }
}
