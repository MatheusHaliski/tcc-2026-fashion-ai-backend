/*
 * MET Gala Heist v2 — beco (Z15): materiais próprios da área (criados uma vez por qualidade, chave "beco-…"). Os metais
 * pintados, plásticos e tintas usam cor por vértice: um material só para todas as peças da mesma natureza (latas,
 * contêineres, portas, botijões…), uma chamada de desenho para todas. Os decalques de parede leem o relevo do tijolo
 * pelo segundo UV (a pichação fica "dentro" das juntas); as poças são lisas e refletem a sonda da rua (exterior.tsx).
 */
import * as THREE from "three";
import { alleyAsphalt, alleyBrick, alleyConcrete, alleyPaintedConcrete, alleyPatch, alleySigns, buttTex, cardboardTex, fabricTex, groundDecals, manholeTex, meshAlpha, puddleAtlas, wallDecals, weedTex, windowInteriors, woodTex, type PbrSet, type Quality } from "./exterior-alley-tex";

const cache = new Map<string, unknown>();
function memo<T>(key: string, make: () => T): T { const k = `beco-${key}`; if (!cache.has(k)) cache.set(k, make()); return cache.get(k) as T; }

function pbrMat(set: PbrSet, o: THREE.MeshStandardMaterialParameters & { normal?: number } = {}): THREE.MeshStandardMaterial {
  const { normal = 1, ...rest } = o;
  return new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, normalScale: new THREE.Vector2(normal, normal), aoMap: set.orm, aoMapIntensity: 0.85, roughnessMap: set.orm, roughness: 1, metalness: 0, ...rest });
}
/** Cópia da textura lendo o segundo UV (uv1): o relevo do tijolo sob os decalques. */
function onUv1(t: THREE.Texture): THREE.Texture { const c = t.clone(); c.channel = 1; c.needsUpdate = true; return c; }

export interface AlleyMaterials {
  asphalt: THREE.MeshStandardMaterial; patch: THREE.MeshStandardMaterial; concrete: THREE.MeshStandardMaterial; brick: THREE.MeshStandardMaterial;
  paintedConcrete: THREE.MeshStandardMaterial; wallDecal: THREE.MeshStandardMaterial; groundDecal: THREE.MeshStandardMaterial; puddle: THREE.MeshStandardMaterial;
  /** tintas e metais pintados (cor por vértice): portas, contêineres, quadros, suportes */
  paint: THREE.MeshStandardMaterial; paintGloss: THREE.MeshStandardMaterial; plastic: THREE.MeshStandardMaterial; rusty: THREE.MeshStandardMaterial;
  galv: THREE.MeshStandardMaterial; iron: THREE.MeshStandardMaterial; rubber: THREE.MeshStandardMaterial; wood: THREE.MeshStandardMaterial; cardboard: THREE.MeshStandardMaterial;
  bag: THREE.MeshPhysicalMaterial; glassDark: THREE.MeshStandardMaterial; glassSheen: THREE.MeshStandardMaterial; glassLit: THREE.MeshStandardMaterial; frosted: THREE.MeshStandardMaterial;
  chain: THREE.MeshStandardMaterial; weld: THREE.MeshStandardMaterial; grate: THREE.MeshStandardMaterial; butt: THREE.MeshStandardMaterial; weed: THREE.MeshStandardMaterial;
  manhole: THREE.MeshStandardMaterial; signs: THREE.MeshStandardMaterial; signsLit: THREE.MeshStandardMaterial; fabric: THREE.MeshStandardMaterial;
  lampSodium: THREE.MeshStandardMaterial; lampWhite: THREE.MeshStandardMaterial; lampDead: THREE.MeshStandardMaterial; cable: THREE.MeshStandardMaterial;
}

export function alleyMaterials(q: Quality): AlleyMaterials {
  return memo(`mats:${q}`, () => {
    const brickSet = alleyBrick(q);
    const asphalt = pbrMat(alleyAsphalt(q), { normal: 1.0, envMapIntensity: 1.0 });
    const patch = pbrMat(alleyPatch(q), { normal: 0.8, envMapIntensity: 1.0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const concrete = pbrMat(alleyConcrete(q), { normal: 0.9, envMapIntensity: 0.8 });
    const brick = pbrMat(brickSet, { normal: 1.15, envMapIntensity: 0.35, color: new THREE.Color("#c4b6aa") });
    const paintedConcrete = pbrMat(alleyPaintedConcrete(q), { normal: 0.8, envMapIntensity: 0.4 });
    const wd = wallDecals(q), gd = groundDecals(q), pd = puddleAtlas(q), signs = alleySigns(q);
    const wallDecal = new THREE.MeshStandardMaterial({ map: wd.tex, transparent: true, depthWrite: false, roughness: 0.78, normalMap: onUv1(brickSet.normalMap), normalScale: new THREE.Vector2(1.1, 1.1), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, envMapIntensity: 0.3 });
    const groundDecal = new THREE.MeshStandardMaterial({ map: gd.tex, transparent: true, depthWrite: false, roughness: 0.82, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, envMapIntensity: 0.5 });
    // poça: água rasa quase espelho (o alfa vem da forma), com a película de óleo na cor
    const puddle = new THREE.MeshStandardMaterial({ map: pd.tex, color: new THREE.Color("#5d646c"), transparent: true, depthWrite: false, roughness: 0.05, metalness: 0.1, envMapIntensity: 0.85, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const vc = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
    const paint = vc({ roughness: 0.62, metalness: 0.25, envMapIntensity: 0.6 });
    const paintGloss = vc({ roughness: 0.32, metalness: 0.35, envMapIntensity: 0.9 });
    const plastic = vc({ roughness: 0.55, metalness: 0, envMapIntensity: 0.5 });
    const rusty = vc({ roughness: 0.85, metalness: 0.35, envMapIntensity: 0.35 });
    const galv = new THREE.MeshStandardMaterial({ color: "#9a9fa3", roughness: 0.48, metalness: 0.85, envMapIntensity: 0.8 });
    const iron = new THREE.MeshStandardMaterial({ color: "#191b1c", roughness: 0.62, metalness: 0.55, envMapIntensity: 0.6 });
    const rubber = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.9, envMapIntensity: 0.3 });
    const wood = vc({ map: woodTex(), roughness: 0.9, metalness: 0, envMapIntensity: 0.25 });
    const cardboard = vc({ map: cardboardTex(), roughness: 0.95, metalness: 0, envMapIntensity: 0.2 });
    const bag = new THREE.MeshPhysicalMaterial({ color: "#0c0d0f", roughness: 0.32, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 1.1 });
    const glassDark = new THREE.MeshStandardMaterial({ color: "#0b0f15", roughness: 0.08, metalness: 0.4, envMapIntensity: 1.5 });
    const glassSheen = new THREE.MeshStandardMaterial({ color: "#c8d4e0", roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 1.6 });
    const wi = windowInteriors(q);
    const glassLit = new THREE.MeshStandardMaterial({ color: "#1a140e", map: wi.tex, emissiveMap: wi.tex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 1.25, roughness: 0.12, metalness: 0.1 });
    const frosted = new THREE.MeshStandardMaterial({ color: "#2a2e2c", roughness: 0.45, metalness: 0.1, envMapIntensity: 0.8 });
    const meshMat = (k: "chain" | "weld" | "grate", color: string, rep: number) => { const t = meshAlpha(k).clone(); t.needsUpdate = true; t.repeat.set(rep, rep); return new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.8, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.7 }); };
    const chain = meshMat("chain", "#8d9296", 1 / 0.5), weld = meshMat("weld", "#a8acaf", 1 / 0.4), grate = meshMat("grate", "#1d1f20", 1 / 0.35);
    const butt = new THREE.MeshStandardMaterial({ map: buttTex(), roughness: 0.85 });
    const weed = new THREE.MeshStandardMaterial({ map: weedTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
    const mh = manholeTex();
    const manhole = new THREE.MeshStandardMaterial({ map: mh.map, normalMap: mh.normalMap, roughness: 0.55, metalness: 0.65, envMapIntensity: 0.9 });
    const signsMat = new THREE.MeshStandardMaterial({ map: signs.tex, roughness: 0.5, metalness: 0.05, envMapIntensity: 0.5, transparent: true, alphaTest: 0.02 });
    const signsLit = new THREE.MeshStandardMaterial({ map: signs.tex, emissiveMap: signs.tex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.55, roughness: 0.35, envMapIntensity: 0.5 });
    const fabric = vc({ map: fabricTex(), roughness: 0.92, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.2 });
    const lampSodium = new THREE.MeshStandardMaterial({ color: "#ffb35a", emissive: new THREE.Color("#ff9a3a"), emissiveIntensity: 5, roughness: 0.3 });
    const lampWhite = new THREE.MeshStandardMaterial({ color: "#eef4ff", emissive: new THREE.Color("#e8f0ff"), emissiveIntensity: 0, roughness: 0.25 });
    const lampDead = new THREE.MeshStandardMaterial({ color: "#d9e8d0", emissive: new THREE.Color("#c8f0d8"), emissiveIntensity: 2.2, roughness: 0.3 });
    const cable = new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.6, metalness: 0.1 });
    return {
      asphalt, patch, concrete, brick, paintedConcrete, wallDecal, groundDecal, puddle, paint, paintGloss, plastic, rusty, galv, iron, rubber, wood, cardboard, bag, glassDark, glassSheen, glassLit, frosted,
      chain, weld, grate, butt, weed, manhole, signs: signsMat, signsLit, fabric, lampSodium, lampWhite, lampDead, cable,
    };
  });
}
