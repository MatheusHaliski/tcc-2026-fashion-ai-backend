"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import * as THREE from "three";
import { mediaUrl } from "@/lib/api/client";
import { loadTexture, type Look3dPiece } from "@/components/three/common";
import type { HumanParts } from "@/components/three/human-avatar";
import { applyIdle, setArmOut } from "@/lib/avatar3d/human/pose";
import {
  SPECS, armOutFor, bodyParam, collarBand, fabricColor, ribColor, shoeColors, garmentGeometry, garmentMaterial, garmentTexture, kindOf, photoInfo, posedPositions, texturedGeometry, underLayer,
  type GarmentKind, type GarmentSpec,
} from "@/lib/avatar3d/human/garments";
import { DEFAULT_PIECES, ZONES, withDefaultOutfit, zonesCovered } from "@/lib/avatar3d/human/default-outfit";

/*
 * Provador / vitrines 3D — as peças do look vestidas no corpo humano do avatar (lib/avatar3d/human/garments.ts): cada
 * peça é uma malha presa ao mesmo esqueleto, em camadas, com a foto da peça na frente. A zona do corpo sem peça no
 * look (tronco, pernas ou pés) recebe uma peça padrão dos assets do FashionAI (lib/avatar3d/human/default-outfit.ts).
 *
 * Nunca sem roupa, nem por um quadro:
 *  - a roupa é montada no mesmo commit em que o corpo aparece (useLayoutEffect), já na cor do tecido; a foto da peça
 *    entra quando termina de carregar (a malha é refeita no mesmo commit, sem intervalo sem roupa);
 *  - se um molde falhar, a zona recebe a peça padrão;
 *  - o corpo só fica visível com as três zonas cobertas (root.userData.dressed); o HumanAvatar reforça isso a cada quadro.
 */
export interface OutfitItem { key: string; spec: GarmentSpec; piece: Look3dPiece }

export function outfitOf(pieces: Look3dPiece[]): OutfitItem[] {
  const items: OutfitItem[] = [];
  for (const p of withDefaultOutfit(pieces)) { const k = kindOf(p); if (k) items.push({ key: p.id, spec: SPECS[k], piece: p }); }
  return items.sort((a, b) => a.spec.layer - b.spec.layer);
}

type Img = CanvasImageSource & { width: number; height: number };

/** Veste o corpo com as peças (síncrono). Devolve as malhas criadas e se as três zonas ficaram cobertas. */
function dress(parts: HumanParts, items: OutfitItem[], images: Record<string, Img | null>): { meshes: THREE.SkinnedMesh[]; dressed: boolean } {
  const { human, pose, composed, asset } = parts;
  setArmOut(human, pose, armOutFor(items.map((i) => i.spec)));   // saia rodada e camadas grossas: braço mais aberto
  applyIdle(human, pose, 0, 0);                                    // pose de exibição, sem o movimento, para projetar a foto
  const P = bodyParam(asset, composed);
  const meshes: THREE.SkinnedMesh[] = []; const below: GarmentSpec[] = []; const built: GarmentKind[] = [];
  const wear = (it: OutfitItem) => {
    const under = below.length ? underLayer(composed, P, below) : null;
    const gg = garmentGeometry(asset, composed, human.rest.normals, P, it.spec, under);
    below.push(it.spec); if (!gg) return;
    const img = images[it.key] ?? null;
    const posed = posedPositions(human.skeleton, human.body.bindMatrix, gg.position, gg.skinIndex, gg.skinWeight);
    const geo = texturedGeometry(gg, posed, img ? photoInfo(img) : null);
    const shoe = it.spec.kind === "shoes" || it.spec.kind === "boots";
    const fabric = fabricColor(img, it.piece.colorHex);
    const tex = garmentTexture(shoe ? null : img, shoe ? "#ffffff" : fabric);
    if (shoe) {                                                    // cabedal e sola nas cores da foto (cor por vértice)
      const sc = shoeColors(img, it.piece.colorHex); const up = new THREE.Color(sc.upper), so = new THREE.Color(sc.sole);
      const pos = geo.getAttribute("position"), col = geo.getAttribute("color");
      for (let i = 0; i < pos.count; i++) { const k = pos.getY(i) < 0.022 ? so : up; col.setXYZ(i, k.r, k.g, k.b); }
    }
    const m = new THREE.SkinnedMesh(geo, garmentMaterial(tex, it.spec)); m.name = `peca-${it.piece.id}`;
    m.castShadow = true; m.frustumCulled = false;
    human.root.add(m); m.bind(human.skeleton, human.body.bindMatrix);
    meshes.push(m); built.push(it.spec.kind);
    // gola 3D contornando o decote inteiro (frente, lados e nuca), na cor da gola da foto
    const cb = shoe ? null : collarBand(asset, composed, P, it.spec, under);
    if (cb) {
      const bg = new THREE.BufferGeometry();
      bg.setAttribute("position", new THREE.Float32BufferAttribute(cb.position, 3));
      bg.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(cb.skinIndex, 4));
      bg.setAttribute("skinWeight", new THREE.Float32BufferAttribute(cb.skinWeight, 4));
      bg.setIndex(Array.from(cb.index)); bg.computeVertexNormals();
      const bm = new THREE.MeshPhysicalMaterial({ color: ribColor(img, fabric), roughness: 0.9, sheen: 0.4, sheenRoughness: 0.8, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -it.spec.layer - 1, polygonOffsetUnits: -it.spec.layer - 1 });
      bm.name = `gola-${it.spec.kind}`;
      const band = new THREE.SkinnedMesh(bg, bm); band.name = `gola-${it.piece.id}`; band.castShadow = true; band.frustumCulled = false;
      human.root.add(band); band.bind(human.skeleton, human.body.bindMatrix); meshes.push(band);
    }
  };
  for (const it of items) wear(it);
  // molde que falhou: a zona recebe a peça padrão (sem foto ainda — a cor do tecido cobre)
  for (const z of ZONES) {
    if (zonesCovered(built).has(z)) continue;
    const p = DEFAULT_PIECES[z]; const k = kindOf(p);
    if (k) wear({ key: p.id, spec: SPECS[k], piece: p });
  }
  // sola do calçado: o corpo sobe o que a sola desce
  human.root.position.y = built.some((k) => k === "shoes" || k === "boots") ? 0.012 : 0;
  const covered = zonesCovered(built);
  return { meshes, dressed: ZONES.every((z) => covered.has(z)) };
}

export function HumanOutfit({ parts, pieces }: { parts: HumanParts; pieces: Look3dPiece[] }) {
  const [images, setImages] = useState<Record<string, Img | null>>({});
  const items = outfitOf(pieces);
  const urlKey = items.map((i) => `${i.key}:${i.piece.studioUrl ?? i.piece.imageUrl ?? ""}`).join("|");
  useEffect(() => {
    let alive = true;
    Promise.all(items.map(async (i) => {
      const u = mediaUrl(i.piece.studioUrl ?? i.piece.imageUrl ?? null);
      const t = u ? await loadTexture(u) : null;
      return [i.key, (t?.image as Img | undefined) ?? null] as const;
    })).then((kv) => { if (alive) setImages(Object.fromEntries(kv)); });
    return () => { alive = false; };
  }, [urlKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // antes da pintura: o corpo nunca é desenhado sem as peças (sem foto ainda, na cor do tecido)
  useLayoutEffect(() => {
    const root = parts.human.root;
    const { meshes, dressed } = dress(parts, items, images);
    root.userData.dressed = dressed; root.visible = dressed;
    root.userData.garments = meshes.map((m) => m.name);
    if (!dressed) console.error("[FashionAI] avatar sem as três zonas cobertas: corpo escondido");
    return () => {
      root.userData.dressed = false; root.visible = false; root.userData.garments = [];
      for (const m of meshes) { m.removeFromParent(); m.geometry.dispose(); const mat = m.material as THREE.MeshPhysicalMaterial; mat.map?.dispose(); mat.dispose(); }
      root.position.y = 0;
    };
  }, [parts, urlKey, images]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
