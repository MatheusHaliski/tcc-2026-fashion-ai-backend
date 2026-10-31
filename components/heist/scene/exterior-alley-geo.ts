/*
 * MET Gala Heist v2 — beco (Z15): ferramentas de geometria da área. `Bag` junta peças por material numa malha só (uma
 * chamada de desenho por material), mantendo UV em metros, a cor por vértice (as peças pintadas de cores diferentes
 * dividem o mesmo material) e, nos decalques, o segundo UV (uv1) com o relevo do tijolo. As formas básicas (caixa,
 * caixa afunilada, cilindro entre dois pontos, quad na parede e no chão, tubo por pontos) já saem com UV de mundo.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type V3 = [number, number, number];

/** UV por projeção de caixa em coordenadas de mundo (1 unidade = 1 m), pelo eixo dominante da normal de cada vértice
 * (a mesma convenção da rua: parede virada para −x lê u = z, para +x lê u = −z; chão lê u = x, v = −z). */
export function worldUV(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geo.getAttribute("normal")) geo.computeVertexNormals();
  const pos = geo.getAttribute("position"), n = geo.getAttribute("normal"), uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ax >= ay && ax >= az) { uv[i * 2] = n.getX(i) > 0 ? -z : z; uv[i * 2 + 1] = y; }
    else if (ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = n.getY(i) > 0 ? -z : z; }
    else { uv[i * 2] = n.getZ(i) > 0 ? x : -x; uv[i * 2 + 1] = y; }
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
/** Matriz: posição, giro (y, depois x e z — ordem YXZ) e escala. */
export function tm(x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0): THREE.Matrix4 {
  _e.set(rx, ry, rz, "YXZ"); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_v, _q, _s);
}
export const mul = (a: THREE.Matrix4, b: THREE.Matrix4) => new THREE.Matrix4().multiplyMatrices(a, b);

/** Peças agrupadas por chave (o material): normaliza para posição, normal, uv, cor (e uv1 quando pedido) e mescla. */
export class Bag {
  private parts = new Map<string, THREE.BufferGeometry[]>();
  constructor(private withUv1 = false) {}
  /** Copia a peça (aplicando `m`, pintando com `color`) para o grupo `key`. Sem UV: projeção de mundo depois da matriz. */
  add(key: string, g: THREE.BufferGeometry, o: { m?: THREE.Matrix4; color?: THREE.ColorRepresentation; uv1?: [number, number][] | null; worldUv?: boolean } = {}) {
    let x = g.index ? g.toNonIndexed() : g.clone();
    if (o.m) x.applyMatrix4(o.m);
    if (!x.getAttribute("normal")) x.computeVertexNormals();
    if (o.worldUv || !x.getAttribute("uv")) x = worldUV(x);
    const n = x.getAttribute("position").count, out = new THREE.BufferGeometry();
    out.setAttribute("position", x.getAttribute("position")); out.setAttribute("normal", x.getAttribute("normal")); out.setAttribute("uv", x.getAttribute("uv"));
    const col = new THREE.Color(o.color ?? "#ffffff"), ca = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b; }
    out.setAttribute("color", new THREE.BufferAttribute(ca, 3));
    if (this.withUv1) {
      const u1 = new Float32Array(n * 2);
      if (o.uv1) for (let i = 0; i < n; i++) { const p = o.uv1[i % o.uv1.length]; u1[i * 2] = p[0]; u1[i * 2 + 1] = p[1]; }
      out.setAttribute("uv1", new THREE.BufferAttribute(u1, 2));
    }
    let list = this.parts.get(key); if (!list) { list = []; this.parts.set(key, list); } list.push(out);
  }
  /** Malha mesclada do grupo (null se vazio). */
  build(key: string): THREE.BufferGeometry | null {
    const list = this.parts.get(key); if (!list?.length) return null;
    const g = list.length === 1 ? list[0] : mergeGeometries(list, false); if (!g) return null;
    g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  }
  keys(): string[] { return [...this.parts.keys()]; }
}

/* ---------- formas ---------- */
/** Caixa pelos cantos (x0,y0,z0)–(x1,y1,z1). */
export function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0) || 1e-4, Math.abs(y1 - y0) || 1e-4, Math.abs(z1 - z0) || 1e-4);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g;
}
/** Caixa unitária com a base em y = 0 (para usar com matriz). */
export const box0 = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
/** Caixa afunilada (largura e fundo embaixo / em cima), base em y = 0. */
export function taper(w0: number, d0: number, w1: number, d1: number, h: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, h, 1, 1, 1, 1).translate(0, h / 2, 0), p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const top = p.getY(i) > h / 2; p.setX(i, p.getX(i) * (top ? w1 : w0)); p.setZ(i, p.getZ(i) * (top ? d1 : d0)); }
  g.computeVertexNormals(); return g;
}
/** Cilindro vertical com a base em y = 0. */
export const cyl0 = (r0: number, r1: number, h: number, seg = 16, open = false) => new THREE.CylinderGeometry(r1, r0, h, seg, 1, open).translate(0, h / 2, 0);
/** Cilindro de `a` até `b`. */
export function rod(a: V3, b: V3, r: number, seg = 8): THREE.BufferGeometry {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, false);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q); g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); return g;
}
/** Tubo por pontos (cabos, corrimãos, mangueiras). */
export function tube(points: V3[], r: number, seg = 24, radial = 6): THREE.BufferGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), seg, r, radial, false);
}
/** Cabo pendurado (catenária aproximada) entre dois pontos. */
export function sagging(a: V3, b: V3, sag: number, r: number, seg = 20): THREE.BufferGeometry {
  const pts: V3[] = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]); }
  return tube(pts, r, seg, 5);
}
/** Quad numa parede voltada para −x (o prédio vizinho, visto do beco): z0…z1 (esquerda→direita para quem olha +x), y0…y1. */
export function quadWest(x: number, z0: number, z1: number, y0: number, y1: number, uv: [number, number, number, number] = [z0, y0, z1, y1]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x, y0, z0, x, y0, z1, x, y1, z1, x, y0, z0, x, y1, z1, x, y1, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([-1, 0, 0]).flat(), 3));
  const [u0, v0, u1, v1] = uv;
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  return g;
}
/** Quad numa parede voltada para +x (o museu, visto do beco): z1…z0 da esquerda para a direita. */
export function quadEast(x: number, z0: number, z1: number, y0: number, y1: number, uv: [number, number, number, number] = [-z1, y0, -z0, y1]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x, y0, z1, x, y0, z0, x, y1, z0, x, y0, z1, x, y1, z0, x, y1, z1], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([1, 0, 0]).flat(), 3));
  const [u0, v0, u1, v1] = uv;
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  return g;
}
/** Quad deitado no chão (normal +y), centro (x, z), lados w (x) × d (z), girado `ry`, com o retângulo de UV dado. */
export function quadFloor(x: number, y: number, z: number, w: number, d: number, ry: number, uv: [number, number, number, number] = [0, 0, 1, 1]): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.rotateY(ry); g.translate(x, y, z);
  const [u0, v0, u1, v1] = uv, a = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) a.setXY(i, u0 + (u1 - u0) * a.getX(i), v0 + (v1 - v0) * a.getY(i));
  return g;
}
/** Pinta (cor por vértice) com variação suave de tom: sujeira e desbotado sem nova textura. */
export function shade(c: THREE.ColorRepresentation, k: number): THREE.Color { return new THREE.Color(c).multiplyScalar(k); }
