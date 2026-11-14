/**
 * Veste o avatar com o .glb pronto da peça (modelo de vitrine do produto, catalog_product_models_3d) em vez do molde
 * paramétrico: encaixe (align.ts) → colisão, pesos e repouso (wrap.ts) → SkinnedMesh no esqueleto do corpo.
 *
 * Tamanho (P/M/G/GG): a folga e o comprimento vêm do mesmo GarmentSpec do molde (applySize em garment-fit.ts: cada
 * número acima do tamanho do corpo soma folga radial e alonga barra e manga); a peça mantém as proporções do .glb.
 *
 * Aceite: se o encaixe não achar âncora, ou a colisão deixar a peça dentro do corpo ou esticada demais, devolve null e o
 * provador usa o molde (nunca uma peça quebrada no avatar).
 */
import * as THREE from "three";
import type { GarmentSpec } from "../garments";
import { alignGarment, classOf, groupsOf } from "./align";
import type { BodyFrame } from "./frame";
import { wrapGarment, type WrapMetrics } from "./wrap";

export { bodyFrame } from "./frame";
export { classOf } from "./align";

/** Malha do .glb já no espaço da peça (transformações dos nós aplicadas). */
export interface GlbSource {
  position: Float32Array;
  uv: Float32Array | null;
  index: Uint32Array;
  groups: { start: number; count: number; materialIndex: number }[];
  materials: THREE.Material[];
}

/** Aceite: dentro do corpo, esticamento (p95 das arestas) e distância máxima até a pele. */
export const LIMITS = { inside: 0.03, stretch: 1.8, far: 0.25 };

export interface GlbGarment { geometry: THREE.BufferGeometry; metrics: WrapMetrics & { scale: number } }
/** Resultado com o motivo da recusa (laboratório e diagnóstico): SEM_CLASSE, SEM_ANCORA, DENTRO_DO_CORPO, ESTICADA, ESPINHO. */
export type GlbFit = (GlbGarment & { ok: true }) | { ok: false; reason: string; metrics?: WrapMetrics & { scale: number } };

/** Folga da peça sobre a pele: a do caimento + tamanho, mais as camadas que estão por baixo. */
export function clearanceOf(spec: GarmentSpec, below: GarmentSpec[]): number {
  const under = below.filter((b) => b.layer < spec.layer).reduce((s, b) => s + Math.max(0.002, b.ease) * 0.7, 0);
  return Math.min(0.06, Math.max(0.004, spec.ease) + under);
}

/**
 * A Meshy reconstrói a peça de uma foto com o braço caído junto ao corpo: a parte de dentro da manga sai FUNDIDA com a
 * lateral do tronco (não há vão entre braço e corpo na malha), e o mesmo entre as pernas. Esses triângulos ligam partes
 * que se movem separadas e viram tiras quando o braço sobe: são cortados abaixo da axila (e abaixo do gancho).
 */
export function splitFused(src: GlbSource, part: Int8Array, pos: Float32Array, armpitY: number, crotchY: number): GlbSource {
  const index: number[] = []; const groups: GlbSource["groups"] = [];
  const keep = (a: number, b: number, c: number) => {
    const ks = [part[a], part[b], part[c]]; if (ks[0] === ks[1] && ks[1] === ks[2]) return true;
    const low = Math.max(pos[a * 3 + 1], pos[b * 3 + 1], pos[c * 3 + 1]);
    const sleeveTorso = ks.some((k) => Math.abs(k) === 1) && ks.some((k) => k === 0) && low < armpitY;
    const twoLegs = ks.includes(2) && ks.includes(-2) && low < crotchY;
    return !(sleeveTorso || twoLegs);
  };
  const ranges = src.groups.length ? src.groups : [{ start: 0, count: src.index.length, materialIndex: 0 }];
  for (const g of ranges) {
    const start = index.length;
    for (let t = g.start; t < g.start + g.count; t += 3) {
      const a = src.index[t], b = src.index[t + 1], c = src.index[t + 2]; if (keep(a, b, c)) index.push(a, b, c);
    }
    groups.push({ start, count: index.length - start, materialIndex: g.materialIndex });
  }
  return { ...src, index: Uint32Array.from(index), groups: src.groups.length ? groups : [] };
}

export function buildGlbGarment(src: GlbSource, f: BodyFrame, spec: GarmentSpec, below: GarmentSpec[] = []): GlbGarment | null {
  const fit = fitGlbGarment(src, f, spec, below);
  return fit.ok ? fit : null;
}

export function fitGlbGarment(src: GlbSource, f: BodyFrame, spec: GarmentSpec, below: GarmentSpec[] = []): GlbFit {
  const cls = classOf(spec.kind); if (!cls) return { ok: false, reason: "SEM_CLASSE" };
  const clearance = clearanceOf(spec, below);
  const aligned = alignGarment(src.position, f, cls, clearance, spec.sizeFold?.length ?? 0);
  if (!aligned) return { ok: false, reason: "SEM_ANCORA" };
  const armpitY = (f.joint("LeftArm").y + f.joint("RightArm").y) / 2 - 0.05;
  const crotchY = Math.min(f.joint("LeftUpLeg").y, f.joint("RightUpLeg").y) - 0.08;
  src = splitFused(src, aligned.part, aligned.pos, armpitY, crotchY);
  const wrapped = wrapGarment(aligned.pos, aligned.part, src.index, f, groupsOf(cls), clearance);
  const metrics = { ...wrapped.metrics, scale: aligned.scale };
  if (metrics.inside > LIMITS.inside) return { ok: false, reason: "DENTRO_DO_CORPO", metrics };
  if (metrics.stretch > LIMITS.stretch) return { ok: false, reason: "ESTICADA", metrics };
  if (metrics.far > LIMITS.far) return { ok: false, reason: "ESPINHO", metrics };
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(wrapped.rest, 3));
  if (src.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(src.uv, 2));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(wrapped.skinIndex, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(wrapped.skinWeight, 4));
  g.setIndex(new THREE.BufferAttribute(src.index, 1));
  for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  g.computeVertexNormals();
  g.userData = { buildPath: "GLB_WRAP", metrics, part: aligned.part };
  return { ok: true, geometry: g, metrics };
}

/** Materiais do .glb para vestir: frente e verso visíveis e na frente das camadas de baixo (como o molde). */
export function wearMaterials(src: GlbSource, layer: number): THREE.Material[] {
  return src.materials.map((m) => {
    const c = m.clone(); c.side = THREE.DoubleSide;
    c.polygonOffset = true; c.polygonOffsetFactor = -layer; c.polygonOffsetUnits = -layer; c.name = `glb-${m.name || "peca"}`;
    return c;
  });
}

/** Junta as malhas de uma cena GLTF numa fonte só (posição no espaço da cena, um grupo por primitiva/material). */
export function sourceOf(scene: THREE.Object3D): GlbSource | null {
  scene.updateMatrixWorld(true);
  const pos: number[] = [], uv: number[] = [], index: number[] = [], groups: GlbSource["groups"] = [], materials: THREE.Material[] = [];
  let hasUv = true; const p = new THREE.Vector3();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
    const geo = mesh.geometry; const P = geo.getAttribute("position"); if (!P) return;
    const UV = geo.getAttribute("uv"); hasUv = hasUv && !!UV; const base = pos.length / 3;
    for (let i = 0; i < P.count; i++) { p.fromBufferAttribute(P, i).applyMatrix4(mesh.matrixWorld); pos.push(p.x, p.y, p.z); if (UV) uv.push(UV.getX(i), UV.getY(i)); }
    const start = index.length; const I = geo.getIndex();
    if (I) for (let i = 0; i < I.count; i++) index.push(base + I.getX(i)); else for (let i = 0; i < P.count; i++) index.push(base + i);
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) { groups.push({ start, count: index.length - start, materialIndex: materials.length }); materials.push(m); break; }
  });
  if (!pos.length) return null;
  return { position: Float32Array.from(pos), uv: hasUv ? Float32Array.from(uv) : null, index: Uint32Array.from(index), groups, materials };
}
