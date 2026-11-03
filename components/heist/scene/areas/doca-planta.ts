/*
 * MET Gala Heist v2 — doca (Z12): a planta da sala (medidas, portão, vigas, luminárias) e os ajudantes no
 * espaço da sala (caixa, barra, placa e marca no piso). Saiu de doca.ts sem mudança.
 */
import * as THREE from "three";
import { BOX0, CYL0, mat } from "../interior-batch";
import type { InteriorRoom } from "../interior-shell";
import type { RoomsCtx } from "./kit";
import type { Rect } from "./doca-tex";
import { planeUV, tint, type DocaMats } from "./doca-props";

export const R: InteriorRoom = "doca";
/** Planta da sala (x −22…−8,5, z 16,5…24, pé-direito 6 m) e os vãos. */
export const X0 = -22, X1 = -8.5, Z0 = 16.5, Z1 = 24, H = 6;
export const GATE = { x0: -21, x1: -17, h: 4.2 };
/** Vigas principais (norte–sul) e secundárias (leste–oeste) da estrutura, e as luminárias de LED. */
export const BEAMS_X = [-18.625, -15.25, -11.875], BEAMS_Z = [18.4, 20.25, 22.1];
export const LAMPS: [number, number][] = [[-19.6, 18.6], [-15.25, 18.6], [-10.9, 18.6], [-19.6, 22.0], [-15.25, 22.0], [-10.9, 22.0]];

/* ---------- ajudantes no espaço da sala ---------- */
export const box = (c: RoomsCtx, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: THREE.ColorRepresentation, o: { ry?: number; rx?: number; rz?: number; cast?: boolean } = {}) =>
  c.batch.add(R, m, color ? tint(BOX0(), "box0", color) : BOX0(), mat(x, y, z, o.ry ?? 0, sx, sy, sz, o.rx ?? 0, o.rz ?? 0), { cast: o.cast });
/** Barra (cilindro) de a até b. */
export function bar(c: RoomsCtx, m: THREE.Material, a: [number, number, number], b: [number, number, number], r: number, color?: THREE.ColorRepresentation, seg = 8) {
  const A3 = new THREE.Vector3(...a), B3 = new THREE.Vector3(...b), len = A3.distanceTo(B3), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B3.clone().sub(A3).normalize());
  const M4 = new THREE.Matrix4().compose(A3, q, new THREE.Vector3(r, len, r));
  c.batch.add(R, m, color ? tint(CYL0(seg), `cyl0${seg}`, color) : CYL0(seg), M4);
}
/** Desenho da folha num plano na parede (ry = para onde olha; 0 = +z). */
export const sign = (c: RoomsCtx, m: THREE.Material, name: string, r: Rect, x: number, y: number, z: number, ry: number, w: number, h: number) => c.batch.add(R, m, planeUV(name, r), mat(x, y, z, ry, w, h, 1));
/** Desenho deitado no piso (marcas): centro, tamanho e giro. */
export const mark = (c: RoomsCtx, M: DocaMats, name: string, r: Rect, x: number, z: number, w: number, d: number, ry = 0, lift = 0.004) => c.batch.add(R, M.marks, planeUV(name, r), mat(x, lift, z, ry, w, d, 1, -Math.PI / 2));
