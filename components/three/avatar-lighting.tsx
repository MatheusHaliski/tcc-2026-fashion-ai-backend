"use client";
import { StudioLight } from "@/components/three/common";

/** Neutral portrait lighting, with one shadow map for contact around lids, hair and eyewear. */
export function AvatarLighting() {
  return <>
    <StudioLight intensity={0.35} />
    <hemisphereLight args={["#ffffff", "#d7d0c6", 0.28]} />
    <directionalLight position={[1.2, 2.8, 2.4]} intensity={1.1} castShadow
      shadow-mapSize={[1024, 1024]} shadow-camera-left={-1.1} shadow-camera-right={1.1}
      shadow-camera-top={1.8} shadow-camera-bottom={-0.4} shadow-camera-near={0.1} shadow-camera-far={6}
      shadow-bias={-0.00005} shadow-normalBias={0.0006} />
    <directionalLight position={[-1.6, 2, 1.8]} intensity={0.28} />
    <directionalLight position={[0, 2.2, -2.5]} intensity={0.2} />
  </>;
}
