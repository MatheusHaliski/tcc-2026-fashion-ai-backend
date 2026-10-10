"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import * as THREE from "three";
import { mediaUrl } from "@/lib/api/client";
import { loadTexture, type Look3dPiece } from "@/components/three/common";
import type { HumanParts } from "@/components/three/human-avatar";
import { applyIdle, setArmOut } from "@/lib/avatar3d/human/pose";
import {
  armOutFor, bodyParam, collarBand, fabricColor, ribColor, shoeColors, trimColors, garmentMaterial, garmentTexture, kindOf, photoInfo, posedPositions, texturedGeometry,
  type GarmentKind, type GarmentSpec,
  HAS_COLLAR_BAND, type PhotoInfo,
} from "@/lib/avatar3d/human/garments";
import { DEFAULT_PIECES, ZONES, withDefaultOutfit, zonesCovered, type Zone } from "@/lib/avatar3d/human/default-outfit";
import { specFor } from "@/lib/avatar3d/human/garment-fit";
import { publishPhotoStates } from "@/lib/tryon/garment-status";
import type { PhotoState } from "@/lib/tryon/garment-asset";
import { buildGarment, softBodyOf } from "@/lib/avatar3d/human/dress";
import { SOLE_LIFT, shoeParts, shoeStyleOf } from "@/lib/avatar3d/human/shoes";
import { garmentTrims } from "@/lib/avatar3d/human/garment-trims";
import { garmentContractOf } from "@/lib/avatar3d/garment-contract";
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
  // molde da subcategoria ajustado pela classe de caimento e comprimentos declarados (lib/avatar3d/human/garment-fit.ts);
  // com casaco/jaqueta por cima, a camiseta padrão por baixo vira só a base escura
  const hasOuter = pieces.some((p) => ["jacket", "coat"].includes(kindOf(p) ?? ""));
  for (const raw of withDefaultOutfit(pieces)) { const p = hasOuter && raw.id === DEFAULT_PIECES.upper.id ? { ...raw, imageUrl: null, colorHex: "#202020" } : raw; const spec = specFor(p); if (spec) items.push({ key: p.id, spec, piece: p }); }
  return items.sort((a, b) => a.spec.layer - b.spec.layer);
}

/** Garment category remains explicit throughout person/other-outfit isolation. */
export function photoPart(kind: GarmentKind): OutfitPhotoPart {
  if (kind === "dress" || kind === "jumpsuit" || kind === "coat") return "full";
  if (kind === "shoes" || kind === "boots") return "feet";
  if (["pants", "shorts", "leggings", "skirt"].includes(kind)) return "lower";
  return "upper";
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

function usable(items: OutfitItem[], images: Record<string, Img | null>, settled: boolean): OutfitItem[] {
  if (!settled) return items;
  const out: OutfitItem[] = []; const missing = new Set<Zone>();
  for (const it of items) {
    const url = it.piece.imageUrl ?? it.piece.studioUrl;
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
    // caixa da peça na foto (alfa do recorte ou fundo separado da foto opaca): uma só leitura para a projeção, a cor do
    // tecido, a textura e os acabamentos — cores sempre de dentro da peça, nunca do fundo da foto
    const info = infos.get(it) ?? (img ? photoInfo(img) : null);
    const geo = texturedGeometry(gg, posed, info, it.spec.sleeve > 0 ? sleeveVert : undefined, visibleAlpha);
    const shoe = it.spec.kind === "shoes" || it.spec.kind === "boots";
    const fabric = fabricColor(img, it.piece.colorHex, info);
    const tex = garmentTexture(shoe ? null : img, shoe ? "#ffffff" : fabric, geo.userData.fabricMapping, info);
    if (shoe) {                                                    // cabedal e sola nas cores da foto (cor por vértice)
      const sc = shoeColors(img, it.piece.colorHex, info); const up = new THREE.Color(sc.upper), so = new THREE.Color(sc.sole);
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
      const tc = trimColors(img, fabric, info); const rib = ribColor(img, fabric, info, { wide: it.spec.kind === "shirt" });
      for (const tb of garmentTrims(asset, cc, P, gg)) {
        if (tb.part === "barra" ? !finishes.hem : tb.part === "punho" ? !finishes.cuff : above.length > 0) continue;
        const tg = new THREE.BufferGeometry();
        tg.setAttribute("position", new THREE.Float32BufferAttribute(tb.position, 3));
        tg.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(tb.skinIndex, 4));
        tg.setAttribute("skinWeight", new THREE.Float32BufferAttribute(tb.skinWeight, 4));
        tg.setIndex(Array.from(tb.index)); tg.computeVertexNormals();
        const ribbed = it.spec.kind === "hoodie" || it.spec.kind === "sweater";
        // botão claro com aro escuro (nítido sobre qualquer tecido); linha do pesponto escura em tecido claro e clara em
        // tecido escuro; pontas da gola na cor da gola da foto
        const fl = new THREE.Color(fabric); const light = 0.2126 * fl.r + 0.7152 * fl.g + 0.0722 * fl.b > 0.35;
        const thread = `#${(light ? fl.clone().multiplyScalar(0.62) : fl.clone().lerp(new THREE.Color("#ffffff"), 0.4)).getHexString()}`;
        const color = tb.part === "botoes" ? "#efe8da" : tb.part === "botoes-borda" ? "#3a332b" : tb.part === "costura" ? thread : tb.part === "gola-ponta" ? rib
          : (tb.part === "barra" ? tc.hem : tb.part === "punho" ? tc.cuff : null) ?? (ribbed ? rib : `#${fl.clone().multiplyScalar(0.92).getHexString()}`);
        const tm = new THREE.MeshPhysicalMaterial({ color, roughness: tb.part === "botoes" ? 0.45 : 0.9, sheen: tb.part === "botoes" ? 0.1 : 0.45, sheenRoughness: 0.8, side: THREE.DoubleSide,
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
      const bm = new THREE.MeshPhysicalMaterial({ color: ribColor(img, fabric, info, { wide: it.spec.kind === "shirt" }), roughness: 0.9, sheen: 0.4, sheenRoughness: 0.8, side: THREE.DoubleSide,
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
  const [loaded, setLoaded] = useState<{ key: string; images: Record<string, Img | null>; pieces: Look3dPiece[] }>({ key: "", images: {}, pieces: [] });
  const all = outfitOf(pieces);
  // a foto recortada (imageUrl: PNG com alfa) vem antes da de estúdio/processada (studioUrl): o molde projeta a peça pela
  // caixa do alfa. Se a recortada não carrega no 3D (imagem externa sem CORS), entra a processada, servida por nós.
  const photoUrls = (p: Look3dPiece) => [p.imageUrl, p.studioUrl].filter((u, k, a): u is string => !!u && a.indexOf(u) === k);
  const urlKey = all.map((i) => `${i.key}:${photoUrls(i.piece).join(",")}`).join("|");
  const settled = loaded.key === urlKey;
  // troca de look: o look anterior (peças E fotos dele, nunca misturadas) fica vestido até as fotos do novo ficarem
  // prontas; só no primeiro look, sem anterior, as peças entram na cor do tecido enquanto as fotos carregam
  const keepPrevious = !settled && loaded.key !== "";
  const shown = keepPrevious ? outfitOf(loaded.pieces) : all;
  const shownKey = keepPrevious ? loaded.key : urlKey;
  const images = settled || keepPrevious ? loaded.images : {};
  const items = usable(shown, images, settled || keepPrevious);
  // estado da foto de cada peça do look (não as padrão) para a página: carregando, ok, falhou ou sem foto
  useEffect(() => {
    const photos: Record<string, PhotoState> = {};
    for (const i of all) {
      if (i.piece.defaultImage && i.key.startsWith("fai-padrao-")) continue;
      photos[i.key] = !photoUrls(i.piece).length ? "sem-foto" : !settled ? "carregando" : images[i.key] ? "ok" : "falhou";
    }
    publishPhotoStates(photos);
  }, [urlKey, settled, images]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true;
    Promise.all(all.map(async (i) => {
      let t: THREE.Texture | null = null;
      for (const url of photoUrls(i.piece)) { const u = mediaUrl(url); t = u ? await loadTexture(u) : null; if (t) break; }
      const img = t?.image as Img | undefined;
      // These exact bundled reference assets contain only the product. Avoid
      // three unnecessary person/pose analyses while the catalogue piece loads.
      const bundled = Object.values(DEFAULT_PIECES).some(p => p.id === i.piece.id && p.imageUrl === i.piece.imageUrl);
      return [i.key, img ? bundled ? prepareGarmentPhoto(img) : await prepareOutfitPhoto(img, photoPart(i.spec.kind)) : null] as const;
    })).then((kv) => { if (alive) setLoaded({ key: urlKey, images: Object.fromEntries(kv), pieces }); });
    return () => { alive = false; };
  }, [urlKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // antes da pintura: o corpo nunca é desenhado sem as peças (sem foto ainda, na cor do tecido)
  useLayoutEffect(() => {
    const root = parts.human.root;
    const { meshes, dressed } = dress(parts, items, images);
    root.userData.dressed = dressed; root.visible = dressed;
    root.userData.outfitReady = loaded.key === urlKey;
    root.userData.garments = meshes.map((m) => m.name);
    // contrato de cada peça (origem de cada dado, caminho de construção, aproximação): diagnóstico e auditoria
    root.userData.garmentContracts = items.map((i) => garmentContractOf(i.piece, { origin: i.piece.id.startsWith("fai-padrao-") ? "DEFAULT" : "UNKNOWN" }));
    if (!dressed) console.error("[FashionAI] avatar sem as três zonas cobertas: corpo escondido");
    return () => {
      root.userData.dressed = false; root.visible = false; root.userData.garments = []; root.userData.outfitReady = false;
      for (const m of meshes) { m.removeFromParent(); m.geometry.dispose(); const mat = m.material as THREE.MeshPhysicalMaterial; mat.map?.dispose(); mat.dispose(); }
      root.position.y = 0;
    };
    // só o corpo (não o cabelo): trocar o nível de detalhe do cabelo não refaz as roupas
  }, [parts.human, parts.pose, parts.composed, parts.asset, shownKey, loaded, items.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // "pronto" é do look PEDIDO: enquanto o anterior segura a tela, a Prévia 2D e as capturas esperam
  useLayoutEffect(() => { parts.human.root.userData.outfitReady = settled; }, [parts.human, settled, shownKey, loaded]);
  return null;
}
