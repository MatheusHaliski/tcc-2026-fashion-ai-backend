"use client";
import { useEffect, useState } from "react";
import * as THREE from "three";
import { mediaUrl } from "@/lib/api/client";
import { loadTexture, type Look3dPiece } from "@/components/three/common";
import type { HumanParts } from "@/components/three/human-avatar";
import { applyIdle } from "@/lib/avatar3d/human/pose";
import {
  SPECS, bodyParam, covers, fabricColor, shoeColors, garmentGeometry, garmentMaterial, garmentTexture, kindOf, photoInfo, posedPositions, texturedGeometry, underLayer,
  type GarmentKind, type GarmentSpec,
} from "@/lib/avatar3d/human/garments";

/*
 * Provador / vitrines 3D — as peças do look vestidas no corpo humano do avatar (lib/avatar3d/human/garments.ts): cada
 * peça é uma malha presa ao mesmo esqueleto, em camadas, com a foto da peça na frente. Sem peça de cima (ou de baixo),
 * o corpo recebe uma roupa de base neutra: o avatar nunca aparece sem roupa.
 */
export interface OutfitItem { key: string; spec: GarmentSpec; piece: Look3dPiece | null }

export function outfitOf(pieces: Look3dPiece[], sex: "FEMININO" | "MASCULINO"): OutfitItem[] {
  const items: OutfitItem[] = [];
  for (const p of pieces) { const k = kindOf(p); if (k) items.push({ key: p.id, spec: SPECS[k], piece: p }); }
  const has = (f: (k: GarmentKind) => boolean) => items.some((i) => f(i.spec.kind));
  if (!has((k) => covers(k).lower)) items.push({ key: "base-bottom", spec: SPECS.baseBottom, piece: null });
  if (sex === "FEMININO" && !has((k) => covers(k).upper && k !== "shoes" && k !== "boots")) items.push({ key: "base-top", spec: SPECS.baseTop, piece: null });
  return items.sort((a, b) => a.spec.layer - b.spec.layer);
}

type Img = CanvasImageSource & { width: number; height: number };
const BASE_COLOR = "#8e8984";

export function HumanOutfit({ parts, pieces, sex }: { parts: HumanParts; pieces: Look3dPiece[]; sex: "FEMININO" | "MASCULINO" }) {
  const [images, setImages] = useState<Record<string, Img | null>>({});
  const items = outfitOf(pieces, sex);
  const urlKey = items.map((i) => `${i.key}:${i.piece?.studioUrl ?? i.piece?.imageUrl ?? ""}`).join("|");
  useEffect(() => {
    let alive = true;
    Promise.all(items.map(async (i) => {
      const u = mediaUrl(i.piece?.studioUrl ?? i.piece?.imageUrl ?? null);
      const t = u ? await loadTexture(u) : null;
      return [i.key, (t?.image as Img | undefined) ?? null] as const;
    })).then((kv) => { if (alive) setImages(Object.fromEntries(kv)); });
    return () => { alive = false; };
  }, [urlKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!items.every((i) => i.key in images)) return;
    const { human, pose, composed, asset } = parts;
    applyIdle(human, pose, 0, 0);                         // pose de exibição, sem o movimento, para projetar a foto
    const P = bodyParam(asset, composed);
    const meshes: THREE.SkinnedMesh[] = []; const below: GarmentSpec[] = [];
    for (const it of items) {
      const gg = garmentGeometry(asset, composed, human.rest.normals, P, it.spec, below.length ? underLayer(composed, P, below) : null);
      below.push(it.spec); if (!gg) continue;
      const img = images[it.key] ?? null;
      const posed = posedPositions(human.skeleton, human.body.bindMatrix, gg.position, gg.skinIndex, gg.skinWeight);
      const geo = texturedGeometry(gg, posed, img ? photoInfo(img) : null);
      const shoe = it.spec.kind === "shoes" || it.spec.kind === "boots";
      const fabric = it.piece ? fabricColor(img, it.piece.colorHex) : BASE_COLOR;
      const tex = garmentTexture(it.piece && !shoe ? img : null, shoe ? "#ffffff" : fabric);
      if (shoe) {                                         // cabedal e sola nas cores da foto (cor por vértice)
        const sc = shoeColors(img, it.piece?.colorHex); const up = new THREE.Color(sc.upper), so = new THREE.Color(sc.sole);
        const pos = geo.getAttribute("position"), col = geo.getAttribute("color");
        for (let i = 0; i < pos.count; i++) { const k = pos.getY(i) < 0.022 ? so : up; col.setXYZ(i, k.r, k.g, k.b); }
      }
      const m = new THREE.SkinnedMesh(geo, garmentMaterial(tex, it.spec)); m.name = it.piece ? `peca-${it.piece.id}` : `base-${it.spec.kind}`;
      m.castShadow = true; m.frustumCulled = false;
      human.root.add(m); m.bind(human.skeleton, human.body.bindMatrix);
      meshes.push(m);
    }
    // sola do calçado: o corpo sobe o que a sola desce
    human.root.position.y = items.some((i) => i.spec.kind === "shoes" || i.spec.kind === "boots") ? 0.012 : 0;
    return () => {
      for (const m of meshes) { m.removeFromParent(); m.geometry.dispose(); const mat = m.material as THREE.MeshPhysicalMaterial; mat.map?.dispose(); mat.dispose(); }
      human.root.position.y = 0;
    };
  }, [parts, images]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
