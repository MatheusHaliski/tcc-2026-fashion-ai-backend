"use client";
/*
 * MET Gala Heist v2 — mobiliário da avenida. Com colisão (móveis "fixture" da rua em baseProps(), desenhados aqui pelo
 * `model`): o ponto de ônibus com abrigo (vidro, banco, painel de anúncio aceso, mapa da linha e a placa), a banca de
 * jornal, as lixeiras de aço, os parquímetros, o paraciclo com as bicicletas presas, as caixas de jornal, a placa de
 * proibido estacionar e os móveis únicos da entrada da gala (Z01): bancos esculpidos em granito com a inscrição, vasos
 * monumentais de pedra com buxo e a luz embutida, o painel de fotos com a treliça de alumínio e os refletores em tripé e o
 * balcão do manobrista com o quadro de chaves e o porta-guarda-chuvas. Sem colisão (fora da área andável): os semáforos
 * das esquinas com braço sobre a avenida, o armário do controlador cheio de lambe-lambe e as placas com o nome das ruas.
 *
 * Tudo é montado em coordenadas locais (frente para +z, chão em y = 0), levado ao mundo pelo móvel e fundido por material.
 *
 * Montagem: exterior-furniture-parts; modelos: exterior-furniture-street, exterior-furniture-gala e
 * exterior-furniture-signals; texturas por hook: use-furniture-textures.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { floorY, SIDEWALK_Y } from "@/lib/heist/level";
import { hasModel } from "@/lib/heist/models";
import type { Prop } from "@/lib/heist/types";
import { merge } from "./exterior-geometry";
import type { ExteriorMaterials } from "./exterior-materials";
import { leafTex, prng, type Quality } from "./exterior-textures";
import { flyerAtlas, interiorAtlas, stepRepeatTex } from "./exterior-citytex";
import { GlowField, type GlowSpec } from "./exterior-glow";
import { type Anchor, CROSS, type Pool } from "./exterior-blocks";
import { type Parts, T } from "./exterior-furniture-parts";
import { bikeRack, bin, busShelter, busStopSign, meter, newsBoxes, newsstand, noParking } from "./exterior-furniture-street";
import { lightStand, stepRepeat, stoneBench, totem, urn, valetStand } from "./exterior-furniture-gala";
import { cabinet, signal } from "./exterior-furniture-signals";
import { useTextures } from "./use-furniture-textures";

/** Luz e brilho próprios do mobiliário (âncoras para a luz de verdade, halos e poças). */
export function furnitureLights(props: Prop[]): { anchors: Anchor[]; glows: GlowSpec[]; pools: Pool[] } {
  const anchors: Anchor[] = [], glows: GlowSpec[] = [], pools: Pool[] = [];
  for (const p of props) {
    if (p.kind !== "fixture") continue;
    const c = p.shape.type === "box" ? { x: (p.shape.x0 + p.shape.x1) / 2, z: (p.shape.z0 + p.shape.z1) / 2 } : { x: p.shape.x, z: p.shape.z }, y = floorY(c), yaw = p.yaw ?? 0;
    const fwd = (d: number, h: number) => new THREE.Vector3(c.x + Math.sin(yaw) * d, y + h, c.z + Math.cos(yaw) * d);
    if (p.model === "busShelter") { anchors.push({ pos: fwd(0.7, 2.2), color: "#eef4ff", i: 14 }); glows.push({ pos: fwd(1.45, 2.4), size: 2.6, color: "#e8f0ff", strength: 0.45 }); pools.push({ pos: fwd(0.9, 0), rx: 2.4, rz: 1.6, color: "#e8f0ff", s: 0.16, rot: yaw }); }
    if (p.model === "newsstand") { anchors.push({ pos: fwd(1.2, 1.9), color: "#fff0d0", i: 12 }); pools.push({ pos: fwd(1.5, 0), rx: 1.8, rz: 1.4, color: "#ffe2b0", s: 0.16, rot: yaw }); }
    if (p.model === "monumentalVase") glows.push({ pos: new THREE.Vector3(c.x + 0.62, y + 0.05, c.z + 0.35), size: 0.6, color: "#ffd9a0", strength: 0.7 });
    if (p.model === "stepRepeat") anchors.push({ pos: fwd(2.4, 2.3), color: "#f4f6ff", i: 20 });
  }
  return { anchors, glows, pools };
}

export function HeistFurniture({ props, m, q }: { props: Prop[]; m: ExteriorMaterials; q: Quality }) {
  const tex = useTextures(q);
  const data = useMemo(() => {
    const P: Parts = new Map(), leaves: THREE.Matrix4[] = [], glows: GlowSpec[] = [], r = prng(707);
    for (const p of props) {
      if (p.kind !== "fixture" || !p.model || hasModel(p.model)) continue;      // com modelo gerado: HeistModels carrega o GLB
      const c = p.shape.type === "box" ? { x: (p.shape.x0 + p.shape.x1) / 2, z: (p.shape.z0 + p.shape.z1) / 2 } : { x: p.shape.x, z: p.shape.z };
      const M = T(c.x, floorY(c), c.z, p.yaw ?? 0);
      switch (p.model) {
        case "busShelter": busShelter(P, M); break;
        case "busStopSign": busStopSign(P, M); break;
        case "newsstand": newsstand(P, M, r); break;
        case "bin": bin(P, M); break;
        case "meter": meter(P, M); break;
        case "bikeRack": bikeRack(P, M); break;
        case "newsBox": newsBoxes(P, M); break;
        case "noParking": noParking(P, M); break;
        case "stoneBench": stoneBench(P, M); break;
        case "monumentalVase": urn(P, M, leaves, r); break;
        case "stepRepeat": stepRepeat(P, M); break;
        case "lightStand": lightStand(P, M); break;
        case "valetStand": valetStand(P, M); break;
        default: break;                                                            // peças só de colisão (lateral do abrigo, banco)
      }
    }
    // totens acesos no portão do tapete (dentro dos cordões: sem colisão nova)
    for (const x of [-1.95, 1.95]) totem(P, T(x, floorY({ x, z: 31.25 }), 31.25, 0));
    // semáforos das esquinas (braço sobre a avenida) e o armário do controlador
    signal(P, CROSS[0].walk1 - 0.6, 43.7, 0, Math.PI / 2, 7.5, glows);              // braço para o norte, luzes para o leste (para a rua)
    signal(P, CROSS[1].walk0 + 0.6, 43.7, 0, -Math.PI / 2, 7.5, glows);
    signal(P, CROSS[0].road0 - 1.2, 32.6, Math.PI, Math.PI / 2, 4.5, glows);
    cabinet(P, T(CROSS[0].walk1 - 1.1, SIDEWALK_Y, 45.2, Math.PI / 2), r);
    const merged = new Map<string, THREE.BufferGeometry>(); for (const [k, l] of P) merged.set(k, merge(l));
    return { merged, leaves, glows };
  }, [props]);
  const mats = useMemo<Record<string, THREE.Material>>(() => {
    const em = (c: string, i: number) => new THREE.MeshStandardMaterial({ color: "#111111", emissive: new THREE.Color(c), emissiveIntensity: i, roughness: 0.4 });
    const pic = (t: THREE.Texture, glow = 0, rough = 0.6) => new THREE.MeshStandardMaterial({ map: t, emissiveMap: glow ? t : null, emissive: new THREE.Color(glow ? "#ffffff" : "#000000"), emissiveIntensity: glow, roughness: rough });
    const step = stepRepeatTex(q).clone(); step.repeat.set(1, 1); step.needsUpdate = true;
    return {
      steel: new THREE.MeshStandardMaterial({ color: "#3b4046", roughness: 0.38, metalness: 0.75 }), alu: m.aluminium, routeMap: pic(tex.routeMap, 0.55, 0.3), glass: new THREE.MeshStandardMaterial({ color: "#9fb4c0", roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false, envMapIntensity: 1.4 }),
      frost: new THREE.MeshStandardMaterial({ color: "#e8eef2", roughness: 0.6, transparent: true, opacity: 0.55 }), led: em("#eef4ff", 4), wood: new THREE.MeshStandardMaterial({ color: "#6a4a30", roughness: 0.55 }),
      ad: pic(tex.ad, 0.9, 0.3), busSign: pic(tex.busSign, 0.25), kiosk: new THREE.MeshStandardMaterial({ color: "#1f3d2c", roughness: 0.55, metalness: 0.4 }), kioskSign: pic(tex.kioskSign, 0.6, 0.4),
      inside: new THREE.MeshBasicMaterial({ map: interiorAtlas(q) }), poster: new THREE.MeshStandardMaterial({ map: flyerAtlas(q), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }),
      binBody: new THREE.MeshStandardMaterial({ color: "#21302a", roughness: 0.5, metalness: 0.55 }), bag: new THREE.MeshStandardMaterial({ color: "#0b0b0c", roughness: 0.35 }),
      paintBlue: new THREE.MeshStandardMaterial({ color: "#1d4f9a", roughness: 0.45, metalness: 0.3 }),
      paintRed: new THREE.MeshStandardMaterial({ color: "#a3161d", roughness: 0.45, metalness: 0.3 }), paintBlack: new THREE.MeshStandardMaterial({ color: "#151617", roughness: 0.45, metalness: 0.5 }),
      tire: m.rubber, bikeFrame: new THREE.MeshStandardMaterial({ color: "#2f6a8a", roughness: 0.35, metalness: 0.5 }), parkSign: pic(tex.parkSign, 0.05),
      granite: m.granite, inscription: new THREE.MeshStandardMaterial({ map: tex.inscription, transparent: true, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }),
      stone: m.stone, soil: m.soil, brass: m.brass, totemFace: pic(tex.totem, 0.9, 0.3), step: new THREE.MeshStandardMaterial({ map: step, roughness: 0.75 }),
      carpetPatch: m.carpet, lacquer: new THREE.MeshPhysicalMaterial({ color: "#060606", roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
      valetSign: pic(tex.valetSign, 0.35, 0.4),
      sigRed: em("#ff2418", 5), sigOff: new THREE.MeshStandardMaterial({ color: "#1a1410", roughness: 0.2 }), streetSign: pic(tex.street, 0.12, 0.45),
      cabinet: new THREE.MeshStandardMaterial({ color: "#8a9096", roughness: 0.5, metalness: 0.5 }),
    };
  }, [q, m, tex]);
  const leafMat = useMemo(() => new THREE.MeshStandardMaterial({ map: leafTex(q, "dark"), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: new THREE.Color("#7f9466") }), [q]);
  const leafGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const leafMesh = useMemo(() => {
    const im = new THREE.InstancedMesh(leafGeo, leafMat, Math.max(1, data.leaves.length));
    data.leaves.forEach((x, i) => im.setMatrixAt(i, x)); im.count = data.leaves.length; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; return im;
  }, [data, leafGeo, leafMat]);
  const castKeys = new Set(["steel", "kiosk", "binBody", "granite", "stone", "lacquer", "alu", "paintBlack", "wood", "paintRed", "paintBlue"]);
  return (
    <group>
      {[...data.merged.entries()].map(([k, g]) => <mesh key={k} geometry={g} material={mats[k] ?? m.galvanized} castShadow={q === "high" && castKeys.has(k)} receiveShadow renderOrder={k === "glass" || k === "frost" ? 2 : 0} />)}
      <primitive object={leafMesh} />
      <GlowField items={data.glows} />
    </group>
  );
}
