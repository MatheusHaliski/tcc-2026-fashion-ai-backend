/*
 * MET Gala Heist v2 — materiais da área de serviço: cache de materiais da área (`once`), material com superfície PBR
 * (`pbrMat`) e a paleta `SM` de metais, plásticos, borrachas e tintas (chaves "srv-").
 * Saiu de servico-kit.ts sem mudança (servico-kit.ts continua reexportando tudo).
 */
import * as THREE from "three";
import { miscMat, solid } from "../interior-mats";
import type { Quality } from "../interior-tex";
import type { Pbr } from "./servico-kit-pbr";

/* ======================= materiais da área ======================= */
const mats = new Map<string, THREE.Material>();
export function once<T extends THREE.Material>(key: string, make: () => T): T { const hit = mats.get(key) as T | undefined; if (hit) return hit; const m = make(); m.name = key; mats.set(key, m); return m; }
/** Material com superfície PBR da área (tinta, metal, relevo e cores por vértice opcionais). */
/** `bounce`: luz rebatida do piso e das paredes (o próprio mapa como emissivo fraco) — forros que só recebem luz rasante. */
export function pbrMat(key: string, sf: Pbr, o: { tint?: string; metal?: number; rough?: number; normal?: number; vertex?: boolean; env?: number; offset?: boolean; bounce?: number } = {}): THREE.MeshStandardMaterial {
  return once(key, () => new THREE.MeshStandardMaterial({
    map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, normalScale: new THREE.Vector2(o.normal ?? 1, o.normal ?? 1),
    color: new THREE.Color(o.tint ?? "#ffffff"), metalness: o.metal ?? 0, roughness: o.rough ?? 1, vertexColors: o.vertex ?? false, envMapIntensity: o.env ?? 1,
    polygonOffset: !!o.offset, polygonOffsetFactor: o.offset ? -1 : 0, polygonOffsetUnits: o.offset ? -1 : 0,
    emissiveMap: o.bounce ? sf.map : null, emissive: new THREE.Color(o.bounce ? "#ffffff" : "#000000"), emissiveIntensity: o.bounce ?? 0,
  }));
}
/** Paleta da área: metais, plásticos, borrachas e tintas (chaves "srv-"). */
export function SM(q: Quality) {
  return {
    inox: miscMat("brushed", q, "#d5d9dd", { metal: 1, env: 1.2 }),
    inoxDark: miscMat("brushed", q, "#8d9298", { metal: 1, env: 1 }),
    galv: solid("srv-galv", "#9da3a6", { metal: 0.85, rough: 0.48 }),
    alu: solid("srv-alu", "#c4c8cc", { metal: 0.9, rough: 0.32 }),
    chrome: solid("srv-chrome", "#e4e6e8", { metal: 1, rough: 0.1 }),
    steelBlack: solid("srv-steelBlack", "#1d1f22", { metal: 0.6, rough: 0.45 }),
    paintRed: solid("srv-paintRed", "#b3141b", { metal: 0.3, rough: 0.35 }),
    paintGrey: solid("srv-paintGrey", "#6b7177", { metal: 0.3, rough: 0.5 }),
    paintCream: solid("srv-paintCream", "#d9d5c8", { metal: 0.2, rough: 0.45 }),
    paintWhite: solid("srv-paintWhite", "#eceae4", { metal: 0.1, rough: 0.4 }),
    paintYellow: solid("srv-paintYellow", "#e7b21a", { rough: 0.55 }),
    pipeRed: solid("srv-pipeRed", "#a3191d", { metal: 0.35, rough: 0.42 }),
    rubber: solid("srv-rubber", "#141415", { rough: 0.92 }),
    rubberGrey: solid("srv-rubberGrey", "#3b3d40", { rough: 0.85 }),
    vinylGrey: solid("srv-vinylGrey", "#8e9296", { rough: 0.55 }),
    vinylDark: solid("srv-vinylDark", "#4a4e53", { rough: 0.5 }),
    plasticWhite: solid("srv-plasticWhite", "#e6e6e1", { rough: 0.38 }),
    plasticBlack: solid("srv-plasticBlack", "#1a1b1d", { rough: 0.42 }),
    plasticGrey: solid("srv-plasticGrey", "#6f7378", { rough: 0.45 }),
    plasticBlue: solid("srv-plasticBlue", "#1f4f8f", { rough: 0.45 }),
    plasticRed: solid("srv-plasticRed", "#b5191f", { rough: 0.42 }),
    plasticGreen: solid("srv-plasticGreen", "#2c6b3a", { rough: 0.45 }),
    plasticYellow: solid("srv-plasticYellow", "#f1c21b", { rough: 0.45 }),
    opal: solid("srv-opal", "#f4f7fb", { rough: 0.3, emissive: "#eef4ff", emissiveIntensity: 1.6 }),
    opalWarm: solid("srv-opalWarm", "#fff3df", { rough: 0.3, emissive: "#ffe9c4", emissiveIntensity: 1.5 }),
    poly: solid("srv-poly", "#c9ced2", { rough: 0.25, transparent: true, opacity: 0.55 }),
    glassDark: solid("srv-glassDark", "#1b2229", { metal: 0.3, rough: 0.08, env: 1.4 }),
    white: solid("srv-white", "#f1f0ec", { rough: 0.55 }),
    porcelain: solid("srv-porcelain", "#f6f5f1", { rough: 0.16, env: 1.2 }),
    cardboard: solid("srv-cardboard", "#9d7a52", { rough: 0.95 }),
    paper: solid("srv-paper", "#efece4", { rough: 0.9 }),
    wood: miscMat("grain", q, "#8a6844"),
    cork: solid("srv-cork", "#a8794d", { rough: 0.95 }),
    cable: solid("srv-cable", "#121213", { rough: 0.6 }),
    cableGrey: solid("srv-cableGrey", "#5d6166", { rough: 0.55 }),
    brass: solid("srv-brass", "#b8933f", { metal: 1, rough: 0.3 }),
    fabricBlack: solid("srv-fabricBlack", "#121214", { rough: 0.95 }),
    glassClear: solid("srv-glassClear", "#dbe6ea", { rough: 0.04, env: 1.6, transparent: true, opacity: 0.32 }),
    stripPvc: solid("srv-stripPvc", "#cfe0e6", { rough: 0.15, env: 1.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  };
}
export type SPalette = ReturnType<typeof SM>;
