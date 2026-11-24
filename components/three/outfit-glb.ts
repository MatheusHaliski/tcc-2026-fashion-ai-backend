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
import { wearMeshy } from "@/components/three/outfit-meshy";
import { hemProfile, tuckedBySector } from "@/lib/avatar3d/meshy/tuck";
import { generatedSizeShift } from "@/lib/avatar3d/meshy/size";

const fits = new WeakMap<object, Map<string, GlbFit>>();
const ids = new WeakMap<GlbSource, number>(); let nextId = 0;
const idOf = (src: GlbSource) => ids.get(src) ?? (ids.set(src, ++nextId), nextId);

function fitKey(src: GlbSource, spec: GarmentSpec, below: GarmentSpec[], label?: string | null): string {
  const under = below.map((b) => `${b.kind}:${b.layer}:${b.ease.toFixed(4)}`).join(",");
  return [idOf(src), spec.kind, spec.layer, spec.ease.toFixed(4), spec.sizeFold?.length ?? 0, label ?? "", under].join("|");
}

/** Dicas do manifesto para o encaixe (tamanho por região, aceite do modelo, braços abertos, escala real). */
function meshyFitOf(src: GlbSource, label?: string | null) {
  const m = src.manifest; if (!m) return {};
  return { sizes: m.tamanhos, accept: m.dicas.aceite, armsSpread: m.dicas.bracosAbertos, realScale: m.medidaReal === true,
    sizeShift: generatedSizeShift(m, label) };
}

/** Ajuste em cache por corpo composto (outra medida = outro corpo composto = refaz). */
export function cachedFit(parts: HumanParts, frame: () => BodyFrame, src: GlbSource, spec: GarmentSpec, below: GarmentSpec[], label?: string | null): GlbFit {
  let byBody = fits.get(parts.composed); if (!byBody) fits.set(parts.composed, (byBody = new Map()));
  const key = fitKey(src, spec, below, label);
  let hit = byBody.get(key);
  // manifesto: o tamanho entra por região (lib/avatar3d/meshy/size.ts); na escala real, a partir do tamanho gerado
  if (!hit) { hit = fitGlbGarment(src, frame(), spec, below, meshyFitOf(src, label)); byBody.set(key, hit); }
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
  if (!src) return false;
  // calçado: preso ao osso do pé, na medida do pé e no número escolhido (o molde fica de reserva)
  if (it.spec.kind === "shoes" || it.spec.kind === "boots") return wearMeshy(parts, it, src, frame, meshes, it.spec.sizeSteps ?? 0, it.spec.layer);
  if (!classOf(it.spec.kind)) return false;
  const fit = cachedFit(parts, frame, src, it.spec, below, it.piece.sizeLabel);
  if (!fit.ok) {
    // as medidas vão junto com o motivo: é com elas que o limite do aceite é conferido no corpo de cada pessoa
    const m = fit.metrics;
    const measured = m ? ` · esticada ${m.stretch.toFixed(2)} · furada ${(100 * m.pierced).toFixed(1)}% · dentro ${(100 * m.inside).toFixed(1)}% · longe ${m.far.toFixed(2)} m` : "";
    console.info(`[FashionAI] .glb de ${it.piece.id} recusado (${fit.reason}${measured}): molde`);
    return false;
  }
  // tecido não é metal: o mapa metal/rugosidade da Meshy deixa a roupa com brilho de plástico molhado
  const materials = wearMaterials(src, it.spec.layer);
  for (const mat of materials as THREE.MeshStandardMaterial[]) if ("metalness" in mat) mat.metalness = 0;
  const m = new THREE.SkinnedMesh(fit.geometry.clone(), materials);
  m.name = `peca-${it.piece.id}`; m.castShadow = true; m.frustumCulled = false;
  // texturas são do .glb em cache: o desmonte descarta só os materiais clonados, nunca as texturas compartilhadas
  m.userData = { buildPath: "GLB_WRAP", sharedTextures: true, metrics: fit.metrics };
  parts.human.root.add(m); m.bind(parts.human.skeleton, parts.human.body.bindMatrix);
  if (fit.geometry.userData.cls !== "lower") tuckUnder(meshes, fit.geometry);
  meshes.push(m);
  // forro: a pele debaixo da peça passa a ser desenhada na cor do pano (a mediana da textura do .glb)
  const map = (src.materials[0] as THREE.MeshStandardMaterial | undefined)?.map?.image as Parameters<typeof fabricColor>[0];
  const lining = hideSkin(parts, fit.covered, fabricColor(map ?? null, it.piece.colorHex), it.spec.layer);
  if (lining) { lining.name = `forro-${it.piece.id}`; meshes.push(lining); }
  return true;
}

/** A parte de baixo de .glb já vestida some onde a peça de cima (`top`) a cobre: acima da barra dela. */
function tuckUnder(meshes: THREE.SkinnedMesh[], top: THREE.BufferGeometry) {
  const hem = hemProfile(top.userData.posed, top.userData.part);
  if (!hem) return;
  for (const low of meshes) {
    const g = low.geometry, index = g.getIndex();
    if (low.userData.buildPath !== "GLB_WRAP" || g.userData.cls !== "lower" || !index) continue;
    const kept = tuckedBySector(index.array, g.userData.posed, hem); if (!kept) continue;
    g.setIndex(new THREE.BufferAttribute(kept, 1));
    // grupos por material: recortados pela mesma conta não valem mais; um grupo só cobre o índice novo
    if (g.groups.length) { const mat = g.groups[0].materialIndex ?? 0; g.clearGroups(); g.addGroup(0, kept.length, mat); }
  }
}
