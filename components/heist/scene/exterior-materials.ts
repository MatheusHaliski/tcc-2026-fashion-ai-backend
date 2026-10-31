/*
 * MET Gala Heist v2 — materiais da cena externa (PBR do three.js), criados uma vez por qualidade e compartilhados por todas
 * as peças: cantaria, granito, asfalto e calçada molhados (recebem o reflexo da própria rua depois de prontos — ver
 * streetProbe em exterior.tsx), tapete, metais (latão dos pedestais, ferro fundido dos postes, aço galvanizado das
 * grades, cromo), pintura de carro com verniz, vidros e luzes.
 */
import * as THREE from "three";
import { asphaltSet, brickSet, carpetSet, grainNormal, graniteSet, sidewalkSet, stoneSet, type PbrSet, type Quality } from "./exterior-textures";

const cache = new Map<string, unknown>();
function memo<T>(key: string, make: () => T): T { if (!cache.has(key)) cache.set(key, make()); return cache.get(key) as T; }

function pbrMat(set: PbrSet, o: THREE.MeshStandardMaterialParameters & { normal?: number } = {}): THREE.MeshStandardMaterial {
  const { normal = 1, ...rest } = o;
  return new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, normalScale: new THREE.Vector2(normal, normal), aoMap: set.orm, aoMapIntensity: 0.9, roughnessMap: set.orm, roughness: 1, metalness: 0, ...rest });
}

export interface ExteriorMaterials {
  ashlar: THREE.MeshStandardMaterial; rustic: THREE.MeshStandardMaterial; stone: THREE.MeshStandardMaterial; stoneDouble: THREE.MeshStandardMaterial; roughStone: THREE.MeshStandardMaterial;
  granite: THREE.MeshStandardMaterial; asphalt: THREE.MeshStandardMaterial; asphaltOld: THREE.MeshStandardMaterial; sidewalk: THREE.MeshStandardMaterial; carpet: THREE.MeshStandardMaterial;
  brick: THREE.MeshStandardMaterial; brickBrown: THREE.MeshStandardMaterial; concrete: THREE.MeshStandardMaterial;
  castIron: THREE.MeshStandardMaterial; brass: THREE.MeshStandardMaterial; bronze: THREE.MeshStandardMaterial; chrome: THREE.MeshStandardMaterial; galvanized: THREE.MeshStandardMaterial;
  blackMetal: THREE.MeshStandardMaterial; aluminium: THREE.MeshStandardMaterial; plywood: THREE.MeshStandardMaterial; blackFabric: THREE.MeshStandardMaterial; velvet: THREE.MeshPhysicalMaterial;
  carPaint: THREE.MeshPhysicalMaterial; carGlass: THREE.MeshPhysicalMaterial; rubber: THREE.MeshStandardMaterial; whitePaint: THREE.MeshStandardMaterial; navyPaint: THREE.MeshPhysicalMaterial;
  glassDark: THREE.MeshStandardMaterial; glassWarm: THREE.MeshStandardMaterial; glassFrosted: THREE.MeshStandardMaterial; lampGlow: THREE.MeshStandardMaterial; tailLight: THREE.MeshStandardMaterial;
  headLight: THREE.MeshStandardMaterial; roof: THREE.MeshStandardMaterial; roadPaint: THREE.MeshStandardMaterial; dumpster: THREE.MeshStandardMaterial; greenPaint: THREE.MeshStandardMaterial;
  canvasStripe: THREE.MeshStandardMaterial; soil: THREE.MeshStandardMaterial; grass: THREE.MeshStandardMaterial; bark: THREE.MeshStandardMaterial; flower: THREE.MeshStandardMaterial;
  ledScreen: THREE.MeshStandardMaterial;
  /** superfícies que recebem o reflexo capturado da própria rua (asfalto, calçada, carros, vidros) */
  wet: (THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial)[];
}

export function exteriorMaterials(q: Quality): ExteriorMaterials {
  return memo(`mats:${q}`, () => {
    const grain = grainNormal(q);
    const stoneTint = new THREE.Color("#d2ccc2");
    const ashlar = pbrMat(stoneSet(q, "ashlar"), { normal: 0.9, color: stoneTint, envMapIntensity: 0.5 });
    const rustic = pbrMat(stoneSet(q, "rustic"), { normal: 1.1, color: stoneTint, envMapIntensity: 0.5 });
    const stone = pbrMat(stoneSet(q, "plain"), { normal: 0.8, color: stoneTint, envMapIntensity: 0.5 });
    const stoneDouble = stone.clone(); stoneDouble.side = THREE.DoubleSide;
    const roughStone = pbrMat(stoneSet(q, "plain"), { normal: 2.2, color: new THREE.Color("#b9b0a1"), envMapIntensity: 0.4 });
    const granite = pbrMat(graniteSet(q), { normal: 0.6, envMapIntensity: 0.8 });
    const asphalt = pbrMat(asphaltSet(q), { normal: 0.7, envMapIntensity: 1.25 });
    const asphaltOld = pbrMat(asphaltSet(q), { normal: 0.9, color: new THREE.Color("#b7b0a6"), envMapIntensity: 1.1 });
    const sidewalk = pbrMat(sidewalkSet(q), { normal: 0.8, color: new THREE.Color("#c4bfb8"), roughness: 0.82, envMapIntensity: 1 });   // molhada: mais escura e mais lisa
    const carpet = pbrMat(carpetSet(q), { normal: 0.7, envMapIntensity: 0.25 });
    const brick = pbrMat(brickSet(q, "red"), { normal: 1, envMapIntensity: 0.4 });
    const brickBrown = pbrMat(brickSet(q, "brown"), { normal: 1, envMapIntensity: 0.4 });
    const concrete = pbrMat(sidewalkSet(q), { normal: 0.6, color: new THREE.Color("#8f8a82"), roughness: 0.85, envMapIntensity: 0.7 });
    const metal = (color: string, roughness: number, metalness: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, normalMap: grain, normalScale: new THREE.Vector2(0.25, 0.25), ...extra });
    const castIron = metal("#1b1f1c", 0.55, 0.55);
    const brass = metal("#c9a05a", 0.24, 1);
    const bronze = metal("#5a4126", 0.38, 0.9);
    const chrome = metal("#f2f2f2", 0.06, 1, { normalScale: new THREE.Vector2(0.02, 0.02) });
    const galvanized = metal("#a9adb0", 0.42, 0.85);
    const blackMetal = metal("#141414", 0.5, 0.6);
    const aluminium = metal("#c4c7ca", 0.35, 0.9);
    const plywood = new THREE.MeshStandardMaterial({ color: "#2a2622", roughness: 0.85 });
    const blackFabric = new THREE.MeshStandardMaterial({ color: "#0d0d0f", roughness: 0.95, side: THREE.DoubleSide });
    const velvet = new THREE.MeshPhysicalMaterial({ color: "#5c0a18", roughness: 0.8, sheen: 1, sheenColor: new THREE.Color("#ff6a7a"), sheenRoughness: 0.4 });
    const carPaint = new THREE.MeshPhysicalMaterial({ color: "#07080a", metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.035, envMapIntensity: 1.4 });
    const navyPaint = new THREE.MeshPhysicalMaterial({ color: "#14234a", metalness: 0.4, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 });
    const carGlass = new THREE.MeshPhysicalMaterial({ color: "#05070a", metalness: 0.1, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.95 });
    const rubber = new THREE.MeshStandardMaterial({ color: "#121212", roughness: 0.88 });
    const whitePaint = new THREE.MeshStandardMaterial({ color: "#efece6", roughness: 0.45, metalness: 0.05 });
    const glassDark = new THREE.MeshStandardMaterial({ color: "#0c1118", roughness: 0.06, metalness: 0.3, envMapIntensity: 1.6 });
    const glassWarm = new THREE.MeshStandardMaterial({ color: "#3a2a18", emissive: new THREE.Color("#ffbd72"), emissiveIntensity: 1.15, roughness: 0.15, metalness: 0.1 });
    const glassFrosted = new THREE.MeshStandardMaterial({ color: "#2b2117", emissive: new THREE.Color("#ffcf8f"), emissiveIntensity: 2.4, roughness: 0.4 });
    const lampGlow = new THREE.MeshStandardMaterial({ color: "#fff1d6", emissive: new THREE.Color("#ffd49a"), emissiveIntensity: 6, roughness: 0.3, toneMapped: true });
    const tailLight = new THREE.MeshStandardMaterial({ color: "#3a0000", emissive: new THREE.Color("#ff1a1a"), emissiveIntensity: 3, roughness: 0.3 });
    const headLight = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: new THREE.Color("#fff6e8"), emissiveIntensity: 7, roughness: 0.2 });
    const roof = new THREE.MeshStandardMaterial({ color: "#2c2b2a", roughness: 0.9 });
    const roadPaint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const dumpster = metal("#1f4a3a", 0.6, 0.4);
    const greenPaint = metal("#1d3b2a", 0.5, 0.3);
    const canvasStripe = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, side: THREE.DoubleSide });
    const soil = new THREE.MeshStandardMaterial({ color: "#1d1712", roughness: 1 });
    const grass = new THREE.MeshStandardMaterial({ color: "#16241a", roughness: 1 });
    const bark = new THREE.MeshStandardMaterial({ color: "#3a3028", roughness: 0.95, normalMap: grain, normalScale: new THREE.Vector2(1.5, 1.5) });
    const flower = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.62, metalness: 0 });
    const ledScreen = new THREE.MeshStandardMaterial({ color: "#111111", emissive: new THREE.Color("#f3f6ff"), emissiveIntensity: 5, roughness: 0.4 });
    const wet = [asphalt, asphaltOld, sidewalk, concrete, granite, carPaint, navyPaint, carGlass, glassDark, chrome];
    return {
      ashlar, rustic, stone, stoneDouble, roughStone, granite, asphalt, asphaltOld, sidewalk, carpet, brick, brickBrown, concrete, castIron, brass, bronze, chrome, galvanized, blackMetal,
      aluminium, plywood, blackFabric, velvet, carPaint, carGlass, rubber, whitePaint, navyPaint, glassDark, glassWarm, glassFrosted, lampGlow, tailLight, headLight, roof, roadPaint,
      dumpster, greenPaint, canvasStripe, soil, grass, bark, flower, ledScreen, wet,
    };
  });
}
