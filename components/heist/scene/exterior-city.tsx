"use client";
/*
 * MET Gala Heist v2 — a cidade em volta: a quadra de prédios de verdade do outro lado da avenida e dos dois lados do museu
 * (térreos com lojas iluminadas — moda, joalheria, café, farmácia, padaria, floricultura, bistrô, livraria, ótica, galeria,
 * perfumaria, sapataria, portarias com marquise e uma loja fechada com cartazes —, andares com janelas em vão real, sacadas,
 * ar-condicionado, frisos, cornijas, caixas d'água e antenas), as ruas transversais que seguem para o sul, o skyline em
 * camadas (exterior-skyline.tsx) e o parque escuro ao norte, que se vê do beiral. A geometria é montada por
 * exterior-blocks.ts; aqui ela vira uma malha por material e uma instância por peça repetida (poucas chamadas de desenho).
 */
import { useMemo } from "react";
import * as THREE from "three";
import { boxGeo, merge } from "./exterior-geometry";
import type { ExteriorMaterials } from "./exterior-materials";
import { glowTex, leafTex, prng, stoneSet, type Quality } from "./exterior-textures";
import { gateTex, interiorAtlas, signAtlas, windowAtlas, flyerAtlas } from "./exterior-citytex";
import { PARTS, type CityKit } from "./exterior-blocks";
import { Instanced } from "./exterior-facade";
import { HeistSkyline, OnSkyLayer } from "./exterior-skyline";

/** Materiais da cidade por chave do kit (criados uma vez por qualidade). */
function cityMaterials(q: Quality, m: ExteriorMaterials): Record<string, THREE.Material> {
  const stoneCity = (tint: string, normal = 0.8) => { const s = stoneSet(q, "ashlar"); return new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, normalScale: new THREE.Vector2(normal, normal), roughnessMap: s.orm, roughness: 1, color: new THREE.Color(tint) }); };
  const plain = (tint: string, normal = 0.5) => { const s = stoneSet(q, "plain"); return new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, normalScale: new THREE.Vector2(normal, normal), roughnessMap: s.orm, roughness: 1, color: new THREE.Color(tint) }); };
  const win = windowAtlas(q), sign = signAtlas(q), gate = gateTex(q);
  const gateMap = gate.map.clone(), gateNormal = gate.normalMap.clone();
  for (const t of [gateMap, gateNormal]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 1.3, 1 / 1.3); t.needsUpdate = true; }
  const granite = m.granite.clone(); granite.color = new THREE.Color("#6a6c70");
  return {
    "wall:limestone": stoneCity("#c9bfae"), "wall:brick": m.brick, "wall:brickDark": m.brickBrown, "wall:stucco": plain("#d8cfbf"),
    "wall:concrete": plain("#8f9396", 0.4), "wall:castIron": new THREE.MeshStandardMaterial({ color: "#cfc8b6", roughness: 0.55, metalness: 0.25, normalMap: m.castIron.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) }),
    "wall:curtain": new THREE.MeshStandardMaterial({ color: "#1c2430", roughness: 0.2, metalness: 0.6 }),
    "wall:fascia": new THREE.MeshStandardMaterial({ color: "#16171a", roughness: 0.45, metalness: 0.3 }),
    "trim:stone": m.stone, "trim:paint": new THREE.MeshStandardMaterial({ color: "#e8e3d8", roughness: 0.45 }), "trim:dark": new THREE.MeshStandardMaterial({ color: "#1b1c1e", roughness: 0.38, metalness: 0.6 }),
    "trim:bronze": m.bronze, "trim:granite": granite, "trim:brass": m.brass, "trim:wood": new THREE.MeshStandardMaterial({ color: "#4e3220", roughness: 0.42 }), "trim:galv": m.galvanized,
    "trim:awning": new THREE.MeshStandardMaterial({ color: "#1a2a20", roughness: 0.9 }),
    roof: m.roof,
    win: new THREE.MeshStandardMaterial({ map: win.map, emissiveMap: win.emissive, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 1.0, roughness: 0.1, metalness: 0.05, envMapIntensity: 1.1 }),
    shopGlass: new THREE.MeshStandardMaterial({ color: "#0c1218", roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.2, depthWrite: false, envMapIntensity: 1.6 }),
    shopInt: new THREE.MeshBasicMaterial({ map: interiorAtlas(q), color: new THREE.Color(0.8, 0.77, 0.73) }),
    sign: new THREE.MeshStandardMaterial({ map: sign.map, emissiveMap: sign.glow, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 2.4, roughness: 0.5, side: THREE.DoubleSide }),
    gate: new THREE.MeshStandardMaterial({ map: gateMap, normalMap: gateNormal, roughness: 0.45, metalness: 0.7 }),
    poster: new THREE.MeshStandardMaterial({ map: flyerAtlas(q), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  };
}

/** Peças repetidas com cor por instância (vestidos, cadeiras). */
function TintedInstances({ geometry, material, matrices, colors, shadow = false }: { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[]; colors?: THREE.Color[]; shadow?: boolean }) {
  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(geometry, material, Math.max(1, matrices.length));
    matrices.forEach((x, i) => { im.setMatrixAt(i, x); if (colors?.[i]) im.setColorAt(i, colors[i]); });
    im.count = matrices.length; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere(); im.castShadow = shadow; im.receiveShadow = true; return im;
  }, [geometry, material, matrices, colors, shadow]);
  return <primitive object={mesh} />;
}

export function HeistCity({ m, q, kit }: { m: ExteriorMaterials; q: Quality; kit: CityKit }) {
  const merged = useMemo(() => kit.merged(), [kit]);
  const mats = useMemo(() => cityMaterials(q, m), [q, m]);
  const parts = useMemo(() => ({
    ac: PARTS.ac(), balconette: PARTS.balconette(), balconySlab: PARTS.balconySlab(), balconyRail: PARTS.balconyRail(), railTop: PARTS.railTop(),
    tank: PARTS.tank(), tankLegs: PARTS.tankLegs(), antenna: PARTS.antenna(), mannequin: PARTS.mannequin(), gown: PARTS.gown(), garment: PARTS.garment(), table: PARTS.table(), chair: PARTS.chair(),
  }), []);
  const partMats = useMemo(() => ({
    ac: new THREE.MeshStandardMaterial({ color: "#cbc5b8", roughness: 0.6, metalness: 0.2 }),
    balconette: mats["trim:dark"], balconySlab: mats["wall:concrete"],
    balconyRail: new THREE.MeshStandardMaterial({ color: "#5d7484", roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.32, depthWrite: false }),
    railTop: m.aluminium, tank: new THREE.MeshStandardMaterial({ color: "#5b4130", roughness: 0.92 }), tankLegs: mats["trim:dark"], antenna: mats["trim:dark"],
    mannequin: new THREE.MeshStandardMaterial({ color: "#efece6", roughness: 0.35, emissive: new THREE.Color("#fff4e6"), emissiveIntensity: 0.14 }),
    gown: new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0, envMapIntensity: 0.3, emissive: new THREE.Color("#2a2220"), emissiveIntensity: 1 }),
    garment: new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, envMapIntensity: 0.25, emissive: new THREE.Color("#1e1814"), emissiveIntensity: 1 }),
    table: new THREE.MeshStandardMaterial({ color: "#d9d4ca", roughness: 0.3, metalness: 0.1 }), chair: new THREE.MeshStandardMaterial({ roughness: 0.55 }),
  }), [mats, m]);
  const shadowKeys = new Set(["wall:limestone", "wall:brick", "wall:brickDark", "wall:stucco", "wall:concrete", "wall:castIron"]);
  return (
    <group>
      {[...merged.entries()].map(([k, g]) => <mesh key={k} geometry={g} material={mats[k] ?? m.concrete} castShadow={q === "high" && shadowKeys.has(k)} receiveShadow={!k.startsWith("shop") && k !== "win" && k !== "sign"} renderOrder={k === "shopGlass" ? 2 : 0} />)}
      {(Object.keys(parts) as (keyof typeof parts)[]).map((k) => {
        const mats4 = kit.inst.get(k); if (!mats4?.length) return null;
        return <TintedInstances key={k} geometry={parts[k]} material={partMats[k]} matrices={mats4} colors={kit.tint.get(k)} shadow={q === "high" && (k === "tank" || k === "ac")} />;
      })}
      <HeistSkyline q={q} />
      <OnSkyLayer><Park m={m} q={q} /></OnSkyLayer>
    </group>
  );
}

/** Parque ao norte, 10 m abaixo do beiral: gramado escuro, caminhos claros, árvores e postes de parque. */
function Park({ m, q }: { m: ExteriorMaterials; q: Quality }) {
  const Y = -10;
  const data = useMemo(() => {
    const r = prng(55), cards: THREE.Matrix4[] = [], trunks: THREE.BufferGeometry[] = [], lamps: THREE.Vector3[] = [];
    for (let k = 0; k < (q === "high" ? 46 : 22); k++) {
      const x = -90 + r() * 180, z = -30 - r() * 70;
      if (Math.abs(z + 40) < 2.5) continue;                                       // o caminho
      const t = new THREE.CylinderGeometry(0.15, 0.25, 4, 6); t.translate(x, Y + 2, z); trunks.push(t);
      for (let i = 0; i < (q === "high" ? 26 : 14); i++) { const u = r() * Math.PI * 2, v = r(); cards.push(new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(u) * 2.6 * v, Y + 5 + (r() - 0.3) * 2.6, z + Math.sin(u) * 2.6 * v), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)), new THREE.Vector3(2.2, 2.2, 2.2))); }
    }
    for (let x = -80; x <= 80; x += 16) lamps.push(new THREE.Vector3(x, Y + 3.6, -38.2));
    const path = boxGeo(-120, Y, -41.5, 120, Y + 0.02, -38.5);
    const posts = merge(lamps.map((p) => { const g = new THREE.CylinderGeometry(0.06, 0.09, 3.6, 8); g.translate(p.x, p.y - 1.8, p.z); return g; }));
    const heads = merge(lamps.map((p) => { const g = new THREE.SphereGeometry(0.18, 10, 8); g.translate(p.x, p.y, p.z); return g; }));
    return { cards, trunks: merge(trunks), lamps, path, posts, heads };
  }, [q]);
  const leafMat = useMemo(() => new THREE.MeshStandardMaterial({ map: leafTex(q, "dark"), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, color: new THREE.Color("#6f7d66") }), [q]);
  const leafGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const glow = useMemo(() => new THREE.SpriteMaterial({ map: glowTex("soft"), color: new THREE.Color("#ffd8a0"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, Y, -70]} material={m.grass} receiveShadow><planeGeometry args={[240, 94]} /></mesh>
      <mesh geometry={data.path} material={m.concrete} receiveShadow />
      <mesh geometry={data.trunks} material={m.bark} />
      <mesh geometry={data.posts} material={m.castIron} />
      <mesh geometry={data.heads} material={m.lampGlow} />
      <Instanced geometry={leafGeo} material={leafMat} matrices={data.cards} />
      {data.lamps.map((p, i) => <sprite key={i} material={glow} position={p.toArray()} scale={[2.6, 2.6, 1]} />)}
    </group>
  );
}
