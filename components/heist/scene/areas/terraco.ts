/*
 * MET Gala Heist v2 — Terraço-jardim da cobertura (Z13): o pátio a céu aberto onde a gala sai para tomar ar. Linguagem
 * dos salões de castelo de jogo (referência, nada copiado) levada para fora: chão de pedra com desenho e desgaste,
 * paredes em camadas (cordão de pedra, treliças com trepadeiras, lanternas de ferro), um "teto" que nunca é vazio
 * (pergolado com glicínia e o dossel de cordões de lâmpadas) e mobiliário único de jardim.
 *
 *  · piso: lajes calcárias em fiadas desencontradas com musgo nas juntas (terraco-tex); deck de ipê no canto nordeste;
 *  · bordas: balaustrada de pedra (balaústres torneados, pedestais, corrimão) sobre o parapeito norte e leste, com os
 *    vãos da janela do beiral e da escada de incêndio emoldurados por pedestais e a placa de saída em pictograma;
 *  · paredes oeste e sul: cordão de pedra, cimalha, treliças em losango com hera e jasmim saindo dos canteiros, lanternas;
 *  · móveis (planta, lib/heist/level.ts): canteiros elevados, jardineiras escultóricas de corten com oliveira ou
 *    topiaria, sofá e poltronas de teca sob o pergolado, mesa de fogo com vidro de proteção (as chamas mexem), mesa
 *    panorâmica de drinks com tampo de quartzito, banco de contemplação, totem de arte luminosa (a luz corre e muda de
 *    cor), bistrô de ferro e o cinzeiro de pé junto à saída;
 *  · luz: cordões de lâmpadas de filamento em catenária, lanternas com vela, a mesa de fogo e o totem.
 */
import * as THREE from "three";
import { BOX0, CYL, CYL0, SPH, geo, mat, mul } from "../interior-batch";
import { rand } from "../interior-tex";
import { type RoomsCtx, A } from "./kit";
import type { AreaModule } from "./types";
import { areaMat, contactMat, lathe, tube } from "./lounge-kit";
import { DECK_TILE, STONE_TILE, deckSurface, exitSignTexture, stoneSurface, totemTexture } from "./terraco-tex";
import { ROOM, foliage, leafGeo, terraMats, terraceLantern, type TM } from "./terraco-kit";
import { bistroTable, cafeChair, contemplationBench, drinksTable, fireTable, outdoorChair, outdoorSofa, pendingFlames, pendingTotem, pergolaPost, raisedBed, sculptPlanter, totem, urn } from "./terraco-moveis";

/* ======================= decoração (sem colisão) ======================= */
/** Balaustrada sobre o parapeito: plinto, filete, balaústres torneados, corrimão e pedestais, num trecho [a0, a1] da face
 *  (`axis` x: face em z = plane olhando para +z; z: face em x = plane olhando para −x). */
function balustrade(c: RoomsCtx, T: TM, axis: "x" | "z", plane: number, a0: number, a1: number) {
  const M = (a: number, y: number, out: number, sx = 1, sy = 1, sz = 1) => axis === "x" ? mat(a, y, plane + out, 0, sx, sy, sz) : mat(plane - out, y, a, -Math.PI / 2, sx, sy, sz);
  const len = a1 - a0, mid = (a0 + a1) / 2;
  c.batch.add(ROOM, T.stone, BOX0(), M(mid, 0, 0.06, len, 0.2, 0.12), { cast: true });
  c.batch.add(ROOM, T.stone, BOX0(), M(mid, 0.2, 0.055, len, 0.06, 0.11));
  c.batch.add(ROOM, T.void, geo("terraco-voidPlane", () => new THREE.PlaneGeometry(1, 1)), M(mid, 0.62, 0.003, len, 0.72, 1));
  c.batch.add(ROOM, T.stone, BOX0(), M(mid, 0.98, 0.06, len, 0.08, 0.12));
  c.batch.add(ROOM, T.stone, BOX0(), M(mid, 1.06, 0.05, len, 0.07, 0.1));
  const bal = lathe("terraco-baluster", [[0.05, 0], [0.05, 0.04], [0.035, 0.07], [0.045, 0.12], [0.065, 0.26], [0.06, 0.34], [0.03, 0.5], [0.025, 0.58], [0.04, 0.62], [0.04, 0.66], [0.05, 0.69], [0.05, 0.72]], 10);
  const piers: number[] = [a0 + 0.17, a1 - 0.17]; for (let a = a0 + 2.4; a < a1 - 1.2; a += 2.4) piers.push(a);
  for (const a of piers) {
    c.batch.add(ROOM, T.stone, BOX0(), M(a, 0, 0.09, 0.34, 1.13, 0.18), { cast: true });
    c.batch.add(ROOM, T.stone, BOX0(), M(a, 1.13, 0.1, 0.4, 0.14, 0.2));
    c.batch.add(ROOM, T.stone, BOX0(), M(a, 0.0, 0.1, 0.4, 0.12, 0.2));
  }
  for (let a = a0 + 0.36; a < a1 - 0.3; a += 0.2) { if (piers.some((x) => Math.abs(x - a) < 0.25)) continue; c.inst.add(ROOM, "terraco-baluster", bal, T.stone, M(a, 0.26, 0.065)); }
}
/** Treliça em losango de madeira sobre a parede (moldura, ripas a 45°) com a trepadeira subindo do canteiro. */
function trellis(c: RoomsCtx, T: TM, M: THREE.Matrix4, w: number, y0: number, y1: number, seed: number) {
  const h = y1 - y0, wood = T.teakDark;
  for (const s of [-1, 1]) c.batch.add(ROOM, wood, BOX0(), mul(M, mat(s * (w / 2 - 0.025), y0, 0.03, 0, 0.05, h, 0.04)));
  for (const y of [y0, y1 - 0.05]) c.batch.add(ROOM, wood, BOX0(), mul(M, mat(0, y, 0.03, 0, w, 0.05, 0.04)));
  // ripas a ±45° (losangos de 0,3 m): a reta y − y0 = b + dir·x recortada no quadro [−w/2, w/2] × [y0, y1]
  const step = 0.3 * Math.SQRT2, boxC = geo("terraco-boxC", () => new THREE.BoxGeometry(1, 1, 1));
  for (const dir of [1, -1]) for (let b = -(w / 2 + h); b <= w / 2 + h; b += step) {
    const xa = Math.max(-w / 2 + 0.05, dir > 0 ? -b : b - h), xb = Math.min(w / 2 - 0.05, dir > 0 ? h - b : b);
    if (xb - xa < 0.05) continue;
    const ya = y0 + b + dir * xa, yb = y0 + b + dir * xb, len = (xb - xa) * Math.SQRT2;
    c.batch.add(ROOM, wood, boxC, mul(M, mat((xa + xb) / 2, (ya + yb) / 2, dir > 0 ? 0.02 : 0.036, 0, 0.022, len, 0.014, 0, -dir * Math.PI / 4)));
  }
  // ramos que sobem do canteiro e a folhagem (mais densa embaixo)
  for (let k = 0; k < Math.max(2, Math.round(w / 1.1)); k++) {
    const x0 = -w / 2 + (k + 0.5) * w / Math.max(2, Math.round(w / 1.1));
    const pts: [number, number, number][] = []; for (let j = 0; j <= 5; j++) pts.push([x0 + Math.sin(j * 1.3 + k) * 0.25, y0 - 0.05 + j * h * 0.17, 0.06]);
    c.batch.add(ROOM, T.vine, tube(`terraco-vine-${seed}-${k}`, pts, 0.012, 24, 5), M);
  }
  foliage(c, T, M, -w / 2 + 0.05, w / 2 - 0.05, y0, y1 + 0.15, Math.round(w * h * (c.q === "high" ? 46 : 22)), seed + 1);
}
/** Lanterna de parede de ferro (arandela externa) com a vela acesa. */
function wallLantern(c: RoomsCtx, T: TM, M: THREE.Matrix4) {
  c.batch.add(ROOM, T.iron, BOX0(), mul(M, mat(0, -0.12, 0.012, 0, 0.12, 0.3, 0.024)));
  c.batch.add(ROOM, T.iron, tube("terraco-lampArm", [[0, 0, 0.02], [0, 0.06, 0.12], [0, 0.04, 0.22]], 0.012, 10, 6), M);
  terraceLantern(c, T, mul(M, mat(0, -0.18, 0.24)), 0.9);
}

/** Cordão de lâmpadas de filamento entre dois pontos (catenária com `sag`): cabo, soquetes e globos; luz a cada 4ª. */
function stringLights(c: RoomsCtx, T: TM, a: THREE.Vector3, b: THREE.Vector3, sag: number, key: string) {
  const n = Math.max(2, Math.round(a.distanceTo(b) / 0.55)), pts: [number, number, number][] = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24, p = a.clone().lerp(b, t); pts.push([p.x, p.y - Math.sin(Math.PI * t) * sag, p.z]); }
  c.batch.add(ROOM, T.black, tube(`terraco-cable-${key}`, pts, 0.005, 32, 4), mat(0, 0, 0));
  const bulb = areaMat("terraco-bulbGlass", () => new THREE.MeshStandardMaterial({ color: "#ffe2b0", emissive: new THREE.Color("#ffc070"), emissiveIntensity: 2.4, roughness: 0.15, transparent: true, opacity: 0.92 }));
  for (let i = 1; i < n; i++) {
    const t = i / n, p = a.clone().lerp(b, t); p.y -= Math.sin(Math.PI * t) * sag;
    c.inst.add(ROOM, "terraco-socket", CYL0(8), T.black, mat(p.x, p.y - 0.05, p.z, 0, 0.012, 0.05, 0.012));
    c.inst.add(ROOM, "terraco-bulb", geo("terraco-bulbGeo", () => new THREE.SphereGeometry(1, 12, 8).scale(0.032, 0.042, 0.032)), bulb, mat(p.x, p.y - 0.09, p.z));
    c.flames.push(new THREE.Vector3(p.x, p.y - 0.09, p.z));
    if (i % 4 === 2) A(c, ROOM, p.x, p.y - 0.15, p.z, "#ffcf8e", 3.2, 4.6);
  }
}

/** Terraço: decoração sem colisão, luzes e o que anima (ver o cabeçalho). */
function terraco(c: RoomsCtx) {
  const T = terraMats(c.q, c.P), q = c.q;
  /* bordas: balaustrada norte (vão da janela em x 19–20) e leste (vão da escada de incêndio em z −15…−13) */
  balustrade(c, T, "x", -22, 12.5, 19); balustrade(c, T, "x", -22, 20, 22);
  balustrade(c, T, "z", 22, -22, -15); balustrade(c, T, "z", 22, -13, -6.5);
  // placa de saída da escada de incêndio (pictograma) num suporte sobre o pedestal sul do vão
  const exit = areaMat("terraco-exitMat", () => new THREE.MeshStandardMaterial({ map: exitSignTexture(), emissiveMap: exitSignTexture(), emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.7, roughness: 0.5 }));
  c.batch.add(ROOM, T.iron, CYL(8), mat(21.92, 1.45, -12.83, 0, 0.015, 0.6, 0.015));
  c.batch.add(ROOM, exit, geo("terraco-exitPlane", () => new THREE.PlaneGeometry(0.4, 0.2)), mat(21.9, 1.78, -12.83, -Math.PI / 2));
  A(c, ROOM, 21.6, 1.8, -12.85, "#4cff8a", 0.8, 1.6);
  /* paredes oeste e sul (7 m): cordão de pedra a 3,7 m (acima do frontão), cimalha no alto, treliças, lanternas */
  for (const [axis, plane, a0, a1] of [["z", 12.5, -22, -6.5], ["x", -6.5, 12.5, 22]] as ["x" | "z", number, number, number][]) {
    const M = (a: number, y: number, out: number, sx = 1, sy = 1, sz = 1) => axis === "z" ? mat(plane + out, y, a, Math.PI / 2, sx, sy, sz) : mat(a, y, plane - out, Math.PI, sx, sy, sz);
    const len = a1 - a0, mid = (a0 + a1) / 2;
    c.batch.add(ROOM, T.stone, BOX0(), M(mid, 3.72, 0.05, len, 0.2, 0.1));
    c.batch.add(ROOM, T.stone, BOX0(), M(mid, 3.92, 0.035, len, 0.06, 0.07));
    c.batch.add(ROOM, T.stone, BOX0(), M(mid, 6.7, 0.08, len, 0.3, 0.16));
    c.batch.add(ROOM, T.stone, BOX0(), M(mid, 6.55, 0.05, len, 0.15, 0.1));
    for (let a = a0 + 0.06; a < a1; a += 0.12) c.inst.add(ROOM, "terraco-modillion", BOX0(), T.stone, M(a, 6.45, 0.07, 0.05, 0.1, 0.14));
  }
  // treliças sobre os canteiros (os canteiros são da planta: terracoBed)
  const bedTrellis: [number, number, number, number, number][] = [[12.5, -19.475, Math.PI / 2, 4.2, 11], [12.5, -9.8, Math.PI / 2, 5.6, 13], [14.25, -6.5, Math.PI, 1.8, 17], [20.3, -6.5, Math.PI, 2.9, 19]];
  for (const [x, z, ry, w, seed] of bedTrellis) {
    trellis(c, T, mat(x, 0, z, ry), w, 0.6, 3.15, seed);
  }
  // frontão de pedra sobre a porta francesa da galeria (as folhas são da área do vestíbulo) e verga sobre a porta da equipe
  const door = mat(12.5, 0, -15, Math.PI / 2);
  c.batch.add(ROOM, T.stone, BOX0(), mul(door, mat(0, 2.72, 0.06, 0, 2.7, 0.22, 0.12)), { cast: true });
  c.batch.add(ROOM, T.stone, BOX0(), mul(door, mat(0, 2.94, 0.09, 0, 2.95, 0.08, 0.18)));
  c.batch.add(ROOM, T.stone, geo("terraco-pediment", () => { const s = new THREE.Shape(); s.moveTo(-1.5, 0); s.lineTo(1.5, 0); s.lineTo(0, 0.55); s.closePath(); const hole = new THREE.Path(); hole.moveTo(-1.18, 0.1); hole.lineTo(0, 0.43); hole.lineTo(1.18, 0.1); hole.closePath(); s.holes.push(hole); return new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, curveSegments: 1 }); }), mul(door, mat(0, 3.02, 0.0)), { cast: true });
  c.batch.add(ROOM, T.stone, geo("terraco-tympanum", () => { const s = new THREE.Shape(); s.moveTo(-1.18, 0.1); s.lineTo(1.18, 0.1); s.lineTo(0, 0.43); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false }); }), mul(door, mat(0, 3.02, 0.0)));
  c.batch.add(ROOM, T.bronze, geo("terraco-wreath", () => new THREE.TorusGeometry(0.11, 0.022, 8, 24)), mul(door, mat(0, 3.24, 0.08)));
  const sdoor = mat(17, 0, -6.5, Math.PI);
  c.batch.add(ROOM, T.stone, BOX0(), mul(sdoor, mat(0, 2.72, 0.05, 0, 2.6, 0.24, 0.1)));
  c.batch.add(ROOM, T.stone, geo("terraco-keystone", () => { const s = new THREE.Shape(); s.moveTo(-0.12, 0); s.lineTo(0.12, 0); s.lineTo(0.16, 0.36); s.lineTo(-0.16, 0.36); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 }); }), mul(sdoor, mat(0, 2.68, 0.0)));
  // lanternas de parede ladeando a porta da galeria (oeste) e a da equipe (sul)
  for (const z of [-16.65, -13.35]) wallLantern(c, T, mat(12.5, 2.35, z, Math.PI / 2));
  for (const x of [15.55, 18.45]) wallLantern(c, T, mat(x, 2.35, -6.5, Math.PI));
  /* deck de ipê sob a mesa de drinks (canto nordeste): placa, testeira e o rodapé de sombra */
  const deck = areaMat(`terraco-deckMat-${q}`, () => { const sf = deckSurface(q); return new THREE.MeshStandardMaterial({ map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, roughness: 1, envMapIntensity: 0.6 }); });
  const dx0 = 20.05, dx1 = 21.84, dz0 = -21.84, dz1 = -17.4, dh = 0.022;
  c.batch.add(ROOM, deck, geo("terraco-deckTop", () => { const g = new THREE.PlaneGeometry(dx1 - dx0, dz1 - dz0).rotateX(-Math.PI / 2); const uv = g.getAttribute("uv") as THREE.BufferAttribute, pos = g.getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getZ(i) + (dz0 + dz1) / 2) / DECK_TILE, (pos.getX(i) + (dx0 + dx1) / 2) / DECK_TILE); return g; }), mat((dx0 + dx1) / 2, dh, (dz0 + dz1) / 2), { receive: true });
  c.batch.add(ROOM, T.teakDark, BOX0(), mat(dx0 + 0.01, 0, (dz0 + dz1) / 2, 0, 0.02, dh, dz1 - dz0));
  c.batch.add(ROOM, T.teakDark, BOX0(), mat((dx0 + dx1) / 2, 0, dz1 - 0.01, 0, dx1 - dx0, dh, 0.02));
  c.batch.add(ROOM, contactMat(), geo("lounge-shadowPlane", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), mat(21.4, dh + 0.002, -19.6, 0, 1.1, 1, 3.3), { receive: false });
  /* pergolado sobre o estar: vigas sobre os pilares, caibros com pontas recortadas, glicínia e lanternas penduradas */
  const px0 = 15.25, px1 = 18.55, pz0 = -14.75, pz1 = -10.1, top = 2.9;
  for (const x of [px0, px1]) { c.batch.add(ROOM, T.teakDark, BOX0(), mat(x, top, (pz0 + pz1) / 2, 0, 0.1, 0.22, pz1 - pz0 + 0.9), { cast: true }); }
  for (let z = pz0 - 0.25; z <= pz1 + 0.26; z += 0.42) {
    c.batch.add(ROOM, T.teakDark, BOX0(), mat((px0 + px1) / 2, top + 0.22, z, 0, px1 - px0 + 0.8, 0.14, 0.06), { cast: true });
    for (const s of [-1, 1]) c.batch.add(ROOM, T.teakDark, BOX0(), mat((px0 + px1) / 2 + s * ((px1 - px0) / 2 + 0.4), top + 0.22, z, 0, 0.12, 0.07, 0.06, 0, s * 0.35));
  }
  const RW = rand(71);
  for (const x of [px0, px1]) { const pts: [number, number, number][] = []; for (let j = 0; j <= 14; j++) pts.push([x + Math.sin(j * 0.9) * 0.1, top + 0.24, pz0 - 0.3 + j * (pz1 - pz0 + 0.6) / 14]); c.batch.add(ROOM, T.vine, tube(`terraco-pergVine${x}`, pts, 0.018, 40, 5), mat(0, 0, 0)); }
  for (let k = 0; k < (q === "high" ? 520 : 240); k++) {
    const x = px0 - 0.3 + RW() * (px1 - px0 + 0.6), z = pz0 - 0.3 + RW() * (pz1 - pz0 + 0.6), edge = Math.min(x - px0 + 0.3, px1 + 0.3 - x, z - pz0 + 0.3, pz1 + 0.3 - z);
    if (RW() > 0.35 + edge * 0.6) continue;
    const s = 0.08 + RW() * 0.07;
    c.inst.add(ROOM, "terraco-leaf", leafGeo(Math.floor(RW() * 4)), T.leaf, mat(x, top + 0.3 + RW() * 0.08, z, RW() * 6.28, s, s, s, -1.2 + RW() * 0.8, RW() * 6.28), new THREE.Color().setHSL(0.25 + RW() * 0.05, 0.42, 0.3 + RW() * 0.14));
  }
  for (let k = 0; k < (q === "high" ? 70 : 34); k++) {
    const x = px0 - 0.2 + RW() * (px1 - px0 + 0.4), z = pz0 - 0.2 + RW() * (pz1 - pz0 + 0.4), s = 0.2 + RW() * 0.16;
    if (Math.abs(x - (px0 + px1) / 2) < 0.9 && Math.abs(z - (pz0 + pz1) / 2) < 1.6 && RW() < 0.6) continue;
    c.inst.add(ROOM, "terraco-wisteria", geo("terraco-wisGeo", () => { const a = new THREE.PlaneGeometry(0.5, 1).translate(0, -0.5, 0); return a; }), T.wisteria, mat(x, top + 0.2, z, RW() * 3.14, s, s * 1.4, s));
  }
  for (const x of [px0, px1]) { c.batch.add(ROOM, T.iron, CYL(5), mat(x, top - 0.3, -12.4, 0, 0.005, 0.6, 0.005)); terraceLantern(c, T, mat(x, top - 0.62, -12.4), 0.85); }
  /* dossel de cordões de lâmpadas: postes nos cantos e a radiação a partir dos cantos do pergolado */
  const poles = [new THREE.Vector3(12.95, 0, -21.75), new THREE.Vector3(21.72, 0, -21.72), new THREE.Vector3(21.62, 0, -6.85), new THREE.Vector3(12.95, 0, -6.85)];
  for (const p of poles) {
    c.batch.add(ROOM, T.black, lathe("terraco-pole", [[0, 0], [0.06, 0], [0.06, 0.04], [0.03, 0.08], [0.028, 3.3], [0.04, 3.32], [0.02, 3.45], [0, 3.48]], 10), mat(p.x, 0, p.z), { cast: true });
    c.batch.add(ROOM, T.black, BOX0(), mat(p.x, 0, p.z, 0, 0.2, 0.03, 0.2));
  }
  const H = (p: THREE.Vector3, y: number) => p.clone().setY(y);
  for (let k = 0; k < 4; k++) stringLights(c, T, H(poles[k], 3.3), H(poles[(k + 1) % 4], 3.3), 0.5, `edge${k}`);
  const corners = [new THREE.Vector3(px0, 0, pz0), new THREE.Vector3(px1, 0, pz0), new THREE.Vector3(px1, 0, pz1), new THREE.Vector3(px0, 0, pz1)];
  for (let k = 0; k < 4; k++) stringLights(c, T, H(poles[k], 3.25), H(corners[k], top + 0.3), 0.35, `diag${k}`);
  /* o vaso tombado junto ao esconderijo e a lanterna de chão ao lado do banco */
  c.batch.add(ROOM, T.terracottaPot, lathe("terraco-tippedPot", [[0.0, 0], [0.09, 0], [0.13, 0.22], [0.14, 0.24], [0.125, 0.24], [0.115, 0.03], [0, 0.03]], 16), mat(14.95, 0.12, -19.95, 0.6, 1, 1, 1, Math.PI / 2));
  for (let k = 0; k < 10; k++) { const R = rand(200 + k); c.inst.add(ROOM, "terraco-pebble", SPH(6), T.soil, mat(15.1 + R() * 0.3, 0.01, -19.85 + (R() - 0.5) * 0.3, R() * 3, 0.03 + R() * 0.03, 0.012, 0.03)); }
  /* o que anima: chamas da mesa de fogo e a luz que sobe pelo totem, mudando de cor devagar */
  const flames = pendingFlames.splice(0), totems = pendingTotem.splice(0), mtx = new THREE.Matrix4(), scl = new THREE.Matrix4();
  for (const fl of flames) c.ticks.push({ room: fl.room, tick: (t) => {
    fl.base.forEach((b, k) => { const s = 0.85 + 0.25 * Math.sin(t * 9.1 + k * 1.7) + 0.12 * Math.sin(t * 23 + k * 3.1); scl.makeScale(1 + 0.08 * Math.sin(t * 13 + k), s, 1); mtx.multiplyMatrices(b, scl); fl.mesh.setMatrixAt(k, mtx); });
    fl.mesh.instanceMatrix.needsUpdate = true;
  } });
  const tex = totemTexture(), col = new THREE.Color();
  if (totems.length) c.ticks.push({ room: ROOM, tick: (t) => {
    tex.offset.y = -t * 0.12;
    col.setHSL((0.92 + 0.08 * Math.sin(t * 0.21) + 0.1 * Math.sin(t * 0.07)) % 1, 0.85, 0.56);
    for (const m of totems) m.color.copy(col).multiplyScalar(1.6);
  } });
}

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = {
  id: "terraco", rooms: ["terraco"], dress: terraco,
  props: {
    planter: sculptPlanter, sofa: outdoorSofa, bench: contemplationBench,
    fixture: (p, c) => {
      switch (p.model) {
        case "terracoFire": return fireTable(p, c);
        case "terracoChair": return outdoorChair(p, c);
        case "terracoPost": return pergolaPost(p, c);
        case "terracoDrinks": return drinksTable(p, c);
        case "terracoTotem": return totem(p, c);
        case "terracoBistro": return bistroTable(p, c);
        case "terracoCafeChair": return cafeChair(p, c);
        case "terracoBed": return raisedBed(p, c);
        case "terracoUrn": return urn(p, c);
      }
    },
  },
  surfaces: {
    terraco: {
      floor: (q) => { const sf = stoneSurface(q); return areaMat(`terraco-floor-${q}`, () => new THREE.MeshStandardMaterial({ map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, normalScale: new THREE.Vector2(1.1, 1.1), vertexColors: true, roughness: 1, envMapIntensity: 0.45 })); },
      floorTile: [STONE_TILE, STONE_TILE],
    },
  },
};
