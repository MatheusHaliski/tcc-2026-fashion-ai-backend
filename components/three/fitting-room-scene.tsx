"use client";
import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { StudioLight, useCanvasTexture, useTex, type Avatar3dRef, type Look3dPiece } from "@/components/three/common";
import { Mannequin, bodyParamsOf } from "@/components/three/mannequin";
import { useBodyAsset, type HumanParts } from "@/components/three/human-avatar";
import { SceneDebug, type SceneDebugOptions } from "@/components/three/scene-debug";
import { buildSpec, type BodyParams } from "@/lib/avatar3d/body-spec";
import type { BrandEnvironment, LightMode, ResolvedEnvironment } from "@/lib/tryon/fitting-room";
import type { AvatarView } from "@/components/three/avatar-viewer";
import { ReferenceGallery } from "@/components/three/store-fixtures";
import type { StoreScene } from "@/lib/scene3d/scene";
import { resolveFittingStudio, STUDIO_PALETTE, type FittingStudioProfile } from "@/lib/scene3d/fitting-studio";
import { useI18n } from "@/lib/i18n/i18n";

/** Browser Three.js fitting studio in metres. Architecture is conceptual, not a
 * reconstruction of a physical store. Catalogue photos are framed references;
 * parametric clothing on the avatar remains a visual preview, not a fitted asset.
 */
const ANGLE: Record<AvatarView, number> = { front: 0, left34: -35, right34: 35, profile: 90, back: 180 };
const BACK_Z = -1.9, WALL_H = 3.2, ROOM_W = 7.2, SIDE_X = 3.0;
function Rig({ view, target, dist, yaw }: { view: AvatarView; target: [number, number, number]; dist: number; yaw?: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const angle = (yaw ?? ANGLE[view]) * Math.PI / 180;
    camera.position.set(target[0] + Math.sin(angle) * dist, target[1] + .12, target[2] + Math.cos(angle) * dist);
    camera.lookAt(...target); camera.updateProjectionMatrix();
  }, [view, camera, target, dist, yaw]);
  return null;
}

function IdentityPlaque({ env }: { env: BrandEnvironment }) {
  const logo = useTex(env.logoUrl);
  const word = useCanvasTexture((g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = STUDIO_PALETTE.ink;
    let size = 108; g.font = `500 ${size}px Inter, Arial, sans-serif`;
    while (g.measureText(env.name).width > w * .88 && size > 24) { size -= 4; g.font = `500 ${size}px Inter, Arial, sans-serif`; }
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(env.name, w / 2, h / 2);
  }, 1024, 256, [env.name]);
  const image = logo?.image as HTMLImageElement | undefined;
  const aspect = image?.width ? image.width / Math.max(1, image.height) : 4;
  const width = Math.min(1.2, .32 * aspect);
  return <group name={`studio-identity-${env.key}`} position={[0, 2.48, BACK_Z + .03]}>
    <mesh><boxGeometry args={[1.48, .5, .03]} /><meshStandardMaterial color="#F7F5F0" roughness={.85} /></mesh>
    <mesh position={[0, -.25, .016]}><planeGeometry args={[1.48, .012]} /><meshStandardMaterial color={env.accent} roughness={.8} /></mesh>
    <mesh position={[0, 0, .019]}><planeGeometry args={logo ? [width, width / aspect] : [1.36, .34]} /><meshBasicMaterial map={logo ?? word} transparent toneMapped={false} /></mesh>
  </group>;
}

function Mirror() {
  return <group name="studio-full-height-mirror" position={[2.55, 1.18, -.6]} rotation={[0, -.7, 0]}>
    <mesh><boxGeometry args={[.82, 2.18, .04]} /><meshStandardMaterial color={STUDIO_PALETTE.metal} metalness={.6} roughness={.35} /></mesh>
    <mesh position={[0, 0, .025]}><planeGeometry args={[.75, 2.1]} /><meshStandardMaterial color="#ECEEEB" metalness={1} roughness={.04} /></mesh>
  </group>;
}
function BenchAndRail({ palette }: { palette: FittingStudioProfile["palette"] }) {
  return <group name="studio-bench-and-hangers" position={[-1.48, 0, BACK_Z + .43]}>
    <mesh position={[0, .46, 0]} castShadow><boxGeometry args={[1.05, .10, .43]} /><meshStandardMaterial color={palette.furniture} roughness={.75} /></mesh>
    {[-.43, .43].map(x => <mesh key={x} position={[x, .22, 0]}><boxGeometry args={[.045, .44, .34]} /><meshStandardMaterial color={palette.metal} roughness={.6} /></mesh>)}
    <mesh position={[0, 1.7, -.25]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.012, .012, 1.1, 10]} /><meshStandardMaterial color={palette.metal} metalness={.6} roughness={.35} /></mesh>
    {[-.3, 0, .3].map(x => <group key={x} position={[x, 1.67, -.25]}>
      <mesh position={[0, -.035, 0]}><torusGeometry args={[.026, .005, 6, 12, Math.PI * 1.4]} /><meshStandardMaterial color={palette.metal} /></mesh>
      <mesh position={[-.075, -.13, 0]} rotation={[0, 0, -.55]}><boxGeometry args={[.18, .014, .018]} /><meshStandardMaterial color={palette.furniture} /></mesh>
      <mesh position={[.075, -.13, 0]} rotation={[0, 0, .55]}><boxGeometry args={[.18, .014, .018]} /><meshStandardMaterial color={palette.furniture} /></mesh>
    </group>)}
  </group>;
}
function Room({ profile }: { profile: FittingStudioProfile }) {
  const { t } = useI18n(), p = profile.palette;
  return <group name="conceptual-fitting-studio">
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[ROOM_W, 6]} /><meshStandardMaterial color={p.floor} roughness={.88} /></mesh>
    <mesh position={[0, WALL_H / 2, BACK_Z]} receiveShadow><planeGeometry args={[ROOM_W, WALL_H]} /><meshStandardMaterial color={p.wall} roughness={.94} /></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * SIDE_X, WALL_H / 2, 1.1]} rotation={[0, -side * Math.PI / 2, 0]}><planeGeometry args={[6, WALL_H]} /><meshStandardMaterial color={p.wall} roughness={.94} /></mesh>)}
    <mesh position={[0, WALL_H, 1.1]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[ROOM_W, 6]} /><meshStandardMaterial color={p.ceiling} roughness={.95} /></mesh>
    <mesh position={[0, .02, BACK_Z + .02]}><boxGeometry args={[ROOM_W, .04, .025]} /><meshStandardMaterial color="#7C776F" roughness={.75} /></mesh>
    <IdentityPlaque env={profile.brand} />
    <Mirror /><BenchAndRail palette={p} />
    <ReferenceGallery products={profile.photographs} label={t("tryOn.reference_images")} position={[1.72, 1.55, BACK_Z + .03]} />
  </group>;
}
/** All lights are neutral. Store identity never changes the apparel base colour. */
function Lights({ light }: { light: LightMode }) {
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

export default function FittingRoomScene({ avatar, sex, build, skinTone, body, pieces, environment, scene, light = "store", view = "front", onCanvas, onProfile, debug, cameraYaw, closeUp = false }: {
  avatar: Avatar3dRef | null; sex: "FEMININO" | "MASCULINO"; build?: string | null; skinTone?: string | null; body?: BodyParams | null;
  pieces: Look3dPiece[]; environment: ResolvedEnvironment; scene?: StoreScene | null; light?: LightMode; view?: AvatarView; onCanvas?: (c: HTMLCanvasElement) => void;
  /** o perfil do estúdio desenhado (objetos com função, paleta, fotos de referência) — inventário da auditoria */
  onProfile?: (profile: FittingStudioProfile) => void;
  /** laboratório/auditoria: wireframe, corpo oculto, pesos e poses de verificação (components/three/scene-debug.tsx) */
  debug?: SceneDebugOptions | null;
  /** laboratório: ângulo livre da câmera (graus) para o giro de 360°, e enquadramento só do avatar */
  cameraYaw?: number; closeUp?: boolean;
}) {
  const { t } = useI18n(), asset = useBodyAsset();
  const [parts, setParts] = useState<HumanParts | null>(null);
  sex = avatar?.model?.sex ?? sex;
  const params = body ?? bodyParamsOf({ sex, build, avatar }), height = buildSpec(params).stature;
  const target: [number, number, number] = closeUp ? [0, height * .52, 0] : [0, height * .60, 0], dist = closeUp ? height * 1.55 : height * 2.2;
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
      <Lights light={light} /><Room key={env.key} profile={profile} />
      <Mannequin mannequin={{ sex, build: build ?? "MEDIUM", skinTone: avatar ? null : skinTone ?? null, head: avatar ? "AVATAR" : "PADRAO", avatar }} pieces={pieces} sway={false} body={params}
        fallback={null} still={!!debug?.pose} onHuman={setParts} />
      {debug && <SceneDebug parts={parts} options={debug} />}
      <Rig view={view} target={target} dist={dist} yaw={cameraYaw} /><OrbitControls target={target} enablePan={false} minDistance={1.4} maxDistance={dist * 1.25} maxPolarAngle={Math.PI * .52} />
    </Canvas>
    <p className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/90 px-3 py-1 text-xs text-neutral-700">{t("tryOn.studio_conceptual")}</p>
  </div>;
}
