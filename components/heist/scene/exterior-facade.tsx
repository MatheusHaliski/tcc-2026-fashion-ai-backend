"use client";
/*
 * MET Gala Heist v2 — a pele de fora do Museu Vesper: fachada Beaux-Arts da avenida (pavilhão central com três arcos entre
 * quatro pares de colunas coríntias sobre pedestais altos, entablamento que avança sobre cada par, os blocos de pedra
 * brutos em cima dos pares — esculturas que nunca foram feitas —, ático com friso de guirlandas e cornija), as alas com
 * janelas de frontão, os banners da exposição, as portas de bronze e vidro (`front`) e o portão de enrolar da doca
 * (`dockGate`), a face leste do beco (com a porta da escada de incêndio), a face norte sobre o beiral (com as janelas
 * windowT/windowC), o pátio-jardim a céu aberto visto de dentro acima de 5 m e os telhados.
 *
 * Divisa com o interior: tudo aqui fica do lado de fora do plano das paredes (z ≥ 24,05 na fachada sul, x ≤ 22,5 no
 * leste…); os vãos de porta e janela são abertos (as folhas internas são do interior), exceto as da fachada.
 *
 * Medidas: exterior-facade-dims; geometria por hook: use-facade-geometry e use-facade-windows; banners e vãos:
 * exterior-facade-banners e exterior-facade-doors.
 */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { SceneView } from "@/lib/heist/view";
import { exteriorMaterials } from "./exterior-materials";
import { inscriptionTex, plaqueTex, type Quality, SIGNAGE } from "./exterior-textures";
import { FACADE_Z, Y_CAP, Y_FRIEZE, Y_PED } from "./exterior-facade-dims";
import { useFacadeGeometry } from "./use-facade-geometry";
import { useWindows } from "./use-facade-windows";
import { Banners } from "./exterior-facade-banners";
import { ArchGlazing, DockGate, FireDoorFrame, FrontDoors } from "./exterior-facade-doors";
export { FACADE_Z } from "./exterior-facade-dims";

export function Instanced({ geometry, material, matrices, shadow = false }: { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[]; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mesh = useMemo(() => { const m = new THREE.InstancedMesh(geometry, material, Math.max(1, matrices.length)); matrices.forEach((x, i) => m.setMatrixAt(i, x)); m.count = matrices.length; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); m.castShadow = shadow; m.receiveShadow = true; return m; }, [geometry, material, matrices, shadow]);
  return <primitive ref={ref} object={mesh} />;
}

export function HeistFacade({ q, view }: { q: Quality; view: React.MutableRefObject<SceneView> }) {
  const m = exteriorMaterials(q);
  const g = useFacadeGeometry(q);
  const w = useWindows();
  const inscription = useMemo(() => new THREE.MeshStandardMaterial({ map: inscriptionTex(q, SIGNAGE.museum), transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), [q]);
  const plaques = useMemo(() => ({ museum: plaqueTex(q, "museum", [SIGNAGE.museum, "FUNDADO EM MCMXXXI", "ARTE · TRAJE · CIDADE"]), gala: plaqueTex(q, "gala", [SIGNAGE.institute, "GALA LUMIÈRE · ENTRADA", "SOMENTE COM CONVITE"]) }), [q]);
  return (
    <group>
      <mesh geometry={g.ashlar} material={m.ashlar} castShadow receiveShadow />
      <mesh geometry={g.rustic} material={m.rustic} castShadow receiveShadow />
      <mesh geometry={g.stone} material={m.stone} castShadow receiveShadow />
      <mesh geometry={g.rough} material={m.roughStone} castShadow receiveShadow />
      <mesh geometry={g.roof} material={m.roof} receiveShadow />
      <Instanced geometry={g.shaft} material={m.stone} matrices={g.colMatrices.map((x) => x.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.42, 0)))} shadow />
      <Instanced geometry={g.base} material={m.stone} matrices={g.colMatrices} shadow />
      <Instanced geometry={g.capital} material={m.stoneDouble} matrices={g.colMatrices.map((x) => x.clone().multiply(new THREE.Matrix4().makeTranslation(0, Y_CAP - Y_PED, 0)))} shadow />
      {/* janelas */}
      <Instanced geometry={w.glass} material={m.glassDark} matrices={[...w.big]} />
      <Instanced geometry={w.glass} material={m.glassWarm} matrices={[...w.litBig]} />
      <Instanced geometry={w.glass} material={m.glassDark} matrices={[...w.small]} />
      <Instanced geometry={w.glass} material={m.glassWarm} matrices={[...w.litSmall]} />
      <Instanced geometry={w.mullion} material={m.bronze} matrices={[...w.big, ...w.litBig, ...w.small, ...w.litSmall]} />
      <Instanced geometry={w.frame} material={m.stone} matrices={[...w.big, ...w.litBig, ...w.small, ...w.litSmall]} />
      <Instanced geometry={w.pediment} material={m.stone} matrices={[...w.big, ...w.litBig]} />
      {/* placas de bronze nos pedestais dos pares soltos (nome do museu e a entrada da gala) */}
      {[[-4.6, "museum"], [4.6, "gala"]].map(([x, k]) => <mesh key={k as string} position={[x as number, 0.62, 25.82]}><boxGeometry args={[1.05, 0.65, 0.035]} /><meshStandardMaterial map={k === "museum" ? plaques.museum : plaques.gala} metalness={0.55} roughness={0.42} /></mesh>)}
      {/* inscrição no friso, entre os pares de dentro */}
      <mesh material={inscription} position={[0, Y_FRIEZE + 0.3, FACADE_Z + 0.205]}><planeGeometry args={[7.6, 0.475]} /></mesh>
      {/* vãos: portas centrais, bandeira e os arcos laterais envidraçados */}
      <FrontDoors q={q} view={view} />
      <mesh material={m.bronze} position={[0, 4.32, 24.27]}><boxGeometry args={[4.2, 0.24, 0.1]} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} material={m.bronze} position={[s * 2.05, 2.1, 24.27]}><boxGeometry args={[0.1, 4.2, 0.1]} /></mesh>)}
      <ArchGlazing q={q} cx={0} spring={5.9} w={4.2} from={4.44} />
      {[-9, 9].map((cx) => <ArchGlazing key={cx} q={q} cx={cx} spring={5.9} w={4.2} from={0} />)}
      {/* banners da exposição entre os pares e a faixa sobre o arco central */}
      <Banners q={q} />
      <DockGate q={q} view={view} />
      <FireDoorFrame q={q} />
    </group>
  );
}
