"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import * as THREE from "three";
import { mediaUrl } from "@/lib/api/client";
import { loadTexture, type Look3dPiece } from "@/components/three/common";
import type { HumanParts } from "@/components/three/human-avatar";
import { applyIdle, setArmOut } from "@/lib/avatar3d/human/pose";
import {
  SPECS, specOf, armOutFor, bodyParam, collarBand, fabricColor, ribColor, shoeColors, trimColors, garmentGeometry, garmentMaterial, garmentTexture, kindOf, photoInfo, posedPositions, texturedGeometry, underLayer,
  type GarmentKind, type GarmentSpec,
} from "@/lib/avatar3d/human/garments";
import { DEFAULT_PIECES, ZONES, withDefaultOutfit, zonesCovered } from "@/lib/avatar3d/human/default-outfit";
import { foldGarment, relaxGarment, smoothBody } from "@/lib/avatar3d/human/garment-relax";
import { SOLE_LIFT, shoeParts, shoeStyleOf } from "@/lib/avatar3d/human/shoes";
import { garmentTrims } from "@/lib/avatar3d/human/garment-trims";
import { occludeInnerGarment, visibleGarmentFinishes } from "@/lib/avatar3d/human/garment-layers";
import { prepareGarmentPhoto, prepareOutfitPhoto, type OutfitPhotoPart } from "@/lib/avatar3d/human/garment-photo";

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
  const hasOuter = pieces.some((p) => ["jacket", "coat"].includes(kindOf(p) ?? ""));
  for (const raw of withDefaultOutfit(pieces)) { const p = hasOuter && raw.id === DEFAULT_PIECES.upper.id ? { ...raw, imageUrl: null, colorHex: "#202020" } : raw; const spec = specOf(p); if (spec) items.push({ key: p.id, spec, piece: p }); }
  return items.sort((a, b) => a.spec.layer - b.spec.layer);
}

/** Garment category remains explicit throughout person/other-outfit isolation. */
export function photoPart(kind: GarmentKind): OutfitPhotoPart {
  if (kind === "dress" || kind === "jumpsuit" || kind === "coat") return "full";
  if (kind === "shoes" || kind === "boots") return "feet";
  if (["pants", "shorts", "leggings", "skirt"].includes(kind)) return "lower";
  return "upper";
}

type Img = CanvasImageSource & { width: number; height: number };

/** Veste o corpo com as peças (síncrono). Devolve as malhas criadas e se as três zonas ficaram cobertas. */
function dress(parts: HumanParts, items: OutfitItem[], images: Record<string, Img | null>): { meshes: THREE.SkinnedMesh[]; dressed: boolean } {
  const { human, pose, composed, asset } = parts;
  setArmOut(human, pose, armOutFor(items.map((i) => i.spec)));   // saia rodada e camadas grossas: braço mais aberto
  applyIdle(human, pose, 0, 0);                                    // pose de exibição, sem o movimento, para projetar a foto
  const P = bodyParam(asset, composed);
  // a roupa nasce do corpo suavizado (sem mamilos, clavícula e músculos desenhados no tecido); o calçado, do pé real
  const soft = { ...composed, body: smoothBody(asset, composed, 12) };
  let floorY = Infinity; for (let v = 0; v < P.group.length; v++) if (P.group[v] === 4) floorY = Math.min(floorY, composed.body[v * 3 + 1]);
  const meshes: THREE.SkinnedMesh[] = []; const below: GarmentSpec[] = []; const built: GarmentKind[] = [];
  const prepare = (it: OutfitItem, beneath: GarmentSpec[]) => {
    const shoeKind = it.spec.kind === "shoes" || it.spec.kind === "boots";
    const cc = shoeKind ? composed : soft;
    const under = beneath.length ? underLayer(cc, P, beneath) : null;
    const gg = garmentGeometry(asset, cc, human.rest.normals, P, it.spec, under);
    if (!gg) return null;
    // caimento: o tecido relaxa (sem o desenho do corpo por baixo) e ganha dobras, punho e barra (garment-relax.ts)
    relaxGarment(gg, cc, human.rest.normals, P, under); foldGarment(gg, cc, human.rest.normals, P);
    return { cc, under, gg };
  };
  // Validate all outer meshes before hiding any inner fabric. A failed outer mold
  // must leave the modesty layer visible, including when a fallback is needed.
  const prepared = new Map<OutfitItem, NonNullable<ReturnType<typeof prepare>>>();
  const plannedBelow: GarmentSpec[] = [];
  for (const it of items) {
    const plan = prepare(it, plannedBelow);
    if (plan) { prepared.set(it, plan); plannedBelow.push(it.spec); }
  }
  const wear = (it: OutfitItem) => {
    const plan = prepared.get(it) ?? prepare(it, below); if (!plan) return;
    const { cc, under, gg } = plan;
    below.push(it.spec);
    const above = [...prepared.keys()].filter((outer) => outer.spec.layer > it.spec.layer).map((outer) => outer.spec);
    const visibleAlpha = gg.alpha.slice();
    occludeInnerGarment({ ...gg, alpha: visibleAlpha }, cc, P, above);
    const finishes = visibleGarmentFinishes(it.spec, above, P);
    const img = images[it.key] ?? null;
    const posed = posedPositions(human.skeleton, human.body.bindMatrix, gg.position, gg.skinIndex, gg.skinWeight);
    const sleeveVert = (v: number) => gg.source[v] >= 0 && P.group[gg.source[v]] === 2;
    const geo = texturedGeometry(gg, posed, img ? photoInfo(img) : null, it.spec.sleeve > 0 ? sleeveVert : undefined, visibleAlpha);
    const shoe = it.spec.kind === "shoes" || it.spec.kind === "boots";
    const fabric = fabricColor(img, it.piece.colorHex);
    const tex = garmentTexture(shoe ? null : img, shoe ? "#ffffff" : fabric, geo.userData.fabricMapping);
    if (shoe) {                                                    // cabedal e sola nas cores da foto (cor por vértice)
      const sc = shoeColors(img, it.piece.colorHex); const up = new THREE.Color(sc.upper), so = new THREE.Color(sc.sole);
      const pos = geo.getAttribute("position"), col = geo.getAttribute("color");
      for (let i = 0; i < pos.count; i++) { const k = pos.getY(i) < floorY + 0.006 ? so : up; col.setXYZ(i, k.r, k.g, k.b); }
      // sola com espessura, cadarço e colarinho acolchoado (shoes.ts): tênis, não meia
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
        human.root.add(pmesh); pmesh.bind(human.skeleton, human.body.bindMatrix); meshes.push(pmesh);
      }
    }
    built.push(it.spec.kind);
    // tênis e sapato: o cabedal é a fôrma modelada (shoes.ts); o molde do pé só serve à bota (cano)
    if (it.spec.kind !== "shoes") {
      const m = new THREE.SkinnedMesh(geo, garmentMaterial(tex, it.spec)); m.name = `peca-${it.piece.id}`;
      m.castShadow = true; m.frustumCulled = false;
      human.root.add(m); m.bind(human.skeleton, human.body.bindMatrix);
      meshes.push(m);
    } else { geo.dispose(); tex.dispose(); }
    // barra e manga com acabamento 3D (faixa com espessura dando a volta), na cor do acabamento da foto
    if (!shoe) {
      const tc = trimColors(img, fabric); const rib = ribColor(img, fabric);
      for (const tb of garmentTrims(asset, cc, P, gg)) {
        if (tb.part === "barra" ? !finishes.hem : tb.part === "punho" ? !finishes.cuff : above.length > 0) continue;
        const tg = new THREE.BufferGeometry();
        tg.setAttribute("position", new THREE.Float32BufferAttribute(tb.position, 3));
        tg.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(tb.skinIndex, 4));
        tg.setAttribute("skinWeight", new THREE.Float32BufferAttribute(tb.skinWeight, 4));
        tg.setIndex(Array.from(tb.index)); tg.computeVertexNormals();
        const ribbed = it.spec.kind === "hoodie" || it.spec.kind === "sweater";
        const color = tb.part === "botoes" ? "#514b42" : (tb.part === "barra" ? tc.hem : tb.part === "punho" ? tc.cuff : null) ?? (ribbed ? rib : `#${new THREE.Color(fabric).multiplyScalar(0.92).getHexString()}`);
        const tm = new THREE.MeshPhysicalMaterial({ color, roughness: 0.9, sheen: 0.45, sheenRoughness: 0.8, side: THREE.DoubleSide,
          polygonOffset: true, polygonOffsetFactor: -it.spec.layer - 1, polygonOffsetUnits: -it.spec.layer - 1 });
        tm.name = `acabamento-${tb.part}`;
        const tmesh = new THREE.SkinnedMesh(tg, tm); tmesh.name = `${tb.part}-${it.piece.id}`; tmesh.castShadow = true; tmesh.frustumCulled = false;
        human.root.add(tmesh); tmesh.bind(human.skeleton, human.body.bindMatrix); meshes.push(tmesh);
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
  human.root.position.y = built.some((k) => k === "shoes" || k === "boots") ? SOLE_LIFT - floorY : 0;
  const covered = zonesCovered(built);
  return { meshes, dressed: ZONES.every((z) => covered.has(z)) };
}

export function HumanOutfit({ parts, pieces }: { parts: HumanParts; pieces: Look3dPiece[] }) {
  // fotos das peças com a chave do look a que pertencem: a Prévia 2D só fotografa quando as fotos do look atual chegaram
  const [loaded, setLoaded] = useState<{ key: string; images: Record<string, Img | null> }>({ key: "", images: {} });
  const items = outfitOf(pieces);
  const urlKey = items.map((i) => `${i.key}:${i.piece.imageUrl ?? ""}`).join("|");
  const images = loaded.key === urlKey ? loaded.images : {};
  useEffect(() => {
    let alive = true;
    Promise.all(items.map(async (i) => {
      const u = mediaUrl(i.piece.imageUrl ?? null);
      const t = u ? await loadTexture(u) : null;
      const img = t?.image as Img | undefined;
      // These exact bundled reference assets contain only the product. Avoid
      // three unnecessary person/pose analyses while the catalogue piece loads.
      const bundled = Object.values(DEFAULT_PIECES).some(p => p.id === i.piece.id && p.imageUrl === i.piece.imageUrl);
      return [i.key, img ? bundled ? prepareGarmentPhoto(img) : await prepareOutfitPhoto(img, photoPart(i.spec.kind)) : null] as const;
    })).then((kv) => { if (alive) setLoaded({ key: urlKey, images: Object.fromEntries(kv) }); });
    return () => { alive = false; };
  }, [urlKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // antes da pintura: o corpo nunca é desenhado sem as peças (sem foto ainda, na cor do tecido)
  useLayoutEffect(() => {
    const root = parts.human.root;
    const { meshes, dressed } = dress(parts, items, images);
    root.userData.dressed = dressed; root.visible = dressed;
    root.userData.outfitReady = loaded.key === urlKey;
    root.userData.garments = meshes.map((m) => m.name);
    if (!dressed) console.error("[FashionAI] avatar sem as três zonas cobertas: corpo escondido");
    return () => {
      root.userData.dressed = false; root.visible = false; root.userData.garments = []; root.userData.outfitReady = false;
      for (const m of meshes) { m.removeFromParent(); m.geometry.dispose(); const mat = m.material as THREE.MeshPhysicalMaterial; mat.map?.dispose(); mat.dispose(); }
      root.position.y = 0;
    };
    // só o corpo (não o cabelo): trocar o nível de detalhe do cabelo não refaz as roupas
  }, [parts.human, parts.pose, parts.composed, parts.asset, urlKey, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
