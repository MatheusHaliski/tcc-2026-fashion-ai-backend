/*
 * MET Gala Heist v2 — referencial dos móveis do interior (interior-props.ts): matriz no referencial da pegada, ponto no
 * mundo, caixa e cilindro no lote da sala, âncora de luz, e as geometrias de revolução que os construtores compartilham
 * (fuste canelado, taças, garrafa, urna).
 */
import * as THREE from "three";
import { BOX0, CYL0, geo, mat, mul } from "./interior-batch";
import type { InteriorRoom } from "./interior-shell";
import type { Foot, LightAnchor, PropsCtx } from "./interior-props";

/** Matriz no referencial do móvel: (x, y, z) locais, giro local, escala. */
export const L = (f: Foot, x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => mul(mat(f.cx, 0, f.cz, f.yaw), mat(x, y, z, ry, sx, sy, sz, rx, rz));
export const worldOf = (f: Foot, x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(mat(f.cx, 0, f.cz, f.yaw));
export const box = (c: PropsCtx, room: string, m: THREE.Material, f: Foot, x: number, y: number, z: number, sx: number, sy: number, sz: number, o: { cast?: boolean; ry?: number } = {}) =>
  c.batch.add(room, m, BOX0(), L(f, x, y, z, o.ry ?? 0, sx, sy, sz), { cast: o.cast });
export const cyl = (c: PropsCtx, room: string, m: THREE.Material, f: Foot, x: number, y: number, z: number, r: number, h: number, seg = 20) => c.batch.add(room, m, CYL0(seg), L(f, x, y, z, 0, r, h, r));
export const anchor = (c: PropsCtx, room: InteriorRoom, v: THREE.Vector3, color: string, intensity: number, distance: number, o: Partial<LightAnchor> = {}) => c.anchors.push({ x: v.x, y: v.y, z: v.z, color, intensity, distance, room, ...o });

/* ---------- geometrias compartilhadas ---------- */
export const lathe = (key: string, pts: [number, number][], seg = 24) => geo(key, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg));
/** Fuste canelado (24 caneluras) de 1 m de altura e raio 1 — escalado por coluna. */
export const flutedShaft = () => geo("fluted", () => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true).translate(0, 0.5, 0); const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 - 0.045 * Math.max(0, Math.cos(a * 24)) ** 0.6; p.setXYZ(i, x * k, p.getY(i), z * k); }
  g.computeVertexNormals(); return g;
});
export const flute = () => lathe("flute", [[0, 0], [0.032, 0.005], [0.006, 0.02], [0.004, 0.12], [0.03, 0.2], [0.034, 0.27], [0.0, 0.28]], 14);
export const coupe = () => lathe("coupe", [[0, 0], [0.04, 0.004], [0.005, 0.015], [0.004, 0.09], [0.05, 0.11], [0.055, 0.14], [0.0, 0.14]], 14);
export const bottle = () => lathe("bottle", [[0, 0], [0.04, 0], [0.042, 0.02], [0.042, 0.2], [0.03, 0.25], [0.014, 0.29], [0.014, 0.33], [0, 0.33]], 12);
export const urn = () => lathe("urn", [[0.0, 0], [0.24, 0], [0.26, 0.04], [0.2, 0.1], [0.32, 0.3], [0.42, 0.52], [0.44, 0.58], [0.4, 0.6], [0.0, 0.6]], 28);
