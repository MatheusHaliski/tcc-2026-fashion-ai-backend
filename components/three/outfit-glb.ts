/**
 * Peça vestida pelo .glb do produto (glb-garment) em vez do molde paramétrico. O ajuste custa ~0,5 s por peça: fica em
 * cache por corpo × peça × tamanho × camadas de baixo, então a foto que chega depois (ou trocar outra peça do look)
 * não refaz a conta. Recusado pelo aceite (DENTRO_DO_CORPO, ESTICADA, ESPINHO, FURADA…): devolve false e a peça usa o
 * molde. A pele debaixo da peça é trocada por um forro na cor do pano (outfit-skin.ts).
 */
import * as THREE from "three";
import type { HumanParts } from "@/components/three/human-avatar";
import type { OutfitItem } from "@/components/three/human-outfit";
import type { GarmentSpec } from "@/lib/avatar3d/human/garments";
import { bodyFrame, classOf, fitGlbGarment, wearMaterials, type GlbFit, type GlbSource } from "@/lib/avatar3d/human/glb-garment";
import type { BodyFrame } from "@/lib/avatar3d/human/glb-garment/frame";
import { fabricColor, type BodyParam } from "@/lib/avatar3d/human/garments";
import { hideSkin, showSkin } from "@/components/three/outfit-skin";

const fits = new WeakMap<object, Map<string, GlbFit>>();
const ids = new WeakMap<GlbSource, number>(); let nextId = 0;
const idOf = (src: GlbSource) => ids.get(src) ?? (ids.set(src, ++nextId), nextId);

function fitKey(src: GlbSource, spec: GarmentSpec, below: GarmentSpec[]): string {
  const under = below.map((b) => `${b.kind}:${b.layer}:${b.ease.toFixed(4)}`).join(",");
  return [idOf(src), spec.kind, spec.layer, spec.ease.toFixed(4), spec.sizeFold?.length ?? 0, under].join("|");
}

/** Ajuste em cache por corpo composto (outra medida = outro corpo composto = refaz). */
export function cachedFit(parts: HumanParts, frame: () => BodyFrame, src: GlbSource, spec: GarmentSpec, below: GarmentSpec[]): GlbFit {
  let byBody = fits.get(parts.composed); if (!byBody) fits.set(parts.composed, (byBody = new Map()));
  const key = fitKey(src, spec, below);
  let hit = byBody.get(key);
  if (!hit) { hit = fitGlbGarment(src, frame(), spec, below); byBody.set(key, hit); }
  return hit;
}

/**
 * Corpo posado da pose de exibição, calculado uma vez por vestir (só se alguma peça tiver .glb). Vestir de novo
 * começa com a pele inteira: cada peça de .glb que entrar esconde de novo o que cobre.
 */
export function lazyFrame(parts: HumanParts, P: BodyParam): () => BodyFrame {
  showSkin(parts);
  let f: BodyFrame | null = null;
  return () => (f ??= bodyFrame(parts.human, parts.asset, parts.composed, P));
}

/** Veste `it` pelo .glb; true quando a peça entrou (o molde não é montado), false para seguir com o molde. */
export function wearGlb(parts: HumanParts, it: OutfitItem, src: GlbSource | null | undefined, below: GarmentSpec[], frame: () => BodyFrame, meshes: THREE.SkinnedMesh[]): boolean {
  if (!src || !classOf(it.spec.kind)) return false;
  const fit = cachedFit(parts, frame, src, it.spec, below);
  if (!fit.ok) { console.info(`[FashionAI] .glb de ${it.piece.id} recusado (${fit.reason}): molde`); return false; }
  const m = new THREE.SkinnedMesh(fit.geometry.clone(), wearMaterials(src, it.spec.layer));
  m.name = `peca-${it.piece.id}`; m.castShadow = true; m.frustumCulled = false;
  // texturas são do .glb em cache: o desmonte descarta só os materiais clonados, nunca as texturas compartilhadas
  m.userData = { buildPath: "GLB_WRAP", sharedTextures: true, metrics: fit.metrics };
  parts.human.root.add(m); m.bind(parts.human.skeleton, parts.human.body.bindMatrix);
  meshes.push(m);
  // forro: a pele debaixo da peça passa a ser desenhada na cor do pano (a mediana da textura do .glb)
  const map = (src.materials[0] as THREE.MeshStandardMaterial | undefined)?.map?.image as Parameters<typeof fabricColor>[0];
  const lining = hideSkin(parts, fit.covered, fabricColor(map ?? null, it.piece.colorHex), it.spec.layer);
  if (lining) { lining.name = `forro-${it.piece.id}`; meshes.push(lining); }
  return true;
}
