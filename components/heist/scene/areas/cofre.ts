/*
 * MET Gala Heist v2 — Sala das Joias (Z08: guarda, acervo e conservação), pé-direito 5,2 m.
 *
 * Um tesouro de museu fechado e escuro: piso de Nero Marquina polido com faixa de Rosso Levanto e, sob o pedestal, a
 * rosácea de dezesseis pontas em latão, Thassos e Rosso; lambri de nogueira com almofadas em relevo e rodapé de mármore;
 * paredes de seda adamascada ameixa em painéis emoldurados por filete dourado entre pilastras; friso e cornija de laca;
 * teto de laca ameixa-negra em caixotões com o tambor e a cúpula dourada sobre o pedestal (o anel de spots duros); as
 * vitrines de joias em alcovas, o grande nicho da parede oeste (fundo da vista da porta), a janela com cortinas de
 * veludo, os postes emissores dos lasers, câmeras e, no canto sul, a conservação (mesa de restauração, mapoteca,
 * estação fotográfica, carrinho de acervo). Sem energia (quadro de luz cortado) as luzes da sala apagam e acendem as de
 * emergência.
 */
import * as THREE from "three";
import { LASERS } from "@/lib/heist/level";
import { CYL, CYL0, SPH, geo, mat } from "../interior-batch";
import type { Quality } from "../interior-tex";
import { type RoomsCtx, A, PLANE, beacon, lightCone, signMat } from "./kit";
import type { AreaModule, KeyDef } from "./types";
import { type Fr, archFill, archRing, at, bx, frame, langOf, lathe, lit, moldingGeo, once, paint, plain, planeUp, raisedPanel, thickGlass } from "./galeria-kit";
import { jewelBust, necklace, earrings, tiara, crystalMat } from "./galeria-trajes";
import { DAMASK_TILE, NERO_TILE, damaskMat, floorNero, inlayBrass, lacquerPlum, neroMat, reportTex, rossoMat, thassosMat } from "./cofre-tex";
import { brassC, caseLight, fixture, goldC, jewelCase, pedestal, steelGrey, tagGeo, tagMat, velvetBlack, velvetPlum } from "./cofre-props";

const ROOM = "cofre", H = 5.2, PX = -17.25, PZ = -14.25;

interface Wall { ax: number; az: number; yaw: number; len: number }
const WALLS: Record<"N" | "S" | "W" | "E", Wall> = {
  N: { ax: -22, az: -22, yaw: 0, len: 9.5 },                 // x local = X + 22 (janela 2…3)
  S: { ax: -12.5, az: -6.5, yaw: Math.PI, len: 9.5 },        // x local = −12,5 − X (duto 4,5…5,5)
  W: { ax: -22, az: -6.5, yaw: Math.PI / 2, len: 15.5 },     // x local = −6,5 − Z
  E: { ax: -12.5, az: -22, yaw: -Math.PI / 2, len: 15.5 },   // x local = Z + 22 (porta 6…8)
};
const wf = (w: Wall): Fr => frame(w.ax, w.az, w.yaw);
/** Trechos do lambri (sem a janela, o duto, a porta com o giro da folha e as alcovas das vitrines). */
const WAINSCOT: Record<"N" | "S" | "W" | "E", [number, number][]> = {
  N: [[0, 1.9], [3.1, 4.15], [5.35, 7.42]], S: [[0, 4.4], [5.6, 9.5]], W: [[0, 2.12], [5.88, 6.72], [8.78, 10.12], [13.88, 15.5]], E: [[0, 5.6], [8.3, 15.5]],
};
/** Pilastras de nogueira entre os painéis de seda (x local). */
const PILASTERS: Record<"N" | "S" | "W" | "E", number[]> = { N: [0.18, 3.55, 6.0], S: [0.18, 3.4, 6.6, 9.32], W: [0.18, 6.2, 9.3, 15.32], E: [0.18, 3.0, 11.5, 15.32] };
/** Painéis de seda emoldurados (x local de início e fim). */
const BAYS: Record<"N" | "S" | "W" | "E", [number, number][]> = {
  N: [[0.36, 3.37], [6.18, 7.3]], S: [[0.36, 3.22], [3.58, 6.42], [6.78, 9.14]], W: [[0.36, 2.0], [14.0, 15.14]], E: [[0.36, 2.82], [3.18, 5.5], [8.4, 11.32], [11.68, 15.14]],
};
const SKIRT: [number, number][] = [[0, 0], [0.032, 0], [0.032, 0.135], [0.026, 0.15], [0, 0.15]];
const RAIL: [number, number][] = [[0, 0.86], [0.05, 0.86], [0.066, 0.875], [0.07, 0.9], [0.062, 0.915], [0.04, 0.93], [0, 0.93]];
const CORNICE: [number, number][] = [[0, 4.6], [0.03, 4.6], [0.03, 4.64], [0.06, 4.66], [0.07, 4.72], [0.12, 4.76], [0.18, 4.82], [0.26, 4.9], [0.3, 4.95], [0.3, 5.0], [0.36, 5.05], [0.36, 5.2], [0, 5.2]];

function cofre(c: RoomsCtx) {
  floorInlays(c);
  walls(c);
  niches(c);
  windowDrapes(c);
  moonlight(c);
  ceiling(c);
  laserPosts(c);
  cameras(c);
  signsAndConservationWall(c);
  scallops(c);
  lights(c);
  power(c);
}

/** Leque de luz dos spots embutidos na seda (aditivo, um lote): o que os poucos pontos dinâmicos não pintam no "low". */
const scallopMat = () => lit("cofre-vieira", "#ffe2bf", 0.32, { additive: true, map: paint("cofre-vieiraTex2", 128, 128, (g, w, h) => {
  // leque: núcleo no alto, abrindo para baixo como o facho de um spot rente à parede; zero em todas as bordas
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w, v = (y + 0.5) / h, d = Math.hypot((u - 0.5) / (0.1 + 0.36 * v), (v - 0.1) / 0.86);
    const edge = Math.min(1, Math.min(u, 1 - u, v, 1 - v) / 0.08), a = Math.pow(Math.max(0, 1 - d), 1.6) * edge, k = (y * w + x) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(255 * a);
  }
  g.putImageData(img, 0, 0);
}, { srgb: false }) });
function scallops(c: RoomsCtx) {
  const m = scallopMat(), list: ["N" | "S" | "W" | "E", number][] = [["E", 1.6], ["E", 4.3], ["E", 9.9], ["E", 13.4], ["S", 1.8], ["S", 5.0], ["S", 8.0], ["N", 6.75], ["W", 1.2], ["W", 14.6]];
  for (const [k, x] of list) c.batch.add(ROOM, m, PLANE(), wf(WALLS[k])(x, 3.05, 0.016, 0, 1.5, 2.3, 1));
}

/* ---------- piso: faixa de Rosso, soleira de aço e a rosácea ---------- */
function floorInlays(c: RoomsCtx) {
  const q = c.q, R = rossoMat(q, true), y = 0.003, P = planeUp(), add = (x0: number, z0: number, x1: number, z1: number, m: THREE.Material, yy = y) => c.batch.add(ROOM, m, P, mat((x0 + x1) / 2, yy, (z0 + z1) / 2, 0, x1 - x0, 1, z1 - z0), { receive: true });
  add(-22, -22, -12.5, -21.65, R); add(-22, -6.85, -12.5, -6.5, R); add(-22, -21.65, -21.65, -6.85, R); add(-12.85, -21.65, -12.5, -6.85, R);
  const B = inlayBrass(q), f = 0.012;
  add(-21.65, -21.65 - f / 2, -12.85, -21.65 + f / 2, B, 0.0035); add(-21.65, -6.85 - f / 2, -12.85, -6.85 + f / 2, B, 0.0035);
  add(-21.65 - f / 2, -21.65, -21.65 + f / 2, -6.85, B, 0.0035); add(-12.85 - f / 2, -21.65, -12.85 + f / 2, -6.85, B, 0.0035);
  // soleira da porta blindada: chapa de aço com ranhuras
  add(-12.5, -16, -12.0, -14, steelGrey(), 0.004);
  for (let k = 0; k < 9; k++) add(-12.48, -15.9 + k * 0.22, -12.02, -15.88 + k * 0.22, plain("cofre-ranhura", "#2a2d31", { metal: 0.7, rough: 0.5 }), 0.0045);
  rosette(c);
}
/** Rosácea de 16 pontas sob o pedestal: raios em meias-pontas (Thassos e latão nas longas, Rosso e Thassos nas curtas), anéis de latão e a faixa com estrelinhas. */
function rosette(c: RoomsCtx) {
  const q = c.q, B = inlayBrass(q), W = thassosMat(q, true), Rm = rossoMat(q, true);
  const halves = (key: string, long: boolean, side: number) => geo(`cofre-rosa-${key}`, () => {
    const pos: number[] = [], rb = 0.66, d = Math.PI / 16;
    for (let k = 0; k < 16; k++) {
      if ((k % 2 === 0) !== long) continue;
      const a = (k / 16) * Math.PI * 2, rt = long ? 2.12 : 1.48, T = [Math.cos(a) * rt, Math.sin(a) * rt], M = [Math.cos(a) * rb, Math.sin(a) * rb];
      const Bp = [Math.cos(a + side * d) * rb * 1.02, Math.sin(a + side * d) * rb * 1.02];
      // triângulo (base lateral, ponta, meio) no plano XZ, olhando para cima
      if (side > 0) pos.push(Bp[0], 0, Bp[1], T[0], 0, T[1], M[0], 0, M[1]); else pos.push(M[0], 0, M[1], T[0], 0, T[1], Bp[0], 0, Bp[1]);
    }
    // garante que as faces olhem para cima (ordem anti-horária vista de cima) e só então tira o uv (mármore em metros)
    const n = pos.length / 3;
    for (let i = 0; i < n; i += 3) {
      const ax = pos[(i + 1) * 3] - pos[i * 3], az = pos[(i + 1) * 3 + 2] - pos[i * 3 + 2], bx2 = pos[(i + 2) * 3] - pos[i * 3], bz = pos[(i + 2) * 3 + 2] - pos[i * 3 + 2];
      if (az * bx2 - ax * bz < 0) for (let k = 0; k < 3; k++) { const t = pos[(i + 1) * 3 + k]; pos[(i + 1) * 3 + k] = pos[(i + 2) * 3 + k]; pos[(i + 2) * 3 + k] = t; }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(n).fill([0, 1, 0]).flat(), 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(Array.from({ length: n }, (_, i) => [pos[i * 3] / 0.75, pos[i * 3 + 2] / 0.75]).flat(), 2));
    return g;
  });
  const at0 = mat(PX, 0.0026, PZ);
  c.batch.add(ROOM, W, halves("longA", true, 1), at0); c.batch.add(ROOM, B, halves("longB", true, -1), at0);
  c.batch.add(ROOM, Rm, halves("shortA", false, 1), at0); c.batch.add(ROOM, W, halves("shortB", false, -1), at0);
  const ring = (r0: number, r1: number) => geo(`cofre-anel-${r0}-${r1}`, () => new THREE.RingGeometry(r0, r1, 96).rotateX(-Math.PI / 2));
  const ring2 = mat(PX, 0.0029, PZ);
  for (const [r0, r1] of [[0.62, 0.665], [2.15, 2.19], [2.47, 2.51], [2.58, 2.6]] as [number, number][]) c.batch.add(ROOM, B, ring(r0, r1), ring2);
  c.batch.add(ROOM, W, ring(2.19, 2.47), mat(PX, 0.0027, PZ));
  // estrelinhas de latão na faixa de Thassos
  const star = geo("cofre-estrelinha", () => { const s = new THREE.Shape(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = i % 2 ? 0.025 : 0.07; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(r, 0); } s.closePath(); return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2); });
  for (let k = 0; k < 32; k++) { const a = (k / 32) * Math.PI * 2; c.batch.add(ROOM, B, star, mat(PX + Math.cos(a) * 2.33, 0.0031, PZ + Math.sin(a) * 2.33, a)); }
}

/* ---------- paredes ---------- */
function walls(c: RoomsCtx) {
  const q = c.q, nero = neroMat(q), wal = c.P.walnut, gold = c.P.gold, lac = lacquerPlum();
  const skirt = moldingGeo("cofre-rodape", SKIRT), rail = moldingGeo("cofre-cadeira", RAIL), cornice = moldingGeo("cofre-cornija", CORNICE);
  for (const [k, w] of Object.entries(WALLS) as ["N" | "S" | "W" | "E", Wall][]) {
    const F = wf(w);
    // lambri: rodapé de mármore com filete de latão, fundo de nogueira, almofadas em relevo e a régua de cadeira
    for (const [a, b] of WAINSCOT[k]) {
      const len = b - a;
      c.batch.add(ROOM, nero, skirt, F((a + b) / 2, 0, 0, 0, len, 1, 1));
      bx(c.batch, ROOM, brassC(), F((a + b) / 2, 0.15, 0, 0, len, 0.008, 0.034));
      bx(c.batch, ROOM, wal, F((a + b) / 2, 0.158, 0, 0, len, 0.702, 0.022));
      const n = Math.max(1, Math.floor(len / 0.8)), pw = (len - 0.1 * (n + 1)) / n;
      if (pw > 0.15) for (let i = 0; i < n; i++) c.batch.add(ROOM, wal, raisedPanel(pw, 0.5, 0.02, 0.035), F(a + 0.1 + pw / 2 + i * (pw + 0.1), 0.26, 0.022));
      c.batch.add(ROOM, wal, rail, F((a + b) / 2, 0, 0, 0, len, 1, 1));
      bx(c.batch, ROOM, brassC(), F((a + b) / 2, 0.893, 0.066, 0, len, 0.008, 0.006));
    }
    // friso de laca com dois cordões dourados e a cornija
    c.batch.add(ROOM, lac, PLANE(), F(w.len / 2, 4.425, 0.004, 0, w.len, 0.35, 1));
    for (const y of [4.262, 4.588]) c.batch.add(ROOM, gold, CYL(8), F(w.len / 2, y, 0.012, 0, 0.01, w.len, 0.01, 0, Math.PI / 2));
    c.batch.add(ROOM, lac, cornice, F(w.len / 2, 0, 0, 0, w.len + 0.72, 1, 1), { cast: true });
    c.batch.add(ROOM, gold, CYL(8), F(w.len / 2, 4.745, 0.105, 0, 0.012, w.len, 0.012, 0, Math.PI / 2));
    // pilastras de nogueira com filetes dourados
    for (const x of PILASTERS[k]) {
      bx(c.batch, ROOM, wal, F(x, 0.93, 0, 0, 0.36, 3.32, 0.05), true);
      for (const e of [-1, 1]) bx(c.batch, ROOM, gold, F(x + e * 0.15, 1.0, 0.05, 0, 0.012, 3.15, 0.006));
      bx(c.batch, ROOM, wal, F(x, 4.1, 0, 0, 0.42, 0.15, 0.07));
    }
    // painéis de seda: filete dourado em retângulo
    for (const [a, b] of BAYS[k]) {
      const cx = (a + b) / 2, wd = b - a - 0.16, y0 = 1.06, y1 = 4.1;
      bx(c.batch, ROOM, gold, F(cx, y0, 0.006, 0, wd, 0.022, 0.014)); bx(c.batch, ROOM, gold, F(cx, y1 - 0.022, 0.006, 0, wd, 0.022, 0.014));
      for (const e of [-1, 1]) bx(c.batch, ROOM, gold, F(cx + e * (wd / 2 - 0.011), y0, 0.006, 0, 0.022, y1 - y0, 0.014));
    }
  }
  // porta blindada (lado da sala): só a verga e o batente do lado da fechadura (a folha abre encostando no outro)
  const E = wf(WALLS.E), B = steelGrey();
  bx(c.batch, ROOM, B, E(7.1, 2.88, 0, 0, 2.4, 0.18, 0.06)); bx(c.batch, ROOM, B, E(8.17, 0, 0, 0, 0.18, 2.88, 0.06));
}

/* ---------- nichos com joias (parede oeste, fundo da vista da porta; parede norte, sob a placa) ---------- */
function niches(c: RoomsCtx) {
  const q = c.q, wal = c.P.walnut, gold = c.P.gold;
  const glow = lit("cofre-luzNicho", "#ffcfa0", 0.55, { additive: true, map: paint("cofre-manchaNicho", 128, 128, (g, w, h) => { const grd = g.createRadialGradient(w / 2, h * 0.4, 2, w / 2, h * 0.5, w / 2); grd.addColorStop(0, "rgba(255,255,255,0.9)"); grd.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h); }, { srgb: false }) });
  const make = (F: Fr, x: number, r: number, sp: number, d: number, key: string) => {
    c.batch.add(ROOM, wal, archRing(`cofre-nicho-${key}`, r, 0.16, sp, d, 0.012), F(x, 0, 0.0), { cast: true });
    c.batch.add(ROOM, gold, archRing(`cofre-nichoFilete-${key}`, r + 0.16, 0.03, sp, d + 0.01, 0), F(x, 0, 0.0));
    c.batch.add(ROOM, velvetPlum(q), archFill(`cofre-nicho-${key}`, r, sp), F(x, 0, 0.012));
    c.batch.add(ROOM, glow, PLANE(), F(x, sp * 0.75, 0.02, 0, r * 2.4, sp * 1.1, 1));
    c.batch.add(ROOM, thickGlass("cofre-vidro"), archFill(`cofre-nicho-${key}`, r, sp), F(x, 0, d - 0.01));
  };
  // grande nicho oeste (no eixo do pedestal): plinto de mármore com a parure — colar no busto, tiara e brincos
  const W = wf(WALLS.W);
  make(W, 7.75, 0.8, 2.4, 0.32, "oeste");
  bx(c.batch, ROOM, neroMat(q), W(7.75, 0, 0.16, 0, 1.6, 0.9, 0.3));
  bx(c.batch, ROOM, brassC(), W(7.75, 0.9, 0.16, 0, 1.62, 0.015, 0.31));
  jewelBust(c.batch, ROOM, W, 7.75, 0.915, 0.14, 1.15);
  necklace(c.inst, ROOM, W, 7.75, 1.2, 0.17, 0.085, 24, plain("cofre-esmeralda", "#1f8a5a", { rough: 0.03, env: 3, emissive: "#0a3a20", ei: 0.4 }), "cofre-colar");
  tiara(c.batch, c.inst, ROOM, W, 7.25, 1.02, 0.15, 1.1); c.batch.add(ROOM, velvetBlack(q), lathe("cofre-suporteTiara2", [[0, 0], [0.09, 0], [0.09, 0.08], [0, 0.1]], 20), W(7.25, 0.915, 0.15));
  earrings(c.batch, c.inst, ROOM, W, 8.25, 0.915, 0.16, crystalMat());
  c.batch.add(ROOM, tagMat(c), tagGeo(12), W(7.75, 2.95, 0.03, 0, 0.7, 0.175, 1));
  // nicho norte, sob a placa da coleção: uma tiara num suporte de veludo
  const N = wf(WALLS.N);
  make(N, 4.75, 0.42, 1.95, 0.24, "norte");
  bx(c.batch, ROOM, neroMat(q), N(4.75, 0, 0.12, 0, 0.84, 1.05, 0.22));
  c.batch.add(ROOM, velvetBlack(q), lathe("cofre-suporteTiara3", [[0, 0], [0.08, 0], [0.08, 0.1], [0, 0.12]], 20), N(4.75, 1.05, 0.12));
  tiara(c.batch, c.inst, ROOM, N, 4.75, 1.17, 0.12, 1.15, plain("cofre-safira", "#2a4bd8", { rough: 0.03, env: 3, emissive: "#1a2a80", ei: 0.4 }));
}

/* ---------- janela para a cornija: cortinas de veludo presas, sanefa de laca com galão dourado ---------- */
function windowDrapes(c: RoomsCtx) {
  const N = wf(WALLS.N), vel = velvetPlum(c.q);
  const drape = geo("cofre-cortina", () => {
    const w = 0.62, h = 2.45, g = new THREE.PlaneGeometry(w, h, 28, 10), p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i) + h / 2, t = y / h, tie = Math.exp(-((y - 0.45) ** 2) / 0.04);
      const pinch = 1 - 0.55 * tie;                                    // franzido na braçadeira (a 0,45 m da barra)
      p.setXYZ(i, x * pinch, y, 0.045 * Math.sin(x * 26) * (0.7 + 0.3 * (1 - t)) + 0.05 + 0.04 * tie);
    }
    g.computeVertexNormals(); return g;
  });
  for (const [x, s] of [[1.62, -1], [3.38, 1]] as [number, number][]) {
    c.batch.add(ROOM, vel, drape, N(x, 0.95, 0.02, 0, 1, 1, 1), { cast: true });
    c.batch.add(ROOM, goldC(), geo("cofre-bracadeira", () => new THREE.TorusGeometry(0.1, 0.012, 6, 20).rotateX(Math.PI / 2).scale(1, 1, 0.5)), N(x + s * 0.02, 1.4, 0.1));
    c.inst.add(ROOM, "cofre-borla", geo("cofre-borlaGeo", () => new THREE.ConeGeometry(0.03, 0.12, 10).translate(0, -0.06, 0)), goldC(), N(x + s * 0.12, 1.35, 0.12));
  }
  bx(c.batch, ROOM, lacquerPlum(), N(2.5, 3.38, 0.0, 0, 2.6, 0.32, 0.2), true);
  bx(c.batch, ROOM, goldC(), N(2.5, 3.38, 0.2, 0, 2.6, 0.03, 0.008)); bx(c.batch, ROOM, goldC(), N(2.5, 3.66, 0.2, 0, 2.6, 0.03, 0.008));
}
/**
 * Luar pela janela da cornija (luz pintada, que continua quando cortam o quadro de luz): o vidro clareia atrás das
 * grades e as quatro vidraças de cima se desenham no piso com a sombra das grades (a 45°, as de baixo batem na
 * vitrine baixa sob a janela). Marca no escuro a rota de fuga.
 */
function moonlight(c: RoomsCtx) {
  const glow = lit("cofre-luarVidro", "#9db4ff", 0.24, { additive: true, map: paint("cofre-luarVidroTex", 64, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(1, "rgba(255,255,255,0.45)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, { srgb: false }) });
  c.batch.add(ROOM, glow, PLANE(), wf(WALLS.N)(2.5, 1.75, -0.2, 0, 1.0, 1.7, 1));
  const pool = lit("cofre-luarPiso", "#a9bdff", 0.2, { additive: true, map: paint("cofre-luarPisoTex", 160, 128, (g, w, h) => {
    g.filter = "blur(4px)"; g.fillStyle = "#fff";
    const mx = 16, mz = 14, bar = 4, pw = (w - 2 * mx - 3 * bar) / 4;
    for (let i = 0; i < 4; i++) g.fillRect(mx + i * (pw + bar), mz, pw, h - 2 * mz);
  }, { srgb: false }) });
  c.batch.add(ROOM, pool, planeUp(), mat(-19.5, 0.006, -19.83, 0, 1.15, 1, 0.95));
}

/* ---------- teto: caixotões de laca, tambor e cúpula dourada sobre o pedestal ---------- */
function ceiling(c: RoomsCtx) {
  const lac = lacquerPlum(), gold = c.P.gold, XB = [-19.6, -14.9], ZB = [-19.6, -8.9];
  for (const x of XB) { bx(c.batch, ROOM, lac, mat(x, H - 0.26, -14.25, 0, 0.3, 0.26, 15.5), true); for (const s of [-1, 1]) c.batch.add(ROOM, gold, CYL(8), mat(x + s * 0.14, H - 0.255, -14.25, 0, 0.008, 15.5, 0.008, Math.PI / 2)); }
  for (const z of ZB) { bx(c.batch, ROOM, lac, mat(-17.25, H - 0.26, z, 0, 9.5, 0.26, 0.3), true); for (const s of [-1, 1]) c.batch.add(ROOM, gold, CYL(8), mat(-17.25, H - 0.255, z + s * 0.14, 0, 0.008, 9.5, 0.008, 0, Math.PI / 2)); }
  // tambor (laca por fora, aro dourado) e a cúpula com folha de ouro, vista por dentro
  // o tambor é visto por fora (da sala) e por dentro (de baixo da cúpula): laca de duas faces
  const lac2 = once("cofre-lacaDupla", () => new THREE.MeshPhysicalMaterial({ color: "#1c0d17", roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 1.2, side: THREE.DoubleSide }));
  c.batch.add(ROOM, lac2, geo("cofre-tambor", () => new THREE.CylinderGeometry(2.08, 2.08, 0.5, 72, 1, true).translate(0, 0.25, 0)), mat(PX, H - 0.5, PZ));
  c.batch.add(ROOM, gold, geo("cofre-tamborAro", () => new THREE.TorusGeometry(2.08, 0.04, 8, 96).rotateX(Math.PI / 2)), mat(PX, H - 0.5, PZ));
  c.batch.add(ROOM, gold, geo("cofre-tamborAro2", () => new THREE.TorusGeometry(2.08, 0.018, 6, 96).rotateX(Math.PI / 2)), mat(PX, H - 0.36, PZ));
  const R = (2.0 ** 2 + 0.4 ** 2) / 0.8, th = Math.asin(2.0 / R);
  c.batch.add(ROOM, plain("cofre-folhaOuro", "#b8914a", { metal: 1, rough: 0.34, side: THREE.BackSide }), geo("cofre-cupula", () => new THREE.SphereGeometry(R, 72, 10, 0, Math.PI * 2, 0, th).translate(0, -R, 0)), mat(PX, H - 0.04, PZ));
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; bx(c.batch, ROOM, gold, mat(PX + Math.cos(a) * 1.25, 4.93, PZ + Math.sin(a) * 1.25, -a, 1.5, 0.02, 0.025, 0, -0.245)); }
  c.batch.add(ROOM, gold, lathe("cofre-rosetaCupula", [[0, -0.12], [0.06, -0.1], [0.12, -0.05], [0.16, 0], [0, 0]], 24), mat(PX, H - 0.06, PZ));
  // anel de spots dentro da cúpula: os quatro dos feixes duros no pedestal e quatro de apoio
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8, x = PX + Math.cos(a) * 1.55, z = PZ + Math.sin(a) * 1.55, y = H - 0.42;
    c.batch.add(ROOM, plain("cofre-pretoFosco", "#141416", { rough: 0.5 }), CYL0(16), mat(x, y, z, 0, 0.075, 0.14, 0.075));
    c.batch.add(ROOM, lit("cofre-lenteSpot", "#f4f8ff", 3), geo("cofre-lenteGeo", () => new THREE.CircleGeometry(0.05, 18).rotateX(Math.PI / 2)), mat(x, y - 0.002, z));
    if (k % 2 === 0) lightCone(c, ROOM, new THREE.Vector3(x, y - 0.02, z), new THREE.Vector3(PX, 1.15, PZ), 0.3, "#eef4ff", 0.065);
  }
  // spots embutidos nos caixotões da borda, mirando as vitrines e os nichos
  for (const [x, z] of [[-20.8, -20.8], [-17.25, -20.8], [-13.7, -20.8], [-20.8, -14.25], [-13.7, -11.5], [-20.8, -7.7], [-17.25, -7.7], [-13.7, -7.7], [-20.8, -11.0], [-20.8, -17.5]] as [number, number][]) {
    c.batch.add(ROOM, plain("cofre-pretoFosco", "#141416", { rough: 0.5 }), geo("cofre-latinha", () => new THREE.CylinderGeometry(0.07, 0.07, 0.03, 18, 1, true)), mat(x, H - 0.015, z));
    c.batch.add(ROOM, lit("cofre-lenteSpot", "#f4f8ff", 3), geo("cofre-lenteEmbutida", () => new THREE.CircleGeometry(0.045, 18).rotateX(Math.PI / 2)), mat(x, H - 0.02, z));
  }
  // detector de fumaça e grelha de retorno do ar condicionado (sala climatizada)
  c.batch.add(ROOM, plain("galeria-plastico", "#e8e6e0", { rough: 0.5 }), CYL0(20), mat(-17.25, H - 0.04, -10.6, 0, 0.065, 0.04, 0.065));
  for (let k = 0; k < 6; k++) bx(c.batch, ROOM, plain("cofre-grelha", "#2a2224", { metal: 0.5, rough: 0.5 }), mat(-17.25, H - 0.02, -18.4 + k * 0.08, 0, 0.9, 0.02, 0.03));
}

/* ---------- postes emissores dos lasers (os feixes são da simulação: fx.tsx) ---------- */
function laserPosts(c: RoomsCtx) {
  const K = plain("cofre-acoNegro", "#151618", { metal: 0.6, rough: 0.4 }), red = lit("cofre-lenteLaser", "#ff2a2a", 2.6), green = lit("cofre-ledPoste", "#2bff6a", 2.2);
  const posts = new Map<string, { x: number; z: number; aims: { dx: number; dz: number; h: number[] }[] }>();
  for (const L of LASERS) for (const [p, o] of [[L.a, L.b], [L.b, L.a]] as const) {
    const key = `${p.x},${p.z}`; let e = posts.get(key); if (!e) { e = { x: p.x, z: p.z, aims: [] }; posts.set(key, e); }
    e.aims.push({ dx: o.x - p.x, dz: o.z - p.z, h: L.height === "high" ? [1.1] : [0.35, 0.9, 1.45] });
  }
  for (const p of posts.values()) {
    c.batch.add(ROOM, brassC(), lathe("cofre-basePoste", [[0, 0], [0.11, 0], [0.11, 0.015], [0.06, 0.035], [0.05, 0.05], [0, 0.05]], 24), mat(p.x, 0, p.z));
    c.batch.add(ROOM, K, CYL0(14), mat(p.x, 0.05, p.z, 0, 0.042, 1.57, 0.042));
    c.batch.add(ROOM, brassC(), lathe("cofre-topoPoste", [[0, 0], [0.05, 0], [0.055, 0.02], [0.03, 0.05], [0.012, 0.08], [0, 0.085]], 16), mat(p.x, 1.62, p.z));
    c.inst.add(ROOM, "cofre-ledPoste", SPH(6), green, mat(p.x, 1.66, p.z + 0.03, 0, 0.007));
    for (const a of p.aims) {
      const ry = Math.atan2(a.dx, a.dz);
      for (const h of a.h) {
        const F = frame(p.x, p.z, ry);
        bx(c.batch, ROOM, K, F(0, h - 0.025, 0.04, 0, 0.05, 0.05, 0.06));
        c.inst.add(ROOM, "cofre-lenteLaser", geo("cofre-lenteLaserGeo", () => new THREE.CircleGeometry(0.014, 12)), red, F(0, h, 0.071));
      }
    }
  }
}

/* ---------- câmeras de segurança ---------- */
function cameras(c: RoomsCtx) {
  const shell = plain("galeria-plastico", "#e8e6e0", { rough: 0.5 }), K = plain("cofre-pretoFosco", "#141416", { rough: 0.5 });
  for (const [x, z] of [[-21.82, -21.82], [-12.68, -21.82], [-12.68, -6.68], [-21.82, -6.68]] as [number, number][]) {
    const ry = Math.atan2(PX - x, PZ - z), F = frame(x, z, ry);
    bx(c.batch, ROOM, shell, F(0, 4.18, 0.02, 0, 0.12, 0.16, 0.04));                       // placa de parede
    bx(c.batch, ROOM, shell, F(0, 4.24, 0.15, 0, 0.04, 0.04, 0.22));                       // braço
    bx(c.batch, ROOM, shell, F(0, 4.12, 0.32, 0, 0.13, 0.12, 0.3, 0.22));                  // corpo (inclinado para baixo)
    bx(c.batch, ROOM, shell, F(0, 4.25, 0.34, 0, 0.17, 0.012, 0.36, 0.22));                // para-sol
    c.batch.add(ROOM, K, CYL(16), F(0, 4.11, 0.48, 0, 0.04, 0.03, 0.04, Math.PI / 2 + 0.22));
    c.inst.add(ROOM, "cofre-ledCamera", SPH(6), lit("cofre-ledVermelho", "#ff2a2a", 2.4), F(0.05, 4.2, 0.47, 0, 0.006));
  }
  // câmera de domo no caixotão sobre o duto (vigia a saída do labirinto)
  c.batch.add(ROOM, shell, CYL0(20), mat(-17.5, H - 0.08, -7.8, 0, 0.09, 0.08, 0.09));
  c.batch.add(ROOM, plain("galeria-domo", "#14161a", { rough: 0.05, env: 1.6, transparent: true, opacity: 0.88 }), geo("galeria-domoGeo", () => new THREE.SphereGeometry(0.075, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat(-17.5, H - 0.08, -7.8));
}

/* ---------- placa da coleção, saída, conservação (placa, quadro de cortiça, prateleira, registrador de clima) ---------- */
function signsAndConservationWall(c: RoomsCtx) {
  const q = c.q, N = wf(WALLS.N), S = wf(WALLS.S), E = wf(WALLS.E), T = tagMat(c);
  c.batch.add(ROOM, signMat(c.copy.jewelPlaque, "brass"), PLANE(), N(4.75, 3.15, 0.012, 0, 2.0, 0.42, 1));
  // saída sobre a porta blindada e a luminária de emergência de dois faróis (acende sem energia)
  bx(c.batch, ROOM, plain("galeria-caixaSaida", "#e9e9e4", { rough: 0.5 }), E(7.0, 3.1, 0.0, 0, 0.46, 0.18, 0.05));
  c.batch.add(ROOM, signMat(c.copy.exit, "exit", "", 0.9), PLANE(), E(7.0, 3.19, 0.052, 0, 0.42, 0.13, 1));
  bx(c.batch, ROOM, plain("galeria-caixaSaida", "#e9e9e4", { rough: 0.5 }), E(7.0, 3.5, 0.0, 0, 0.36, 0.1, 0.1));
  for (const s of [-1, 1]) {
    c.batch.add(ROOM, plain("galeria-caixaSaida", "#e9e9e4", { rough: 0.5 }), SPH(12), E(7.0 + s * 0.15, 3.55, 0.12, 0, 0.05, 0.05, 0.05));
    c.batch.add(ROOM, emergency(), geo("cofre-farol", () => new THREE.CircleGeometry(0.035, 16)), E(7.0 + s * 0.15, 3.55, 0.171, s * 0.4, 1, 1, 1, 0.5));
  }
  // conservação: placa azul, quadro de cortiça com laudos, registrador de temperatura e umidade, prateleira de caixas
  c.batch.add(ROOM, T, tagGeo(11), S(1.8, 2.35, 0.012, 0, 1.0, 0.25, 1));
  bx(c.batch, ROOM, plain("cofre-cortica", "#9c7a52", { rough: 0.95 }), S(1.8, 1.25, 0.0, 0, 1.0, 0.7, 0.02));
  bx(c.batch, ROOM, c.P.walnut, S(1.8, 1.23, 0.0, 0, 1.04, 0.03, 0.03)); bx(c.batch, ROOM, c.P.walnut, S(1.8, 1.94, 0.0, 0, 1.04, 0.03, 0.03));
  const rep = once(`cofre-laudoParede-${langOf(c.copy)}`, () => new THREE.MeshStandardMaterial({ map: reportTex(langOf(c.copy)), roughness: 0.9, emissiveMap: reportTex(langOf(c.copy)), emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.08 }));
  for (const [x, y, r] of [[1.5, 1.6, 0.05], [2.05, 1.58, -0.04]] as [number, number, number][]) { c.batch.add(ROOM, rep, PLANE(), S(x, y, 0.022, 0, 0.21, 0.29, 1, 0, r)); c.inst.add(ROOM, "cofre-percevejo", SPH(6), plain("cofre-vermelhoAlfinete", "#b3121e", { rough: 0.3 }), S(x, y + 0.13, 0.026, 0, 0.008)); }
  bx(c.batch, ROOM, plain("galeria-plastico", "#e8e6e0", { rough: 0.5 }), S(5.0, 1.55, 0, 0, 0.1, 0.13, 0.03));
  c.batch.add(ROOM, lit("galeria-lcd", "#9fd9b8", 0.9), PLANE(), S(5.0, 1.635, 0.031, 0, 0.07, 0.035, 1));
  bx(c.batch, ROOM, c.P.walnut, S(8.42, 1.75, 0.0, 0, 1.34, 0.03, 0.32));
  for (const e of [-1, 1]) bx(c.batch, ROOM, brassC(), S(8.42 + e * 0.55, 1.6, 0.0, 0, 0.03, 0.15, 0.28));
  for (let k = 0; k < 4; k++) { bx(c.batch, ROOM, plain("cofre-caixaAcida", "#cfc8b8", { rough: 0.85 }), S(7.95 + k * 0.315, 1.78, 0.02, 0, 0.29, 0.26, 0.28)); c.batch.add(ROOM, T, tagGeo(10), S(7.95 + k * 0.315, 1.9, 0.161, 0, 0.15, 0.0375, 1)); }
  void q;
}
/** Luz de emergência (apagada com energia; acesa quando o quadro de luz é cortado). */
const emergency = () => lit("cofre-emergencia", "#fff6e0", 0);

/* ---------- luz ---------- */
function lights(c: RoomsCtx) {
  A(c, ROOM, PX, H - 0.6, PZ, "#f0f5ff", 30, 9);
  for (const [x, z] of [[-20.8, -20.8], [-13.7, -20.8], [-20.8, -7.7], [-13.7, -7.7]] as [number, number][]) A(c, ROOM, x, H - 0.45, z, "#dbe6ff", 8, 7);
  A(c, ROOM, -21.5, 2.0, PZ, "#ffcf9e", 2.4, 3); A(c, ROOM, -17.25, 1.8, -21.55, "#ffcf9e", 1.4, 2.2);
  A(c, ROOM, -12.8, 3.2, -15, "#3dff8a", 0.6, 2);
  beacon(c, ROOM, -21.9, 4.42, PZ, 1, 0); beacon(c, ROOM, -12.6, 4.42, -10.5, -1, 0);
}
/**
 * Sem energia (quadro de luz cortado): as lentes dos spots, a luz das vitrines e dos nichos e o LED da lupa caem para
 * quase nada (as âncoras da sala já escurecem em interior.tsx) e acendem os faróis de emergência sobre a porta.
 */
function power(c: RoomsCtx) {
  const dim = [lit("cofre-lenteSpot", "#f4f8ff", 3), caseLight(), lit("cofre-luzNicho", "#ffcfa0", 0.55), lit("cofre-ledLupa", "#f2f8ff", 2.6), lit("cofre-painelLed", "#f4f8ff", 1.8), lit("cofre-telaNotebook", "#bcd2ff", 1.0), scallopMat()];
  const base = dim.map((m) => m.color.clone()), em = emergency();
  let last: boolean | null = null;
  c.ticks.push({ room: ROOM, tick: (t, _dt, v) => {
    const on = v.lasersPowered;
    if (on !== last) { last = on; dim.forEach((m, i) => m.color.copy(base[i]).multiplyScalar(on ? 1 : 0.05)); }
    em.color.setRGB(1, 0.95, 0.85).multiplyScalar(on ? 0.22 : 2.4 + 0.15 * Math.sin(t * 3));       // apagada: lente fosca
  } });
}

/** Luz com sombra (só "high"): o foco duro do pedestal, da cúpula para baixo. */
const KEYS: KeyDef[] = [{ p: [PX, H - 0.45, PZ], aim: [PX, 0, PZ], angle: 0.62, i: 95, color: "#f2f6ff" }];

let floorQ: Quality = "low";
/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = {
  id: "cofre", rooms: ["cofre"], dress: cofre,
  props: { pedestal, case: jewelCase, fixture },
  surfaces: {
    cofre: {
      floor: (q) => { floorQ = q; return floorNero(q); }, floorTile: [NERO_TILE, NERO_TILE],
      // lido pela casca logo depois de floor(q): no "low" sem espelho, para o mármore manter o reflexo do ambiente
      get floorMirror(): [number, number] | undefined { return floorQ === "high" ? [1.0, 0.06] : undefined; },
      wall: (q) => damaskMat(q), wallTile: [DAMASK_TILE, DAMASK_TILE], ceil: () => lacquerPlum(), trims: false,
    },
  },
  keys: { cofre: KEYS },
};
