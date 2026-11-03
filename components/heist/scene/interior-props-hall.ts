/*
 * MET Gala Heist v2 — móveis do Grande Salão e das mesas (interior-props.ts): coluna coríntia com uplight, mesa alta de
 * coquetel, mesa lateral do lounge e os vasos (urna com palmeira ou jardineira com oliveira do terraço).
 */
import * as THREE from "three";
import { CYL, CYL0, SPH, geo, mat } from "./interior-batch";
import { fabric, glow, solid } from "./interior-mats";
import { drawnTexture, rand } from "./interior-tex";
import { roseGeometry } from "./interior-hall";
import { canopyGeometry, frondGeometry, frondMaterial, oliveSprigGeometry, oliveSprigMaterial } from "./interior-dress";
import type { InteriorRoom } from "./interior-shell";
import type { Foot, PropsCtx } from "./interior-props";
import { L, anchor, box, coupe, flute, flutedShaft, lathe, urn, worldOf } from "./interior-props-kit";

/** Coluna coríntia do salão: plinto, base, fuste canelado e capitel dourado até o entablamento (5 m). */
export function column(c: PropsCtx, room: string, f: Foot) {
  const P = c.P, r = f.r * 0.86;
  box(c, room, P.marbleDark, f, 0, 0, 0, f.r * 1.84, 0.32, f.r * 1.84, { cast: true });
  c.batch.add(room, P.stone, lathe("colBase", [[0, 0], [1.02, 0], [1.05, 0.06], [0.98, 0.12], [1.0, 0.16], [0.92, 0.2], [0.0, 0.2]], 40), L(f, 0, 0.32, 0, 0, r, 1, r));
  c.batch.add(room, P.stone, flutedShaft(), L(f, 0, 0.52, 0, 0, r * 0.98, 3.9, r * 0.98), { cast: true });
  c.batch.add(room, P.gold, lathe("colNeck", [[1, 0], [1.02, 0.03], [1.0, 0.07], [0, 0.07]], 40), L(f, 0, 4.42, 0, 0, r, 1, r));
  c.batch.add(room, P.stone, lathe("colCap", [[0.98, 0], [1.08, 0.18], [1.22, 0.36], [1.32, 0.46], [0, 0.46]], 40), L(f, 0, 4.48, 0, 0, r, 1, r));
  // folhas de acanto douradas (anel de folhas) e o ábaco
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; c.inst.add(room, "acanthus", geo("acanthusLeaf", () => new THREE.SphereGeometry(1, 8, 6, 0, Math.PI, 0, Math.PI / 2).scale(0.09, 0.22, 0.05)), P.gold, L(f, Math.cos(a) * r * 1.08, 4.55, Math.sin(a) * r * 1.08, -a + Math.PI / 2, 1, 1, 1, -0.25)); }
  box(c, room, P.stone, f, 0, 4.94, 0, r * 2.9, 0.08, r * 2.9);
  // uplight de festa: a lata preta no piso e a luz âmbar subindo pelo fuste, do lado que olha para o centro do salão
  const toC = Math.atan2(0 - f.cx, 4.5 - f.cz);
  c.batch.add(room, uplightWash(), geo("colWash", () => new THREE.CylinderGeometry(1, 1, 1, 40, 1, true).translate(0, 0.5, 0)), mat(f.cx, 0.33, f.cz, toC, r * 1.05, 4.1, r * 1.05));
  c.batch.add(room, P.black, CYL0(12), mat(f.cx + Math.sin(toC) * f.r * 1.35, 0, f.cz + Math.cos(toC) * f.r * 1.35, 0, 0.09, 0.12, 0.09));
  c.inst.add(room, "uplightLens", geo("uplightLensGeo", () => new THREE.CircleGeometry(0.07, 16).rotateX(-Math.PI / 2)), P.ledAmber, mat(f.cx + Math.sin(toC) * f.r * 1.35, 0.121, f.cz + Math.cos(toC) * f.r * 1.35));
}
/** Luz de uplight pintada num cilindro em volta do fuste: forte embaixo e no lado da lata, esmaecendo para cima e para os lados. */
function uplightWash(): THREE.MeshBasicMaterial {
  return glow("uplightWash", "#ffa654", 0.95, { additive: true, map: drawnTexture("uplightWashTex", 256, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = 1 - y / h, side = Math.max(0, Math.cos(u * Math.PI * 2)) ** 2.2, up = Math.max(0, 1 - v) ** 1.6 * 0.85 + 0.15 * (1 - v);
      const a = side * up, k = (y * w + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(255 * Math.min(1, a));
    }
    g.putImageData(img, 0, 0);
  }, false) });
}

/** Mesa alta de coquetel com capa de linho atada, vela no globo de vidro, taças e um buquê de rosas. */
export function cocktailTable(c: PropsCtx, room: InteriorRoom, f: Foot, id: string) {
  const P = c.P, R = rand(id.length * 97 + id.charCodeAt(id.length - 1));
  c.batch.add(room, P.brass, CYL0(24), L(f, 0, 0, 0, 0, 0.28, 0.03, 0.28));
  c.batch.add(room, P.linen, lathe("cocktailSkirt", [[0.44, 1.1], [0.435, 1.04], [0.34, 0.86], [0.2, 0.62], [0.215, 0.55], [0.3, 0.35], [0.4, 0.12], [0.45, 0.02], [0.0, 0.02]], 36), L(f, 0, 0, 0), { cast: true });
  c.batch.add(room, P.linen, CYL0(36), L(f, 0, 1.08, 0, 0, 0.445, 0.03, 0.445));
  c.batch.add(room, P.gold, geo("sash", () => new THREE.TorusGeometry(0.21, 0.018, 6, 24).rotateX(Math.PI / 2)), L(f, 0, 0.58, 0));
  // vela no globo, taças e rosas
  c.batch.add(room, P.glass, CYL(20), L(f, 0, 1.2, 0, 0, 0.07, 0.18, 0.07));
  c.inst.add(room, "candle", CYL0(10), P.candle, L(f, 0, 1.11, 0, 0, 0.035, 0.1, 0.035));
  c.inst.add(room, "flame", geo("flameGeo", () => new THREE.SphereGeometry(1, 6, 5).scale(0.5, 1.4, 0.5)), P.flame, L(f, 0, 1.235, 0, 0, 0.012));
  c.flames.push(worldOf(f, 0, 1.235, 0));
  const n = 2 + Math.floor(R() * 3);
  for (let k = 0; k < n; k++) { const a = R() * Math.PI * 2, d = 0.18 + R() * 0.16; c.inst.add(room, "flute", flute(), P.glass, L(f, Math.cos(a) * d, 1.11, Math.sin(a) * d)); c.inst.add(room, "fluteWine", geo("fluteWine", () => new THREE.CylinderGeometry(0.026, 0.008, 0.08, 10).translate(0, 0.17, 0)), P.champagne, L(f, Math.cos(a) * d, 1.11, Math.sin(a) * d)); }
  const rose = roseGeometry(c.q), roseMat = solid("roseMat", "#ffffff", { rough: 0.72, side: THREE.DoubleSide, env: 0.4 });
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; c.inst.add(room, "rose", rose, roseMat, L(f, -0.2 + Math.cos(a) * 0.05, 1.12 + (k === 0 ? 0.04 : 0), 0.18 + Math.sin(a) * 0.05, a, 0.045), new THREE.Color(k % 2 ? "#f4c3cf" : "#f3ece0")); }
  anchor(c, room, worldOf(f, 0, 1.3, 0), "#ffb46b", 2.2, 3.2, { flicker: 1 });
}
/** Mesa lateral do lounge: tampo de mármore, pé de latão e abajur com cúpula plissada. */
export function sideTable(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  c.batch.add(room, P.brass, lathe("sideBase", [[0, 0], [0.22, 0], [0.22, 0.02], [0.04, 0.05], [0.035, 0.52], [0.0, 0.52]], 20), L(f, 0, 0, 0));
  c.batch.add(room, P.marbleDark, CYL0(28), L(f, 0, 0.52, 0, 0, f.r * 0.92, 0.035, f.r * 0.92));
  c.batch.add(room, P.brass, lathe("lampBase", [[0, 0], [0.07, 0], [0.09, 0.08], [0.05, 0.2], [0.012, 0.3], [0.0, 0.3]], 16), L(f, 0.08, 0.555, 0));
  c.batch.add(room, fabric("lampShade", "#e8d2a4", c.q, { side: THREE.DoubleSide }), lathe("shade", [[0.16, 0], [0.09, 0.2], [0.0, 0.2]], 24), L(f, 0.08, 0.83, 0));
  c.inst.add(room, "lampGlow", SPH(10), glow("lampGlow", "#ffd29a", 2), L(f, 0.08, 0.9, 0, 0, 0.05));
  c.inst.add(room, "coupe", coupe(), P.glass, L(f, -0.15, 0.555, 0.08));
  anchor(c, room, worldOf(f, 0.08, 0.95, 0), "#ffc781", 4, 4.5);
}

/** Vaso: urna dourada com palmeira (salão, vestíbulo) ou jardineira de pedra com oliveira podada (terraço). */
export function planter(c: PropsCtx, room: InteriorRoom, f: Foot, id: string) {
  const P = c.P, R = rand(id.length * 13 + id.charCodeAt(id.length - 1));
  if (room === "terraco") {
    c.batch.add(room, P.stone, lathe("terrPlanter", [[0, 0], [0.98, 0], [1, 0.05], [0.95, 0.6], [1.02, 0.66], [1.0, 0.72], [0, 0.72]], 32), L(f, 0, 0, 0, 0, f.r, 1, f.r), { cast: true });
    c.batch.add(room, P.soil, CYL0(24), L(f, 0, 0.68, 0, 0, f.r * 0.9, 0.03, f.r * 0.9));
    c.batch.add(room, P.bark, geo("oliveTrunk", () => new THREE.CylinderGeometry(0.05, 0.09, 1.4, 8).translate(0, 0.7, 0)), L(f, 0, 0.7, 0, 0, 1, 1, 1, 0.08));
    c.batch.add(room, solid("oliveCore", "#1e2b19", { rough: 0.95 }), canopyGeometry(7 + (id.length % 3)), L(f, 0.05, 1.95, 0, R() * 3, 0.95));
    const sprig = oliveSprigGeometry(), sm = oliveSprigMaterial();
    for (let k = 0; k < (c.q === "high" ? 150 : 70); k++) {
      const a = R() * Math.PI * 2, el = Math.acos(2 * R() - 1), rr = 0.42 + R() * 0.2;
      const x = Math.sin(el) * Math.cos(a) * rr * 1.15, y = 2.25 + Math.cos(el) * rr * 0.8, z = Math.sin(el) * Math.sin(a) * rr * 1.15;
      c.inst.add(room, "oliveSprig", sprig, sm, L(f, x, y, z, a + Math.PI / 2, 0.8 + R() * 0.5, 0.8 + R() * 0.5, 1, (R() - 0.5) * 1.6, (R() - 0.5) * 1.2));
    }
    return;
  }
  c.batch.add(room, P.gold, urn(), L(f, 0, 0, 0, 0, f.r / 0.44, 1, f.r / 0.44), { cast: true });
  c.batch.add(room, P.soil, CYL0(20), L(f, 0, 0.57, 0, 0, f.r * 0.88, 0.02, f.r * 0.88));
  const frond = frondGeometry(), fm = frondMaterial();
  for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2 + R() * 0.3, tilt = 0.25 + R() * 0.55; c.inst.add(room, "frond", frond, fm, L(f, 0, 0.6, 0, a, 0.9 + R() * 0.5, 1.1 + R() * 0.7, 1, -tilt)); }
  for (let k = 0; k < 5; k++) c.batch.add(room, P.bark, CYL0(6), L(f, (R() - 0.5) * 0.1, 0.58, (R() - 0.5) * 0.1, 0, 0.018, 0.5 + R() * 0.6, 0.018, (R() - 0.5) * 0.2, (R() - 0.5) * 0.2));
}
