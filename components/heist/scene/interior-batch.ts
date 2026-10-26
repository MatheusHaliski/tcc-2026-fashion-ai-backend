/*
 * MET Gala Heist v2 — utilidades de montagem do interior: geometrias estáticas mescladas por sala e material (uma
 * chamada de desenho para todas as molduras de latão do salão, por exemplo), instâncias para o que se repete (rosas,
 * balaústres, taças, garrafas, lâmpadas) e a construção de quads com cores por vértice (sombra de contato fingida).
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Só posição, normal e uv (a mescla exige o mesmo conjunto); sem índice. */
function normalize(g: THREE.BufferGeometry, color: boolean): THREE.BufferGeometry {
  const src = g.index ? g.toNonIndexed() : g.clone();
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", src.getAttribute("position"));
  if (!src.getAttribute("normal")) src.computeVertexNormals();
  out.setAttribute("normal", src.getAttribute("normal"));
  const n = src.getAttribute("position").count;
  out.setAttribute("uv", src.getAttribute("uv") ?? new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (color) out.setAttribute("color", src.getAttribute("color") ?? new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return out;
}

export class Batch {
  private parts = new Map<string, { room: string; mat: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>();
  /** Copia a geometria já posicionada (matriz) para o lote da sala e material. */
  add(room: string, mat: THREE.Material, geo: THREE.BufferGeometry, m?: THREE.Matrix4, o: { cast?: boolean; receive?: boolean } = {}) {
    const color = (mat as THREE.MeshStandardMaterial).vertexColors === true;
    const g = normalize(geo, color); if (m) g.applyMatrix4(m);
    const key = `${room}|${mat.uuid}|${o.cast ? 1 : 0}${o.receive === false ? 0 : 1}`;
    let p = this.parts.get(key); if (!p) { p = { room, mat, geos: [], cast: !!o.cast, receive: o.receive !== false }; this.parts.set(key, p); }
    p.geos.push(g);
  }
  flush(): { room: string; mesh: THREE.Mesh }[] {
    const out: { room: string; mesh: THREE.Mesh }[] = [];
    for (const p of this.parts.values()) {
      const merged = p.geos.length === 1 ? p.geos[0] : mergeGeometries(p.geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere(); merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, p.mat); mesh.castShadow = p.cast; mesh.receiveShadow = p.receive; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      out.push({ room: p.room, mesh });
      p.geos.forEach((g) => g !== merged && g.dispose());
    }
    this.parts.clear();
    return out;
  }
}

/** Instâncias por sala/geometria/material, com cor por instância opcional. */
export class Instances {
  private parts = new Map<string, { room: string; geo: THREE.BufferGeometry; mat: THREE.Material; mats: THREE.Matrix4[]; cols: THREE.Color[] | null }>();
  add(room: string, key: string, geo: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4, color?: THREE.Color) {
    const k = `${room}|${key}|${mat.uuid}`;
    let p = this.parts.get(k); if (!p) { p = { room, geo, mat, mats: [], cols: color ? [] : null }; this.parts.set(k, p); }
    p.mats.push(m.clone()); if (p.cols) p.cols.push(color ?? new THREE.Color(1, 1, 1));
  }
  flush(): { room: string; mesh: THREE.InstancedMesh; key: string }[] {
    const out: { room: string; mesh: THREE.InstancedMesh; key: string }[] = [];
    for (const [k, p] of this.parts) {
      const im = new THREE.InstancedMesh(p.geo, p.mat, p.mats.length);
      p.mats.forEach((m, i) => im.setMatrixAt(i, m));
      if (p.cols) p.cols.forEach((c, i) => im.setColorAt(i, c));
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); im.computeBoundingBox(); im.frustumCulled = true;
      out.push({ room: p.room, mesh: im, key: k.split("|")[1] });
    }
    this.parts.clear();
    return out;
  }
}

/* ---------- construção de quads ---------- */
export class QuadBuilder {
  pos: number[] = []; nor: number[] = []; uv: number[] = []; col: number[] = []; idx: number[] = [];
  /** Quad p0→p1→p2→p3 (anti-horário visto da frente), normal n, uv e cor por canto. */
  quad(p: number[][], n: number[], uv: number[][], c: number[] = [1, 1, 1, 1]) {
    const b = this.pos.length / 3;
    for (let k = 0; k < 4; k++) { this.pos.push(...p[k]); this.nor.push(...n); this.uv.push(...uv[k]); this.col.push(c[k], c[k], c[k]); }
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  get empty() { return this.idx.length === 0; }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx); return g;
  }
}

/* ---------- matrizes ---------- */
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
/** Matriz de posição (x, y, z), giro em y (e opcionalmente x/z) e escala. */
export function mat(x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0): THREE.Matrix4 {
  _e.set(rx, ry, rz, "YXZ"); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_v, _q, _s);
}
/** Composição: pai × filho. */
export const mul = (a: THREE.Matrix4, b: THREE.Matrix4) => new THREE.Matrix4().multiplyMatrices(a, b);

/** Geometrias básicas reaproveitadas (uma instância por formato). */
const geoCache = new Map<string, THREE.BufferGeometry>();
export function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const hit = geoCache.get(key); if (hit) return hit; const g = make(); geoCache.set(key, g); return g;
}
export const BOX = () => geo("box", () => new THREE.BoxGeometry(1, 1, 1));
export const CYL = (seg = 24) => geo(`cyl${seg}`, () => new THREE.CylinderGeometry(1, 1, 1, seg, 1));
export const SPH = (seg = 16) => geo(`sph${seg}`, () => new THREE.SphereGeometry(1, seg, Math.max(6, seg * 0.6 | 0)));
export const PLANE = () => geo("plane", () => new THREE.PlaneGeometry(1, 1));
/** Caixa unitária com a base em y = 0 (fácil de empilhar). */
export const BOX0 = () => geo("box0", () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
export const CYL0 = (seg = 24) => geo(`cyl0${seg}`, () => new THREE.CylinderGeometry(1, 1, 1, seg, 1).translate(0, 0.5, 0));
