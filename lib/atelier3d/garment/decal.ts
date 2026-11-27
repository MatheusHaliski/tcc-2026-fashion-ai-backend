import { blendAt, type Pixels } from "./raster";
import type { Decal } from "./state";
import type { Vec3 } from "../document";

type V2 = [number, number];
export interface DecalTriangle {
  uv: [V2, V2, V2];
  st: [V2, V2, V2];
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vec3): Vec3 => {
  const length = Math.hypot(...a) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};

/** Base do projetor: direita/cima no plano tangente ao ponto, girados pela rotação da estampa. */
export function decalBasis(normal: Vec3, rotation: number) {
  const n = unit(normal);
  const reference: Vec3 = Math.abs(n[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0];
  const up0 = unit(sub(reference, n.map((x) => x * dot(reference, n)) as Vec3));
  const right0 = cross(up0, n);
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  const right = right0.map((x, i) => x * cos + up0[i] * sin) as Vec3;
  const up = up0.map((x, i) => x * cos - right0[i] * sin) as Vec3;
  return { n, right, up };
}

/**
 * Projeção ortográfica em caixa (como um decalque): cada triângulo voltado para o projetor e dentro da
 * caixa recebe coordenadas da imagem (s, t). As posições são as originais da malha, então a estampa
 * fica presa ao UV mesmo depois de modelar a peça.
 */
export function decalTriangles(
  positions: ArrayLike<number>,
  uvs: ArrayLike<number>,
  index: ArrayLike<number> | null,
  decal: Pick<Decal, "position" | "normal" | "size" | "rotation">,
  aspect = 1,
): DecalTriangle[] {
  const { n, right, up } = decalBasis(decal.normal, decal.rotation);
  const width = decal.size, height = decal.size * aspect, depth = Math.max(width, height) * 0.6;
  const count = index ? index.length : positions.length / 3;
  const point = (i: number): Vec3 => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
  const out: DecalTriangle[] = [];
  for (let k = 0; k + 2 < count; k += 3) {
    const ids = [0, 1, 2].map((o) => (index ? index[k + o] : k + o));
    const [a, b, c] = ids.map(point);
    const face = unit(cross(sub(b, a), sub(c, a)));
    if (Math.abs(dot(face, n)) < 0.15) continue;
    const local = [a, b, c].map((p) => sub(p, decal.position));
    if (local.every((p) => Math.abs(dot(p, n)) > depth)) continue;
    const st = local.map((p) => [dot(p, right) / width + 0.5, 0.5 - dot(p, up) / height] as V2) as [V2, V2, V2];
    if (st.every(([s]) => s < 0) || st.every(([s]) => s > 1) || st.every(([, t]) => t < 0) || st.every(([, t]) => t > 1)) continue;
    const uv = ids.map((i) => [uvs[i * 2], uvs[i * 2 + 1]] as V2) as [V2, V2, V2];
    out.push({ uv, st });
  }
  return out;
}

/** Rasteriza os triângulos no espaço UV da textura, amostrando a imagem da estampa (fora dela = nada). */
export function rasterDecal(target: Pixels, image: Pixels, triangles: DecalTriangle[], opacity: number) {
  const W = target.width, H = target.height;
  for (const { uv, st } of triangles) {
    // UV fora de 0..1 (texturas repetidas) volta para o ladrilho pelo canto do triângulo, sem partir a face
    const shiftU = Math.floor(Math.min(uv[0][0], uv[1][0], uv[2][0])), shiftV = Math.floor(Math.min(uv[0][1], uv[1][1], uv[2][1]));
    const p = uv.map(([u, v]) => [(u - shiftU) * W, (v - shiftV) * H]);
    if (Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0])) > W) continue;
    const det = (p[1][1] - p[2][1]) * (p[0][0] - p[2][0]) + (p[2][0] - p[1][0]) * (p[0][1] - p[2][1]);
    if (Math.abs(det) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((p[1][1] - p[2][1]) * (px - p[2][0]) + (p[2][0] - p[1][0]) * (py - p[2][1])) / det;
        const w1 = ((p[2][1] - p[0][1]) * (px - p[2][0]) + (p[0][0] - p[2][0]) * (py - p[2][1])) / det;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        const s = st[0][0] * w0 + st[1][0] * w1 + st[2][0] * w2, t = st[0][1] * w0 + st[1][1] * w1 + st[2][1] * w2;
        if (s < 0 || s >= 1 || t < 0 || t >= 1) continue;
        const j = (Math.floor(t * image.height) * image.width + Math.floor(s * image.width)) * 4;
        blendAt(target.data, (y * W + x) * 4, image.data[j], image.data[j + 1], image.data[j + 2], (image.data[j + 3] / 255) * opacity);
      }
  }
}
