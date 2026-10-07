"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { loadBodyAsset, type BodyAsset } from "@/lib/avatar3d/human/asset";
import { compose, fitBody, fitFace, landmarksOn, type BodyInput, type Composed } from "@/lib/avatar3d/human/compose";
import { faceFidelity, type FaceFidelity } from "@/lib/avatar3d/identity/metrics";
import type { FaceResidual } from "@/lib/avatar3d/human/face-residual";

/** Camada de resíduo do rosto (AVATAR-ID I2); NEXT_PUBLIC_FACE_RESIDUAL=off volta ao rosto só do espaço simétrico. */
const FACE_RESIDUAL = process.env.NEXT_PUBLIC_FACE_RESIDUAL !== "off";
import { buildHuman, type Human } from "@/lib/avatar3d/human/three-human";
import { applyIdle, applyRestPose, type PoseState } from "@/lib/avatar3d/human/pose";
import { buildHair, headFrame } from "@/lib/avatar3d/human/hair-geometry";
import { HairSpring, baseHairS, hairMotionUniforms, patchHairMotion, windVector } from "@/lib/avatar3d/human/hair-motion";
import { hairColorFor } from "@/lib/avatar3d/hair-tone";
import { hairWithCut, hairWithFringe } from "@/lib/avatar3d/hair-cut";
import { growGroom, strandContext, strandsFromGroom, withStrands } from "@/lib/avatar3d/human/hair-strands";
import { GLB_HAIR_LOD, HairFrameBudget, chooseHairLod, deviceInfo, type HairLod } from "@/lib/avatar3d/human/hair-lod";
import { EYE_TEXTURE, bakeSkin } from "@/lib/avatar3d/human/skin-bake";
import { recolorIris, shadeSclera } from "@/lib/avatar3d/human/eyes";
import { buildGlasses, fitGlasses } from "@/lib/avatar3d/human/glasses-3d";
import { defaultEyes, irisColorOf, type AvatarEyes } from "@/lib/avatar3d/iris";
import type { AvatarHair, AvatarModel } from "@/lib/avatar3d/model";
import { loadTexture, type Look3dPiece } from "@/components/three/common";
import { HumanOutfit } from "@/components/three/human-outfit";
import { attachHair } from "@/lib/avatar3d/human/attach-hair";
import { prepareFaceTexture } from "@/lib/avatar3d/glasses";

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
let readyAsset: BodyAsset | null = null;
export function useBodyAsset(): BodyAsset | null | "error" {
  const [a, setA] = useState<BodyAsset | null | "error">(() => readyAsset);
  useEffect(() => {
    let alive = true;
    assetPromise ??= loadBodyAsset();
    assetPromise.then((x) => { readyAsset = x; if (alive) setA(x); }, () => { assetPromise = null; if (alive) setA("error"); });
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
  /** fidelidade do rosto medido no corpo (AVATAR-ID I0): só números agregados, nunca vai para log */
  identity?: FaceFidelity | null;
  eyes?: AvatarEyes | null;          // inclui óculos reconhecidos em texturas de avatares antigos
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
  wind?: number;                     // vento no cabelo, 0–1 (padrão 0,15: ar parado de ambiente fechado; palco/passarela, mais)
  onReady?: (p: HumanParts) => void;
  children?: (p: HumanParts) => React.ReactNode;   // extras em cena (a roupa já vem do próprio HumanAvatar)
  fallback?: React.ReactNode;
  debugHair?: boolean;
  hairLod?: HairLod;                 // força o nível de detalhe do cabelo (laboratório); sem ele, o do aparelho
  adjust?: { headScale?: number; neck?: number; hairVolume?: number; hairTone?: number; hairCut?: number; glasses?: number; hairFringe?: number } | null;   // ajustes finos do Avatar 3D
}

/**
 * Textura do olho com a íris na cor medida na foto (AVATAR-ID I4). Sem cor medida (óculos escuros, avatar antigo,
 * manequim), o castanho médio padrão — a textura original do MakeHuman é avermelhada demais. null = fica a original.
 */
function irisTexture(src: CanvasImageSource & { width: number; height: number }, eyes: AvatarEyes): THREE.CanvasTexture | null {
  if (!src.width) return null;
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  const g = c.getContext("2d", { willReadFrequently: true }); if (!g) return null;
  g.drawImage(src, 0, 0); const id = g.getImageData(0, 0, c.width, c.height);
  recolorIris(id, { left: irisColorOf(eyes, "left"), right: irisColorOf(eyes, "right") }); shadeSclera(id); g.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function imageOf(src: Img): HTMLCanvasElement {
  if (src instanceof HTMLCanvasElement) return src;
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height; c.getContext("2d")!.drawImage(src, 0, 0); return c;
}

const ZERO = new THREE.Vector3();

export function HumanAvatar({ body, stature, skin, face, atlas, hair, pieces, motion = true, onReady, children, fallback = null, debugHair, hairLod: forcedLod, adjust, wind }: HumanAvatarProps) {
  const asset = useBodyAsset();
  const key = JSON.stringify([body.sex, body.params ?? null, body.sources ?? null, stature, face?.shape?.length ? face.shape.slice(0, 24) : null, adjust?.headScale ?? 1, adjust?.neck ?? 0]);
  const built = useMemo(() => {
    if (!asset || asset === "error") return null;
    const fit = fitBody(asset, body);
    let fz: Float64Array | null = null; let rawBody: Float32Array | null = null; let residual: FaceResidual | null = null;
    if (face?.shape?.length === 468 * 3) {
      const raw = compose(asset, fit.z, null, stature); rawBody = raw.body;
      const ff = fitFace(asset, Float32Array.from(raw.body, (v) => v / raw.scale), face.shape, 4, { residual: FACE_RESIDUAL });
      fz = ff.z; residual = ff.residual;
    }
    // AVATAR-ID I2: o espaço de rostos (simétrico) + a camada de resíduo assimétrico, na mesma topologia
    const c = compose(asset, fit.z, fz, stature, residual);
    // métricas de fidelidade (reprojeção, assimetria, captura): o gate de identidade usa estes números
    const identity = face?.shape?.length === 468 * 3 && rawBody ? faceFidelity(face.shape, landmarksOn(asset, c.body), landmarksOn(asset, rawBody)) : null;
    const h = buildHuman(asset, c, { skin, debugHair });
    h.root.visible = false; h.root.userData.dressed = false;           // só aparece vestido (HumanOutfit)
    const st = applyRestPose(h);
    const head = h.bone("Head"); head.scale.setScalar(adjust?.headScale ?? 1); head.position.y += adjust?.neck ?? 0;
    return { h, st, c, asset, identity };
  }, [asset, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const hairKey = JSON.stringify([hair ?? null, adjust?.hairVolume ?? 1, adjust?.hairTone ?? 0, adjust?.hairCut ?? 0, adjust?.hairFringe ?? 0]);
  const [autoLod, setAutoLod] = useState<HairLod>(INITIAL_HAIR_LOD);
  const lod: HairLod = forcedLod ?? autoLod;
  const budget = useRef(new HairFrameBudget());
  // penteado (guias) crescido uma vez por cabelo; os níveis de detalhe só refazem as fitas
  const groomed = useMemo(() => {
    if (!built || !hair) return null;
    // corte e tom do cabelo: os escolhidos pela pessoa (ajuste fino) ou os medidos na foto
    // franja escolhida (reta, lateral, cortina…) por cima do corte
    const cut = hairWithFringe(hairWithCut(hair, adjust?.hairCut), adjust?.hairFringe); const color = hairColorFor(cut.color, adjust?.hairTone);
    const h2 = { ...cut, color }; const vol = adjust?.hairVolume ?? 1;
    // fios (hair-strands.ts) por cima de uma base que garante cobertura; raspado/careca/cobertura: só a base
    const fibrous = !cut.cover && !!color && (cut.length === "short" || cut.length === "medium" || cut.length === "long");
    const probe = fibrous ? buildHair(built.asset, built.c, built.h.rest.normals, h2, vol, { base: true }) : null;
    const ctx = probe ? strandContext(built.asset, built.c, h2, probe, vol) : null;
    const groom = ctx && probe ? growGroom(ctx, h2, probe) : null;
    probe?.geometry.dispose(); (probe?.material as THREE.Material | undefined)?.dispose();
    return { h2, vol, color, ctx, groom };
  }, [built, hairKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // movimento do cabelo: uniforms compartilhados pelos materiais do cabelo, mola do atraso e vento do ambiente
  const motionU = useMemo(() => hairMotionUniforms(), []);
  const spring = useRef(new HairSpring());
  const makeHair = (level: HairLod): THREE.SkinnedMesh | null => {
    if (!built || !groomed) return null;
    const { h2, vol, color, ctx, groom } = groomed;
    const strands = level < 3 && ctx && groom && color;
    const hb = buildHair(built.asset, built.c, built.h.rest.normals, h2, vol, { base: !!strands }); if (!hb) return null;
    let geometry = hb.geometry; let material: THREE.Material | THREE.Material[] = hb.material;
    const earY = headFrame(built.asset, built.c).earY;
    if (strands) {
      const st = strandsFromGroom(ctx, groom, level as 0 | 1 | 2);
      if (st) { const w = withStrands(hb, st, color, { earY }); hb.geometry.dispose(); geometry = w.geometry; material = w.material; }
    }
    // movimento do cabelo (vento e atraso dos gestos) na GPU; a cobertura de cabeça (lenço, boné) não balança
    if (!geometry.getAttribute("hairS")) { const pa = geometry.getAttribute("position") as THREE.BufferAttribute; geometry.setAttribute("hairS", new THREE.BufferAttribute(hb.kind === "cover" ? new Float32Array(pa.count) : baseHairS(pa.array as ArrayLike<number>, pa.count, earY), 1)); }
    for (const mat of ([] as THREE.Material[]).concat(material)) patchHairMotion(mat, motionU);
    const m = new THREE.SkinnedMesh(geometry, material); m.name = hb.kind === "cover" ? "cobertura" : "cabelo"; m.castShadow = true;
    m.userData.hairLod = strands ? level : 3;
    return m;
  };
  const attach = (m: THREE.SkinnedMesh) => attachHair(built!.h, m);
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
  const eyewearKey = JSON.stringify(face?.eyes ?? null);
  const preparedAtlas = useMemo(() => {
    if (!atlas) return null;
    const source = imageOf(atlas);
    const canvas = document.createElement("canvas"); canvas.width = source.width; canvas.height = source.height;
    const g = canvas.getContext("2d", { willReadFrequently: true })!; g.drawImage(source, 0, 0);
    const id = g.getImageData(0, 0, canvas.width, canvas.height);
    const tone = face?.skin ?? skin;
    const rgb = [1, 3, 5].map((start) => parseInt(tone.slice(start, start + 2), 16)) as [number, number, number];
    const cleaned = prepareFaceTexture(id, rgb, face?.eyes);
    if (cleaned.removed) { id.data.set(cleaned.image.data); g.putImageData(id, 0, 0); }
    return { canvas, eyes: cleaned.eyes };
  }, [atlas, face?.skin, skin, eyewearKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // pele: tom medido em todo o corpo; rosto da foto quando há atlas
  useEffect(() => {
    if (!built) return; const m = built.h.body.material as THREE.MeshPhysicalMaterial; const ud = built.h.root.userData;
    // estado da pele para a Prévia 2D: "color" (tom só), "pending" (rosto ainda assando), "baked" (rosto da foto)
    if (!atlas) { m.map?.dispose(); m.map = null; m.color.set(skin); m.needsUpdate = true; ud.skin = "color"; return; }
    let alive = true; ud.skin = "pending";
    const id = window.setTimeout(() => {
      if (!alive) return;
      // relatório da pele (erro de cor e costura): números agregados para o gate, nunca em log
      const tex = new THREE.CanvasTexture(bakeSkin(built.asset, skin, preparedAtlas?.canvas ?? imageOf(atlas), 2048, (r) => { ud.skinReport = r; })); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      m.map?.dispose(); m.map = tex; m.color.set("#ffffff"); m.needsUpdate = true; ud.skin = "baked";
    }, 0);
    return () => { alive = false; window.clearTimeout(id); };
  }, [built, atlas, preparedAtlas, skin]);
  // olhos: a textura do MakeHuman com a íris recolorida na cor medida na foto (AVATAR-ID I4); a original fica no cache
  const eyes = preparedAtlas?.eyes ?? face?.eyes ?? null; const eyesKey = JSON.stringify(eyes ? [eyes.source, eyes.color, eyes.secondary, eyes.left ?? null, eyes.right ?? null] : null);
  useEffect(() => {
    if (!built) return; let alive = true; let own: THREE.Texture | null = null;
    loadTexture(EYE_TEXTURE).then((t) => {
      if (!alive) return; built.h.root.userData.eyesReady = true; if (!t) return;
      own = irisTexture(t.image as HTMLImageElement, eyes ?? defaultEyes());
      const m = built.h.eyes.material as THREE.MeshPhysicalMaterial; m.map = own ?? t; m.alphaTest = 0.5; m.color.set("#ffffff"); m.needsUpdate = true;
    });
    return () => { alive = false; own?.dispose(); };
  }, [built, eyesKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // óculos de grau vistos na foto: acessório preso ao osso Head, afastado do rosto; a pessoa pode tirar (ajuste "glasses")
  const showGlasses = eyes?.glasses === "PRESCRIPTION" && (adjust?.glasses ?? 1) !== 0;
  useLayoutEffect(() => {
    if (!built || !showGlasses) return;
    const head = built.h.bone("Head"); const hj = built.h.bones.indexOf(head);
    const g = buildGlasses(fitGlasses(built.asset, built.c), [built.c.joints[hj * 3], built.c.joints[hj * 3 + 1], built.c.joints[hj * 3 + 2]], eyes?.frame);
    head.add(g);
    return () => { g.removeFromParent(); g.userData.dispose?.(); };
  }, [built, showGlasses, eyes?.frame]); // eslint-disable-line react-hooks/exhaustive-deps
  const parts = useMemo<HumanParts | null>(() => (built ? { human: built.h, pose: built.st, composed: built.c, asset: built.asset, hair: hairMesh, exportHair: () => { const m = makeHair(GLB_HAIR_LOD); return m && attach(m); }, hairLod: (hairMesh?.userData.hairLod ?? 3) as HairLod, identity: built.identity, eyes } : null), [built, hairMesh, eyes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (parts) onReady?.(parts); }, [parts]); // eslint-disable-line react-hooks/exhaustive-deps
  const t0 = useRef(Math.random() * 20);
  const anchor = useMemo(() => new THREE.Vector3(), []); const inv = useMemo(() => new THREE.Matrix3(), []);
  useFrame(({ clock }, delta) => {
    if (!built) return;
    if (forcedLod === undefined && hairMesh) { const next = budget.current.push(delta * 1000, autoLod); if (next !== null) setAutoLod(next); }
    built.h.root.visible = built.h.root.userData.dressed === true;   // guarda: sem as três zonas cobertas, não desenha
    applyIdle(built.h, built.st, clock.elapsedTime + t0.current, motion ? 1 : 0);
    // cabelo: o ponto da massa do cabelo (abaixo e atrás do centro da cabeça) puxa a mola; vento e atraso vão para o
    // espaço do objeto do cabelo. Sem movimento (reduzir movimento), tudo parado
    if (hairMesh) {
      const head = built.h.bone("Head"); head.updateWorldMatrix(true, false);
      anchor.set(0, -0.06, -0.05).applyMatrix4(head.matrixWorld);
      const lag = motion ? spring.current.step(delta, anchor) : (spring.current.reset(), spring.current.lag);
      inv.setFromMatrix4(hairMesh.matrixWorld).invert();
      motionU.hairLag.value.copy(lag).applyMatrix3(inv);
      motionU.hairWind.value.copy(motion ? windVector(wind ?? 0.15) : ZERO).applyMatrix3(inv);
      motionU.hairTime.value = motion ? clock.elapsedTime : 0;
    }
  });
  if (!parts) return <>{fallback}</>;
  return <group><primitive object={parts.human.root} /><HumanOutfit parts={parts} pieces={pieces} />{children?.(parts)}</group>;
}
