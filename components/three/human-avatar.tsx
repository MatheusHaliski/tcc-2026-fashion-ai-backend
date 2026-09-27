"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { loadBodyAsset, type BodyAsset } from "@/lib/avatar3d/human/asset";
import { compose, fitBody, fitFace, type BodyInput, type Composed } from "@/lib/avatar3d/human/compose";
import { buildHuman, type Human } from "@/lib/avatar3d/human/three-human";
import { applyIdle, applyRestPose, type PoseState } from "@/lib/avatar3d/human/pose";
import { buildHair } from "@/lib/avatar3d/human/hair-geometry";
import { EYE_TEXTURE, bakeSkin } from "@/lib/avatar3d/human/skin-bake";
import type { AvatarHair, AvatarModel } from "@/lib/avatar3d/model";
import { loadTexture } from "@/components/three/common";

/*
 * Corpo humano do Avatar 3D (RF40): malha MakeHuman (CC0) com esqueleto humanoide, na forma e estatura da pessoa,
 * rosto ajustado aos pontos do rosto dela com a textura da foto, cabelo (ou cobertura) medido na foto, pose natural e
 * movimento parado. Enquanto o arquivo do corpo carrega (ou se ele falhar), `fallback` é desenhado — as vitrines nunca
 * ficam vazias.
 */

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
export interface HumanParts { human: Human; pose: PoseState; composed: Composed; asset: BodyAsset; hair: THREE.SkinnedMesh | null }

export interface HumanAvatarProps {
  body: BodyInput;
  stature: number;
  skin: string;
  face?: AvatarModel | null;         // forma do rosto medida (468 pontos) — sem ela, rosto neutro do modelo
  atlas?: Img | null;                // textura do rosto (UV canônico) — sem ela, pele lisa no tom medido
  hair?: AvatarHair | null;          // cabelo/cobertura medidos na foto
  motion?: boolean;                  // movimento parado (desligado com "reduzir movimento")
  onReady?: (p: HumanParts) => void;
  children?: (p: HumanParts) => React.ReactNode;
  fallback?: React.ReactNode;
  debugHair?: boolean;
  adjust?: { headScale?: number; neck?: number; hairVolume?: number } | null;   // ajustes finos do Avatar 3D
}

function imageOf(src: Img): HTMLCanvasElement {
  if (src instanceof HTMLCanvasElement) return src;
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height; c.getContext("2d")!.drawImage(src, 0, 0); return c;
}

export function HumanAvatar({ body, stature, skin, face, atlas, hair, motion = true, onReady, children, fallback = null, debugHair, adjust }: HumanAvatarProps) {
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
    const st = applyRestPose(h);
    const head = h.bone("Head"); head.scale.setScalar(adjust?.headScale ?? 1); head.position.y += adjust?.neck ?? 0;
    return { h, st, c, asset };
  }, [asset, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const hairKey = JSON.stringify([hair ?? null, adjust?.hairVolume ?? 1]);
  const hairMesh = useMemo(() => {
    if (!built || !hair) return null;
    const hb = buildHair(built.asset, built.c, built.h.rest.normals, hair, adjust?.hairVolume ?? 1); if (!hb) return null;
    const m = new THREE.SkinnedMesh(hb.geometry, hb.material); m.name = hb.kind === "cover" ? "cobertura" : "cabelo"; m.castShadow = true;
    built.h.root.add(m); m.bind(built.h.skeleton);
    return m;
  }, [built, hairKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    if (!hairMesh) return;
    hairMesh.removeFromParent(); hairMesh.geometry.dispose(); (hairMesh.material as THREE.MeshPhysicalMaterial).map?.dispose(); (hairMesh.material as THREE.Material).dispose();
  }, [hairMesh]);
  useEffect(() => () => built?.h.dispose(), [built]);
  // pele: tom medido em todo o corpo; rosto da foto quando há atlas
  useEffect(() => {
    if (!built) return; const m = built.h.body.material as THREE.MeshPhysicalMaterial;
    if (!atlas) { m.map?.dispose(); m.map = null; m.color.set(skin); m.needsUpdate = true; return; }
    let alive = true;
    const id = window.setTimeout(() => {
      if (!alive) return;
      const tex = new THREE.CanvasTexture(bakeSkin(built.asset, skin, imageOf(atlas))); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      m.map?.dispose(); m.map = tex; m.color.set("#ffffff"); m.needsUpdate = true;
    }, 0);
    return () => { alive = false; window.clearTimeout(id); };
  }, [built, atlas, skin]);
  useEffect(() => {
    if (!built) return; let alive = true;
    loadTexture(EYE_TEXTURE).then((t) => {
      if (!alive || !t) return; const m = built.h.eyes.material as THREE.MeshPhysicalMaterial; m.map = t; m.alphaTest = 0.5; m.color.set("#ffffff"); m.needsUpdate = true;
    });
    return () => { alive = false; };
  }, [built]);
  const parts = useMemo<HumanParts | null>(() => (built ? { human: built.h, pose: built.st, composed: built.c, asset: built.asset, hair: hairMesh } : null), [built, hairMesh]);
  useEffect(() => { if (parts) onReady?.(parts); }, [parts]); // eslint-disable-line react-hooks/exhaustive-deps
  const t0 = useRef(Math.random() * 20);
  useFrame(({ clock }) => { if (built) applyIdle(built.h, built.st, clock.elapsedTime + t0.current, motion ? 1 : 0); });
  if (!parts) return <>{fallback}</>;
  return <group><primitive object={parts.human.root} />{children?.(parts)}</group>;
}
