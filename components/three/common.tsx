"use client";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useThree } from "@react-three/fiber";
import { mediaUrl } from "@/lib/api/client";
import type { AvatarAdjust, AvatarModel } from "@/lib/avatar3d/model";
import type { HypeSummary } from "@/lib/hype/types";

/* Vitrines 3D (Passarela, My Stage, mini lojas, "Gerar 3D"): utilitários compartilhados. Unidades em metros. */

export interface Look3dPiece { id: string; name: string; slot: string; category?: string; subcategory?: string; imageUrl?: string | null; studioUrl?: string | null; colorHex?: string | null; model3dUrl?: string | null; model3dStatus?: string | null; defaultImage?: boolean; }
export interface FaceFit { offsetX?: number; offsetY?: number; scale?: number }
/** Avatar 3D (RF40) confirmado pela pessoa: forma do rosto + textura (rota autenticada) + ajustes finos. */
export interface Avatar3dRef { version?: number; model: AvatarModel; adjust?: Partial<AvatarAdjust> | null; textureUrl?: string | null; texture?: THREE.Texture | null }
export interface Mannequin3d { sex: "FEMININO" | "MASCULINO"; sexSource?: string; photoUrl?: string | null; head?: "FOTO" | "PADRAO" | "AVATAR"; skinTone?: string | null; build?: string | null; face?: FaceFit | null; avatar?: Avatar3dRef | null; }
/**
 * Look no manequim. `hype` é o resumo do HypeScore v2 (mesmo formato do card: público para quem vê; pessoal só para o
 * dono; sem Hype público = NOT_CALCULATED, "—"). `likes` é popularidade e aparece à parte do Hype.
 */
export interface Look3d { schemeId?: string; pieceId?: string; title: string; owner?: { id: string; username: string; displayName: string; avatarUrl?: string | null }; hype?: HypeSummary | null; likes?: number; mannequin: Mannequin3d; pieces: Look3dPiece[]; ready3d?: number; missing3d?: number; canRequest?: boolean; }

/** "Reduzir movimento": preferência do app (RF23, data-reduce-motion no <html>) ou do sistema. */
export function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const read = () => setR(document.documentElement.dataset.reduceMotion === "true" || window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    read();
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)"); mq.addEventListener("change", read);
    const mo = new MutationObserver(read); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion"] });
    return () => { mq.removeEventListener("change", read); mo.disconnect(); };
  }, []);
  return r;
}

/** WebGL disponível? Sem ele, as páginas mostram a versão 2D (nunca uma tela em branco). */
export function useWebGL(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    try { const c = document.createElement("canvas"); setOk(!!(c.getContext("webgl2") || c.getContext("webgl"))); } catch { setOk(false); }
  }, []);
  return ok;
}

/** Texturas carregadas por fora do Suspense: uma foto que falha vira cor lisa, sem derrubar a cena. */
const texCache = new Map<string, Promise<THREE.Texture | null>>();
export function loadTexture(url: string): Promise<THREE.Texture | null> {
  let p = texCache.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const l = new THREE.TextureLoader(); l.setCrossOrigin("anonymous");
      l.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; resolve(t); }, undefined, () => resolve(null));
    });
    texCache.set(url, p);
  }
  return p;
}
export function useTex(url?: string | null): THREE.Texture | null {
  const [t, setT] = useState<THREE.Texture | null>(null);
  useEffect(() => { let alive = true; setT(null); const u = mediaUrl(url ?? null); if (!u) return; loadTexture(u).then((x) => alive && setT(x)); return () => { alive = false; }; }, [url]);
  return t;
}

const glbCache = new Map<string, Promise<THREE.Group | null>>();
export function useGlb(url?: string | null): THREE.Group | null {
  const [g, setG] = useState<THREE.Group | null>(null);
  useEffect(() => {
    let alive = true; setG(null); const u = mediaUrl(url ?? null); if (!u) return;
    let p = glbCache.get(u);
    if (!p) { p = new Promise((resolve) => new GLTFLoader().load(u, (x) => resolve(x.scene), undefined, () => resolve(null))); glbCache.set(u, p); }
    p.then((x) => alive && setG(x ? x.clone(true) : null));
    return () => { alive = false; };
  }, [url]);
  return g;
}

/** Texto desenhado num canvas (sem fonte remota): placas, letreiros e o telão. */
export function useCanvasTexture(draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number, deps: unknown[]): THREE.CanvasTexture {
  return useMemo(() => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d")!;
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Pseudoaleatório determinístico (a plateia não muda de lugar a cada render). */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; };
}

/** Tons de pele do provador (MannequinGeometry.SKIN_TONES); sem tom escolhido, o manequim é o de vitrine (marfim). */
export const SKIN: Record<string, string> = { porcelana: "#F4D7C5", clara: "#E8C1A0", media: "#C99A6E", oliva: "#A97C50", morena: "#8A5A3B", escura: "#5E3A26", retinta: "#3F261A" };
export const VITRINE = "#ECE6DC";

/**
 * Luz de estúdio por ambiente (sala neutra gerada no próprio navegador, sem baixar HDR): pele, cabelo e tecido
 * aparecem na cor medida, sem o escurecimento de luzes só direcionais.
 */
export function StudioLight({ intensity = 0.9 }: { intensity?: number }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl); const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    const prev = scene.environment; const prevI = scene.environmentIntensity;
    scene.environment = env; scene.environmentIntensity = intensity;
    return () => { scene.environment = prev; scene.environmentIntensity = prevI; env.dispose(); pm.dispose(); };
  }, [gl, scene, intensity]);
  return null;
}
