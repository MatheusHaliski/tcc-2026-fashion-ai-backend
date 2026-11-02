/*
 * MET Gala Heist v2 — materiais do lounge (Z05): veludos, couros, madeiras, metais, ônix aceso, espelho
 * envelhecido, vidro, bebidas e guarnições. Saiu de lounge-mob.ts sem mudança.
 */
import * as THREE from "three";
import { fabric, glass, miscMat, solid, type Palette } from "../interior-mats";
import type { Quality } from "../interior-tex";
import { areaMat } from "./lounge-kit";
import { agedMirrorTexture, labelAtlas, onyxSurface } from "./lounge-tex";

export const ROOM = "lounge";

/* ======================= materiais do lounge ======================= */
export function loungeMats(q: Quality, P: Palette) {
  return {
    velvet: fabric("lounge-velvetOx", "#4e101b", q, { sheen: "#c4505e", rough: 0.74 }),
    velvetTeal: fabric("lounge-velvetTeal", "#0f3b40", q, { sheen: "#5fb3b0", rough: 0.75 }),
    brocade: fabric("lounge-brocade", "#8a6a2a", q, { sheen: "#f0d58a", rough: 0.6 }),
    curtain: fabric("lounge-curtain", "#2e0d2a", q, { sheen: "#a066b8", rough: 0.72 }),
    leather: miscMat("leather", q, "#6c3519"),
    leatherOx: miscMat("leather", q, "#3d0d12"),
    walnut: P.walnut, mahogany: P.mahogany, lacquer: P.lacquer, brass: P.brass, gold: P.gold, black: P.black, marble: P.marbleDark,
    ebony: solid("lounge-ebony", "#120c09", { rough: 0.35, env: 0.8 }),
    bronze: solid("lounge-bronze", "#6a4a26", { metal: 0.9, rough: 0.32 }),
    steel: solid("lounge-steel", "#b9bcbf", { metal: 1, rough: 0.22 }),
    ivory: solid("lounge-ivory", "#f1ebdc", { rough: 0.32 }),
    onyxGlow: areaMat(`lounge-onyxGlow-${q}`, () => { const sf = onyxSurface(q); return new THREE.MeshStandardMaterial({ map: sf.map, emissiveMap: sf.map, emissive: new THREE.Color("#ffe2c0"), emissiveIntensity: 0.95, roughness: 0.1, envMapIntensity: 1.1 }); }),
    onyxTop: areaMat(`lounge-onyxTop-${q}`, () => { const sf = onyxSurface(q); const t = sf.map.clone(); t.repeat.set(0.6, 0.6); t.needsUpdate = true; return new THREE.MeshPhysicalMaterial({ map: t, color: new THREE.Color("#c9a77a"), emissiveMap: t, emissive: new THREE.Color("#ff9c4a"), emissiveIntensity: 0.18, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2 }); }),
    mirror: areaMat(`lounge-agedMirror-${q}`, () => new THREE.MeshStandardMaterial({ map: agedMirrorTexture(q), color: new THREE.Color("#b3a182"), metalness: 1, roughness: 0.1, envMapIntensity: 0.95 })),
    bottle: solid("lounge-bottleGlass", "#ffffff", { rough: 0.05, env: 1.7, transparent: true, opacity: 0.84 }),
    label: areaMat("lounge-label", () => new THREE.MeshStandardMaterial({ map: labelAtlas(), roughness: 0.55, side: THREE.DoubleSide })),
    cork: solid("lounge-cork", "#9b7651", { rough: 0.9 }),
    foil: solid("lounge-foil", "#7a1420", { metal: 0.8, rough: 0.35 }),
    glassClear: glass("lounge-glass", { tint: "#e8f0f0", opacity: 0.22, rough: 0.03 }),
    drinkAmber: solid("lounge-drinkAmber", "#b8641c", { rough: 0.05, env: 1.3, transparent: true, opacity: 0.82 }),
    drinkRose: solid("lounge-drinkRose", "#d0485a", { rough: 0.05, env: 1.3, transparent: true, opacity: 0.8 }),
    drinkGold: solid("lounge-drinkGold", "#e2c46a", { rough: 0.05, env: 1.3, transparent: true, opacity: 0.78 }),
    ice: solid("lounge-ice", "#e9f4f7", { rough: 0.12, env: 1.6, transparent: true, opacity: 0.6 }),
    paper: solid("lounge-paper", "#efe6d2", { rough: 0.9 }),
    lime: solid("lounge-lime", "#6d9a2a", { rough: 0.55 }),
    olive: solid("lounge-olive", "#5d6b2a", { rough: 0.4 }),
    rose: solid("lounge-rose", "#8e1426", { rough: 0.7, side: THREE.DoubleSide }),
    leaf: solid("lounge-leaf", "#24401f", { rough: 0.7, side: THREE.DoubleSide }),
  };
}
export type LoungeMats = ReturnType<typeof loungeMats>;
