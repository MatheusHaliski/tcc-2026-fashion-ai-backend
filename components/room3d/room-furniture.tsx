"use client";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { type RoomInteraction, type RoomAction } from "@/lib/room3d/interaction";
import { ROOM } from "@/lib/room3d/room-bounds";
import { ApprovedAsset } from "./approved-asset";
import { useTex } from "@/components/three/common";
import { Lamp } from "./room-props";

/**
 * Interaction and physical footprint stay stable when an approved visual model is replaced. `yaw` turns the fixture; the
 * collider half-sizes are in its own (turned) space, the oriented box of `penetration`.
 */
export function RoomFixture({ engine, id, position, yaw = 0, collider, kind, run, children }: {
  engine?: RoomInteraction; id: string; position: [number, number, number]; yaw?: number; collider?: [number, number];
  kind?: RoomAction["kind"]; run?: () => void; children?: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null); const callback = useRef(run); callback.current = run;
  const hx = collider?.[0], hz = collider?.[1];
  useEffect(() => {
    const object = ref.current; if (!engine || !object) return;
    if (hx !== undefined && hz !== undefined) { object.userData.collider = { hx, hz }; engine.solids.add(object); }
    if (kind) engine.actions.set(id, { id, object, kind, radius: kind === "open" ? 1 : .85, run: () => callback.current?.() });
    return () => { engine.solids.delete(object); engine.actions.delete(id); engine.updateNearby(); };
  }, [engine, id, hx, hz, kind]);
  return <group ref={ref} name={`fixture-${id}`} position={position} rotation={[0, yaw, 0]}>{children}</group>;
}

/**
 * Cama de casal na medida de gente: 1,8 m de cama (2,8 m com os dois criados-mudos), 2,15 m de comprimento — cabe o
 * personagem deitado — e colchão a ~0,5 m. No espaço da cama, como nos modelos glTF, os pés (a frente) ficam em +z e a
 * cabeceira em −z; o giro de −90° encosta a cabeceira na parede leste e vira os pés para o centro do quarto, longe da
 * janela leste (a cortina termina em z = 3,21) e da parede sul, que é a da câmera na visão geral.
 */
export const BED = { width: 2.8, height: 1.3, length: 2.15, yaw: -Math.PI / 2 } as const;
export const BED_POSITION: [number, number, number] = [ROOM.maxX - 0.03 - BED.length / 2, 0, 3.75];
/** Tampo do criado-mudo do lado do abajur, no espaço da cama (o mesmo do modelo aprovado depois do encaixe). */
const NIGHTSTAND: [number, number, number] = [1.22, 0.51, -0.62];
export function CeilingFixture({ on, intensity, color }: { on: boolean; intensity: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => { if (ref.current) ref.current.visible = ref.current.getWorldPosition(new THREE.Vector3()).distanceTo(camera.position) > .8; });
  return <group position={[.5, 2.94, 2.4]}>
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.2, .2, .06, 32]} /><meshStandardMaterial color="#f1eadb" emissive={color} emissiveIntensity={on ? intensity * 2 : 0} /></mesh>
    <pointLight position={[0, -.16, 0]} color={color} intensity={on ? intensity * 18 : 0} distance={12} decay={2} />
  </group>;
}
export function DoubleBed({ engine, modelUrl, lit, intensity }: { engine?: RoomInteraction; modelUrl?: string | null; lit: boolean; intensity: number }) {
  const logo = useTex("/brand/fai-logo.png");
  const navy = <meshStandardMaterial color="#1245a8" roughness={.8} />;
  // o modelo aprovado é gerado de uma foto (profundidade achatada): encaixe por eixo na caixa da cama
  return <RoomFixture engine={engine} id="bed" position={BED_POSITION} yaw={BED.yaw} collider={[BED.width / 2, BED.length / 2]}>
    <ApprovedAsset url={modelUrl} size={[BED.width, BED.height, BED.length]} fit="fill">
      <group>
        <mesh position={[0, .2, .04]} castShadow><boxGeometry args={[1.8, .3, 2.06]} />{navy}</mesh>
        <mesh position={[0, .43, .05]} castShadow><boxGeometry args={[1.76, .16, 2.0]} /><meshStandardMaterial color="#eee6da" roughness={1} /></mesh>
        <mesh position={[0, .68, -1.025]} castShadow><boxGeometry args={[1.86, 1.24, .1]} />{navy}</mesh>
        <mesh position={[0, .98, -.973]}><circleGeometry args={[.26, 48]} /><meshStandardMaterial map={logo ?? undefined} transparent color={logo ? "#ffffff" : "#f89921"} /></mesh>
        <mesh position={[0, .52, 1.075]}><boxGeometry args={[1.82, .05, .05]} /><meshStandardMaterial color="#f58220" /></mesh>
        {[-.44, .44].map(x => <mesh key={x} position={[x, .56, -.72]} rotation={[.14, 0, 0]} castShadow><boxGeometry args={[.7, .13, .42]} /><meshStandardMaterial color="#f7f3eb" roughness={1} /></mesh>)}
        <mesh position={[0, .52, .4]}><boxGeometry args={[1.78, .025, 1.3]} />{navy}</mesh>
        {[-1, 1].map(s => <mesh key={s} position={[s * NIGHTSTAND[0], NIGHTSTAND[1] / 2, NIGHTSTAND[2]]} castShadow><boxGeometry args={[.36, NIGHTSTAND[1], .62]} />{navy}</mesh>)}
      </group>
    </ApprovedAsset>
    <group position={NIGHTSTAND} scale={.55}><Lamp position={[0, 0, 0]} on={lit} intensity={intensity} /></group>
  </RoomFixture>;
}
