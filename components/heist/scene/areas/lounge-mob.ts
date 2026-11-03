/*
 * MET Gala Heist v2 — móveis do lounge (Z05), cada um desenhado na forma de colisão da planta (lib/heist/level.ts):
 *  · bar de Davi: balcão curvo (cabeceiras em quarto de círculo) com frente de ônix retroiluminado entre pilastras de
 *    latão, tampo de mármore negro com descanso de couro, trilho de pés, estação do barman (cuba de gelo, pia, trilho de
 *    garrafas) e o que está sobre ele (coqueteleiras, copo de mistura, balde de champanhe, taças com bebida, cardápios);
 *  · banquetas de bar giratórias, sofás modulares capitonê de veludo, poltronas club de couro com tachas, mesas baixas
 *    de mármore e latão com livros de arte, guéridons com abajur plissado, piano de cauda com banqueta e partitura,
 *    trumeau (espelho envelhecido sobre console) e biombo de laca com garças em folha de ouro.
 * Materiais e o que se repete (botões, tachas, garrafas, taças, teclas) vão para os lotes e instâncias da sala.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import type { PropsCtx } from "../interior-props";
import { BOX0, CYL, CYL0, SPH, geo, mat, mul } from "../interior-batch";
import { areaMat, at, footOf, lamp, lathe, rbox, tube, tufted, world } from "./lounge-kit";
import { scoreTexture, screenTexture } from "./lounge-tex";
import { ROOM, loungeMats } from "./lounge-mats";
import { box, put, flameGeo } from "./lounge-copos";
export { loungeMats } from "./lounge-mats";
export type { LoungeMats } from "./lounge-mats";
export { bottleAt, glassAt } from "./lounge-copos";
export { onyxBar, barStool } from "./lounge-bar-onix";
export { loungeSofa, armchair, coffeeTable, shadeMat, gueridon } from "./lounge-sala";

/* ======================= piano de cauda ======================= */
/** Contorno do piano em planta (unidade: largura 1, comprimento 1; frente/teclado em z = +0,5; lado reto dos graves em
 *  x = +0,5 — à esquerda de quem toca, que olha para −z local). */
function pianoShape(mirror = false): THREE.Shape {
  const s = new THREE.Shape(), k = mirror ? -1 : 1;
  s.moveTo(0.5, 0.5 * k); s.lineTo(-0.5, 0.5 * k); s.lineTo(-0.5, 0.18 * k);
  s.bezierCurveTo(-0.5, -0.02 * k, -0.18, -0.02 * k, -0.12, -0.2 * k); s.bezierCurveTo(-0.06, -0.38 * k, 0.02, -0.5 * k, 0.26, -0.5 * k); s.bezierCurveTo(0.42, -0.5 * k, 0.5, -0.42 * k, 0.5, -0.3 * k); s.lineTo(0.5, 0.5 * k);
  return s;
}
const PLANE_ = () => geo("plane", () => new THREE.PlaneGeometry(1, 1));
export function grandPiano(p: Prop, c: PropsCtx) {
  const f = footOf(p), L = loungeMats(c.q, c.P), w = f.w, d = f.d - 0.22, zb = -0.11;   // corpo um pouco atrás: o teclado sobra na frente
  const rim = geo("lounge-pianoRim", () => new THREE.ExtrudeGeometry(pianoShape(), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 24 }).rotateX(Math.PI / 2).translate(0, 0.312, 0));
  put(c, L.lacquer, rim, at(f, 0, 0.62, zb, 0, w, 1, d), true);
  // tampo aberto (dobradiça no lado reto, x = +0,5) a ~35°, a vareta e a chapa dourada com as cordas por dentro
  const lid = geo("lounge-pianoLid", () => new THREE.ExtrudeGeometry(pianoShape(), { depth: 0.018, bevelEnabled: false, curveSegments: 24 }).rotateX(Math.PI / 2).translate(-0.5, 0.018, 0));
  put(c, L.lacquer, lid, mul(at(f, w / 2, 0.945, zb), mat(0, 0, 0, 0, w, 1, d, 0, -0.6)), true);
  c.batch.add(ROOM, L.black, CYL(6), at(f, -w * 0.3, 0.945, zb - d * 0.08, 0, 0.009, 1.02, 0.009, 0, -0.5));
  const plate = areaMat("lounge-pianoPlate", () => new THREE.MeshStandardMaterial({ color: "#b48a3c", metalness: 0.85, roughness: 0.35 }));
  c.batch.add(ROOM, plate, geo("lounge-pianoPlateGeo", () => new THREE.ShapeGeometry(pianoShape(true), 24).rotateX(-Math.PI / 2)), at(f, 0, 0.9, zb, 0, w * 0.94, 1, d * 0.92));
  for (let k = 0; k < 28; k++) c.inst.add(ROOM, "lounge-string", BOX0(), L.steel, at(f, -w * 0.4 + k * w * 0.03, 0.905, zb + d * 0.05, 0, 0.003, 0.003, d * (0.85 - (k / 28) * 0.45)));
  // teclado: caixa, teclas brancas (faixa) e pretas (instâncias), bochechas e a tampa do teclado levantada
  const kw = w * 0.86, kz = zb + d / 2 + 0.11;
  box(c, L.lacquer, f, 0, 0.62, kz, w, 0.12, 0.24, 0, true);
  box(c, L.ivory, f, 0, 0.74, kz + 0.02, kw, 0.022, 0.15);
  for (let k = 0; k < 52; k++) c.inst.add(ROOM, "lounge-keyGap", BOX0(), L.black, at(f, -kw / 2 + (k + 1) * kw / 52, 0.741, kz + 0.02, 0, 0.0015, 0.022, 0.15));
  for (let k = 0; k < 52; k++) { const m = k % 7; if (m === 2 || m === 6) continue; c.inst.add(ROOM, "lounge-keyBlack", BOX0(), L.ebony, at(f, -kw / 2 + (k + 1) * kw / 52, 0.762, kz - 0.02, 0, 0.012, 0.018, 0.09)); }
  for (const s of [-1, 1]) box(c, L.lacquer, f, s * (kw / 2 + (w - kw) / 4), 0.74, kz + 0.02, (w - kw) / 2, 0.06, 0.17);
  box(c, L.lacquer, f, 0, 0.77, kz - 0.09, kw, 0.012, 0.09, 0);
  // estante inclinada com a partitura e as pernas torneadas com rodízios
  const score = areaMat("lounge-scoreMat", () => new THREE.MeshStandardMaterial({ map: scoreTexture(), roughness: 0.9, side: THREE.DoubleSide }));
  const desk = at(f, 0, 0.78, kz - 0.17, 0, 1, 1, 1, -0.22);
  c.batch.add(ROOM, L.lacquer, BOX0(), mul(desk, mat(0, 0, 0, 0, w * 0.5, 0.27, 0.012)));
  c.batch.add(ROOM, L.lacquer, BOX0(), mul(desk, mat(0, 0, 0.03, 0, w * 0.5, 0.012, 0.05)));
  c.batch.add(ROOM, score, PLANE_(), mul(desk, mat(0, 0.15, 0.008, 0, w * 0.42, 0.21, 1)));
  for (const [x, z] of [[-w / 2 + 0.1, kz - 0.06], [w / 2 - 0.1, kz - 0.06], [w * 0.18, zb - d * 0.4]] as [number, number][]) {
    c.batch.add(ROOM, L.lacquer, lathe("lounge-pianoLeg", [[0.045, 0], [0.055, 0.04], [0.042, 0.12], [0.05, 0.3], [0.06, 0.48], [0.07, 0.56], [0.075, 0.62], [0, 0.62]], 16), at(f, x, 0, z), { cast: true });
    c.batch.add(ROOM, L.brass, CYL0(12), at(f, x, 0, z, 0, 0.045, 0.04, 0.045));
  }
  // lira com os três pedais
  for (const s of [-1, 1]) c.batch.add(ROOM, L.lacquer, tube(`lounge-lyre${s}`, [[s * 0.08, 0.62, 0], [s * 0.11, 0.4, 0], [s * 0.06, 0.12, 0], [s * 0.05, 0.03, 0]], 0.014, 12, 6), at(f, 0, 0, kz - 0.18));
  box(c, L.lacquer, f, 0, 0.02, kz - 0.18, 0.24, 0.04, 0.08);
  for (const x of [-0.06, 0, 0.06]) box(c, L.brass, f, x, 0.045, kz - 0.12, 0.022, 0.012, 0.09);
  // banqueta de couro capitonê (o pianista senta nela)
  const bz = kz + 0.36;
  c.batch.add(ROOM, L.lacquer, rbox(0.72, 0.06, 0.34, 0.01), at(f, 0, 0.42, bz));
  const bt = tufted(0.66, 0.3, 0.13, 0.02);
  c.batch.add(ROOM, L.leatherOx, rbox(0.72, 0.05, 0.36, 0.025), at(f, 0, 0.47, bz));
  c.batch.add(ROOM, L.leatherOx, bt.g, at(f, 0, 0.52, bz, 0, 1, 1, 1, -Math.PI / 2));
  for (const [x, y] of bt.buttons) c.inst.add(ROOM, "lounge-button", SPH(6), L.leatherOx, at(f, x, 0.522, bz - y, 0, 0.01, 0.006, 0.01));
  for (const x of [-0.31, 0.31]) for (const z of [-0.13, 0.13]) c.batch.add(ROOM, L.lacquer, lathe("lounge-benchLeg", [[0.022, 0], [0.026, 0.05], [0.02, 0.2], [0.03, 0.4], [0, 0.42]], 10), at(f, x, 0, bz + z));
}

/* ======================= trumeau: espelho envelhecido sobre console ======================= */
export function trumeau(p: Prop, c: PropsCtx) {
  const f = footOf(p), L = loungeMats(c.q, c.P), w = f.w, d = f.d;
  // console de nogueira com tampo de mármore e pernas cabriolé (curva em S)
  c.batch.add(ROOM, L.marble, rbox(w - 0.1, 0.03, d - 0.02, 0.008, 2), at(f, 0, 0.82, 0), { cast: true });
  box(c, L.walnut, f, 0, 0.7, -0.01, w - 0.2, 0.12, d - 0.08, 0, true);
  box(c, L.gold, f, 0, 0.72, d / 2 - 0.045, w - 0.3, 0.02, 0.006);
  for (const s of [-1, 1]) c.batch.add(ROOM, L.walnut, tube(`lounge-cabriole${s}`, [[s * (w / 2 - 0.12), 0.7, d / 2 - 0.06], [s * (w / 2 - 0.08), 0.5, d / 2 - 0.02], [s * (w / 2 - 0.14), 0.22, d / 2 - 0.08], [s * (w / 2 - 0.1), 0.02, d / 2 - 0.04]], 0.028, 16, 8), at(f, 0, 0, 0), { cast: true });
  for (const s of [-1, 1]) box(c, L.walnut, f, s * (w / 2 - 0.12), 0, -d / 2 + 0.08, 0.05, 0.7, 0.05);
  // espelho alto em moldura dourada com friso de pérolas e o frontão em voluta
  const mw = w - 0.16, mh = 1.9, my = 0.95;
  c.batch.add(ROOM, L.gold, geo(`lounge-trumFrame-${mw.toFixed(2)}`, () => { const s = new THREE.Shape(); s.moveTo(-mw / 2, 0); s.lineTo(mw / 2, 0); s.lineTo(mw / 2, mh); s.lineTo(-mw / 2, mh); s.closePath(); const h = new THREE.Path(); h.moveTo(-mw / 2 + 0.09, 0.09); h.lineTo(-mw / 2 + 0.09, mh - 0.09); h.lineTo(mw / 2 - 0.09, mh - 0.09); h.lineTo(mw / 2 - 0.09, 0.09); h.closePath(); s.holes.push(h); return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 1 }); }), at(f, 0, my, -d / 2 + 0.03), { cast: true });
  c.batch.add(ROOM, L.mirror, PLANE_(), at(f, 0, my + mh / 2, -d / 2 + 0.035, 0, mw - 0.16, mh - 0.16, 1));
  for (let k = 0; k < 2 * Math.round((mw + mh) / 0.035); k++) {
    const per = 2 * (mw - 0.2 + mh - 0.2), s = (k / (2 * Math.round((mw + mh) / 0.035))) * per;
    let x = 0, y = 0;
    if (s < mw - 0.2) { x = -mw / 2 + 0.1 + s; y = 0.1; } else if (s < mw - 0.2 + mh - 0.2) { x = mw / 2 - 0.1; y = 0.1 + s - (mw - 0.2); } else if (s < 2 * (mw - 0.2) + mh - 0.2) { x = mw / 2 - 0.1 - (s - (mw - 0.2 + mh - 0.2)); y = mh - 0.1; } else { x = -mw / 2 + 0.1; y = mh - 0.1 - (s - (2 * (mw - 0.2) + mh - 0.2)); }
    c.inst.add(ROOM, "lounge-pearl", SPH(6), L.gold, at(f, x, my + y, -d / 2 + 0.07, 0, 0.009));
  }
  c.batch.add(ROOM, L.gold, geo("lounge-crest", () => { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.bezierCurveTo(-0.45, 0.18, -0.2, 0.12, -0.12, 0.26); s.bezierCurveTo(-0.06, 0.36, 0.06, 0.36, 0.12, 0.26); s.bezierCurveTo(0.2, 0.12, 0.45, 0.18, 0.5, 0); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 12 }); }), at(f, 0, my + mh - 0.02, -d / 2 + 0.03, 0, mw * 0.8, 0.9, 1));
  c.inst.add(ROOM, "lounge-pearl", SPH(10), L.gold, at(f, 0, my + mh + 0.27, -d / 2 + 0.06, 0, 0.04));
  // castiçais de latão com velas, um vaso de cristal e uma bandeja com o decanter
  for (const s of [-1, 1]) {
    c.batch.add(ROOM, L.brass, lathe("lounge-candlestick", [[0, 0], [0.06, 0], [0.065, 0.012], [0.02, 0.04], [0.016, 0.2], [0.03, 0.22], [0.034, 0.24], [0, 0.24]], 16), at(f, s * (w / 2 - 0.2), 0.85, 0.02));
    c.inst.add(ROOM, "candle", CYL0(10), c.P.candle, at(f, s * (w / 2 - 0.2), 1.09, 0.02, 0, 0.012, 0.18, 0.012));
    c.inst.add(ROOM, "flame", flameGeo(), c.P.flame, at(f, s * (w / 2 - 0.2), 1.29, 0.02, 0, 0.012));
    c.flames.push(world(f, s * (w / 2 - 0.2), 1.29, 0.02));
  }
  c.batch.add(ROOM, L.glassClear, lathe("lounge-vase", [[0, 0], [0.05, 0], [0.07, 0.08], [0.05, 0.2], [0.06, 0.26], [0, 0.26]], 18), at(f, 0.05, 0.85, 0.0));
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; c.inst.add(ROOM, "lounge-roseBud", SPH(8), L.rose, at(f, 0.05 + Math.cos(a) * 0.06, 1.17 + (k % 2) * 0.04, Math.sin(a) * 0.06, 0, 0.035, 0.03, 0.035)); c.batch.add(ROOM, L.leaf, CYL(5), at(f, 0.05 + Math.cos(a) * 0.03, 1.0, Math.sin(a) * 0.03, 0, 0.003, 0.3, 0.003, Math.sin(a) * 0.2, Math.cos(a) * 0.2)); }
  lamp(c.anchors, ROOM, world(f, 0, 1.4, 0.25), "#ffb466", 2.2, 3, { flicker: 1 });
}

/* ======================= biombo de laca ======================= */
export function lacquerScreen(p: Prop, c: PropsCtx) {
  const f = footOf(p), L = loungeMats(c.q, c.P), n = 3, pw = f.w / n / Math.cos(0.42) * 0.98, h = 1.72;
  const art = areaMat("lounge-screenArt", () => new THREE.MeshStandardMaterial({ map: screenTexture(), roughness: 0.22, metalness: 0.1, envMapIntensity: 1.1 }));
  for (let k = 0; k < n; k++) {
    const ry = (k % 2 ? -1 : 1) * 0.42, x = -f.w / 2 + (k + 0.5) * f.w / n;
    const P0 = at(f, x, 0.06, 0, ry);
    c.batch.add(ROOM, L.lacquer, BOX0(), mul(P0, mat(0, 0, 0, 0, pw, h, 0.03)), { cast: true });
    c.batch.add(ROOM, art, geo(`lounge-screenLeaf${k}`, () => { const g = new THREE.PlaneGeometry(1, 1); const uv = g.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / 3); return g; }), mul(P0, mat(0, h / 2, 0.016, 0, pw - 0.06, h - 0.08, 1)));
    for (const y of [0.25, h - 0.25]) c.batch.add(ROOM, L.brass, CYL(8), mul(P0, mat(pw / 2, y, 0, 0, 0.012, 0.08, 0.012)));
    for (const s of [-1, 1]) c.batch.add(ROOM, L.lacquer, BOX0(), mul(P0, mat(s * (pw / 2 - 0.04), -0.06, 0, 0, 0.05, 0.06, 0.05)));
    c.batch.add(ROOM, L.gold, BOX0(), mul(P0, mat(0, h, 0, 0, pw, 0.02, 0.034)));
  }
}
