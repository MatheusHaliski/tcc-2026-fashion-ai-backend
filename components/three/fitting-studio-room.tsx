"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { StudioLight, useCanvasTexture, useTex } from "@/components/three/common";
import { ReferenceGallery } from "@/components/three/store-fixtures";
import { useI18n } from "@/lib/i18n/i18n";
import type { BrandEnvironment, LightMode } from "@/lib/tryon/fitting-room";
import { STUDIO_PALETTE, type FittingStudioProfile } from "@/lib/scene3d/fitting-studio";
import {
  BACK_Z, box, CabinBench, CabinEntrance, CeilingSpots, CornerPlant, cyl, DOOR_GAP, FRONT_Z, PaintedWall, Pouf, PROP_CUT, ROOM_CZ, ROOM_D, ROOM_W, Rug, SIDE_X, WALL_H,
  useCutaway, useFused, useLiteDecor, useStudioKit, wallCut, type Part, type StudioKit,
} from "@/components/three/fitting-cabin";

/*
 * A sala do provador 3D (estúdio conceitual, em metros, origem nos pés do avatar, avatar de frente para +z) e a luz
 * dela: a cabine fechada (fitting-cabin.tsx) com a placa de identidade, o banco com cabideiro, a galeria opcional e a
 * parede virada para a câmera recortada. Saiu de fitting-room-scene.tsx sem mudar nada para o Espelho também pôr o
 * reflexo dentro da mesma cabine (components/three/mirror-booth.tsx).
 */
type V3 = [number, number, number];

function IdentityPlaque({ env }: { env: BrandEnvironment }) {
  const logo = useTex(env.logoUrl);
  const word = useCanvasTexture((g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = STUDIO_PALETTE.ink;
    let size = 108; g.font = `500 ${size}px Inter, Arial, sans-serif`;
    while (g.measureText(env.name).width > w * .88 && size > 24) { size -= 4; g.font = `500 ${size}px Inter, Arial, sans-serif`; }
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(env.name, w / 2, h / 2);
  }, 1024, 256, [env.name]);
  useEffect(() => () => word.dispose(), [word]);
  const image = logo?.image as HTMLImageElement | undefined;
  const aspect = image?.width ? image.width / Math.max(1, image.height) : 4;
  const width = Math.min(1.2, .32 * aspect);
  // um pouco menor e mais baixa que antes: inteira acima da cabeça na vista de frente (antes saía cortada pelo topo)
  return <group name={`studio-identity-${env.key}`} position={[0, 2.25, BACK_Z + .03]} scale={.85}>
    <mesh><boxGeometry args={[1.48, .5, .03]} /><meshStandardMaterial color="#F7F5F0" roughness={.85} /></mesh>
    <mesh position={[0, -.25, .016]}><planeGeometry args={[1.48, .012]} /><meshStandardMaterial color={env.accent} roughness={.8} /></mesh>
    <mesh position={[0, 0, .019]}><planeGeometry args={logo ? [width, width / aspect] : [1.36, .34]} /><meshBasicMaterial map={logo ?? word} transparent toneMapped={false} /></mesh>
  </group>;
}

/** Banco e cabideiro junto à parede do fundo: madeira e metal escovado (a cor da marca fica só nos detalhes). */
function BenchAndRail({ kit }: { kit: StudioKit }) {
  const wood = useFused(() => [box(1.05, .1, .43, [0, .46, 0]), box(.045, .41, .34, [-.43, .205, 0]), box(.045, .41, .34, [.43, .205, 0]), ...[-.3, 0, .3].flatMap((x): Part[] => [
    { ...box(.18, .014, .018, [x - .075, 1.54, -.25]), rot: [0, 0, .55] }, { ...box(.18, .014, .018, [x + .075, 1.54, -.25]), rot: [0, 0, -.55] },
  ])], []);
  const metal = useFused(() => [
    cyl(.012, .012, 1.1, [0, 1.7, -.25], [0, 0, Math.PI / 2], 10),
    ...[-.3, 0, .3].map((x): Part => ({ g: new THREE.TorusGeometry(.026, .005, 6, 12, Math.PI * 1.4), at: [x, 1.635, -.25] })),
  ], []);
  return <group name="studio-bench-and-hangers" position={[-1.48, 0, BACK_Z + .43]} userData={PROP_CUT}>
    <mesh geometry={wood} material={kit.wood} /><mesh geometry={metal} material={kit.hardware} />
  </group>;
}
/** semente estável por marca (o quadro abstrato muda de composição entre marcas, nunca entre visitas) */
const seedOf = (key: string) => { let h = 2166136261; for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/**
 * Cabine fechada: fundo (placa, galeria, banco), laterais e a parede da frente como entrada (porta, banco estofado,
 * quadro, ganchos, placa luminosa). A parede virada para a câmera e os móveis que tapariam o avatar saem de cena
 * (useCutaway); o tapete e os spots ficam sempre.
 */
export function FittingStudioRoom({ profile, target, references }: { profile: FittingStudioProfile; target: V3; references: boolean }) {
  const { t } = useI18n(), p = profile.palette, kit = useStudioKit(p), lite = useLiteDecor(), root = useRef<THREE.Group>(null);
  useCutaway(root, target);
  return <group ref={root} name="conceptual-fitting-studio">
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, ROOM_CZ]} receiveShadow><planeGeometry args={[ROOM_W, ROOM_D]} /><meshStandardMaterial color={p.floor} roughness={.88} /></mesh>
    <mesh position={[0, WALL_H, ROOM_CZ]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[ROOM_W, ROOM_D]} /><meshStandardMaterial color={p.ceiling} roughness={.95} /></mesh>
    <CeilingSpots kit={kit} /><Rug palette={p} />
    <group name="studio-back-wall" userData={wallCut(0, 1, BACK_Z, .7)}>
      <PaintedWall kit={kit} palette={p} width={ROOM_W} position={[0, 0, BACK_Z]} />
      <IdentityPlaque env={profile.brand} />
      {references && <ReferenceGallery products={profile.photographs} label={t("tryOn.reference_images")} position={[1.72, 1.55, BACK_Z + .03]} />}
      <BenchAndRail kit={kit} />
    </group>
    <group name="studio-front-wall" userData={wallCut(0, -1, -FRONT_Z, .5)}>
      <PaintedWall kit={kit} palette={p} width={ROOM_W} gaps={[DOOR_GAP]} gain={1.2} position={[0, 0, FRONT_Z]} rotation={[0, Math.PI, 0]} />
      <CabinEntrance kit={kit} palette={p} sign={t("tryOn.cabine_placa")} seed={seedOf(profile.brand.key)} lite={lite} />
      <CabinBench kit={kit} />
      {!lite && <><CornerPlant kit={kit} /><Pouf kit={kit} /></>}
    </group>
    {[-1, 1].map(side => <group key={side} name={`studio-side-wall-${side < 0 ? "left" : "right"}`} userData={wallCut(-side, 0, -SIDE_X, .5)}>
      <PaintedWall kit={kit} palette={p} width={ROOM_D} position={[side * SIDE_X, 0, ROOM_CZ]} rotation={[0, -side * Math.PI / 2, 0]} />
    </group>)}
  </group>;
}

/** All lights are neutral. Store identity never changes the apparel base colour. */
export function FittingStudioLights({ light }: { light: LightMode }) {
  const night = light === "night", day = light === "daylight";
  return <>
    <StudioLight intensity={night ? .35 : day ? .7 : .6} />
    <hemisphereLight args={["#FFFFFF", "#8C8780", night ? .25 : .6]} />
    <spotLight position={[0, WALL_H - .1, 1.2]} angle={.6} penumbra={.85} intensity={night ? 6 : 9} color="#FFFFFF" castShadow target-position={[0, .8, 0]} />
    <directionalLight position={[1.7, 2.8, 3]} intensity={night ? .4 : .8} color="#FFFFFF" />
    <directionalLight position={[-1.8, 2.2, 2.2]} intensity={night ? .2 : .4} color="#FFFFFF" />
    <pointLight position={[0, 1.8, -1.2]} intensity={night ? .25 : .4} distance={4} color="#FFFFFF" />
  </>;
}
