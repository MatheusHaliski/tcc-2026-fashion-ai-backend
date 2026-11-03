/*
 * MET Gala Heist v2 — Sala de segurança (Z09): os móveis próprios da sala ("fixture" da planta) — mesa de coordenação
 * com a base de rádios, racks ventilados de 42U (um aberto) e o armário do café. Saiu de seguranca.ts sem mudança.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { BOX0, CYL0, SPH, geo } from "../interior-batch";
import { glow, solid } from "../interior-mats";
import { rand } from "../interior-tex";
import { foot, type PropsCtx } from "../interior-props";
import { Fr, SM, lathe, light, rbox, tube } from "./servico-kit";

const room = "seguranca";
/* ---------- móveis próprios da sala ---------- */
/** Mesa de coordenação: base de carregamento com seis rádios, headsets, telefone, livro de ocorrências, luminária. */
export function coordDesk(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, R = rand(523);
  for (const s of [-1, 1]) f.box(S.steelBlack, s * (w / 2 - 0.02), 0, 0, 0.04, 0.72, d - 0.04);
  f.box(S.steelBlack, 0, 0.12, -d / 2 + 0.06, w - 0.06, 0.55, 0.02);
  f.rbox(solid("seg-top", "#2a2d31", { rough: 0.55 }), 0, 0.72, 0, w, 0.035, d, 0.012, 0, true);
  f.rbox(S.rubber, 0, 0.715, d / 2 - 0.02, w, 0.045, 0.05, 0.02);
  // gabinete do computador e nobreak embaixo
  f.rbox(S.plasticBlack, -w / 2 + 0.2, 0, -0.05, 0.2, 0.45, 0.45, 0.01); f.i("seg-ledOn", SPH(6), glow("seg-ledBlue", "#5ab4ff", 2.2), -w / 2 + 0.25, 0.4, 0.18, 0, 0.005);
  f.rbox(S.plasticBlack, w / 2 - 0.2, 0, -0.1, 0.18, 0.25, 0.38, 0.01);
  // base de rádios (seis), com antena e LED de carga
  const base = f.sub(-0.35, 0.755, -0.22);
  base.rbox(S.plasticBlack, 0, 0, 0, 0.6, 0.06, 0.16, 0.01);
  for (let k = 0; k < 6; k++) { const x = -0.25 + k * 0.1; base.rbox(S.plasticBlack, x, 0.05, 0, 0.06, 0.16, 0.035, 0.008, 0, false); base.i("seg-antenna", CYL0(6), S.plasticBlack, x + 0.015, 0.21, 0, 0, 0.006, 0.09, 0.006); base.i("seg-ledCharge", SPH(6), glow(k % 4 === 1 ? "seg-ledAmberS" : "seg-ledGreenS", k % 4 === 1 ? "#ffb02a" : "#37ff6e", 2.2), x, 0.035, 0.081, 0, 0.005); }
  // dois headsets (arco, conchas e haste do microfone)
  for (const [x, z, ry] of [[0.25, -0.05, 0.4], [0.55, 0.12, -0.3]] as [number, number, number][]) {
    const h = f.sub(x, 0.79, z, ry);
    h.g(S.plasticBlack, geo("seg-headband", () => new THREE.TorusGeometry(0.085, 0.008, 6, 20, Math.PI)), 0, 0, 0, 0, 1, 1, 1, Math.PI / 2, 0);
    for (const s of [-1, 1]) h.g(S.plasticBlack, lathe("earcup", [[0, 0], [0.04, 0], [0.042, 0.02], [0.03, 0.035], [0, 0.036]], 14), s * 0.085, -0.02, 0, 0, 1, 1, 1, 0, s * Math.PI / 2);
    h.g(S.plasticBlack, tube([[0.1, -0.02, 0], [0.11, -0.01, 0.07], [0.06, -0.015, 0.13]], 0.004, 10, 5), 0, 0, 0);
  }
  // telefone, livro de ocorrências aberto com canetas, prancheta, copo de café e a luminária articulada
  f.rbox(S.plasticBlack, 0.0, 0.755, 0.18, 0.2, 0.06, 0.22, 0.02, 0.1); f.box(S.plasticBlack, 0.0, 0.81, 0.13, 0.19, 0.04, 0.05, 0.1);
  f.box(S.plasticBlue, -0.25, 0.755, 0.15, 0.48, 0.012, 0.32, -0.05); f.box(S.paper, -0.37, 0.768, 0.15, 0.22, 0.004, 0.3, -0.05); f.box(S.paper, -0.13, 0.768, 0.15, 0.22, 0.004, 0.3, -0.05);
  for (let k = 0; k < 9; k++) f.i("seg-line", BOX0(), S.plasticBlue, -0.25 + (k % 2 ? 0.12 : -0.12), 0.7725, 0.04 + Math.floor(k / 2) * 0.05, -0.05, 0.18, 0.0005, 0.002);
  f.cylX(S.plasticBlue, -0.05, 0.775, 0.27, 0.005, 0.14, 6); f.cylX(S.plasticRed, -0.05, 0.775, 0.29, 0.005, 0.14, 6);
  f.g(S.paper, lathe("cup", [[0, 0], [0.032, 0], [0.042, 0.11], [0, 0.11]], 14), 0.62, 0.755, -0.25);
  // luminária de mesa: base, haste, braço e cúpula voltada para o livro
  f.cyl(S.steelBlack, -0.68, 0.755, -0.25, 0.07, 0.02, 14); f.cyl(S.steelBlack, -0.68, 0.775, -0.25, 0.01, 0.42, 8);
  f.cylZ(S.steelBlack, -0.68, 1.19, -0.08, 0.01, 0.36, 8); f.g(S.steelBlack, geo("seg-lampHead", () => new THREE.ConeGeometry(0.07, 0.11, 16, 1, true)), -0.68, 1.15, 0.1);
  f.g(S.opalWarm, SPH(8), -0.68, 1.11, 0.1, 0, 0.03);
  light(c, room, f.p(-0.68, 1.0, 0.1), "#ffe4b8", 1.6, 1.8);
  void R;
}
/** Dois racks ventilados de 42U (porta perfurada; o da direita aberto: switches, gravadores e o nobreak). */
export function racks(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), d = F.d, R = rand(541), H2 = 2.0;
  const mesh = solid("seg-mesh", "#16181b", { metal: 0.5, rough: 0.6, transparent: true, opacity: 0.88 });
  for (let k = 0; k < 2; k++) {
    const g = f.sub(-0.3 + k * 0.6, 0, 0);
    g.box(S.steelBlack, 0, 0.05, 0, 0.6, H2 - 0.05, d); for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.i("seg-rackFoot", CYL0(8), S.steelBlack, sx * 0.25, 0, sz * (d / 2 - 0.08), 0, 0.025, 0.05, 0.025);
    for (let j = 0; j < 2; j++) g.cyl(S.steelBlack, -0.12 + j * 0.24, H2, -0.1, 0.07, 0.02, 18);
    // equipamentos (vistos pela porta perfurada ou com a porta aberta)
    for (let u = 0; u < 9; u++) {
      const y = 0.12 + u * 0.2, kind = (u + k) % 3;
      g.box(kind === 2 ? S.plasticGrey : S.plasticBlack, 0, y, d / 2 - 0.08, 0.5, kind === 0 ? 0.088 : 0.17, 0.05);
      for (let l = 0; l < (kind === 0 ? 8 : 4); l++) { const bl = R() > 0.3; g.i(bl ? "seg-ledBlink" : "seg-ledOn", SPH(5), bl ? glow("seg-ledBlinkG", "#46ff7c", 2.4) : glow("seg-ledAmberS", "#ffb02a", 2.2), -0.2 + l * 0.055, y + 0.05, d / 2 - 0.054, 0, 0.004); }
      if (kind === 0) for (let l = 0; l < 6; l++) g.i("seg-patch", BOX0(), [S.plasticBlue, S.plasticYellow, S.plasticRed, S.plasticGreen][l % 4], -0.15 + l * 0.05, y + 0.02, d / 2 - 0.05, 0, 0.012, 0.05, 0.03);
    }
    const open = k === 1, dr = g.sub(-0.3, 0, d / 2 + 0.005, open ? -1.25 : 0);
    dr.box(S.steelBlack, 0.3, 0.06, 0, 0.6, H2 - 0.08, 0.008); dr.box(mesh, 0.3, 0.2, 0.006, 0.5, H2 - 0.4, 0.004);
    dr.box(S.chrome, 0.54, 0.95, 0.02, 0.025, 0.18, 0.025);
    dr.box(S.paper, 0.3, H2 - 0.16, 0.007, 0.16, 0.05, 0.002);
  }
  // nobreak no pé do rack aberto
  f.rbox(S.plasticBlack, 0.3, 0.05, 0.05, 0.48, 0.26, d - 0.2, 0.01); f.box(glow("seg-upsLcd", "#5ab4ff", 1.3), 0.3, 0.2, d / 2 - 0.05, 0.1, 0.04, 0.002);
}
/** Armário do café: duas portas, cafeteira com jarra, canecas, copos de papel, açucareiro e lixeira ao lado. */
export function cafe(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d;
  f.rbox(S.paintCream, 0, 0.06, 0, w, 0.82, d, 0.01, 0, true); f.box(S.plasticBlack, 0, 0, 0.02, w - 0.04, 0.06, d - 0.06);
  for (const s of [-1, 1]) { f.box(S.paintCream, s * w / 4, 0.1, d / 2 + 0.004, w / 2 - 0.012, 0.74, 0.016); f.box(S.chrome, s * 0.04, 0.6, d / 2 + 0.018, 0.012, 0.1, 0.014); }
  f.box(solid("seg-cafeTop", "#3a3d42", { rough: 0.4 }), 0, 0.88, 0, w + 0.02, 0.03, d + 0.02);
  const m = f.sub(-0.1, 0.91, -0.05);
  m.rbox(S.plasticBlack, 0, 0, 0, 0.22, 0.04, 0.24, 0.01); m.rbox(S.plasticBlack, 0, 0, -0.08, 0.22, 0.36, 0.08, 0.02); m.rbox(S.plasticBlack, 0, 0.3, 0.02, 0.22, 0.06, 0.2, 0.02);
  m.g(S.glassClear, lathe("carafe", [[0, 0], [0.07, 0], [0.075, 0.08], [0.05, 0.16], [0.04, 0.18], [0, 0.18]], 18), 0, 0.04, 0.03);
  m.g(solid("seg-coffee", "#2a160b", { rough: 0.1 }), lathe("coffeeIn", [[0, 0], [0.066, 0], [0.068, 0.07], [0, 0.07]], 18), 0, 0.045, 0.03);
  m.i("seg-ledRed", SPH(6), glow("seg-ledRedS", "#ff2a2a", 2.4), 0.08, 0.022, 0.121, 0, 0.005);
  for (let k = 0; k < 3; k++) f.g([S.porcelain, S.plasticBlue, S.paintRed][k], lathe("mug", [[0, 0], [0.04, 0], [0.042, 0.1], [0.038, 0.1], [0.036, 0.008], [0, 0.008]], 16), 0.12 + (k % 2) * 0.09, 0.91, -0.1 + k * 0.08);
  f.cyl(S.paper, 0.2, 0.91, 0.17, 0.035, 0.2, 12); f.cyl(S.glassClear, -0.25, 0.91, 0.18, 0.04, 0.1, 12);
  f.cyl(S.plasticGrey, w / 2 + 0.2, 0, 0.05, 0.13, 0.36, 16);
}
