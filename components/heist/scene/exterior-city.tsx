"use client";
/*
 * MET Gala Heist v2 — a cidade em volta: a fileira de prédios de apartamentos do outro lado da avenida (calcário pré-guerra,
 * tijolo e vidro, janelas acesas, marquises verdes de porteiro com luz quente), os quarteirões que continuam a fachada do
 * museu para os dois lados (o de tijolo é o do outro lado do beco), e o parque escuro lá embaixo, ao norte, que se vê do
 * beiral e do terraço (gramado, caminhos, árvores e postes do parque). Tudo fora da área jogável.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { SIDEWALK_Y } from "@/lib/heist/level";
import { boxGeo, inst, merge, worldUV } from "./exterior-geometry";
import type { ExteriorMaterials } from "./exterior-materials";
import { facadeTex, glowTex, leafTex, prng, type Quality } from "./exterior-textures";
import { Instanced } from "./exterior-facade";

type Style = "limestone" | "brick" | "modern";
interface Building { x0: number; x1: number; z0: number; z1: number; h: number; style: Style; face: "south" | "north" | "west" | "east" }

/** Prédios: do outro lado da avenida (fachada para o norte, z = 53), à direita do beco (fachada oeste em x = 30 e sul em z 24,5)
 * e depois da ponta oeste da fachada do museu. */
function buildings(): Building[] {
  const r = prng(31), out: Building[] = [];
  for (let x = -96; x < 96;) {
    const w = 14 + Math.floor(r() * 10), style: Style = r() < 0.45 ? "limestone" : r() < 0.7 ? "brick" : "modern";
    out.push({ x0: x, x1: x + w, z0: 53, z1: 72, h: 22 + Math.floor(r() * 5) * 3.2 + (style === "modern" ? 12 : 0), style, face: "north" });
    x += w + (r() < 0.25 ? 3 : 0.2);
  }
  // do outro lado do beco (tijolo): face oeste no beco e face sul na calçada da avenida
  out.push({ x0: 30, x1: 46, z0: -34, z1: 24.5, h: 18.2, style: "brick", face: "west" });
  for (let x = 46; x < 96;) { const w = 16 + Math.floor(r() * 8); out.push({ x0: x, x1: x + w, z0: -10, z1: 24.5, h: 24 + Math.floor(r() * 4) * 3.2, style: r() < 0.5 ? "limestone" : "brick", face: "south" }); x += w + 0.2; }
  for (let x = -96; x < -60;) { const w = 14 + Math.floor(r() * 8); out.push({ x0: x, x1: Math.min(-60, x + w), z0: -10, z1: 24.5, h: 26 + Math.floor(r() * 4) * 3.2, style: r() < 0.6 ? "limestone" : "modern", face: "south" }); x += w + 0.2; }
  return out;
}

/** Fachada com janelas (mapa + emissivo) na escala de 2,4 m por vão e 3,2 m por andar; base escura do térreo. */
function facadeMaterial(q: Quality, style: Style, seed: number): THREE.MeshStandardMaterial {
  const f = facadeTex(q, style, seed);
  const map = f.map.clone(), em = f.emissive.clone();
  for (const t of [map, em]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / (f.bays * f.bay), 1 / (f.floors * f.floor)); t.offset.set(0, 0.06); t.needsUpdate = true; }
  return new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 1.25, roughness: style === "modern" ? 0.35 : 0.8, metalness: style === "modern" ? 0.3 : 0, envMapIntensity: 0.6 });
}

export function HeistCity({ m, q }: { m: ExteriorMaterials; q: Quality }) {
  const data = useMemo(() => {
    const groups: Record<Style, THREE.BufferGeometry[]> = { limestone: [], brick: [], modern: [] };
    const awnings: THREE.Matrix4[] = [], doors: THREE.Matrix4[] = [], roofs: THREE.BufferGeometry[] = [];
    for (const b of buildings()) {
      groups[b.style].push(boxGeo(b.x0, SIDEWALK_Y, b.z0, b.x1, SIDEWALK_Y + b.h, b.z1));
      roofs.push(boxGeo(b.x0 + 0.4, SIDEWALK_Y + b.h, b.z0 + 0.4, b.x1 - 0.4, SIDEWALK_Y + b.h + 1.2, b.z1 - 0.4));          // casa de máquinas e caixa d'água
      if (b.face === "north") { const cx = (b.x0 + b.x1) / 2; awnings.push(inst(cx, SIDEWALK_Y, b.z0)); doors.push(inst(cx, SIDEWALK_Y, b.z0)); }
    }
    return { groups: { limestone: merge(groups.limestone), brick: merge(groups.brick), modern: merge(groups.modern) }, awnings, doors, roofs: merge(roofs) };
  }, []);
  const mats = useMemo(() => ({ limestone: facadeMaterial(q, "limestone", 101), brick: facadeMaterial(q, "brick", 102), modern: facadeMaterial(q, "modern", 103) }), [q]);
  // marquise de porteiro: lona verde-escura em armação de latão, com a luz quente embaixo e a porta de vidro do saguão
  const awning = useMemo(() => merge([boxGeo(-1.2, 2.6, -3.2, 1.2, 2.78, 0), boxGeo(-1.22, 2.3, -3.22, 1.22, 2.6, -3.0), boxGeo(-1.22, 2.3, -3.2, -1.0, 2.6, 0), boxGeo(1.0, 2.3, -3.2, 1.22, 2.6, 0)]), []);
  const awningMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#14301f", roughness: 0.85 }), []);
  const poles = useMemo(() => merge([-1.1, 1.1].map((x) => { const g = new THREE.CylinderGeometry(0.03, 0.03, 2.6, 8); g.translate(x, 1.3, -3.1); return worldUV(g); })), []);
  const lobby = useMemo(() => boxGeo(-1.0, 0, -0.06, 1.0, 2.5, -0.01), []);
  const lobbyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a1d10", emissive: new THREE.Color("#ffc887"), emissiveIntensity: 2.2, roughness: 0.2 }), []);
  return (
    <group>
      <mesh geometry={data.groups.limestone} material={mats.limestone} receiveShadow />
      <mesh geometry={data.groups.brick} material={mats.brick} receiveShadow />
      <mesh geometry={data.groups.modern} material={mats.modern} receiveShadow />
      <mesh geometry={data.roofs} material={m.roof} />
      <Instanced geometry={awning} material={awningMat} matrices={data.awnings} />
      <Instanced geometry={poles} material={m.brass} matrices={data.awnings} />
      <Instanced geometry={lobby} material={lobbyMat} matrices={data.doors} />
      <Park m={m} q={q} />
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
    return { cards, trunks: merge(trunks), lamps, path };
  }, [q]);
  const leafMat = useMemo(() => new THREE.MeshStandardMaterial({ map: leafTex(q, "dark"), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, color: new THREE.Color("#6f7d66") }), [q]);
  const leafGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const glow = useMemo(() => new THREE.SpriteMaterial({ map: glowTex("soft"), color: new THREE.Color("#ffd8a0"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, Y, -70]} material={m.grass} receiveShadow><planeGeometry args={[240, 94]} /></mesh>
      <mesh geometry={data.path} material={m.concrete} receiveShadow />
      <mesh geometry={data.trunks} material={m.bark} />
      <Instanced geometry={leafGeo} material={leafMat} matrices={data.cards} />
      {data.lamps.map((p, i) => (
        <group key={i} position={p.toArray()}>
          <mesh material={m.castIron} position={[0, -1.8, 0]}><cylinderGeometry args={[0.06, 0.09, 3.6, 8]} /></mesh>
          <mesh material={m.lampGlow}><sphereGeometry args={[0.18, 10, 8]} /></mesh>
          <sprite material={glow} scale={[2.6, 2.6, 1]} />
        </group>
      ))}
    </group>
  );
}
