/*
 * Avatar 3D (RF40) — abertura medida do olho: recorte por shader entre as pálpebras (fitEyeOpening) e o mesmo recorte
 * gravado na geometria para o GLB (clipEyeGeometryForExport).
 */
import * as THREE from "three";
import type { EyeApertures } from "./eyes";
import type { Human } from "./three-human";

/** Abre cada globo apenas entre as pálpebras medidas, com cobertura MSAA e o contorno fixo na cabeça (não na íris). */
export function fitEyeOpening(material: THREE.MeshPhysicalMaterial, aperture: EyeApertures, head: THREE.Bone): () => void {
  const uniforms = {
    ocularLeft: { value: aperture.left.map((p) => new THREE.Vector2(...p)) },
    ocularRight: { value: aperture.right.map((p) => new THREE.Vector2(...p)) },
    ocularRestHead: { value: head.matrixWorld.clone() },
    ocularHeadInverse: { value: new THREE.Matrix4() },
  };
  const update = () => uniforms.ocularHeadInverse.value.copy(head.matrixWorld).invert();
  material.alphaToCoverage = true;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
      uniform mat4 ocularRestHead;
      uniform mat4 ocularHeadInverse;
      varying vec2 vOcularPosition;`);
    shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", `#include <project_vertex>
      vOcularPosition = (ocularRestHead * ocularHeadInverse * modelMatrix * vec4(transformed, 1.0)).xy;`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
      uniform vec2 ocularLeft[16];
      uniform vec2 ocularRight[16];
      varying vec2 vOcularPosition;
      float ocularEdge(vec2 p, vec2 contour[16]) {
        bool inside = false;
        float nearest = 1e6;
        vec2 previous = contour[15];
        for (int i = 0; i < 16; i++) {
          vec2 current = contour[i];
          vec2 e = current - previous;
          float f = clamp(dot(p - previous, e) / max(dot(e, e), 1e-12), 0.0, 1.0);
          nearest = min(nearest, length(p - previous - f * e));
          if ((current.y > p.y) != (previous.y > p.y)) {
            float crossing = current.x + (p.y - current.y) * (previous.x - current.x) / (previous.y - current.y);
            if (p.x < crossing) inside = !inside;
          }
          previous = current;
        }
        float signedDistance = inside ? nearest : -nearest;
        float aa = max(fwidth(signedDistance), 1e-5);
        return smoothstep(-aa, aa, signedDistance);
      }`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <alphatest_fragment>", `
      float ocularCoverage = vOcularPosition.x > 0.0 ? ocularEdge(vOcularPosition, ocularLeft) : ocularEdge(vOcularPosition, ocularRight);
      if (ocularCoverage < 0.001) discard;
      diffuseColor.a *= ocularCoverage;
      #include <alphatest_fragment>`);
  };
  material.customProgramCacheKey = () => "observed-eye-aperture-v1";
  material.userData.eyeAperture = aperture;
  return update;
}

/**
 * glTF não guarda onBeforeCompile. Recorta os triângulos do globo na pose neutra, interpolando os atributos, para
 * manter a abertura medida no arquivo. A animação exportada movimenta a cabeça, sem olhar independente dos olhos.
 * Retorna uma malha temporária; o chamador deve restaurar a original e descartar esta após exportar.
 */
export function clipEyeGeometryForExport(h: Human): THREE.BufferGeometry | null {
  const aperture = (h.eyes.material as THREE.Material).userData.eyeAperture as EyeApertures | undefined;
  if (!aperture) return null;
  const g = h.eyes.geometry, position = g.getAttribute("position") as THREE.BufferAttribute;
  const index = g.getIndex()!;
  const attributes = Object.entries(g.attributes) as [string, THREE.BufferAttribute][];
  const layout = attributes.map(([name, attr]) => ({ name, attr, size: attr.itemSize }));
  const values = layout.map(() => [] as number[]);
  const vertex = (i: number) => layout.map(({ attr, size }) => Array.from({ length: size }, (_, k) => Number(attr.array[i * size + k])));
  const posIndex = layout.findIndex((a) => a.name === "position");
  const polygons = (s: "left" | "right") => {
    const points = aperture[s].map((p) => new THREE.Vector2(...p));
    return THREE.ShapeUtils.triangulateShape(points, []).map((tri) => tri.map((i) => points[i]));
  };
  const masks = { left: polygons("left"), right: polygons("right") };
  const cross = (a: THREE.Vector2, b: THREE.Vector2, p: number[]) => (b.x - a.x) * (p[1] - a.y) - (b.y - a.y) * (p[0] - a.x);
  for (let t = 0; t < index.count; t += 3) {
    const ids = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
    const side = position.getX(ids[0]) > 0 ? "left" : "right";
    for (const mask of masks[side]) {
      let poly = ids.map(vertex);
      const orientation = Math.sign(cross(mask[0], mask[1], [mask[2].x, mask[2].y]));
      for (let edge = 0; edge < 3 && poly.length; edge++) {
        const a = mask[edge], b = mask[(edge + 1) % 3], output: number[][][] = [];
        let previous = poly[poly.length - 1];
        let pd = orientation * cross(a, b, previous[posIndex]);
        for (const current of poly) {
          const cd = orientation * cross(a, b, current[posIndex]);
          if ((pd >= 0) !== (cd >= 0)) {
            const f = pd / (pd - cd);
            output.push(previous.map((attr, j) => attr.map((v, k) => v + (current[j][k] - v) * f)));
          }
          if (cd >= 0) output.push(current);
          previous = current; pd = cd;
        }
        poly = output;
      }
      for (let k = 1; k < poly.length - 1; k++) {
        const tri = [poly[0], poly[k], poly[k + 1]], a = tri[0][posIndex], b = tri[1][posIndex], c = tri[2][posIndex];
        const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
        if (area < 1e-12) continue;
        for (const v of tri) v.forEach((attr, j) => values[j].push(...attr));
      }
    }
  }
  const out = new THREE.BufferGeometry();
  layout.forEach(({ name, attr, size }, i) => {
    const Ctor = attr.array.constructor as Float32ArrayConstructor | Uint16ArrayConstructor | Uint8ArrayConstructor;
    out.setAttribute(name, new THREE.BufferAttribute(new Ctor(values[i]), size, attr.normalized));
  });
  out.normalizeNormals(); out.computeBoundingSphere();
  return out;
}
