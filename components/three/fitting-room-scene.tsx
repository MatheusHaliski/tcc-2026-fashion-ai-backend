"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useReducedMotion, type Avatar3dRef, type Look3dPiece } from "@/components/three/common";
import { Mannequin, bodyParamsOf } from "@/components/three/mannequin";
import { useBodyAsset, type HumanParts } from "@/components/three/human-avatar";
import { SceneDebug, type SceneDebugOptions } from "@/components/three/scene-debug";
import { buildSpec, validateBody, type BodyParams } from "@/lib/avatar3d/body-spec";
import type { LightMode, ResolvedEnvironment } from "@/lib/tryon/fitting-room";
import type { AvatarView } from "@/components/three/avatar-viewer";
import type { StoreScene } from "@/lib/scene3d/scene";
import { resolveFittingStudio, type FittingStudioProfile } from "@/lib/scene3d/fitting-studio";
import type { FittingCameraApi } from "@/lib/scene3d/orbit-steps";
import { CameraSteps, Rig, humanStore, type Controls } from "@/components/three/fitting-camera";
import { useI18n } from "@/lib/i18n/i18n";
import { sizedPieces } from "@/lib/tryon/sizes";
import { FittingStudioLights, FittingStudioRoom } from "@/components/three/fitting-studio-room";

/** Browser Three.js fitting studio in metres. Architecture is conceptual, not a
 * reconstruction of a physical store. Catalogue photos are framed references;
 * parametric clothing on the avatar remains a visual preview, not a fitted asset.
 */
type V3 = [number, number, number];

/** Quadros com as fotos do catálogo na parede do fundo: só para revisão e desenvolvimento (laboratório das cenas ou
 *  NEXT_PUBLIC_FITTING_REFERENCES=1). No produto, a cabine não mostra fotos de catálogo — nem a pessoa fotografada. */
export const SHOW_CATALOG_REFERENCES = process.env.NEXT_PUBLIC_FITTING_REFERENCES === "1";

export default function FittingRoomScene({ avatar, sex, build, skinTone, body, pieces, environment, scene, light = "store", view = "front", onCanvas, onProfile, onHuman, debug, cameraYaw, closeUp = false, onCamera, references = SHOW_CATALOG_REFERENCES }: {
  avatar: Avatar3dRef | null; sex: "FEMININO" | "MASCULINO"; build?: string | null; skinTone?: string | null; body?: BodyParams | null;
  pieces: Look3dPiece[]; environment: ResolvedEnvironment; scene?: StoreScene | null; light?: LightMode; view?: AvatarView; onCanvas?: (c: HTMLCanvasElement) => void;
  /** o perfil do estúdio desenhado (objetos com função, paleta, fotos de referência) — inventário da auditoria */
  onProfile?: (profile: FittingStudioProfile) => void;
  /** recebe o humano já montado para métricas/GLB da prévia */
  onHuman?: (parts: HumanParts) => void;
  /** laboratório/auditoria: wireframe, corpo oculto, pesos e poses de verificação (components/three/scene-debug.tsx) */
  debug?: SceneDebugOptions | null;
  /** laboratório: ângulo livre da câmera (graus) para o giro de 360°, e enquadramento só do avatar */
  cameraYaw?: number; closeUp?: boolean;
  /** botões de acessibilidade do palco: recebem os passos de câmera (girar 30°, aproximar, voltar à frente) e a câmera de detalhe */
  onCamera?: (api: FittingCameraApi | null) => void;
  /** quadros de referência do catálogo (revisão/desenvolvimento) */
  references?: boolean;

}) {
  const { t } = useI18n(), asset = useBodyAsset(), reduced = useReducedMotion(), controls = useRef<Controls>(null);
  const [parts, setParts] = useState<HumanParts | null>(null), human = useMemo(humanStore, []);
  sex = avatar?.model?.sex ?? sex;
  const params = body ?? bodyParamsOf({ sex, build, avatar }), height = buildSpec(params).stature;
  // tamanho escolhido × este corpo: a diferença em tamanhos vira folga e comprimento no molde (lib/tryon/sizes.ts)
  const paramsKey = JSON.stringify(params);
  // medidas de fita informadas em Meu Avatar valem mais que a estimativa pelo corpo
  const measured = validateBody(avatar?.model?.body)?.measuresCm ?? null, measuredKey = JSON.stringify(measured);
  const sized = useMemo(() => sizedPieces(pieces, params, sex, measured), [pieces, paramsKey, sex, measuredKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // alvo estável: um array novo a cada render fazia o Rig recolocar a câmera no preset e desfazer o giro da pessoa
  const target = useMemo<V3>(() => closeUp ? [0, height * .52, 0] : [0, height * .60, 0], [closeUp, height]), dist = closeUp ? height * 1.55 : height * 2.2;
  const env = scene?.brand ?? environment.featured, profile = resolveFittingStudio(env, scene);
  useEffect(() => { onProfile?.(profile); }, [profile.brand.key, profile.photographs.map((p) => p.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!asset || asset === "error") return <div role="status" className="grid h-full content-center justify-items-center gap-3 p-6 text-center">
    <p>{t(asset === "error" ? "tryOn.avatar_load_failed" : "tryOn.avatar_loading")}</p>
    {asset === "error" && <button type="button" className="btn btn-sm" onClick={() => window.location.reload()}>{t("common.retry")}</button>}
  </div>;
  return <div className="relative h-full">
    <Canvas shadows camera={{ fov: 32, near: .05, far: 30, position: [0, target[1], dist] }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.toneMappingExposure = 1; onCanvas?.(gl.domElement); }} aria-label={t("tryOn.cena_aria", { marca: env.name })}>
      <color attach="background" args={[profile.palette.wall]} /><fog attach="fog" args={[profile.palette.wall, 9, 18]} />
      <FittingStudioLights light={light} /><FittingStudioRoom key={env.key} profile={profile} target={target} references={references} />
      <group name="fitting-avatar">
        <Mannequin mannequin={{ sex, build: build ?? "MEDIUM", skinTone: avatar ? null : skinTone ?? null, head: avatar ? "AVATAR" : "PADRAO", avatar }} pieces={sized} sway={false} body={params}
          fallback={null} still={!!debug?.pose} onHuman={(p) => { setParts(p); human.set(p); onHuman?.(p); }} />
      </group>
      {debug && <SceneDebug parts={parts} options={debug} />}
      <Rig view={view} target={target} dist={dist} yaw={cameraYaw} /><OrbitControls ref={controls} target={target} enablePan={false} minDistance={1.4} maxDistance={dist * 1.25} maxPolarAngle={Math.PI * .52} />
      <CameraSteps controls={controls} dist={dist} target={target} view={view} yaw={cameraYaw} reduced={reduced} human={human} onCamera={onCamera} />
    </Canvas>
    <p className="fitting-stage-tag pointer-events-none rounded-md bg-white/90 px-3 py-1 text-xs text-neutral-700">{t("tryOn.studio_conceptual")}</p>
  </div>;
}
