/*
 * MET Gala Heist v2 — Bastidores: camarins, ateliê e produção (Z11). Sala de 9,5 × 10 m com pé-direito de 4,6 m:
 *  - piso de palco preto em chapas parafusadas (com reflexo fosco), marcas de fita (spike) coloridas, faixas de fita
 *    gaffer branca marcando a passagem da entrada de cena, fita fosforescente nas quinas, cabos no chão presos com
 *    fita e duas canaletas de passagem de cabo;
 *  - paredes pretas foscas com cortinas de veludo no trilho, a estrutura do teto (vigas I pretas) e a grade de tubos a
 *    4,05 m com refletores de verdade (fresnel com bandeiras, PAR de LED e elipsoidal), cada um com garra, cabo de aço
 *    de segurança e o cabo de força — e a luz sai deles;
 *  - o quadro de chamada (roteiro do show, a folha de chamada, as fotos dos looks), a luz de deixa ao lado da entrada
 *    de cena, placas (silêncio, entrada de cena, camarim, figurino, produção, saída), extintor;
 *  - os móveis (bastidores-moveis.ts) e a maleta de maquiagem no chão (o esconderijo do camarim).
 */
import * as THREE from "three";
import { BOX0, CYL, CYL0, SPH, geo, mat } from "../interior-batch";
import { glow, solid } from "../interior-mats";
import { SANS, drawnTexture, rand, type Quality } from "../interior-tex";
import { type RoomsCtx, A, B, beacon, framedPoster, signMat, wallPlane } from "./kit";
import type { AreaModule, KeyDef } from "./types";
import { Fr, SM, lathe, pbrMat, rbox, sign, texStage, texWallBk, tube, xyz } from "./servico-kit";
import { extinguisher } from "./servico-pecas";
import { bastidoresFixture, callDesk, garmentRack, mannequin, monitorWall, productionDesk, steamer, vanity, vanityMirror } from "./bastidores-moveis";

const room = "bastidores", H = 4.6, GRID = 4.05;
const floorBk = (q: Quality) => pbrMat(`bk-floor-palco-${q}`, texStage(q), { vertex: true, env: 0.8 });
const wallBk = (q: Quality) => pbrMat(`bk-wall-preta-${q}`, texWallBk(q), { vertex: true, env: 0.4 });

/** Refletor de teatro preso no tubo da grade (garra, forquilha, corpo, lente, bandeiras) apontando para `target`. */
function stageLight(c: RoomsCtx, kind: "fresnel" | "par" | "leko", x: number, z: number, target: THREE.Vector3, color: string, intensity: number) {
  const S = SM(c.q), from = new THREE.Vector3(x, GRID - 0.32, z), dir = target.clone().sub(from), yaw = Math.atan2(dir.x, dir.z), pitch = Math.atan2(-dir.y, Math.hypot(dir.x, dir.z));
  const clamp = Fr.at(c, room, x, GRID, z, yaw);
  clamp.box(S.steelBlack, 0, -0.03, 0, 0.05, 0.09, 0.06); clamp.cylX(S.chrome, 0.04, 0.0, 0, 0.008, 0.05, 6);
  clamp.box(S.steelBlack, 0, -0.1, 0, 0.03, 0.08, 0.03);
  for (const s of [-1, 1]) clamp.box(S.steelBlack, s * 0.13, -0.32, 0, 0.02, 0.24, 0.03);
  clamp.box(S.steelBlack, 0, -0.1, 0, 0.28, 0.02, 0.03);
  const b = clamp.sub(0, -0.3, 0, 0, pitch);                                    // corpo inclinado na forquilha
  const lensMat = glow(`bk-lens-${color}`, color, 2.4);
  if (kind === "par") {
    b.g(S.steelBlack, lathe("parCan", [[0.0, -0.18], [0.1, -0.18], [0.12, -0.1], [0.12, 0.16], [0.125, 0.17], [0.0, 0.17]], 18), 0, 0, 0, 0, 1, 1, 1, Math.PI / 2, 0);
    b.g(lensMat, geo("bk-lensDisc", () => new THREE.CircleGeometry(0.1, 18)), 0, 0, 0.172);
    for (let k = 0; k < 6; k++) b.i("bk-fin", BOX0(), S.steelBlack, -0.1 + k * 0.04, -0.13, -0.06, 0, 0.006, 0.26, 0.12);
  } else if (kind === "fresnel") {
    b.rbox(S.steelBlack, 0, -0.13, -0.14, 0.24, 0.26, 0.3, 0.03);
    b.g(S.steelBlack, CYL(18), 0, 0, 0.04, 0, 0.12, 0.08, 0.12, Math.PI / 2, 0);
    b.g(lensMat, geo("bk-lensDisc", () => new THREE.CircleGeometry(0.1, 18)), 0, 0, 0.082);
    for (const [rx, ry2, rz] of [[0.5, 0, 0], [-0.5, 0, 0]] as [number, number, number][]) { const fl = b.sub(0, 0, 0.09, ry2, rx, rz); fl.box(S.steelBlack, 0, rx > 0 ? -0.005 : -0.135, 0.07, 0.24, 0.005, 0.14); }
    for (const s of [-1, 1]) b.box(S.steelBlack, s * 0.125, -0.12, 0.15, 0.005, 0.24, 0.12);
  } else {
    b.g(S.steelBlack, CYL(16), 0, 0, -0.12, 0, 0.1, 0.32, 0.1, Math.PI / 2, 0);
    b.g(S.steelBlack, CYL(16), 0, 0, 0.16, 0, 0.075, 0.26, 0.075, Math.PI / 2, 0);
    for (let k = 0; k < 4; k++) b.box(S.chrome, Math.cos(k * 1.57) * 0.11, Math.sin(k * 1.57) * 0.11 - 0.008, -0.02, 0.02, 0.016, 0.04);
    b.g(lensMat, geo("bk-lensDiscS", () => new THREE.CircleGeometry(0.068, 16)), 0, 0, 0.292);
  }
  clamp.g(S.chrome, tube([[0.04, 0.0, 0.0], [0.08, -0.12, 0.04], [0.02, -0.2, 0.0]], 0.003, 10, 4), 0, 0, 0);
  clamp.g(S.cable, tube([[-0.04, 0.0, 0.0], [-0.12, -0.08, 0.0], [-0.06, -0.3, -0.1]], 0.007, 10, 5), 0, 0, 0);
  const lp = b.p(0, 0, 0.3);
  A(c, room, lp.x, lp.y, lp.z, color, intensity, 7.5);
}

function bastidores(c: RoomsCtx) {
  const P = c.P, S = SM(c.q), R = rand(701);
  /* ---------- teto: vigas I pretas, grade de tubos, cabos de aço e os refletores ---------- */
  for (const x of [14.3, 17.25, 20.2]) { const f = Fr.at(c, room, x, H - 0.24, -1, 0); f.box(P.black, 0, 0, 0, 0.012, 0.22, 10); f.box(P.black, 0, 0, 0, 0.16, 0.012, 10); f.box(P.black, 0, 0.21, 0, 0.16, 0.012, 10); }
  for (const z of [-4.6, -2.0, 0.6, 2.9]) { c.batch.add(room, S.galv, CYL(10), mat(17.25, GRID, z, 0, 0.024, 8.9, 0.024, 0, Math.PI / 2)); for (const x of [14.3, 17.25, 20.2]) c.inst.add(room, "bk-sling", CYL(5), S.chrome, mat(x, (GRID + H - 0.24) / 2, z, 0, 0.003, H - 0.24 - GRID, 0.003)); }
  for (const x of [13.4, 21.1]) { c.batch.add(room, S.galv, CYL(10), mat(x, GRID + 0.05, -1, 0, 0.024, 8.4, 0.024, Math.PI / 2, 0)); for (const z of [-4.6, -2.0, 0.6, 2.9]) c.inst.add(room, "bk-coupler", BOX0(), S.steelBlack, mat(x, GRID - 0.03, z, 0, 0.07, 0.11, 0.07)); }
  const T = (x: number, z: number, y = 0) => new THREE.Vector3(x, y, z);
  stageLight(c, "fresnel", 20.2, -2.0, T(21.0, -1.1, 0.9), "#ffe2bc", 7);           // camarim
  stageLight(c, "fresnel", 13.9, -4.6, T(13.5, -5.4, 0.8), "#fff0d8", 6.5);         // bancada de costura
  stageLight(c, "par", 17.3, -2.0, T(17.6, -1.8, 0.4), "#ffd9a6", 6.5);             // vaporizador / centro
  stageLight(c, "leko", 20.0, -4.6, T(20.0, -5.4, 0.8), "#e6ecff", 5.5);            // mesa da produção
  stageLight(c, "fresnel", 15.6, 2.9, T(15.6, 2.2, 0.75), "#fff0d8", 6.5);          // mesa da folha de chamada
  stageLight(c, "par", 13.6, 0.6, T(13.8, -1.5, 0.6), "#ffcfa0", 5.5);              // arara e entrada de cena
  stageLight(c, "par", 19.2, 2.9, T(19.2, 2.4, 0.5), "#ffd9a6", 5);                 // arara do fundo e cases
  stageLight(c, "leko", 16.0, -4.6, T(15.0, -4.8, 1.0), "#ffe6f2", 5);              // manequins (looks)
  // luminárias de serviço em gaiola (luz de trabalho) e o forro escuro
  for (const [x, z] of [[16.5, 1.5], [18.6, -3.3]]) { c.batch.add(room, P.black, CYL(6), mat(x, GRID + 0.25, z, 0, 0.006, H - GRID, 0.006)); c.inst.add(room, "cageBulb", SPH(10), P.bulbWarm, mat(x, GRID - 0.05, z, 0, 0.055)); for (let k = 0; k < 4; k++) c.inst.add(room, "bk-cage", geo("bk-cageRing", () => new THREE.TorusGeometry(0.08, 0.004, 4, 16)), S.steelBlack, mat(x, GRID - 0.05, z, (k / 4) * Math.PI, 1, 1, 1, Math.PI / 2, 0)); A(c, room, x, GRID - 0.15, z, "#ffd9a6", 5, 6); }
  /* ---------- paredes: cortinas de veludo no trilho (oeste e sul), placas e sinalização ---------- */
  const drape = geo("bk-drapeGeo", () => { const g = new THREE.PlaneGeometry(1, 3.9, 26, 3); const p = g.getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, 0.05 * Math.sin(p.getX(i) * 26) * (0.7 + 0.3 * (y + 1.95) / 3.9) + 0.06); } g.translate(0, 1.95, 0); g.computeVertexNormals(); return g; });
  for (let z = -5.5; z <= 3.5; z += 1) if (z < -3.4 || z > -0.6) c.batch.add(room, P.velvetBlack, drape, mat(12.5, 0.02, z, Math.PI / 2), { cast: true });
  c.batch.add(room, S.galv, CYL(8), mat(12.6, 3.98, -1, 0, 0.015, 9.6, 0.015, Math.PI / 2, 0));
  // entrada de cena (porta do palco, parede oeste): placa, luz de deixa vermelha/verde e a fita fosforescente
  sign(c, room, "stageEntry", 12.505, 2.88, -2, Math.PI / 2, 0.2);
  // luz de deixa sobre a porta (vermelha = espera; verde = entra), ao lado da placa
  { const f = Fr.at(c, room, 12.5, 0, -1.25, Math.PI / 2); f.rbox(S.steelBlack, 0, 2.66, 0.04, 0.3, 0.14, 0.08, 0.01); f.g(glow("bk-cueRed", "#ff2a2a", 2.6), SPH(10), -0.07, 2.73, 0.085, 0, 0.035); f.g(glow("bk-cueOff", "#1d4a22", 1), SPH(10), 0.07, 2.73, 0.085, 0, 0.035); A(c, room, 12.62, 2.7, -1.25, "#ff3a2a", 1.2, 1.6); }
  sign(c, room, "silence", 17, 3.38, -5.995, 0, 0.3);
  sign(c, room, "production", 20.0, 2.55, -5.995, 0, 0.2);
  sign(c, room, "wardrobe", 13.45, 2.75, -5.995, 0, 0.2);
  sign(c, room, "makeup", 21.995, 2.65, -1.05, -Math.PI / 2, 0.22);
  sign(c, room, "quickChange", 12.62, 2.6, 1.6, Math.PI / 2, 0.18);
  sign(c, room, "exit", 17, 2.86, 3.995, Math.PI, 0.22, { lit: true });
  sign(c, room, "exit", 17, 2.86, -5.995, 0, 0.22, { lit: true });
  wallPlane(c, room, signMat(c.copy.backstage, "service"), 21.99, 3.55, -1.05, -Math.PI / 2, 1.6, 0.4);
  extinguisher(c, room, 18.6, 4.0, Math.PI);
  /* ---------- quadro de chamada (parede sul): roteiro do show, a folha, fotos dos looks e o relógio ---------- */
  const ros = drawnTexture(`bk-runOfShow-${c.copy.runOfShow[0]}`, 512, 640, (g, w, h) => {
    g.fillStyle = "#f4f4f0"; g.fillRect(0, 0, w, h); g.fillStyle = "#111"; g.textAlign = "left"; g.textBaseline = "top";
    g.font = `700 40px ${SANS}`; g.fillText(c.copy.runOfShow[0], 30, 30);
    g.font = `500 30px ${SANS}`; c.copy.runOfShow.slice(1).forEach((r, i) => g.fillText(r, 30, 110 + i * 60));
    g.strokeStyle = "#c2102a"; g.lineWidth = 5; g.beginPath(); g.moveTo(24, 110 + 3 * 60 + 18); g.lineTo(w - 24, 110 + 3 * 60 + 18); g.stroke();
  });
  {
    const f = Fr.at(c, room, 13.85, 0, 4, Math.PI);
    f.box(S.alu, 0, 0.95, 0.012, 1.9, 1.3, 0.024); f.box(S.cork, 0, 0.98, 0.026, 1.84, 1.24, 0.006);
    framedPoster(c, room, ros, ...xyz(f.p(-0.45, 1.58, 0.03)), Math.PI, 0.72, 0.9, P.black);
    for (let k = 0; k < 8; k++) f.i("bk-polaroid", BOX0(), S.white, 0.25 + (k % 4) * 0.17, 1.62 - Math.floor(k / 4) * 0.24, 0.03, (R() - 0.5) * 0.15, 0.13, 0.16, 0.002);
    for (let k = 0; k < 8; k++) f.i("bk-photo", BOX0(), solid("bk-photoInk", "#ffffff", { rough: 0.4 }), 0.25 + (k % 4) * 0.17, 1.65 - Math.floor(k / 4) * 0.24, 0.0315, 0, 0.11, 0.11, 0.001, 0, 0, new THREE.Color(["#7a0f22", "#141a35", "#d9c39a", "#e7b7b8", "#2f4f7a", "#f2f0ea", "#c9a0d8", "#0f1320"][k]));
    for (let k = 0; k < 5; k++) f.i("bk-pinHead", SPH(6), [S.plasticRed, S.plasticBlue, S.plasticYellow][k % 3], 0.25 + (k % 4) * 0.17, 1.76 - Math.floor(k / 4) * 0.24, 0.035, 0, 0.007);
    f.box(S.paper, 0.55, 1.05, 0.03, 0.3, 0.38, 0.002, 0.04);
  }
  /* ---------- piso: marcas de fita (spike), faixas de fita gaffer, fosforescentes, cabos e canaletas ---------- */
  const tape = (x: number, z: number, ry: number, len: number, col: string, wdt = 0.05) => c.inst.add(room, "bk-tape", BOX0(), solid("bk-tapeMat", "#ffffff", { rough: 0.55 }), mat(x, 0.0015, z, ry, len, 0.0015, wdt), new THREE.Color(col));
  const spike = (x: number, z: number, col: string, kind: number) => { if (kind === 0) { tape(x, z, 0.785, 0.22, col); tape(x, z, -0.785, 0.22, col); } else if (kind === 1) { tape(x, z, 0, 0.24, col); tape(x, z + 0.07, Math.PI / 2, 0.14, col); } else { tape(x - 0.06, z, Math.PI / 2, 0.14, col); tape(x, z + 0.06, 0, 0.14, col); } };
  for (let k = 0; k < 16; k++) spike(13.4 + R() * 7.6, -5.2 + R() * 8.6, ["#ff3d8a", "#f2d21b", "#33d16a", "#2e9bff", "#ffffff"][k % 5], k % 3);
  // área livre diante da entrada de cena (contorno de gaffer branca) e as fitas fosforescentes nas quinas
  for (const z of [-3.0, -1.0]) tape(13.0, z, 0, 0.84, "#e8e8e2", 0.05);
  tape(13.42, -2.0, Math.PI / 2, 2.04, "#e8e8e2", 0.05);
  for (const [x, z] of [[12.62, -3.0], [13.42, -3.0], [12.62, -1.0], [13.42, -1.0], [13.42, -2.0]]) c.inst.add(room, "bk-glowTape", BOX0(), glow("bk-glowTapeMat", "#7dff9c", 1.5), mat(x, 0.002, z, 0, 0.06, 0.002, 0.06));
  // cabos no chão (da mesa da produção para a entrada de cena e para o camarim) presos com fita, e as canaletas
  const cable = (pts: number[][], r = 0.013) => c.batch.add(room, S.cable, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, r, z))), 60, r, 6, false));
  cable([[19.2, -4.6], [18.6, -3.8], [17.0, -3.4], [15.2, -3.2], [13.4, -2.6], [12.65, -2.2]]); cable([[19.6, -4.6], [20.2, -3.6], [20.3, -3.4]], 0.01); cable([[15.6, 1.8], [14.9, 1.0], [13.9, 0.9], [12.7, 1.0]], 0.011);
  for (const [x, z] of [[17.8, -3.55], [16.2, -3.3], [14.4, -2.95], [13.0, -2.4], [14.4, 0.95]] as [number, number][]) tape(x, z, (R() - 0.5) * 0.5 + Math.PI / 2, 0.16, "#151515", 0.05);
  for (const [x, z, ry] of [[15.8, -3.25, 0.12], [14.0, -2.75, 0.3]] as [number, number, number][]) {
    const f = Fr.at(c, room, x, 0, z, ry);
    f.g(S.rubber, geo("bk-rampGeo", () => { const s = new THREE.Shape(); s.moveTo(-0.3, 0); s.lineTo(-0.1, 0.05); s.lineTo(0.1, 0.05); s.lineTo(0.3, 0); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.9, bevelEnabled: false }).translate(0, 0, -0.45); }), 0, 0, 0, Math.PI / 2);
    f.box(S.plasticYellow, 0, 0.05, 0, 0.9, 0.003, 0.18, Math.PI / 2);
  }
  /* ---------- espelho de corpo inteiro e banqueta na troca rápida ---------- */
  {
    const f = Fr.at(c, room, 12.85, 0, 1.15, Math.PI / 2 - 0.25);
    f.rbox(S.steelBlack, 0, 0.05, 0, 0.62, 1.75, 0.04, 0.01); f.box(P.mirror, 0, 0.1, 0.021, 0.54, 1.65, 0.004);
    for (const s of [-1, 1]) f.box(S.steelBlack, s * 0.22, 0, -0.15, 0.03, 0.03, 0.4);
    const b = Fr.at(c, room, 13.25, 0, 2.15, 0.4);
    b.cyl(S.steelBlack, 0, 0, 0, 0.17, 0.02, 14); b.cyl(S.chrome, 0, 0.02, 0, 0.02, 0.45, 8); b.cyl(S.fabricBlack, 0, 0.47, 0, 0.17, 0.06, 18);
  }
  /* ---------- maleta de maquiagem aberta no chão (o esconderijo do camarim) ---------- */
  {
    const f = Fr.at(c, room, 19.9, 0, -1.5, 0.35);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.i("bk-caseWheel", CYL(10), S.rubber, sx * 0.17, 0.03, sz * 0.11, 0, 0.03, 0.02, 0.03, 0, Math.PI / 2);
    f.rbox(S.alu, 0, 0.04, 0, 0.42, 0.34, 0.28, 0.02);
    for (const s of [-1, 1]) { const t = f.sub(s * 0.1, 0.38, 0, 0, 0, s * 0.5); t.rbox(S.alu, s * 0.08, 0, 0, 0.2, 0.04, 0.26, 0.01); for (let k = 0; k < 4; k++) t.i("bk-trayItem", CYL0(8), solid("bk-trayItemMat", "#ffffff", { rough: 0.5 }), s * 0.08 - 0.06 + k * 0.04, 0.04, (k % 2 - 0.5) * 0.1, 0, 0.012, 0.03, 0.012, 0, 0, new THREE.Color(["#b0546a", "#2a2420", "#c98b6b", "#e3c0a0"][k])); }
    f.box(S.chrome, 0, 0.38, 0, 0.12, 0.02, 0.02);
    f.box(solid("bk-medkitRed", "#c4141c", { rough: 0.5 }), 0, 0.3, 0.0, 0.18, 0.06, 0.12); f.box(S.white, 0, 0.36, 0.0, 0.1, 0.002, 0.03); f.box(S.white, 0, 0.36, 0.0, 0.03, 0.002, 0.1);
  }
  beacon(c, room, 12.6, 3.8, 2.6, 1, 0);
  void B; void rbox;
}

/** Sombras das fontes principais (só "high"): refletores sobre o camarim, o ateliê e a mesa da chamada. */
const KEYS: KeyDef[] = [
  { p: [20.2, 3.7, -2.0], aim: [21.0, 0, -1.1], angle: 0.95, i: 34, color: "#ffe2bc" },
  { p: [14.0, 3.7, -3.6], aim: [14.0, 0, -4.6], angle: 1.0, i: 30, color: "#fff0d8" },
  { p: [16.2, 3.7, 1.6], aim: [16.0, 0, 1.8], angle: 1.05, i: 30, color: "#fff0d8" },
  { p: [18.0, 3.7, -2.0], aim: [18.0, 0, -2.5], angle: 1.05, i: 30, color: "#ffd9a6" },
];

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = {
  id: "bastidores", rooms: ["bastidores"], dress: bastidores,
  props: {
    desk: (p, c) => (p.variant === 4 ? vanity(p, c) : p.variant === 1 ? productionDesk(p, c) : callDesk(p, c)),
    mirror: vanityMirror, screen: monitorWall, steamer, mannequin, rack: garmentRack,
    fixture: bastidoresFixture,
  },
  surfaces: { bastidores: { floor: floorBk, floorTile: [2.44, 2.44], floorMirror: [0.3, 0.025], wall: wallBk, wallTile: [2.5, 4.6] } },
  keys: { bastidores: KEYS },
};
