"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import * as THREE from "three";
import { api, mediaUrl } from "@/lib/api/client";
import { loadTexture, type Look3dPiece } from "@/components/three/common";
import type { HumanParts } from "@/components/three/human-avatar";
import { applyIdle, setArmOut } from "@/lib/avatar3d/human/pose";
import {
  armOutFor, bodyParam, fabricColor, shoeColors, garmentMaterial, garmentTexture, kindOf, photoInfo, posedPositions, texturedGeometry,
  type GarmentKind, type GarmentSpec,
  HAS_COLLAR_BAND, type PhotoInfo,
} from "@/lib/avatar3d/human/garments";
import { DEFAULT_PIECES, ZONES, withDefaultOutfit, zonesCovered } from "@/lib/avatar3d/human/default-outfit";
import { isBundledGarmentPhoto } from "@/lib/tryon/reference-photo";
import { specFor } from "@/lib/avatar3d/human/garment-fit";
import { publishPhotoStates, useGarmentPhotoRetries } from "@/lib/tryon/garment-status";
import { garmentPhotoKey, garmentPhotoUrls, isIsolatedCatalogPhoto } from "@/lib/tryon/garment-photo-source";
import type { PhotoState } from "@/lib/tryon/garment-asset";
import { buildGarment, softBodyOf } from "@/lib/avatar3d/human/dress";
import { SOLE_LIFT } from "@/lib/avatar3d/human/shoes";
import { garmentContractOf } from "@/lib/avatar3d/garment-contract";
import { occludeInnerGarment, visibleGarmentFinishes } from "@/lib/avatar3d/human/garment-layers";
import { finishMeshes, shoePartMeshes } from "@/components/three/outfit-finishes";
import { lazyFrame, wearGlb } from "@/components/three/outfit-glb";
import { useGarmentGlbs } from "@/components/three/use-garment-glbs";
import type { GlbSource } from "@/lib/avatar3d/human/glb-garment";
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
  // molde da subcategoria ajustado pela classe de caimento e comprimentos declarados (lib/avatar3d/human/garment-fit.ts);
  // com casaco/jaqueta por cima, a camiseta padrão por baixo vira só a base escura
  const hasOuter = pieces.some((p) => ["jacket", "coat"].includes(kindOf(p) ?? ""));
  for (const raw of withDefaultOutfit(pieces)) { const p = hasOuter && raw.id === DEFAULT_PIECES.upper.id ? { ...raw, imageUrl: null, colorHex: "#202020" } : raw; const spec = specFor(p); if (spec) items.push({ key: p.id, spec, piece: p }); }
  return items.sort((a, b) => a.spec.layer - b.spec.layer);
}

/** Garment category remains explicit throughout person/other-outfit isolation. */
export function photoPart(kind: GarmentKind): OutfitPhotoPart {
  if (kind === "dress" || kind === "jumpsuit" || kind === "romper") return "full";
  if (kind === "shoes" || kind === "boots") return "feet";
  if (["pants", "shorts", "bermuda", "culottes", "leggings", "skirt"].includes(kind)) return "lower";
  return "upper";
}

/**
 * Decote pela foto: a profundidade (fração da altura da peça) vira h pela altura do molde (gola − barra); só aprofunda —
 * um decote declarado mais fundo que o da foto fica. Forma (V/redondo) continua a do nome/atributo.
 */
export function withPhotoNeckline(sp: GarmentSpec, info: PhotoInfo | null): GarmentSpec {
  if (!info || info.neckDrop === null || Number.isNaN(sp.hem) || sp.leg > 0 || !HAS_COLLAR_BAND.has(sp.kind)) return sp;
  const depth = info.neckDrop * (sp.neck - sp.hem);
  if (!(depth > sp.vneck + 0.03)) return sp;
  return { ...sp, vneck: Math.min(0.4, depth) };
}

type Img = CanvasImageSource & { width: number; height: number };

/** Veste o corpo com as peças (síncrono). Devolve as malhas criadas e se as três zonas ficaram cobertas. */
function dress(parts: HumanParts, items: OutfitItem[], images: Record<string, Img | null>, glbs: Record<string, GlbSource | null> = {}): { meshes: THREE.SkinnedMesh[]; dressed: boolean } {
  const { human, pose, composed, asset } = parts;
  setArmOut(human, pose, armOutFor(items.map((i) => i.spec)));   // saia rodada e camadas grossas: braço mais aberto
  applyIdle(human, pose, 0, 0);                                    // pose de exibição, sem o movimento, para projetar a foto
  const P = bodyParam(asset, composed); const frame = lazyFrame(parts, P);
  // a roupa nasce do corpo suavizado (sem mamilos, clavícula e músculos desenhados no tecido); o calçado, do pé real
  const soft = softBodyOf(asset, composed);
  let floorY = Infinity; for (let v = 0; v < P.group.length; v++) if (P.group[v] === 4) floorY = Math.min(floorY, composed.body[v * 3 + 1]);
  const meshes: THREE.SkinnedMesh[] = []; const below: GarmentSpec[] = []; const built: GarmentKind[] = [];
  const prepare = (it: OutfitItem, beneath: GarmentSpec[]) => {
    // molde → caimento (relaxa, perna em coluna) → dobras, punho e barra: o mesmo caminho do harness (lib/avatar3d/human/dress.ts)
    const { gg, base: cc, under } = buildGarment(asset, composed, soft, human.rest.normals, P, it.spec, beneath);
    if (!gg) return null;
    return { cc, under, gg };
  };
  // Validate all outer meshes before hiding any inner fabric. A failed outer mold
  // must leave the modesty layer visible, including when a fallback is needed.
  const prepared = new Map<OutfitItem, NonNullable<ReturnType<typeof prepare>>>();
  const plannedBelow: GarmentSpec[] = [];
  // caixa da peça na foto, lida uma vez por peça: projeção, cor do tecido, textura, acabamentos e o DECOTE — a
  // profundidade medida na foto (topo no centro × topo nos ombros) aprofunda o decote do molde quando passa do declarado
  const infos = new Map<OutfitItem, PhotoInfo | null>();
  items = items.map((it) => {
    const img = images[it.key] ?? null; const info = img ? photoInfo(img) : null;
    const next = { ...it, spec: withPhotoNeckline(it.spec, info) }; infos.set(next, info); return next;
  });
  for (const it of items) {
    const plan = prepare(it, plannedBelow);
    if (plan) { prepared.set(it, plan); plannedBelow.push(it.spec); }
  }
  const wear = (it: OutfitItem) => {
    // peça com .glb do produto aprovado no encaixe: veste pelo .glb (glb-garment); senão, o molde abaixo
    if (wearGlb(parts, it, glbs[it.key], below, frame, meshes)) { below.push(it.spec); built.push(it.spec.kind); return; }
    const plan = prepared.get(it) ?? prepare(it, below); if (!plan) return;
    const { cc, under, gg } = plan;
    below.push(it.spec);
    const above = [...prepared.keys()].filter((outer) => outer.spec.layer > it.spec.layer).map((outer) => outer.spec);
    const visibleAlpha = gg.alpha.slice();
    occludeInnerGarment({ ...gg, alpha: visibleAlpha }, cc, P, above);
    const finishes = visibleGarmentFinishes(it.spec, above, P);
    const img = images[it.key] ?? null;
    // no espaço do corpo: a foto vai para a frente da peça mesmo com o personagem girado na cena (Meu Quarto)
    const posed = posedPositions(human.skeleton, human.body.bindMatrix, gg.position, gg.skinIndex, gg.skinWeight, human.body);
    const sleeveVert = (v: number) => gg.source[v] >= 0 && P.group[gg.source[v]] === 2;
    // caixa da peça na foto (alfa do recorte ou fundo separado da foto opaca): uma só leitura para a projeção, a cor do
    // tecido, a textura e os acabamentos — cores sempre de dentro da peça, nunca do fundo da foto
    const info = infos.get(it) ?? (img ? photoInfo(img) : null);
    // manga: quando a foto mostra a manga caída ao lado do tronco, ela vai para a manga 3D (texturedGeometry/photoSleeves);
    // senão a manga fica no tecido (cor e trama), como antes
    const sleeveSource = it.spec.sleeve > 0 ? { isSleeve: sleeveVert, along: (v: number) => (gg.source[v] >= 0 ? P.arm[gg.source[v]] : -1) } : undefined;
    const geo = texturedGeometry(gg, posed, info, it.spec.sleeve > 0 ? sleeveVert : undefined, visibleAlpha, sleeveSource);
    const shoe = it.spec.kind === "shoes" || it.spec.kind === "boots";
    const fabric = fabricColor(img, it.piece.colorHex, info);
    const tex = garmentTexture(shoe ? null : img, shoe ? "#ffffff" : fabric, geo.userData.fabricMapping, info, it.spec);
    if (shoe) {                                                    // cabedal e sola nas cores da foto (cor por vértice)
      const sc = shoeColors(img, it.piece.colorHex, info); const up = new THREE.Color(sc.upper), so = new THREE.Color(sc.sole);
      const pos = geo.getAttribute("position"), col = geo.getAttribute("color");
      for (let i = 0; i < pos.count; i++) { const k = pos.getY(i) < floorY + 0.006 ? so : up; col.setXYZ(i, k.r, k.g, k.b); }
      meshes.push(...shoePartMeshes(human, asset, composed, P, it, sc));
    }
    built.push(it.spec.kind);
    // tênis e sapato: o cabedal é a fôrma modelada (shoes.ts); na bota o molde fica só no cano (o pé também é a fôrma)
    if (it.spec.kind !== "shoes") {
      const m = new THREE.SkinnedMesh(geo, garmentMaterial(tex, it.spec)); m.name = `peca-${it.piece.id}`;
      m.castShadow = true; m.frustumCulled = false;
      human.root.add(m); m.bind(human.skeleton, human.body.bindMatrix);
      meshes.push(m);
    } else { geo.dispose(); tex.dispose(); }
    meshes.push(...finishMeshes(human, asset, cc, P, gg, it, { shoe, finishes, above, img, fabric, info, under }));
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

export const photoUrls = garmentPhotoUrls;
// Reusing an item in another look must not rerun segmentation. Failures remain retryable.
const isolatedPhotos = new Map<string, { pending: Promise<Img | null>; createdAt: number }>();
function outfitPhoto(i: OutfitItem, retry = 0): Promise<Img | null> {
  const key = garmentPhotoKey(photoPart(i.spec.kind), i.piece, retry);
  const cached = isolatedPhotos.get(key);
  if (cached && Date.now() - cached.createdAt < 5 * 60_000) return cached.pending;
  const pending = (async () => {
    for (const url of photoUrls(i.piece, retry)) {
      let temporary: string | null = null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const resolved = url.startsWith("/api/catalog/products/") ? (temporary = await api.blobUrl(url, { signal: controller.signal })) : mediaUrl(url);
        if (controller.signal.aborted) continue;
        const texture = resolved ? await loadTexture(resolved) : null;
        const image = texture?.image as Img | undefined;
        if (!image || controller.signal.aborted) continue;
        // Trust only the exact bundled source that actually loaded; remote images still require isolation.
        // This exact authenticated endpoint refuses raw photographs when isolation
        // is unavailable. Do not segment its verified pixels a second time.
        const isolated = isIsolatedCatalogPhoto(i.piece, url, retry);
        const prepared = isBundledGarmentPhoto(url) || isolated ? prepareGarmentPhoto(image) : await prepareOutfitPhoto(image, photoPart(i.spec.kind));
        if (prepared) return prepared;
      } catch { /* Try the processed alternative, without projecting an unchecked image. */ }
      finally { clearTimeout(timeout); if (temporary) URL.revokeObjectURL(temporary); }
    }
    return null;
  })();
  isolatedPhotos.set(key, { pending, createdAt: Date.now() });
  if (isolatedPhotos.size > 64) isolatedPhotos.delete(isolatedPhotos.keys().next().value!);
  void pending.then(image => { if (!image && isolatedPhotos.get(key)?.pending === pending) isolatedPhotos.delete(key); });
  return pending;
}

export function HumanOutfit({ parts, pieces }: { parts: HumanParts; pieces: Look3dPiece[] }) {
  const retries = useGarmentPhotoRetries();
  const [loaded, setLoaded] = useState<Record<string, Img | null>>({});
  const items = outfitOf(pieces);
  const keyOf = (i: OutfitItem) => JSON.stringify([i.key, garmentPhotoKey(photoPart(i.spec.kind), i.piece, retries[i.key] ?? 0)]);
  const urlKey = JSON.stringify(items.map(keyOf));
  // Selection, fit and registered color apply immediately, including same-URL variant edits.
  // Only the isolated photograph waits; never keep a different garment dressed meanwhile.
  const outfitKey = JSON.stringify(items.map(i => i.piece));
  const images = Object.fromEntries(items.map(i => [i.key, loaded[keyOf(i)] ?? null]));
  const settled = items.every(i => Object.hasOwn(loaded, keyOf(i)));
  const glbs = useGarmentGlbs(items); const glbKey = items.filter((i) => glbs[i.key]).map((i) => i.key).join();
  useEffect(() => {
    const photos: Record<string, PhotoState> = {};
    for (const i of items) {
      if (i.piece.defaultImage && i.key.startsWith("fai-padrao-")) continue;
      photos[i.key] = !photoUrls(i.piece).length ? "sem-foto" : !Object.hasOwn(loaded, keyOf(i)) ? "carregando" : images[i.key] ? "ok" : !i.piece.imageUrl && !i.piece.studioUrl ? "sem-foto" : "falhou";
    }
    publishPhotoStates(photos);
  }, [urlKey, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true;
    // Commit each image separately: a slow/broken coat must not hold back trousers or shoes.
    for (const i of items) {
      const key = keyOf(i);
      void outfitPhoto(i, retries[i.key] ?? 0).then(image => {
        if (alive) setLoaded(current => ({
          ...Object.fromEntries(Object.entries(current).filter(([oldKey]) => items.some(item => keyOf(item) === oldKey))),
          [key]: image,
        }));
      });
    }
    return () => { alive = false; };
  }, [urlKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // antes da pintura: o corpo nunca é desenhado sem as peças (sem foto ainda, na cor do tecido)
  useLayoutEffect(() => {
    const root = parts.human.root;
    const { meshes, dressed } = dress(parts, items, images, glbs);
    root.userData.dressed = dressed; root.visible = dressed;
    root.userData.outfitReady = settled;
    root.userData.garments = meshes.map((m) => m.name);
    // contrato de cada peça (origem de cada dado, caminho de construção, aproximação): diagnóstico e auditoria
    root.userData.garmentContracts = items.map((i) => garmentContractOf(i.piece, { origin: i.piece.id.startsWith("fai-padrao-") ? "DEFAULT" : "UNKNOWN" }));
    if (!dressed) console.error("[FashionAI] avatar sem as três zonas cobertas: corpo escondido");
    return () => {
      root.userData.dressed = false; root.visible = false; root.userData.garments = []; root.userData.outfitReady = false;
      for (const m of meshes) {
        m.removeFromParent(); m.geometry.dispose();
        for (const mat of [m.material].flat() as THREE.MeshPhysicalMaterial[]) { if (!m.userData.sharedTextures) mat.map?.dispose(); mat.dispose(); }
      }
      root.position.y = 0;
    };
    // só o corpo (não o cabelo): trocar o nível de detalhe do cabelo não refaz as roupas
  }, [parts.human, parts.pose, parts.composed, parts.asset, outfitKey, loaded, glbKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Captures wait for the requested photos, independently of the immediately visible mold.
  useLayoutEffect(() => { parts.human.root.userData.outfitReady = settled; }, [parts.human, settled, urlKey]);
  return null;
}
