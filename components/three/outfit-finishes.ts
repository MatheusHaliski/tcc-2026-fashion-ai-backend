/**
 * Acabamentos 3D das peças do provador, extraídos do HumanOutfit sem mudar o resultado: partes do calçado (sola,
 * cabedal, cadarço), barra, punho, botões, costura e gola, cada um uma SkinnedMesh presa ao esqueleto do corpo.
 */
import * as THREE from "three";
import type { HumanParts } from "@/components/three/human-avatar";
import type { OutfitItem } from "@/components/three/human-outfit";
import type { BodyAsset } from "@/lib/avatar3d/human/asset";
import type { Composed } from "@/lib/avatar3d/human/compose";
import { collarBand, ribColor, trimColors, type BodyParam, type GarmentGeometry, type GarmentSpec, type PhotoInfo, type UnderLayer } from "@/lib/avatar3d/human/garments";
import { hasRibbing } from "@/lib/avatar3d/human/upperwear";
import { garmentTrims } from "@/lib/avatar3d/human/garment-trims";
import { shoeParts, shoeStyleOf } from "@/lib/avatar3d/human/shoes";

type Img = CanvasImageSource & { width: number; height: number };
type Human = HumanParts["human"];

/** Sola com espessura, cadarço e colarinho acolchoado (shoes.ts): tênis, não meia. */
export function shoePartMeshes(human: Human, asset: BodyAsset, composed: Composed, P: BodyParam, it: OutfitItem, sc: { upper: string; sole: string; accent?: string | null }): THREE.SkinnedMesh[] {
  const out: THREE.SkinnedMesh[] = [];
  for (const part of shoeParts(asset, composed, P, it.spec, sc, shoeStyleOf(it.piece.subcategory))) {
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.Float32BufferAttribute(part.position, 3));
    pg.setAttribute("color", new THREE.Float32BufferAttribute(part.color, 3));
    pg.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(part.skinIndex, 4));
    pg.setAttribute("skinWeight", new THREE.Float32BufferAttribute(part.skinWeight, 4));
    pg.setIndex(Array.from(part.index)); pg.computeVertexNormals();
    const pm = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: part.name === "sola" ? 0.55 : part.name === "cabedal" ? 0.7 : 0.85, sheen: part.name === "sola" ? 0 : 0.3, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -it.spec.layer - 1, polygonOffsetUnits: -it.spec.layer - 1 });
    pm.name = `calcado-${part.name}`;
    const pmesh = new THREE.SkinnedMesh(pg, pm); pmesh.name = `${part.name}-${it.piece.id}`; pmesh.castShadow = true; pmesh.frustumCulled = false;
    human.root.add(pmesh); pmesh.bind(human.skeleton, human.body.bindMatrix); out.push(pmesh);
  }
  return out;
}

export interface FinishContext {
  shoe: boolean; finishes: { hem: boolean; cuff: boolean; collar: boolean }; above: GarmentSpec[];
  img: Img | null; fabric: string; info: PhotoInfo | null; under: UnderLayer | null;
}

/** Barra, punho, botões e costura (faixas com espessura) e a gola contornando o decote, nas cores da foto. */
export function finishMeshes(human: Human, asset: BodyAsset, cc: Composed, P: BodyParam, gg: GarmentGeometry, it: OutfitItem, ctx: FinishContext): THREE.SkinnedMesh[] {
  const { shoe, finishes, above, img, fabric, info, under } = ctx;
  const out: THREE.SkinnedMesh[] = [];
  // barra e manga com acabamento 3D (faixa com espessura dando a volta), na cor do acabamento da foto
  if (!shoe) {
    const tc = trimColors(img, fabric, info); const rib = ribColor(img, fabric, info, { wide: it.spec.kind === "shirt" });
    for (const tb of garmentTrims(asset, cc, P, gg, { preservePhotoDetails: !!info && !it.piece.defaultImage })) {
      if (tb.part === "barra" ? !finishes.hem : tb.part === "punho" ? !finishes.cuff : above.length > 0) continue;
      const tg = new THREE.BufferGeometry();
      tg.setAttribute("position", new THREE.Float32BufferAttribute(tb.position, 3));
      tg.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(tb.skinIndex, 4));
      tg.setAttribute("skinWeight", new THREE.Float32BufferAttribute(tb.skinWeight, 4));
      tg.setIndex(Array.from(tb.index)); tg.computeVertexNormals();
      const ribbed = hasRibbing(it.spec);
      // botão claro com aro escuro (nítido sobre qualquer tecido); linha do pesponto escura em tecido claro e clara em
      // tecido escuro; pontas da gola na cor da gola da foto
      const fl = new THREE.Color(fabric); const light = 0.2126 * fl.r + 0.7152 * fl.g + 0.0722 * fl.b > 0.35;
      const thread = `#${(light ? fl.clone().multiplyScalar(0.62) : fl.clone().lerp(new THREE.Color("#ffffff"), 0.4)).getHexString()}`;
      const cuff = tb.side === -1 ? tc.cuffLeft : tb.side === 1 ? tc.cuffRight : tc.cuff;
      const color = tb.part === "capuz" ? fabric : tb.part === "botoes" ? "#efe8da" : tb.part === "botoes-borda" ? "#3a332b" : tb.part === "costura" ? thread : tb.part === "gola-ponta" ? rib
        : (tb.part === "barra" ? tc.hem : tb.part === "punho" ? cuff : null) ?? (ribbed ? rib : `#${fl.clone().multiplyScalar(0.92).getHexString()}`);
      const tm = new THREE.MeshPhysicalMaterial({ color, roughness: tb.part === "botoes" ? 0.45 : 0.9, sheen: tb.part === "botoes" ? 0.1 : 0.45, sheenRoughness: 0.8, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -it.spec.layer - 1, polygonOffsetUnits: -it.spec.layer - 1 });
      tm.name = `acabamento-${tb.part}`;
      const tmesh = new THREE.SkinnedMesh(tg, tm); tmesh.name = `${tb.part}-${it.piece.id}`; tmesh.castShadow = true; tmesh.frustumCulled = false;
      human.root.add(tmesh); tmesh.bind(human.skeleton, human.body.bindMatrix); out.push(tmesh);
    }
  }
  // gola 3D contornando o decote inteiro (frente, lados e nuca), na cor da gola da foto
  const cb = shoe || !finishes.collar ? null : collarBand(asset, cc, P, it.spec, under);
  if (cb) {
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.Float32BufferAttribute(cb.position, 3));
    bg.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(cb.skinIndex, 4));
    bg.setAttribute("skinWeight", new THREE.Float32BufferAttribute(cb.skinWeight, 4));
    bg.setIndex(Array.from(cb.index)); bg.computeVertexNormals();
    const bm = new THREE.MeshPhysicalMaterial({ color: ribColor(img, fabric, info, { wide: it.spec.kind === "shirt" }), roughness: 0.9, sheen: 0.4, sheenRoughness: 0.8, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -it.spec.layer - 1, polygonOffsetUnits: -it.spec.layer - 1 });
    bm.name = `gola-${it.spec.kind}`;
    const band = new THREE.SkinnedMesh(bg, bm); band.name = `gola-${it.piece.id}`; band.castShadow = true; band.frustumCulled = false;
    human.root.add(band); band.bind(human.skeleton, human.body.bindMatrix); out.push(band);
  }
  return out;
}
