/*
 * MET Gala Heist v2 — materiais dos trajes do Instituto do Traje: manequim, cetim (com degradê e tule),
 * cristais, ouro, ouro branco e pérola. Saiu de galeria-trajes.ts sem mudança.
 */
import * as THREE from "three";
import { once, paint, plain } from "./galeria-kit";

/* ---------- materiais ---------- */
/** Manequim de fibra em gesso fosco marfim (o padrão de museu). */
export const mannequinMat = () => plain("galeria-manequim", "#e9e2d4", { rough: 0.62, env: 0.6 });
/** Tecido acetinado com brilho rasante; degradê opcional (barra → topo); transparente para tule. */
export function satin(key: string, color: string, o: { stops?: string[]; sheen?: string; rough?: number; clear?: number; opacity?: number } = {}): THREE.MeshPhysicalMaterial {
  return once(`galeria-traje-${key}`, () => new THREE.MeshPhysicalMaterial({
    color: o.stops ? "#ffffff" : color, roughness: o.rough ?? 0.42, metalness: 0, sheen: 1, sheenColor: new THREE.Color(o.sheen ?? "#ffffff"), sheenRoughness: 0.3,
    clearcoat: o.clear ?? 0.2, clearcoatRoughness: 0.4, side: THREE.DoubleSide, envMapIntensity: 1,
    map: o.stops ? paint(`galeria-degrade-${key}`, 8, 256, (g, w, h) => { const grd = g.createLinearGradient(0, h, 0, 0); o.stops!.forEach((c, i) => grd.addColorStop(i / Math.max(1, o.stops!.length - 1), c)); g.fillStyle = grd; g.fillRect(0, 0, w, h); }) : null,
    transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, depthWrite: (o.opacity ?? 1) >= 1,
  }));
}
/** Cristais bordados e strass: quase sem rugosidade, reflexo forte, uma pontinha de emissivo para cintilar no escuro. */
export const crystalMat = () => plain("galeria-cristal", "#f4f8ff", { rough: 0.02, metal: 0.1, env: 3, emissive: "#9fb4ff", ei: 0.35 });
export const goldMat = () => plain("galeria-ouro", "#d8b25c", { metal: 1, rough: 0.22 });
export const whiteGoldMat = () => plain("galeria-ouroBranco", "#dfe2e6", { metal: 1, rough: 0.16 });
export const pearlMat = () => plain("galeria-perola", "#f3ece0", { rough: 0.18, env: 1.6 });
