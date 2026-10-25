/*
 * MET Gala Heist v2 — materiais PBR do interior (um por superfície, compartilhados por todas as malhas que a usam) e os
 * mapas de ambiente de cada clima de sala (âmbar da festa, galeria escura com focos, fluorescente do serviço, veludo da
 * Sala das Joias), gerados no próprio navegador por PMREM a partir de pequenas salas emissivas — reflexo no mármore, no
 * latão e no vidro e a luz difusa de fundo sem luzes reais.
 */
import * as THREE from "three";
import { floorSurface, miscSurface, wallSurface, type FloorKey, type MiscKey, type Quality, type WallKey } from "./interior-tex";

type Std = THREE.MeshStandardMaterial;
const cache = new Map<string, THREE.Material>();

function once<T extends THREE.Material>(key: string, make: () => T): T {
  const hit = cache.get(key) as T | undefined; if (hit) return hit;
  const m = make(); m.name = key; cache.set(key, m); return m;
}
/** Material com textura procedural (cor + relevo + rugosidade), tingido e com cores por vértice (sombra de contato fingida). */
function surfaceMat(key: string, sf: { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }, o: { tint?: string; metal?: number; normal?: number; vertex?: boolean; env?: number; rough?: number } = {}): Std {
  return once(key, () => new THREE.MeshStandardMaterial({
    map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, normalScale: new THREE.Vector2(o.normal ?? 1, o.normal ?? 1),
    color: new THREE.Color(o.tint ?? "#ffffff"), metalness: o.metal ?? 0, roughness: o.rough ?? 1, vertexColors: o.vertex ?? false, envMapIntensity: o.env ?? 1,
    shadowSide: THREE.DoubleSide,
  }));
}

export function floorMat(k: FloorKey, q: Quality): Std { return surfaceMat(`floor-${k}-${q}`, floorSurface(k, q), { vertex: true, env: k === "carpet" || k === "pavers" ? 0.4 : 1, normal: k === "carpet" ? 0.6 : 1 }); }
export function wallMat(k: WallKey, q: Quality): Std { return surfaceMat(`wall-${k}-${q}`, wallSurface(k, q), { vertex: true, env: k === "limestone" ? 0.7 : 0.5 }); }
/** A mesma superfície sem cores por vértice (molduras, peças soltas). */
export function plainWall(k: WallKey, q: Quality, tint?: string): Std { return surfaceMat(`plainwall-${k}-${q}-${tint ?? ""}`, wallSurface(k, q), { tint, env: 0.6 }); }
export function plainFloor(k: FloorKey, q: Quality, tint?: string): Std { return surfaceMat(`plainfloor-${k}-${q}-${tint ?? ""}`, floorSurface(k, q), { tint }); }
export function miscMat(k: MiscKey, q: Quality, tint?: string, o: { metal?: number; vertex?: boolean; env?: number; normal?: number } = {}): Std {
  return surfaceMat(`misc-${k}-${q}-${tint ?? ""}-${o.metal ?? 0}-${o.vertex ? 1 : 0}`, miscSurface(k, q), { tint, metal: o.metal, vertex: o.vertex, env: o.env, normal: o.normal });
}

/** Cores lisas e metais (sem textura): latão, ouro velho, cromo, aço, laca, vidro, tecidos tingidos. */
export function solid(key: string, color: string, o: { metal?: number; rough?: number; env?: number; emissive?: string; emissiveIntensity?: number; side?: THREE.Side; transparent?: boolean; opacity?: number } = {}): Std {
  return once(`solid-${key}`, () => new THREE.MeshStandardMaterial({
    color, metalness: o.metal ?? 0, roughness: o.rough ?? 0.6, envMapIntensity: o.env ?? 1,
    emissive: new THREE.Color(o.emissive ?? "#000000"), emissiveIntensity: o.emissiveIntensity ?? 1,
    side: o.side ?? THREE.FrontSide, transparent: o.transparent ?? false, opacity: o.opacity ?? 1,
  }));
}
/** Tecidos aveludados: brilho rasante (sheen) — sofás, cortinas, toalhas, vestidos das vitrines. */
export function fabric(key: string, color: string, q: Quality, o: { sheen?: string; rough?: number; side?: THREE.Side } = {}): THREE.MeshPhysicalMaterial {
  return once(`fabric-${key}-${q}`, () => {
    const sf = miscSurface("fabric", q);
    return new THREE.MeshPhysicalMaterial({ color, map: sf.map, normalMap: sf.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: o.rough ?? 0.8,
      sheen: 1, sheenColor: new THREE.Color(o.sheen ?? color).lerp(new THREE.Color("#ffffff"), 0.35), sheenRoughness: 0.45, side: o.side ?? THREE.FrontSide, envMapIntensity: 0.6 });
  });
}
export function glass(key: string, o: { tint?: string; opacity?: number; rough?: number } = {}): THREE.MeshPhysicalMaterial {
  return once(`glass-${key}`, () => new THREE.MeshPhysicalMaterial({
    color: o.tint ?? "#dfe9ee", metalness: 0, roughness: o.rough ?? 0.04, transparent: true, opacity: o.opacity ?? 0.16, envMapIntensity: 1.6,
    clearcoat: 1, clearcoatRoughness: 0.03, side: THREE.DoubleSide, depthWrite: false,
  }));
}
/** Emissivos sem luz (lâmpadas, chamas, telas): saem acima de 1 para o tone mapping/bloom pegar o brilho. */
export function glow(key: string, color: string, k = 1, o: { additive?: boolean; opacity?: number; map?: THREE.Texture | null; side?: THREE.Side; toneMapped?: boolean } = {}): THREE.MeshBasicMaterial {
  return once(`glow-${key}`, () => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), map: o.map ?? null, transparent: !!o.additive || (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1,
      blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !o.additive, side: o.side ?? THREE.FrontSide, toneMapped: o.toneMapped ?? true });
    return m;
  });
}

/** Paleta nomeada (as chaves que os construtores de móveis usam). */
export function M(q: Quality) {
  return {
    brass: solid("brass", "#c9a24b", { metal: 1, rough: 0.28 }),
    gold: solid("gold", "#b48a3c", { metal: 1, rough: 0.38 }),
    goldBright: solid("goldBright", "#e0b85a", { metal: 1, rough: 0.2 }),
    chrome: solid("chrome", "#d9dadc", { metal: 1, rough: 0.12 }),
    steel: miscMat("brushed", q, "#a4a9ae", { metal: 0.9 }),
    darkSteel: solid("darkSteel", "#2a2d31", { metal: 0.7, rough: 0.45 }),
    black: solid("black", "#0b0b0c", { rough: 0.55 }),
    lacquer: once(`lacquer`, () => new THREE.MeshPhysicalMaterial({ color: "#050506", roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 })),
    marbleWhite: miscMat("marbleWhite", q),
    marbleDark: plainFloor("marbleBlack", q),
    limestone: plainWall("limestone", q),
    plaster: miscMat("plaster", q, undefined, { vertex: true }),
    plasterPlain: miscMat("plaster", q),
    acoustic: miscMat("acoustic", q, undefined, { vertex: true }),
    ceilDark: solid("ceilDark", "#0d0d10", { rough: 0.9, env: 0.3 }),
    mahogany: miscMat("grain", q, "#5a2414"),
    walnut: miscMat("grain", q, "#3b2414"),
    oak: miscMat("grain", q, "#b08a5a"),
    crateWood: miscMat("crate", q),
    leatherBlack: miscMat("leather", q, "#141416"),
    leatherBrown: miscMat("leather", q, "#4a2c1c"),
    velvetRose: fabric("velvetRose", "#7d2a45", q),
    velvetGreen: fabric("velvetGreen", "#0f4a35", q),
    velvetPlum: fabric("velvetPlum", "#3d0d26", q),
    velvetBlack: fabric("velvetBlack", "#101012", q),
    velvetRed: fabric("velvetRed", "#6b0d17", q),
    linen: fabric("linen", "#efe8da", q, { rough: 0.9 }),
    canvasWhite: fabric("canvasWhite", "#e9e5dc", q),
    garmentBag: fabric("garmentBag", "#1b1c20", q, { rough: 0.7 }),
    rubber: solid("rubber", "#151515", { rough: 0.9 }),
    plastic: solid("plastic", "#d8d8d4", { rough: 0.5 }),
    plasticDark: solid("plasticDark", "#232427", { rough: 0.45 }),
    paperWhite: solid("paperWhite", "#f1eee6", { rough: 0.9 }),
    cardboard: solid("cardboard", "#a27c52", { rough: 0.95 }),
    foliage: solid("foliage", "#1f4a26", { rough: 0.85 }),
    foliageLight: solid("foliageLight", "#3a6b33", { rough: 0.8 }),
    bark: solid("bark", "#3a2a1e", { rough: 0.95 }),
    soil: solid("soil", "#2a1d14", { rough: 1 }),
    stone: plainWall("limestone", q, "#d9d0bf"),
    concrete: plainFloor("concrete", q),
    yellow: solid("yellow", "#e2b31c", { rough: 0.6 }),
    redPaint: solid("redPaint", "#a11a1a", { rough: 0.5 }),
    greenSign: solid("greenSign", "#0b7d3b", { rough: 0.5, emissive: "#0a8a3c", emissiveIntensity: 0.9 }),
    glass: glass("clear"),
    glassDark: glass("dark", { tint: "#1a2230", opacity: 0.55 }),
    mirror: solid("mirror", "#cfd3d6", { metal: 1, rough: 0.02, env: 1.4 }),
    bottleGreen: solid("bottleGreen", "#1d4d2b", { rough: 0.08, env: 1.4, transparent: true, opacity: 0.85 }),
    bottleAmber: solid("bottleAmber", "#8a4b12", { rough: 0.08, env: 1.4, transparent: true, opacity: 0.85 }),
    bottleClear: solid("bottleClear", "#c9d6d8", { rough: 0.05, env: 1.6, transparent: true, opacity: 0.5 }),
    champagne: solid("champagne", "#e6c46a", { rough: 0.1, env: 1.2, transparent: true, opacity: 0.75 }),
    candle: solid("candle", "#f3ead6", { rough: 0.7, emissive: "#3a2a10", emissiveIntensity: 0.4 }),
    flame: glow("flame", "#ffcf7a", 2.4, { additive: true }),
    bulbWarm: glow("bulbWarm", "#ffd9a0", 2.2),
    bulbCool: glow("bulbCool", "#e8f2ff", 2.4),
    fluoro: glow("fluoro", "#eef6ff", 2.2),
    ledPink: glow("ledPink", "#ff4fa3", 2.6),
    ledRed: glow("ledRed", "#ff2a2a", 2.4),
    ledGreen: glow("ledGreen", "#2bff6a", 2.2),
    ledAmber: glow("ledAmber", "#ffb22e", 2.2),
    windowWarm: glow("windowWarm", "#ffc982", 1.3),
    windowNight: solid("windowNight", "#0b1220", { metal: 0.2, rough: 0.1, env: 1.2, emissive: "#0a1428", emissiveIntensity: 0.6 }),
  };
}
export type Palette = ReturnType<typeof M>;

/* ---------- mapas de ambiente por clima de sala ---------- */
export type EnvMood = "warm" | "gallery" | "backstage" | "cool" | "vault";
const MOODS: Record<EnvMood, { walls: string; floor: string; panels: [string, number][]; spots: [string, number][] }> = {
  // salão em âmbar com lavagens rosa nas paredes; galeria quase preta com focos brancos; serviço com fluorescentes frias
  warm: { walls: "#3a2a22", floor: "#1e140e", panels: [["#ffcf8f", 5], ["#b98cff", 1.4], ["#ffe2b8", 3]], spots: [["#fff0d8", 12]] },
  gallery: { walls: "#0d0f14", floor: "#120c08", panels: [["#f4f0e6", 1.2]], spots: [["#fff6e8", 18], ["#dfe6ff", 10]] },
  backstage: { walls: "#141414", floor: "#0c0c0c", panels: [["#ffe0b0", 3], ["#ffffff", 2]], spots: [["#fff2d8", 8]] },
  cool: { walls: "#7c827f", floor: "#4b4c4a", panels: [["#f1f7ff", 5], ["#dfe9f2", 3]], spots: [["#ffffff", 4]] },
  vault: { walls: "#120a14", floor: "#060508", panels: [["#6a5a80", 1.0]], spots: [["#fff4e0", 16], ["#cfd8ff", 4]] },
};
function moodScene(m: EnvMood): THREE.Scene {
  const s = new THREE.Scene(); const d = MOODS[m];
  const room = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 12), new THREE.MeshBasicMaterial({ color: d.walls, side: THREE.BackSide }));
  room.position.y = 3; s.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: d.floor })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; s.add(floor);
  d.panels.forEach(([c, k], i) => {
    for (let j = 0; j < 4; j++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide }));
      const a = (j / 4) * Math.PI * 2 + i * 0.7; p.position.set(Math.sin(a) * 5.9, 1.2 + i * 1.4, Math.cos(a) * 5.9); p.lookAt(0, p.position.y, 0); s.add(p);
    }
  });
  d.spots.forEach(([c, k], i) => {
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.9 - i * 0.2, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide }));
    p.rotation.x = Math.PI / 2; p.position.set(i * 2.5 - 1, 5.95, i * -1.5); s.add(p);
  });
  return s;
}
const envCache = new WeakMap<THREE.WebGLRenderer, Map<EnvMood, THREE.Texture>>();
/** Ambiente de cada clima, gerado uma vez por renderizador. */
export function envFor(gl: THREE.WebGLRenderer, m: EnvMood): THREE.Texture {
  let per = envCache.get(gl); if (!per) { per = new Map(); envCache.set(gl, per); }
  const hit = per.get(m); if (hit) return hit;
  const pm = new THREE.PMREMGenerator(gl); const sc = moodScene(m);
  const rt = pm.fromScene(sc, 0.03); pm.dispose();
  sc.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) { me.geometry.dispose(); (me.material as THREE.Material).dispose(); } });
  per.set(m, rt.texture); return rt.texture;
}
/** Intensidade do ambiente por clima (a luz difusa de fundo de cada sala). */
export const ENV_INTENSITY: Record<EnvMood, number> = { warm: 0.6, gallery: 0.42, backstage: 0.5, cool: 0.7, vault: 0.5 };
