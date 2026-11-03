/*
 * MET Gala Heist v2 — Sala das Joias (Z08): materiais dos móveis da planta (latão, ouro velho, veludos,
 * vidro, aço), a etiqueta do atlas pequeno, a luz das vitrines e a âncora de luz. Saiu de cofre-props.ts sem mudança.
 */
import * as THREE from "three";
import { fabric } from "../interior-mats";
import type { LightAnchor, PropsCtx } from "../interior-props";
import type { InteriorRoom } from "../interior-shell";
import { atlasPlane, glassEdge, langOf, lit, once, plain, thickGlass } from "./galeria-kit";
import { tagAtlas } from "./cofre-tex";

export const ROOM = "cofre";
export const brassC = () => plain("galeria-latao", "#c9a24b", { metal: 1, rough: 0.28 });
export const goldC = () => plain("cofre-ouroVelho", "#b48a3c", { metal: 1, rough: 0.36 });
export const velvetPlum = (q: PropsCtx["q"]) => fabric("cofre-veludoAmeixa", "#2c0a1e", q, { sheen: "#8a3a6a", rough: 0.8 });
export const velvetBlack = (q: PropsCtx["q"]) => fabric("cofre-veludoPreto", "#0c0b0e", q, { rough: 0.85 });
export const vidroC = () => thickGlass("cofre-vidro");
export const arestaC = () => glassEdge("cofre-vidroAresta");
export const steelWhite = () => plain("cofre-acoBranco", "#b9bcb8", { metal: 0.35, rough: 0.42 });
export const steelGrey = () => plain("cofre-acoCinza", "#8d9298", { metal: 0.7, rough: 0.38 });
export const anchor = (c: PropsCtx, v: THREE.Vector3, color: string, intensity: number, distance: number, o: Partial<LightAnchor> = {}) => c.anchors.push({ x: v.x, y: v.y, z: v.z, color, intensity, distance, room: ROOM as InteriorRoom, ...o });
/** Etiqueta do atlas pequeno (gavetas, caixas, vitrines). */
export function tagMat(c: { q: PropsCtx["q"]; copy: PropsCtx["copy"] }): THREE.MeshStandardMaterial {
  const t = tagAtlas(c.q, langOf(c.copy));
  return once(`cofre-etiquetaMat-${t.uuid}`, () => new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.2, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.14 }));
}
export const tagGeo = (i: number) => atlasPlane("cofre-etq", 4, 4, i);
/** Nogueira do mobiliário (a mesma da paleta) e a luz das vitrines (apaga quando cortam o quadro de luz: cofre.ts). */
export const caseLight = () => lit("cofre-luzVitrine", "#fff4e2", 2.2);
