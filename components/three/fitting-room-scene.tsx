"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { StudioLight, rng, useCanvasTexture, useReducedMotion, useTex, type Avatar3dRef, type Look3dPiece } from "@/components/three/common";
import { Mannequin, bodyParamsOf } from "@/components/three/mannequin";
import { buildSpec, type BodyParams } from "@/lib/avatar3d/body-spec";
import type { BrandEnvironment, LightMode, ResolvedEnvironment, RoomStyle, WallMotif } from "@/lib/tryon/fitting-room";
import type { AvatarView } from "@/components/three/avatar-viewer";
import { AccessoryNiche, FeaturedPrint, FittingBench, FittingDoor, PhotoTable, ShoeShelves, ZonePhotoWall, ZoneSign } from "@/components/three/store-fixtures";
import type { StoreScene } from "@/lib/scene3d/scene";
import { ROOM, planStore, type FixturePlan, type StorePlan } from "@/lib/scene3d/store-plan";
import { useI18n } from "@/lib/i18n/i18n";
import { SceneDebug, type SceneDebugOptions } from "@/components/three/scene-debug";
import type { HumanParts } from "@/components/three/human-avatar";

/*
 * Provador virtual de lojas (RF18): o Avatar 3D da pessoa num provador que muda conforme a marca do que ela prova.
 *  - Parede do fundo: o painel da marca em destaque (logo do catálogo ou o nome escrito), com o padrão de parede do tema.
 *  - Letreiro iluminado com o nome da marca, faixa de luz no teto e anel do palco na cor de destaque.
 *  - Outras marcas vestidas: painéis menores nas laterais (provador multimarca).
 *  - Cenografia de loja: cortina de provador, espelho de corpo inteiro, arara com cabides, banco e piso no estilo da loja.
 *  - Trocar de marca anima as cores (e o painel entra com uma escala suave); "reduzir movimento" troca na hora.
 * Tudo é desenhado no navegador (texturas em canvas, sem baixar cenários); a roupa no corpo é a prévia projetada do Mannequin.
 *
 * Com `scene` (perfil do motor de cenas, `lib/scene3d`), a Busca Catalogada monta a loja: a marca da busca é o contexto,
 * a categoria vira a zona e o produto escolhido vai para o cavalete ao lado do avatar. Sem `scene`, a marca da última
 * peça vestida.
 *
 * A sala só desenha o PLANO (lib/scene3d/store-plan.ts): cada objeto tem função (exposição, organização, circulação,
 * prova, comunicação, iluminação); fotos de catálogo só em suportes (quadro, bloco, cavalete); loja de marca sem nada de
 * outra marca; luz colorida só na parede da marca (a roupa é vista em luz branca — a paleta da loja não tinge a peça).
 */

const ANGLE: Record<AvatarView, number> = { front: 0, left34: -35, right34: 35, profile: 90, back: 180 };
const BACK_Z = ROOM.backZ, WALL_H = ROOM.height, ROOM_W = ROOM.width, SIDE_X = ROOM.sideX;

function Rig({ view, target, dist, yaw }: { view: AvatarView; target: [number, number, number]; dist: number; yaw?: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const a = ((yaw ?? ANGLE[view]) * Math.PI) / 180;
    camera.position.set(target[0] + Math.sin(a) * dist, target[1] + 0.12, target[2] + Math.cos(a) * dist);
    camera.lookAt(...target); camera.updateProjectionMatrix();
  }, [view, camera, target, dist, yaw]);
  return null;
}

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
  const logo = useTex(env.logoUrl);
  const word = useWordmark(env.name, env.ink, null);
  const group = useRef<THREE.Group>(null);
  const born = useRef(0);
  useEffect(() => { born.current = 0; if (group.current) group.current.scale.setScalar(reduced ? 1 : 0.86); }, [env.key, reduced]);
  useFrame((_, dt) => { if (reduced || !group.current) return; born.current = Math.min(1, born.current + dt * 2.4); const s = 0.86 + 0.14 * (1 - Math.pow(1 - born.current, 3)); group.current.scale.setScalar(s); });
  const aspect = logo?.image ? (logo.image as HTMLImageElement).width / Math.max(1, (logo.image as HTMLImageElement).height) : 1;
  const lw = Math.min(width * 0.72, height * 0.62 * aspect), lh = lw / Math.max(0.2, aspect);
  return (
    <group ref={group} position={position} rotation={[0, rotationY, 0]}>
      <mesh><planeGeometry args={[width + 0.08, height + 0.08]} /><meshStandardMaterial color={env.accent} roughness={0.4} /></mesh>
      <mesh position={[0, 0, 0.005]}><planeGeometry args={[width, height]} /><meshStandardMaterial color={env.wall} roughness={0.6} /></mesh>
      {logo ? (
        <>
          <mesh position={[0, height * 0.1, 0.012]}><planeGeometry args={[lw, lh]} /><meshBasicMaterial map={logo} transparent toneMapped={false} /></mesh>
          <mesh position={[0, -height * 0.36, 0.012]}><planeGeometry args={[width * 0.86, height * 0.2]} /><meshBasicMaterial map={word} transparent toneMapped={false} /></mesh>
        </>
      ) : <mesh position={[0, 0, 0.012]}><planeGeometry args={[width * 0.92, width * 0.92 * 0.3125]} /><meshBasicMaterial map={word} transparent toneMapped={false} /></mesh>}
    </group>
  );
}

/** Cortina de provador (pregas por cosseno) presa num trilho, na cor de destaque misturada à parede. */
function Curtain({ env, reduced }: { env: BrandEnvironment; reduced: boolean }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.5, 2.6, 60, 1); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.cos(p.getX(i) * 18) * 0.05);
    g.computeVertexNormals(); return g;
  }, []);
  const color = useMemo(() => new THREE.Color(env.accent).lerp(new THREE.Color(env.wall), 0.45).getStyle(), [env.accent, env.wall]);
  const mat = useLerpColor(color, reduced);
  return (
    <group position={[-2.35, 0, -0.6]} rotation={[0, Math.PI / 2.6, 0]}>
      <mesh position={[0, 2.72, 0]}><cylinderGeometry args={[0.015, 0.015, 1.7, 8]} /><meshStandardMaterial color="#B8B2A7" metalness={0.8} roughness={0.25} /></mesh>
      <mesh position={[0, 1.38, 0]} geometry={geo} castShadow><meshStandardMaterial ref={mat as React.Ref<THREE.MeshStandardMaterial>} side={THREE.DoubleSide} roughness={0.9} /></mesh>
    </group>
  );
}

/** Espelho de corpo inteiro (metal polido refletindo o ambiente) com moldura na cor de destaque. */
function Mirror({ env, left = false }: { env: BrandEnvironment; left?: boolean }) {
  return (
    <group position={left ? [-2.75, 1.1, 0.75] : [2.3, 1.1, -0.75]} rotation={[0, left ? Math.PI / 2.2 : -Math.PI / 2.8, 0]}>
      <mesh><boxGeometry args={[0.84, 2.14, 0.05]} /><meshStandardMaterial color={env.accent} roughness={0.35} /></mesh>
      {/* vidro do espelho: claro e liso (sem mapa de ambiente, metal puro sairia preto) */}
      <mesh position={[0, 0, 0.028]}><planeGeometry args={[0.74, 2.02]} /><meshStandardMaterial color="#D6DEE5" metalness={0.15} roughness={0.08} emissive="#9FB0BE" emissiveIntensity={0.18} /></mesh>
    </group>
  );
}

function Room({ env, plan, light, reduced }: { env: BrandEnvironment; plan: StorePlan; light: LightMode; reduced: boolean }) {
  const { t } = useI18n();
  const wallTex = useWallTexture(env.motif, env.wall, env.accent, [ROOM_W / 2.4, WALL_H / 2.4]);
  const sideTex = useWallTexture(env.motif, env.wall, env.accent, [1.6, WALL_H / 2.4]);
  const floorTex = useFloorTexture(env.style, env.floor, env.accent);
  const accentStrip = useLerpColor(env.accent, reduced);
  const ring = useLerpColor(env.accent, reduced);
  const brand = env.key === "neutral" ? null : env.name;
  const draw = (x: FixturePlan) => {
    switch (x.kind) {
      case "piso": return <mesh key={x.id} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[ROOM_W, ROOM.depth]} /><meshStandardMaterial map={floorTex} roughness={env.style === "gallery" ? 0.18 : env.style === "boutique" ? 0.3 : 0.75} /></mesh>;
      case "paredes": return (
        <group key={x.id}>
          <mesh position={[0, WALL_H / 2, BACK_Z]} receiveShadow><planeGeometry args={[ROOM_W, WALL_H]} /><meshStandardMaterial map={wallTex} roughness={0.85} /></mesh>
          <mesh position={[-SIDE_X, WALL_H / 2, 1.1]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[ROOM.depth, WALL_H]} /><meshStandardMaterial map={sideTex} roughness={0.85} /></mesh>
          <mesh position={[SIDE_X, WALL_H / 2, 1.1]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[ROOM.depth, WALL_H]} /><meshStandardMaterial map={sideTex} roughness={0.85} /></mesh>
        </group>);
      case "teto": return <mesh key={x.id} position={[0, WALL_H, 1.1]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[ROOM_W, ROOM.depth]} /><meshStandardMaterial color={light === "night" ? "#121316" : "#F3F1EC"} /></mesh>;
      case "trilho-de-luz": return <mesh key={x.id} position={x.position} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[x.size[0], x.size[2]]} /><meshBasicMaterial color="#FFF6E8" toneMapped={false} /></mesh>;
      case "luz-de-parede": return <WallWash key={x.id} accent={env.accent} light={light} position={x.position} />;
      case "faixa-de-luz": return <mesh key={x.id} position={x.position}><planeGeometry args={[x.size[0], x.size[1]]} /><meshBasicMaterial ref={accentStrip as React.Ref<THREE.MeshBasicMaterial>} toneMapped={false} /></mesh>;
      case "parede-da-marca": return <BrandPanel key={`${x.id}:${env.key}`} env={env} position={x.position} width={x.size[0]} height={x.size[1]} reduced={reduced} />;
      case "palco-de-prova": return (
        <group key={x.id}>
          <mesh position={x.position} receiveShadow><cylinderGeometry args={[0.72, 0.76, x.size[1], 64]} /><meshStandardMaterial color={light === "night" ? "#1B1C20" : "#F6F3EE"} roughness={0.35} /></mesh>
          <mesh position={[0, 0.042, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.66, 0.72, 64]} /><meshBasicMaterial ref={ring as React.Ref<THREE.MeshBasicMaterial>} toneMapped={false} /></mesh>
        </group>);
      case "cabine-cortina": return <Curtain key={x.id} env={env} reduced={reduced} />;
      case "espelho": return <Mirror key={x.id} env={env} left={x.position[0] < 0} />;
      case "porta-provadores": return <FittingDoor key={x.id} env={env} position={x.position} label={t("scene3d.provadores")} />;
      case "banco-de-prova": return <FittingBench key={x.id} env={env} position={x.position} />;
      case "placa-da-zona": return <ZoneSign key={x.id} label={t(x.labelKey ?? "scene3d.destaque")} brand={brand} env={env} position={x.position} width={x.size[0]} />;
      case "prateleiras-calcados": return <ShoeShelves key={x.id} env={env} products={x.products ?? []} position={x.position} />;
      case "quadros-da-zona": return <ZonePhotoWall key={x.id} env={env} products={x.products ?? []} position={x.position} />;
      case "mesa-de-fotos": return <PhotoTable key={x.id} env={env} products={x.products ?? []} position={x.position} rotationY={x.rotationY} />;
      case "nicho-acessorios": return <AccessoryNiche key={x.id} env={env} products={x.products ?? []} position={x.position} rotationY={x.rotationY} />;
      case "foto-em-destaque": return x.products?.[0] ? <FeaturedPrint key={x.id} env={env} product={x.products[0]} position={x.position} rotationY={x.rotationY} label={t("scene3d.destaque")} /> : null;
      case "paineis-multimarca": return (
        <group key={x.id}>
          {(x.brands ?? []).map((o, i) => {
            const slot: { position: [number, number, number]; rotationY: number }[] = [
              { position: [1.75, 1.45, BACK_Z + 0.02], rotationY: 0 }, { position: [1.75, 0.6, BACK_Z + 0.02], rotationY: 0 }, { position: [-SIDE_X + 0.03, 1.9, 0.3], rotationY: Math.PI / 2 },
            ];
            return <BrandPanel key={o.key} env={o} position={slot[i].position} width={x.size[0]} height={x.size[1]} reduced={reduced} rotationY={slot[i].rotationY} />;
          })}
        </group>);
      default: return null;
    }
  };
  return <group>{plan.fixtures.map(draw)}</group>;
}

/** Luz na cor da marca só lavando a parede do fundo (spot de cima para a parede): não alcança o avatar no palco. */
function WallWash({ accent, light, position }: { accent: string; light: LightMode; position: [number, number, number] }) {
  const target = useMemo(() => { const o = new THREE.Object3D(); o.position.set(position[0], 0.9, BACK_Z); return o; }, [position]);
  return (
    <>
      <primitive object={target} />
      <spotLight position={position} target={target} color={accent} angle={0.9} penumbra={0.8} intensity={light === "night" ? 6 : 2.5} distance={3.2} decay={2} />
    </>
  );
}

/** Luz por modo: loja (spots quentes), luz do dia (clara e fria) e noite (baixa). Só luz branca/quente alcança o avatar. */
function Lights({ light }: { light: LightMode }) {
  const night = light === "night", day = light === "daylight";
  return (
    <>
      <StudioLight intensity={night ? 0.18 : day ? 0.7 : 0.45} />
      <hemisphereLight args={[day ? "#EAF3FF" : "#FFF4E6", night ? "#101114" : "#CFC6B8", night ? 0.12 : day ? 0.75 : 0.45]} />
      <spotLight position={[0, WALL_H - 0.1, 1.1]} angle={0.55} penumbra={0.6} intensity={night ? 14 : day ? 6 : 11} color={day ? "#FFFFFF" : "#FFE8CC"} castShadow target-position={[0, 0.8, 0]} />
      <directionalLight position={[1.4, 2.6, 3]} intensity={night ? 0.25 : day ? 0.9 : 0.55} />
      <directionalLight position={[-1.6, 2.0, 2.4]} intensity={night ? 0.15 : 0.35} />
    </>
  );
}

export default function FittingRoomScene({ avatar, sex, build, skinTone, body, pieces, environment, scene, light = "store", view = "front", onCanvas, onPlan, debug, cameraYaw, closeUp = false }: {
  avatar: Avatar3dRef | null; sex: "FEMININO" | "MASCULINO"; build?: string | null; skinTone?: string | null; body?: BodyParams | null;
  pieces: Look3dPiece[]; environment: ResolvedEnvironment; scene?: StoreScene | null; light?: LightMode; view?: AvatarView; onCanvas?: (c: HTMLCanvasElement) => void;
  /** o plano da loja desenhado (inventário dos objetos com função) */
  onPlan?: (plan: StorePlan) => void;
  /** laboratório/auditoria: wireframe, corpo oculto, pesos e poses de verificação (components/three/scene-debug.tsx) */
  debug?: SceneDebugOptions | null;
  /** laboratório: ângulo livre da câmera (graus) para o giro de 360°, e enquadramento só do avatar */
  cameraYaw?: number; closeUp?: boolean;
}) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  sex = avatar?.model?.sex ?? sex;
  const params = body ?? bodyParamsOf({ sex, build, avatar });
  const H = buildSpec(params).stature;
  const target: [number, number, number] = [0, H * (closeUp ? 0.52 : 0.56), 0];
  const dist = H * (closeUp ? 1.75 : 2.7);
  const [parts, setParts] = useState<HumanParts | null>(null);
  const env = scene?.brand ?? environment.featured;
  const others = scene ? scene.others : environment.others;
  const plan = useMemo(() => planStore(env, others, scene ?? null), [env, others, scene]);
  useEffect(() => { onPlan?.(plan); }, [plan, onPlan]);
  return (
    <Canvas shadows camera={{ fov: 32, near: 0.05, far: 30, position: [0, target[1], dist] }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.toneMappingExposure = 1; onCanvas?.(gl.domElement); }}
      aria-label={t("tryOn.cena_aria", { marca: env.name })}>
      <color attach="background" args={[light === "night" ? "#0B0C0F" : env.wall]} />
      <fog attach="fog" args={[light === "night" ? "#0B0C0F" : env.wall, 9, 18]} />
      <Lights light={light} />
      <Room env={env} plan={plan} light={light} reduced={reduced} />
      <group position={[0, 0.04, 0]}>
        <Mannequin mannequin={{ sex, build: build ?? "MEDIUM", skinTone: avatar ? null : skinTone ?? null, head: avatar ? "AVATAR" : "PADRAO", avatar }} pieces={pieces} sway={false} body={params} fallback={null} still={!!debug?.pose} onHuman={setParts} />
      </group>
      {debug && <SceneDebug parts={parts} options={debug} />}
      <Rig view={view} target={target} dist={dist} yaw={cameraYaw} />
      <OrbitControls target={target} enablePan={false} minDistance={1.4} maxDistance={dist * 1.25} maxPolarAngle={Math.PI * 0.52} />
    </Canvas>
  );
}
