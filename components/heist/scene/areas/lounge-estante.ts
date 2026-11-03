/*
 * MET Gala Heist v2 — lounge (Z05): a estante do bar na parede leste — armário baixo com tampo de ônix,
 * arco de ônix aceso, prateleiras de vidro com garrafas, espelhos e o letreiro. Saiu de lounge.ts sem mudança.
 */
import * as THREE from "three";
import { BOX0, SPH, geo, mat, mul } from "../interior-batch";
import { glow } from "../interior-mats";
import { rand } from "../interior-tex";
import { type RoomsCtx, A, signMat } from "./kit";
import { frameRing, raisedPanel } from "./lounge-kit";
import { bottleAt, glassAt, type LoungeMats } from "./lounge-mob";
import { room, wm } from "./lounge-planta";

/* ---------- estante do bar (parede leste) ---------- */
export function backBar(c: RoomsCtx, L: LoungeMats) {
  const za = 6.1, zb = 12.9, zc = 9.5;
  // armário baixo: corpo, portas almofadadas com puxadores, tampo de ônix com sobra
  c.batch.add(room, L.walnut, BOX0(), wm("E", zc, 0.08, 0.15, zb - za, 0.86, 0.3), { cast: true });
  c.batch.add(room, L.black, BOX0(), wm("E", zc, 0, 0.13, zb - za - 0.04, 0.08, 0.26));
  for (let k = 0; k < 11; k++) {
    const a = za + (k + 0.5) * (zb - za) / 11;
    c.batch.add(room, L.walnut, raisedPanel((zb - za) / 11 - 0.08, 0.66, 0.016, 0.03), wm("E", a, 0.52, 0.3));
    c.inst.add(room, "lounge-knob", SPH(8), L.brass, wm("E", a + (k % 2 ? -0.18 : 0.18), 0.66, 0.33, 0.018, 0.018, 0.018));
  }
  c.batch.add(room, L.onyxTop, BOX0(), wm("E", zc, 0.94, 0.16, zb - za + 0.04, 0.045, 0.34));
  // em cima do armário: copos de cabeça para baixo em fileiras, decanters e o balde grande
  for (let k = 0; k < 24; k++) { const a = za + 0.35 + (k % 12) * 0.16 + (k >= 12 ? 3.9 : 0), out = 0.1 + (k % 2) * 0.08; glassAt(c, room, L, mul(wm("E", a, 0.985 + 0.15, out), mat(0, 0, 0, 0, 1, 1, 1, Math.PI)), 3, null); }
  for (const [a, s] of [[8.6, 1], [10.4, 0]] as [number, number][]) bottleAt(c, room, L, wm("E", a, 0.985, 0.16), s === 1 ? 1 : 3, 10 + s);
  // arco central: moldura dourada, ônix aceso por trás, prateleiras de vidro com fita de LED e garrafas
  const r = 1.2, spring = 1.45;
  c.batch.add(room, L.gold, geo("lounge-bbArch", () => { const s = new THREE.Shape(), t = 0.14; s.moveTo(-r - t, 0); s.lineTo(-r - t, spring); s.absarc(0, spring, r + t, Math.PI, 0, true); s.lineTo(r + t, 0); s.lineTo(r, 0); s.lineTo(r, spring); s.absarc(0, spring, r, 0, Math.PI, false); s.lineTo(-r, 0); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 28 }); }), wm("E", zc, 1.0, 0.0), { cast: true });
  c.batch.add(room, L.onyxGlow, geo("lounge-bbOnyx", () => { const s = new THREE.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, spring); s.absarc(0, spring, r, 0, Math.PI, false); s.closePath(); const g = new THREE.ShapeGeometry(s, 28); const uv = g.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.3, uv.getY(i) / 1.3); return g; }), wm("E", zc, 1.0, 0.005));
  const shelfY = [1.32, 1.74, 2.16, 2.58], R = rand(91);
  let lab = 0;
  for (const y of shelfY) {
    c.batch.add(room, L.glassClear, BOX0(), wm("E", zc, y, 0.13, 2 * r - 0.04, 0.018, 0.26));
    c.inst.add(room, "lounge-shelfLed", BOX0(), glow("lounge-shelfLedMat", "#ffcf87", 2.6), wm("E", zc, y - 0.006, 0.255, 2 * r - 0.06, 0.008, 0.01));
    for (let k = 0; k < 11; k++) { const a = zc - r + 0.16 + k * (2 * r - 0.32) / 10 + (R() - 0.5) * 0.03, s = (k + Math.round(y * 10)) % 4 as 0 | 1 | 2 | 3; bottleAt(c, room, L, wm("E", a, y + 0.018, 0.12 + (R() - 0.5) * 0.04, 1, 1, 1), s, lab++); }
  }
  // seções laterais: espelho envelhecido atrás, pilastras de nogueira com capitel de latão, prateleiras e garrafas
  for (const [a0, a1] of [[za, za + 2.05], [zb - 2.05, zb]] as [number, number][]) {
    const am = (a0 + a1) / 2, wdt = a1 - a0 - 0.24;
    c.batch.add(room, L.mirror, geo("lounge-bbMirror", () => new THREE.PlaneGeometry(1, 1)), wm("E", am, 2.3, 0.004, wdt, 2.4, 1));
    for (const y of shelfY) {
      c.batch.add(room, L.glassClear, BOX0(), wm("E", am, y, 0.12, wdt, 0.018, 0.24));
      c.inst.add(room, "lounge-shelfLed", BOX0(), glow("lounge-shelfLedMat", "#ffcf87", 2.6), wm("E", am, y - 0.006, 0.235, wdt - 0.02, 0.008, 0.01));
      for (let k = 0; k < 9; k++) { const a = am - wdt / 2 + 0.12 + k * (wdt - 0.24) / 8 + (R() - 0.5) * 0.03, s = (k * 3 + Math.round(y * 7)) % 4 as 0 | 1 | 2 | 3; bottleAt(c, room, L, wm("E", a, y + 0.018, 0.11 + (R() - 0.5) * 0.03), s, lab++); }
    }
    c.batch.add(room, L.walnut, BOX0(), wm("E", am, 3.42, 0.1, a1 - a0, 0.12, 0.2));
    c.batch.add(room, L.gold, BOX0(), wm("E", am, 3.42, 0.202, a1 - a0, 0.02, 0.01));
    for (const a of [a0 + 0.06, a1 - 0.06]) {
      c.batch.add(room, L.walnut, BOX0(), wm("E", a, 0.98, 0.05, 0.12, 2.44, 0.1), { cast: true });
      c.batch.add(room, L.brass, BOX0(), wm("E", a, 3.3, 0.06, 0.15, 0.12, 0.12));
    }
  }
  // letreiro dourado iluminado no alto do arco
  c.batch.add(room, signMat(c.copy.lounge, "gala", "", 0.9), geo("lounge-signPlane", () => new THREE.PlaneGeometry(1, 1)), wm("E", zc, 3.15, 0.07, 1.2, 0.3, 1));
  c.batch.add(room, L.gold, frameRing(1.28, 0.38, 0.03, 0.02), wm("E", zc, 3.15, 0.06));
  A(c, room, 21.45, 2.1, zc, "#ffb258", 9, 5.5);
  A(c, room, 21.6, 2.2, 7.1, "#ffc887", 2.6, 3); A(c, room, 21.6, 2.2, 11.9, "#ffc887", 2.6, 3);
}
