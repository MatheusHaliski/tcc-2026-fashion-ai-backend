/*
 * MET Gala Heist v2 — lounge (Z05): as paredes — lambri com almofadas, quadros de damasco, pilastras, friso
 * com dentículos e sanca iluminada, a sobreporta com a cartela e as janelas em arco com cortinas. Saiu de
 * lounge.ts sem mudança.
 */
import * as THREE from "three";
import { BOX0, SPH, geo, mat, mul } from "../interior-batch";
import { glow } from "../interior-mats";
import { drawnTexture, rand } from "../interior-tex";
import type { RoomsCtx } from "./kit";
import { areaMat, frameRing, lathe, profileRun, raisedPanel, drape } from "./lounge-kit";
import type { LoungeMats } from "./lounge-mob";
import { room, H, type Wall, wm, BASE_PROF, CAP_PROF, CROWN_PROF } from "./lounge-planta";

/** Lambri, rodapé, capitel, quadros de damasco e pilastras num trecho de parede [a0, a1]. */
export function panelledWall(c: RoomsCtx, L: LoungeMats, w: Wall, a0: number, a1: number, o: { upper?: boolean; pilasters?: boolean } = {}) {
  const len = a1 - a0, mid = (a0 + a1) / 2;
  c.batch.add(room, L.walnut, profileRun("lounge-baseRun", BASE_PROF), wm(w, mid, 0, 0, len, 1, 1), { cast: false });
  c.batch.add(room, L.walnut, BOX0(), wm(w, mid, 0.2, 0.008, len, 0.84, 0.016));
  c.batch.add(room, L.walnut, profileRun("lounge-capRun", CAP_PROF), wm(w, mid, 1.03, 0, len, 1, 1));
  const n = Math.max(1, Math.round(len / 0.95)), bw = len / n;
  for (let k = 0; k < n; k++) {
    const a = a0 + (k + 0.5) * bw;
    if (bw > 0.36) {
      c.batch.add(room, L.walnut, raisedPanel(bw - 0.16, 0.6, 0.018, 0.035), wm(w, a, 0.62, 0.016));
      c.batch.add(room, L.walnut, frameRing(bw - 0.1, 0.68, 0.03, 0.014), wm(w, a, 0.62, 0.016));
    }
    if (o.upper !== false && bw > 0.5) c.batch.add(room, L.gold, frameRing(bw - 0.26, 2.2, 0.026, 0.014), wm(w, a, 2.42, 0.004));
  }
  if (o.pilasters !== false) for (const a of [a0 + 0.07, a1 - 0.07]) {
    c.batch.add(room, L.walnut, BOX0(), wm(w, a, 1.1, 0.012, 0.14, 2.76, 0.024));
    c.batch.add(room, L.gold, BOX0(), wm(w, a, 3.7, 0.026, 0.16, 0.08, 0.012));
    c.batch.add(room, L.gold, BOX0(), wm(w, a, 1.1, 0.026, 0.16, 0.05, 0.012));
  }
}
/** Friso, dentículos, cimalha e a sanca com fita de luz, correndo a parede inteira [a0, a1]. */
export function cornice(c: RoomsCtx, L: LoungeMats, w: Wall, a0: number, a1: number) {
  const len = a1 - a0, mid = (a0 + a1) / 2;
  c.batch.add(room, L.walnut, BOX0(), wm(w, mid, 3.86, 0.012, len, 0.15, 0.024));
  c.batch.add(room, L.gold, BOX0(), wm(w, mid, 3.85, 0.026, len, 0.012, 0.01));
  for (let a = a0 + 0.04; a < a1 - 0.02; a += 0.07) c.inst.add(room, "lounge-dentil", BOX0(), L.walnut, wm(w, a, 4.0, 0.045, 0.034, 0.055, 0.045));
  c.batch.add(room, L.walnut, profileRun("lounge-crownRun", CROWN_PROF), wm(w, mid, 4.06, 0, len, 1, 1));
  // sanca: prateleira a 4,15 m e a aba de 18 cm; a fita de LED atrás da aba lava o teto
  c.batch.add(room, L.walnut, BOX0(), wm(w, mid, 4.15, 0.17, len, 0.03, 0.34));
  c.batch.add(room, L.walnut, BOX0(), wm(w, mid, 4.15, 0.335, len, 0.17, 0.03));
  c.batch.add(room, L.gold, BOX0(), wm(w, mid, 4.15, 0.352, len, 0.015, 0.008));
  c.batch.add(room, glow("lounge-coveLed", "#ffc27a", 2.4), BOX0(), wm(w, mid, 4.18, 0.27, len, 0.012, 0.02));
  c.batch.add(room, glow("lounge-coveWash", "#ffb466", 0.85, { additive: true, map: coveWashTexture() }), geo("lounge-washPlane", () => { const g = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2), uv = g.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); return g; }), wm(w, mid, H - 0.006, 0.42, len, 1, 0.84));
  c.batch.add(room, glow("lounge-coveWallWash", "#ffb466", 0.6, { additive: true, map: coveWashTexture() }), geo("lounge-washWall", () => new THREE.PlaneGeometry(1, 1).rotateZ(Math.PI)), wm(w, mid, 4.46, 0.004, len, 0.3, 1));
}
function coveWashTexture(): THREE.Texture {
  return drawnTexture("lounge-coveWashTex", 32, 128, (g, w, h) => { const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "rgba(255,255,255,0.95)"); grd.addColorStop(0.4, "rgba(255,255,255,0.35)"); grd.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h); }, false);
}

/* ---------- sobreporta (a guarnição e as folhas são da área do vestíbulo; aqui o que fica acima delas) ---------- */
/** Friso de nogueira com cimalha sobre o vão e a cartela dourada em volutas ao centro, na parede `w` em torno de `a`. */
export function overdoor(c: RoomsCtx, L: LoungeMats, w: Wall, a: number, width: number) {
  c.batch.add(room, L.walnut, BOX0(), wm(w, a, 2.74, 0.025, width + 0.5, 0.18, 0.05), { cast: true });
  c.batch.add(room, L.gold, BOX0(), wm(w, a, 2.79, 0.052, width + 0.3, 0.012, 0.006));
  c.batch.add(room, L.walnut, profileRun("lounge-overRun", [[0, 0.05], [0.03, 0.07], [0.06, 0.08], [0.09, 0.12], [0.12, 0.14], [0.12, 0]]), wm(w, a, 2.92, 0, width + 0.7, 1, 1));
  for (const s of [-1, 1]) c.inst.add(room, "lounge-rosetteCorner", SPH(10), L.gold, wm(w, a + s * (width / 2 + 0.12), 2.83, 0.06, 0.045, 0.045, 0.025));
  c.batch.add(room, L.gold, geo("lounge-cartouche", () => {
    const s = new THREE.Shape(); s.moveTo(0, -0.2); s.bezierCurveTo(0.16, -0.2, 0.22, -0.08, 0.2, 0.05); s.bezierCurveTo(0.3, 0.06, 0.34, 0.16, 0.26, 0.2); s.bezierCurveTo(0.2, 0.24, 0.12, 0.2, 0.1, 0.16); s.bezierCurveTo(0.06, 0.26, -0.06, 0.26, -0.1, 0.16); s.bezierCurveTo(-0.12, 0.2, -0.2, 0.24, -0.26, 0.2); s.bezierCurveTo(-0.34, 0.16, -0.3, 0.06, -0.2, 0.05); s.bezierCurveTo(-0.22, -0.08, -0.16, -0.2, 0, -0.2);
    return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 3, curveSegments: 16 });
  }), wm(w, a, 3.3, 0.02), { cast: true });
  c.batch.add(room, L.walnut, geo("lounge-cartoucheField", () => { const s = new THREE.Shape(); s.absellipse(0, 0, 0.11, 0.13, 0, Math.PI * 2, false, 0); return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 24 }); }), wm(w, a, 3.3, 0.058));
  c.batch.add(room, L.gold, geo("lounge-cartoucheL", () => new THREE.TorusGeometry(0.06, 0.008, 6, 20)), wm(w, a, 3.3, 0.09));
}

/* ---------- janelas em arco com cortinas (parede sul) ---------- */
function nightWindowTexture(): THREE.Texture {
  return drawnTexture("lounge-nightWindow", 256, 512, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#04070d"); bg.addColorStop(0.75, "#0d1522"); bg.addColorStop(1, "#1a1a1e"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 70; k++) { const x = rand(k + 3)() * w, y = h * (0.55 + rand(k + 91)() * 0.45), r = 1 + rand(k + 7)() * 3; const gl = g.createRadialGradient(x, y, 0, x, y, r * 4); gl.addColorStop(0, "rgba(255,206,140,0.9)"); gl.addColorStop(1, "rgba(255,180,90,0)"); g.fillStyle = gl; g.fillRect(x - r * 4, y - r * 4, r * 8, r * 8); }
  });
}
export function archWindow(c: RoomsCtx, L: LoungeMats, xc: number) {
  const w: Wall = "S", hw = 0.8, sill = 0.98, spring = 2.65, top = spring + hw;
  const night = areaMat("lounge-nightGlass", () => new THREE.MeshStandardMaterial({ map: nightWindowTexture(), emissiveMap: nightWindowTexture(), emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.35, roughness: 0.05, metalness: 0.3, envMapIntensity: 1.4 }));
  c.batch.add(room, night, geo("lounge-winGlass", () => { const s = new THREE.Shape(); s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, spring - sill); s.absarc(0, spring - sill, hw, 0, Math.PI, false); s.closePath(); const g = new THREE.ShapeGeometry(s, 24); const uv = g.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + hw) / (2 * hw), uv.getY(i) / (top - sill)); return g; }), wm(w, xc, sill, 0.004));
  // caixilhos de bronze: montante, travessas e raios da bandeira
  const bronze = L.bronze;
  c.batch.add(room, bronze, BOX0(), wm(w, xc, sill, 0.02, 0.04, spring - sill, 0.03));
  for (const y of [sill + 0.55, sill + 1.12, spring]) c.batch.add(room, bronze, BOX0(), wm(w, xc, y - 0.02, 0.02, 2 * hw, 0.04, 0.03));
  for (let k = 1; k < 6; k++) { const a = (k / 6) * Math.PI; c.batch.add(room, bronze, BOX0(), mul(wm(w, xc, spring, 0.02), mat(0, 0, 0, 0, 0.03, hw, 0.03, 0, a - Math.PI / 2))); }
  // guarnição em arco (nogueira com filete de ouro) e o peitoril moldurado
  c.batch.add(room, L.walnut, geo("lounge-winTrim", () => { const s = new THREE.Shape(), t = 0.13, sp = spring - sill; s.moveTo(-hw - t, 0); s.lineTo(-hw - t, sp); s.absarc(0, sp, hw + t, Math.PI, 0, true); s.lineTo(hw + t, 0); s.lineTo(hw, 0); s.lineTo(hw, sp); s.absarc(0, sp, hw, 0, Math.PI, false); s.lineTo(-hw, 0); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 24 }); }), wm(w, xc, sill, 0.0), { cast: true });
  c.batch.add(room, L.walnut, profileRun("lounge-sillRun", [[0, 0.02], [0.03, 0.09], [0.05, 0.1], [0.06, 0]]), wm(w, xc, sill - 0.06, 0, 2 * hw + 0.36, 1, 1));
  // bandô estofado com recorte em festões, franja de borlas, as duas cortinas presas e as braçadeiras
  c.batch.add(room, L.curtain, geo("lounge-pelmet", () => { const s = new THREE.Shape(), ww = 1.25; s.moveTo(-ww, 0.32); s.lineTo(ww, 0.32); s.lineTo(ww, 0); for (let k = 0; k < 5; k++) { const x0 = ww - (k * 2 * ww) / 5, x1 = ww - ((k + 1) * 2 * ww) / 5; s.quadraticCurveTo((x0 + x1) / 2, 0.16, x1, 0); } s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1, curveSegments: 10 }); }), wm(w, xc, top + 0.05, 0.02), { cast: true });
  for (let k = 0; k <= 5; k++) {
    const x = xc - 1.25 + (k * 2.5) / 5;
    c.inst.add(room, "lounge-tassel", geo("lounge-tasselGeo", () => new THREE.ConeGeometry(0.03, 0.12, 8).translate(0, -0.06, 0)), L.gold, wm(w, x, top + 0.05, 0.17));
    c.inst.add(room, "lounge-tasselKnob", SPH(6), L.gold, wm(w, x, top + 0.06, 0.17, 0.022, 0.022, 0.022));
  }
  for (let k = 0; k < 40; k++) c.inst.add(room, "lounge-fringeBit", BOX0(), L.gold, wm(w, xc - 1.24 + k * 0.0636, top + 0.05 - 0.05 + 0.08 * Math.sin(((k % 8) / 8) * Math.PI), 0.17, 0.008, 0.05, 0.008));
  for (const s of [-1, 1]) {
    // a cortina de cada lado junta para fora (a área S olha para −z: o lado "de fora" de quem olha a janela inverte)
    c.batch.add(room, L.curtain, drape(`win${s}`, 0.85, top + 0.15, 4, 0.05, 1.18, 0.38, -s as 1 | -1), wm(w, xc + s * 0.98, 0, 0.06), { cast: true });
    c.batch.add(room, L.brass, lathe("lounge-tieRose", [[0, 0], [0.05, 0], [0.055, 0.01], [0.03, 0.03], [0, 0.035]], 16), mul(wm(w, xc + s * 1.45, 1.18, 0.0), mat(0, 0, 0, 0, 1, 1, 1, Math.PI / 2)));
    c.batch.add(room, L.gold, geo("lounge-tieCord", () => new THREE.TorusGeometry(0.13, 0.012, 6, 20).rotateX(Math.PI / 2).scale(1, 1, 0.6)), wm(w, xc + s * 1.24, 1.18, 0.12));
  }
}
