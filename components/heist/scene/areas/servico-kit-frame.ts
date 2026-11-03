/*
 * MET Gala Heist v2 — referencial local da área de serviço: `Fr` monta móveis com espessura, perfis e chanfros em lotes
 * e instâncias (caixas com a base em y, cilindros, geometrias, instâncias, ponto do mundo), e as geometrias e
 * utilidades que o acompanham (caixa boleada, torneado, tubo, luz-âncora, esfera, ponto como tupla).
 * Saiu de servico-kit.ts sem mudança (servico-kit.ts continua reexportando tudo).
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { BOX0, CYL, CYL0, SPH, geo, mat, mul, type Batch, type Instances } from "../interior-batch";
import type { LightAnchor } from "../interior-props";
import type { InteriorRoom } from "../interior-shell";

/* ======================= referencial local ======================= */
/** Lote e instâncias de uma sala (o que RoomsCtx e PropsCtx têm em comum). */
export interface Sink { batch: Batch; inst: Instances }
/** Peças num referencial local (a frente do móvel olha para +z local): caixas com a base em y, cilindros, geometrias. */
export class Fr {
  constructor(readonly c: Sink, readonly room: string, readonly at: THREE.Matrix4) {}
  static at(c: Sink, room: string, x: number, y: number, z: number, ry = 0) { return new Fr(c, room, mat(x, y, z, ry)); }
  /** sub-referencial (gaveta, porta, prateleira…) */
  sub(x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) { return new Fr(this.c, this.room, mul(this.at, mat(x, y, z, ry, 1, 1, 1, rx, rz))); }
  m(x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) { return mul(this.at, mat(x, y, z, ry, sx, sy, sz, rx, rz)); }
  /** caixa: base em y, largura x, altura y, profundidade z */
  box(m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, cast = false) { this.c.batch.add(this.room, m, BOX0(), this.m(x, y, z, ry, sx, sy, sz), { cast }); }
  /** caixa de cantos boleados (raio r) */
  rbox(m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, r = 0.01, ry = 0, cast = false) { this.c.batch.add(this.room, m, rbox(sx, sy, sz, r), this.m(x, y, z, ry), { cast }); }
  /** cilindro em pé com a base em y */
  cyl(m: THREE.Material, x: number, y: number, z: number, r: number, h: number, seg = 16) { this.c.batch.add(this.room, m, CYL0(seg), this.m(x, y, z, 0, r, h, r)); }
  /** cilindro deitado ao longo de x (centrado) */
  cylX(m: THREE.Material, x: number, y: number, z: number, r: number, len: number, seg = 12) { this.c.batch.add(this.room, m, CYL(seg), this.m(x, y, z, 0, r, len, r, 0, Math.PI / 2)); }
  /** cilindro deitado ao longo de z (centrado) */
  cylZ(m: THREE.Material, x: number, y: number, z: number, r: number, len: number, seg = 12) { this.c.batch.add(this.room, m, CYL(seg), this.m(x, y, z, 0, r, len, r, Math.PI / 2)); }
  /** geometria qualquer */
  g(m: THREE.Material, g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0, cast = false) { this.c.batch.add(this.room, m, g, this.m(x, y, z, ry, sx, sy, sz, rx, rz), { cast }); }
  /** peça repetida (instância) */
  i(key: string, g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0, color?: THREE.Color) { this.c.inst.add(this.room, key, g, m, this.m(x, y, z, ry, sx, sy, sz, rx, rz), color); }
  /** ponto do mundo */
  p(x: number, y: number, z: number) { return new THREE.Vector3(x, y, z).applyMatrix4(this.at); }
}
/** Caixa boleada com a base em y = 0 (uma geometria por medida). */
export function rbox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const k = (n: number) => n.toFixed(3);
  return geo(`srv-rbox-${k(w)}-${k(h)}-${k(d)}-${k(r)}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)).translate(0, h / 2, 0));
}
/** Torneado (perfil [raio, altura]) com chave da área. */
export const lathe = (key: string, pts: [number, number][], seg = 18) => geo(`srv-lathe-${key}`, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg));
/** Tubo por pontos (cabos, mangueiras, alças). */
export const tube = (pts: [number, number, number][], r: number, seg = 24, rad = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z))), seg, r, rad, false);
/** Luz-âncora a partir de um ponto do mundo (para PropsCtx e RoomsCtx). */
export function light(c: { anchors: LightAnchor[] }, room: InteriorRoom, p: THREE.Vector3, color: string, intensity: number, distance: number, o: Partial<LightAnchor> = {}) { c.anchors.push({ x: p.x, y: p.y, z: p.z, color, intensity, distance, room, ...o }); }
export const SPHg = (seg = 10) => SPH(seg);
/** Ponto do mundo como tupla (para espalhar em parâmetros x, y, z). */
export const xyz = (v: THREE.Vector3): [number, number, number] => [v.x, v.y, v.z];
