/*
 * MET Gala Heist v2 — Terraço-jardim (Z13): o que os móveis e a decoração do terraço usam em comum — a paleta de
 * materiais do jardim (corten, teca, ferro, bronze, pedras, tecidos, folhagem, glicínia), a caixa no referencial do
 * móvel, a chama, as folhas do atlas espalhadas numa treliça e a lanterna de ferro com vela. Saiu de terraco.ts sem
 * mudança.
 */
import * as THREE from "three";
import type { PropsCtx } from "../interior-props";
import { BOX0, CYL0, geo, mat, mul } from "../interior-batch";
import { fabric, glass, miscMat, solid, type Palette } from "../interior-mats";
import { rand, type Quality } from "../interior-tex";
import { areaMat, at, surfaceMat, type Foot } from "./lounge-kit";
import { cortenSurface, leafAtlas, quartziteSurface, wisteriaTexture } from "./terraco-tex";

export const ROOM = "terraco";

/* ======================= materiais ======================= */
export function terraMats(q: Quality, P: Palette) {
  return {
    stone: P.stone, soil: P.soil, bark: P.bark, black: P.black, brass: P.brass,
    corten: surfaceMat(`terraco-cortenMat-${q}`, cortenSurface(q), { metal: 0.25, env: 0.6 }),
    teak: miscMat("grain", q, "#93613a"),
    teakDark: miscMat("grain", q, "#5d3a20"),
    iron: solid("terraco-iron", "#1b1c1e", { metal: 0.55, rough: 0.48 }),
    bronze: solid("terraco-bronze", "#5b4124", { metal: 0.9, rough: 0.34 }),
    steel: solid("terraco-steel", "#b9bdc0", { metal: 1, rough: 0.25 }),
    basalt: solid("terraco-basalt", "#2a2928", { rough: 0.82 }),
    travertine: solid("terraco-travertine", "#d6c7a6", { rough: 0.7 }),
    canvas: fabric("terraco-canvas", "#d8ccb2", q, { rough: 0.95 }),
    terracotta: fabric("terraco-pillowRust", "#a4512f", q, { rough: 0.9 }),
    olive: fabric("terraco-pillowOlive", "#5b6a3a", q, { rough: 0.9 }),
    wool: fabric("terraco-wool", "#8a7a5e", q, { rough: 0.98, side: THREE.DoubleSide }),
    quartz: surfaceMat(`terraco-quartzMat-${q}`, quartziteSurface(q), { env: 1.1 }),
    hedge: miscMat("hedge", q),
    leaf: areaMat("terraco-leafMat", () => new THREE.MeshStandardMaterial({ map: leafAtlas(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.65 })),
    wisteria: areaMat("terraco-wisteriaMat", () => new THREE.MeshStandardMaterial({ map: wisteriaTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, emissive: new THREE.Color("#2a1840"), emissiveIntensity: 0.25 })),
    lavender: solid("terraco-lavender", "#7a5aa8", { rough: 0.8 }),
    grass: solid("terraco-grass", "#6a7a3a", { rough: 0.85, side: THREE.DoubleSide }),
    vine: solid("terraco-vine", "#4a3a26", { rough: 0.95 }),
    terracottaPot: solid("terraco-terracotta", "#a5583a", { rough: 0.85 }),
    void: areaMat("terraco-void", () => new THREE.MeshBasicMaterial({ color: "#05070b" })),
    glass: glass("terraco-glass", { tint: "#e6eef0", opacity: 0.2, rough: 0.04 }),
  };
}
export type TM = ReturnType<typeof terraMats>;

export const box = (c: { batch: PropsCtx["batch"] }, m: THREE.Material, f: Foot, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, cast = false) => c.batch.add(ROOM, m, BOX0(), at(f, x, y, z, ry, sx, sy, sz), { cast });
export const flameGeo = () => geo("flameGeo", () => new THREE.SphereGeometry(1, 6, 5).scale(0.5, 1.4, 0.5));
/** Folha (quadrado com recorte) com a origem no pé do pecíolo; o atlas 2 × 2 escolhe a folha pela variante. */
export function leafGeo(k: number): THREE.BufferGeometry {
  // linha 0 do atlas (topo do canvas) fica em v 0,5…1 (a textura vira em y)
  return geo(`terraco-leafGeo${k}`, () => { const g = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0); const uv = g.getAttribute("uv") as THREE.BufferAttribute, r = Math.floor(k / 2); for (let i = 0; i < uv.count; i++) uv.setXY(i, ((k % 2) + uv.getX(i)) / 2, ((1 - r) + uv.getY(i)) / 2); return g; });
}
/** Folhagem espalhada numa superfície vertical (treliça): `count` folhas no retângulo [a0,a1] × [y0,y1] da matriz M (x ao
 *  longo, y para cima, z para fora), com densidade pelo ruído (falhas na trepadeira) e mais folhas embaixo. */
export function foliage(c: { inst: PropsCtx["inst"] }, T: TM, M: THREE.Matrix4, a0: number, a1: number, y0: number, y1: number, count: number, seed: number) {
  const R = rand(seed);
  for (let k = 0; k < count; k++) {
    const x = a0 + R() * (a1 - a0), t = Math.pow(R(), 1.35), y = y0 + t * (y1 - y0);
    if (Math.sin(x * 2.3 + seed) * Math.cos(y * 1.7) + R() * 0.8 < -0.35) continue;
    const s = 0.07 + R() * 0.07, v = Math.floor(R() * 4);
    c.inst.add(ROOM, "terraco-leaf", leafGeo(v), T.leaf, mul(M, mat(x, y, 0.03 + R() * 0.08, R() * 6.28, s, s, s, -0.6 + R() * 0.5, R() * 6.28)), new THREE.Color().setHSL(0.24 + R() * 0.06, 0.45, 0.32 + R() * 0.14));
  }
}

/** Lanterna de ferro com vidro e vela (de mesa ou de chão, escala `s`): base, montantes, chapéu em pirâmide e argola. */
export function terraceLantern(c: { batch: PropsCtx["batch"]; inst: PropsCtx["inst"]; flames: THREE.Vector3[]; anchors: PropsCtx["anchors"]; P: Palette }, T: TM, M: THREE.Matrix4, s: number) {
  c.batch.add(ROOM, T.iron, BOX0(), mul(M, mat(0, 0, 0, 0, 0.2 * s, 0.03 * s, 0.2 * s)));
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) c.batch.add(ROOM, T.iron, BOX0(), mul(M, mat(dx * 0.088 * s, 0.03 * s, dz * 0.088 * s, 0, 0.016 * s, 0.34 * s, 0.016 * s)));
  c.batch.add(ROOM, T.glass, BOX0(), mul(M, mat(0, 0.03 * s, 0, 0, 0.17 * s, 0.34 * s, 0.17 * s)));
  c.batch.add(ROOM, T.iron, geo("terraco-lanternCap", () => new THREE.ConeGeometry(0.15, 0.12, 4).rotateY(Math.PI / 4).translate(0, 0.06, 0)), mul(M, mat(0, 0.37 * s, 0, 0, s)));
  c.batch.add(ROOM, T.iron, geo("terraco-lanternRing", () => new THREE.TorusGeometry(0.035, 0.007, 6, 12)), mul(M, mat(0, 0.52 * s, 0, 0, s)));
  c.inst.add(ROOM, "candle", CYL0(8), c.P.candle, mul(M, mat(0, 0.03 * s, 0, 0, 0.03 * s, 0.12 * s, 0.03 * s)));
  c.inst.add(ROOM, "lanternFlame", flameGeo(), c.P.flame, mul(M, mat(0, 0.175 * s, 0, 0, 0.02 * s)));
  const p = new THREE.Vector3(0, 0.175 * s, 0).applyMatrix4(M); c.flames.push(p);
  c.anchors.push({ x: p.x, y: p.y + 0.1, z: p.z, color: "#ffb15a", intensity: 1.6 + 1.4 * s, distance: 3, room: ROOM, flicker: 1 });
}
