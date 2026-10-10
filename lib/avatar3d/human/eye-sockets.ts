import * as THREE from "three";
import type { EyeApertures, EyeRig } from "./eyes";

type Vertex = number[][];
type Polygon = Vertex[];

/**
 * A cabeça ajustada pode fechar a órbita sobre o globo. O shader do olho só limita o globo; ele não remove essas
 * faixas de pele. Subtrai a abertura observada da superfície anterior da órbita, conservando a parede posterior.
 * O recorte fica na própria geometria, acompanha o Head e também funciona no GLB, sem mudar o volume do globo.
 * Mantém os vértices originais (roupas e cabelo usam a mesma malha base) e acrescenta só os pontos das bordas.
 */
export function openEyeSockets(geometry: THREE.BufferGeometry, aperture: EyeApertures, rig: EyeRig): void {
  const layout = Object.entries(geometry.attributes).map(([name, attribute]) => ({ name, attribute: attribute as THREE.BufferAttribute }));
  const pi = layout.findIndex(({ name }) => name === "position");
  const ji = layout.findIndex(({ name }) => name === "skinIndex");
  const wi = layout.findIndex(({ name }) => name === "skinWeight");
  const position = layout[pi].attribute, index = geometry.getIndex()!;
  const values = layout.map(({ attribute }) => Array.from({ length: attribute.count * attribute.itemSize }, (_, i) =>
    attribute.getComponent(Math.floor(i / attribute.itemSize), i % attribute.itemSize)));
  const vertex = (i: number): Vertex => layout.map(({ attribute }) => Array.from({ length: attribute.itemSize }, (_, k) => attribute.getComponent(i, k)));
  const interpolate = (a: Vertex, b: Vertex, f: number): Vertex => {
    const out = a.map((attribute, i) => attribute.map((v, k) => v + (b[i][k] - v) * f));
    // Joint identifiers are categorical. Merge their weights instead of interpolating the identifiers.
    if (ji >= 0 && wi >= 0) {
      const weights = new Map<number, number>();
      for (const [v, amount] of [[a, 1 - f], [b, f]] as const) for (let k = 0; k < 4; k++) {
        const joint = v[ji][k]; weights.set(joint, (weights.get(joint) ?? 0) + v[wi][k] * amount);
      }
      const sorted = [...weights].filter(([, w]) => w > 1e-8).sort((a0, b0) => b0[1] - a0[1]).slice(0, 4);
      const sum = sorted.reduce((s, [, w]) => s + w, 0) || 1;
      out[ji] = Array.from({ length: 4 }, (_, k) => sorted[k]?.[0] ?? 0);
      out[wi] = Array.from({ length: 4 }, (_, k) => (sorted[k]?.[1] ?? 0) / sum);
    }
    return out;
  };
  const split = (poly: Polygon, distance: (v: Vertex) => number): { inside: Polygon; outside: Polygon } => {
    const inside: Polygon = [], outside: Polygon = [];
    let previous = poly[poly.length - 1], pd = distance(previous);
    for (const current of poly) {
      const cd = distance(current);
      if ((pd >= 0) !== (cd >= 0)) {
        const at = interpolate(previous, current, pd / (pd - cd)); inside.push(at); outside.push(at);
      }
      (cd >= 0 ? inside : outside).push(current);
      previous = current; pd = cd;
    }
    return { inside, outside };
  };
  const cross = (a: THREE.Vector2, b: THREE.Vector2, p: number[]) => (b.x - a.x) * (p[1] - a.y) - (b.y - a.y) * (p[0] - a.x);
  const masks = (["left", "right"] as const).map((side) => {
    const points = aperture[side].map((p) => new THREE.Vector2(...p));
    return {
      side, minX: Math.min(...points.map((p) => p.x)), maxX: Math.max(...points.map((p) => p.x)),
      minY: Math.min(...points.map((p) => p.y)), maxY: Math.max(...points.map((p) => p.y)),
      triangles: THREE.ShapeUtils.triangulateShape(points, []).map((tri) => tri.map((i) => points[i])),
    };
  });
  const kept: number[] = [];
  const emit = (poly: Polygon) => {
    for (let k = 1; k < poly.length - 1; k++) {
      const triangle = [poly[0], poly[k], poly[k + 1]], a = triangle[0][pi], b = triangle[1][pi], c = triangle[2][pi];
      const area = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2])).lengthSq();
      if (area < 1e-22) continue;
      for (const v of triangle) {
        kept.push(values[pi].length / 3); v.forEach((attribute, i) => values[i].push(...attribute));
      }
    }
  };
  for (let t = 0; t < index.count; t += 3) {
    const ids = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
    const xs = ids.map((i) => position.getX(i)), ys = ids.map((i) => position.getY(i)), zs = ids.map((i) => position.getZ(i));
    const mask = masks.find((m) => m.triangles.length && Math.max(...xs) >= m.minX && Math.min(...xs) <= m.maxX &&
      Math.max(...ys) >= m.minY && Math.min(...ys) <= m.maxY && Math.max(...zs) > rig.center[m.side][2]);
    if (!mask) { kept.push(...ids); continue; }
    const depth = split(ids.map(vertex), (v) => v[pi][2] - rig.center[mask.side][2]);
    if (depth.outside.length >= 3) emit(depth.outside);
    let remainder = depth.inside.length >= 3 ? [depth.inside] : [];
    for (const triangle of mask.triangles) {
      const orientation = Math.sign(cross(triangle[0], triangle[1], [triangle[2].x, triangle[2].y]));
      const outside: Polygon[] = [];
      for (const poly of remainder) {
        let interior = poly;
        for (let edge = 0; edge < 3 && interior.length >= 3; edge++) {
          const a = triangle[edge], b = triangle[(edge + 1) % 3];
          const parts = split(interior, (v) => orientation * cross(a, b, v[pi]));
          if (parts.outside.length >= 3) outside.push(parts.outside);
          interior = parts.inside;
        }
        // Interior of the triangular aperture is removed; the outside pieces go to the next aperture triangle.
      }
      remainder = outside;
    }
    remainder.forEach(emit);
  }
  layout.forEach(({ name, attribute }, i) => {
    const array = name === "skinIndex" ? new Uint16Array(values[i]) : new Float32Array(values[i]);
    geometry.setAttribute(name, new THREE.BufferAttribute(array, attribute.itemSize));
  });
  geometry.setIndex(kept); geometry.normalizeNormals(); geometry.computeBoundingSphere();
}
