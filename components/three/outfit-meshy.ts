/**
 * Calçado e acessório vestidos pelo .glb da Meshy (lib/avatar3d/meshy): o manifesto `.fit.json` do modelo diz onde a
 * peça vai e como ela está no arquivo; sem manifesto, a mesma medida roda aqui no .glb (analyze.ts). A peça é posta
 * no ponto do corpo (place.ts), presa ao osso (rigid.ts) e, no calçado fechado, a pele do pé deixa de ser desenhada —
 * nada da pele atravessa o sapato.
 *
 * Acessório não tem molde: sem .glb (ou sem como prender), ele simplesmente não aparece no avatar.
 */
import * as THREE from "three";
import type { HumanParts } from "@/components/three/human-avatar";
import type { Look3dPiece } from "@/components/three/common";
import { hideSkin } from "@/components/three/outfit-skin";
import { wearMaterials, type GlbSource } from "@/lib/avatar3d/human/glb-garment";
import type { BodyFrame } from "@/lib/avatar3d/human/glb-garment/frame";
import { fabricColor } from "@/lib/avatar3d/human/garments";
import { analyzeGlb } from "@/lib/avatar3d/meshy/analyze";
import type { MeshyManifest } from "@/lib/avatar3d/meshy/manifest";
import { placeOnBody } from "@/lib/avatar3d/meshy/place";
import { coveredByShoe, wornGeometry } from "@/lib/avatar3d/meshy/rigid";
import { SIZE_CONVENTION } from "@/lib/avatar3d/meshy/size";
import { isAccessoryRule, slotRuleOf } from "@/lib/avatar3d/meshy/slots";
import { gridOf } from "@/lib/tryon/sizes";

/** Camada dos acessórios: por cima de toda roupa. */
const ACCESSORY_LAYER = 9;

export interface MeshyItem { key: string; piece: Look3dPiece }

/** Peças do look que são acessório com regra de encaixe (vão num osso, sem molde). */
export function accessoryItems(pieces: Look3dPiece[]): MeshyItem[] {
  return pieces.filter((p) => isAccessoryRule(slotRuleOf(p.category, p.subcategory)) && !!p.model3dUrl).map((p) => ({ key: p.id, piece: p }));
}

/** Manifesto do arquivo ou, sem ele, o calculado agora pela geometria do .glb. */
export function manifestFor(src: GlbSource, piece: Look3dPiece): MeshyManifest | null {
  if (src.manifest) return src.manifest;
  const rule = slotRuleOf(piece.category, piece.subcategory); if (!rule) return null;
  const categoria = piece.category ?? "accessory_piece", sub = (piece.subcategory ?? "").toLowerCase();
  return analyzeGlb(src.position, rule, categoria, sub, gridOf(categoria, sub));
}

/** Cabelo no espaço do corpo (amostra), para o chapéu vestir por cima dele. */
function hairPoints(parts: HumanParts): Float32Array | null {
  const hair = parts.hair; const P = hair?.geometry.getAttribute("position"); if (!hair || !P) return null;
  hair.updateMatrixWorld(true); parts.human.body.updateMatrixWorld(true);
  const toBody = parts.human.body.matrixWorld.clone().invert().multiply(hair.matrixWorld);
  const step = Math.max(1, Math.floor(P.count / 6000)), out: number[] = [], v = new THREE.Vector3();
  for (let i = 0; i < P.count; i += step) { hair.getVertexPosition(i, v).applyMatrix4(toBody); out.push(v.x, v.y, v.z); }
  return Float32Array.from(out);
}

function boneIndexOf(parts: HumanParts) {
  const bones = parts.human.skeleton.bones;
  return (name: string) => { try { return bones.indexOf(parts.human.bone(name)); } catch { return -1; } };
}

/**
 * Veste o calçado ou acessório pelo .glb. true quando entrou ao menos uma malha. `steps`: tamanhos de diferença para
 * o corpo (calçado). As malhas vão para `meshes` (o desmonte do provador descarta geometria e materiais clonados).
 */
export function wearMeshy(parts: HumanParts, it: MeshyItem, src: GlbSource | null | undefined, frame: () => BodyFrame, meshes: THREE.SkinnedMesh[], steps = 0, shoeLayer = 2): boolean {
  if (!src) return false;
  const m = manifestFor(src, it.piece); if (!m || m.attach === "wrap") return false;
  const f = frame(), placed = placeOnBody(src.position, m, f, steps, m.slot === "head" ? hairPoints(parts) : null);
  const layer = m.slot === "feet" ? shoeLayer : ACCESSORY_LAYER, boneIndex = boneIndexOf(parts);
  const map = (src.materials[0] as THREE.MeshStandardMaterial | undefined)?.map?.image as Parameters<typeof fabricColor>[0];
  let worn = 0;
  for (const p of placed) {
    const geometry = wornGeometry(src, p, m, f, boneIndex); if (!geometry) continue;
    geometry.userData = { buildPath: "MESHY_GLB", slot: m.slot, estado: m.estado, ...(m.slot === "feet" ? SIZE_CONVENTION : {}) };
    const mesh = new THREE.SkinnedMesh(geometry, wearMaterials(src, layer));
    mesh.name = `peca-${it.piece.id}${p.side ? (p.side > 0 ? "-esq" : "-dir") : ""}`; mesh.castShadow = true; mesh.frustumCulled = false;
    mesh.userData = { buildPath: "MESHY_GLB", sharedTextures: true, soleLift: m.slot === "feet" ? m.dicas.sola : 0 };
    parts.human.root.add(mesh); mesh.bind(parts.human.skeleton, parts.human.body.bindMatrix);
    meshes.push(mesh); worn++;
    // pé dentro do calçado fechado: some sem forro — a malha da Meshy é fechada, e o forro na cor do calçado aparecia
    // como dedos onde o bico de uma bota de salto não alcança o pé plano do avatar
    const covered = coveredByShoe(p, m, f);
    const lining = covered && hideSkin(parts, covered, fabricColor(map ?? null, it.piece.colorHex), layer);
    if (lining) { lining.removeFromParent(); lining.geometry.dispose(); (lining.material as THREE.Material).dispose(); }
  }
  return worn > 0;
}

/**
 * Quanto o corpo sobe com o calçado: a sola do .glb da Meshy (manifesto) ou a do molde (SOLE_LIFT). Sem calçado, 0.
 * `floorY`: a sola do pé no espaço do corpo.
 */
export function bodyLift(meshes: THREE.Object3D[], shod: boolean, moldLift: number, floorY: number): number {
  if (!shod) return 0;
  const glb = meshes.map((m) => Number(m.userData.soleLift) || 0).filter((x) => x > 0);
  return (glb.length ? Math.max(...glb) : moldLift) - floorY;
}
