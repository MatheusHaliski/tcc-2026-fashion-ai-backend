/*
 * MET Gala Heist v2 — Lounge e bar (Z05): decoração sem colisão (paredes, teto, piso, objetos), luzes e o que anima.
 * Código movido de interior-rooms.ts; o módulo da área (AREA, no fim) diz as salas, o construtor e o que ele substitui.
 */
import * as THREE from "three";
import { BOX0, geo, mat, mul } from "../interior-batch";
import { fabric, glow } from "../interior-mats";
import { rand } from "../interior-tex";
import { chandelier } from "../interior-hall";
import { frondGeometry, frondMaterial } from "../interior-dress";
import { type RoomsCtx, A, B, PLANE, wallPlane, signMat, sconce, washTexture, beacon } from "./kit";
import type { AreaModule } from "./types";

/** Lounge e bar como a referência: arcos dourados com cortinas de veludo roxo, bar em arco retroiluminado, arandelas, palmeiras. */
function lounge(c: RoomsCtx) {
  const P = c.P, room = "lounge", H = 4.6;
  const velvet = fabric("loungeCurtain", "#3b1748", c.q, { sheen: "#a06ad0", rough: 0.7 });
  const archFrame = (r: number, sp: number) => geo(`lgArch${r}-${sp}`, () => { const s = new THREE.Shape(), t = 0.16; s.moveTo(-r - t, 0); s.lineTo(-r - t, sp); s.absarc(0, sp, r + t, Math.PI, 0, true); s.lineTo(r + t, 0); s.lineTo(r, 0); s.lineTo(r, sp); s.absarc(0, sp, r, 0, Math.PI, false); s.lineTo(-r, 0); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1, curveSegments: 24 }); });
  const drape = (w: number, h: number) => geo(`drape${w}-${h}`, () => {
    const g = new THREE.PlaneGeometry(w, h, 40, 6); const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), t = (y + h / 2) / h; p.setZ(i, 0.06 * Math.sin(x * 18) * (0.6 + 0.4 * (1 - t)) + 0.05); p.setX(i, x * (1 - 0.22 * (1 - t) * Math.max(0, 1 - Math.abs(x) * 1.5))); }
    g.translate(0, h / 2, 0); g.computeVertexNormals(); return g;
  });
  // parede sul (z 14): três arcos com cortinas presas nas laterais e espelho escuro no fundo
  for (const x of [14.6, 17.25, 19.9]) {
    const at = mat(x, 0, 13.995, Math.PI);
    c.batch.add(room, P.gold, archFrame(1.0, 2.6), at, { cast: true });
    c.batch.add(room, P.mirror, geo("lgArchFill", () => { const s = new THREE.Shape(); s.moveTo(-1, 0); s.lineTo(1, 0); s.lineTo(1, 2.6); s.absarc(0, 2.6, 1, 0, Math.PI, false); s.closePath(); return new THREE.ShapeGeometry(s, 24); }), mul(at, mat(0, 0, -0.003)));
    for (const s of [-1, 1]) c.batch.add(room, velvet, drape(0.75, 3.4), mul(at, mat(s * 0.62, 0.02, 0.02)), { cast: true });
    c.batch.add(room, velvet, drape(2.2, 0.55), mul(at, mat(0, 3.05, 0.04)));
    c.batch.add(room, P.gold, geo("tieback", () => new THREE.TorusGeometry(0.06, 0.015, 6, 16)), mul(at, mat(-0.7, 1.1, 0.12)));
    c.batch.add(room, P.gold, geo("tieback", () => new THREE.TorusGeometry(0.06, 0.015, 6, 16)), mul(at, mat(0.7, 1.1, 0.12)));
  }
  // o bar em arco na parede leste (x 22): espelho, prateleiras retroiluminadas com garrafas, arco dourado e o letreiro
  const back = mat(21.995, 0, 9.5, -Math.PI / 2);
  c.batch.add(room, P.gold, archFrame(2.2, 1.9), back, { cast: true });
  c.batch.add(room, P.mirror, geo("barArchFill", () => { const s = new THREE.Shape(); s.moveTo(-2.2, 0); s.lineTo(2.2, 0); s.lineTo(2.2, 1.9); s.absarc(0, 1.9, 2.2, 0, Math.PI, false); s.closePath(); return new THREE.ShapeGeometry(s, 28); }), mul(back, mat(0, 0, -0.004)));
  c.batch.add(room, glow("backbarGlow", "#ffb760", 0.65, { additive: true, map: washTexture() }), PLANE(), mul(back, mat(0, 2.1, 0.003, 0, 4.2, 2.8, 1)));
  const R = rand(91);
  for (let sh = 0; sh < 4; sh++) {
    const y = 1.15 + sh * 0.48;
    c.batch.add(room, P.glass, BOX0(), mul(back, mat(0, y, 0.12, 0, 3.6, 0.025, 0.22)));
    c.inst.add(room, "shelfLed", BOX0(), glow("shelfLed", "#ffcf87", 2.6), mul(back, mat(0, y + 0.026, 0.2, 0, 3.5, 0.008, 0.01)));
    for (let k = 0; k < 18; k++) { const x = -1.7 + k * 0.2 + (R() - 0.5) * 0.04; c.inst.add(room, "bottle", geo("lgBottle", () => new THREE.LatheGeometry([[0, 0], [0.04, 0], [0.042, 0.02], [0.042, 0.2], [0.03, 0.25], [0.014, 0.29], [0.014, 0.33], [0, 0.33]].map(([a, b]) => new THREE.Vector2(a, b)), 12)), [P.bottleAmber, P.bottleGreen, P.bottleClear][Math.floor(R() * 3)], mul(back, mat(x, y + 0.025, 0.14, 0, 0.9 + R() * 0.3, 0.8 + R() * 0.5, 0.9 + R() * 0.3))); }
  }
  wallPlane(c, room, signMat(c.copy.lounge, "neon", "", 1.2), 21.97, 3.3, 9.5, -Math.PI / 2, 1.6, 0.4);
  A(c, room, 21.3, 2.2, 9.5, "#ffb258", 10, 5.5);
  // arandelas nas paredes oeste e norte, palmeiras nos cantos, lustre e o teto escuro com sanca dourada
  // (as duas da parede leste ladeiam o arco do bar, como na referência)
  for (const [x, y, z, ry] of [[12.53, 2.6, 6.2, Math.PI / 2], [12.53, 2.6, 12.8, Math.PI / 2], [19.0, 2.6, 4.53, 0], [15.3, 2.6, 4.53, 0], [21.97, 2.75, 6.62, -Math.PI / 2], [21.97, 2.75, 12.38, -Math.PI / 2]] as [number, number, number, number][]) sconce(c, room, x, y, z, ry);
  const frond = frondGeometry(), fm = frondMaterial();
  for (const [x, z] of [[21.45, 5.1], [12.85, 13.68]]) {
    c.batch.add(room, P.gold, geo("lgPot", () => new THREE.LatheGeometry([[0, 0], [0.2, 0], [0.26, 0.4], [0.28, 0.44], [0, 0.44]].map(([a, b]) => new THREE.Vector2(a, b)), 20)), mat(x, 0, z));
    for (let k = 0; k < 12; k++) c.inst.add(room, "frond", frond, fm, mat(x, 0.42, z, (k / 12) * Math.PI * 2, 1.1, 1.5, 1, -0.3 - (k % 3) * 0.15));
  }
  chandelier(room, 17.2, 3.4, 9.3, H, c.q, P, c.batch, c.inst, [], 0.75);
  A(c, room, 17.2, 3.6, 9.3, "#ffcf98", 10, 7);
  B(c, room, P.gold, 17.25, H - 0.12, 4.56, 9.5, 0.04, 0.04);
  beacon(c, room, 12.6, 3.9, 8.0, 1, 0);
}

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = { id: "lounge", rooms: ["lounge"], dress: lounge };
