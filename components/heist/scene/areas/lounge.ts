/*
 * MET Gala Heist v2 — Lounge e bar (Z05): o salão íntimo da gala, na linguagem dos salões fechados de um castelo de jogo
 * de terror gótico (referência de linguagem, nada copiado): espaço fechado com teto trabalhado, paredes em camadas, piso
 * com desenho, luz de fonte visível e mobiliário único.
 *
 *  · piso: parquet em espinha de peixe (lounge-tex) com frisa de nogueira e filete de latão junto às paredes, dois
 *    tapetes persas com franja sob os grupos de estar;
 *  · paredes: rodapé moldurado, lambri de nogueira com almofadas em bisel e capitel, damasco azul-petróleo (a casca) em
 *    quadros de filete dourado entre pilastras, friso com dentículos, cimalha e a sanca iluminada;
 *  · teto: escuro, em caixotões laqueados com filete de ouro entre vigas de nogueira, florão e o lustre art déco em
 *    três andares de vidro fosco com pingentes;
 *  · leste: a estante do bar de Davi (arco de ônix aceso por trás, prateleiras de vidro com garrafas de rótulos
 *    inventados, espelhos envelhecidos, armário baixo com tampo de ônix) e os pendentes de vidro âmbar sobre o balcão;
 *  · sul: três janelas em arco (vidro noturno, caixilhos de bronze) com cortinas de veludo presas, bandô e franja;
 *  · arandelas art déco de vidro fosco, a pintura com luz de quadro, o espelho envelhecido, o relógio solar dourado,
 *    luminária de pé, palmeiras em cachepôs de cerâmica e o giroflex do alarme sobre a porta.
 * Os móveis com colisão (bar, sofás, poltronas, mesas, banquetas, piano, trumeau, biombo) estão em lounge-mob.ts.
 */
import * as THREE from "three";
import { baseProps } from "@/lib/heist/level";
import { BOX0, CYL, SPH, geo, mat, mul } from "../interior-batch";
import { glow, solid } from "../interior-mats";
import { drawnTexture, rand, type Quality } from "../interior-tex";
import { frondGeometry, frondMaterial } from "../interior-dress";
import { type RoomsCtx, A, signMat, washTexture, beacon, lightCone } from "./kit";
import type { AreaModule } from "./types";
import { areaMat, contactMat, frameRing, lathe, pleatedShade, profileRun, raisedPanel, drape, tube, footOf } from "./lounge-kit";
import { DAMASK_TILE, PARQUET_TILE, cofferTexture, damaskSurface, fringeTexture, paintingTexture, parquetSurface, rugTexture } from "./lounge-tex";
import { armchair, barStool, bottleAt, coffeeTable, glassAt, grandPiano, gueridon, lacquerScreen, loungeMats, loungeSofa, onyxBar, shadeMat, trumeau, type LoungeMats } from "./lounge-mob";

const room = "lounge", H = 4.6, X0 = 12.5, X1 = 22, Z0 = 4.5, Z1 = 14;

/* ---------- paredes: referencial de cada uma (along = coordenada ao longo da parede, out = para dentro da sala) ---------- */
type Wall = "W" | "N" | "E" | "S";
/** Matriz num ponto da parede: x local corre ao longo, y para cima, z local sai da parede para a sala. */
function wm(w: Wall, a: number, y: number, out: number, sx = 1, sy = 1, sz = 1, rx = 0): THREE.Matrix4 {
  switch (w) {
    case "W": return mat(X0 + out, y, a, Math.PI / 2, sx, sy, sz, rx);
    case "N": return mat(a, y, Z0 + out, 0, sx, sy, sz, rx);
    case "E": return mat(X1 - out, y, a, -Math.PI / 2, sx, sy, sz, rx);
    default: return mat(a, y, Z1 - out, Math.PI, sx, sy, sz, rx);
  }
}
const wv = (w: Wall, a: number, y: number, out: number) => new THREE.Vector3().setFromMatrixPosition(wm(w, a, y, out));

/* ---------- molduras corridas (perfis em [altura, saliência]) ---------- */
const BASE_PROF: [number, number][] = [[0, 0.024], [0.14, 0.024], [0.152, 0.032], [0.168, 0.032], [0.182, 0.02], [0.2, 0.014], [0.2, 0]];
const CAP_PROF: [number, number][] = [[0, 0.03], [0.012, 0.05], [0.04, 0.056], [0.056, 0.046], [0.066, 0.028], [0.07, 0]];
const CROWN_PROF: [number, number][] = [[0, 0.03], [0.02, 0.05], [0.03, 0.05], [0.05, 0.09], [0.07, 0.12], [0.08, 0.17], [0.09, 0.18], [0.09, 0]];

/** Lambri, rodapé, capitel, quadros de damasco e pilastras num trecho de parede [a0, a1]. */
function panelledWall(c: RoomsCtx, L: LoungeMats, w: Wall, a0: number, a1: number, o: { upper?: boolean; pilasters?: boolean } = {}) {
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
function cornice(c: RoomsCtx, L: LoungeMats, w: Wall, a0: number, a1: number) {
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
function overdoor(c: RoomsCtx, L: LoungeMats, w: Wall, a: number, width: number) {
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

/* ---------- teto em caixotões ---------- */
const BEAM_X = [14.4, 16.3, 18.2, 20.1], BEAM_Z = [6.4, 8.3, 10.2, 12.1];
function ceiling(c: RoomsCtx, L: LoungeMats) {
  const coffer = areaMat("lounge-cofferMat", () => new THREE.MeshStandardMaterial({ map: cofferTexture(), roughness: 0.35, metalness: 0.15, envMapIntensity: 0.8 }));
  const xs = [X0, ...BEAM_X, X1], zs = [Z0, ...BEAM_Z, Z1];
  const plane = geo("lounge-ceilPlane", () => new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2));
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) c.batch.add(room, coffer, plane, mat((xs[i] + xs[i + 1]) / 2, H, (zs[j] + zs[j + 1]) / 2, 0, xs[i + 1] - xs[i], 1, zs[j + 1] - zs[j]));
  // vigas de nogueira com filete de contas embaixo e cubos de latão nos cruzamentos
  const zA = Z0 + 0.34, zB = Z1 - 0.34, xA = X0 + 0.34, xB = X1 - 0.34;
  for (const x of BEAM_X) { c.batch.add(room, L.walnut, BOX0(), mat(x, H - 0.3, (zA + zB) / 2, 0, 0.22, 0.3, zB - zA), { cast: true }); for (const s of [-1, 1]) c.batch.add(room, L.walnut, BOX0(), mat(x + s * 0.12, H - 0.3, (zA + zB) / 2, 0, 0.025, 0.035, zB - zA)); c.batch.add(room, L.gold, BOX0(), mat(x, H - 0.305, (zA + zB) / 2, 0, 0.05, 0.008, zB - zA)); }
  for (const z of BEAM_Z) { c.batch.add(room, L.walnut, BOX0(), mat((xA + xB) / 2, H - 0.26, z, 0, xB - xA, 0.26, 0.2), { cast: true }); c.batch.add(room, L.gold, BOX0(), mat((xA + xB) / 2, H - 0.265, z, 0, xB - xA, 0.008, 0.05)); }
  for (const x of BEAM_X) for (const z of BEAM_Z) c.batch.add(room, L.brass, lathe("lounge-boss", [[0, 0], [0.07, 0], [0.08, 0.02], [0.05, 0.05], [0, 0.06]], 16), mat(x, H - 0.3, z, 0, 1, 1, 1, Math.PI));
  // florão do lustre no caixotão central
  c.batch.add(room, L.gold, lathe("lounge-rose", [[0, 0], [0.42, 0], [0.4, 0.02], [0.33, 0.035], [0.3, 0.06], [0.2, 0.07], [0.12, 0.1], [0, 0.11]], 32), mat(17.25, H, 9.25, 0, 1, 1, 1, Math.PI));
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; c.inst.add(room, "lounge-roseLeaf", geo("lounge-roseLeafGeo", () => new THREE.SphereGeometry(1, 8, 4, 0, Math.PI).scale(0.05, 0.02, 0.12)), L.gold, mat(17.25 + Math.cos(a) * 0.3, H - 0.03, 9.25 + Math.sin(a) * 0.3, -a + Math.PI / 2)); }
}

/* ---------- lustre art déco (três andares de vidro fosco) e pendentes do bar ---------- */
function chandelierDeco(c: RoomsCtx, L: LoungeMats, x: number, z: number) {
  const frost = areaMat("lounge-frost", () => new THREE.MeshStandardMaterial({ color: "#e9d2a8", emissive: new THREE.Color("#ff9c48"), emissiveIntensity: 0.62, roughness: 0.5, transparent: true, opacity: 0.93, side: THREE.DoubleSide }));
  const crystal = solid("lounge-crystal", "#f7f2ff", { metal: 0.1, rough: 0.02, env: 2.4, transparent: true, opacity: 0.86 });
  c.batch.add(room, L.brass, CYL(8), mat(x, (H + 3.95) / 2, z, 0, 0.012, H - 3.95, 0.012));
  c.batch.add(room, L.brass, lathe("lounge-chCanopy", [[0, 0], [0.11, 0], [0.12, 0.03], [0.05, 0.09], [0, 0.1]], 20), mat(x, H, z, 0, 1, 1, 1, Math.PI));
  const tiers: [number, number, number][] = [[3.92, 0.26, 0.16], [3.66, 0.42, 0.2], [3.36, 0.58, 0.24]];
  for (const [y, r, h] of tiers) {
    c.batch.add(room, frost, lathe(`lounge-tier${r}`, [[r * 1.02, 0], [r, h * 0.15], [r * 0.72, h]], 36), mat(x, y - h, z));
    c.batch.add(room, L.brass, geo(`lounge-tierRing${r}`, () => new THREE.TorusGeometry(r * 1.02, 0.012, 6, 48).rotateX(Math.PI / 2)), mat(x, y - h, z));
    c.batch.add(room, L.brass, geo(`lounge-tierRingB${r}`, () => new THREE.TorusGeometry(r * 0.72, 0.01, 6, 40).rotateX(Math.PI / 2)), mat(x, y, z));
    const n = Math.round(r * 40);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      c.inst.add(room, "lounge-drop", geo("lounge-dropGeo", () => new THREE.OctahedronGeometry(1, 0).scale(0.5, 1.6, 0.5)), crystal, mat(x + Math.cos(a) * r * 1.02, y - h - 0.05 - (k % 2) * 0.04, z + Math.sin(a) * r * 1.02, a, 0.016));
      if (c.q === "high") c.inst.add(room, "lounge-drop", geo("lounge-dropGeo", () => new THREE.OctahedronGeometry(1, 0).scale(0.5, 1.6, 0.5)), crystal, mat(x + Math.cos(a) * r * 1.02, y - h - 0.12 - (k % 2) * 0.04, z + Math.sin(a) * r * 1.02, a + 0.4, 0.012));
      if (k % 4 === 0) c.batch.add(room, L.brass, CYL(5), mat(x + Math.cos(a) * r * 0.85, y - h / 2, z + Math.sin(a) * r * 0.85, 0, 0.005, h, 0.005));
    }
    c.inst.add(room, "lounge-chBulb", SPH(8), glow("lounge-chBulbMat", "#ffe2b0", 2.6), mat(x, y - h * 0.6, z, 0, r * 0.32, 0.05, r * 0.32));
  }
  c.batch.add(room, L.brass, lathe("lounge-chFinial", [[0, 0], [0.06, 0.02], [0.08, 0.06], [0.04, 0.12], [0.015, 0.18], [0, 0.2]], 16), mat(x, 3.12, z, 0, 1, 1, 1, Math.PI));
  c.batch.add(room, frost, SPH(16), mat(x, 2.86, z, 0, 0.08));
  A(c, room, x, 3.45, z, "#ffd29a", 13, 8.5);
}
function pendant(c: RoomsCtx, L: LoungeMats, x: number, z: number, y: number) {
  const amber = areaMat("lounge-amberGlass", () => new THREE.MeshStandardMaterial({ color: "#b8641e", emissive: new THREE.Color("#ff7a22"), emissiveIntensity: 0.75, roughness: 0.18, transparent: true, opacity: 0.88 }));
  c.batch.add(room, L.brass, lathe("lounge-pCanopy", [[0, 0], [0.07, 0], [0.075, 0.02], [0.03, 0.05], [0, 0.05]], 16), mat(x, H, z, 0, 1, 1, 1, Math.PI));
  c.batch.add(room, L.brass, CYL(6), mat(x, (H + y + 0.14) / 2, z, 0, 0.006, H - y - 0.14, 0.006));
  c.batch.add(room, L.brass, lathe("lounge-pCap", [[0, 0], [0.05, 0], [0.06, 0.03], [0.02, 0.07], [0, 0.08]], 16), mat(x, y + 0.11, z));
  c.batch.add(room, amber, SPH(18), mat(x, y, z, 0, 0.13, 0.14, 0.13));
  c.inst.add(room, "lounge-pBulb", SPH(8), glow("lounge-pBulbMat", "#ffd8a0", 3), mat(x, y, z, 0, 0.035));
}

/* ---------- arandela art déco (tulipa de vidro fosco) ---------- */
function decoSconce(c: RoomsCtx, L: LoungeMats, w: Wall, a: number, y: number) {
  const frost = areaMat("lounge-frostSconce", () => new THREE.MeshStandardMaterial({ color: "#ecd6ae", emissive: new THREE.Color("#ffa456"), emissiveIntensity: 0.7, roughness: 0.5, side: THREE.DoubleSide }));
  c.batch.add(room, L.brass, BOX0(), wm(w, a, y - 0.16, 0.01, 0.12, 0.32, 0.02));
  c.batch.add(room, L.brass, BOX0(), wm(w, a, y - 0.12, 0.022, 0.07, 0.24, 0.016));
  c.batch.add(room, L.brass, tube("lounge-sconceArm", [[0, 0, 0.02], [0, 0.03, 0.09], [0, 0.1, 0.14]], 0.01, 10, 6), wm(w, a, y - 0.06, 0));
  c.batch.add(room, frost, lathe("lounge-tulip", [[0.035, 0], [0.06, 0.04], [0.085, 0.12], [0.1, 0.2], [0.098, 0.205]], 20), wm(w, a, y + 0.04, 0.14));
  c.inst.add(room, "lounge-sconceBulb", SPH(8), glow("lounge-sconceBulbMat", "#ffe0b0", 2.4), wm(w, a, y + 0.12, 0.14, 0.03, 0.04, 0.03));
  c.batch.add(room, glow("lounge-sconceWash", "#ffb46a", 0.5, { additive: true, map: washTexture() }), geo("lounge-washV", () => new THREE.PlaneGeometry(1, 1)), wm(w, a, y + 0.25, 0.006, 1.2, 1.5, 1));
  const p = wv(w, a, y + 0.2, 0.3);
  A(c, room, p.x, p.y, p.z, "#ffbf75", 3, 4);
}

/* ---------- estante do bar (parede leste) ---------- */
function backBar(c: RoomsCtx, L: LoungeMats) {
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

/* ---------- janelas em arco com cortinas (parede sul) ---------- */
function nightWindowTexture(): THREE.Texture {
  return drawnTexture("lounge-nightWindow", 256, 512, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#04070d"); bg.addColorStop(0.75, "#0d1522"); bg.addColorStop(1, "#1a1a1e"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 70; k++) { const x = rand(k + 3)() * w, y = h * (0.55 + rand(k + 91)() * 0.45), r = 1 + rand(k + 7)() * 3; const gl = g.createRadialGradient(x, y, 0, x, y, r * 4); gl.addColorStop(0, "rgba(255,206,140,0.9)"); gl.addColorStop(1, "rgba(255,180,90,0)"); g.fillStyle = gl; g.fillRect(x - r * 4, y - r * 4, r * 8, r * 8); }
  });
}
function archWindow(c: RoomsCtx, L: LoungeMats, xc: number) {
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

/* ---------- pintura, espelho de parede, relógio e luminária de pé ---------- */
function painting(c: RoomsCtx, L: LoungeMats) {
  const w: Wall = "W", a = 7.1, y = 2.3, pw = 1.86, ph = 1.24;
  const canvasMat = areaMat("lounge-paintingMat", () => new THREE.MeshStandardMaterial({ map: paintingTexture(), roughness: 0.55 }));
  c.batch.add(room, L.gold, frameRing(pw + 0.2, ph + 0.2, 0.1, 0.07), wm(w, a, y, 0.01), { cast: true });
  c.batch.add(room, L.gold, frameRing(pw + 0.04, ph + 0.04, 0.025, 0.04), wm(w, a, y, 0.02));
  c.batch.add(room, canvasMat, geo("lounge-planeV", () => new THREE.PlaneGeometry(1, 1)), wm(w, a, y, 0.03, pw, ph, 1));
  // luz de quadro: braço e calha de latão com a fenda acesa
  for (const s of [-0.4, 0.4]) c.batch.add(room, L.brass, tube("lounge-picArm", [[0, 0, 0], [0, 0.08, 0.1], [0, 0.1, 0.2]], 0.008, 8, 6), wm(w, a + s, y + ph / 2 + 0.12, 0.01));
  c.batch.add(room, L.brass, geo("lounge-picHood", () => new THREE.CylinderGeometry(0.045, 0.045, 1, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2)), wm(w, a, y + ph / 2 + 0.22, 0.21, 1.0, 1, 1));
  c.batch.add(room, glow("lounge-picSlot", "#ffe2b0", 2.4), BOX0(), wm(w, a, y + ph / 2 + 0.18, 0.21, 0.95, 0.008, 0.03));
  const p = wv(w, a, y + 0.4, 0.5); A(c, room, p.x, p.y, p.z, "#ffd8a8", 2.4, 2.6);
}
function wallMirror(c: RoomsCtx, L: LoungeMats, w: Wall, a: number, y: number, mw: number, mh: number) {
  c.batch.add(room, L.mirror, geo("lounge-planeV", () => new THREE.PlaneGeometry(1, 1)), wm(w, a, y, 0.02, mw, mh, 1));
  c.batch.add(room, L.gold, frameRing(mw + 0.12, mh + 0.12, 0.07, 0.05), wm(w, a, y, 0.006), { cast: true });
  for (let k = 0; k < 4; k++) { const sx = k % 2 ? 1 : -1, sy = k < 2 ? 1 : -1; c.inst.add(room, "lounge-rosetteCorner", SPH(10), L.gold, wm(w, a + sx * (mw / 2 + 0.03), y + sy * (mh / 2 + 0.03), 0.06, 0.035, 0.035, 0.02)); }
}
function sunburstClock(c: RoomsCtx, L: LoungeMats, w: Wall, a: number, y: number) {
  const M = wm(w, a, y, 0.01);
  c.batch.add(room, L.gold, CYL(32), mul(M, mat(0, 0, 0.02, 0, 0.17, 0.04, 0.17, Math.PI / 2)));
  c.batch.add(room, solid("lounge-clockFace", "#efe6cf", { rough: 0.5 }), CYL(32), mul(M, mat(0, 0, 0.042, 0, 0.13, 0.005, 0.13, Math.PI / 2)));
  for (let k = 0; k < 24; k++) { const a2 = (k / 24) * Math.PI * 2, len = k % 2 ? 0.2 : 0.32; c.batch.add(room, L.gold, BOX0(), mul(M, mat(Math.cos(a2) * (0.18 + len / 2), Math.sin(a2) * (0.18 + len / 2) - 0.01, 0.02, 0, len, 0.018, 0.01, 0, a2))); }
  for (let k = 0; k < 12; k++) { const a2 = (k / 12) * Math.PI * 2; c.inst.add(room, "lounge-clockTick", BOX0(), L.black, mul(M, mat(Math.cos(a2) * 0.115, Math.sin(a2) * 0.115 - 0.004, 0.047, 0, 0.012, 0.008, 0.002, 0, a2))); }
  // 23h07: ponteiro das horas quase no 11, minutos no 1
  c.batch.add(room, L.black, BOX0(), mul(M, mat(0, 0, 0.05, 0, 0.012, 0.075, 0.003, 0, 0.46)));
  c.batch.add(room, L.black, BOX0(), mul(M, mat(0, 0, 0.051, 0, 0.008, 0.11, 0.003, 0, -0.73)));
}
function floorLamp(c: RoomsCtx, L: LoungeMats, x: number, z: number) {
  c.batch.add(room, L.brass, lathe("lounge-flBase", [[0, 0], [0.17, 0], [0.175, 0.012], [0.15, 0.03], [0.03, 0.05], [0.02, 1.38], [0.03, 1.4], [0, 1.41]], 24), mat(x, 0, z), { cast: true });
  c.batch.add(room, shadeMat(), pleatedShade(0.24, 0.16, 0.3, 22), mat(x, 1.32, z));
  c.inst.add(room, "lounge-lampGlow", SPH(10), glow("lounge-lampGlowMat", "#ffd29a", 2.2), mat(x, 1.42, z, 0, 0.05));
  A(c, room, x, 1.45, z, "#ffc27a", 4, 4.4);
}
/** Palmeira de canto em cachepô de celadon: as folhas abrem só para dentro da sala (`toward` = direção do centro). */
function palm(c: RoomsCtx, x: number, z: number, seed: number, toward: number) {
  const glaze = solid("lounge-celadon", "#3f6e66", { rough: 0.22, env: 1.2 });
  c.batch.add(room, solid("lounge-standWood", "#2a1a10", { rough: 0.6 }), lathe("lounge-potStand", [[0, 0], [0.24, 0], [0.24, 0.03], [0.2, 0.05], [0.2, 0.12], [0, 0.12]], 8), mat(x, 0, z));
  c.batch.add(room, glaze, lathe("lounge-pot", [[0, 0], [0.16, 0], [0.2, 0.05], [0.26, 0.2], [0.27, 0.38], [0.24, 0.46], [0.25, 0.5], [0.22, 0.5], [0, 0.46]], 28), mat(x, 0.12, z), { cast: true });
  const frond = frondGeometry(), fm = frondMaterial(), R = rand(seed);
  for (let k = 0; k < 13; k++) c.inst.add(room, "frond", frond, fm, mat(x, 0.6, z, toward + (k / 12 - 0.5) * 2.4 + (R() - 0.5) * 0.15, 0.9 + R() * 0.3, 1.3 + R() * 0.4, 0.85, -0.2 - (k % 3) * 0.14));
}
/** Vaso alto de cerâmica craquelada num pedestal baixo, com plumas secas de capim-dos-pampas (canto sem espaço para folhas). */
function pampasVase(c: RoomsCtx, x: number, z: number) {
  const crackle = solid("lounge-crackle", "#cfc6b2", { rough: 0.3, env: 1.1 });
  c.batch.add(room, solid("lounge-standWood", "#2a1a10", { rough: 0.6 }), lathe("lounge-potStand", [[0, 0], [0.24, 0], [0.24, 0.03], [0.2, 0.05], [0.2, 0.12], [0, 0.12]], 8), mat(x, 0, z));
  c.batch.add(room, crackle, lathe("lounge-tallVase", [[0, 0], [0.11, 0], [0.13, 0.04], [0.2, 0.3], [0.21, 0.42], [0.15, 0.66], [0.08, 0.8], [0.075, 0.86], [0.095, 0.9], [0.07, 0.9], [0, 0.86]], 28), mat(x, 0.12, z), { cast: true });
  const R = rand(5);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2, tilt = 0.1 + R() * 0.22, len = 0.9 + R() * 0.4;
    c.batch.add(room, solid("lounge-reed", "#b59a6a", { rough: 0.9 }), CYL(4), mat(x, 1.0, z, a, 0.005, len, 0.005, tilt, 0));
    const tip = new THREE.Vector3(0, len / 2 + 0.12, 0).applyEuler(new THREE.Euler(tilt, a, 0, "YXZ"));
    c.inst.add(room, "lounge-plume", geo("lounge-plumeGeo", () => new THREE.SphereGeometry(1, 8, 6).scale(0.05, 0.2, 0.05)), solid("lounge-plumeMat", "#e7d8b4", { rough: 1 }), mat(x + tip.x, 1.0 + tip.y, z + tip.z, a, 1, 1, 1, tilt, 0));
  }
}

/* ---------- tapetes e frisa do piso ---------- */
function rug(c: RoomsCtx, kind: "a" | "b", q: Quality, x0: number, z0: number, x1: number, z1: number, alongX: boolean, aspect: number) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, t = 0.009;
  const tex = rugTexture(kind, q, aspect), pile = areaMat(`lounge-rugMat-${kind}-${q}`, () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.96, envMapIntensity: 0.35 }));
  c.batch.add(room, solid("lounge-rugEdge", "#2a1612", { rough: 1 }), BOX0(), mat(cx, 0, cz, 0, w, t, d));
  // a textura é retrato (urdidura em v): o tapete deitado ao longo de x gira 90°
  c.batch.add(room, pile, geo("lounge-rugTop", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), mat(cx, t + 0.0004, cz, alongX ? Math.PI / 2 : 0, alongX ? d : w, 1, alongX ? w : d), { receive: true });
  const fringe = areaMat("lounge-fringeMat", () => new THREE.MeshStandardMaterial({ map: fringeTexture(), alphaTest: 0.45, roughness: 0.95, side: THREE.DoubleSide }));
  const ends: [number, number, number, number][] = alongX ? [[x0 - 0.05, cz, Math.PI / 2, d], [x1 + 0.05, cz, -Math.PI / 2, d]] : [[cx, z0 - 0.05, Math.PI, w], [cx, z1 + 0.05, 0, w]];
  for (const [x, z, ry, len] of ends) {
    const g = geo(`lounge-fringe-${len.toFixed(2)}`, () => { const pg = new THREE.PlaneGeometry(len, 0.1).rotateX(-Math.PI / 2); const uv = pg.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len * 4); return pg; });
    c.batch.add(room, fringe, g, mat(x, 0.003, z, ry));
  }
}
function floorBorder(c: RoomsCtx, L: LoungeMats) {
  // frisa: duas tábuas de nogueira corridas (12 cm) e o filete de latão, a 0,02 m do rodapé; para nas portas
  const runs: [Wall, number, number][] = [["W", Z0, 9], ["W", 11, Z1], ["N", X0, 16], ["N", 18, X1], ["E", Z0, Z1], ["S", X0, X1]];
  for (const [w, a0, a1] of runs) {
    const mid = (a0 + a1) / 2, len = a1 - a0;
    for (const out of [0.08, 0.2]) c.batch.add(room, L.mahogany, BOX0(), wm(w, mid, 0, out, len, 0.0025, 0.118));
    c.batch.add(room, L.brass, BOX0(), wm(w, mid, 0, 0.268, len, 0.0028, 0.012));
  }
}

/** Lounge e bar (decoração sem colisão, luzes): ver o cabeçalho. */
function lounge(c: RoomsCtx) {
  const L = loungeMats(c.q, c.P, c.copy);
  // paredes: oeste (porta do salão em z 9–11), norte (bastidores em x 16–18), leste (estante do bar), sul (janelas)
  panelledWall(c, L, "W", Z0, 8.8); panelledWall(c, L, "W", 11.2, Z1);
  panelledWall(c, L, "N", X0, 15.8); panelledWall(c, L, "N", 18.2, X1);
  panelledWall(c, L, "E", Z0, 6.05); panelledWall(c, L, "E", 12.95, Z1);
  for (const [a0, a1] of [[X0, 13.15], [15.01, 16.32], [18.18, 19.49], [21.35, X1]] as [number, number][]) panelledWall(c, L, "S", a0, a1, { upper: a1 - a0 > 1 });
  for (const xc of [14.08, 17.25, 20.42]) {
    c.batch.add(room, L.walnut, profileRun("lounge-baseRun", BASE_PROF), wm("S", xc, 0, 0, 1.86, 1, 1));
    c.batch.add(room, L.walnut, BOX0(), wm("S", xc, 0.2, 0.008, 1.86, 0.78, 0.016));
    c.batch.add(room, L.walnut, raisedPanel(1.5, 0.56, 0.018, 0.035), wm("S", xc, 0.58, 0.016));
    archWindow(c, L, xc);
  }
  // sobre as portas: a parede até a cimalha ganha o friso inteiro (a guarnição das folhas é da área do vestíbulo)
  for (const w of ["W", "E"] as Wall[]) cornice(c, L, w, Z0, Z1);
  for (const w of ["N", "S"] as Wall[]) cornice(c, L, w, X0, X1);
  ceiling(c, L);
  chandelierDeco(c, L, 17.25, 9.25);
  for (const z of [7.5, 9.5, 11.5]) { pendant(c, L, 20.35, z, 2.32); lightCone(c, room, new THREE.Vector3(20.35, 2.2, z), new THREE.Vector3(20.3, 1.1, z), 0.42, "#ffb066", 0.05); }
  backBar(c, L);
  painting(c, L);
  wallMirror(c, L, "W", 12.6, 2.3, 0.62, 1.5);
  sunburstClock(c, L, "N", 20.95, 2.75);
  for (const [w, a, y] of [["W", 5.55, 2.25], ["W", 8.6, 2.25], ["W", 11.68, 2.3], ["W", 13.52, 2.3], ["N", 15.55, 2.3], ["N", 18.45, 2.3], ["E", 13.5, 2.35], ["S", 15.67, 2.45], ["S", 18.83, 2.45]] as [Wall, number, number][]) decoSconce(c, L, w, a, y);
  floorLamp(c, L, 13.3, 5.32);
  palm(c, 21.35, 5.1, 7, Math.atan2(17.25 - 21.35, 9.25 - 5.1)); pampasVase(c, 12.92, 13.6);
  // piso: frisa, tapetes persas sob os dois grupos e as sombras de contato dos móveis que pisam neles
  floorBorder(c, L);
  rug(c, "a", c.q, 13.45, 5.55, 16.6, 8.65, true, 1);
  rug(c, "b", c.q, 13.7, 11.25, 17.45, 13.35, true, 1.5);
  const shadow = contactMat(), flat = geo("lounge-shadowPlane", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  for (const p of baseProps()) {
    if (p.room !== "lounge" || p.kind === "mirror" || p.kind === "bar" || p.kind === "piano") continue;
    const f = footOf(p);
    if (!((f.cx > 13.45 && f.cx < 16.6 && f.cz > 5.55 && f.cz < 8.65) || (f.cx > 13.7 && f.cx < 17.45 && f.cz > 11.25 && f.cz < 13.35))) continue;
    c.batch.add(room, shadow, flat, mat(f.cx, 0.0105, f.cz, f.yaw, f.w + 0.28, 1, f.d + 0.28), { receive: false });
  }
  overdoor(c, L, "W", 10, 2); overdoor(c, L, "N", 17, 2);
  // giroflex do alarme na parede oeste, ao lado da porta do salão
  beacon(c, room, 12.6, 3.55, 8.15, 1, 0);
}

/** Módulo da área (ver areas/types.ts): decoração, móveis próprios, piso/parede/teto e a luz principal. */
export const AREA: AreaModule = {
  id: "lounge", rooms: ["lounge"], dress: lounge,
  props: {
    bar: onyxBar, sofa: loungeSofa, table: gueridon, piano: grandPiano, mirror: trumeau,
    fixture: (p, c) => { switch (p.model) { case "loungeStool": return barStool(p, c); case "loungeArmchair": return armchair(p, c); case "loungeCoffee": return coffeeTable(p, c); case "loungeScreen": return lacquerScreen(p, c); } },
  },
  surfaces: {
    lounge: {
      floor: (q) => { const sf = parquetSurface(q); return areaMat(`lounge-floor-${q}`, () => new THREE.MeshStandardMaterial({ map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, normalScale: new THREE.Vector2(0.9, 0.9), vertexColors: true, roughness: 1, envMapIntensity: 0.85 })); },
      floorTile: [PARQUET_TILE, PARQUET_TILE], floorMirror: [0.42, 0.035],
      wall: (q) => { const sf = damaskSurface(q); return areaMat(`lounge-wall-${q}`, () => new THREE.MeshStandardMaterial({ map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, normalScale: new THREE.Vector2(1.1, 1.1), vertexColors: true, roughness: 1, envMapIntensity: 0.55 })); },
      wallTile: [DAMASK_TILE, DAMASK_TILE], ceil: null, trims: false,
    },
  },
  keys: {
    lounge: [
      { p: [17.25, 3.05, 9.25], aim: [16.6, 0, 9.4], angle: 1.15, i: 32, color: "#ffc98a" },
      { p: [19.9, 2.25, 9.5], aim: [19.4, 0, 9.5], angle: 1.05, i: 16, color: "#ffb466" },
    ],
  },
};
