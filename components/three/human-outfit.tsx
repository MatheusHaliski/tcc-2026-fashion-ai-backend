"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import * as THREE from "three";
import { mediaUrl } from "@/lib/api/client";
import { loadTexture, type Look3dPiece } from "@/components/three/common";
import type { HumanParts } from "@/components/three/human-avatar";
import { applyIdle, setArmOut } from "@/lib/avatar3d/human/pose";
import {
  armOutFor, bodyParam, collarBand, fabricColor, ribColor, shoeColors, trimColors, garmentMaterial, garmentTexture, photoInfo, posedPositions, texturedGeometry,
  type GarmentKind, type GarmentSpec,
} from "@/lib/avatar3d/human/garments";
import { DEFAULT_PIECES, ZONES, withDefaultOutfit, zonesCovered, type Zone } from "@/lib/avatar3d/human/default-outfit";
import { specFor } from "@/lib/avatar3d/human/garment-fit";
import { publishPhotoStates } from "@/lib/tryon/garment-status";
import type { PhotoState } from "@/lib/tryon/garment-asset";
import { buildGarment, softBodyOf } from "@/lib/avatar3d/human/dress";
import { SOLE_LIFT, shoeParts, shoeStyleOf } from "@/lib/avatar3d/human/shoes";
import { garmentTrims } from "@/lib/avatar3d/human/garment-trims";

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
  // molde da subcategoria ajustado pela classe de caimento e comprimentos declarados (lib/avatar3d/human/garment-fit.ts)
  for (const p of withDefaultOutfit(pieces)) { const spec = specFor(p); if (spec) items.push({ key: p.id, spec, piece: p }); }
  return items.sort((a, b) => a.spec.layer - b.spec.layer);
}

/** Zona do corpo que a peça cobre (para trocar pela peça padrão se a foto dela não puder ser usada). */
function zoneOf(spec: GarmentSpec): Zone | null {
  const covered = zonesCovered([spec.kind]);
  return covered.has("upper") ? "upper" : covered.has("lower") ? "lower" : covered.has("feet") ? "feet" : null;
}

/**
 * Peças cuja foto falhou no 3D (ex.: imagem externa sem CORS): nunca viram uma casca lisa "pintada" no corpo. A zona
 * recebe a peça padrão do FashionAI (a peça de cima por fora, como colete e jaqueta, simplesmente sai) e o estado vai
 * para a página como ERRO, com a foto 2D na lista.
 */
function usable(items: OutfitItem[], images: Record<string, Img | null>, settled: boolean): OutfitItem[] {
  if (!settled) return items;
  const out: OutfitItem[] = []; const missing = new Set<Zone>();
  for (const it of items) {
    const url = it.piece.studioUrl ?? it.piece.imageUrl;
    if (!it.piece.defaultImage && url && !images[it.key]) { const z = zoneOf(it.spec); if (z) missing.add(z); continue; }
    out.push(it);
  }
  for (const z of missing) {
    if (zonesCovered(out.map((i) => i.spec.kind)).has(z)) continue;
    const p = DEFAULT_PIECES[z]; const spec = specFor(p); if (spec) out.push({ key: p.id, spec, piece: p });
  }
  return out.sort((a, b) => a.spec.layer - b.spec.layer);
}

type Img = CanvasImageSource & { width: number; height: number };

/** Veste o corpo com as peças (síncrono). Devolve as malhas criadas e se as três zonas ficaram cobertas. */
function dress(parts: HumanParts, items: OutfitItem[], images: Record<string, Img | null>): { meshes: THREE.SkinnedMesh[]; dressed: boolean } {
  const { human, pose, composed, asset } = parts;
  setArmOut(human, pose, armOutFor(items.map((i) => i.spec)));   // saia rodada e camadas grossas: braço mais aberto
  applyIdle(human, pose, 0, 0);                                    // pose de exibição, sem o movimento, para projetar a foto
  const P = bodyParam(asset, composed);
  // a roupa nasce do corpo suavizado (sem mamilos, clavícula e músculos desenhados no tecido); o calçado, do pé real
  const soft = softBodyOf(asset, composed);
  let floorY = Infinity; for (let v = 0; v < P.group.length; v++) if (P.group[v] === 4) floorY = Math.min(floorY, composed.body[v * 3 + 1]);
  const meshes: THREE.SkinnedMesh[] = []; const below: GarmentSpec[] = []; const built: GarmentKind[] = [];
  const wear = (it: OutfitItem) => {
    // molde → caimento (relaxa, sem o desenho do corpo por baixo) → dobras, punho e barra: lib/avatar3d/human/dress.ts
    const { gg, base: cc, under } = buildGarment(asset, composed, soft, human.rest.normals, P, it.spec, below);
    below.push(it.spec); if (!gg) return;
    const img = images[it.key] ?? null;
    const posed = posedPositions(human.skeleton, human.body.bindMatrix, gg.position, gg.skinIndex, gg.skinWeight);
    const sleeveVert = (v: number) => gg.source[v] >= 0 && P.group[gg.source[v]] === 2;
    const geo = texturedGeometry(gg, posed, img ? photoInfo(img) : null, it.spec.sleeve > 0 ? sleeveVert : undefined);
    const shoe = it.spec.kind === "shoes" || it.spec.kind === "boots";
    const fabric = fabricColor(img, it.piece.colorHex);
    const tex = garmentTexture(shoe ? null : img, shoe ? "#ffffff" : fabric);
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
    // tênis e sapato: o cabedal é a fôrma modelada (shoes.ts); na bota o molde fica só no cano (o pé também é a fôrma)
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
        const tg = new THREE.BufferGeometry();
        tg.setAttribute("position", new THREE.Float32BufferAttribute(tb.position, 3));
        tg.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(tb.skinIndex, 4));
        tg.setAttribute("skinWeight", new THREE.Float32BufferAttribute(tb.skinWeight, 4));
        tg.setIndex(Array.from(tb.index)); tg.computeVertexNormals();
        const ribbed = it.spec.kind === "hoodie" || it.spec.kind === "sweater";
        const color = (tb.part === "barra" ? tc.hem : tc.cuff) ?? (ribbed ? rib : `#${new THREE.Color(fabric).multiplyScalar(0.92).getHexString()}`);
        const tm = new THREE.MeshPhysicalMaterial({ color, roughness: 0.9, sheen: 0.45, sheenRoughness: 0.8, side: THREE.DoubleSide,
          polygonOffset: true, polygonOffsetFactor: -it.spec.layer - 1, polygonOffsetUnits: -it.spec.layer - 1 });
        tm.name = `acabamento-${tb.part}`;
        const tmesh = new THREE.SkinnedMesh(tg, tm); tmesh.name = `${tb.part}-${it.piece.id}`; tmesh.castShadow = true; tmesh.frustumCulled = false;
        human.root.add(tmesh); tmesh.bind(human.skeleton, human.body.bindMatrix); meshes.push(tmesh);
      }
    }
    // gola 3D contornando o decote inteiro (frente, lados e nuca), na cor da gola da foto
    const cb = shoe ? null : collarBand(asset, cc, P, it.spec, under);
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
    const p = DEFAULT_PIECES[z]; const spec = specFor(p);
    if (spec) wear({ key: p.id, spec, piece: p });
  }
  // sola do calçado: o corpo sobe o que a sola desce
  human.root.position.y = built.some((k) => k === "shoes" || k === "boots") ? SOLE_LIFT - floorY : 0;
  const covered = zonesCovered(built);
  return { meshes, dressed: ZONES.every((z) => covered.has(z)) };
}

export function HumanOutfit({ parts, pieces }: { parts: HumanParts; pieces: Look3dPiece[] }) {
  // fotos das peças com a chave do look a que pertencem: a Prévia 2D só fotografa quando as fotos do look atual chegaram
  const [loaded, setLoaded] = useState<{ key: string; images: Record<string, Img | null> }>({ key: "", images: {} });
  const images = loaded.images;
  const all = outfitOf(pieces);
  const urlKey = all.map((i) => `${i.key}:${i.piece.studioUrl ?? i.piece.imageUrl ?? ""}`).join("|");
  const settled = loaded.key === urlKey;
  const items = usable(all, images, settled);
  // estado da foto de cada peça do look (não as padrão) para a página: carregando, ok, falhou ou sem foto
  useEffect(() => {
    const photos: Record<string, PhotoState> = {};
    for (const i of all) {
      if (i.piece.defaultImage && i.key.startsWith("fai-padrao-")) continue;
      const url = i.piece.studioUrl ?? i.piece.imageUrl;
      photos[i.key] = !url ? "sem-foto" : !settled ? "carregando" : images[i.key] ? "ok" : "falhou";
    }
    publishPhotoStates(photos);
  }, [urlKey, settled, images]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true;
    Promise.all(all.map(async (i) => {
      const u = mediaUrl(i.piece.studioUrl ?? i.piece.imageUrl ?? null);
      const t = u ? await loadTexture(u) : null;
      return [i.key, (t?.image as Img | undefined) ?? null] as const;
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
  }, [parts.human, parts.pose, parts.composed, parts.asset, urlKey, loaded, items.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
