/*
 * MET Gala Heist v2 — Terraço e jardim (Z13): decoração sem colisão (paredes, teto, piso, objetos), luzes e o que anima.
 * Código movido de interior-rooms.ts; o módulo da área (AREA, no fim) diz as salas, o construtor e o que ele substitui.
 */
import * as THREE from "three";
import { BOX0, CYL0, SPH, geo, mat } from "../interior-batch";
import { miscMat } from "../interior-mats";
import { type RoomsCtx, A, B } from "./kit";
import type { AreaModule } from "./types";

/** Terraço-jardim: cordões de lâmpadas cruzando o céu, sebes nas paredes, lanternas, vista. */
function terraco(c: RoomsCtx) {
  const P = c.P, room = "terraco";
  // sebes em floreiras encostadas nas paredes do prédio (oeste e sul)
  for (let z = -21.4; z <= -7.4; z += 1.4) { if (z > -16.8 && z < -13.2) continue; B(c, room, P.stone, 12.85, 0, z, 0.7, 0.55, 1.3); c.inst.add(room, "hedge", hedgeGeometry(), miscMat("hedge", c.q), mat(12.85, 0.55, z)); }
  // postes e cordões de lâmpadas em catenária
  const poles = [new THREE.Vector3(12.9, 0, -21.6), new THREE.Vector3(21.6, 0, -21.6), new THREE.Vector3(21.6, 0, -6.9), new THREE.Vector3(12.9, 0, -6.9)];
  for (const p of poles) c.batch.add(room, P.black, CYL0(8), mat(p.x, 0, p.z, 0, 0.04, 3.6, 0.04));
  const strands: [number, number][] = [[0, 2], [1, 3], [0, 1], [1, 2], [2, 3], [3, 0]];
  for (const [a, b] of strands) {
    const pa = poles[a].clone().setY(3.55), pb = poles[b].clone().setY(3.55), n = Math.round(pa.distanceTo(pb) / 0.7);
    for (let i = 1; i < n; i++) { const t = i / n, p = pa.clone().lerp(pb, t); p.y -= Math.sin(Math.PI * t) * 0.7; c.inst.add(room, "stringBulb", SPH(8), P.bulbWarm, mat(p.x, p.y, p.z, 0, 0.045)); c.flames.push(p.clone()); if (i % 4 === 2) A(c, room, p.x, p.y - 0.1, p.z, "#ffcf8e", 2.4, 4); }
  }
  // lanternas no chão junto ao sofá
  for (const [x, z] of [[14.6, -12.8], [18.4, -12.8]]) {
    c.batch.add(room, P.black, BOX0(), mat(x, 0, z, 0, 0.24, 0.04, 0.24));
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) c.batch.add(room, P.black, BOX0(), mat(x + dx * 0.105, 0.04, z + dz * 0.105, 0, 0.02, 0.4, 0.02));
    c.batch.add(room, P.black, geo("lanternCap", () => new THREE.ConeGeometry(0.17, 0.12, 4).rotateY(Math.PI / 4).translate(0, 0.06, 0)), mat(x, 0.44, z));
    c.batch.add(room, P.black, geo("lanternRing", () => new THREE.TorusGeometry(0.04, 0.008, 6, 12)), mat(x, 0.6, z));
    c.batch.add(room, P.glass, BOX0(), mat(x, 0.04, z, 0, 0.2, 0.4, 0.2));
    c.inst.add(room, "candle", CYL0(8), P.candle, mat(x, 0.04, z, 0, 0.035, 0.14, 0.035));
    c.inst.add(room, "lanternFlame", geo("flameGeo", () => new THREE.SphereGeometry(1, 6, 5).scale(0.5, 1.4, 0.5)), P.flame, mat(x, 0.215, z, 0, 0.022));
    c.flames.push(new THREE.Vector3(x, 0.215, z));
    A(c, room, x, 0.4, z, "#ffb15a", 1.5, 2.5, { flicker: 1 });
  }
}

/** Sebe podada: caixa arredondada e levemente irregular (folhagem não tem aresta viva). */
function hedgeGeometry(): THREE.BufferGeometry {
  return geo("hedgeGeoRound", () => {
    const g = new THREE.BoxGeometry(0.62, 0.8, 1.26, 6, 6, 10), p = g.getAttribute("position") as THREE.BufferAttribute, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const nx = v.x / 0.31, ny = (v.y + 0.4) / 0.8 * 2 - 1, nz = v.z / 0.63;
      const round = 1 - 0.1 * Math.max(0, Math.abs(nx) * Math.abs(ny) * 0.6 + Math.abs(nx) * Math.abs(nz) * 0.4 + Math.abs(ny) * Math.abs(nz) * 0.4 - 0.25);
      const bump = 1 + 0.03 * Math.sin(v.x * 23 + v.z * 17) * Math.cos(v.y * 19 + v.z * 7);
      p.setXYZ(i, v.x * round * bump, v.y * (ny > 0 ? round : 1), v.z * round * bump);
    }
    g.computeVertexNormals(); return g;
  });
}

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = { id: "terraco", rooms: ["terraco"], dress: terraco };
