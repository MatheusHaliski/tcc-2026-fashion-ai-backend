"use client";
import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { AvatarLighting } from "@/components/three/avatar-lighting";
import { Mannequin, bodyParamsOf } from "@/components/three/mannequin";
import { useBodyAsset, type HumanParts } from "@/components/three/human-avatar";
import type { HairLod } from "@/lib/avatar3d/human/hair-lod";
import type { Avatar3dRef, Look3dPiece } from "@/components/three/common";
import { buildSpec, type BodyParams } from "@/lib/avatar3d/body-spec";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * Prévia do Avatar 3D (RF40): o busto no manequim, com as vistas que a validação pede — frente, 3/4 dos dois lados e
 * perfil — e giro livre. A luz é neutra e suave (a da foto já está na textura; luz dura de cena dobraria as sombras).
 */
export type AvatarView = "front" | "left34" | "right34" | "profile" | "back";
const ANGLE: Record<AvatarView, number> = { front: 0, left34: -35, right34: 35, profile: 90, back: 180 };

/**
 * Câmera da vista. `fitWidth` (metros): em telas estreitas (espelho, Prévia 2D no celular) a câmera recua até a
 * largura do corpo com os braços caber, em vez de cortar as mãos nas bordas.
 */
function Rig({ view, target, dist, fitWidth = 0 }: { view: AvatarView; target: [number, number, number]; dist: number; fitWidth?: number }) {
  const { camera, size } = useThree();
  const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1;
  const fov = (camera as THREE.PerspectiveCamera).fov ?? 30;
  const d = Math.max(dist, fitWidth / 2 / (Math.tan((fov * Math.PI) / 360) * aspect));
  useEffect(() => {
    const a = (ANGLE[view] * Math.PI) / 180;
    camera.position.set(target[0] + Math.sin(a) * d, target[1] + 0.03, target[2] + Math.cos(a) * d);
    camera.lookAt(...target); camera.updateProjectionMatrix();
  }, [view, camera, target, d]);
  return null;
}

export default function AvatarViewer({ avatar, sex, build, skinTone, view = "front", background = "#e9e4dc", onCanvas, pieces = [], framing = "bust", body, controls = true, onHuman, still = false, hairLod, children }: {
  avatar: Avatar3dRef | null; sex: "FEMININO" | "MASCULINO"; build?: string | null; skinTone?: string | null; view?: AvatarView; background?: string;
  onCanvas?: (c: HTMLCanvasElement) => void; pieces?: Look3dPiece[]; framing?: "bust" | "upper" | "full"; body?: BodyParams | null; controls?: boolean;
  onHuman?: (p: HumanParts) => void;                 // o corpo pronto (esqueleto, malhas): exportação GLB
  still?: boolean;                                   // parado na pose de repouso (Prévia 2D): sem respiração nem apoio
  hairLod?: HairLod;                                 // nível de detalhe do cabelo fixo (a Prévia 2D usa um quadro só)
  children?: React.ReactNode;                        // dentro do Canvas (ex.: a captura da Prévia 2D)
}) {
  const { t } = useI18n();
  const asset = useBodyAsset();
  sex = avatar?.model?.sex ?? sex;                   // corpo base do avatar (estimado pelo rosto ou escolhido) vence o cadastro
  // enquadramento pelo próprio corpo (a cabeça fica onde o corpo medido/informado a põe)
  const params = body ?? bodyParamsOf({ sex, build, avatar });
  const spec = buildSpec(params); const H = spec.stature;
  const target: [number, number, number] = framing === "bust" ? [0, spec.head.center[1] - 0.02, 0.02] : framing === "upper" ? [0, H * 0.74, 0] : [0, H * 0.5, 0];
  const dist = framing === "bust" ? 0.95 : framing === "upper" ? 2.1 : H * 2.35;
  if (!asset || asset === "error") return <div role="status" className="grid h-full content-center justify-items-center gap-3 p-6 text-center">
    <p>{t(asset === "error" ? "tryOn.avatar_load_failed" : "tryOn.avatar_loading")}</p>
    {asset === "error" && <button type="button" className="btn btn-sm" onClick={() => window.location.reload()}>{t("common.retry")}</button>}
  </div>;
  return (
    <Canvas shadows="percentage" camera={{ fov: 30, near: 0.05, far: 20, position: [0, target[1], dist] }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.toneMappingExposure = 0.95; onCanvas?.(gl.domElement); }}
      aria-label={t("avatar3d.viewer.aria")}>
      <color attach="background" args={[background]} />
      <AvatarLighting />
      <Mannequin mannequin={{ sex, build: build ?? "MEDIUM", skinTone: avatar ? null : skinTone ?? null, head: avatar ? "AVATAR" : "PADRAO", avatar }} pieces={pieces} sway={false} body={params} onHuman={onHuman} still={still} hairLod={hairLod} />
      <Rig view={view} target={target} dist={dist} fitWidth={framing === "full" ? H * 0.74 : 0} />
      {children}
      {controls && <OrbitControls target={target} enablePan={false} minDistance={0.5} maxDistance={Math.max(3.5, dist * 1.4)} />}
    </Canvas>
  );
}
