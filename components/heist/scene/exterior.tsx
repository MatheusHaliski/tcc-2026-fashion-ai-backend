"use client";
/*
 * MET Gala Heist v2 — a cena de fora: fachada do Museu Vesper, avenida com a escadaria e o tapete, carros, beco, a cidade em
 * volta e as luzes da noite da gala. Dono: o "Agente Rua" (ver scratchpad/gala/PLANO.md); o céu, a névoa, o ambiente e o
 * pós-processamento ficam em sky.tsx. A cidade: a quadra em frente com lojas e apartamentos, as transversais e o skyline
 * (exterior-blocks, exterior-city, exterior-skyline); o mobiliário da rua e os móveis únicos da entrada
 * (exterior-furniture); a sujeira da calçada (exterior-litter); halos e poças de luz numa chamada (exterior-glow).
 *
 * Reflexos: no "high", a pista reflete de verdade (MeshReflectorMaterial — mais um desenho da cena por quadro, por isso só
 * enquanto a jogadora está do lado de fora); calçadas, carros, vidros e metais recebem um mapa de reflexo capturado da
 * própria rua (sonda cúbica tirada uma vez, depois que a cena acende), para o âmbar da fachada e dos postes aparecer nas
 * superfícies molhadas nos dois modos.
 */
import { MeshReflectorMaterial } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { SceneView } from "@/lib/heist/view";
import { exteriorMaterials, type ExteriorMaterials } from "./exterior-materials";
import { asphaltSet, type Quality } from "./exterior-textures";
import { HeistFacade } from "./exterior-facade";
import { crossRoadGeometry, HeistStreet, roadGeometry, streetProps } from "./exterior-street";
import { HeistVehicles } from "./exterior-vehicles";
import { HeistAlley } from "./exterior-alley";
import { HeistCity } from "./exterior-city";
import { ExteriorLights } from "./exterior-fx";
import { buildCity } from "./exterior-blocks";
import { furnitureLights, HeistFurniture } from "./exterior-furniture";
import { HeistLitter } from "./exterior-litter";
import { SKY_LAYER } from "./exterior-skyline";

const OUTSIDE = new Set(["rua", "beco", "vestibulo", "doca"]);

/** Pista: com reflexo real (alto, do lado de fora) ou o asfalto molhado com a sonda (baixo, ou dentro do museu). */
function Road({ q, m, view }: { q: Quality; m: ExteriorMaterials; view: React.MutableRefObject<SceneView> }) {
  const geo = useMemo(() => roadGeometry(), []);
  const [outside, setOutside] = useState(true);
  const last = useRef(true);
  useFrame(() => { const o = OUTSIDE.has(view.current.playerRoom); if (o !== last.current) { last.current = o; setOutside(o); } });
  const tex = useMemo(() => asphaltSet(q), [q]);
  if (q !== "high" || !outside) return <mesh geometry={geo} material={m.asphalt} receiveShadow />;
  return (
    <mesh geometry={geo} receiveShadow>
      <MeshReflectorMaterial resolution={512} blur={[260, 90]} mixBlur={1.1} mixStrength={2.4} mixContrast={1.05} mirror={0.55} depthScale={0.9} minDepthThreshold={0.35} maxDepthThreshold={1.25}
        color="#2a2c31" roughness={0.78} metalness={0.25} map={tex.map} normalMap={tex.normalMap} normalScale={new THREE.Vector2(0.6, 0.6)} roughnessMap={tex.orm} envMapIntensity={0.6} />
    </mesh>
  );
}

/** Sonda de luz da rua: depois de 3 quadros (cena montada e acesa), uma captura cúbica no meio da avenida vira o mapa de
 * ambiente de tudo o que é de fora — reflexo das superfícies molhadas, metais e vidros, e a luz rebatida na pedra (a fachada
 * recebe o que está na frente dela: a avenida, os prédios acesos e o céu escuro, e não o ambiente genérico do céu, que
 * achatava a noite). Uma segunda captura, já com esse ambiente, acerta o que a primeira viu. Refeita quando a qualidade muda.
 * Só os materiais deste grupo mudam: o interior continua com o `scene.environment` do HeistSky. */
function StreetProbe({ m, q, root }: { m: ExteriorMaterials; q: Quality; root: React.RefObject<THREE.Group | null> }) {
  const { gl, scene } = useThree();
  const frames = useRef(0), done = useRef(false), env = useRef<THREE.Texture | null>(null);
  const probe = useMemo(() => {
    const rt = new THREE.WebGLCubeRenderTarget(q === "high" ? 256 : 128, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cam = new THREE.CubeCamera(0.3, 400, rt); cam.position.set(0, -0.9, 37.5);
    cam.children.forEach((c) => c.layers.enable(SKY_LAYER));
    return { rt, cam };
  }, [q]);
  useEffect(() => { frames.current = 0; done.current = false; }, [probe]);
  useEffect(() => () => { probe.rt.dispose(); env.current?.dispose(); env.current = null; }, [probe]);
  useFrame(() => {
    const f = ++frames.current;
    if (done.current || (f !== 4 && f !== 12)) return;
    if (f === 12) done.current = true;
    scene.add(probe.cam);
    probe.cam.update(gl, scene);
    scene.remove(probe.cam);
    const pm = new THREE.PMREMGenerator(gl);
    const next = pm.fromCubemap(probe.rt.texture).texture;
    pm.dispose();
    const prev = env.current; env.current = next;
    const wet = new Set<THREE.Material>(m.wet);
    for (const mat of m.wet) { mat.envMap = next; mat.needsUpdate = true; }
    root.current?.traverse((o) => {
      const mats = (o as THREE.Mesh).material; if (!mats) return;
      for (const mat of Array.isArray(mats) ? mats : [mats]) {
        const std = mat as THREE.MeshStandardMaterial;
        if (!std.isMeshStandardMaterial || wet.has(std) || (std.envMap && std.envMap !== prev)) continue;
        std.envMap = next; std.needsUpdate = true;
      }
    });
    prev?.dispose();
  });
  return null;
}

export function HeistExterior({ view, quality }: { view: React.MutableRefObject<SceneView>; quality: Quality }) {
  const m = exteriorMaterials(quality);
  const { camera } = useThree();
  useEffect(() => { camera.layers.enable(SKY_LAYER); }, [camera]);
  const props = useMemo(streetProps, []);
  const kit = useMemo(() => {
    const k = buildCity(quality === "low"), f = furnitureLights(props);
    k.anchors.push(...f.anchors); k.pools.push(...f.pools); k.glows.push(...f.glows.map((g) => ({ pos: g.pos, size: g.size, color: String(g.color) })));
    return k;
  }, [quality, props]);
  const cross = useMemo(() => crossRoadGeometry(), []);
  const root = useRef<THREE.Group>(null);
  return (
    <group ref={root}>
      <HeistFacade q={quality} view={view} />
      <HeistStreet q={quality} m={m} />
      <Road q={quality} m={m} view={view} />
      <mesh geometry={cross} material={m.asphalt} receiveShadow />
      <HeistVehicles props={props} m={m} q={quality} />
      <HeistAlley props={props} m={m} q={quality} />
      <HeistCity m={m} q={quality} kit={kit} />
      <HeistFurniture props={props} m={m} q={quality} />
      <HeistLitter props={props} m={m} q={quality} />
      <ExteriorLights view={view} q={quality} props={props} kit={kit} />
      <StreetProbe m={m} q={quality} root={root} />
    </group>
  );
}
export default HeistExterior;
