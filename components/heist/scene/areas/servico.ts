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
import { glow, solid } from "../interior-mats";
import { drawnTexture, rand, type Quality } from "../interior-tex";
import { type RoomsCtx, A, beacon } from "./kit";
import type { AreaModule, KeyDef } from "./types";
import { COPA_ZONES, Fr, SM, mazeInfo, once, pbrMat, rbox, sign, signOn, texCeilMineral, texCeilPvc, texDrywallSrv, texGranilite, texQuarry, texTileWhite, tube, zoneOf, type WFace } from "./servico-kit";
import { alarmPoint, cctvCam, cornerGuard, crashRail, emergencyLight, extinguisher, hoseCabinet, pedalBin, smokeDetector, sprinkler, stripCurtain, vaporTight, wallClock, wetFloorSign } from "./servico-pecas";
import { copaFixture } from "./servico-copa";

const H = 3.2;                                                                   // forro = topo das divisórias
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
const floorSrv = (q: Quality) => pbrMat(`srv-floor-granilite-${q}`, texGranilite(q), { vertex: true, env: 0.9 });
const wallSrv = (q: Quality) => pbrMat(`srv-wall-drywall-${q}`, texDrywallSrv(q), { vertex: true, env: 0.5 });
/** Zebrado amarelo e preto pintado no piso (faixas a 45°, 0,5 m por repetição). */
const hatchMat = () => once("srv-hatchMat", () => {
  const t = drawnTexture("srv-hatch", 128, 128, (g, w, h) => { g.fillStyle = "#e2b11e"; g.fillRect(0, 0, w, h); g.fillStyle = "#151515"; for (let k = -2; k < 4; k++) { g.beginPath(); g.moveTo(k * w / 2, h); g.lineTo(k * w / 2 + w / 4, h); g.lineTo(k * w / 2 + w / 4 + w / 2, 0); g.lineTo(k * w / 2 + w / 2, 0); g.fill(); } });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.72, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
});

/** Quad horizontal (piso ou forro) com UV no mundo (`tu` m por repetição). */
function flatQuad(b: QuadBuilder, x0: number, z0: number, x1: number, z1: number, y: number, up: boolean, tu: number, rot = false) {
  const uv = (x: number, z: number) => (rot ? [z / tu, x / tu] : [x / tu, z / tu]);
  if (up) b.quad([[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [0, 1, 0], [uv(x0, -z1), uv(x1, -z1), uv(x1, -z0), uv(x0, -z0)]);
  else b.quad([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [0, -1, 0], [uv(x0, z0), uv(x1, z0), uv(x1, z1), uv(x0, z1)]);
}
/** Quad vertical colado na face da parede (afastado `off`), de y0 a y1, UV no mundo. */
function wallQuad(b: QuadBuilder, f: { axis: "x" | "z"; plane: number; dir: number }, a: number, c: number, y0: number, y1: number, off: number, tu: number, tv: number) {
  if (f.axis === "x") {
    const x = f.plane + f.dir * off, n = [f.dir, 0, 0];
    const p = f.dir > 0 ? [[x, y0, c], [x, y0, a], [x, y1, a], [x, y1, c]] : [[x, y0, a], [x, y0, c], [x, y1, c], [x, y1, a]];
    b.quad(p, n, p.map((v) => [v[2] / tu, v[1] / tv]));
  } else {
    const z = f.plane + f.dir * off, n = [0, 0, f.dir];
    const p = f.dir > 0 ? [[a, y0, z], [c, y0, z], [c, y1, z], [a, y1, z]] : [[c, y0, z], [a, y0, z], [a, y1, z], [c, y1, z]];
    b.quad(p, n, p.map((v) => [v[0] / tu, v[1] / tv]));
  }
}
/** Divide a face em trechos de 0,5 m pela zona do piso em frente (copa x corredor). */
function faceZones(f: WFace): { a: number; b: number; zone: string }[] {
  const out: { a: number; b: number; zone: string }[] = [];
  for (let s = f.a; s < f.b - 1e-6; s += 0.5) {
    const m = s + 0.25, x = f.axis === "x" ? f.plane + f.dir * 0.25 : m, z = f.axis === "x" ? m : f.plane + f.dir * 0.25, zone = zoneOf(x, z), last = out[out.length - 1];
    if (last && last.zone === zone && Math.abs(last.b - s) < 1e-6) last.b = s + 0.5; else out.push({ a: s, b: s + 0.5, zone });
  }
  return out;
}

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
  c.batch.add(room, pbrMat(`srv-ceil-mineral-${c.q}`, texCeilMineral(c.q), { env: 0.6, bounce: 0.3 }), ceilMin.geometry());
  c.batch.add(room, pbrMat(`srv-ceil-pvc-${c.q}`, texCeilPvc(c.q), { env: 0.8, bounce: 0.32 }), ceilPvc.geometry());
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
  c.batch.add(room, pbrMat(`srv-wall-azulejo-${c.q}`, texTileWhite(c.q), { env: 0.9 }), tiles.geometry(), undefined, { receive: true });
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
    A(c, room, p.x, H - 0.3, z, copa ? "#fff0d6" : "#e4eeff", copa ? 6 : 5.2, 4.6, { flicker: flick ? 1 : 0 });
    if (diff) c.ticks.push({ room, tick: (t) => { diff.emissiveIntensity = 1.6 * tubeFlicker(p.x, z, t); } });
    const px = alongX ? 0 : 0.3, pz = alongX ? 0.3 : 0;
    sprinkler(c, room, p.x + px, H, z + pz);
    if ((cc + rr + k++) % 3 === 0) smokeDetector(c, room, p.x - (alongX ? 0 : 0.22), H, z - (alongX ? 0.22 : 0));
  }
  /* ---------- porta da câmara fria na parede do prédio (oeste) ---------- */
  {
    const f = Fr.at(c, room, -22, 0, -3.25, Math.PI / 2);
    f.box(S.inox, 0, 0, 0.03, 1.36, 2.32, 0.06);                                  // marco de inox
    f.rbox(S.plasticWhite, 0.02, 0.06, 0.11, 1.08, 2.08, 0.12, 0.02, 0, true);    // folha isolada (PU)
    f.box(S.rubberGrey, 0.02, 0.06, 0.055, 1.12, 2.12, 0.01);
    f.box(S.inox, 0.02, 0.06, 0.172, 1.0, 0.3, 0.004);                            // chapa de chute
    for (const y of [0.35, 1.8]) { f.rbox(S.chrome, -0.52, y, 0.13, 0.08, 0.2, 0.08, 0.015); f.cylZ(S.chrome, -0.5, y + 0.1, 0.18, 0.012, 0.06, 8); }
    f.rbox(S.chrome, 0.42, 1.0, 0.18, 0.1, 0.22, 0.07, 0.015); f.box(S.chrome, 0.3, 1.08, 0.22, 0.28, 0.035, 0.03, -0.12);
    f.box(S.steelBlack, 0.0, 2.2, 0.075, 0.24, 0.1, 0.03); f.box(glow("srv-tempRed", "#ff3a2a", 2.2), 0.0, 2.225, 0.091, 0.16, 0.05, 0.002);
    signOn(c, f, "cold", 0.02, 1.62, 0.172, 0.18);
    signOn(c, f, "temp", 0.3, 1.32, 0.172, 0.14, { depth: 0.0015 });
  }
  /* ---------- cortina de tiras na entrada da cozinha, com a sanca de drywall e as placas ---------- */
  {
    const z = -0.25;
    c.batch.add(room, solid("srv-header", "#d9d6cf", { rough: 0.85 }), BOX0(), mat(-17.25, 2.45, z, 0, 1.5, H - 2.45, 0.5));
    stripCurtain(c, room, -17.25, z + 0.24, 0, 1.5, 2.45);
    sign(c, room, "kitchen", -17.25, 2.82, z + 0.251, 0, 0.2);
    sign(c, room, "hairnet", -17.98, 1.62, 0.6, Math.PI / 2, 0.36);
    sign(c, room, "noSmoking", -17.98, 1.62, 1.12, Math.PI / 2, 0.36);
  }
  /* ---------- armários da equipe (o uniforme): quatro portas com veneziana, número, cadeado; a 3 entreaberta ---------- */
  {
    const f = Fr.at(c, room, -12.5, 0, 0.48, -Math.PI / 2), lw = 0.35;
    f.box(S.paintGrey, 0, 0, 0.02, 4 * lw + 0.02, 0.08, 0.3);
    for (let i = 0; i < 4; i++) {
      const x = -1.5 * lw + i * lw, open = i === 2;
      f.box(S.paintGrey, x, 0.08, 0.16, lw - 0.006, 1.84, 0.32 - 0.02);
      const d = open ? f.sub(x - lw / 2 + 0.01, 0, 0.31, -1.1) : f.sub(x - lw / 2 + 0.01, 0, 0.31);
      d.box(S.paintGrey, lw / 2 - 0.01, 0.1, 0.0, lw - 0.016, 1.8, 0.018);
      for (let s = 0; s < 5; s++) { d.i("srv-louver", BOX0(), S.steelBlack, lw / 2 - 0.01, 1.55 + s * 0.035, 0.012, 0, lw * 0.6, 0.012, 0.004); d.i("srv-louver", BOX0(), S.steelBlack, lw / 2 - 0.01, 0.22 + s * 0.035, 0.012, 0, lw * 0.6, 0.012, 0.004); }
      d.box(S.chrome, lw - 0.06, 0.95, 0.014, 0.03, 0.12, 0.02);
      d.box(S.paper, lw / 2 - 0.01, 1.42, 0.011, 0.08, 0.04, 0.002);
      if (!open) { d.g(S.brass, geo("srv-padlock", () => new THREE.TorusGeometry(0.014, 0.003, 4, 10, Math.PI)), lw - 0.06, 1.07, 0.03); d.box(S.brass, lw - 0.06, 1.035, 0.03, 0.03, 0.035, 0.012); }
      if (open) {
        // dentro: o dólmã branco no cabide, avental e o boné da equipe na prateleira
        f.box(S.paintGrey, x, 1.62, 0.16, lw - 0.03, 0.012, 0.28);
        f.cylX(S.chrome, x, 1.55, 0.16, 0.006, lw - 0.04, 6);
        f.g(solid("srv-uniform", "#efeee8", { rough: 0.9 }), geo("srv-jacket", () => new THREE.CapsuleGeometry(0.12, 0.42, 4, 10).scale(1, 1, 0.45)), x, 1.18, 0.16);
        f.g(S.plasticBlack, rbox(0.16, 0.06, 0.2, 0.03), x, 1.63, 0.15);
      }
    }
  }
  /* ---------- quadro de avisos de cortiça ao lado dos armários e o relógio ---------- */
  {
    const f = Fr.at(c, room, -12.5, 0, 2.75, -Math.PI / 2);
    f.box(S.wood, 0, 1.15, 0.01, 0.9, 0.62, 0.02); f.box(S.cork, 0, 1.18, 0.022, 0.84, 0.56, 0.006);
    for (let i = 0; i < 7; i++) f.i("srv-note", BOX0(), solid("srv-noteMat", "#ffffff", { rough: 0.9 }), -0.32 + (i % 4) * 0.21 + (R() - 0.5) * 0.04, 1.27 + Math.floor(i / 4) * -0.22 + (R() - 0.5) * 0.04, 0.026, (R() - 0.5) * 0.12, 0.15, 0.2, 0.002, 0, 0, new THREE.Color(["#f4f2ea", "#fff3a6", "#ffd3e0", "#f4f2ea", "#cfe6ff"][i % 5]));
    signOn(c, f, "duty", 0.2, 1.38, 0.03, 0.2, { depth: 0.001 });
    wallClock(c, room, -12.52, 2.45, 2.75, -Math.PI / 2, 11, 2);
  }
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
  pedalBin(c, room, -15.84, 1.32, Math.PI / 2); pedalBin(c, room, -14.7, 11.3, Math.PI);
  wetFloorSign(c, room, -16.2, 0.3, 0.4);
  // caixa de ferramentas da manutenção (esconderijo do labirinto): aberta, com as ferramentas
  {
    const f = Fr.at(c, room, -21.25, 0, -5.25, 0.5);
    f.rbox(S.paintRed, 0, 0, 0, 0.48, 0.2, 0.22, 0.01);
    f.box(S.paintRed, 0, 0.2, -0.12, 0.48, 0.2, 0.012, 0, false);
    f.box(S.steelBlack, 0, 0.12, 0, 0.44, 0.06, 0.2);
    f.box(S.paintYellow, -0.1, 0.18, 0.02, 0.16, 0.025, 0.04, 0.3); f.box(S.chrome, 0.08, 0.19, -0.03, 0.2, 0.012, 0.02, -0.4); f.box(S.plasticBlue, 0.12, 0.185, 0.05, 0.14, 0.02, 0.03, 0.2);
    f.cylX(S.chrome, 0, 0.24, 0, 0.008, 0.3, 6);
    f.rbox(S.cardboard, 0.5, 0, 0.05, 0.4, 0.3, 0.3, 0.01, 0.3);
  }
  // engradados vazios empilhados no canto da ponta norte (o segurança para no meio dela)
  {
    const f = Fr.at(c, room, -12.76, 0, -5.72, Math.PI / 2);
    for (let i = 0; i < 4; i++) { f.rbox(S.plasticGreen, 0, i * 0.27, 0, 0.5, 0.26, 0.34, 0.02, (R() - 0.5) * 0.08); f.box(S.plasticBlack, 0, i * 0.27 + 0.18, 0.171, 0.14, 0.04, 0.004); }
  }
  // balde espremedor com o esfregão na ponta morta da lavagem
  {
    const f = Fr.at(c, room, -15.84, 0, 0.18, 0.3);
    f.rbox(S.plasticYellow, 0, 0.06, 0, 0.42, 0.28, 0.3, 0.04); for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.i("srv-casterS", CYL(10), S.plasticBlack, sx * 0.17, 0.03, sz * 0.11, 0, 0.03, 0.025, 0.03, 0, Math.PI / 2);
    f.box(solid("srv-mopWater", "#6d7f86", { rough: 0.05, env: 1.2 }), -0.06, 0.3, 0, 0.26, 0.004, 0.24);
    f.rbox(S.plasticGrey, 0.13, 0.32, 0, 0.14, 0.2, 0.26, 0.02);
    f.g(S.alu, CYL(8), 0.0, 0.85, -0.05, 0, 0.012, 1.25, 0.012, 0.2, 0.08);
    f.g(S.white, geo("srv-mopHead", () => new THREE.ConeGeometry(0.1, 0.22, 10, 1, true)), -0.02, 0.32, -0.04, 0, 1, 1, 1, Math.PI, 0);
  }
  /* ---------- cabos e conduítes de parede: quadro elétrico do corredor e eletrodutos subindo ---------- */
  {
    const f = Fr.at(c, room, -20.5, 0, 10.6, -Math.PI / 2);
    f.rbox(S.paintCream, 0, 1.3, 0.06, 0.5, 0.7, 0.12, 0.01); f.box(S.paintCream, 0, 1.33, 0.122, 0.46, 0.64, 0.006); f.box(S.chrome, 0.18, 1.6, 0.13, 0.02, 0.08, 0.02);
    signOn(c, f, "highVoltage", 0, 1.86, 0.004, 0.12);
    for (const x of [-0.15, 0, 0.15]) f.cyl(S.galv, x, 2.0, 0.03, 0.013, H - 2.0, 8);
  }
  /* ---------- miudezas de prédio: tomadas e interruptores, tubos de queda, alçapão e manchas de infiltração no forro ---------- */
  {
    let n = 0;
    for (const f of info.faces) {
      if (f.room !== "servico" || f.b - f.a < 1.4 || n++ % 3) continue;
      const mid = (f.a + f.b) / 2 + 0.3, ry = f.axis === "x" ? (f.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : f.dir > 0 ? 0 : Math.PI;
      const o = Fr.at(c, room, f.axis === "x" ? f.plane : mid, 0.3, f.axis === "x" ? mid : f.plane, ry);
      o.i("srv-outlet", rbox(0.08, 0.12, 0.008, 0.004), S.plasticWhite, 0, 0, 0.004); for (const y of [0.03, 0.08]) o.i("srv-socket", CYL(10), S.plasticGrey, 0, y, 0.01, 0, 0.016, 0.004, 0.016, Math.PI / 2, 0);
    }
    for (const [x, z, ry] of [[-17.995, 0.25, Math.PI / 2], [-12.505, 8.3, -Math.PI / 2], [-18.005, 3.75, Math.PI / 2], [-14.005, 7.0, Math.PI / 2]] as [number, number, number][]) {
      const o = Fr.at(c, room, x, 1.1, z, ry); o.rbox(S.plasticWhite, 0, 0, 0.004, 0.08, 0.12, 0.008, 0.004); o.box(S.plasticGrey, 0, 0.045, 0.01, 0.025, 0.03, 0.006);
    }
    for (const [x, z] of [[-21.93, 14.07], [-12.57, 2.07]]) {
      c.batch.add(room, S.vinylGrey, CYL(14), mat(x, H / 2, z, 0, 0.05, H, 0.05));
      for (const y of [0.6, 1.6, 2.6]) c.inst.add(room, "srv-pipeClamp", geo("srv-pipeClampGeo", () => new THREE.TorusGeometry(0.055, 0.008, 5, 16).rotateX(Math.PI / 2)), S.galv, mat(x, y, z));
    }
    const hatch = Fr.at(c, room, -17.25, H, 12.75);
    hatch.box(S.alu, 0, -0.012, 0, 0.64, 0.012, 0.64); hatch.box(S.paintWhite, 0, -0.016, 0, 0.58, 0.006, 0.58); hatch.box(S.steelBlack, 0.22, -0.026, 0, 0.06, 0.012, 0.03);
    const stain = once("srv-stainMat2", () => new THREE.MeshStandardMaterial({ color: "#a08454", opacity: 0.55, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      alphaMap: drawnTexture("srv-stain", 128, 128, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); r.addColorStop(0, "rgba(255,255,255,0.35)"); r.addColorStop(0.75, "rgba(255,255,255,0.25)"); r.addColorStop(0.86, "rgba(255,255,255,0.75)"); r.addColorStop(0.9, "rgba(255,255,255,0.1)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.48, h * 0.4, 0.4, 0, Math.PI * 2); g.fill(); }, false) }));
    for (const [x, z, s] of [[-21.4, 8.6, 0.7], [-13.6, -1.9, 0.5], [-19.0, 12.6, 0.9], [-15.4, 4.4, 0.45], [-17.6, 15.3, 0.6]] as [number, number, number][]) c.batch.add(room, stain, geo("srv-stainPlane", () => new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2)), mat(x, H - 0.002, z, s * 5, s, 1, s * 0.8));
  }
  /* ---------- placas de mão e avisos da copa ---------- */
  sign(c, room, "orders", -15.25, 1.6, 7.495, Math.PI, 0.42);
  wallClock(c, room, -14.505, 2.25, 6.75, -Math.PI / 2, 11, 7);
  // giroflex do alarme (os de antes)
  beacon(c, room, -21.9, 3.0, 9.2, 1, 0); beacon(c, room, -12.6, 3.0, -2.6, -1, 0);
  void tube; void rbox;
}

/** Sombras das luzes principais (só no "high"): copa, cozinha, corredor principal e a porta da equipe. */
const KEYS: KeyDef[] = [
  { p: [-19.25, 3.0, -4.7], aim: [-19.25, 0, -5.2], angle: 1.15, i: 16, color: "#ffe9cc" },
  { p: [-15.0, 3.0, 6.8], aim: [-15.4, 0, 6.8], angle: 1.15, i: 15, color: "#fff0dc" },
  { p: [-15.25, 3.0, 10.9], aim: [-15.25, 0, 10.6], angle: 1.1, i: 14, color: "#fff0dc" },
  { p: [-15.6, 3.0, 0.75], aim: [-15.2, 0, 0.75], angle: 1.1, i: 14, color: "#f2f6ff" },
  { p: [-17.25, 3.0, -2.25], aim: [-17.0, 0, -2.25], angle: 1.15, i: 14, color: "#fff0dc" },
  { p: [-21.25, 3.0, -2.6], aim: [-21.4, 0, -2.6], angle: 1.15, i: 14, color: "#fff0dc" },
  { p: [-19.25, 3.0, 0.75], aim: [-19.0, 0, 0.75], angle: 1.1, i: 13, color: "#fff0dc" },
  { p: [-13.25, 3.0, 9.75], aim: [-13.25, 0, 9.75], angle: 1.15, i: 15, color: "#e8f0ff" },
  { p: [-17.25, 3.0, 15.0], aim: [-17.25, 0, 15.0], angle: 1.2, i: 15, color: "#e8f0ff" },
  { p: [-17.25, 3.0, 4.75], aim: [-17.25, 0, 4.75], angle: 1.15, i: 14, color: "#e8f0ff" },
];

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = {
  id: "servico", rooms: ["servico"], dress: servico,
  props: { fixture: (p, c) => { copaFixture(p, c); } },
  surfaces: { servico: { floor: floorSrv, floorTile: [2, 2], floorMirror: [0.32, 0.03], wall: wallSrv, wallTile: [3, 3.6], ceil: null } },
  keys: { servico: KEYS },
};
