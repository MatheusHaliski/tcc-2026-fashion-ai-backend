"use client";
import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { StudioLight, useCanvasTexture, useTex, type Avatar3dRef, type Look3dPiece } from "@/components/three/common";
import { Mannequin, bodyParamsOf } from "@/components/three/mannequin";
import { useBodyAsset } from "@/components/three/human-avatar";
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
function Rig({ view, target, dist }: { view: AvatarView; target: [number, number, number]; dist: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const angle = ANGLE[view] * Math.PI / 180;
    camera.position.set(target[0] + Math.sin(angle) * dist, target[1] + .12, target[2] + Math.cos(angle) * dist);
    camera.lookAt(...target); camera.updateProjectionMatrix();
  }, [view, camera, target, dist]);
  return null;
}

<<<<<<< HEAD
/** Material cuja cor caminha até o alvo (transição de marca); com movimento reduzido, troca na hora. */
function useLerpColor(target: string, reduced: boolean) {
  const ref = useRef<THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | null>(null);
  const goal = useMemo(() => new THREE.Color(target), [target]);
  useEffect(() => { if (reduced && ref.current) ref.current.color.copy(goal); }, [goal, reduced]);
  useFrame((_, dt) => { if (!reduced && ref.current) ref.current.color.lerp(goal, Math.min(1, dt * 3.2)); });
  return ref;
}

/** Padrão da parede desenhado em canvas (cores do tema). */
function useWallTexture(motif: WallMotif, wall: string, accent: string, repeat: [number, number]) {
  const tex = useCanvasTexture((g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    const tint = (alpha: number, c = accent) => { g.globalAlpha = alpha; g.fillStyle = c; g.strokeStyle = c; };
    if (motif === "stripes") { tint(0.18); for (let x = -h; x < w; x += 64) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + h, 0); g.lineTo(x + h + 22, 0); g.lineTo(x + 22, h); g.fill(); } }
    else if (motif === "checker") { tint(0.85, "#F4F1EA"); const s = 32; for (let y = 0; y < h; y += s) for (let x = (y / s) % 2 ? s : 0; x < w; x += s * 2) g.fillRect(x, y, s, s); }
    else if (motif === "denim") { tint(0.16, "#FFFFFF"); g.lineWidth = 2; for (let x = -h; x < w; x += 7) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + h, 0); g.stroke(); } tint(0.5); g.setLineDash([10, 8]); g.lineWidth = 3; for (let y = 40; y < h; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.setLineDash([]); }
    else if (motif === "court") { tint(0.55); g.lineWidth = 5; g.strokeRect(24, 24, w - 48, h - 48); g.beginPath(); g.arc(w / 2, h / 2, h / 4, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(w / 2, 24); g.lineTo(w / 2, h - 24); g.stroke(); }
    else if (motif === "grid") { tint(0.14, wall === "#FFFFFF" ? "#000000" : accent); g.lineWidth = 2; for (let x = 0; x < w; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }
    else if (motif === "chevron") { tint(0.2); g.lineWidth = 10; for (let y = 0; y < h + 60; y += 60) { g.beginPath(); for (let x = 0; x <= w; x += 60) g.lineTo(x, y + ((x / 60) % 2 ? 30 : 0)); g.stroke(); } }
    g.globalAlpha = 1;
  }, 512, 256, [motif, wall, accent]);
  useEffect(() => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); tex.needsUpdate = true; }, [tex, repeat]);
  return tex;
}

/** Piso pelo estilo da loja: quadra, tábuas, concreto, mármore, galeria polida ou ateliê. */
function useFloorTexture(style: RoomStyle, floor: string, accent: string) {
  const tex = useCanvasTexture((g, w, h) => {
    g.fillStyle = floor; g.fillRect(0, 0, w, h); const r = rng(w + style.length * 97);
    if (style === "arena") { g.strokeStyle = accent; g.globalAlpha = 0.5; g.lineWidth = 6; g.strokeRect(30, 30, w - 60, h - 60); g.beginPath(); g.arc(w / 2, h / 2, 90, 0, Math.PI * 2); g.stroke(); }
    else if (style === "heritage") { g.strokeStyle = "#000"; g.globalAlpha = 0.22; g.lineWidth = 3; for (let y = 0; y < h; y += 42) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); const off = r() * 200; for (let x = off; x < w; x += 220) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 42); g.stroke(); } } }
    else if (style === "street") { for (let i = 0; i < 2600; i++) { g.globalAlpha = 0.05 + r() * 0.08; g.fillStyle = r() > 0.5 ? "#FFF" : "#000"; g.fillRect(r() * w, r() * h, 2, 2); } }
    else if (style === "boutique") { g.strokeStyle = "#7d7363"; g.globalAlpha = 0.25; g.lineWidth = 1.5; for (let i = 0; i < 14; i++) { g.beginPath(); let x = r() * w, y = 0; g.moveTo(x, y); while (y < h) { x += (r() - 0.5) * 40; y += 24; g.lineTo(x, y); } g.stroke(); } }
    else if (style === "gallery") { g.globalAlpha = 0.1; g.fillStyle = "#fff"; g.fillRect(0, 0, w, h / 2); }
    g.globalAlpha = 1;
  }, 512, 512, [style, floor, accent]);
  useEffect(() => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 2); tex.needsUpdate = true; }, [tex]);
  return tex;
}

/** Nome da marca escrito (sem fonte remota): letreiro e o painel quando o catálogo não tem logo. */
function useWordmark(name: string, ink: string, bg: string | null, w = 1024, h = 320) {
  return useCanvasTexture((g, W, H) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); } else g.clearRect(0, 0, W, H);
    const label = name ?? ""; const text = label.length > 22 ? `${label.slice(0, 21)}…` : label;
    let size = Math.round(H * 0.5); g.font = `800 ${size}px Inter, Arial, sans-serif`;
    while (g.measureText(text.toUpperCase()).width > W * 0.88 && size > 24) { size -= 4; g.font = `800 ${size}px Inter, Arial, sans-serif`; }
    g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text.toUpperCase(), W / 2, H / 2 + 4);
  }, w, h, [name, ink, bg]);
}

/** Painel de marca: o logo do catálogo (se carregar) sobre o fundo, ou o nome escrito; entra com escala suave. */
function BrandPanel({ env, position, width, height, reduced, rotationY = 0 }: { env: BrandEnvironment; position: [number, number, number]; width: number; height: number; reduced: boolean; rotationY?: number }) {
=======
function IdentityPlaque({ env }: { env: BrandEnvironment }) {
>>>>>>> origin/main
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

export default function FittingRoomScene({ avatar, sex, build, skinTone, body, pieces, environment, scene, light = "store", view = "front", onCanvas }: {
  avatar: Avatar3dRef | null; sex: "FEMININO" | "MASCULINO"; build?: string | null; skinTone?: string | null; body?: BodyParams | null;
  pieces: Look3dPiece[]; environment: ResolvedEnvironment; scene?: StoreScene | null; light?: LightMode; view?: AvatarView; onCanvas?: (c: HTMLCanvasElement) => void;
}) {
  const { t } = useI18n(), asset = useBodyAsset();
  sex = avatar?.model?.sex ?? sex;
  const params = body ?? bodyParamsOf({ sex, build, avatar }), height = buildSpec(params).stature;
  const target: [number, number, number] = [0, height * .60, 0], dist = height * 2.2;
  const env = scene?.brand ?? environment.featured, profile = resolveFittingStudio(env, scene);
  if (!asset || asset === "error") return <div role="status" className="grid h-full content-center justify-items-center gap-3 p-6 text-center">
    <p>{t(asset === "error" ? "tryOn.avatar_load_failed" : "tryOn.avatar_loading")}</p>
    {asset === "error" && <button type="button" className="btn btn-sm" onClick={() => window.location.reload()}>{t("common.retry")}</button>}
  </div>;
  return <div className="relative h-full">
    <Canvas shadows camera={{ fov: 32, near: .05, far: 30, position: [0, target[1], dist] }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.toneMappingExposure = 1; onCanvas?.(gl.domElement); }} aria-label={t("tryOn.cena_aria", { marca: env.name })}>
      <color attach="background" args={[profile.palette.wall]} /><fog attach="fog" args={[profile.palette.wall, 9, 18]} />
      <Lights light={light} /><Room key={env.key} profile={profile} />
      <Mannequin mannequin={{ sex, build: build ?? "MEDIUM", skinTone: avatar ? null : skinTone ?? null, head: avatar ? "AVATAR" : "PADRAO", avatar }} pieces={pieces} sway={false} body={params} />
      <Rig view={view} target={target} dist={dist} /><OrbitControls target={target} enablePan={false} minDistance={1.4} maxDistance={dist * 1.25} maxPolarAngle={Math.PI * .52} />
    </Canvas>
    <p className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/90 px-3 py-1 text-xs text-neutral-700">{t("tryOn.studio_conceptual")}</p>
  </div>;
}
