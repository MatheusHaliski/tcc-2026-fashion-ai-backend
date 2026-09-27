"use client";
import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { StudioLight } from "@/components/three/common";
import { Mannequin, bodyParamsOf } from "@/components/three/mannequin";
import type { HumanParts } from "@/components/three/human-avatar";
import type { Avatar3dRef, Look3dPiece } from "@/components/three/common";
import { buildSpec, type BodyParams } from "@/lib/avatar3d/body-spec";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * Prévia do Avatar 3D (RF40): o busto no manequim, com as vistas que a validação pede — frente, 3/4 dos dois lados e
 * perfil — e giro livre. A luz é neutra e suave (a da foto já está na textura; luz dura de cena dobraria as sombras).
 */
export type AvatarView = "front" | "left34" | "right34" | "profile" | "back";
const ANGLE: Record<AvatarView, number> = { front: 0, left34: -35, right34: 35, profile: 90, back: 180 };

function Rig({ view, target, dist }: { view: AvatarView; target: [number, number, number]; dist: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const a = (ANGLE[view] * Math.PI) / 180;
    camera.position.set(target[0] + Math.sin(a) * dist, target[1] + 0.03, target[2] + Math.cos(a) * dist);
    camera.lookAt(...target); camera.updateProjectionMatrix();
  }, [view, camera, target, dist]);
  return null;
}

export default function AvatarViewer({ avatar, sex, build, skinTone, view = "front", background = "#e9e4dc", onCanvas, pieces = [], framing = "bust", body, controls = true, onHuman }: {
  avatar: Avatar3dRef | null; sex: "FEMININO" | "MASCULINO"; build?: string | null; skinTone?: string | null; view?: AvatarView; background?: string;
  onCanvas?: (c: HTMLCanvasElement) => void; pieces?: Look3dPiece[]; framing?: "bust" | "upper" | "full"; body?: BodyParams | null; controls?: boolean;
  onHuman?: (p: HumanParts) => void;                 // o corpo pronto (esqueleto, malhas): exportação GLB
}) {
  const { t } = useI18n();
  // enquadramento pelo próprio corpo (a cabeça fica onde o corpo medido/informado a põe)
  const params = body ?? bodyParamsOf({ sex, build, avatar });
  const spec = buildSpec(params); const H = spec.stature;
  const target: [number, number, number] = framing === "bust" ? [0, spec.head.center[1] - 0.02, 0.02] : framing === "upper" ? [0, H * 0.74, 0] : [0, H * 0.5, 0];
  const dist = framing === "bust" ? 0.95 : framing === "upper" ? 2.1 : H * 2.35;
  return (
    <Canvas camera={{ fov: 30, near: 0.05, far: 20, position: [0, target[1], dist] }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.toneMappingExposure = 0.95; onCanvas?.(gl.domElement); }}
      aria-label={t("avatar3d.viewer.aria")}>
      <color attach="background" args={[background]} />
      <StudioLight intensity={0.5} />
      <hemisphereLight args={["#ffffff", "#cfc6b8", 0.55]} />
      <directionalLight position={[1.2, 2.6, 2.4]} intensity={0.7} />
      <directionalLight position={[-1.6, 2.0, 1.8]} intensity={0.45} />
      <directionalLight position={[0, 2.2, -2.5]} intensity={0.35} />
      <Mannequin mannequin={{ sex, build: build ?? "MEDIUM", skinTone: avatar ? null : skinTone ?? null, head: avatar ? "AVATAR" : "PADRAO", avatar }} pieces={pieces} sway={false} body={params} onHuman={onHuman} />
      <Rig view={view} target={target} dist={dist} />
      {controls && <OrbitControls target={target} enablePan={false} minDistance={0.5} maxDistance={Math.max(3.5, dist * 1.4)} />}
    </Canvas>
  );
}
