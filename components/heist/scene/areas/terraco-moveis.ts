/*
 * MET Gala Heist v2 — Terraço-jardim (Z13): os móveis da planta (lib/heist/level.ts), cada um na forma de colisão —
 * jardineiras escultóricas de corten com oliveira ou topiaria, sofá e poltronas de teca, mesa de fogo (as chamas
 * ficam em `pendingFlames` para a decoração animar), mesa panorâmica de drinks, banco de contemplação, totem de arte
 * luminosa (`pendingTotem`), bistrô de ferro, cadeira de café, cinzeiro de pé, canteiros elevados e os pilares do
 * pergolado. Saiu de terraco.ts sem mudança.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import type { PropsCtx } from "../interior-props";
import { BOX0, CYL, CYL0, SPH, geo, mat, mul } from "../interior-batch";
import { glass, solid } from "../interior-mats";
import { rand } from "../interior-tex";
import { canopyGeometry, oliveSprigGeometry, oliveSprigMaterial } from "../interior-dress";
import { areaMat, at, footOf, lamp, lathe, rbox, tube, world, type Foot } from "./lounge-kit";
import { flameTexture, totemTexture } from "./terraco-tex";
import { bottleAt, glassAt, loungeMats } from "./lounge-mob";
import { ROOM, box, flameGeo, leafGeo, terraMats, terraceLantern, type TM } from "./terraco-kit";

/* ======================= móveis da planta ======================= */
/** Jardineira escultórica de corten (octógono que torce 22,5° de baixo para cima) com oliveira ou topiaria em nuvens. */
export function sculptPlanter(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P), r = f.r, R = rand(p.id.length * 13 + p.id.charCodeAt(p.id.length - 1));
  const body = geo("terraco-twistPot", () => {
    const g0 = new THREE.CylinderGeometry(1, 0.84, 1, 8, 6, true).translate(0, 0.5, 0), pos = g0.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), a = y * Math.PI / 8, x = pos.getX(i), z = pos.getZ(i); pos.setXYZ(i, x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a)); }
    const g = g0.toNonIndexed(); g.computeVertexNormals(); return g;
  });
  c.batch.add(ROOM, T.corten, body, at(f, 0, 0, 0, 0, r, 0.9, r), { cast: true });
  c.batch.add(ROOM, T.corten, geo("terraco-potLip", () => new THREE.RingGeometry(0.9, 1.0, 8, 1).rotateX(-Math.PI / 2).rotateY(Math.PI / 8)), at(f, 0, 0.9, 0, 0, r, 1, r));
  c.batch.add(ROOM, T.soil, CYL0(8), at(f, 0, 0.84, 0, Math.PI / 8, r * 0.9, 0.04, r * 0.9));
  for (let k = 0; k < 18; k++) { const a = R() * 6.28, d = R() * r * 0.8; c.inst.add(ROOM, "terraco-pebble", SPH(6), T.travertine, at(f, Math.cos(a) * d, 0.885, Math.sin(a) * d, R() * 3, 0.03 + R() * 0.03, 0.015, 0.025 + R() * 0.02)); }
  if (p.id.charCodeAt(p.id.length - 1) % 3 === 0) {
    // topiaria em nuvens: tronco torto e três bolas de buxo em alturas diferentes
    c.batch.add(ROOM, T.bark, tube(`terraco-topTrunk`, [[0, 0, 0], [0.08, 0.5, 0.04], [-0.05, 1.0, -0.02], [0.04, 1.55, 0.03]], 0.05, 16, 6), at(f, 0, 0.86, 0));
    for (const [x, y, z, s] of [[0.22, 0.55, 0.05, 0.32], [-0.2, 0.95, -0.06, 0.28], [0.05, 1.5, 0.02, 0.38]] as [number, number, number, number][]) c.batch.add(ROOM, T.hedge, geo("terraco-ball", () => new THREE.IcosahedronGeometry(1, 3)), at(f, x, 0.86 + y, z, R() * 3, s, s * 0.85, s), { cast: true });
    return;
  }
  // oliveira de vários troncos com a copa em ramos de folhas prateadas
  for (let k = 0; k < 3; k++) { const a = k * 2.1; c.batch.add(ROOM, T.bark, tube(`terraco-oliveTrunk${k}`, [[0, 0, 0], [Math.cos(a) * 0.08, 0.6, Math.sin(a) * 0.08], [Math.cos(a) * 0.22, 1.15, Math.sin(a) * 0.2], [Math.cos(a) * 0.3, 1.5, Math.sin(a) * 0.28]], 0.045 - k * 0.006, 16, 6), at(f, 0, 0.86, 0)); }
  c.batch.add(ROOM, solid("oliveCore", "#1e2b19", { rough: 0.95 }), canopyGeometry(7 + (p.id.length % 3)), at(f, 0.05, 2.25, 0, R() * 3, 1.0));
  const sprig = oliveSprigGeometry(), sm = oliveSprigMaterial();
  for (let k = 0; k < (c.q === "high" ? 170 : 80); k++) {
    const a = R() * Math.PI * 2, el = Math.acos(2 * R() - 1), rr = 0.45 + R() * 0.22;
    c.inst.add(ROOM, "oliveSprig", sprig, sm, at(f, Math.sin(el) * Math.cos(a) * rr * 1.2, 2.5 + Math.cos(el) * rr * 0.75, Math.sin(el) * Math.sin(a) * rr * 1.2, a + Math.PI / 2, 0.8 + R() * 0.5, 0.8 + R() * 0.5, 1, (R() - 0.5) * 1.6, (R() - 0.5) * 1.2));
  }
}

/** Estofado de teca (sofá ou poltrona): laterais em ripas, braços largos, almofadas de lona e almofadas de cor. */
function teakSeat(c: PropsCtx, f: Foot, T: TM, seats: number, seed: number) {
  const w = f.w, d = f.d, side = 0.08, R = rand(seed);
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - side / 2);
    for (const z of [-d / 2 + 0.04, d / 2 - 0.04]) box(c, T.teak, f, x, 0, z, side, 0.64, 0.06, 0, true);
    for (let k = 0; k < 5; k++) box(c, T.teak, f, x, 0.12 + k * 0.1, 0, side * 0.6, 0.05, d - 0.1);
    c.batch.add(ROOM, T.teak, rbox(side + 0.04, 0.035, d, 0.012), at(f, x, 0.64, 0), { cast: true });
  }
  // travessa da frente, encosto de ripas, estrado de ripas a 0,28 m e as almofadas (assento a 0,45 m, como o de dentro)
  box(c, T.teak, f, 0, 0.18, d / 2 - 0.05, w - 2 * side, 0.1, 0.04);
  box(c, T.teak, f, 0, 0.18, -d / 2 + 0.05, w - 2 * side, 0.6, 0.04, 0, true);
  for (let k = 0; k < Math.round((w - 2 * side) / 0.12); k++) box(c, T.teakDark, f, -w / 2 + side + 0.06 + k * 0.12, 0.27, 0, 0.07, 0.02, d - 0.12);
  const sw = (w - 2 * side) / seats;
  for (let k = 0; k < seats; k++) {
    const x = -w / 2 + side + sw * (k + 0.5);
    c.batch.add(ROOM, T.canvas, rbox(sw - 0.02, 0.16, d - 0.2, 0.05), at(f, x, 0.29, 0.06), { cast: true });
    c.batch.add(ROOM, T.canvas, rbox(sw - 0.03, 0.46, 0.15, 0.06), at(f, x, 0.43, -d / 2 + 0.16, 0, 1, 1, 1, -0.16), { cast: true });
    c.batch.add(ROOM, k % 2 ? T.olive : T.terracotta, rbox(0.4, 0.38, 0.12, 0.05, 3), at(f, x + (R() - 0.5) * 0.1, 0.47, -d / 2 + 0.3, (R() - 0.5) * 0.4, 1, 1, 1, -0.35, (R() - 0.5) * 0.2));
  }
}
export function outdoorSofa(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P);
  teakSeat(c, f, T, Math.max(2, Math.round(f.w / 0.85)), p.id.length * 11);
  // manta dobrada sobre o braço
  box(c, T.wool, f, f.w / 2 - 0.04, 0.665, 0.05, 0.14, 0.05, 0.42, 0.1);
}
export function outdoorChair(p: Prop, c: PropsCtx) { const f = footOf(p), T = terraMats(c.q, c.P); teakSeat(c, f, T, 1, p.id.length * 17 + 3); }

/** Mesa de fogo: corpo de basalto, tampo de travertino, calha de vidro granulado, para-vento de vidro e as chamas. */
export const pendingFlames: { room: "terraco"; mesh: THREE.InstancedMesh; base: THREE.Matrix4[] }[] = [];
export function fireTable(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P), w = f.w, d = f.d, h = 0.42;
  c.batch.add(ROOM, T.basalt, rbox(w - 0.04, h - 0.05, d - 0.04, 0.03), at(f, 0, 0, 0), { cast: true });
  for (const s of [-1, 1]) c.batch.add(ROOM, T.travertine, rbox(w, 0.05, (d - 0.24) / 2, 0.012, 2), at(f, 0, h - 0.05, s * (0.12 + (d - 0.24) / 4)));
  for (const s of [-1, 1]) c.batch.add(ROOM, T.travertine, rbox((w - 0.86) / 2, 0.05, 0.24, 0.012, 2), at(f, s * (0.43 + (w - 0.86) / 4), h - 0.05, 0));
  box(c, c.P.darkSteel, f, 0, h - 0.06, 0, 0.86, 0.04, 0.24);
  const R = rand(31);
  for (let k = 0; k < 140; k++) c.inst.add(ROOM, "terraco-bead", SPH(6), solid("terraco-beadMat", "#c98a40", { rough: 0.15, env: 1.5, transparent: true, opacity: 0.85 }), at(f, (R() - 0.5) * 0.8, h - 0.015 + R() * 0.015, (R() - 0.5) * 0.2, 0, 0.012, 0.009, 0.012), new THREE.Color().setHSL(0.07 + R() * 0.05, 0.6, 0.35 + R() * 0.3));
  for (const s of [-1, 1]) { box(c, T.glass, f, 0, h, s * 0.15, 0.96, 0.18, 0.01); box(c, T.glass, f, s * 0.48, h, 0, 0.01, 0.18, 0.3); }
  for (const s of [-1, 1]) for (const t of [-1, 1]) box(c, T.steel, f, s * 0.48, h, t * 0.15, 0.012, 0.18, 0.012);
  // chamas: cruzes de planos aditivos numa malha instanciada própria (a cena mexe em cada uma a cada quadro)
  const fg = geo("terraco-flameCross", () => { const a = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), b = a.clone().rotateY(Math.PI / 2); const out = new THREE.BufferGeometry(); const pa = a.toNonIndexed(), pb = b.toNonIndexed(); for (const k of ["position", "uv", "normal"] as const) { const A1 = pa.getAttribute(k).array as Float32Array, B1 = pb.getAttribute(k).array as Float32Array, arr = new Float32Array(A1.length + B1.length); arr.set(A1); arr.set(B1, A1.length); out.setAttribute(k, new THREE.BufferAttribute(arr, k === "uv" ? 2 : 3)); } return out; });
  const fm = areaMat("terraco-flameMat", () => new THREE.MeshBasicMaterial({ map: flameTexture(), color: new THREE.Color("#ffffff").multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const n = 7, im = new THREE.InstancedMesh(fg, fm, n), base: THREE.Matrix4[] = [];
  for (let k = 0; k < n; k++) { const m = at(f, -0.36 + k * 0.12, h - 0.01, (k % 2 ? 0.03 : -0.03), k * 0.7, 0.11, 0.26, 0.11); base.push(m); im.setMatrixAt(k, m); }
  im.userData.room = ROOM; im.frustumCulled = false; im.renderOrder = 4; c.group.add(im);
  pendingFlames.push({ room: ROOM, mesh: im, base });
  lamp(c.anchors, ROOM, world(f, 0, h + 0.35, 0), "#ff9a3c", 5, 4.5, { flicker: 1 });
}

/** Mesa panorâmica de drinks: dois pés de corten em lâmina, travessa, apoio de pés de bronze e o tampo de quartzito. */
export function drinksTable(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P), L = loungeMats(c.q, c.P), w = f.w, d = f.d, h = 1.1;
  for (const s of [-1, 1]) { box(c, T.corten, f, s * (w / 2 - 0.35), 0, 0, 0.06, h - 0.05, d - 0.16, 0, true); box(c, T.corten, f, s * (w / 2 - 0.35), 0, 0, 0.14, 0.04, d - 0.1); }
  box(c, T.corten, f, 0, 0.62, -0.08, w - 0.7, 0.12, 0.05);
  c.batch.add(ROOM, T.bronze, CYL(12), at(f, 0, 0.24, d / 2 - 0.06, 0, 0.018, w - 0.5, 0.018, 0, Math.PI / 2));
  for (const s of [-1, 1]) c.batch.add(ROOM, T.bronze, CYL(8), at(f, s * (w / 2 - 0.35), 0.24, d / 2 - 0.13, 0, 0.012, 0.14, 0.012, Math.PI / 2));
  c.batch.add(ROOM, T.quartz, rbox(w + 0.1, 0.05, d + 0.06, 0.015, 2), at(f, 0, h - 0.05, 0), { cast: true });
  // sobre o tampo: lanternas de vidro, balde com espumante, taças com drinks, fruteira de cítricos e um vaso de suculenta
  for (const x of [-1.15, 1.2]) terraceLantern(c, T, at(f, x, h, -0.1), 0.55);
  c.batch.add(ROOM, T.steel, lathe("terraco-bucket", [[0, 0], [0.09, 0], [0.1, 0.02], [0.115, 0.22], [0.12, 0.23], [0.105, 0.23], [0.095, 0.03], [0, 0.03]], 20), at(f, -0.45, h, -0.12));
  bottleAt(c, ROOM, L, at(f, -0.45, h + 0.06, -0.12, 0.5, 1, 1, 1, 0.3), 0, 12, new THREE.Color("#22311f"));
  for (const [x, z, k] of [[-0.75, 0.18, 0], [0.1, 0.2, 1], [0.32, 0.12, 3], [0.62, 0.22, 0]] as [number, number, 0 | 1 | 2 | 3][]) glassAt(c, ROOM, L, at(f, x, h, z), k, k === 0 ? L.drinkRose : k === 1 ? L.drinkGold : L.drinkAmber);
  c.batch.add(ROOM, T.travertine, lathe("terraco-fruitBowl", [[0, 0], [0.06, 0], [0.13, 0.06], [0.14, 0.07], [0, 0.04]], 18), at(f, 0.85, h, -0.14));
  const R = rand(51); for (let k = 0; k < 6; k++) c.inst.add(ROOM, "terraco-citrus", SPH(10), solid(k % 2 ? "terraco-lemon" : "terraco-lime", k % 2 ? "#d9b52a" : "#6f9a2a", { rough: 0.55 }), at(f, 0.85 + (R() - 0.5) * 0.14, h + 0.07 + R() * 0.03, -0.14 + (R() - 0.5) * 0.14, 0, 0.04));
  c.batch.add(ROOM, T.terracottaPot, lathe("terraco-smallPot", [[0, 0], [0.05, 0], [0.065, 0.09], [0.07, 0.1], [0, 0.1]], 14), at(f, 1.35, h, 0.18));
  for (let k = 0; k < 9; k++) { const a = (k / 9) * 6.28; c.inst.add(ROOM, "terraco-succ", geo("terraco-succGeo", () => new THREE.ConeGeometry(0.02, 0.07, 6).translate(0, 0.035, 0)), solid("terraco-succMat", "#7a9a7a", { rough: 0.6 }), at(f, 1.35 + Math.cos(a) * 0.03, h + 0.1, 0.18 + Math.sin(a) * 0.03, 0, 1, 1, 1, Math.cos(a) * 0.6, Math.sin(a) * 0.6)); }
}

/** Banco de contemplação: dois blocos de travertino e o assento grosso de teca, uma manta e a lanterna no chão. */
export function contemplationBench(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P), w = f.w, d = f.d;
  for (const s of [-1, 1]) c.batch.add(ROOM, T.travertine, rbox(0.42, 0.37, d - 0.04, 0.02, 2), at(f, s * (w / 2 - 0.3), 0, 0), { cast: true });
  c.batch.add(ROOM, T.teak, rbox(w, 0.08, d, 0.02, 2), at(f, 0, 0.37, 0), { cast: true });
  box(c, T.wool, f, w / 2 - 0.45, 0.45, 0, 0.34, 0.05, 0.3, 0.2);
  terraceLantern(c, T, at(f, -w / 2 - 0.25, 0, 0.05), 1.3);
}

/** Totem de arte luminosa: base de bronze, cinco prismas que torcem e acendem por dentro, frisos e o pináculo. */
export const pendingTotem: THREE.MeshBasicMaterial[] = [];
export function totem(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P);
  c.batch.add(ROOM, T.bronze, lathe("terraco-totemBase", [[0, 0], [0.32, 0], [0.33, 0.03], [0.3, 0.06], [0.28, 0.3], [0.31, 0.33], [0.3, 0.36], [0, 0.36]], 8), at(f, 0, 0, 0, Math.PI / 8), { cast: true });
  const light = areaMat("terraco-totemMat", () => new THREE.MeshBasicMaterial({ map: totemTexture(), color: new THREE.Color("#ffc8e0").multiplyScalar(1.5) }));
  pendingTotem.push(light);
  for (let k = 0; k < 5; k++) {
    const y = 0.38 + k * 0.45, ry = k * 0.32;
    c.batch.add(ROOM, light, BOX0(), at(f, 0, y, 0, ry, 0.34, 0.4, 0.34));
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) c.batch.add(ROOM, T.bronze, BOX0(), mul(at(f, 0, y, 0, ry), mat(dx * 0.172, 0, dz * 0.172, 0, 0.016, 0.4, 0.016)));
    c.batch.add(ROOM, T.bronze, BOX0(), at(f, 0, y + 0.4, 0, ry + 0.16, 0.4, 0.05, 0.4));
  }
  c.batch.add(ROOM, T.bronze, lathe("terraco-totemTop", [[0, 0], [0.12, 0], [0.04, 0.3], [0, 0.34]], 8), at(f, 0, 2.63, 0, 0.6));
  lamp(c.anchors, ROOM, world(f, 0, 1.4, 0), "#ffb8d8", 4, 4.5);
}

/** Bistrô: mesa de ferro fundido com tampo de mármore, xícaras, a vela e um vasinho; e a cadeira de ferro com voluta. */
export function bistroTable(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P), L = loungeMats(c.q, c.P), r = f.r * 0.95;
  c.batch.add(ROOM, T.iron, lathe("terraco-bistroCol", [[0, 0.04], [0.03, 0.04], [0.025, 0.4], [0.045, 0.62], [0.06, 0.7], [0, 0.7]], 12), at(f, 0, 0, 0));
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; c.batch.add(ROOM, T.iron, tube(`terraco-bistroLeg`, [[0, 0.12, 0], [0.12, 0.05, 0], [0.24, 0.015, 0], [0.27, 0.0, 0]], 0.013, 10, 6), at(f, 0, 0, 0, a)); }
  c.batch.add(ROOM, c.P.marbleWhite, CYL0(28), at(f, 0, 0.7, 0, 0, r, 0.025, r), { cast: true });
  for (const s of [-1, 1]) { c.batch.add(ROOM, solid("terraco-porcelain", "#f2efe8", { rough: 0.25 }), lathe("terraco-cup", [[0, 0], [0.03, 0], [0.04, 0.05], [0.036, 0.05], [0.026, 0.006], [0, 0.006]], 14), at(f, s * 0.12, 0.725, s * 0.08)); c.batch.add(ROOM, solid("terraco-porcelain", "#f2efe8", { rough: 0.25 }), CYL0(16), at(f, s * 0.12, 0.725, s * 0.08, 0, 0.065, 0.006, 0.065)); }
  glassAt(c, ROOM, L, at(f, -0.1, 0.725, -0.12), 2, null);
  c.inst.add(ROOM, "candle", CYL0(8), c.P.candle, at(f, -0.1, 0.725, -0.12, 0, 0.025, 0.05, 0.025));
  c.inst.add(ROOM, "lanternFlame", flameGeo(), c.P.flame, at(f, -0.1, 0.79, -0.12, 0, 0.012));
  c.flames.push(world(f, -0.1, 0.79, -0.12));
  // cinzeiro de pedra
  c.batch.add(ROOM, T.basalt, lathe("terraco-ashtray", [[0, 0], [0.06, 0], [0.065, 0.025], [0.045, 0.025], [0.04, 0.012], [0, 0.012]], 16), at(f, 0.1, 0.725, -0.14));
  lamp(c.anchors, ROOM, world(f, -0.1, 0.9, -0.12), "#ffb15a", 1.6, 2.4, { flicker: 1 });
}
export function cafeChair(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P);
  for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [0.17, 0.17], [-0.17, 0.17]]) c.batch.add(ROOM, T.iron, CYL(6), at(f, x, 0.23, z, 0, 0.011, 0.46, 0.011, z * 0.3, -x * 0.3));
  c.batch.add(ROOM, T.iron, geo("terraco-seatRing", () => new THREE.TorusGeometry(0.2, 0.012, 6, 24).rotateX(Math.PI / 2)), at(f, 0, 0.45, 0));
  c.batch.add(ROOM, T.olive, lathe("terraco-seatPad", [[0, 0], [0.2, 0], [0.2, 0.03], [0.17, 0.045], [0, 0.05]], 20), at(f, 0, 0.45, 0));
  c.batch.add(ROOM, T.iron, tube("terraco-chairBack", [[-0.17, 0.46, -0.16], [-0.18, 0.7, -0.2], [-0.1, 0.86, -0.22], [0.1, 0.86, -0.22], [0.18, 0.7, -0.2], [0.17, 0.46, -0.16]], 0.011, 24, 6), at(f, 0, 0, 0));
  for (const s of [-1, 1]) c.batch.add(ROOM, T.iron, geo("terraco-scroll", () => new THREE.TorusGeometry(0.05, 0.007, 5, 16, Math.PI * 1.6)), at(f, s * 0.06, 0.68, -0.21, 0, 1, 1, 1, 0, s * 0.8));
}
/** Cinzeiro de pé (cilindro de inox com areia) ao lado da saída. */
export function urn(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P);
  c.batch.add(ROOM, T.steel, lathe("terraco-urn", [[0, 0], [0.13, 0], [0.135, 0.02], [0.13, 0.6], [0.14, 0.62], [0.125, 0.63], [0, 0.6]], 20), at(f, 0, 0, 0), { cast: true });
  c.batch.add(ROOM, solid("terraco-sand", "#c8b994", { rough: 1 }), CYL0(16), at(f, 0, 0.6, 0, 0, 0.12, 0.012, 0.12));
}

/** Canteiro elevado de pedra: paredes, capeamento, terra e as plantas (bolas de buxo, lavanda, capim e a base da hera). */
export function raisedBed(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P), w = f.w, d = f.d, h = 0.55, R = rand(p.id.length * 19 + Math.round(f.cx * 7));
  box(c, T.stone, f, 0, 0, d / 2 - 0.05, w, h - 0.05, 0.1, 0, true);
  for (const s of [-1, 1]) box(c, T.stone, f, s * (w / 2 - 0.05), 0, 0, 0.1, h - 0.05, d);
  for (const [z, dd] of [[d / 2 - 0.06, 0.16]] as [number, number][]) c.batch.add(ROOM, T.stone, rbox(w + 0.04, 0.05, dd, 0.012, 2), at(f, 0, h - 0.05, z));
  for (const s of [-1, 1]) c.batch.add(ROOM, T.stone, rbox(0.16, 0.05, d, 0.012, 2), at(f, s * (w / 2 - 0.06), h - 0.05, 0));
  box(c, T.soil, f, 0, 0, -0.02, w - 0.18, h - 0.08, d - 0.18);
  // bolas de buxo a cada ~0,9 m e, entre elas, lavanda e capim
  const n = Math.max(1, Math.round(w / 0.9));
  for (let k = 0; k < n; k++) {
    const x = -w / 2 + (k + 0.5) * w / n, s = 0.2 + R() * 0.06;
    c.batch.add(ROOM, T.hedge, geo("terraco-ball", () => new THREE.IcosahedronGeometry(1, 3)), at(f, x, h - 0.05 + s * 0.8, 0.02, R() * 3, s, s * 0.9, s), { cast: true });
    for (let j = 0; j < (c.q === "high" ? 16 : 8); j++) {
      const xx = x + w / n * 0.5 * (R() - 0.2), zz = (R() - 0.5) * (d - 0.25), lav = (k + j) % 3 !== 0;
      if (Math.abs(xx - x) < s * 0.9) continue;
      c.inst.add(ROOM, lav ? "terraco-lavStem" : "terraco-grass", lav ? CYL0(4) : geo("terraco-bladeGeo", () => new THREE.PlaneGeometry(0.02, 1).translate(0, 0.5, 0)), lav ? T.grass : T.grass, at(f, xx, h - 0.06, zz, R() * 3, lav ? 0.004 : 1, lav ? 0.32 + R() * 0.12 : 0.38 + R() * 0.2, lav ? 0.004 : 1, (R() - 0.5) * 0.5, (R() - 0.5) * 0.5));
      if (lav) c.inst.add(ROOM, "terraco-lavFlower", geo("terraco-lavGeo", () => new THREE.CylinderGeometry(0.012, 0.006, 1, 5).translate(0, 0.5, 0)), T.lavender, at(f, xx, h - 0.06 + 0.3, zz, 0, 1, 0.09, 1, (R() - 0.5) * 0.4, (R() - 0.5) * 0.4));
    }
  }
}


/** Pilar do pergolado: sapata de pedra, pé de aço, pilar de madeira chanfrado e a hera subindo em espiral. */
export function pergolaPost(p: Prop, c: PropsCtx) {
  const f = footOf(p), T = terraMats(c.q, c.P), h = 2.9;
  c.batch.add(ROOM, T.stone, rbox(0.28, 0.12, 0.28, 0.02, 2), at(f, 0, 0, 0), { cast: true });
  c.batch.add(ROOM, T.iron, BOX0(), at(f, 0, 0.12, 0, 0, 0.2, 0.16, 0.2));
  c.batch.add(ROOM, T.teakDark, rbox(0.15, h - 0.28, 0.15, 0.02, 2), at(f, 0, 0.28, 0), { cast: true });
  c.batch.add(ROOM, T.iron, BOX0(), at(f, 0, h - 0.18, 0, 0, 0.18, 0.12, 0.18));
  const pts: [number, number, number][] = []; for (let j = 0; j <= 24; j++) { const a = j * 0.75; pts.push([Math.cos(a) * 0.11, 0.1 + j * (h - 0.1) / 24, Math.sin(a) * 0.11]); }
  c.batch.add(ROOM, T.vine, tube(`terraco-postVine`, pts, 0.014, 60, 5), at(f, 0, 0, 0));
  const R = rand(p.id.length * 23 + Math.round(f.cx * 10));
  for (let k = 0; k < (c.q === "high" ? 70 : 34); k++) {
    const y = 0.3 + R() * (h - 0.3), a = R() * 6.28, s = 0.07 + R() * 0.06;
    c.inst.add(ROOM, "terraco-leaf", leafGeo(Math.floor(R() * 4)), T.leaf, at(f, Math.cos(a) * 0.12, y, Math.sin(a) * 0.12, -a + Math.PI / 2, s, s, s, -0.4, (R() - 0.5) * 2), new THREE.Color().setHSL(0.25 + R() * 0.05, 0.45, 0.3 + R() * 0.12));
  }
}
