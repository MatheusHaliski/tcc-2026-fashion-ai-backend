/**
 * Veste o avatar com o .glb pronto da peça (modelo de vitrine do produto, catalog_product_models_3d) em vez do molde
 * paramétrico: encaixe (align.ts) → largura, profundidade, colisão, pesos e repouso (wrap.ts) → SkinnedMesh no
 * esqueleto do corpo. A pele que a peça cobre deixa de ser desenhada (cover.ts), como nos jogos: sem pele por baixo,
 * nada atravessa o pano.
 *
 * Tamanho (P/M/G/GG): a folga e o comprimento vêm do mesmo GarmentSpec do molde (applySize em garment-fit.ts: cada
 * número acima do tamanho do corpo soma folga radial e alonga barra e manga); a peça mantém as proporções do .glb.
 *
 * Aceite: se o encaixe não achar âncora, ou a peça ficar dentro do corpo, esticada demais ou com a pele atravessando
 * o pano, devolve null e o provador usa o molde (nunca uma peça quebrada no avatar).
 */
import * as THREE from "three";
import type { GarmentSpec } from "../garments";
import { alignGarment, classOf, groupsOf } from "./align";
import { coverOf } from "./cover";
import type { BodyFrame } from "./frame";
import { wrapGarment, type WrapMetrics } from "./wrap";
import type { MeshyManifest, MeshySizes } from "../../meshy/manifest";
import { SIZE_CONVENTION, applyRegionSize, unsizedSpec } from "../../meshy/size";
import { partOfColor } from "../../meshy/part-codes";

export { bodyFrame } from "./frame";
export { classOf } from "./align";

/** Malha do .glb já no espaço da peça (transformações dos nós aplicadas). */
export interface GlbSource {
  position: Float32Array;
  uv: Float32Array | null;
  index: Uint32Array;
  groups: { start: number; count: number; materialIndex: number }[];
  materials: THREE.Material[];
  /** manifesto de encaixe da Meshy (`.fit.json` ao lado do .glb), quando existe */
  manifest?: MeshyManifest | null;
  /** rótulo da parte por vértice (cor do vértice do motor Blender: 0 tronco, ±1 manga, ±2 perna); null sem ele */
  parts?: Int8Array | null;
}

/**
 * Aceite: dentro do corpo, esticamento visto de frente (p95 das arestas), distância máxima até a pele e pele
 * atravessando o pano (fração da pele debaixo da peça).
 */
export const LIMITS = { inside: 0.03, stretch: 1.8, far: 0.25, pierced: 0.03 };

export type FitMetrics = WrapMetrics & { scale: number; pierced: number };
/** `covered`: 1 para cada vértice de pele que a peça cobre (o corpo deixa de desenhar esses triângulos). */
export interface GlbGarment { geometry: THREE.BufferGeometry; metrics: FitMetrics; covered: Uint8Array }
/**
 * Resultado com o motivo da recusa (laboratório e diagnóstico): SEM_CLASSE, SEM_ANCORA, DENTRO_DO_CORPO, ESTICADA,
 * ESPINHO, FURADA.
 */
export type GlbFit = (GlbGarment & { ok: true }) | { ok: false; reason: string; metrics?: FitMetrics };

/**
 * Folga da peça sobre a pele: a do caimento + tamanho, mais as camadas que estão por baixo DELA — a calça larga não
 * engorda o peito do moletom: só conta a camada de baixo que veste a mesma região (cima × cima/inteira, baixo ×
 * baixo/inteira); na cintura, onde as duas se cruzam, a ordem de desenho das camadas resolve.
 */
export function clearanceOf(spec: GarmentSpec, below: GarmentSpec[]): number {
  // calçado (sem classe) nunca está debaixo da roupa; peça sem classe conhecida conta tudo (como antes)
  const cls = classOf(spec.kind), overlaps = (b: GarmentSpec) => { const k = classOf(b.kind); return !cls || (!!k && (k === cls || k === "full" || cls === "full")); };
  const under = below.filter((b) => b.layer < spec.layer && overlaps(b)).reduce((s, b) => s + Math.max(0.002, b.ease) * 0.7, 0);
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

/** Dicas do manifesto da Meshy para o encaixe da roupa (meshy/manifest.ts). */
export interface MeshyFit {
  sizes?: MeshySizes | null; accept?: MeshyManifest["dicas"]["aceite"]; armsSpread?: boolean; realScale?: boolean;
  /** com `realScale`: altura do ponto alto do ombro no .glb (a peça encaixa por ele, na base do pescoço) */
  shoulderTop?: number;
  /** com `realScale`: tamanho escolhido menos o gerado, em passos da grade (meshy/size.ts generatedSizeShift) */
  sizeShift?: number;
}

/**
 * `sizes` (manifesto da Meshy): o tamanho entra por região (meshy/size.ts) em vez de alongar e escalar a peça inteira;
 * o encaixe pelos ombros/cós usa a peça sem a parte comum do tamanho. `accept` afrouxa o aceite daquele modelo e
 * `armsSpread` deixa a manga horizontal (foto de braços abertos) girar até o braço; `realScale` (peça do motor Blender,
 * em metros e no tamanho escolhido) dispensa a escala pelo corpo.
 */
export function fitGlbGarment(src: GlbSource, f: BodyFrame, spec: GarmentSpec, below: GarmentSpec[] = [], meshy: MeshyFit = {}): GlbFit {
  const { sizes, accept } = meshy;
  const cls = classOf(spec.kind); if (!cls) return { ok: false, reason: "SEM_CLASSE" };
  // com o tamanho por região, a folga da colisão é a da peça sem o tamanho: a sobra vem da largura da própria peça
  const base = sizes ? unsizedSpec(spec, cls === "lower") : spec, clearance = clearanceOf(base, below);
  const aligned = alignGarment(src.position, f, cls, clearance, base.sizeFold?.length ?? 0, src.index, meshy.armsSpread ? 1.8 : 1.4, meshy.realScale === true, meshy.shoulderTop, meshy.realScale ? src.parts : null);
  if (!aligned) return { ok: false, reason: "SEM_ANCORA" };
  // escala real: o tamanho entra a partir do tamanho gerado, nunca do corpo (a mesma peça não muda com o avatar)
  const sized = meshy.realScale ? { ...spec, sizeSteps: meshy.sizeShift ?? 0, sizeFold: undefined } : spec;
  const size = sizes ? { ...SIZE_CONVENTION, ...applyRegionSize(aligned.pos, aligned.part, f, sized, sizes) } : null;
  const armpitY = (f.joint("LeftArm").y + f.joint("RightArm").y) / 2 - 0.05;
  const crotchY = Math.min(f.joint("LeftUpLeg").y, f.joint("RightUpLeg").y) - 0.08;
  // peça do motor Blender com as partes rotuladas: manga e tronco já são superfícies separadas (só a cava é comum)
  if (!(meshy.realScale && src.parts)) src = splitFused(src, aligned.part, aligned.pos, armpitY, crotchY);
  const wrapped = wrapGarment(aligned.pos, aligned.part, src.index, f, groupsOf(cls), clearance);
  const cover = coverOf(wrapped.posed, src.index, aligned.part, f);
  const metrics = { ...wrapped.metrics, scale: aligned.scale, pierced: cover.pierced };
  // `accept`: aceite afrouxado do manifesto (conferido na tela para aquele modelo); nunca aperta o padrão
  const L = { ...LIMITS, stretch: Math.max(LIMITS.stretch, accept?.esticada ?? 0), far: Math.max(LIMITS.far, accept?.espinho ?? 0), pierced: Math.max(LIMITS.pierced, accept?.furada ?? 0) };
  if (metrics.inside > L.inside) return { ok: false, reason: "DENTRO_DO_CORPO", metrics };
  if (metrics.stretch > L.stretch) return { ok: false, reason: "ESTICADA", metrics };
  if (metrics.far > L.far) return { ok: false, reason: "ESPINHO", metrics };
  if (metrics.pierced > L.pierced) return { ok: false, reason: "FURADA", metrics };
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(wrapped.rest, 3));
  if (src.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(src.uv, 2));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(wrapped.skinIndex, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(wrapped.skinWeight, 4));
  g.setIndex(new THREE.BufferAttribute(src.index, 1));
  for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  g.computeVertexNormals();
  // altura posada por vértice e a classe: a peça de cima esconde o que da de baixo fica debaixo dela (meshy/tuck.ts)
  const posedY = Float32Array.from({ length: wrapped.posed.length / 3 }, (_, v) => wrapped.posed[v * 3 + 1]);
  g.userData = { buildPath: "GLB_WRAP", metrics, part: aligned.part, size, cls, posedY, posed: wrapped.posed };
  return { ok: true, geometry: g, metrics, covered: cover.covered };
}

/** Materiais do .glb para vestir: frente e verso visíveis e na frente das camadas de baixo (como o molde). */
export function wearMaterials(src: GlbSource, layer: number): THREE.Material[] {
  return src.materials.map((m) => {
    const c = m.clone(); c.side = THREE.DoubleSide;
    c.vertexColors = false;   // a cor do vértice do motor Blender é o rótulo da parte, não tinge o pano
    c.polygonOffset = true; c.polygonOffsetFactor = -layer; c.polygonOffsetUnits = -layer; c.name = `glb-${m.name || "peca"}`;
    return c;
  });
}

/** Junta as malhas de uma cena GLTF numa fonte só (posição no espaço da cena, um grupo por primitiva/material). */
export function sourceOf(scene: THREE.Object3D): GlbSource | null {
  scene.updateMatrixWorld(true);
  const pos: number[] = [], uv: number[] = [], index: number[] = [], groups: GlbSource["groups"] = [], materials: THREE.Material[] = [];
  const parts: number[] = []; let hasUv = true, labeled = true; const p = new THREE.Vector3();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
    const geo = mesh.geometry; const P = geo.getAttribute("position"); if (!P) return;
    const UV = geo.getAttribute("uv"); hasUv = hasUv && !!UV; const base = pos.length / 3;
    const C = geo.getAttribute("color"); labeled = labeled && !!C;
    if (C) for (let i = 0; i < C.count; i++) parts.push(partOfColor(C.getX(i)));
    for (let i = 0; i < P.count; i++) { p.fromBufferAttribute(P, i).applyMatrix4(mesh.matrixWorld); pos.push(p.x, p.y, p.z); if (UV) uv.push(UV.getX(i), UV.getY(i)); }
    const start = index.length; const I = geo.getIndex();
    if (I) for (let i = 0; i < I.count; i++) index.push(base + I.getX(i)); else for (let i = 0; i < P.count; i++) index.push(base + i);
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) { groups.push({ start, count: index.length - start, materialIndex: materials.length }); materials.push(m); break; }
  });
  if (!pos.length) return null;
  return { position: Float32Array.from(pos), uv: hasUv ? Float32Array.from(uv) : null, index: Uint32Array.from(index), groups, materials,
    parts: labeled && parts.length === pos.length / 3 ? Int8Array.from(parts) : null };
}
