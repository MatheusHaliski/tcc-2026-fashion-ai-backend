"use client";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { type RoomInteraction, type RoomAction } from "@/lib/room3d/interaction";
import { ApprovedAsset } from "./approved-asset";
import { useTex } from "@/components/three/common";
import { Lamp } from "./room-props";

/** Interaction and physical footprint stay stable when an approved visual model is replaced. */
export function RoomFixture({ engine, id, position, collider, kind, run, children }: {
  engine?: RoomInteraction; id: string; position: [number, number, number]; collider?: [number, number];
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
  return <group ref={ref} position={position}>{children}</group>;
}

export const BED_POSITION: [number, number, number] = [1.65, 0, 3.85];
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
  return <RoomFixture engine={engine} id="bed" position={BED_POSITION} collider={[1.62, 1.12]}>
    <group scale={[1, 1.2, 1]}>
      <ApprovedAsset url={modelUrl} size={[3.2, 1.8, 2.4]} rotationY={Math.PI}>
        <group>
          <mesh position={[0, .23, 0]} castShadow><boxGeometry args={[1.65, .32, 2]} /><meshStandardMaterial color="#1245a8" roughness={.8} /></mesh>
          <mesh position={[0, .47, 0]} castShadow><boxGeometry args={[1.64, .22, 1.97]} /><meshStandardMaterial color="#eee6da" roughness={1} /></mesh>
          <mesh position={[0, .69, .92]} castShadow><boxGeometry args={[1.74, .65, .09]} /><meshStandardMaterial color="#1245a8" roughness={.85} /></mesh>
          <mesh position={[0, .91, .86]}><circleGeometry args={[.24, 48]} /><meshStandardMaterial map={logo ?? undefined} transparent color={logo ? "#ffffff" : "#f89921"} /></mesh>
          <mesh position={[0, .59, -1.01]}><boxGeometry args={[1.68, .045, .045]} /><meshStandardMaterial color="#f58220" /></mesh>
          {[-.43, .43].map(x => <mesh key={x} position={[x, .62, .61]} rotation={[-.14, 0, 0]} castShadow><boxGeometry args={[.66, .12, .4]} /><meshStandardMaterial color="#f7f3eb" roughness={1} /></mesh>)}
          <mesh position={[0, .59, -.35]}><boxGeometry args={[1.65, .025, 1.22]} /><meshStandardMaterial color="#1245a8" roughness={1} /></mesh>
          {[-1.15, 1.15].map(x => <mesh key={x} position={[x, .32, .69]} castShadow><boxGeometry args={[.5, .64, .55]} /><meshStandardMaterial color="#1245a8" roughness={.8} /></mesh>)}
        </group>
      </ApprovedAsset>
    </group>
    {[-1.15, 1.15].map(x => <group key={x} position={[x, .65, .69]} scale={.55}><Lamp position={[0, 0, 0]} on={lit} intensity={intensity} /></group>)}
  </RoomFixture>;
}
