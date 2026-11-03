/*
 * MET Gala Heist v2 — Vestíbulo: colocar peças na parede (dividido por vestibulo-walls.ts, vestibulo-niche.ts e
 * vestibulo-walls-art.ts): a matriz na face, a caixa saindo da parede e o perfil corrido entre dois pontos.
 */
import * as THREE from "three";
import { BOX0, mat, mul } from "../interior-batch";
import type { RoomsCtx } from "./kit";
import { ROOM, onWall, profileGeo, type Side } from "./vestibulo-kit";

export const at = (w: Side, s: number, y: number, off = 0) => onWall(w, s, y, off);
/** Caixa saindo da parede: centro em `s`, base em `y`, de `off` até `off + d` para dentro da sala. */
export function wb(c: RoomsCtx, m: THREE.Material, w: Side, s: number, y: number, off: number, sx: number, sy: number, d: number, cast = false) {
  c.batch.add(ROOM, m, BOX0(), mul(at(w, s, y, off + d / 2), mat(0, 0, 0, 0, sx, sy, d)), { cast });
}
/** Perfil corrido na parede de s0 a s1 (pts: saliência, altura relativa a y). */
export function run(c: RoomsCtx, m: THREE.Material, w: Side, s0: number, s1: number, y: number, key: string, pts: [number, number][], cast = false) {
  c.batch.add(ROOM, m, profileGeo(key, pts, Math.abs(s1 - s0)), at(w, (s0 + s1) / 2, y), { cast });
}
