/**
 * Short brow fibers follow the photographed contours on the composed face. The atlas remains the source of the
 * brow silhouette; a sparse layer adds relief and a directional response to light without painting a second brow.
 * Unknown or occluded brows keep their photograph. There is no generic eyebrow shape or hair-color fallback.
 */
import * as THREE from "three";
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import { CANON_UV } from "../canonical-face";
import { BROW_LINES, type AvatarBrows } from "../identity/brows";

type V2 = [number, number];
type V3 = [number, number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix2 = (a: V2, b: V2, t: number): V2 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const normalize = (v: V3): V3 => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l) as V3; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function random(seed: number) {
  let x = seed >>> 0;
  return () => { x += 0x6d2b79f5; let t = Math.imul(x ^ (x >>> 15), 1 | x); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

interface FaceTriangle { vertices: V3; uv: [V2, V2, V2]; bounds: [number, number, number, number]; det: number }
/** A small lookup over the brow region, using the same canonical UV correspondence as the skin atlas. */
function surface(a: BodyAsset, c: Composed, normals: Float32Array) {
  const triangles: FaceTriangle[] = [];
  const { index, renderVertex: rv, faceUv: uv, faceWeight } = a.body;
  const browIds = Object.values(BROW_LINES).flatMap((b) => [...b.upper, ...b.lower]);
  const xs = browIds.map((i) => CANON_UV[i * 2]), ys = browIds.map((i) => CANON_UV[i * 2 + 1]);
  const bounds = [Math.min(...xs) - 0.015, Math.min(...ys) - 0.015, Math.max(...xs) + 0.015, Math.max(...ys) + 0.015];
  for (let t = 0; t < index.length; t += 3) {
    const vertices: V3 = [rv[index[t]], rv[index[t + 1]], rv[index[t + 2]]];
    if (vertices.some((i) => faceWeight[i] < 40)) continue;
    const pts = vertices.map((i) => [uv[i * 2], uv[i * 2 + 1]] as V2) as [V2, V2, V2];
    const box: [number, number, number, number] = [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
    if (box[2] < bounds[0] || box[3] < bounds[1] || box[0] > bounds[2] || box[1] > bounds[3]) continue;
    const [p, q, r] = pts; const det = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    if (Math.abs(det) > 1e-9) triangles.push({ vertices, uv: pts, bounds: box, det });
  }
  return (p: V2): { position: V3; normal: V3 } | null => {
    for (const tri of triangles) {
      const box = tri.bounds; if (p[0] < box[0] - 1e-7 || p[0] > box[2] + 1e-7 || p[1] < box[1] - 1e-7 || p[1] > box[3] + 1e-7) continue;
      const [a, b, d] = tri.uv; const dx = p[0] - a[0], dy = p[1] - a[1];
      const v = (dx * (d[1] - a[1]) - dy * (d[0] - a[0])) / tri.det;
      const w = ((b[0] - a[0]) * dy - (b[1] - a[1]) * dx) / tri.det; const u = 1 - v - w;
      if (Math.min(u, v, w) < -1e-6) continue;
      const weights = [u, v, w]; const position: V3 = [0, 0, 0], normal: V3 = [0, 0, 0];
      for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) { position[k] += weights[i] * c.body[tri.vertices[i] * 3 + k]; normal[k] += weights[i] * normals[tri.vertices[i] * 3 + k]; }
      return { position, normal: normalize(normal) };
    }
    return null;
  };
}

/** Interpolate the measured inner-to-outer upper/lower contour in the canonical atlas. */
function contour(ids: readonly number[], t: number): V2 {
  const u = Math.max(0, Math.min(ids.length - 1 - 1e-9, t * (ids.length - 1))), i = Math.floor(u);
  const at = (k: number): V2 => [CANON_UV[ids[k] * 2], CANON_UV[ids[k] * 2 + 1]];
  return mix2(at(i), at(i + 1), u - i);
}

export interface BrowFiberOptions { atlas?: boolean; seed?: number }
export interface BrowFibers { position: Float32Array; normal: Float32Array; color: Float32Array; index: Uint16Array; fibers: number; opacity: number }

/**
 * One draw call, at most 1920 triangles with an atlas, and 4800 without one. Roots sit 0.16 mm above the actual skin;
 * strands rise another 0.12 mm then taper. No per-frame simulation, texture download, or change to the face mesh.
 */
export function browFibers(a: BodyAsset, c: Composed, normals: Float32Array, brows: AvatarBrows | null | undefined, options: BrowFiberOptions = {}): BrowFibers | null {
  if (!brows || brows.confidence < 0.35 || brows.density < 0.08 || brows.thickness < 0.02 || !/^#[0-9a-f]{6}$/i.test(brows.color)) return null;
  const atlas = options.atlas ?? true;
  const count = Math.round((atlas ? 32 + 88 * brows.density : 70 + 230 * brows.density) * Math.min(1, brows.confidence / 0.65));
  const sample = surface(a, c, normals), rng = random(options.seed ?? 1729);
  const baseColor = new THREE.Color(brows.color); const pos: number[] = [], normal: number[] = [], color: number[] = [], indices: number[] = [];
  let fibers = 0;
  for (const side of ["right", "left"] as const) {
    const b = BROW_LINES[side];
    for (let h = 0; h < count; h++) {
      // Stratification avoids clusters or gaps. The measured contour supplies arch, thickness and asymmetry.
      const t = (h + rng()) / count; const v = 0.25 + rng() * 0.65;
      const du = 0.018 + 0.04 * t + rng() * 0.015, dv = -(0.35 - 0.27 * t) * (0.7 + rng() * 0.6);
      const path: { position: V3; normal: V3 }[] = [];
      for (let j = 0; j < 5; j++) {
        const s = j / 4, u = Math.min(1, t + du * s), w = Math.max(0, v + dv * s);
        const p = sample(mix2(contour(b.upper, u), contour(b.lower, u), w));
        if (!p) break;
        const lift = (0.00016 + Math.sin(s * Math.PI) * 0.00012) * c.stature / 1.7;
        p.position = p.position.map((x, k) => x + p.normal[k] * lift) as V3; path.push(p);
      }
      if (path.length < 5) continue;
      const start = pos.length / 3, variation = 0.92 + rng() * 0.16;
      // A real brow hair is fine; narrow tapered geometry supplies its silhouette without a hard rectangular card.
      const width = (0.00007 + rng() * 0.000045) * c.stature / 1.7;
      for (let j = 0; j < path.length; j++) {
        const s = j / 4, p = path[j], q = path[j < 4 ? j + 1 : j - 1];
        const direction = p.position.map((x, k) => (q.position[k] - x) * (j < 4 ? 1 : -1)) as V3;
        const lateral = normalize(cross(p.normal, direction)); const radius = width * (1 - s * 0.88) / 2;
        for (const sign of [-1, 1]) {
          pos.push(...p.position.map((x, k) => x + sign * lateral[k] * radius)); normal.push(...p.normal);
          const gain = variation * (0.94 + s * 0.06); color.push(baseColor.r * gain, baseColor.g * gain, baseColor.b * gain);
        }
        if (j) { const x = start + (j - 1) * 2; indices.push(x, x + 1, x + 2, x + 1, x + 3, x + 2); }
      }
      fibers++;
    }
  }
  if (!fibers) return null;
  return { position: new Float32Array(pos), normal: new Float32Array(normal), color: new Float32Array(color), index: new Uint16Array(indices), fibers, opacity: atlas ? 0.36 : 0.88 };
}

/** Attach the result to the Head bone. Like the eyewear, this group carries its own disposal callback. */
export function buildBrowFibers(a: BodyAsset, c: Composed, normals: Float32Array, brows: AvatarBrows | null | undefined, options: BrowFiberOptions = {}): THREE.Group | null {
  const fibers = browFibers(a, c, normals, brows, options); if (!fibers) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(fibers.position, 3)); geo.setAttribute("normal", new THREE.BufferAttribute(fibers.normal, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(fibers.color, 3)); geo.setIndex(new THREE.BufferAttribute(fibers.index, 1)); geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, color: "#ffffff", roughness: 0.82, metalness: 0, envMapIntensity: 0.35, transparent: true, opacity: fibers.opacity, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
  mat.name = "pelos-sobrancelhas";
  const mesh = new THREE.Mesh(geo, mat); mesh.name = "pelos-sobrancelhas";
  const g = new THREE.Group(); g.name = "sobrancelhas"; g.add(mesh);
  const head = a.meta.bones.findIndex((b) => b.name.replace("mixamorig:", "") === "Head");
  g.position.set(-c.joints[head * 3], -c.joints[head * 3 + 1], -c.joints[head * 3 + 2]);
  g.userData.fibers = fibers.fibers; g.userData.dispose = () => { geo.dispose(); mat.dispose(); };
  return g;
}
