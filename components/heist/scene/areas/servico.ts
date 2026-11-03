/*
 * MET Gala Heist v2 — Labirinto de serviço: circulação da equipe e a copa do bufê (Z10). O labirinto vem da semente
 * (lib/heist/level.ts) e não muda de forma; o cenário veste o que existe:
 *  - acabamentos: granilite cinza com juntas no corredor, cerâmica vermelha antiderrapante com ralos na copa; drywall com
 *    barra lavável e marcas de carrinho, azulejo branco até o forro nas zonas da copa; forro removível de 0,6 m (forro de
 *    PVC na copa) a 3,2 m, na altura das divisórias, sobre todo vão de piso;
 *  - proteção: para-choques de vinil nas paredes, cantoneiras de inox em toda quina saliente, rodapé de borracha;
 *  - instalações aparentes sob o forro: rede de sprinkler vermelha e eletrocalha com cabos seguindo o desenho do
 *    labirinto (com tirantes, luvas e curvas), luminárias estanques acesas célula a célula, sprinklers, detectores,
 *    câmeras, luzes de emergência;
 *  - segurança contra incêndio: extintores com placa e demarcação de piso, abrigo de hidrante, acionadores;
 *  - sinalização (atlas da área): somente funcionários, rotas (salão, doca, segurança), zonas da copa, proibições;
 *  - a copa nas pontas mortas (servico-copa.ts), a porta da câmara fria, a cortina de tiras da cozinha, os armários da
 *    equipe (o uniforme), o quadro de avisos e o que a equipe deixou pelo caminho.
 */
import * as THREE from "three";
import { INNER_WALLS, MAZE, mazeCell } from "@/lib/heist/level";
import { BOX0, CYL, QuadBuilder, SPH, geo, mat } from "../interior-batch";
import { solid } from "../interior-mats";
import { drawnTexture, rand, type Quality } from "../interior-tex";
import { type RoomsCtx, A, beacon } from "./kit";
import type { AreaModule, KeyDef } from "./types";
import { COPA_ZONES, Fr, SM, mazeInfo, once, pbrMat, rbox, sign, texCeilMineral, texCeilPvc, texDrywallSrv, texGranilite, texQuarry, texTileWhite, tube, zoneOf, type WFace } from "./servico-kit";
import { alarmPoint, cctvCam, cornerGuard, crashRail, emergencyLight, extinguisher, hoseCabinet, smokeDetector, sprinkler, vaporTight, wallClock } from "./servico-pecas";
import { copaFixture } from "./servico-copa";
import { H, faceZones, flatQuad, wallQuad } from "./servico-quads";
import { leftBehind, staffFixtures, wallServices } from "./servico-equipe";

/** A mesma piscada da fluorescente com defeito de interior-fx (flickerOf, salas frias), copiada para não criar import
 * circular (interior-fx → areas → servico): apaga duas vezes a cada ~7,8 s, na fase da posição da luminária. */
const tubeFlicker = (x: number, z: number, t: number) => { const c = (t * 0.9 + x * 3.1 + z * 1.7) % 7; return c < 0.12 || (c > 0.3 && c < 0.38) ? 0.15 : 1; };
const isSec = (c: number, r: number) => c <= 1 && r >= 4 && r <= 6;
/** Ligações abertas entre células do labirinto (sem a sala de segurança): leste e sul de cada célula. */
function mazeLinks() {
  const { x0, z0, cols, rows, cell } = MAZE;
  const covered = (x: number, z: number) => INNER_WALLS.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
  const E = (c: number, r: number) => c < cols - 1 && !isSec(c, r) && !isSec(c + 1, r) && !covered(x0 + c * cell + 1.75, z0 + r * cell + 0.75);
  const S = (c: number, r: number) => r < rows - 1 && !isSec(c, r) && !isSec(c, r + 1) && !covered(x0 + c * cell + 0.75, z0 + r * cell + 1.75);
  return { E, S, W: (c: number, r: number) => c > 0 && E(c - 1, r), N: (c: number, r: number) => r > 0 && S(c, r - 1) };
}

/* ---------- materiais das superfícies ---------- */
const floorSrv = (q: Quality) => pbrMat(`srv-floor-granilite-${q}`, texGranilite(q), { vertex: true, env: 0.6 });
const wallSrv = (q: Quality) => pbrMat(`srv-wall-drywall-${q}`, texDrywallSrv(q), { vertex: true, env: 0.3 });
/** Zebrado amarelo e preto pintado no piso (faixas a 45°, 0,5 m por repetição). */
const hatchMat = () => once("srv-hatchMat", () => {
  const t = drawnTexture("srv-hatch", 128, 128, (g, w, h) => { g.fillStyle = "#e2b11e"; g.fillRect(0, 0, w, h); g.fillStyle = "#151515"; for (let k = -2; k < 4; k++) { g.beginPath(); g.moveTo(k * w / 2, h); g.lineTo(k * w / 2 + w / 4, h); g.lineTo(k * w / 2 + w / 4 + w / 2, 0); g.lineTo(k * w / 2 + w / 2, 0); g.fill(); } });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.72, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
});


function servico(c: RoomsCtx) {
  const S = SM(c.q), room = "servico", info = mazeInfo(), L = mazeLinks(), R = rand(401);
  /* ---------- forro a 3,2 m (mineral no corredor, PVC na copa) e cerâmica da copa ---------- */
  const ceilMin = new QuadBuilder(), ceilPvc = new QuadBuilder(), quarry = new QuadBuilder();
  for (const r of info.floors) {
    if (r.room !== "servico") continue;
    const copa = r.zone !== "corredor";
    flatQuad(copa ? ceilPvc : ceilMin, r.x0, r.z0, r.x1, r.z1, H, false, 1.2, copa);
    if (copa) flatQuad(quarry, r.x0, r.z0, r.x1, r.z1, 0.002, true, 0.6);
  }
  // o forro é iluminado por difusão (emissivo com o próprio mapa) e não pelas luzes pontuais: a 30 cm das luminárias ele
  // estouraria e, no "high", o bloom e a sonda da sala espalhariam esse branco pelas paredes
  c.batch.add(room, pbrMat(`srv-ceil-mineral-${c.q}`, texCeilMineral(c.q), { tint: "#000000", env: 0.15, bounce: 0.72 }), ceilMin.geometry());
  c.batch.add(room, pbrMat(`srv-ceil-pvc-${c.q}`, texCeilPvc(c.q), { tint: "#000000", env: 0.15, bounce: 0.78 }), ceilPvc.geometry());
  c.batch.add(room, pbrMat(`srv-floor-ceramica-${c.q}`, texQuarry(c.q), { env: 0.45, offset: true }), quarry.geometry(), undefined, { receive: true });
  /* ---------- azulejo até o forro nas zonas da copa; para-choques no corredor; cantoneiras ---------- */
  const tiles = new QuadBuilder();
  const lockerZone = (f: WFace, a: number, b: number) => f.axis === "x" && Math.abs(f.plane + 12.5) < 0.01 && b > -0.4 && a < 1.4;
  // o para-choque se interrompe nos extintores e no hidrante (eles ficam presos na parede, na mesma altura)
  const gear: [number, number, number][] = [[-12.5, 12.8, 0.3], [-18.85, -4.5, 0.3], [-16.5, 6.75, 0.3], [-21.2, 16, 0.3], [-17.25, 14, 0.5]];
  const cut = (f: WFace, a: number, b: number): [number, number][] => {
    let out: [number, number][] = [[a, b]];
    for (const [gx, gz, r] of gear) {
      const onPlane = f.axis === "x" ? Math.abs(f.plane - gx) < 0.02 : Math.abs(f.plane - gz) < 0.02, at = f.axis === "x" ? gz : gx;
      if (!onPlane) continue;
      out = out.flatMap(([p, q]): [number, number][] => (at + r <= p || at - r >= q ? [[p, q]] : [[p, at - r], [at + r, q]]));
    }
    return out.filter(([p, q]) => q - p > 0.3);
  };
  for (const f of info.faces) {
    if (f.room !== "servico") continue;
    for (const s of faceZones(f)) {
      if (s.zone !== "corredor") wallQuad(tiles, f, s.a, s.b, 0, H, 0.004, 0.6, 0.6);
      else if (!lockerZone(f, s.a, s.b)) for (const [p, q] of cut(f, s.a, s.b)) crashRail(c, { ...f, a: p, b: q }, 0.95);
    }
  }
  c.batch.add(room, pbrMat(`srv-wall-azulejo-${c.q}`, texTileWhite(c.q), { env: 0.45 }), tiles.geometry(), undefined, { receive: true });
  for (const k of info.corners) if (k.room === "servico" && zoneOf(k.x + k.sx * 0.3, k.z + k.sz * 0.3) === "corredor") cornerGuard(c, k);
  // ralos de inox no centro das células da copa (grelha com furos e a moldura)
  for (const cells of Object.values(COPA_ZONES)) for (const [cc, rr] of cells) {
    const p = mazeCell(cc, rr), f = Fr.at(c, room, p.x + 0.2, 0, p.z + 0.25);
    f.box(S.inox, 0, 0.002, 0, 0.2, 0.004, 0.2); f.box(S.steelBlack, 0, 0.0035, 0, 0.16, 0.002, 0.16);
    for (let k = 0; k < 7; k++) f.i("srv-drainSlot", BOX0(), S.inoxDark, -0.06 + k * 0.02, 0.004, 0, 0, 0.008, 0.002, 0.13);
  }
  /* ---------- instalações aparentes: sprinkler (vermelha) e eletrocalha seguindo o labirinto ---------- */
  const node = (cc: number, rr: number, o: number) => { const p = mazeCell(cc, rr); return new THREE.Vector3(p.x + o, 0, p.z + o); };
  const segs: [THREE.Vector3, THREE.Vector3][] = [];
  for (let cc = 0; cc < MAZE.cols; cc++) for (let rr = 0; rr < MAZE.rows; rr++) {
    if (isSec(cc, rr)) continue;
    if (L.E(cc, rr)) segs.push([new THREE.Vector3(cc, 0, rr), new THREE.Vector3(cc + 1, 0, rr)]);
    if (L.S(cc, rr)) segs.push([new THREE.Vector3(cc, 0, rr), new THREE.Vector3(cc, 0, rr + 1)]);
  }
  const pipeY = 3.0, trayY = 2.93;
  for (const [a, b] of segs) {
    const pa = node(a.x, a.z, 0.45), pb = node(b.x, b.z, 0.45), len = pa.distanceTo(pb), alongX = Math.abs(pb.x - pa.x) > 0.1, mid = pa.clone().lerp(pb, 0.5);
    c.batch.add(room, S.pipeRed, CYL(12), mat(mid.x, pipeY, mid.z, alongX ? Math.PI / 2 : 0, 0.03, len, 0.03, Math.PI / 2, 0));
    for (const t of [0.25, 0.75]) { const q = pa.clone().lerp(pb, t); c.inst.add(room, "srv-hangRod", CYL(6), S.galv, mat(q.x, (pipeY + H) / 2, q.z, 0, 0.005, H - pipeY, 0.005)); c.inst.add(room, "srv-clevis", geo("srv-clevisGeo", () => new THREE.TorusGeometry(0.036, 0.005, 5, 14)), S.galv, mat(q.x, pipeY, q.z, alongX ? Math.PI / 2 : 0)); }
    for (const t of [0.04, 0.96]) { const q = pa.clone().lerp(pb, t); c.inst.add(room, "srv-coupling", CYL(12), S.steelBlack, mat(q.x, pipeY, q.z, alongX ? Math.PI / 2 : 0, 0.037, 0.05, 0.037, Math.PI / 2, 0)); }
    // eletrocalha perfurada (do outro lado do corredor), com os cabos e o tirante em trapézio
    const ta = node(a.x, a.z, -0.45), tb = node(b.x, b.z, -0.45), tl = ta.distanceTo(tb), tm = ta.clone().lerp(tb, 0.5), ry = alongX ? 0 : Math.PI / 2;
    const tr = Fr.at(c, room, tm.x, trayY, tm.z, ry);
    tr.box(S.galv, 0, 0, 0, tl + 0.25, 0.004, 0.25); for (const s of [-1, 1]) tr.box(S.galv, 0, 0, s * 0.123, tl + 0.25, 0.055, 0.004);
    tr.cylX(S.cable, 0, 0.022, -0.05, 0.016, tl + 0.25, 8); tr.cylX(S.cableGrey, 0, 0.02, 0.0, 0.013, tl + 0.25, 8); tr.cylX(S.cable, 0, 0.018, 0.055, 0.011, tl + 0.25, 8);
    for (const t of [-0.5, 0.5]) { tr.i("srv-trayBar", BOX0(), S.galv, t * tl * 0.6, -0.03, 0, 0, 0.03, 0.03, 0.34); for (const s of [-1, 1]) tr.i("srv-hangRod", CYL(6), S.galv, t * tl * 0.6, (H - trayY) / 2 - 0.03, s * 0.16, 0, 0.005, H - trayY + 0.03, 0.005); }
  }
  // curvas e tês: uma conexão em cada nó com duas ou mais ligações, e a ponta tampada nos nós de uma só
  for (let cc = 0; cc < MAZE.cols; cc++) for (let rr = 0; rr < MAZE.rows; rr++) {
    if (isSec(cc, rr)) continue;
    const deg = [L.E(cc, rr), L.S(cc, rr), L.W(cc, rr), L.N(cc, rr)].filter(Boolean).length; if (!deg) continue;
    const p = node(cc, rr, 0.45);
    c.inst.add(room, "srv-elbow", SPH(12), S.pipeRed, mat(p.x, pipeY, p.z, 0, 0.042));
    const t = node(cc, rr, -0.45); c.inst.add(room, "srv-trayNode", BOX0(), S.galv, mat(t.x, trayY - 0.002, t.z, 0, 0.27, 0.006, 0.27));
  }
  /* ---------- luminárias estanques, sprinklers e detectores no forro ---------- */
  let k = 0;
  for (let cc = 0; cc < MAZE.cols; cc++) for (let rr = 0; rr < MAZE.rows; rr++) {
    if (isSec(cc, rr)) continue;
    const p = mazeCell(cc, rr), ew = L.E(cc, rr) || L.W(cc, rr), ns = L.N(cc, rr) || L.S(cc, rr), alongX = ew && !ns ? true : ns && !ew ? false : (cc + rr) % 2 === 0;
    const zone = zoneOf(p.x, p.z), copa = zone !== "corredor", z = rr === MAZE.rows - 1 ? p.z + 0.1 : p.z;
    // duas lâmpadas com defeito: a luz e o próprio tubo piscam juntos (a mesma conta de interior-fx)
    const flick = (cc === 0 && rr === 9) || (cc === 4 && rr === 1);
    const diff = flick ? solid(`srv-opalFlick-${cc}-${rr}`, "#f4f7fb", { rough: 0.3, emissive: "#eef4ff", emissiveIntensity: 1.6 }) : undefined;
    vaporTight(c, room, p.x, H, z, alongX, copa, diff);
    A(c, room, p.x, H - 0.65, z, copa ? "#fff0d6" : "#e4eeff", copa ? 3.8 : 3.4, 5, { flicker: flick ? 1 : 0 });
    if (diff) c.ticks.push({ room, tick: (t) => { diff.emissiveIntensity = 1.6 * tubeFlicker(p.x, z, t); } });
    const px = alongX ? 0 : 0.3, pz = alongX ? 0.3 : 0;
    sprinkler(c, room, p.x + px, H, z + pz);
    if ((cc + rr + k++) % 3 === 0) smokeDetector(c, room, p.x - (alongX ? 0 : 0.22), H, z - (alongX ? 0.22 : 0));
  }
  staffFixtures(c, S, R);
  /* ---------- segurança contra incêndio, emergência, câmeras ---------- */
  extinguisher(c, room, -12.5, 12.8, -Math.PI / 2);                              // perto da porta da equipe
  extinguisher(c, room, -18.85, -4.5, Math.PI, false);                           // ao lado do fogão (classe K)
  extinguisher(c, room, -16.5, 6.75, -Math.PI / 2);                              // corredor da segurança
  extinguisher(c, room, -21.2, 16, Math.PI);                                     // corredor principal, junto da doca
  hoseCabinet(c, room, -17.25, 14, 0);
  alarmPoint(c, room, -17.6, 16, Math.PI); alarmPoint(c, room, -14, 10.85, Math.PI / 2);
  for (const [x, y, z, ry] of [[-17.9, 2.95, 15.99, Math.PI], [-12.51, 2.9, 12.2, -Math.PI / 2], [-16.49, 2.9, 4.4, -Math.PI / 2], [-21.99, 2.9, -1.3, Math.PI / 2], [-12.51, 2.9, -3.25, -Math.PI / 2]] as [number, number, number, number][]) emergencyLight(c, room, x, y, z, ry);
  cctvCam(c, room, -12.52, 2.95, 15.6, -Math.PI / 2, -Math.PI / 2 - 0.15);       // corredor principal, olhando para oeste
  cctvCam(c, room, -16.52, 2.95, 7.3, -Math.PI / 2, Math.PI + 0.1);              // corredor da segurança, olhando para a porta
  cctvCam(c, room, -21.98, 2.95, 13.6, Math.PI / 2, Math.PI / 2 - 0.4);          // canto sudoeste
  cctvCam(c, room, -12.52, 2.95, -5.7, -Math.PI / 2, 0.2);                       // ponta norte, perto do duto
  /* ---------- sinalização: rotas, zonas da copa, saídas ---------- */
  sign(c, room, "exit", -19, 2.78, 15.99, Math.PI, 0.22, { lit: true });
  sign(c, room, "toHall", -12.505, 2.82, 10, -Math.PI / 2, 0.18);
  sign(c, room, "staffOnly", -12.505, 1.75, 11.42, -Math.PI / 2, 0.15);
  sign(c, room, "copa", -13.25, 2.55, 6.005, 0, 0.18);
  sign(c, room, "toSec", -18.0 + 0.005, 2.84, 4.75, Math.PI / 2, 0.14);
  sign(c, room, "restricted", -18.0 + 0.005, 2.68, 4.75, Math.PI / 2, 0.12);
  sign(c, room, "dish", -14.505, 2.45, 0.75, -Math.PI / 2, 0.17);
  sign(c, room, "bar", -15.25, 2.5, 10.005, 0, 0.17);
  sign(c, room, "keepClear", -19.25, 1.5, 14.005, 0, 0.16);
  // rota até a doca: placa e seta (a seta gira no plano da placa para apontar o sentido do corredor)
  for (const [x, z, ry, rot] of [[-17.995, 2.75, Math.PI / 2, Math.PI], [-14.005, 12.75, Math.PI / 2, Math.PI]] as [number, number, number, number][]) {
    sign(c, room, "toDock", x, 2.4, z, ry, 0.15); sign(c, room, "arrow", x, 2.1, z, ry, 0.17, { rot });
  }
  /* ---------- piso: zebrados diante das portas e setas da rota de fuga ---------- */
  {
    const hb = new QuadBuilder();
    flatQuad(hb, -20, 15.3, -18, 16, 0.003, true, 0.5); flatQuad(hb, -13.2, 9, -12.5, 11, 0.003, true, 0.5); flatQuad(hb, -17.9, 4, -17.4, 5.5, 0.003, true, 0.5);
    c.batch.add(room, hatchMat(), hb.geometry(), undefined, { receive: true });
    const arrow = geo("srv-floorArrow", () => { const s = new THREE.Shape(); s.moveTo(-0.07, -0.25); s.lineTo(0.07, -0.25); s.lineTo(0.07, 0.05); s.lineTo(0.16, 0.05); s.lineTo(0, 0.25); s.lineTo(-0.16, 0.05); s.lineTo(-0.07, 0.05); s.closePath(); return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2); });
    for (const [x, z, ry] of [[-13.25, 12.3, 0], [-14.6, 14.85, -Math.PI / 2], [-16.6, 14.85, -Math.PI / 2], [-21.25, 11.75, 0]] as [number, number, number][]) c.batch.add(room, S.paintYellow, arrow, mat(x, 0.0035, z, ry + Math.PI));
  }
  /* ---------- o que a equipe deixou pelo caminho ---------- */
  leftBehind(c, S, R);
  /* ---------- cabos e conduítes de parede: quadro elétrico do corredor e eletrodutos subindo ---------- */
  wallServices(c, S, info);
  /* ---------- placas de mão e avisos da copa ---------- */
  sign(c, room, "orders", -15.25, 1.6, 7.495, Math.PI, 0.42);
  wallClock(c, room, -14.505, 2.25, 6.75, -Math.PI / 2, 11, 7);
  // giroflex do alarme (os de antes)
  beacon(c, room, -21.9, 3.0, 9.2, 1, 0); beacon(c, room, -12.6, 3.0, -2.6, -1, 0);
  void tube; void rbox;
}

/** Sombras das luzes principais (só no "high"): copa, cozinha, corredor principal e a porta da equipe. */
const KEYS: KeyDef[] = [
  { p: [-19.25, 3.0, -4.7], aim: [-19.25, 0, -5.2], angle: 0.95, i: 11, color: "#ffe9cc" },
  { p: [-15.0, 3.0, 6.8], aim: [-15.4, 0, 6.8], angle: 0.95, i: 11, color: "#fff0dc" },
  { p: [-15.25, 3.0, 10.9], aim: [-15.25, 0, 10.6], angle: 0.95, i: 11, color: "#fff0dc" },
  { p: [-15.6, 3.0, 0.75], aim: [-15.2, 0, 0.75], angle: 0.95, i: 11, color: "#f2f6ff" },
  { p: [-17.25, 3.0, -2.25], aim: [-17.0, 0, -2.25], angle: 0.95, i: 11, color: "#fff0dc" },
  { p: [-21.25, 3.0, -2.6], aim: [-21.4, 0, -2.6], angle: 0.95, i: 11, color: "#fff0dc" },
  { p: [-19.25, 3.0, 0.75], aim: [-19.0, 0, 0.75], angle: 0.95, i: 11, color: "#fff0dc" },
  { p: [-13.25, 3.0, 9.75], aim: [-13.25, 0, 9.75], angle: 0.95, i: 11, color: "#e8f0ff" },
  { p: [-17.25, 3.0, 15.0], aim: [-17.25, 0, 15.0], angle: 0.95, i: 11, color: "#e8f0ff" },
  { p: [-17.25, 3.0, 4.75], aim: [-17.25, 0, 4.75], angle: 0.95, i: 11, color: "#e8f0ff" },
];

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = {
  id: "servico", rooms: ["servico"], dress: servico,
  props: { fixture: (p, c) => { copaFixture(p, c); } },
  surfaces: { servico: { floor: floorSrv, floorTile: [2, 2], floorMirror: [0.32, 0.03], wall: wallSrv, wallTile: [3, 3.6], ceil: null } },
  keys: { servico: KEYS },
};
