/*
 * MET Gala Heist v2 — doca (Z12): materiais da área, geometrias tingidas e com UV da folha de desenhos e os
 * ajudantes no referencial do móvel (caixa, cilindro, decalque, rodízio, sorteio). Saiu de doca-props.ts sem mudança.
 */
import * as THREE from "three";
import { BOX0, CYL0, geo, mat, mul } from "../interior-batch";
import { foot, type PropsCtx } from "../interior-props";
import type { Palette } from "../interior-mats";
import type { Quality } from "../interior-tex";
import { docaAtlas, laminateSurface, type Rect } from "./doca-tex";
import { seg } from "./doca-empilhadeira";

export const ROOM = "doca";
export type Foot = ReturnType<typeof foot>;
export type Mat = THREE.Material;

/* ---------- materiais da área ---------- */
const mcache = new Map<string, unknown>();
function once<T>(key: string, make: () => T): T { const k = `doca-${key}`; if (!mcache.has(k)) mcache.set(k, make()); return mcache.get(k) as T; }
export interface DocaMats {
  paint: THREE.MeshStandardMaterial; matte: THREE.MeshStandardMaterial; plastic: THREE.MeshStandardMaterial; galv: THREE.MeshStandardMaterial;
  laminate: THREE.MeshStandardMaterial; signs: THREE.MeshStandardMaterial; marks: THREE.MeshStandardMaterial; lit: THREE.MeshStandardMaterial;
  film: THREE.MeshStandardMaterial; inox: THREE.MeshStandardMaterial; rubber: Mat; wood: Mat; alu: Mat; chrome: Mat; glass: Mat; led: Mat; ledRed: Mat; ledGreen: Mat;
}
export function docaMats(q: Quality, P: Palette): DocaMats {
  return once(`mats-${q}`, () => {
    const at = docaAtlas(q), lam = laminateSurface(q);
    const lamN = lam.normalMap.clone(); lamN.repeat.set(4, 4); lamN.needsUpdate = true;
    const lamR = lam.roughnessMap.clone(); lamR.repeat.set(4, 4); lamR.needsUpdate = true;
    const vc = (name: string, o: THREE.MeshStandardMaterialParameters) => { const m = new THREE.MeshStandardMaterial({ vertexColors: true, ...o }); m.name = `doca-${name}`; return m; };
    const signs = new THREE.MeshStandardMaterial({ map: at.tex, roughness: 0.55, metalness: 0.02, alphaTest: 0.08, emissiveMap: at.tex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.12, side: THREE.DoubleSide });
    signs.name = "doca-signs";
    const lit = new THREE.MeshStandardMaterial({ map: at.tex, roughness: 0.4, emissiveMap: at.tex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 1.4 }); lit.name = "doca-lit";
    const marks = new THREE.MeshStandardMaterial({ map: at.tex, roughness: 0.6, transparent: true, depthWrite: false, alphaTest: 0.02, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }); marks.name = "doca-marks";
    const laminate = new THREE.MeshStandardMaterial({ color: "#151517", roughness: 1, roughnessMap: lamR, normalMap: lamN, normalScale: new THREE.Vector2(0.8, 0.8), envMapIntensity: 0.8 }); laminate.name = "doca-laminate";
    const film = new THREE.MeshStandardMaterial({ color: "#e6eef2", roughness: 0.12, metalness: 0, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4 }); film.name = "doca-film";
    const galv = new THREE.MeshStandardMaterial({ color: "#a3a8ac", roughness: 0.42, metalness: 0.85, envMapIntensity: 1 }); galv.name = "doca-galv";
    const inox = new THREE.MeshStandardMaterial({ color: "#c8ccd0", roughness: 0.22, metalness: 1, envMapIntensity: 1.2 }); inox.name = "doca-inox";
    // alumínio dos perfis (flight cases, moldura do quadro): menos metálico que o aço da paleta para não sumir no escuro do "low"
    const alu = new THREE.MeshStandardMaterial({ color: "#c4c8cc", roughness: 0.36, metalness: 0.55, envMapIntensity: 1 }); alu.name = "doca-alu";
    return {
      paint: vc("paint", { roughness: 0.48, metalness: 0.35, envMapIntensity: 0.8 }), matte: vc("matte", { roughness: 0.82, metalness: 0.05, envMapIntensity: 0.5 }),
      plastic: vc("plastic", { roughness: 0.45, metalness: 0, envMapIntensity: 0.7 }), galv, laminate, signs, marks, lit, film, inox,
      rubber: P.rubber, wood: P.crateWood, alu, chrome: P.chrome, glass: P.glass, led: P.fluoro, ledRed: P.ledRed, ledGreen: P.ledGreen,
    };
  });
}

/* ---------- geometrias com cor e com UV da folha ---------- */
const gcache = new Map<string, THREE.BufferGeometry>();
/** Cópia da geometria com a cor por vértice (cacheada por forma e cor). */
export function tint(base: THREE.BufferGeometry, key: string, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const c = new THREE.Color(color), k = `${key}|${c.getHexString()}`; const hit = gcache.get(k); if (hit) return hit;
  const g = base.clone(), n = g.getAttribute("position").count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3)); gcache.set(k, g); return g;
}
/** Plano (olha para +z) e caixa com o UV dentro de um retângulo da folha (todas as faces da caixa mostram o desenho). */
export function planeUV(_name: string, r: Rect): THREE.BufferGeometry {
  return geo(`doca-plane-${r.u0.toFixed(5)}-${r.v0.toFixed(5)}-${r.u1.toFixed(5)}-${r.v1.toFixed(5)}`, () => { const g = new THREE.PlaneGeometry(1, 1), a = g.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < a.count; i++) a.setXY(i, r.u0 + (r.u1 - r.u0) * a.getX(i), r.v0 + (r.v1 - r.v0) * a.getY(i)); return g; });
}
export function boxUV(_name: string, r: Rect): THREE.BufferGeometry {
  return geo(`doca-box-${r.u0.toFixed(5)}-${r.v0.toFixed(5)}-${r.u1.toFixed(5)}-${r.v1.toFixed(5)}`, () => { const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), a = g.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < a.count; i++) a.setXY(i, r.u0 + (r.u1 - r.u0) * a.getX(i), r.v0 + (r.v1 - r.v0) * a.getY(i)); return g; });
}

/* ---------- ajudantes no referencial do móvel ---------- */
/** Matriz local do móvel (frente para +z local). */
export const L = (f: Foot, x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => mul(mat(f.cx, 0, f.cz, f.yaw), mat(x, y, z, ry, sx, sy, sz, rx, rz));
export const worldOf = (f: Foot, x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(mat(f.cx, 0, f.cz, f.yaw));
/** Caixa com base em y (cor opcional para os materiais de cor por vértice). */
export function bx(c: PropsCtx, m: Mat, f: Foot, x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: THREE.ColorRepresentation, o: { ry?: number; rx?: number; rz?: number; cast?: boolean } = {}) {
  c.batch.add(ROOM, m, color ? tint(BOX0(), "box0", color) : BOX0(), L(f, x, y, z, o.ry ?? 0, sx, sy, sz, o.rx ?? 0, o.rz ?? 0), { cast: o.cast });
}
export function cy(c: PropsCtx, m: Mat, f: Foot, x: number, y: number, z: number, r: number, h: number, color?: THREE.ColorRepresentation, o: { seg?: number; rx?: number; rz?: number; ry?: number } = {}) {
  const seg = o.seg ?? 14; c.batch.add(ROOM, m, color ? tint(CYL0(seg), `cyl0${seg}`, color) : CYL0(seg), L(f, x, y, z, o.ry ?? 0, r, h, r, o.rx ?? 0, o.rz ?? 0));
}
export function decal(c: PropsCtx, m: Mat, f: Foot, name: string, r: Rect, x: number, y: number, z: number, w: number, h: number, ry = 0, rx = 0) {
  c.batch.add(ROOM, m, planeUV(name, r), L(f, x, y, z, ry, w, h, 1, rx));
}
/** Rodízio giratório (placa, garfo, roda) de altura `h`, apoiado em `y0` (o chão ou a tampa do case de baixo). */
export function caster(c: PropsCtx, M: DocaMats, f: Foot, x: number, z: number, h: number, ry = 0, y0 = 0) {
  bx(c, M.galv, f, x, y0 + h - 0.008, z, 0.09, 0.008, 0.08);
  bx(c, M.galv, f, x, y0 + h * 0.35, z, 0.05, h * 0.62, 0.012, undefined, { ry });
  c.batch.add(ROOM, M.rubber, geo("doca-wheel", () => new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2)), L(f, x, y0 + h * 0.4, z + 0.012, ry, 0.032, h * 0.4, h * 0.4));
}

/** Sorteio com semente. */
export function rand(seed: number) { let s = seed >>> 0 || 1; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }
