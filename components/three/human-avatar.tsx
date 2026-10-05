"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { loadBodyAsset, type BodyAsset } from "@/lib/avatar3d/human/asset";
import { compose, fitBody, fitFace, type BodyInput, type Composed } from "@/lib/avatar3d/human/compose";
import { buildHuman, type Human } from "@/lib/avatar3d/human/three-human";
import { applyIdle, applyRestPose, type PoseState } from "@/lib/avatar3d/human/pose";
import { buildHair } from "@/lib/avatar3d/human/hair-geometry";
import { hairColorFor } from "@/lib/avatar3d/hair-tone";
import { hairWithCut } from "@/lib/avatar3d/hair-cut";
import { growGroom, strandContext, strandsFromGroom, withStrands } from "@/lib/avatar3d/human/hair-strands";
import { GLB_HAIR_LOD, HairFrameBudget, chooseHairLod, deviceInfo, type HairLod } from "@/lib/avatar3d/human/hair-lod";
import { EYE_TEXTURE, bakeSkin } from "@/lib/avatar3d/human/skin-bake";
import type { AvatarHair, AvatarModel } from "@/lib/avatar3d/model";
import { loadTexture, type Look3dPiece } from "@/components/three/common";
import { HumanOutfit } from "@/components/three/human-outfit";

/**
 * Cabelo em fios (HAIR-F2): nível de detalhe pelo aparelho (hair-lod.ts) e rebaixado se o tempo de quadro estourar.
 * NEXT_PUBLIC_AVATAR_HAIR_STRANDS=0 desliga os fios (só a casca); NEXT_PUBLIC_AVATAR_HAIR_LOD=0..3 força um nível.
 */
const INITIAL_HAIR_LOD: HairLod = chooseHairLod(deviceInfo(), process.env.NEXT_PUBLIC_AVATAR_HAIR_LOD ?? null, process.env.NEXT_PUBLIC_AVATAR_HAIR_STRANDS ?? null);

/*
 * Corpo humano do Avatar 3D (RF40): malha MakeHuman (CC0) com esqueleto humanoide, na forma e estatura da pessoa,
 * rosto ajustado aos pontos do rosto dela com a textura da foto, cabelo (ou cobertura) medido na foto, pose natural e
 * movimento parado. Enquanto o arquivo do corpo carrega (ou se ele falhar), `fallback` é desenhado — as vitrines nunca
 * ficam vazias.
 *
 * Nunca sem roupa: `pieces` é obrigatório e o próprio HumanAvatar veste o corpo (HumanOutfit completa tronco, pernas e
 * pés com as peças padrão do FashionAI). O corpo nasce invisível e só aparece com as três zonas cobertas; a cada quadro
 * a visibilidade é conferida de novo (root.userData.dressed). Não há como desenhar este corpo sem roupa.
 */

/** Auditoria em tempo de execução (testes de ponta a ponta): cada corpo humano em cena e se ele está vestido. */
interface AuditEntry { root: THREE.Object3D }
function auditRegistry(): Set<AuditEntry> | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { __faiPeople?: Set<AuditEntry>; __faiAudit?: () => unknown[] };
  if (!w.__faiPeople) {
    w.__faiPeople = new Set();
    w.__faiAudit = () => [...w.__faiPeople!].map(({ root }) => {
      let shown = true; for (let o: THREE.Object3D | null = root; o; o = o.parent) if (!o.visible) { shown = false; break; }
      return { shown, dressed: root.userData.dressed === true, garments: [...(root.userData.garments ?? [])] };
    });
  }
  return w.__faiPeople;
}

let assetPromise: Promise<BodyAsset> | null = null;
export function useBodyAsset(): BodyAsset | null | "error" {
  const [a, setA] = useState<BodyAsset | null | "error">(null);
  useEffect(() => {
    let alive = true;
    assetPromise ??= loadBodyAsset();
    assetPromise.then((x) => alive && setA(x), () => { assetPromise = null; if (alive) setA("error"); });
    return () => { alive = false; };
  }, []);
  return a;
}

type Img = CanvasImageSource & { width: number; height: number };
export interface HumanParts {
  human: Human; pose: PoseState; composed: Composed; asset: BodyAsset; hair: THREE.SkinnedMesh | null;
  /** cabelo no nível do GLB (cards), já preso ao esqueleto; quem chama remove depois de exportar */
  exportHair?: () => THREE.SkinnedMesh | null;
  /** nível de detalhe do cabelo em cena (3 = só a casca ou sem fios) */
  hairLod?: HairLod;
}

export interface HumanAvatarProps {
  body: BodyInput;
  stature: number;
  skin: string;
  face?: AvatarModel | null;         // forma do rosto medida (468 pontos) — sem ela, rosto neutro do modelo
  atlas?: Img | null;                // textura do rosto (UV canônico) — sem ela, pele lisa no tom medido
  hair?: AvatarHair | null;          // cabelo/cobertura medidos na foto
  pieces: Look3dPiece[];             // peças do look — o que faltar (tronco, pernas, pés) vem do look padrão do FashionAI
  motion?: boolean;                  // movimento parado (desligado com "reduzir movimento")
  onReady?: (p: HumanParts) => void;
  children?: (p: HumanParts) => React.ReactNode;   // extras em cena (a roupa já vem do próprio HumanAvatar)
  fallback?: React.ReactNode;
  debugHair?: boolean;
  hairLod?: HairLod;                 // força o nível de detalhe do cabelo (laboratório); sem ele, o do aparelho
  adjust?: { headScale?: number; neck?: number; hairVolume?: number; hairTone?: number; hairCut?: number } | null;   // ajustes finos do Avatar 3D
}

function imageOf(src: Img): HTMLCanvasElement {
  if (src instanceof HTMLCanvasElement) return src;
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height; c.getContext("2d")!.drawImage(src, 0, 0); return c;
}

export function HumanAvatar({ body, stature, skin, face, atlas, hair, pieces, motion = true, onReady, children, fallback = null, debugHair, hairLod: forcedLod, adjust }: HumanAvatarProps) {
  const asset = useBodyAsset();
  const key = JSON.stringify([body.sex, body.params ?? null, body.sources ?? null, stature, face?.shape?.length ? face.shape.slice(0, 24) : null, adjust?.headScale ?? 1, adjust?.neck ?? 0]);
  const built = useMemo(() => {
    if (!asset || asset === "error") return null;
    const fit = fitBody(asset, body);
    let fz: Float64Array | null = null;
    if (face?.shape?.length === 468 * 3) {
      const raw = compose(asset, fit.z, null, stature);
      fz = fitFace(asset, Float32Array.from(raw.body, (v) => v / raw.scale), face.shape).z;
    }
    const c = compose(asset, fit.z, fz, stature);
    const h = buildHuman(asset, c, { skin, debugHair });
    h.root.visible = false; h.root.userData.dressed = false;           // só aparece vestido (HumanOutfit)
    const st = applyRestPose(h);
    const head = h.bone("Head"); head.scale.setScalar(adjust?.headScale ?? 1); head.position.y += adjust?.neck ?? 0;
    return { h, st, c, asset };
  }, [asset, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const hairKey = JSON.stringify([hair ?? null, adjust?.hairVolume ?? 1, adjust?.hairTone ?? 0, adjust?.hairCut ?? 0]);
  const [autoLod, setAutoLod] = useState<HairLod>(INITIAL_HAIR_LOD);
  const lod: HairLod = forcedLod ?? autoLod;
  const budget = useRef(new HairFrameBudget());
  // penteado (guias) crescido uma vez por cabelo; os níveis de detalhe só refazem as fitas
  const groomed = useMemo(() => {
    if (!built || !hair) return null;
    // corte e tom do cabelo: os escolhidos pela pessoa (ajuste fino) ou os medidos na foto
    const cut = hairWithCut(hair, adjust?.hairCut); const color = hairColorFor(cut.color, adjust?.hairTone);
    const h2 = { ...cut, color }; const vol = adjust?.hairVolume ?? 1;
    // fios (hair-strands.ts) por cima de uma base que garante cobertura; raspado/careca/cobertura: só a base
    const fibrous = !cut.cover && !!color && (cut.length === "short" || cut.length === "medium" || cut.length === "long");
    const probe = fibrous ? buildHair(built.asset, built.c, built.h.rest.normals, h2, vol, { base: true }) : null;
    const ctx = probe ? strandContext(built.asset, built.c, h2, probe, vol) : null;
    const groom = ctx && probe ? growGroom(ctx, h2, probe) : null;
    probe?.geometry.dispose(); (probe?.material as THREE.Material | undefined)?.dispose();
    return { h2, vol, color, ctx, groom };
  }, [built, hairKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const makeHair = (level: HairLod): THREE.SkinnedMesh | null => {
    if (!built || !groomed) return null;
    const { h2, vol, color, ctx, groom } = groomed;
    const strands = level < 3 && ctx && groom && color;
    const hb = buildHair(built.asset, built.c, built.h.rest.normals, h2, vol, { base: !!strands }); if (!hb) return null;
    let geometry = hb.geometry; let material: THREE.Material | THREE.Material[] = hb.material;
    if (strands) {
      const st = strandsFromGroom(ctx, groom, level as 0 | 1 | 2);
      if (st) { const w = withStrands(hb, st, color); hb.geometry.dispose(); geometry = w.geometry; material = w.material; }
    }
    const m = new THREE.SkinnedMesh(geometry, material); m.name = hb.kind === "cover" ? "cobertura" : "cabelo"; m.castShadow = true;
    m.userData.hairLod = strands ? level : 3;
    return m;
  };
  const attach = (m: THREE.SkinnedMesh) => { built!.h.root.add(m); m.bind(built!.h.skeleton); return m; };
  // a malha nasce no memo (puro) e só entra na cena no efeito: no modo estrito o memo roda duas vezes
  const hairMesh = useMemo(() => makeHair(lod), [built, groomed, lod]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!hairMesh) return;
    attach(hairMesh);
    return () => {
      hairMesh.removeFromParent(); hairMesh.geometry.dispose();
      for (const mat of ([] as THREE.Material[]).concat(hairMesh.material)) { (mat as THREE.MeshPhysicalMaterial).map?.dispose(); mat.dispose(); }
    };
  }, [hairMesh]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => built?.h.dispose(), [built]);
  useEffect(() => {
    const reg = auditRegistry(); if (!built || !reg) return;
    const e = { root: built.h.root }; reg.add(e); return () => { reg.delete(e); };
  }, [built]);
  // pele: tom medido em todo o corpo; rosto da foto quando há atlas
  useEffect(() => {
    if (!built) return; const m = built.h.body.material as THREE.MeshPhysicalMaterial; const ud = built.h.root.userData;
    // estado da pele para a Prévia 2D: "color" (tom só), "pending" (rosto ainda assando), "baked" (rosto da foto)
    if (!atlas) { m.map?.dispose(); m.map = null; m.color.set(skin); m.needsUpdate = true; ud.skin = "color"; return; }
    let alive = true; ud.skin = "pending";
    const id = window.setTimeout(() => {
      if (!alive) return;
      const tex = new THREE.CanvasTexture(bakeSkin(built.asset, skin, imageOf(atlas))); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      m.map?.dispose(); m.map = tex; m.color.set("#ffffff"); m.needsUpdate = true; ud.skin = "baked";
    }, 0);
    return () => { alive = false; window.clearTimeout(id); };
  }, [built, atlas, skin]);
  useEffect(() => {
    if (!built) return; let alive = true;
    loadTexture(EYE_TEXTURE).then((t) => {
      if (!alive) return; built.h.root.userData.eyesReady = true; if (!t) return;
      const m = built.h.eyes.material as THREE.MeshPhysicalMaterial; m.map = t; m.alphaTest = 0.5; m.color.set("#ffffff"); m.needsUpdate = true;
    });
    return () => { alive = false; };
  }, [built]);
  const parts = useMemo<HumanParts | null>(() => (built ? { human: built.h, pose: built.st, composed: built.c, asset: built.asset, hair: hairMesh, exportHair: () => { const m = makeHair(GLB_HAIR_LOD); return m && attach(m); }, hairLod: (hairMesh?.userData.hairLod ?? 3) as HairLod } : null), [built, hairMesh]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (parts) onReady?.(parts); }, [parts]); // eslint-disable-line react-hooks/exhaustive-deps
  const t0 = useRef(Math.random() * 20);
  useFrame(({ clock }, delta) => {
    if (!built) return;
    if (forcedLod === undefined && hairMesh) { const next = budget.current.push(delta * 1000, autoLod); if (next !== null) setAutoLod(next); }
    built.h.root.visible = built.h.root.userData.dressed === true;   // guarda: sem as três zonas cobertas, não desenha
    applyIdle(built.h, built.st, clock.elapsedTime + t0.current, motion ? 1 : 0);
  });
  if (!parts) return <>{fallback}</>;
  return <group><primitive object={parts.human.root} /><HumanOutfit parts={parts} pieces={pieces} />{children?.(parts)}</group>;
}
