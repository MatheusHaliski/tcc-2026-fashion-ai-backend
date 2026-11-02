/*
 * MET Gala Heist v2 — Grande Salão — piso, paredes, teto e mezanino no padrão dos salões de castelo (Resident Evil
 * Village como linguagem): mármore Botticino polido em placas de 1,2 m com frisos de granito negro, filete de latão e
 * losangos de Rosso nas esquinas; a rosácea de mármores em volta da instalação floral; a barra grega de granito ao longo
 * das paredes; tapetes redondos sob as mesas dos patronos; lambri de nogueira com almofadas em relevo e molduras de
 * pedra nos panos livres das paredes; lustres "Coroa Celeste" (anéis de bronze, cristais em fios e guirlandas de contas)
 * nas naves norte e sul; camarotes com poltronas no mezanino; o painel de veludo com estrelas atrás do DJ.
 * As superfícies do piso (placa, rosácea, barra grega, tapete) estão em salao-floor-tex.ts, o lustre em
 * salao-chandelier.ts e as cortinas em salao-drapes.ts; o material do piso e o lustre são reexportados daqui.
 */
import * as THREE from "three";
import { BOX0, CYL, CYL0, SPH, geo, mat, mul } from "../interior-batch";
import { BALC_Y, HALL_H } from "../interior-hall";
import type { Quality } from "../interior-tex";
import { type RoomsCtx, A } from "./kit";
import { ROOM, fbm, hash2, lathe, raisedPanel, salaoFabric, salaoGlow, salaoMat, salaoSolid, salaoTexture, sparkleTexture, surface, surfaceMat, vnoise } from "./salao-kit";
import { RO, meanderSurface, rosetteSurface, rugTexture } from "./salao-floor-tex";
import { crownChandelier } from "./salao-chandelier";
import { drapes } from "./salao-drapes";

export { floorMaterialSalao, floorSurfaceSalao } from "./salao-floor-tex";
export { crownChandelier } from "./salao-chandelier";

/** Rosácea, barra grega ao longo das paredes e tapetes sob as mesas dos patronos (sobre o piso, com o mesmo reflexo). */
function floorInlays(c: RoomsCtx) {
  const q = c.q;
  // rosácea: anel em volta da base da instalação floral (r 1,6), com o reflexo do piso polido
  const ros = surfaceMat(`rosette-${q}`, rosetteSurface(q), { mirror: [0.8, 0.05], polygonOffset: true });
  c.batch.add(ROOM, ros, geo("salao-rosetteRing", () => {
    const g = new THREE.RingGeometry(1.6, RO, 96, 2), p = g.getAttribute("position") as THREE.BufferAttribute, uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * RO) + 0.5, p.getY(i) / (2 * RO) + 0.5);
    return g.rotateX(-Math.PI / 2);
  }), mat(0, 0.003, 4.5), { receive: true });
  // barra grega: 0,45 m, a 0,35 m das paredes (passa sob os móveis encostados, interrompe nas portas)
  const mm = surfaceMat(`meander-${q}`, meanderSurface(q), { mirror: [0.7, 0.05], polygonOffset: true });
  const strip = (x0: number, z0: number, x1: number, z1: number) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = alongX ? x1 - x0 : z1 - z0, w = 0.45;
    const g = new THREE.PlaneGeometry(len, w).rotateX(-Math.PI / 2), uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 0.9, uv.getY(i));
    c.batch.add(ROOM, mm, g, mat((x0 + x1) / 2, 0.003, (z0 + z1) / 2, alongX ? 0 : Math.PI / 2), { receive: true });
  };
  // (as faixas norte/sul vão de canto a canto; as leste/oeste começam onde aquelas terminam, sem sobrepor)
  const o = 0.35 + 0.225, e = o - 0.225, i = o + 0.225;
  for (const [x0, x1] of [[-12 + e, -3.2], [3.2, 12 - e]]) { strip(x0, -6 + o, x1, -6 + o); strip(x0, 14 - o, x1, 14 - o); }
  for (const [z0, z1] of [[-6 + i, 8.1], [11.9, 14 - i]]) { strip(-12 + o, z0, -12 + o, z1); strip(12 - o, z0, 12 - o, z1); }
  // tapetes redondos de lã (1,2 cm) sob as mesas dos patronos, sem reflexo
  const rug = salaoMat("rugMat", () => new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.96, transparent: true, alphaTest: 0.5, envMapIntensity: 0.3 }));
  for (const [x, z] of [[-6.8, -3.5], [-6.6, 2.0], [-6.6, 7.2]]) {
    c.batch.add(ROOM, rug, geo("salao-rugDisc", () => new THREE.CylinderGeometry(1.85, 1.86, 0.012, 64, 1).translate(0, 0.006, 0)), mat(x, 0.002, z), { receive: true });
  }
}

/* ======================= paredes ======================= */
/** Cantaria de calcário quente: blocos de 1,2 × 0,6 m com junta chanfrada, poros e veladura. */
export function wallSurfaceSalao(q: Quality) {
  return surface(`stone-${q}`, q === "high" ? 1024 : 512, (u, v, o) => {
    // a textura cobre 2,4 × 1,2 m: 2 fiadas de 0,6 m, blocos de 1,2 m desencontrados
    const row = Math.floor(v * 2), lv = v * 2 % 1, off = row % 2 ? 0.25 : 0, lu = ((u + off) % 1) * 2 % 1;
    const jv = Math.min(lv, 1 - lv), ju = Math.min(lu, 1 - lu), j = Math.min(jv * 0.5, ju);
    const n = fbm(u, v, 6, 71, 4), pores = vnoise(u * 160, v * 80, 160, 73) > 0.86 ? 0.88 : 1, block = Math.floor((u + off) * 2) + row * 7;
    const tone = (hash2(block, row, 75) - 0.5) * 0.06, b = (0.76 + tone + 0.06 * (n - 0.5)) * pores;
    if (j < 0.004) { o[0] = 0.46; o[1] = 0.4; o[2] = 0.33; o[3] = 0.25; o[4] = 0.95; return; }
    const ch = Math.min(1, j / 0.012);                                               // chanfro da junta
    o[0] = b * 1.02; o[1] = b * 0.94; o[2] = b * 0.8; o[3] = 0.35 + 0.15 * ch + 0.05 * n; o[4] = 0.78 - 0.1 * n;
  }, 1.6);
}
export const wallMaterialSalao = (q: Quality) => surfaceMat(`stone-${q}`, wallSurfaceSalao(q), { env: 0.6, normal: 1.1 });

type Side = "N" | "S" | "W" | "E";
/** Matriz num ponto da face interna: s ao longo da parede, y, afastado `off`; a face local olha para +z (dentro da sala). */
const onWall = (w: Side, s: number, y: number, off: number) => {
  switch (w) {
    case "N": return mat(s, y, -6 + off, 0);
    case "S": return mat(s, y, 14 - off, Math.PI);
    case "W": return mat(-12 + off, y, s, Math.PI / 2);
    case "E": return mat(12 - off, y, s, -Math.PI / 2);
  }
};
/** Trechos ocupados de cada parede (arcos com moldura, portas, pilastras, telão, cartaz-pista). */
const BUSY: Record<Side, [number, number][]> = {
  N: [[-11.7, -10.9], [-11.1, -4.9], [-4.4, -3.6], [-3.1, 3.1], [2.7, 3.5], [8.9, 9.7], [10.9, 11.7]],
  S: [[-11.7, -10.9], [-11.1, -4.9], [-4.4, -3.6], [-3.1, 3.1], [3.6, 4.4], [4.9, 11.1], [10.9, 11.7]],
  W: [[-5.0, -4.2], [-0.9, 5.9], [6.2, 7.8], [7.9, 12.1], [12.5, 13.3]],
  E: [[-5.6, -4.8], [-4.9, 2.9], [3.4, 4.2], [7.0, 7.8], [7.9, 12.1], [12.5, 13.3]],
};
const SPAN: Record<Side, [number, number]> = { N: [-12, 12], S: [-12, 12], W: [-6, 14], E: [-6, 14] };
function freeSpans(w: Side, min = 0.9): [number, number][] {
  const busy = BUSY[w].slice().sort((a, b) => a[0] - b[0]), out: [number, number][] = [];
  let a = SPAN[w][0];
  for (const [b0, b1] of busy) { if (b0 - a >= min) out.push([a, b0]); a = Math.max(a, b1); }
  if (SPAN[w][1] - a >= min) out.push([a, SPAN[w][1]]);
  return out;
}
/**
 * Lambri de nogueira (0–1,06 m) com almofadas em relevo, rodapé de mármore negro e chapim, e acima dele quadros de
 * moldura dupla de pedra até 4,2 m nos panos livres; atrás do telão (norte) e do DJ (leste) só o lambri.
 */
function boiserie(c: RoomsCtx) {
  const P = c.P, walnut = P.walnut, plinth = P.marbleDark, mold = salaoSolid("stoneMold", "#d8ccb4", { rough: 0.62, env: 0.6 }), gold = P.gold;
  for (const w of ["N", "S", "W", "E"] as Side[]) for (const [a0, a1] of freeSpans(w)) {
    const len = a1 - a0, mid = (a0 + a1) / 2, at = (s: number, y: number, off: number) => onWall(w, s, y, off);
    c.batch.add(ROOM, plinth, BOX0(), mul(at(mid, 0, 0.02), mat(0, 0, 0, 0, len, 0.16, 0.04)));                          // rodapé
    c.batch.add(ROOM, walnut, BOX0(), mul(at(mid, 0.16, 0.012), mat(0, 0, 0, 0, len, 0.86, 0.024)), { cast: true });     // fundo do lambri
    c.batch.add(ROOM, walnut, BOX0(), mul(at(mid, 0.16, 0.03), mat(0, 0, 0, 0, len, 0.07, 0.03)));                       // travessa de baixo
    c.batch.add(ROOM, walnut, BOX0(), mul(at(mid, 0.93, 0.03), mat(0, 0, 0, 0, len, 0.07, 0.03)));                       // travessa de cima
    c.batch.add(ROOM, walnut, geo("salao-chairRail", () => new THREE.CylinderGeometry(0.03, 0.03, 1, 10, 1).rotateZ(Math.PI / 2).translate(0, 0.03, 0)), mul(at(mid, 1.0, 0.04), mat(0, 0, 0, 0, len, 1, 1)));
    c.batch.add(ROOM, walnut, BOX0(), mul(at(mid, 1.0, 0.025), mat(0, 0, 0, 0, len, 0.06, 0.05)));                      // chapim
    const n = Math.max(1, Math.round(len / 0.95)), pw = len / n;
    for (let k = 0; k < n; k++) {
      const s = a0 + (k + 0.5) * pw;
      c.batch.add(ROOM, walnut, BOX0(), mul(at(a0 + k * pw, 0.23, 0.03), mat(0, 0, 0, 0, 0.07, 0.7, 0.03)));              // montante
      c.inst.add(ROOM, `salao-dado-${Math.round(pw * 20)}`, raisedPanel(`dado${Math.round(pw * 20)}`, pw - 0.14, 0.62, 0.03, 0.035), walnut, mul(at(s, 0.575, 0.024), mat(0, 0, 0)));
    }
    c.batch.add(ROOM, walnut, BOX0(), mul(at(a1, 0.23, 0.03), mat(0, 0, 0, 0, 0.07, 0.7, 0.03)));
    // quadros de pedra (moldura dupla) acima do lambri — menos atrás do telão e do painel do DJ
    const hidden = (w === "N" && a0 > 3 && a1 < 9.1) || (w === "E" && a0 > 3.5 && a1 < 7.2);
    if (hidden || len < 1.3) continue;
    for (const [inset, t] of [[0.18, 0.07], [0.32, 0.035]] as [number, number][]) {
      const x0 = a0 + inset, x1 = a1 - inset, y0 = 1.45 + inset - 0.18, y1 = 4.35 - inset + 0.18, fw = x1 - x0, fh = y1 - y0;
      c.batch.add(ROOM, mold, BOX0(), mul(at((x0 + x1) / 2, y0, 0.03), mat(0, 0, 0, 0, fw, t, 0.045)));
      c.batch.add(ROOM, mold, BOX0(), mul(at((x0 + x1) / 2, y1 - t, 0.03), mat(0, 0, 0, 0, fw, t, 0.045)));
      c.batch.add(ROOM, mold, BOX0(), mul(at(x0 + t / 2, y0, 0.03), mat(0, 0, 0, 0, t, fh, 0.045)));
      c.batch.add(ROOM, mold, BOX0(), mul(at(x1 - t / 2, y0, 0.03), mat(0, 0, 0, 0, t, fh, 0.045)));
    }
    // florão dourado no centro de cada quadro
    c.inst.add(ROOM, "salao-boss", geo("salao-bossGeo", () => new THREE.SphereGeometry(0.11, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2)), gold, mul(at(mid, 2.9, 0.03), mat(0, 0, 0)));
  }
}

/* ======================= painel atrás do DJ ======================= */
/** Veludo negro com um céu de pontinhos (fibra ótica) e o monograma da Gala em latão iluminado. */
function djBackdrop(c: RoomsCtx) {
  const velvet = salaoFabric("djVelvet", "#08070b", c.q, { sheen: "#3a2a55", rough: 0.85 });
  const drape = geo("salao-djDrape", () => {
    const g = new THREE.PlaneGeometry(4.4, 4.8, 64, 4), p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, 0.05 * Math.sin(p.getX(i) * 9) + 0.02 * Math.sin(p.getX(i) * 23));
    g.translate(0, 2.4, 0); g.computeVertexNormals(); return g;
  });
  c.batch.add(ROOM, velvet, drape, mat(11.72, 0.08, 4.5, -Math.PI / 2), { cast: false });
  c.batch.add(ROOM, c.P.gold, CYL(12), mat(11.7, 4.92, 4.5, 0, 0.03, 4.6, 0.03, Math.PI / 2));          // varão de latão
  for (const z of [2.25, 6.75]) c.batch.add(ROOM, c.P.gold, SPH(12), mat(11.7, 4.92, z, 0, 0.06));
  // fibra ótica: pontinhos que cintilam (o mesmo campo dos globos, aditivo, girando devagar no tique)
  const stars = salaoGlow("djStars", "#cfd8ff", 1.3, { additive: true, map: sparkleTexture() });
  const sp = new THREE.Mesh(geo("salao-djStarsGeo", () => new THREE.PlaneGeometry(4.2, 4.2)), stars);
  sp.position.set(11.6, 2.6, 4.5); sp.rotation.y = -Math.PI / 2; sp.userData.room = ROOM; sp.renderOrder = 3; c.group.add(sp);
  const st = stars.map!; st.repeat.set(2, 2);
  c.ticks.push({ room: ROOM, tick: (t) => { st.offset.set(t * 0.004, Math.sin(t * 0.3) * 0.01); stars.opacity = 0.75 + 0.25 * Math.sin(t * 2.7); } });
  // monograma "GL" num medalhão de latão com luz por trás
  const mono = salaoTexture("monogram", 512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); const cx = w / 2;
    const grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx); grd.addColorStop(0, "rgba(255,214,150,0.55)"); grd.addColorStop(0.62, "rgba(255,190,110,0.25)"); grd.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#f2d08a"; g.lineWidth = 10; g.beginPath(); g.arc(cx, cx, cx * 0.62, 0, Math.PI * 2); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(cx, cx, cx * 0.56, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#f6dc9c"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `italic 600 ${Math.round(h * 0.32)}px 'Didot', 'Bodoni 72', Georgia, serif`; g.fillText("GL", cx, cx + h * 0.02);
  }, true);
  const mm = salaoGlow("monogramGlow", "#ffffff", 1.4, { additive: true, map: mono });
  c.batch.add(ROOM, mm, geo("salao-monoPlane", () => new THREE.PlaneGeometry(1.6, 1.6)), mat(11.66, 3.25, 4.5, -Math.PI / 2));
  A(c, ROOM, 11.0, 3.4, 4.5, "#ffc983", 4, 4);
}


/* ======================= camarotes no mezanino ======================= */
/** Poltronas bergère aos pares com mesinha e abajur, no mezanino norte e sul (fora da área jogável: só vista). */
function mezzanineBoxes(c: RoomsCtx) {
  const P = c.P, top = BALC_Y + 0.4, frame = P.gold, velvet = salaoFabric("boxVelvet", "#5b1430", c.q, { sheen: "#c27a95" });
  const seat = geo("salao-bergSeat", () => new THREE.BoxGeometry(0.62, 0.14, 0.56, 2, 1, 2).translate(0, 0.07, 0));
  const back = geo("salao-bergBack", () => { const s = new THREE.Shape(); s.moveTo(-0.3, 0); s.lineTo(0.3, 0); s.lineTo(0.3, 0.45); s.quadraticCurveTo(0, 0.68, -0.3, 0.45); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }); });
  const arm = geo("salao-bergArm", () => new THREE.CapsuleGeometry(0.05, 0.42, 4, 8).rotateX(Math.PI / 2));
  const leg = geo("salao-bergLeg", () => new THREE.CylinderGeometry(0.022, 0.014, 0.3, 8).translate(0, 0.15, 0));
  const shade = salaoFabric("boxShade", "#f1d9a6", c.q, { side: THREE.DoubleSide });
  const groups: [Side, number][] = [["N", -9.6], ["N", -2.4], ["N", 6.0], ["S", -9.4], ["S", -1.6], ["S", 6.6]];
  for (const [w, s] of groups) {
    const base = mul(onWall(w, s, top, 0), mat(0, 0, 0.62));                      // a 0,62 m da parede, olhando para a balaustrada
    for (const dx of [-0.48, 0.48]) {
      const at = mul(base, mat(dx, 0, 0, dx > 0 ? -0.25 : 0.25));
      for (const [lx, lz] of [[-0.26, -0.22], [0.26, -0.22], [-0.26, 0.22], [0.26, 0.22]]) c.inst.add(ROOM, "salao-bergLegs", leg, frame, mul(at, mat(lx, 0, lz)));
      c.inst.add(ROOM, "salao-bergSeat", seat, velvet, mul(at, mat(0, 0.3, 0)));
      c.inst.add(ROOM, "salao-bergBack", back, velvet, mul(at, mat(0, 0.42, -0.31)));
      c.inst.add(ROOM, "salao-bergFrame", geo("salao-bergFrameGeo", () => new THREE.TorusGeometry(0.33, 0.016, 6, 24, Math.PI).translate(0, 0.0, 0)), frame, mul(at, mat(0, 0.86, -0.25, 0, 1, 0.75, 1)));
      for (const sx of [-0.33, 0.33]) c.inst.add(ROOM, "salao-bergArm", arm, velvet, mul(at, mat(sx, 0.56, 0)));
    }
    // mesinha redonda de mármore com abajur
    c.batch.add(ROOM, frame, lathe("boxTableFoot", [[0, 0], [0.16, 0], [0.04, 0.05], [0.03, 0.55], [0.05, 0.6], [0, 0.6]], 16), mul(base, mat(0, 0, -0.05)));
    c.batch.add(ROOM, P.marbleDark, CYL0(24), mul(base, mat(0, 0.6, -0.05, 0, 0.22, 0.025, 0.22)));
    c.batch.add(ROOM, frame, lathe("boxLamp", [[0, 0], [0.06, 0], [0.02, 0.03], [0.015, 0.25], [0, 0.25]], 12), mul(base, mat(0, 0.625, -0.05)));
    c.inst.add(ROOM, "salao-boxShade", geo("salao-boxShadeGeo", () => new THREE.CylinderGeometry(0.07, 0.11, 0.13, 16, 1, true)), shade, mul(base, mat(0, 0.92, -0.05)));
    c.inst.add(ROOM, "salao-boxBulb", SPH(8), P.bulbWarm, mul(base, mat(0, 0.9, -0.05, 0, 0.03)));
    const lp = new THREE.Vector3(0, 0.95, -0.05).applyMatrix4(base); A(c, ROOM, lp.x, lp.y, lp.z, "#ffc77f", 2.2, 3, { flicker: 0.2 });
  }
}

/** Decoração da arquitetura do salão (piso, paredes, teto, mezanino). */
export function dressWalls(c: RoomsCtx) {
  floorInlays(c);
  boiserie(c);
  djBackdrop(c);
  mezzanineBoxes(c);
  drapes(c);
  // lustres "Coroa Celeste": sobre a mesa dos patronos ao norte, diante do telão, e sobre os doces e o bufê ao sul
  for (const [x, y, z, s] of [[-6.8, 6.4, -3.5, 1.0], [6.0, 6.5, -3.4, 0.9], [-8, 6.6, 11.6, 0.9], [8, 6.6, 11.6, 0.9]] as [number, number, number, number][]) {
    crownChandelier(c, x, y, z, HALL_H - 0.02, s);
    A(c, ROOM, x, y + 0.35, z, "#ffd29a", 26, 12);
  }
}
