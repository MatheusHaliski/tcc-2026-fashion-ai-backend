/*
 * MET Gala Heist v2 — galeria (Z07): materiais dos móveis da planta (laca, bronze, latão, aço, vidro, veludo
 * do deck), etiquetas e arte do atlas e a âncora de luz da sala. Saiu de galeria-props.ts sem mudança.
 */
import * as THREE from "three";
import { geo } from "../interior-batch";
import { fabric } from "../interior-mats";
import type { LightAnchor, PropsCtx } from "../interior-props";
import { miscSurface, type Quality } from "../interior-tex";
import type { InteriorRoom } from "../interior-shell";
import { type Fr, atlasPlane, glassEdge, langOf, once, plain, thickGlass } from "./galeria-kit";
import { ART_COLS, ART_ROWS, LABEL_COLS, LABEL_ROWS, artAtlas, labelAtlas } from "./galeria-tex";

export const ROOM = "galeria";

/* ---------- materiais da área ---------- */
export const laca = () => once("galeria-laca", () => new THREE.MeshPhysicalMaterial({ color: "#16171a", roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 1.1 }));
export const bronze = () => plain("galeria-bronze", "#5c432a", { metal: 1, rough: 0.36 });
export const brass = () => plain("galeria-latao", "#c9a24b", { metal: 1, rough: 0.28 });
export const blackSteel = () => plain("galeria-acoPreto", "#121314", { metal: 0.6, rough: 0.45 });
export const vidro = () => thickGlass("galeria-vidro");
export const aresta = () => glassEdge("galeria-vidroAresta");
/** Material das etiquetas (atlas creme), com um pouco de emissivo para ler na penumbra. */
export function labelMat(c: { q: Quality; copy: PropsCtx["copy"] }): THREE.MeshStandardMaterial {
  const t = labelAtlas(c.q, langOf(c.copy));
  return once(`galeria-etiquetaMat-${t.uuid}`, () => new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.16 }));
}
export const labelGeo = (i: number) => atlasPlane("galeria-etq", LABEL_COLS, LABEL_ROWS, i);
/** Arte emoldurada (croquis e guaches). */
export function artMat(q: Quality): THREE.MeshStandardMaterial {
  const t = artAtlas(q);
  return once(`galeria-arteMat-${q}`, () => new THREE.MeshStandardMaterial({ map: t, roughness: 0.88, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.1 }));
}
export const artGeo = (i: number) => atlasPlane("galeria-arte", ART_COLS, ART_ROWS, i);
/** Veludo do deck das vitrines: escuro e com brilho rasante na própria cor (o padrão branqueava o forro sob a caixa de luz). */
export function velvetDeck(key: string, color: string, q: Quality): THREE.MeshPhysicalMaterial {
  return once(`galeria-veludoDeck-${key}-${q}`, () => {
    const sf = miscSurface("fabric", q), col = new THREE.Color(color);
    return new THREE.MeshPhysicalMaterial({ color: col, map: sf.map, normalMap: sf.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.92, sheen: 0.7, sheenColor: col.clone().multiplyScalar(2.2), sheenRoughness: 0.55, envMapIntensity: 0.4 });
  });
}
/** Etiqueta de museu num porta-etiqueta de latão (w × h), em pé no quadro F, centro em (x, y, z), inclinada `tilt`. */
export function label(c: PropsCtx | { q: Quality; copy: PropsCtx["copy"]; batch: PropsCtx["batch"] }, F: Fr, i: number, x: number, y: number, z: number, w = 0.3, tilt = 0, ry = 0) {
  c.batch.add(ROOM, brass(), geo("galeria-portaEtq", () => new THREE.BoxGeometry(1, 1, 1)), F(x, y, z - 0.004, ry, w + 0.02, w * 0.5 + 0.02, 0.008, tilt));
  c.batch.add(ROOM, labelMat(c), labelGeo(i), F(x, y, z + 0.001, ry, w, w * 0.5, 1, tilt));
}
export const anchor = (c: PropsCtx, v: THREE.Vector3, color: string, intensity: number, distance: number, o: Partial<LightAnchor> = {}) => c.anchors.push({ x: v.x, y: v.y, z: v.z, color, intensity, distance, room: ROOM as InteriorRoom, ...o });
