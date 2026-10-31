/*
 * MET Gala Heist v2 — móveis do lounge (Z05), cada um desenhado na forma de colisão da planta (lib/heist/level.ts):
 *  · bar de Davi: balcão curvo (cabeceiras em quarto de círculo) com frente de ônix retroiluminado entre pilastras de
 *    latão, tampo de mármore negro com descanso de couro, trilho de pés, estação do barman (cuba de gelo, pia, trilho de
 *    garrafas) e o que está sobre ele (coqueteleiras, copo de mistura, balde de champanhe, taças com bebida, cardápios);
 *  · banquetas de bar giratórias, sofás modulares capitonê de veludo, poltronas club de couro com tachas, mesas baixas
 *    de mármore e latão com livros de arte, guéridons com abajur plissado, piano de cauda com banqueta e partitura,
 *    trumeau (espelho envelhecido sobre console) e biombo de laca com garças em folha de ouro.
 * Materiais e o que se repete (botões, tachas, garrafas, taças, teclas) vão para os lotes e instâncias da sala.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import type { PropsCtx } from "../interior-props";
import { BOX0, CYL, CYL0, SPH, geo, mat, mul } from "../interior-batch";
import { fabric, glass, glow, miscMat, solid, type Palette } from "../interior-mats";
import { rand, type Quality } from "../interior-tex";
import { areaMat, at, footOf, lamp, lathe, pleatedShade, rbox, tube, tufted, world, type Foot } from "./lounge-kit";
import { BOOKS, LABELS, agedMirrorTexture, bookAtlas, labelAtlas, menuTexture, onyxSurface, scoreTexture, screenTexture } from "./lounge-tex";

const ROOM = "lounge";

/* ======================= materiais do lounge ======================= */
export function loungeMats(q: Quality, P: Palette) {
  return {
    velvet: fabric("lounge-velvetOx", "#4e101b", q, { sheen: "#c4505e", rough: 0.74 }),
    velvetTeal: fabric("lounge-velvetTeal", "#0f3b40", q, { sheen: "#5fb3b0", rough: 0.75 }),
    brocade: fabric("lounge-brocade", "#8a6a2a", q, { sheen: "#f0d58a", rough: 0.6 }),
    curtain: fabric("lounge-curtain", "#2e0d2a", q, { sheen: "#a066b8", rough: 0.72 }),
    leather: miscMat("leather", q, "#6c3519"),
    leatherOx: miscMat("leather", q, "#3d0d12"),
    walnut: P.walnut, mahogany: P.mahogany, lacquer: P.lacquer, brass: P.brass, gold: P.gold, black: P.black, marble: P.marbleDark,
    ebony: solid("lounge-ebony", "#120c09", { rough: 0.35, env: 0.8 }),
    bronze: solid("lounge-bronze", "#6a4a26", { metal: 0.9, rough: 0.32 }),
    steel: solid("lounge-steel", "#b9bcbf", { metal: 1, rough: 0.22 }),
    ivory: solid("lounge-ivory", "#f1ebdc", { rough: 0.32 }),
    onyxGlow: areaMat(`lounge-onyxGlow-${q}`, () => { const sf = onyxSurface(q); return new THREE.MeshStandardMaterial({ map: sf.map, emissiveMap: sf.map, emissive: new THREE.Color("#ffe2c0"), emissiveIntensity: 0.95, roughness: 0.1, envMapIntensity: 1.1 }); }),
    onyxTop: areaMat(`lounge-onyxTop-${q}`, () => { const sf = onyxSurface(q); const t = sf.map.clone(); t.repeat.set(0.6, 0.6); t.needsUpdate = true; return new THREE.MeshPhysicalMaterial({ map: t, color: new THREE.Color("#c9a77a"), emissiveMap: t, emissive: new THREE.Color("#ff9c4a"), emissiveIntensity: 0.18, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2 }); }),
    mirror: areaMat(`lounge-agedMirror-${q}`, () => new THREE.MeshStandardMaterial({ map: agedMirrorTexture(q), color: new THREE.Color("#b3a182"), metalness: 1, roughness: 0.1, envMapIntensity: 0.95 })),
    bottle: solid("lounge-bottleGlass", "#ffffff", { rough: 0.05, env: 1.7, transparent: true, opacity: 0.84 }),
    label: areaMat("lounge-label", () => new THREE.MeshStandardMaterial({ map: labelAtlas(), roughness: 0.55, side: THREE.DoubleSide })),
    cork: solid("lounge-cork", "#9b7651", { rough: 0.9 }),
    foil: solid("lounge-foil", "#7a1420", { metal: 0.8, rough: 0.35 }),
    glassClear: glass("lounge-glass", { tint: "#e8f0f0", opacity: 0.22, rough: 0.03 }),
    drinkAmber: solid("lounge-drinkAmber", "#b8641c", { rough: 0.05, env: 1.3, transparent: true, opacity: 0.82 }),
    drinkRose: solid("lounge-drinkRose", "#d0485a", { rough: 0.05, env: 1.3, transparent: true, opacity: 0.8 }),
    drinkGold: solid("lounge-drinkGold", "#e2c46a", { rough: 0.05, env: 1.3, transparent: true, opacity: 0.78 }),
    ice: solid("lounge-ice", "#e9f4f7", { rough: 0.12, env: 1.6, transparent: true, opacity: 0.6 }),
    paper: solid("lounge-paper", "#efe6d2", { rough: 0.9 }),
    lime: solid("lounge-lime", "#6d9a2a", { rough: 0.55 }),
    olive: solid("lounge-olive", "#5d6b2a", { rough: 0.4 }),
    rose: solid("lounge-rose", "#8e1426", { rough: 0.7, side: THREE.DoubleSide }),
    leaf: solid("lounge-leaf", "#24401f", { rough: 0.7, side: THREE.DoubleSide }),
  };
}
export type LoungeMats = ReturnType<typeof loungeMats>;

/* ---------- auxiliares no referencial do móvel ---------- */
const box = (c: PropsCtx, m: THREE.Material, f: Foot, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, cast = false) => c.batch.add(ROOM, m, BOX0(), at(f, x, y, z, ry, sx, sy, sz), { cast });
const put = (c: PropsCtx, m: THREE.Material, g: THREE.BufferGeometry, M: THREE.Matrix4, cast = false) => c.batch.add(ROOM, m, g, M, { cast });
const flameGeo = () => geo("flameGeo", () => new THREE.SphereGeometry(1, 6, 5).scale(0.5, 1.4, 0.5));
const coupe = () => lathe("lounge-coupe", [[0, 0], [0.042, 0.003], [0.044, 0.008], [0.006, 0.016], [0.004, 0.09], [0.012, 0.1], [0.052, 0.112], [0.058, 0.14], [0.054, 0.142], [0.0, 0.12]], 16);
const coupeDrink = () => lathe("lounge-coupeDrink", [[0, 0.104], [0.05, 0.13], [0.0, 0.132]], 14);
const tumbler = () => lathe("lounge-tumbler", [[0, 0], [0.038, 0], [0.04, 0.004], [0.042, 0.09], [0.038, 0.09], [0.035, 0.012], [0, 0.012]], 16);
const highball = () => lathe("lounge-highball", [[0, 0], [0.032, 0], [0.033, 0.005], [0.034, 0.15], [0.031, 0.15], [0.03, 0.01], [0, 0.01]], 14);
const martini = () => lathe("lounge-martini", [[0, 0], [0.04, 0.003], [0.006, 0.012], [0.004, 0.1], [0.062, 0.17], [0.058, 0.172], [0.004, 0.106], [0, 0.104]], 16);
/** Garrafas da casa: bordalesa, decanter de conhaque, quadrada de uísque (lados chanfrados), gim facetado. */
const BOTTLES = [
  () => lathe("lounge-btlA", [[0, 0], [0.036, 0], [0.038, 0.012], [0.038, 0.2], [0.03, 0.245], [0.014, 0.27], [0.013, 0.32], [0.016, 0.325], [0, 0.33]], 14),
  () => lathe("lounge-btlB", [[0, 0], [0.05, 0], [0.062, 0.03], [0.066, 0.1], [0.05, 0.17], [0.018, 0.2], [0.016, 0.25], [0.022, 0.255], [0, 0.26]], 16),
  () => lathe("lounge-btlC", [[0, 0], [0.045, 0], [0.046, 0.01], [0.046, 0.19], [0.035, 0.215], [0.016, 0.225], [0.016, 0.28], [0, 0.285]], 4),
  () => lathe("lounge-btlD", [[0, 0], [0.04, 0], [0.042, 0.015], [0.04, 0.2], [0.025, 0.25], [0.015, 0.265], [0.015, 0.3], [0, 0.305]], 8),
];
const BOTTLE_TINT = ["#7a3a10", "#a85a18", "#c8d6c8", "#2a4a2c", "#5a1418", "#d8b860", "#1d2a3a", "#e8e0d0"].map((h) => new THREE.Color(h));
/** Rótulo do atlas (k) colado na frente da garrafa: faixa curva de 0,07 m de altura. */
function labelGeo(k: number, r: number, hgt: number): THREE.BufferGeometry {
  return geo(`lounge-labelGeo-${k}-${r}-${hgt}`, () => {
    const g = new THREE.CylinderGeometry(r, r, hgt, 10, 1, true, -0.85, 1.7);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute, u0 = (k % 8) / 8, v0 = 1 - Math.floor(k / 8) / 2;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 8, v0 - 0.5 + uv.getY(i) * 0.5);
    return g;
  });
}
/**
 * Uma garrafa (forma s, rótulo k) em pé na matriz M: vidro tingido (instância), rótulo do atlas, cápsula ou rolha.
 * Exportada para a estante do bar (lounge.ts) e o terraço.
 */
export function bottleAt(c: { batch: PropsCtx["batch"]; inst: PropsCtx["inst"] }, room: string, L: LoungeMats, M: THREE.Matrix4, s: number, k: number, tint = BOTTLE_TINT[k % BOTTLE_TINT.length]) {
  const r = [0.038, 0.064, 0.046, 0.041][s], h = [0.33, 0.26, 0.285, 0.305][s], ly = [0.11, 0.08, 0.1, 0.11][s];
  c.inst.add(room, `lounge-btl${s}`, BOTTLES[s](), L.bottle, M, tint);
  c.batch.add(room, L.label, labelGeo(k % LABELS.length, r + 0.002, 0.075), mul(M, mat(0, ly, 0)));
  c.inst.add(room, s === 1 ? "lounge-stopper" : "lounge-capsule", s === 1 ? SPH(10) : CYL0(10), s === 1 ? L.bottle : k % 3 ? L.foil : L.cork, mul(M, s === 1 ? mat(0, h + 0.02, 0, 0, 0.03) : mat(0, h - 0.055, 0, 0, r * 0.42, 0.06, r * 0.42)), s === 1 ? new THREE.Color("#e8dcc8") : undefined);
}
/** Taça (coupe, martíni, tumbler, highball) com bebida, numa matriz do mundo. */
export function glassAt(c: { inst: PropsCtx["inst"] }, room: string, L: LoungeMats, M: THREE.Matrix4, kind: 0 | 1 | 2 | 3, drink: THREE.Material | null) {
  const g = [coupe, martini, tumbler, highball][kind]();
  c.inst.add(room, `lounge-glass${kind}`, g, L.glassClear, M);
  if (!drink) return;
  if (kind === 0) c.inst.add(room, "lounge-coupeDrink", coupeDrink(), drink, M);
  else if (kind === 1) c.inst.add(room, "lounge-martiniDrink", geo("lounge-martiniDrinkGeo", () => new THREE.ConeGeometry(0.05, 0.05, 14, 1).rotateX(Math.PI).translate(0, 0.14, 0)), drink, M);
  else { const h = kind === 2 ? 0.05 : 0.11; c.inst.add(room, `lounge-fill${kind}`, CYL0(12), drink, mul(M, mat(0, 0.014, 0, 0, kind === 2 ? 0.036 : 0.029, h, kind === 2 ? 0.036 : 0.029))); c.inst.add(room, "lounge-iceCube", BOX0(), L.ice, mul(M, mat(0.008, h - 0.012, 0.004, 0.5, 0.026, 0.026, 0.026))); }
}
/** Vela em copo de vidro (votiva) com chama e halo. */
function votive(c: PropsCtx, f: Foot, x: number, y: number, z: number, L: LoungeMats) {
  c.inst.add(ROOM, "lounge-votive", geo("lounge-votiveGeo", () => new THREE.CylinderGeometry(0.034, 0.03, 0.075, 14, 1, true).translate(0, 0.0375, 0)), L.glassClear, at(f, x, y, z));
  c.inst.add(ROOM, "candle", CYL0(10), c.P.candle, at(f, x, y, z, 0, 0.026, 0.04, 0.026));
  c.inst.add(ROOM, "flame", flameGeo(), c.P.flame, at(f, x, y + 0.055, z, 0, 0.009));
  c.flames.push(world(f, x, y + 0.055, z));
}

/* ======================= bar de ônix (Davi) ======================= */
/** Contorno do bar em planta (x ao longo, z para a frente): cabeceiras em quarto de círculo; `back` é a borda de trás,
 *  `ins` recua (positivo) ou avança (negativo) a frente e as cabeceiras. */
function barShape(W: number, D: number, back: number, ins: number): THREE.Shape {
  const r = D / 2 - ins, cx = W / 2 - D / 2, s = new THREE.Shape();
  s.moveTo(-W / 2 + ins, back); s.lineTo(W / 2 - ins, back); s.lineTo(W / 2 - ins, 0);
  s.absarc(cx, 0, r, 0, Math.PI / 2, false); s.lineTo(-cx, r); s.absarc(-cx, 0, r, Math.PI / 2, Math.PI, false); s.lineTo(-W / 2 + ins, back);
  return s;
}
/** Laje com o contorno do bar entre y0 e y1. */
const slab = (key: string, s: THREE.Shape, h: number, bevel = 0) => geo(key, () => new THREE.ExtrudeGeometry(s, { depth: h - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 18 }).rotateX(Math.PI / 2).translate(0, h - bevel, 0));
/** Caminho da frente do bar afastado `off` da face (pontos, normais para fora e comprimento acumulado): lateral norte,
 *  cabeceira curva, frente reta, cabeceira curva, lateral sul. */
function frontPath(W: number, D: number, off: number, back: number): { p: THREE.Vector2[]; n: THREE.Vector2[]; s: number[] } {
  const r = D / 2 + off, cx = W / 2 - D / 2, p: THREE.Vector2[] = [], n: THREE.Vector2[] = [];
  const push = (x: number, z: number, nx: number, nz: number) => { p.push(new THREE.Vector2(x, z)); n.push(new THREE.Vector2(nx, nz)); };
  push(W / 2 + off, back, 1, 0);
  for (let k = 0; k <= 10; k++) { const a = (k / 10) * Math.PI / 2; push(cx + Math.cos(a) * r, Math.sin(a) * r, Math.cos(a), Math.sin(a)); }
  for (let k = 0; k <= 10; k++) { const a = Math.PI / 2 + (k / 10) * Math.PI / 2; push(-cx + Math.cos(a) * r, Math.sin(a) * r, Math.cos(a), Math.sin(a)); }
  push(-W / 2 - off, back, -1, 0);
  const s = [0]; for (let k = 1; k < p.length; k++) s.push(s[k - 1] + p[k].distanceTo(p[k - 1]));
  return { p, n, s };
}
/** Fita vertical ao longo do caminho, de y0 a y1 (normais para fora; uv = comprimento / escala, altura / escala). */
function ribbon(key: string, path: ReturnType<typeof frontPath>, y0: number, y1: number, uvScale: number): THREE.BufferGeometry {
  return geo(key, () => {
    const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
    path.p.forEach((pt, k) => {
      for (const y of [y0, y1]) { pos.push(pt.x, y, pt.y); nor.push(path.n[k].x, 0, path.n[k].y); uv.push(path.s[k] / uvScale, y / uvScale); }
      if (k) { const b = (k - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    return g;
  });
}
/** Ponto e normal do caminho a um comprimento `s`. */
function along(path: ReturnType<typeof frontPath>, s: number): { x: number; z: number; ry: number } {
  let k = 1; while (k < path.s.length - 1 && path.s[k] < s) k++;
  const t = (s - path.s[k - 1]) / Math.max(1e-6, path.s[k] - path.s[k - 1]), p = path.p[k - 1].clone().lerp(path.p[k], t), n = path.n[k - 1].clone().lerp(path.n[k], t).normalize();
  return { x: p.x, z: p.y, ry: Math.atan2(n.x, n.y) };
}

export function onyxBar(p: Prop, c: PropsCtx) {
  const f = footOf(p), P = c.P, L = loungeMats(c.q, P), W = f.w, D = f.d, H = 1.1, back = -D / 2;
  // corpo de nogueira, rodapé de mármore negro recuado, faixa alta da frente (o "die") e o tampo com sobra de 6 cm
  put(c, L.marble, slab("lounge-barPlinth", barShape(W, D, back + 0.05, 0.07), 0.1), at(f, 0, 0, 0));
  put(c, L.walnut, slab("lounge-barBody", barShape(W, D, back, 0.012), 0.8), at(f, 0, 0.1, 0), true);
  put(c, L.walnut, slab("lounge-barDie", barShape(W, D, -0.16, 0.012), 0.15), at(f, 0, 0.9, 0), true);
  put(c, L.marble, slab("lounge-barTop", barShape(W, D, -0.2, -0.06), 0.05, 0.012), at(f, 0, 1.05, 0), true);
  // frente de ônix iluminada por dentro, com filetes de latão em cima e embaixo e pilastras caneladas a cada ~1 m
  const face = frontPath(W, D, 0.004, back + 0.06);
  put(c, L.onyxGlow, ribbon("lounge-barOnyx", face, 0.13, 0.98, 1.3), at(f, 0, 0, 0));
  const trim = frontPath(W, D, 0.012, back + 0.06);
  for (const [y0, y1] of [[0.1, 0.13], [0.98, 1.02]]) put(c, L.brass, ribbon(`lounge-barTrim${y0}`, trim, y0, y1, 1), at(f, 0, 0, 0));
  const total = face.s[face.s.length - 1];
  for (let s = 0.3; s < total - 0.2; s += total / 8) {
    const a = along(face, s);
    for (const dx of [-0.018, 0, 0.018]) c.inst.add(ROOM, "lounge-flute", CYL(8), L.brass, mul(at(f, a.x, 0.13, a.z, a.ry), mat(dx, 0.425, 0.012, 0, 0.008, 0.85, 0.008)));
    c.batch.add(ROOM, L.brass, BOX0(), mul(at(f, a.x, 0.13, a.z, a.ry), mat(0, 0.0, 0.006, 0, 0.07, 0.035, 0.02)));
    c.batch.add(ROOM, L.brass, BOX0(), mul(at(f, a.x, 0.93, a.z, a.ry), mat(0, 0.0, 0.006, 0, 0.07, 0.05, 0.02)));
  }
  // descanso de braço em couro (rolo) na borda do tampo e o trilho de pés de latão com mãos-francesas
  const pts = (off: number, y: number, k0: number, k1: number) => { const fp = frontPath(W, D, off, back + 0.08); return fp.p.slice(k0, fp.p.length - k1).map((v) => [v.x, y, v.y] as [number, number, number]); };
  put(c, L.leatherOx, tube("lounge-barArmrest", pts(0.07, 1.1, 1, 1), 0.045, 120, 10), at(f, 0, 0, 0));
  put(c, L.brass, tube("lounge-barFootrail", pts(0.2, 0.2, 1, 1), 0.024, 120, 10), at(f, 0, 0, 0));
  const rail = frontPath(W, D, 0.1, back + 0.08);
  for (let s = 0.6; s < rail.s[rail.s.length - 1] - 0.4; s += 0.9) { const a = along(rail, s); c.batch.add(ROOM, L.brass, CYL(10), mul(at(f, a.x, 0.2, a.z, a.ry), mat(0, 0, 0, 0, 0.014, 0.2, 0.014, Math.PI / 2))); }
  c.batch.add(ROOM, glow("lounge-barUnder", "#ffa94e", 1.6), ribbon("lounge-barUnderGlow", frontPath(W, D, -0.055, back + 0.1), 0.098, 0.104, 1), at(f, 0, 0, 0));
  // estação do barman (de costas para a parede): tampo de inox a 0,92 m, cuba de gelo, pia, trilho de garrafas, tábua
  box(c, L.steel, f, 0, 0.9, -0.39, W - 0.3, 0.022, 0.42);
  // cuba de gelo (borda de inox sobre o tampo, gelo amontoado) e a pia com a torneira em pescoço de ganso
  for (const [x, z, sx, sz] of [[-0.9, -0.22, 0.6, 0.02], [-0.9, -0.56, 0.6, 0.02], [-1.19, -0.39, 0.02, 0.34], [-0.61, -0.39, 0.02, 0.34]] as [number, number, number, number][]) box(c, L.steel, f, x, 0.922, z, sx, 0.05, sz);
  for (let k = 0; k < 60; k++) { const R = rand(900 + k); c.inst.add(ROOM, "lounge-iceCube", BOX0(), L.ice, at(f, -0.9 + (R() - 0.5) * 0.5, 0.924 + R() * 0.035, -0.39 + (R() - 0.5) * 0.28, R() * 3, 0.03, 0.03, 0.03)); }
  box(c, P.darkSteel, f, 0.7, 0.921, -0.39, 0.4, 0.004, 0.28);
  c.batch.add(ROOM, L.steel, lathe("lounge-faucet", [[0.012, 0], [0.012, 0.22], [0.01, 0.24], [0, 0.24]], 8), at(f, 0.7, 0.92, -0.55));
  c.batch.add(ROOM, L.steel, CYL(8), at(f, 0.7, 1.15, -0.5, 0, 0.01, 0.12, 0.01, Math.PI / 2));
  // trilho de garrafas nas costas do balcão (do lado do barman)
  box(c, L.steel, f, 0, 0.45, back - 0.05, W - 0.6, 0.02, 0.1);
  box(c, L.steel, f, 0, 0.55, back - 0.1, W - 0.6, 0.03, 0.01);
  for (let k = 0; k < 9; k++) { const x = -1.8 + k * 0.45; bottleAt(c, ROOM, L, at(f, x, 0.47, back - 0.05, Math.PI), [0, 3, 2, 0, 1, 3, 0, 2, 3][k] as 0 | 1 | 2 | 3, k + 3); }
  box(c, solid("lounge-board", "#a07a4a", { rough: 0.8 }), f, 1.4, 0.922, -0.4, 0.4, 0.02, 0.26);
  for (let k = 0; k < 4; k++) c.inst.add(ROOM, "lounge-limeHalf", geo("lounge-limeHalfGeo", () => new THREE.SphereGeometry(0.03, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), L.lime, at(f, 1.3 + k * 0.07, 0.942, -0.42 + (k % 2) * 0.06));
  for (let k = 0; k < 12; k++) glassAt(c, ROOM, L, at(f, -2.4 + (k % 6) * 0.09, 1.013, -0.5 + Math.floor(k / 6) * 0.09, 0, 1, 1, 1, Math.PI), 2, null);
  // sobre o tampo (y 1,1): a estação de Davi no meio, as taças dos convidados, o balde de champanhe, velas e cardápios
  const top = 1.1, front = D / 2 - 0.05;
  c.batch.add(ROOM, L.steel, lathe("lounge-tin", [[0, 0], [0.04, 0], [0.046, 0.18], [0.044, 0.185], [0, 0.185]], 16), at(f, 0.1, top, front - 0.25));
  c.batch.add(ROOM, L.glassClear, lathe("lounge-mixGlass", [[0, 0], [0.045, 0], [0.047, 0.14], [0.044, 0.14], [0.04, 0.01], [0, 0.01]], 16), at(f, -0.12, top, front - 0.28));
  c.inst.add(ROOM, "lounge-fillMix", CYL0(12), L.drinkAmber, at(f, -0.12, top + 0.012, front - 0.28, 0, 0.04, 0.07, 0.04));
  c.batch.add(ROOM, L.steel, CYL(6), at(f, -0.1, top + 0.13, front - 0.28, 0, 0.003, 0.3, 0.003, 0.18));
  c.batch.add(ROOM, L.steel, lathe("lounge-cobbler", [[0, 0], [0.04, 0], [0.043, 0.12], [0.03, 0.17], [0.012, 0.2], [0.014, 0.23], [0, 0.235]], 16), at(f, 0.32, top, front - 0.3));
  c.batch.add(ROOM, L.steel, lathe("lounge-jigger", [[0.022, 0], [0.012, 0.035], [0.022, 0.07], [0, 0.07]], 12), at(f, 0.22, top, front - 0.12));
  glassAt(c, ROOM, L, at(f, 0.0, top, front - 0.08), 0, L.drinkRose);
  glassAt(c, ROOM, L, at(f, -0.32, top, front - 0.1), 1, L.drinkGold);
  c.inst.add(ROOM, "lounge-olive", SPH(8), L.olive, at(f, -0.3, top + 0.15, front - 0.1, 0, 0.012, 0.009, 0.009));
  for (const [x, k] of [[-1.95, 0], [1.95, 2], [-1.6, 3], [2.2, 1]] as [number, 0 | 1 | 2 | 3][]) glassAt(c, ROOM, L, at(f, x, top, front - 0.1), k, k === 0 ? L.drinkRose : k === 1 ? L.drinkGold : L.drinkAmber);
  // balde de champanhe (latão martelado) com gelo e garrafa inclinada
  c.batch.add(ROOM, L.brass, lathe("lounge-bucket", [[0, 0], [0.09, 0], [0.1, 0.02], [0.115, 0.2], [0.125, 0.215], [0.11, 0.215], [0.1, 0.03], [0, 0.03]], 20), at(f, -2.55, top, -0.02));
  for (const s of [-1, 1]) c.batch.add(ROOM, L.brass, geo("lounge-bucketRing", () => new THREE.TorusGeometry(0.03, 0.006, 6, 12)), at(f, -2.55 + s * 0.12, top + 0.17, -0.02, Math.PI / 2));
  for (let k = 0; k < 14; k++) { const R = rand(700 + k); c.inst.add(ROOM, "lounge-iceCube", BOX0(), L.ice, at(f, -2.55 + (R() - 0.5) * 0.15, top + 0.17 + R() * 0.03, -0.02 + (R() - 0.5) * 0.15, R() * 3, 0.03, 0.03, 0.03)); }
  bottleAt(c, ROOM, L, at(f, -2.55, top + 0.05, -0.02, 0.3, 1, 1, 1, 0.32), 0, 12, new THREE.Color("#22311f"));
  for (const x of [-1.05, 0.95, 2.6]) votive(c, f, x, top, front - 0.18, L);
  // cardápios em tenda (papel dobrado) com a carta da casa
  const menu = areaMat("lounge-menuMat", () => new THREE.MeshStandardMaterial({ map: menuTexture("Bar Lumière"), roughness: 0.85, side: THREE.DoubleSide }));
  for (const x of [-1.35, 1.4]) for (const s of [-1, 1]) c.batch.add(ROOM, menu, geo("lounge-menuLeaf", () => new THREE.PlaneGeometry(0.1, 0.15).translate(0, 0.075, 0)), at(f, x, top, front - 0.2 + s * 0.035, s > 0 ? 0 : Math.PI, 1, 1, 1, -0.24));
  // tigela de castanhas, rosa num vaso fino e a campainha de balcão
  c.batch.add(ROOM, L.brass, lathe("lounge-bowl", [[0, 0], [0.03, 0], [0.07, 0.04], [0.075, 0.045], [0, 0.03]], 18), at(f, 0.62, top, front - 0.16));
  for (let k = 0; k < 12; k++) { const R = rand(800 + k); c.inst.add(ROOM, "lounge-nut", SPH(6), solid("lounge-nutMat", "#a9773e", { rough: 0.7 }), at(f, 0.62 + (R() - 0.5) * 0.08, top + 0.035 + R() * 0.01, front - 0.16 + (R() - 0.5) * 0.08, R() * 3, 0.014, 0.01, 0.01)); }
  c.batch.add(ROOM, L.glassClear, lathe("lounge-budVase", [[0, 0], [0.025, 0], [0.028, 0.03], [0.012, 0.12], [0.016, 0.2], [0, 0.2]], 12), at(f, 1.15, top, front - 0.3));
  c.batch.add(ROOM, L.leaf, CYL(5), at(f, 1.15, top + 0.25, front - 0.3, 0, 0.003, 0.22, 0.003));
  c.inst.add(ROOM, "lounge-roseBud", SPH(8), L.rose, at(f, 1.15, top + 0.37, front - 0.3, 0, 0.022, 0.03, 0.022));
  c.batch.add(ROOM, L.brass, lathe("lounge-bell", [[0, 0], [0.04, 0], [0.04, 0.006], [0.036, 0.03], [0.012, 0.05], [0.004, 0.065], [0, 0.07]], 16), at(f, 2.0, top, front - 0.32));
  // pendentes sobre o balcão (o teto é do lounge.ts; a luz do bar sai daqui)
  for (const x of [-2, 0, 2]) lamp(c.anchors, ROOM, world(f, x, 1.9, 0.1), "#ffb466", 6, 4.2);
  lamp(c.anchors, ROOM, world(f, 0, 0.6, D / 2 + 0.6), "#ff9a48", 2.4, 2.4);
}

/* ======================= banqueta de bar ======================= */
export function barStool(p: Prop, c: PropsCtx) {
  const f = footOf(p), L = loungeMats(c.q, c.P);
  c.batch.add(ROOM, L.brass, lathe("lounge-stoolBase", [[0, 0], [0.2, 0], [0.205, 0.008], [0.19, 0.022], [0.06, 0.04], [0.04, 0.05], [0, 0.05]], 28), at(f, 0, 0, 0), { cast: true });
  c.batch.add(ROOM, L.brass, lathe("lounge-stoolPost", [[0.03, 0], [0.03, 0.6], [0.045, 0.61], [0.05, 0.64], [0.12, 0.66], [0.13, 0.67], [0, 0.67]], 16), at(f, 0, 0.04, 0), { cast: true });
  c.batch.add(ROOM, L.brass, geo("lounge-stoolRing", () => new THREE.TorusGeometry(0.165, 0.012, 8, 32).rotateX(Math.PI / 2)), at(f, 0, 0.3, 0));
  for (let k = 0; k < 3; k++) c.batch.add(ROOM, L.brass, CYL(6), at(f, 0, 0.3, 0, (k / 3) * Math.PI * 2, 0.008, 0.165, 0.008, Math.PI / 2, 0));
  // assento estofado (couro boi-sangue) com vivo e encosto baixo em meia-lua
  c.batch.add(ROOM, L.leatherOx, lathe("lounge-stoolSeat", [[0, 0], [0.19, 0], [0.205, 0.02], [0.21, 0.05], [0.2, 0.075], [0.16, 0.09], [0, 0.092]], 28), at(f, 0, 0.67, 0), { cast: true });
  c.batch.add(ROOM, L.brass, geo("lounge-stoolPipe", () => new THREE.TorusGeometry(0.205, 0.006, 6, 32).rotateX(Math.PI / 2)), at(f, 0, 0.69, 0));
  c.batch.add(ROOM, L.leatherOx, geo("lounge-stoolBack", () => new THREE.TorusGeometry(0.19, 0.035, 10, 20, Math.PI).rotateX(Math.PI / 2).scale(1, 1.6, 1)), at(f, 0, 0.86, 0, Math.PI));
  for (const s of [-1, 1]) c.batch.add(ROOM, L.brass, CYL(6), at(f, s * 0.17, 0.76, -0.07, 0, 0.008, 0.12, 0.008));
}

/* ======================= sofá modular capitonê ======================= */
/** Pé bola torneado em nogueira com rodízio de latão. */
const bunFoot = () => lathe("lounge-bunFoot", [[0, 0], [0.03, 0], [0.032, 0.012], [0.05, 0.04], [0.052, 0.07], [0.04, 0.095], [0.045, 0.1], [0, 0.1]], 14);
/** Tachas de latão ao longo de um segmento (instâncias). */
function nails(c: PropsCtx, f: Foot, L: LoungeMats, a: [number, number, number], b: [number, number, number], step = 0.035) {
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / step));
  for (let k = 0; k <= n; k++) { const t = k / n; c.inst.add(ROOM, "lounge-nail", SPH(6), L.brass, at(f, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 0, 0.0065)); }
}
/** Estofado com encosto capitonê e braços rolados (sofá ou poltrona), no tecido `cover`. */
function upholstered(c: PropsCtx, f: Foot, L: LoungeMats, cover: THREE.Material, modules: number, seed: number) {
  const w = f.w, d = f.d, arm = Math.min(0.2, w * 0.18), seatY = 0.4, backT = 0.2, topY = 0.8;
  for (const x of [-w / 2 + 0.09, w / 2 - 0.09]) for (const z of [-d / 2 + 0.09, d / 2 - 0.1]) c.inst.add(ROOM, "lounge-bunFoot", bunFoot(), L.walnut, at(f, x, 0, z));
  if (modules > 2) for (const z of [-d / 2 + 0.09, d / 2 - 0.1]) c.inst.add(ROOM, "lounge-bunFoot", bunFoot(), L.walnut, at(f, 0, 0, z));
  // base (caixa estofada) e o encosto
  c.batch.add(ROOM, cover, rbox(w, 0.3, d, 0.05), at(f, 0, 0.1, 0), { cast: true });
  c.batch.add(ROOM, cover, rbox(w, topY - seatY + 0.02, backT, 0.06), at(f, 0, seatY - 0.02, -d / 2 + backT / 2), { cast: true });
  // braços rolados: corpo + rolo em cima (sobressai para fora) + leque pregueado na frente
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - arm / 2);
    c.batch.add(ROOM, cover, rbox(arm, topY - 0.4 - 0.06, d - 0.02, 0.05), at(f, x, 0.4, 0.005), { cast: true });
    c.batch.add(ROOM, cover, geo("lounge-armRoll", () => new THREE.CylinderGeometry(1, 1, 1, 20, 1).rotateX(Math.PI / 2)), at(f, x + s * 0.02, topY - 0.07, 0.005, 0, arm * 0.62, 0.085, d - 0.02));
    nails(c, f, L, [x - arm / 2 + 0.01, 0.13, d / 2 + 0.003], [x + arm / 2 - 0.01, 0.13, d / 2 + 0.003]);
    nails(c, f, L, [x + s * 0.02 - arm * 0.5, topY - 0.18, d / 2 + 0.006], [x + s * 0.02 + arm * 0.5, topY - 0.18, d / 2 + 0.006], 0.03);
  }
  nails(c, f, L, [-w / 2 + arm, 0.12, d / 2 + 0.003], [w / 2 - arm, 0.12, d / 2 + 0.003]);
  // painel capitonê na frente do encosto (relevo de verdade) e os botões
  const tw = w - 2 * arm - 0.04, th = topY - seatY - 0.15, tf = tufted(tw, th, 0.17, 0.035), panel = at(f, 0, seatY + 0.13 + th / 2, -d / 2 + backT + 0.002, 0, 1, 1, 1, -0.08);
  c.batch.add(ROOM, cover, tf.g, panel);
  for (const [x, y] of tf.buttons) c.inst.add(ROOM, "lounge-button", SPH(6), cover, mul(panel, mat(x, y, 0.004, 0, 0.012, 0.012, 0.008)));
  // almofadas do assento por módulo (com a costura de cada módulo) e almofadas soltas
  const sw = (w - 2 * arm) / modules;
  for (let k = 0; k < modules; k++) c.batch.add(ROOM, cover, rbox(sw - 0.015, 0.13, d - backT - 0.06, 0.05), at(f, -w / 2 + arm + sw * (k + 0.5), seatY, backT / 2 + 0.01), { cast: true });
  const R = rand(seed);
  if (modules >= 2) for (let k = 0; k < Math.min(3, modules + 1); k++) {
    const x = -w / 2 + arm + 0.28 + k * ((w - 2 * arm - 0.56) / Math.max(1, Math.min(3, modules + 1) - 1));
    c.batch.add(ROOM, k % 2 ? L.brocade : L.velvetTeal, rbox(0.42, 0.42, 0.13, 0.06, 4), at(f, x, seatY + 0.11, -d / 2 + backT + 0.1, (R() - 0.5) * 0.3, 1, 1, 1, -0.32, (R() - 0.5) * 0.2));
  }
}
export function loungeSofa(p: Prop, c: PropsCtx) {
  const f = footOf(p), L = loungeMats(c.q, c.P), mods = Math.max(2, Math.round(f.w / 0.95));
  upholstered(c, f, L, L.velvet, mods, p.id.length * 7 + 3);
  // manta de lã dobrada caindo sobre um braço (passa por cima do rolo e pende dos dois lados, com a barra ondulada)
  const s = p.id.charCodeAt(p.id.length - 1) % 2 ? 1 : -1, x = s * (f.w / 2 - 0.1);
  c.batch.add(ROOM, fabric("lounge-throw", "#c9b48a", c.q, { rough: 0.95, side: THREE.DoubleSide }), geo("lounge-throwGeo", () => {
    const r = 0.135, half = Math.PI * r / 2, g = new THREE.PlaneGeometry(0.5, 0.9, 12, 36), q = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < q.count; i++) {
      const along = q.getX(i), sv = q.getY(i), a = Math.abs(sv), wav = 0.012 * Math.sin(along * 26 + sv * 9);
      const lat = a < half ? Math.sin(sv / r) * r : Math.sign(sv) * (r + wav), up = a < half ? Math.cos(sv / r) * r : -(a - half);
      q.setXYZ(i, lat, up, along);
    }
    g.computeVertexNormals(); return g;
  }), at(f, x + s * 0.02, 0.73, 0.06));
}
export function armchair(p: Prop, c: PropsCtx) {
  const f = footOf(p), L = loungeMats(c.q, c.P);
  upholstered(c, f, L, L.leather, 1, p.id.length * 5 + 1);
}

/* ======================= mesa baixa ======================= */
export function coffeeTable(p: Prop, c: PropsCtx) {
  const f = footOf(p), L = loungeMats(c.q, c.P), w = f.w, d = f.d, h = 0.42;
  c.batch.add(ROOM, L.marble, rbox(w, 0.04, d, 0.012, 2), at(f, 0, h - 0.04, 0), { cast: true });
  for (const s of [-1, 1]) { box(c, L.brass, f, 0, h - 0.045, s * (d / 2 + 0.004), w + 0.012, 0.048, 0.008); box(c, L.brass, f, s * (w / 2 + 0.004), h - 0.045, 0, 0.008, 0.048, d + 0.012); }
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) box(c, L.brass, f, x, 0, z, 0.025, h - 0.045, 0.025, 0, true);
  for (const s of [-1, 1]) { box(c, L.brass, f, 0, 0.1, s * (d / 2 - 0.05), w - 0.1, 0.02, 0.02); box(c, L.brass, f, s * (w / 2 - 0.05), 0.1, 0, 0.02, 0.02, d - 0.1); }
  box(c, glass("lounge-smoke", { tint: "#2a2622", opacity: 0.5, rough: 0.08 }), f, 0, 0.12, 0, w - 0.1, 0.01, d - 0.1);
  // livros de arte: pilha na prateleira e um aberto em cima; velas em lanternas de vidro; decanter e copos
  const books = areaMat("lounge-bookMat", () => new THREE.MeshStandardMaterial({ map: bookAtlas(), roughness: 0.7 }));
  const R = rand(p.id.length * 31 + 7);
  for (let k = 0; k < 3; k++) {
    const bw = 0.3 - k * 0.03, bd = 0.24 - k * 0.02, y = 0.13 + k * 0.032, kk = (k + p.id.length) % BOOKS.length;
    box(c, L.paper, f, -w / 2 + 0.26, y, 0, bw - 0.01, 0.028, bd - 0.01, (R() - 0.5) * 0.3);
    c.batch.add(ROOM, books, geo(`lounge-bookTop${kk}`, () => { const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); const uv = g.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setX(i, (kk + uv.getX(i)) / 4); return g; }), at(f, -w / 2 + 0.26, y + 0.0285, 0, (R() - 0.5) * 0.3, bw, 1, bd));
  }
  const kk = p.id.length % BOOKS.length;
  c.batch.add(ROOM, books, geo(`lounge-bookTop${kk}`, () => { const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); const uv = g.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setX(i, (kk + uv.getX(i)) / 4); return g; }), at(f, w / 2 - 0.3, h + 0.026, -0.03, 0.4, 0.28, 1, 0.23));
  box(c, L.paper, f, w / 2 - 0.3, h, -0.03, 0.27, 0.025, 0.22, 0.4);
  for (const [x, z, s] of [[-0.08, 0.06, 1], [0.04, -0.08, 0.8], [0.14, 0.08, 1.2]] as [number, number, number][]) {
    c.batch.add(ROOM, L.glassClear, lathe("lounge-hurricane", [[0, 0], [0.05, 0], [0.055, 0.02], [0.06, 0.12], [0.05, 0.2], [0.052, 0.21], [0, 0.21]], 18), at(f, x, h, z, 0, 1, s, 1));
    c.inst.add(ROOM, "candle", CYL0(10), c.P.candle, at(f, x, h, z, 0, 0.032, 0.06 * s, 0.032));
    c.inst.add(ROOM, "flame", flameGeo(), c.P.flame, at(f, x, h + 0.06 * s + 0.018, z, 0, 0.011));
    c.flames.push(world(f, x, h + 0.06 * s + 0.018, z));
  }
  c.batch.add(ROOM, L.glassClear, lathe("lounge-decanter", [[0, 0], [0.06, 0], [0.075, 0.05], [0.07, 0.12], [0.03, 0.17], [0.02, 0.22], [0.026, 0.225], [0, 0.23]], 18), at(f, -w / 2 + 0.55, h, 0.12));
  c.inst.add(ROOM, "lounge-decanterFill", lathe("lounge-decanterFillGeo", [[0, 0.01], [0.058, 0.01], [0.07, 0.05], [0.066, 0.1], [0, 0.1]], 16), L.drinkAmber, at(f, -w / 2 + 0.55, h, 0.12));
  c.inst.add(ROOM, "lounge-stopper", SPH(10), L.bottle, at(f, -w / 2 + 0.55, h + 0.245, 0.12, 0, 0.03), new THREE.Color("#efe6d0"));
  for (const dx of [0.12, 0.2]) glassAt(c, ROOM, L, at(f, -w / 2 + 0.55 + dx, h, 0.08 - dx * 0.3), 2, L.drinkAmber);
  lamp(c.anchors, ROOM, world(f, 0.04, h + 0.25, 0), "#ffb15e", 1.6, 2.6, { flicker: 1 });
}

/* ======================= guéridon com abajur ======================= */
/** Seda da cúpula: translúcida (acende por dentro), dos dois lados. */
export const shadeMat = () => areaMat("lounge-shadeSilk", () => new THREE.MeshStandardMaterial({ color: "#e9cfa2", emissive: new THREE.Color("#ff9c48"), emissiveIntensity: 0.6, roughness: 0.92, side: THREE.DoubleSide }));
export function gueridon(p: Prop, c: PropsCtx) {
  const f = footOf(p), L = loungeMats(c.q, c.P), r = f.r * 0.98, h = 0.62;
  c.batch.add(ROOM, L.brass, lathe("lounge-guerBase", [[0, 0], [0.19, 0], [0.2, 0.012], [0.17, 0.03], [0.05, 0.05], [0.032, 0.08], [0.028, 0.45], [0.04, 0.47], [0.03, 0.52], [0.06, 0.56], [0.06, h - 0.03], [0, h - 0.03]], 24), at(f, 0, 0, 0), { cast: true });
  c.batch.add(ROOM, L.marble, CYL0(32), at(f, 0, h - 0.03, 0, 0, r, 0.03, r), { cast: true });
  c.batch.add(ROOM, L.brass, geo(`lounge-gallery${r.toFixed(2)}`, () => new THREE.TorusGeometry(r, 0.008, 6, 40).rotateX(Math.PI / 2)), at(f, 0, h + 0.012, 0));
  // abajur: pé de latão em balaústre, cúpula plissada de seda, lâmpada acesa e o pingente da corrente
  c.batch.add(ROOM, L.brass, lathe("lounge-lampBase", [[0, 0], [0.075, 0], [0.08, 0.01], [0.05, 0.03], [0.04, 0.1], [0.055, 0.16], [0.02, 0.24], [0.012, 0.42], [0, 0.42]], 18), at(f, 0.06, h, -0.05));
  c.batch.add(ROOM, shadeMat(), pleatedShade(0.17, 0.1, 0.22, 18), at(f, 0.06, h + 0.3, -0.05));
  c.inst.add(ROOM, "lounge-lampGlow", SPH(10), glow("lounge-lampGlowMat", "#ffd29a", 2.2), at(f, 0.06, h + 0.36, -0.05, 0, 0.045));
  c.inst.add(ROOM, "lounge-finial", SPH(8), L.brass, at(f, 0.06, h + 0.55, -0.05, 0, 0.012));
  // porta-retrato (prata) e uma taça
  c.batch.add(ROOM, L.steel, BOX0(), at(f, -0.12, h, -0.08, 0.5, 0.11, 0.14, 0.012, -0.12));
  c.batch.add(ROOM, solid("lounge-photo", "#3a3530", { rough: 0.4 }), BOX0(), at(f, -0.12, h + 0.015, -0.074, 0.5, 0.08, 0.1, 0.004, -0.12));
  glassAt(c, ROOM, L, at(f, -0.1, h, 0.12), 0, L.drinkGold);
  lamp(c.anchors, ROOM, world(f, 0.06, h + 0.42, -0.05), "#ffc27a", 4.2, 4.2);
}

/* ======================= piano de cauda ======================= */
/** Contorno do piano em planta (unidade: largura 1, comprimento 1; frente/teclado em z = +0,5; lado reto dos graves em
 *  x = +0,5 — à esquerda de quem toca, que olha para −z local). */
function pianoShape(mirror = false): THREE.Shape {
  const s = new THREE.Shape(), k = mirror ? -1 : 1;
  s.moveTo(0.5, 0.5 * k); s.lineTo(-0.5, 0.5 * k); s.lineTo(-0.5, 0.18 * k);
  s.bezierCurveTo(-0.5, -0.02 * k, -0.18, -0.02 * k, -0.12, -0.2 * k); s.bezierCurveTo(-0.06, -0.38 * k, 0.02, -0.5 * k, 0.26, -0.5 * k); s.bezierCurveTo(0.42, -0.5 * k, 0.5, -0.42 * k, 0.5, -0.3 * k); s.lineTo(0.5, 0.5 * k);
  return s;
}
const PLANE_ = () => geo("plane", () => new THREE.PlaneGeometry(1, 1));
export function grandPiano(p: Prop, c: PropsCtx) {
  const f = footOf(p), L = loungeMats(c.q, c.P), P = c.P, w = f.w, d = f.d - 0.22, zb = -0.11;   // corpo um pouco atrás: o teclado sobra na frente
  const rim = geo("lounge-pianoRim", () => new THREE.ExtrudeGeometry(pianoShape(), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 24 }).rotateX(Math.PI / 2).translate(0, 0.312, 0));
  put(c, L.lacquer, rim, at(f, 0, 0.62, zb, 0, w, 1, d), true);
  // tampo aberto (dobradiça no lado reto, x = +0,5) a ~35°, a vareta e a chapa dourada com as cordas por dentro
  const lid = geo("lounge-pianoLid", () => new THREE.ExtrudeGeometry(pianoShape(), { depth: 0.018, bevelEnabled: false, curveSegments: 24 }).rotateX(Math.PI / 2).translate(-0.5, 0.018, 0));
  put(c, L.lacquer, lid, mul(at(f, w / 2, 0.945, zb), mat(0, 0, 0, 0, w, 1, d, 0, -0.6)), true);
  c.batch.add(ROOM, L.black, CYL(6), at(f, -w * 0.3, 0.945, zb - d * 0.08, 0, 0.009, 1.02, 0.009, 0, -0.5));
  const plate = areaMat("lounge-pianoPlate", () => new THREE.MeshStandardMaterial({ color: "#b48a3c", metalness: 0.85, roughness: 0.35 }));
  c.batch.add(ROOM, plate, geo("lounge-pianoPlateGeo", () => new THREE.ShapeGeometry(pianoShape(true), 24).rotateX(-Math.PI / 2)), at(f, 0, 0.9, zb, 0, w * 0.94, 1, d * 0.92));
  for (let k = 0; k < 28; k++) c.inst.add(ROOM, "lounge-string", BOX0(), L.steel, at(f, -w * 0.4 + k * w * 0.03, 0.905, zb + d * 0.05, 0, 0.003, 0.003, d * (0.85 - (k / 28) * 0.45)));
  // teclado: caixa, teclas brancas (faixa) e pretas (instâncias), bochechas e a tampa do teclado levantada
  const kw = w * 0.86, kz = zb + d / 2 + 0.11;
  box(c, L.lacquer, f, 0, 0.62, kz, w, 0.12, 0.24, 0, true);
  box(c, L.ivory, f, 0, 0.74, kz + 0.02, kw, 0.022, 0.15);
  for (let k = 0; k < 52; k++) c.inst.add(ROOM, "lounge-keyGap", BOX0(), L.black, at(f, -kw / 2 + (k + 1) * kw / 52, 0.741, kz + 0.02, 0, 0.0015, 0.022, 0.15));
  for (let k = 0; k < 52; k++) { const m = k % 7; if (m === 2 || m === 6) continue; c.inst.add(ROOM, "lounge-keyBlack", BOX0(), L.ebony, at(f, -kw / 2 + (k + 1) * kw / 52, 0.762, kz - 0.02, 0, 0.012, 0.018, 0.09)); }
  for (const s of [-1, 1]) box(c, L.lacquer, f, s * (kw / 2 + (w - kw) / 4), 0.74, kz + 0.02, (w - kw) / 2, 0.06, 0.17);
  box(c, L.lacquer, f, 0, 0.77, kz - 0.09, kw, 0.012, 0.09, 0);
  // estante inclinada com a partitura e as pernas torneadas com rodízios
  const score = areaMat("lounge-scoreMat", () => new THREE.MeshStandardMaterial({ map: scoreTexture(), roughness: 0.9, side: THREE.DoubleSide }));
  const desk = at(f, 0, 0.78, kz - 0.17, 0, 1, 1, 1, -0.22);
  c.batch.add(ROOM, L.lacquer, BOX0(), mul(desk, mat(0, 0, 0, 0, w * 0.5, 0.27, 0.012)));
  c.batch.add(ROOM, L.lacquer, BOX0(), mul(desk, mat(0, 0, 0.03, 0, w * 0.5, 0.012, 0.05)));
  c.batch.add(ROOM, score, PLANE_(), mul(desk, mat(0, 0.15, 0.008, 0, w * 0.42, 0.21, 1)));
  for (const [x, z] of [[-w / 2 + 0.1, kz - 0.06], [w / 2 - 0.1, kz - 0.06], [w * 0.18, zb - d * 0.4]] as [number, number][]) {
    c.batch.add(ROOM, L.lacquer, lathe("lounge-pianoLeg", [[0.045, 0], [0.055, 0.04], [0.042, 0.12], [0.05, 0.3], [0.06, 0.48], [0.07, 0.56], [0.075, 0.62], [0, 0.62]], 16), at(f, x, 0, z), { cast: true });
    c.batch.add(ROOM, L.brass, CYL0(12), at(f, x, 0, z, 0, 0.045, 0.04, 0.045));
  }
  // lira com os três pedais
  for (const s of [-1, 1]) c.batch.add(ROOM, L.lacquer, tube(`lounge-lyre${s}`, [[s * 0.08, 0.62, 0], [s * 0.11, 0.4, 0], [s * 0.06, 0.12, 0], [s * 0.05, 0.03, 0]], 0.014, 12, 6), at(f, 0, 0, kz - 0.18));
  box(c, L.lacquer, f, 0, 0.02, kz - 0.18, 0.24, 0.04, 0.08);
  for (const x of [-0.06, 0, 0.06]) box(c, L.brass, f, x, 0.045, kz - 0.12, 0.022, 0.012, 0.09);
  // banqueta de couro capitonê (o pianista senta nela)
  const bz = kz + 0.36;
  c.batch.add(ROOM, L.lacquer, rbox(0.72, 0.06, 0.34, 0.01), at(f, 0, 0.42, bz));
  const bt = tufted(0.66, 0.3, 0.13, 0.02);
  c.batch.add(ROOM, L.leatherOx, rbox(0.72, 0.05, 0.36, 0.025), at(f, 0, 0.47, bz));
  c.batch.add(ROOM, L.leatherOx, bt.g, at(f, 0, 0.52, bz, 0, 1, 1, 1, -Math.PI / 2));
  for (const [x, y] of bt.buttons) c.inst.add(ROOM, "lounge-button", SPH(6), L.leatherOx, at(f, x, 0.522, bz - y, 0, 0.01, 0.006, 0.01));
  for (const x of [-0.31, 0.31]) for (const z of [-0.13, 0.13]) c.batch.add(ROOM, L.lacquer, lathe("lounge-benchLeg", [[0.022, 0], [0.026, 0.05], [0.02, 0.2], [0.03, 0.4], [0, 0.42]], 10), at(f, x, 0, bz + z));
  void P;
}

/* ======================= trumeau: espelho envelhecido sobre console ======================= */
export function trumeau(p: Prop, c: PropsCtx) {
  const f = footOf(p), L = loungeMats(c.q, c.P), w = f.w, d = f.d;
  // console de nogueira com tampo de mármore e pernas cabriolé (curva em S)
  c.batch.add(ROOM, L.marble, rbox(w - 0.1, 0.03, d - 0.02, 0.008, 2), at(f, 0, 0.82, 0), { cast: true });
  box(c, L.walnut, f, 0, 0.7, -0.01, w - 0.2, 0.12, d - 0.08, 0, true);
  box(c, L.gold, f, 0, 0.72, d / 2 - 0.045, w - 0.3, 0.02, 0.006);
  for (const s of [-1, 1]) c.batch.add(ROOM, L.walnut, tube(`lounge-cabriole${s}`, [[s * (w / 2 - 0.12), 0.7, d / 2 - 0.06], [s * (w / 2 - 0.08), 0.5, d / 2 - 0.02], [s * (w / 2 - 0.14), 0.22, d / 2 - 0.08], [s * (w / 2 - 0.1), 0.02, d / 2 - 0.04]], 0.028, 16, 8), at(f, 0, 0, 0), { cast: true });
  for (const s of [-1, 1]) box(c, L.walnut, f, s * (w / 2 - 0.12), 0, -d / 2 + 0.08, 0.05, 0.7, 0.05);
  // espelho alto em moldura dourada com friso de pérolas e o frontão em voluta
  const mw = w - 0.16, mh = 1.9, my = 0.95;
  c.batch.add(ROOM, L.gold, geo(`lounge-trumFrame-${mw.toFixed(2)}`, () => { const s = new THREE.Shape(); s.moveTo(-mw / 2, 0); s.lineTo(mw / 2, 0); s.lineTo(mw / 2, mh); s.lineTo(-mw / 2, mh); s.closePath(); const h = new THREE.Path(); h.moveTo(-mw / 2 + 0.09, 0.09); h.lineTo(-mw / 2 + 0.09, mh - 0.09); h.lineTo(mw / 2 - 0.09, mh - 0.09); h.lineTo(mw / 2 - 0.09, 0.09); h.closePath(); s.holes.push(h); return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 1 }); }), at(f, 0, my, -d / 2 + 0.03), { cast: true });
  c.batch.add(ROOM, L.mirror, PLANE_(), at(f, 0, my + mh / 2, -d / 2 + 0.035, 0, mw - 0.16, mh - 0.16, 1));
  for (let k = 0; k < 2 * Math.round((mw + mh) / 0.035); k++) {
    const per = 2 * (mw - 0.2 + mh - 0.2), s = (k / (2 * Math.round((mw + mh) / 0.035))) * per;
    let x = 0, y = 0;
    if (s < mw - 0.2) { x = -mw / 2 + 0.1 + s; y = 0.1; } else if (s < mw - 0.2 + mh - 0.2) { x = mw / 2 - 0.1; y = 0.1 + s - (mw - 0.2); } else if (s < 2 * (mw - 0.2) + mh - 0.2) { x = mw / 2 - 0.1 - (s - (mw - 0.2 + mh - 0.2)); y = mh - 0.1; } else { x = -mw / 2 + 0.1; y = mh - 0.1 - (s - (2 * (mw - 0.2) + mh - 0.2)); }
    c.inst.add(ROOM, "lounge-pearl", SPH(6), L.gold, at(f, x, my + y, -d / 2 + 0.07, 0, 0.009));
  }
  c.batch.add(ROOM, L.gold, geo("lounge-crest", () => { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.bezierCurveTo(-0.45, 0.18, -0.2, 0.12, -0.12, 0.26); s.bezierCurveTo(-0.06, 0.36, 0.06, 0.36, 0.12, 0.26); s.bezierCurveTo(0.2, 0.12, 0.45, 0.18, 0.5, 0); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 12 }); }), at(f, 0, my + mh - 0.02, -d / 2 + 0.03, 0, mw * 0.8, 0.9, 1));
  c.inst.add(ROOM, "lounge-pearl", SPH(10), L.gold, at(f, 0, my + mh + 0.27, -d / 2 + 0.06, 0, 0.04));
  // castiçais de latão com velas, um vaso de cristal e uma bandeja com o decanter
  for (const s of [-1, 1]) {
    c.batch.add(ROOM, L.brass, lathe("lounge-candlestick", [[0, 0], [0.06, 0], [0.065, 0.012], [0.02, 0.04], [0.016, 0.2], [0.03, 0.22], [0.034, 0.24], [0, 0.24]], 16), at(f, s * (w / 2 - 0.2), 0.85, 0.02));
    c.inst.add(ROOM, "candle", CYL0(10), c.P.candle, at(f, s * (w / 2 - 0.2), 1.09, 0.02, 0, 0.012, 0.18, 0.012));
    c.inst.add(ROOM, "flame", flameGeo(), c.P.flame, at(f, s * (w / 2 - 0.2), 1.29, 0.02, 0, 0.012));
    c.flames.push(world(f, s * (w / 2 - 0.2), 1.29, 0.02));
  }
  c.batch.add(ROOM, L.glassClear, lathe("lounge-vase", [[0, 0], [0.05, 0], [0.07, 0.08], [0.05, 0.2], [0.06, 0.26], [0, 0.26]], 18), at(f, 0.05, 0.85, 0.0));
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; c.inst.add(ROOM, "lounge-roseBud", SPH(8), L.rose, at(f, 0.05 + Math.cos(a) * 0.06, 1.17 + (k % 2) * 0.04, Math.sin(a) * 0.06, 0, 0.035, 0.03, 0.035)); c.batch.add(ROOM, L.leaf, CYL(5), at(f, 0.05 + Math.cos(a) * 0.03, 1.0, Math.sin(a) * 0.03, 0, 0.003, 0.3, 0.003, Math.sin(a) * 0.2, Math.cos(a) * 0.2)); }
  lamp(c.anchors, ROOM, world(f, 0, 1.4, 0.25), "#ffb466", 2.2, 3, { flicker: 1 });
}

/* ======================= biombo de laca ======================= */
export function lacquerScreen(p: Prop, c: PropsCtx) {
  const f = footOf(p), L = loungeMats(c.q, c.P), n = 3, pw = f.w / n / Math.cos(0.42) * 0.98, h = 1.72;
  const art = areaMat("lounge-screenArt", () => new THREE.MeshStandardMaterial({ map: screenTexture(), roughness: 0.22, metalness: 0.1, envMapIntensity: 1.1 }));
  for (let k = 0; k < n; k++) {
    const ry = (k % 2 ? -1 : 1) * 0.42, x = -f.w / 2 + (k + 0.5) * f.w / n;
    const P0 = at(f, x, 0.06, 0, ry);
    c.batch.add(ROOM, L.lacquer, BOX0(), mul(P0, mat(0, 0, 0, 0, pw, h, 0.03)), { cast: true });
    c.batch.add(ROOM, art, geo(`lounge-screenLeaf${k}`, () => { const g = new THREE.PlaneGeometry(1, 1); const uv = g.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / 3); return g; }), mul(P0, mat(0, h / 2, 0.016, 0, pw - 0.06, h - 0.08, 1)));
    for (const y of [0.25, h - 0.25]) c.batch.add(ROOM, L.brass, CYL(8), mul(P0, mat(pw / 2, y, 0, 0, 0.012, 0.08, 0.012)));
    for (const s of [-1, 1]) c.batch.add(ROOM, L.lacquer, BOX0(), mul(P0, mat(s * (pw / 2 - 0.04), -0.06, 0, 0, 0.05, 0.06, 0.05)));
    c.batch.add(ROOM, L.gold, BOX0(), mul(P0, mat(0, h, 0, 0, pw, 0.02, 0.034)));
  }
}
