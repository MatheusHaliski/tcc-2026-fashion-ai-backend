"use client";
import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Mannequin } from "@/components/three/mannequin";
import type { Avatar3dRef, Look3dPiece } from "@/components/three/common";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * Prévia do Avatar 3D (RF40): o busto no manequim, com as vistas que a validação pede — frente, 3/4 dos dois lados e
 * perfil — e giro livre. A luz é neutra e suave (a da foto já está na textura; luz dura de cena dobraria as sombras).
 */
export type AvatarView = "front" | "left34" | "right34" | "profile";
const ANGLE: Record<AvatarView, number> = { front: 0, left34: -35, right34: 35, profile: 90 };

function Rig({ view, target, dist }: { view: AvatarView; target: [number, number, number]; dist: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const a = (ANGLE[view] * Math.PI) / 180;
    camera.position.set(target[0] + Math.sin(a) * dist, target[1] + 0.03, target[2] + Math.cos(a) * dist);
    camera.lookAt(...target); camera.updateProjectionMatrix();
  }, [view, camera, target, dist]);
  return null;
}

export default function AvatarViewer({ avatar, sex, build, view = "front", background = "#e9e4dc", onCanvas, pieces = [], framing = "bust" }: {
  avatar: Avatar3dRef; sex: "FEMININO" | "MASCULINO"; build?: string | null; view?: AvatarView; background?: string;
  onCanvas?: (c: HTMLCanvasElement) => void; pieces?: Look3dPiece[]; framing?: "bust" | "upper";
}) {
  const { t } = useI18n();
  const k = sex === "MASCULINO" ? 1.06 : 1;
  const target: [number, number, number] = framing === "bust" ? [0, 1.56 * k, 0.02] : [0, 1.3 * k, 0];
  const dist = framing === "bust" ? 0.95 : 2.1;
  return (
    <Canvas camera={{ fov: 30, near: 0.05, far: 20, position: [0, target[1], dist] }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 0.95; onCanvas?.(gl.domElement); }}
      aria-label={t("avatar3d.viewer.aria")}>
      <color attach="background" args={[background]} />
      <hemisphereLight args={["#ffffff", "#cfc6b8", 1.1]} />
      <directionalLight position={[1.2, 2.6, 2.4]} intensity={0.8} />
      <directionalLight position={[-1.6, 2.0, 1.8]} intensity={0.45} />
      <directionalLight position={[0, 2.2, -2.5]} intensity={0.35} />
      <Mannequin mannequin={{ sex, build: build ?? "MEDIUM", head: "AVATAR", avatar }} pieces={pieces} sway={false} />
      <Rig view={view} target={target} dist={dist} />
      <OrbitControls target={target} enablePan={false} minDistance={0.5} maxDistance={3.5} />
    </Canvas>
  );
}
