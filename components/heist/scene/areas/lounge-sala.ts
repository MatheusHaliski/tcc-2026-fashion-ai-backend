/*
 * MET Gala Heist v2 — lounge (Z05): os grupos de estar — sofás capitonê, poltronas club, mesas baixas e
 * guéridons com abajur. Saiu de lounge-mob.ts sem mudança.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import type { PropsCtx } from "../interior-props";
import { BOX0, CYL0, SPH, geo, mat, mul } from "../interior-batch";
import { fabric, glass, glow, solid } from "../interior-mats";
import { rand } from "../interior-tex";
import { areaMat, at, footOf, lamp, lathe, pleatedShade, rbox, tufted, world, type Foot } from "./lounge-kit";
import { BOOKS, bookAtlas } from "./lounge-tex";
import { ROOM, loungeMats, type LoungeMats } from "./lounge-mats";
import { box, flameGeo, glassAt } from "./lounge-copos";
import { along } from "./lounge-bar-onix";

/* ======================= sofá modular capitonê ======================= */
/** Pé bola torneado em nogueira com rodízio de latão. */
const bunFoot = () => lathe("lounge-bunFoot", [[0, 0], [0.03, 0], [0.032, 0.012], [0.05, 0.04], [0.052, 0.07], [0.04, 0.095], [0.045, 0.1], [0, 0.1]], 14);
/** Tachas de latão ao longo de um segmento (instâncias). */
function nails(c: PropsCtx, f: Foot, L: LoungeMats, a: [number, number, number], b: [number, number, number], step = 0.035) {
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / step));
  for (let k = 0; k <= n; k++) { const t = k / n; c.inst.add(ROOM, "lounge-nail", SPH(6), L.brass, at(f, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 0, 0.0065)); }
}
/** Estofado com encosto capitonê e braços rolados (sofá ou poltrona), no tecido `cover`. */
function upholstered(c: PropsCtx, f: Foot, L: LoungeMats, cover: THREE.Material, modules: number, seed: number) {
  const w = f.w, d = f.d, arm = Math.min(0.2, w * 0.18), seatY = 0.4, backT = 0.2, topY = 0.8;
  for (const x of [-w / 2 + 0.09, w / 2 - 0.09]) for (const z of [-d / 2 + 0.09, d / 2 - 0.1]) c.inst.add(ROOM, "lounge-bunFoot", bunFoot(), L.walnut, at(f, x, 0, z));
  if (modules > 2) for (const z of [-d / 2 + 0.09, d / 2 - 0.1]) c.inst.add(ROOM, "lounge-bunFoot", bunFoot(), L.walnut, at(f, 0, 0, z));
  // base (caixa estofada) e o encosto
  c.batch.add(ROOM, cover, rbox(w, 0.3, d, 0.05), at(f, 0, 0.1, 0), { cast: true });
  c.batch.add(ROOM, cover, rbox(w, topY - seatY + 0.02, backT, 0.06), at(f, 0, seatY - 0.02, -d / 2 + backT / 2), { cast: true });
  // braços rolados: corpo + rolo em cima (sobressai para fora) + leque pregueado na frente
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - arm / 2);
    c.batch.add(ROOM, cover, rbox(arm, topY - 0.4 - 0.06, d - 0.02, 0.05), at(f, x, 0.4, 0.005), { cast: true });
    c.batch.add(ROOM, cover, geo("lounge-armRoll", () => new THREE.CylinderGeometry(1, 1, 1, 20, 1).rotateX(Math.PI / 2)), at(f, x + s * 0.02, topY - 0.07, 0.005, 0, arm * 0.62, 0.085, d - 0.02));
    nails(c, f, L, [x - arm / 2 + 0.01, 0.13, d / 2 + 0.003], [x + arm / 2 - 0.01, 0.13, d / 2 + 0.003]);
    nails(c, f, L, [x + s * 0.02 - arm * 0.5, topY - 0.18, d / 2 + 0.006], [x + s * 0.02 + arm * 0.5, topY - 0.18, d / 2 + 0.006], 0.03);
  }
  nails(c, f, L, [-w / 2 + arm, 0.12, d / 2 + 0.003], [w / 2 - arm, 0.12, d / 2 + 0.003]);
  // painel capitonê na frente do encosto (relevo de verdade) e os botões
  const tw = w - 2 * arm - 0.04, th = topY - seatY - 0.15, tf = tufted(tw, th, 0.17, 0.035), panel = at(f, 0, seatY + 0.13 + th / 2, -d / 2 + backT + 0.002, 0, 1, 1, 1, -0.08);
  c.batch.add(ROOM, cover, tf.g, panel);
  for (const [x, y] of tf.buttons) c.inst.add(ROOM, "lounge-button", SPH(6), cover, mul(panel, mat(x, y, 0.004, 0, 0.012, 0.012, 0.008)));
  // almofadas do assento por módulo (com a costura de cada módulo) e almofadas soltas
  const sw = (w - 2 * arm) / modules;
  for (let k = 0; k < modules; k++) c.batch.add(ROOM, cover, rbox(sw - 0.015, 0.13, d - backT - 0.06, 0.05), at(f, -w / 2 + arm + sw * (k + 0.5), seatY, backT / 2 + 0.01), { cast: true });
  const R = rand(seed);
  if (modules >= 2) for (let k = 0; k < Math.min(3, modules + 1); k++) {
    const x = -w / 2 + arm + 0.28 + k * ((w - 2 * arm - 0.56) / Math.max(1, Math.min(3, modules + 1) - 1));
    c.batch.add(ROOM, k % 2 ? L.brocade : L.velvetTeal, rbox(0.42, 0.42, 0.13, 0.06, 4), at(f, x, seatY + 0.11, -d / 2 + backT + 0.1, (R() - 0.5) * 0.3, 1, 1, 1, -0.32, (R() - 0.5) * 0.2));
  }
}
export function loungeSofa(p: Prop, c: PropsCtx) {
  const f = footOf(p), L = loungeMats(c.q, c.P), mods = Math.max(2, Math.round(f.w / 0.95));
  upholstered(c, f, L, L.velvet, mods, p.id.length * 7 + 3);
  // manta de lã dobrada caindo sobre um braço (passa por cima do rolo e pende dos dois lados, com a barra ondulada)
  const s = p.id.charCodeAt(p.id.length - 1) % 2 ? 1 : -1, x = s * (f.w / 2 - 0.1);
  c.batch.add(ROOM, fabric("lounge-throw", "#c9b48a", c.q, { rough: 0.95, side: THREE.DoubleSide }), geo("lounge-throwGeo", () => {
    const r = 0.135, half = Math.PI * r / 2, g = new THREE.PlaneGeometry(0.5, 0.9, 12, 36), q = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < q.count; i++) {
      const along = q.getX(i), sv = q.getY(i), a = Math.abs(sv), wav = 0.012 * Math.sin(along * 26 + sv * 9);
      const lat = a < half ? Math.sin(sv / r) * r : Math.sign(sv) * (r + wav), up = a < half ? Math.cos(sv / r) * r : -(a - half);
      q.setXYZ(i, lat, up, along);
    }
    g.computeVertexNormals(); return g;
  }), at(f, x + s * 0.02, 0.73, 0.06));
}
export function armchair(p: Prop, c: PropsCtx) {
  const f = footOf(p), L = loungeMats(c.q, c.P);
  upholstered(c, f, L, L.leather, 1, p.id.length * 5 + 1);
}

/* ======================= mesa baixa ======================= */
export function coffeeTable(p: Prop, c: PropsCtx) {
  const f = footOf(p), L = loungeMats(c.q, c.P), w = f.w, d = f.d, h = 0.42;
  c.batch.add(ROOM, L.marble, rbox(w, 0.04, d, 0.012, 2), at(f, 0, h - 0.04, 0), { cast: true });
  for (const s of [-1, 1]) { box(c, L.brass, f, 0, h - 0.045, s * (d / 2 + 0.004), w + 0.012, 0.048, 0.008); box(c, L.brass, f, s * (w / 2 + 0.004), h - 0.045, 0, 0.008, 0.048, d + 0.012); }
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) box(c, L.brass, f, x, 0, z, 0.025, h - 0.045, 0.025, 0, true);
  for (const s of [-1, 1]) { box(c, L.brass, f, 0, 0.1, s * (d / 2 - 0.05), w - 0.1, 0.02, 0.02); box(c, L.brass, f, s * (w / 2 - 0.05), 0.1, 0, 0.02, 0.02, d - 0.1); }
  box(c, glass("lounge-smoke", { tint: "#2a2622", opacity: 0.5, rough: 0.08 }), f, 0, 0.12, 0, w - 0.1, 0.01, d - 0.1);
  // livros de arte: pilha na prateleira e um aberto em cima; velas em lanternas de vidro; decanter e copos
  const books = areaMat("lounge-bookMat", () => new THREE.MeshStandardMaterial({ map: bookAtlas(), roughness: 0.7 }));
  const R = rand(p.id.length * 31 + 7);
  for (let k = 0; k < 3; k++) {
    const bw = 0.3 - k * 0.03, bd = 0.24 - k * 0.02, y = 0.13 + k * 0.032, kk = (k + p.id.length) % BOOKS.length;
    box(c, L.paper, f, -w / 2 + 0.26, y, 0, bw - 0.01, 0.028, bd - 0.01, (R() - 0.5) * 0.3);
    c.batch.add(ROOM, books, geo(`lounge-bookTop${kk}`, () => { const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); const uv = g.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setX(i, (kk + uv.getX(i)) / 4); return g; }), at(f, -w / 2 + 0.26, y + 0.0285, 0, (R() - 0.5) * 0.3, bw, 1, bd));
  }
  const kk = p.id.length % BOOKS.length;
  c.batch.add(ROOM, books, geo(`lounge-bookTop${kk}`, () => { const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); const uv = g.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setX(i, (kk + uv.getX(i)) / 4); return g; }), at(f, w / 2 - 0.3, h + 0.026, -0.03, 0.4, 0.28, 1, 0.23));
  box(c, L.paper, f, w / 2 - 0.3, h, -0.03, 0.27, 0.025, 0.22, 0.4);
  for (const [x, z, s] of [[-0.08, 0.06, 1], [0.04, -0.08, 0.8], [0.14, 0.08, 1.2]] as [number, number, number][]) {
    c.batch.add(ROOM, L.glassClear, lathe("lounge-hurricane", [[0, 0], [0.05, 0], [0.055, 0.02], [0.06, 0.12], [0.05, 0.2], [0.052, 0.21], [0, 0.21]], 18), at(f, x, h, z, 0, 1, s, 1));
    c.inst.add(ROOM, "candle", CYL0(10), c.P.candle, at(f, x, h, z, 0, 0.032, 0.06 * s, 0.032));
    c.inst.add(ROOM, "flame", flameGeo(), c.P.flame, at(f, x, h + 0.06 * s + 0.018, z, 0, 0.011));
    c.flames.push(world(f, x, h + 0.06 * s + 0.018, z));
  }
  c.batch.add(ROOM, L.glassClear, lathe("lounge-decanter", [[0, 0], [0.06, 0], [0.075, 0.05], [0.07, 0.12], [0.03, 0.17], [0.02, 0.22], [0.026, 0.225], [0, 0.23]], 18), at(f, -w / 2 + 0.55, h, 0.12));
  c.inst.add(ROOM, "lounge-decanterFill", lathe("lounge-decanterFillGeo", [[0, 0.01], [0.058, 0.01], [0.07, 0.05], [0.066, 0.1], [0, 0.1]], 16), L.drinkAmber, at(f, -w / 2 + 0.55, h, 0.12));
  c.inst.add(ROOM, "lounge-stopper", SPH(10), L.bottle, at(f, -w / 2 + 0.55, h + 0.245, 0.12, 0, 0.03), new THREE.Color("#efe6d0"));
  for (const dx of [0.12, 0.2]) glassAt(c, ROOM, L, at(f, -w / 2 + 0.55 + dx, h, 0.08 - dx * 0.3), 2, L.drinkAmber);
  lamp(c.anchors, ROOM, world(f, 0.04, h + 0.25, 0), "#ffb15e", 1.6, 2.6, { flicker: 1 });
}

/* ======================= guéridon com abajur ======================= */
/** Seda da cúpula: translúcida (acende por dentro), dos dois lados. */
export const shadeMat = () => areaMat("lounge-shadeSilk", () => new THREE.MeshStandardMaterial({ color: "#e9cfa2", emissive: new THREE.Color("#ff9c48"), emissiveIntensity: 0.6, roughness: 0.92, side: THREE.DoubleSide }));
export function gueridon(p: Prop, c: PropsCtx) {
  const f = footOf(p), L = loungeMats(c.q, c.P), r = f.r * 0.98, h = 0.62;
  c.batch.add(ROOM, L.brass, lathe("lounge-guerBase", [[0, 0], [0.19, 0], [0.2, 0.012], [0.17, 0.03], [0.05, 0.05], [0.032, 0.08], [0.028, 0.45], [0.04, 0.47], [0.03, 0.52], [0.06, 0.56], [0.06, h - 0.03], [0, h - 0.03]], 24), at(f, 0, 0, 0), { cast: true });
  c.batch.add(ROOM, L.marble, CYL0(32), at(f, 0, h - 0.03, 0, 0, r, 0.03, r), { cast: true });
  c.batch.add(ROOM, L.brass, geo(`lounge-gallery${r.toFixed(2)}`, () => new THREE.TorusGeometry(r, 0.008, 6, 40).rotateX(Math.PI / 2)), at(f, 0, h + 0.012, 0));
  // abajur: pé de latão em balaústre, cúpula plissada de seda, lâmpada acesa e o pingente da corrente
  c.batch.add(ROOM, L.brass, lathe("lounge-lampBase", [[0, 0], [0.075, 0], [0.08, 0.01], [0.05, 0.03], [0.04, 0.1], [0.055, 0.16], [0.02, 0.24], [0.012, 0.42], [0, 0.42]], 18), at(f, 0.06, h, -0.05));
  c.batch.add(ROOM, shadeMat(), pleatedShade(0.17, 0.1, 0.22, 18), at(f, 0.06, h + 0.3, -0.05));
  c.inst.add(ROOM, "lounge-lampGlow", SPH(10), glow("lounge-lampGlowMat", "#ffd29a", 2.2), at(f, 0.06, h + 0.36, -0.05, 0, 0.045));
  c.inst.add(ROOM, "lounge-finial", SPH(8), L.brass, at(f, 0.06, h + 0.55, -0.05, 0, 0.012));
  // porta-retrato (prata) e uma taça
  c.batch.add(ROOM, L.steel, BOX0(), at(f, -0.12, h, -0.08, 0.5, 0.11, 0.14, 0.012, -0.12));
  c.batch.add(ROOM, solid("lounge-photo", "#3a3530", { rough: 0.4 }), BOX0(), at(f, -0.12, h + 0.015, -0.074, 0.5, 0.08, 0.1, 0.004, -0.12));
  glassAt(c, ROOM, L, at(f, -0.1, h, 0.12), 0, L.drinkGold);
  lamp(c.anchors, ROOM, world(f, 0.06, h + 0.42, -0.05), "#ffc27a", 4.2, 4.2);
}
