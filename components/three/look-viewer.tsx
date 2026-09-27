"use client";
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Mannequin } from "@/components/three/mannequin";
import { useReducedMotion, type Look3d, StudioLight } from "@/components/three/common";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * "Gerar 3D" e "Foto com meu manequim": o look (ou a peça) no manequim, num pódio de estúdio. No modo foto
 * ({@code still}) a câmera fica de frente, sem giro, e o canvas guarda o quadro para virar JPEG ({@code onCanvas}).
 */
function Podium({ children, spin }: { children: React.ReactNode; spin: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (g.current && spin) g.current.rotation.y += dt * 0.3; });
  return <group ref={g}>{children}</group>;
}

export default function LookViewer({ look, background = "#efece6", still = false, onCanvas, framing = "full" }: {
  look: Look3d; background?: string; still?: boolean; onCanvas?: (c: HTMLCanvasElement) => void; framing?: "full" | "upper";
}) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const target: [number, number, number] = framing === "upper" ? [0, 1.2, 0] : [0, 0.95, 0];
  const cam: [number, number, number] = framing === "upper" ? [0, 1.25, 2.1] : [0, 1.1, 3.3];
  return (
    <Canvas shadows camera={{ position: cam, fov: 38 }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; onCanvas?.(gl.domElement); }} aria-label={t("three.lookViewer.no_manequim_em_3d", { title: look.title })}>
      <color attach="background" args={[background]} />
      <StudioLight intensity={0.8} />
      <hemisphereLight args={["#ffffff", "#d6c8b2", 0.5]} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 2, -2]} intensity={0.45} color="#c9d6ff" />
      <directionalLight position={[0, 1.6, 3]} intensity={0.35} />
      <mesh position={[0, 0.04, 0]} receiveShadow castShadow><cylinderGeometry args={[0.55, 0.6, 0.08, 48]} /><meshStandardMaterial color="#d9d3c7" roughness={0.4} /></mesh>
      <group position={[0, 0.08, 0]}><Podium spin={!reduced && !still}><Mannequin mannequin={look.mannequin} pieces={look.pieces} still={still} /></Podium></group>
      <ContactShadows position={[0, 0.081, 0]} opacity={0.4} scale={2} blur={2.2} far={2} />
      <OrbitControls target={target} enablePan={false} minDistance={1.2} maxDistance={5.5} maxPolarAngle={Math.PI * 0.55} />
    </Canvas>
  );
}
