/*
 * MET Gala Heist v2 — ferramentas de montagem dos objetos das pessoas (holds.ts, holds-geometry.ts, jewelry.ts):
 * juntar peças numa geometria pintada por vértice, posicionar uma geometria, fatia extrudada e os atalhos de caixa,
 * cilindro e malha.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Junta peças numa geometria só com cor por vértice (um objeto = uma chamada de desenho). */
export function painted(parts: [THREE.BufferGeometry, string][]): THREE.BufferGeometry {
  const list = parts.map(([g, hex]) => {
    const x = (g.index ? g.toNonIndexed() : g.clone()); x.deleteAttribute("uv");
    const c = new THREE.Color(hex), n = x.getAttribute("position").count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    x.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); return x;
  });
  return mergeGeometries(list, false) ?? new THREE.BufferGeometry();
}
export const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: [number, number, number] = [1, 1, 1]) => {
  g.scale(s[0], s[1], s[2]); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(x, y, z); return g;
};
/** Fatia de bolo (setor extrudado: as faces do corte existem), deitada no plano xy e subindo em +z. */
export function wedge(r: number, h: number, a0: number, a1: number): THREE.BufferGeometry {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(r * Math.cos(a0), r * Math.sin(a0)); s.absarc(0, 0, r, a0, a1, false); s.lineTo(0, 0);
  return new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 8 });
}
export const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
export const cyl = (r0: number, r1: number, h: number, seg = 16) => new THREE.CylinderGeometry(r0, r1, h, seg);
export const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = false; return o; };
