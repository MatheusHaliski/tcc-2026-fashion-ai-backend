/*
 * MET Gala Heist v2 — Vestíbulo: o que os construtores de móveis dividem entre si (vestibulo-desk.ts, vestibulo-cloak.ts
 * e vestibulo-furniture.ts): o contexto mínimo, a matriz e o ponto no referencial do móvel (frente para +z local), a
 * luz-âncora da sala, o gerador pseudoaleatório determinístico (cada móvel o reinicia com a própria semente) e os planos
 * unitários vertical e horizontal.
 */
import * as THREE from "three";
import { mat, mul } from "../interior-batch";
import { foot, type LightAnchor, type PropsCtx } from "../interior-props";
import { ROOM, vGeo } from "./vestibulo-kit";

export type Foot = ReturnType<typeof foot>;
export type Ctx = Pick<PropsCtx, "q" | "batch" | "inst" | "anchors" | "copy">;
/** Matriz no referencial do móvel (frente para +z local). */
export const L = (f: Foot, x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => mul(mat(f.cx, 0, f.cz, f.yaw), mat(x, y, z, ry, sx, sy, sz, rx, rz));
export const W = (f: Foot, x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(mat(f.cx, 0, f.cz, f.yaw));
export const light = (c: Ctx, v: THREE.Vector3, color: string, intensity: number, distance: number, o: Partial<LightAnchor> = {}) => c.anchors.push({ x: v.x, y: v.y, z: v.z, color, intensity, distance, room: ROOM, ...o });
let seed = 1;
export const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
/** Reinicia a semente antes de um conjunto de sorteios (as mesmas sementes de sempre: 77, 31, 4242). */
export const reseed = (n: number) => { seed = n; };
export const PLANE_V = () => vGeo("planeV", () => new THREE.PlaneGeometry(1, 1).translate(0, 0, 0));
export const PLANE_UP = () => vGeo("planeUp", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
