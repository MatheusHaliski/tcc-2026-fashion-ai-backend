"use client";
/*
 * MET Gala Heist v2 — o chão e o mobiliário da avenida na noite da gala: calçadas de placas, meio-fio de granito, pista
 * molhada com faixas e a faixa de pedestres, a escadaria de 12 degraus com o tapete da gala subindo do meio-fio até as
 * portas, a rampa da doca, as arquibancadas dos fotógrafos e da imprensa (câmeras de TV, painéis de luz), os cordões de
 * veludo com pedestais de latão (tapete e fila), o pódio da recepção, os arranjos florais, as grades azuis dos fãs, os
 * bloqueios "VIA INTERDITADA" nas pontas da avenida, os postes de ferro fundido, as árvores, o hidrante, a barraca do
 * revendedor e a sinalização do que é público e do que é restrito.
 *
 * Tudo que tem colisão segue baseProps() (lib/heist/level.ts): cada peça é desenhada na caixa/círculo dela. O que não
 * tem colisão fica onde ninguém anda (cercados, fachadas, fora da área jogável).
 *
 * Medidas e pistas: exterior-street-layout; geometria por hook: use-street-ground, use-street-platforms e
 * use-street-furniture; peças únicas: exterior-street-decor e exterior-street-signs.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { CIVILIANS, floorY } from "@/lib/heist/level";
import type { ExteriorMaterials } from "./exterior-materials";
import { leafTex, type Quality } from "./exterior-textures";
import { Instanced } from "./exterior-facade";
import { streetProps } from "./exterior-street-layout";
import { useGround, useStairs } from "./use-street-ground";
import { useDockRamp, useRisers } from "./use-street-platforms";
import { useBarriers, useLamps, useRopes, useTrees } from "./use-street-furniture";
import { Florals, Podium, VendorStand } from "./exterior-street-decor";
import { FanSigns, Hydrant, Signage } from "./exterior-street-signs";
export { crossRoadGeometry, roadGeometry, streetLights, streetProps, X_FAR } from "./exterior-street-layout";

/* ---------- carros parados não ficam aqui (exterior-vehicles.tsx) ---------- */

export function HeistStreet({ q, m }: { q: Quality; m: ExteriorMaterials }) {
  const props = useMemo(streetProps, []);
  const paint = useMemo(() => ({
    yellow: new THREE.MeshStandardMaterial({ color: "#c9961c", roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    white: new THREE.MeshStandardMaterial({ color: "#d9d6cc", roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    hazard: new THREE.MeshStandardMaterial({ color: "#e8b81c", roughness: 0.6 }),
  }), []);
  const ground = useGround(), stairs = useStairs(), ramp = useDockRamp(), risers = useRisers(), ropes = useRopes(props), barriers = useBarriers(props), lamps = useLamps(props), trees = useTrees(props, q);
  const ironMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1c1c1c", roughness: 0.4, metalness: 0.8 }), []);
  const ledPanel = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: new THREE.Color("#f4f6ff"), emissiveIntensity: 3.2 }), []);
  const ledLens = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: new THREE.Color("#e4ecff"), emissiveIntensity: 6 }), []);
  const floodLens = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: new THREE.Color("#ffc890"), emissiveIntensity: 2.2 }), []);
  const blueBarrier = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2f5f9b", roughness: 0.45, metalness: 0.6, normalMap: m.galvanized.normalMap, normalScale: new THREE.Vector2(0.2, 0.2) }), [m]);
  const sawMat = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 128; c.height = 32; const g = c.getContext("2d")!;
    for (let k = -2; k < 12; k++) { g.fillStyle = k % 2 ? "#f2f2f2" : "#e05a12"; g.beginPath(); g.moveTo(k * 16, 0); g.lineTo(k * 16 + 16, 0); g.lineTo(k * 16 + 32, 32); g.lineTo(k * 16 + 16, 32); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(1 / 2.4, 1 / 0.3);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
  }, []);
  const leafMat = useMemo(() => new THREE.MeshStandardMaterial({ map: leafTex(q, "green"), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, color: new THREE.Color("#c9d8b8") }), [q]);
  const leafGeo = useMemo(() => new THREE.PlaneGeometry(0.9, 0.9), []);
  return (
    <group>
      {/* chão */}
      <mesh geometry={ground.sidewalk} material={m.sidewalk} receiveShadow />
      <mesh geometry={ground.curb} material={m.granite} receiveShadow />
      <mesh geometry={ground.yellow} material={paint.yellow} receiveShadow />
      <mesh geometry={ground.white} material={paint.white} receiveShadow />
      <mesh geometry={ground.iron} material={ironMat} receiveShadow />
      {/* escadaria, tapete e rampa */}
      <mesh geometry={stairs.steps} material={m.stone} receiveShadow castShadow />
      <mesh geometry={stairs.nosing} material={m.stone} receiveShadow />
      <mesh geometry={stairs.carpet} material={m.carpet} receiveShadow />
      <mesh geometry={ramp.concrete} material={m.concrete} receiveShadow castShadow />
      <mesh geometry={ramp.rail} material={m.galvanized} castShadow />
      <mesh geometry={ramp.stripes} material={paint.hazard} />
      {/* arquibancadas */}
      <mesh geometry={risers.deck} material={m.plywood} receiveShadow castShadow />
      <mesh geometry={risers.skirt} material={m.blackFabric} receiveShadow />
      <mesh geometry={risers.rail} material={m.blackMetal} castShadow />
      <mesh geometry={risers.gear} material={m.blackMetal} castShadow />
      <mesh geometry={risers.panels} material={ledPanel} />
      <mesh geometry={risers.flood} material={m.blackMetal} castShadow />
      <mesh geometry={risers.lens} material={floodLens} />
      {/* cordões de veludo */}
      <Instanced geometry={ropes.post} material={m.brass} matrices={ropes.posts} shadow />
      <mesh geometry={ropes.ropes} material={m.velvet} castShadow />
      {/* grades dos fãs e os cavaletes das pontas */}
      <Instanced geometry={barriers.section} material={blueBarrier} matrices={barriers.sections} shadow />
      <Instanced geometry={barriers.sawGeo} material={sawMat} matrices={barriers.saw} />
      <Instanced geometry={barriers.sawLegs} material={m.whitePaint} matrices={barriers.saw} />
      {/* postes */}
      <Instanced geometry={lamps.iron} material={m.castIron} matrices={lamps.posts} shadow />
      <Instanced geometry={lamps.glass} material={m.glassFrosted} matrices={lamps.posts} />
      <Instanced geometry={lamps.steel} material={m.galvanized} matrices={lamps.leds} shadow />
      <Instanced geometry={lamps.lens} material={ledLens} matrices={lamps.leds} />
      {/* árvores */}
      <mesh geometry={trees.trunks} material={m.bark} castShadow />
      <mesh geometry={trees.grates} material={m.castIron} receiveShadow />
      <Instanced geometry={leafGeo} material={leafMat} matrices={trees.cards} shadow />
      <Podium m={m} />
      <Florals m={m} q={q} />
      <VendorStand m={m} q={q} />
      <Signage m={m} />
      <FanSigns />
      <Hydrant m={m} x={-10.5} z={43.9} />
    </group>
  );
}

/** Posições de quem fotografa (para os flashes) e onde estão as luzes do chão. */
export const PAPARAZZI = CIVILIANS.filter((c) => c.role === "paparazzo").map((c) => ({ x: c.pos.x, y: (c.y ?? floorY(c.pos)) + 1.62, z: c.pos.z, yaw: c.yaw }));
