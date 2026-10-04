"use client";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { StudioLight, rng, useCanvasTexture, useReducedMotion, useTex, type Avatar3dRef, type Look3dPiece } from "@/components/three/common";
import { Mannequin, bodyParamsOf } from "@/components/three/mannequin";
import { buildSpec, type BodyParams } from "@/lib/avatar3d/body-spec";
import type { BrandEnvironment, LightMode, ResolvedEnvironment, RoomStyle, WallMotif } from "@/lib/tryon/fitting-room";
import type { AvatarView } from "@/components/three/avatar-viewer";
import { useI18n } from "@/lib/i18n/i18n";

/*
 * Provador virtual de lojas (RF18): o Avatar 3D da pessoa num provador que muda conforme a marca do que ela prova.
 *  - Parede do fundo: o painel da marca em destaque (logo do catálogo ou o nome escrito), com o padrão de parede do tema.
 *  - Letreiro iluminado com o nome da marca, faixa de luz no teto e anel do palco na cor de destaque.
 *  - Outras marcas vestidas: painéis menores nas laterais (provador multimarca).
 *  - Cenografia de loja: cortina de provador, espelho de corpo inteiro, arara com cabides, banco e piso no estilo da loja.
 *  - Trocar de marca anima as cores (e o painel entra com uma escala suave); "reduzir movimento" troca na hora.
 * Tudo é desenhado no navegador (texturas em canvas, sem baixar cenários); a roupa no corpo é a prévia projetada do Mannequin.
 */

const ANGLE: Record<AvatarView, number> = { front: 0, left34: -35, right34: 35, profile: 90, back: 180 };
const BACK_Z = -1.9, WALL_H = 3.2, ROOM_W = 7.2, SIDE_X = 3.0;

function Rig({ view, target, dist }: { view: AvatarView; target: [number, number, number]; dist: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const a = (ANGLE[view] * Math.PI) / 180;
    camera.position.set(target[0] + Math.sin(a) * dist, target[1] + 0.12, target[2] + Math.cos(a) * dist);
    camera.lookAt(...target); camera.updateProjectionMatrix();
  }, [view, camera, target, dist]);
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
    const text = name.length > 22 ? `${name.slice(0, 21)}…` : name;
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

/** Letreiro iluminado com o nome da marca em destaque (mais forte à noite). */
function NeonSign({ env, light }: { env: BrandEnvironment; light: LightMode }) {
  const word = useWordmark(env.name, env.accent, "#0E0F12", 1024, 192);
  return (
    <group position={[-2.05, 2.42, BACK_Z + 0.06]}>
      <mesh><boxGeometry args={[1.5, 0.3, 0.06]} /><meshStandardMaterial color="#0E0F12" roughness={0.3} /></mesh>
      <mesh position={[0, 0, 0.032]}><planeGeometry args={[1.44, 0.26]} /><meshBasicMaterial map={word} toneMapped={false} /></mesh>
      <pointLight position={[0, -0.2, 0.5]} color={env.accent} intensity={light === "night" ? 3.2 : 1.1} distance={3.4} />
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
function Mirror({ env }: { env: BrandEnvironment }) {
  return (
    <group position={[2.3, 1.1, -0.75]} rotation={[0, -Math.PI / 2.8, 0]}>
      <mesh><boxGeometry args={[0.84, 2.14, 0.05]} /><meshStandardMaterial color={env.accent} roughness={0.35} /></mesh>
      <mesh position={[0, 0, 0.028]}><planeGeometry args={[0.74, 2.02]} /><meshStandardMaterial color="#DCE3EA" metalness={1} roughness={0.04} /></mesh>
    </group>
  );
}

/** Arara com cabides e peças dobradas nas cores do tema (posições determinísticas por marca). */
function Rail({ env }: { env: BrandEnvironment }) {
  const items = useMemo(() => {
    const r = rng(env.key.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + 7);
    const palette = [env.accent, env.ink, new THREE.Color(env.accent).lerp(new THREE.Color("#ffffff"), 0.5).getStyle(), new THREE.Color(env.wall).lerp(new THREE.Color("#000000"), 0.35).getStyle()];
    return Array.from({ length: 7 }, (_, i) => ({ x: -0.62 + i * 0.2 + (r() - 0.5) * 0.04, color: palette[Math.floor(r() * palette.length)], len: 0.62 + r() * 0.3 }));
  }, [env.key, env.accent, env.ink, env.wall]);
  return (
    <group position={[1.75, 0, BACK_Z + 0.55]}>
      {[-0.78, 0.78].map((x) => <mesh key={x} position={[x, 0.82, 0]}><cylinderGeometry args={[0.018, 0.018, 1.64, 8]} /><meshStandardMaterial color="#9A948A" metalness={0.85} roughness={0.25} /></mesh>)}
      <mesh position={[0, 1.62, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.016, 0.016, 1.6, 8]} /><meshStandardMaterial color="#9A948A" metalness={0.85} roughness={0.25} /></mesh>
      {items.map((it, i) => (
        <group key={i} position={[it.x, 1.6, 0]}>
          <mesh position={[0, -0.04, 0]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.1, 0.006, 6, 16, Math.PI]} /><meshStandardMaterial color="#6E6A63" /></mesh>
          <mesh position={[0, -0.08 - it.len / 2, 0]} castShadow><boxGeometry args={[0.15, it.len, 0.34]} /><meshStandardMaterial color={it.color} roughness={0.85} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Bench({ env }: { env: BrandEnvironment }) {
  return (
    <group position={[-1.7, 0, BACK_Z + 0.75]}>
      <mesh position={[0, 0.22, 0]} castShadow><boxGeometry args={[1.1, 0.12, 0.42]} /><meshStandardMaterial color={env.style === "heritage" ? "#7A5236" : "#3B3D42"} roughness={0.6} /></mesh>
      {[-0.45, 0.45].map((x) => <mesh key={x} position={[x, 0.1, 0]}><boxGeometry args={[0.06, 0.2, 0.36]} /><meshStandardMaterial color="#2A2B2F" /></mesh>)}
      <mesh position={[0.25, 0.33, 0]} castShadow><boxGeometry args={[0.34, 0.1, 0.26]} /><meshStandardMaterial color={env.accent} roughness={0.7} /></mesh>
    </group>
  );
}

function Room({ env, others, light, reduced }: { env: BrandEnvironment; others: BrandEnvironment[]; light: LightMode; reduced: boolean }) {
  const wallTex = useWallTexture(env.motif, env.wall, env.accent, [ROOM_W / 2.4, WALL_H / 2.4]);
  const sideTex = useWallTexture(env.motif, env.wall, env.accent, [1.6, WALL_H / 2.4]);
  const floorTex = useFloorTexture(env.style, env.floor, env.accent);
  const accentStrip = useLerpColor(env.accent, reduced);
  const ring = useLerpColor(env.accent, reduced);
  const sidePos: { position: [number, number, number]; rotationY: number }[] = [
    { position: [-2.2, 1.5, BACK_Z + 0.02], rotationY: 0 },
    { position: [2.2, 2.3, BACK_Z + 0.02], rotationY: 0 },
    { position: [-SIDE_X + 0.03, 1.9, 0.3], rotationY: Math.PI / 2 },
  ];
  return (
    <group>
      {/* piso, paredes e teto */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[ROOM_W, 6]} /><meshStandardMaterial map={floorTex} roughness={env.style === "gallery" ? 0.18 : env.style === "boutique" ? 0.3 : 0.75} /></mesh>
      <mesh position={[0, WALL_H / 2, BACK_Z]} receiveShadow><planeGeometry args={[ROOM_W, WALL_H]} /><meshStandardMaterial map={wallTex} roughness={0.85} /></mesh>
      <mesh position={[-SIDE_X, WALL_H / 2, 1.1]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[6, WALL_H]} /><meshStandardMaterial map={sideTex} roughness={0.85} /></mesh>
      <mesh position={[SIDE_X, WALL_H / 2, 1.1]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[6, WALL_H]} /><meshStandardMaterial map={sideTex} roughness={0.85} /></mesh>
      <mesh position={[0, WALL_H, 1.1]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[ROOM_W, 6]} /><meshStandardMaterial color={light === "night" ? "#121316" : "#F3F1EC"} /></mesh>
      {/* faixa de luz no teto e rodapé iluminado na cor da marca */}
      <mesh position={[0, WALL_H - 0.02, 0.2]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[3.6, 0.08]} /><meshBasicMaterial ref={accentStrip as React.Ref<THREE.MeshBasicMaterial>} toneMapped={false} /></mesh>
      <mesh position={[0, 0.03, BACK_Z + 0.01]}><planeGeometry args={[ROOM_W, 0.05]} /><meshBasicMaterial color={env.accent} toneMapped={false} /></mesh>
      {/* palco do avatar com anel na cor de destaque */}
      <mesh position={[0, 0.02, 0]} receiveShadow><cylinderGeometry args={[0.72, 0.76, 0.04, 64]} /><meshStandardMaterial color={light === "night" ? "#1B1C20" : "#F6F3EE"} roughness={0.35} /></mesh>
      <mesh position={[0, 0.042, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.66, 0.72, 64]} /><meshBasicMaterial ref={ring as React.Ref<THREE.MeshBasicMaterial>} toneMapped={false} /></mesh>
      {/* marca em destaque no fundo; as outras marcas vestidas nas laterais */}
      {/* faixa da marca acima da cabeça do avatar (o corpo não cobre o logo) */}
      <BrandPanel key={env.key} env={env} position={[0, 2.12, BACK_Z + 0.03]} width={2.5} height={0.72} reduced={reduced} />
      <NeonSign env={env} light={light} />
      {others.map((o, i) => <BrandPanel key={o.key} env={o} position={sidePos[i].position} width={1.05} height={0.72} reduced={reduced} rotationY={sidePos[i].rotationY} />)}
      <Curtain env={env} reduced={reduced} />
      <Mirror env={env} />
      <Rail env={env} />
      <Bench env={env} />
    </group>
  );
}

/** Luz por modo: loja (spots quentes), luz do dia (clara e fria) e noite (baixa, com o letreiro e o anel brilhando). */
function Lights({ light, accent }: { light: LightMode; accent: string }) {
  const night = light === "night", day = light === "daylight";
  return (
    <>
      <StudioLight intensity={night ? 0.18 : day ? 0.7 : 0.45} />
      <hemisphereLight args={[day ? "#EAF3FF" : "#FFF4E6", night ? "#101114" : "#CFC6B8", night ? 0.12 : day ? 0.75 : 0.45]} />
      <spotLight position={[0, WALL_H - 0.1, 1.1]} angle={0.55} penumbra={0.6} intensity={night ? 14 : day ? 6 : 11} color={day ? "#FFFFFF" : "#FFE8CC"} castShadow target-position={[0, 0.8, 0]} />
      <directionalLight position={[1.4, 2.6, 3]} intensity={night ? 0.25 : day ? 0.9 : 0.55} />
      <directionalLight position={[-1.6, 2.0, 2.4]} intensity={night ? 0.15 : 0.35} />
      <pointLight position={[0, 1.4, -1.2]} color={accent} intensity={night ? 2.4 : 0.8} distance={3} />
    </>
  );
}

export default function FittingRoomScene({ avatar, sex, build, skinTone, body, pieces, environment, light = "store", view = "front", onCanvas }: {
  avatar: Avatar3dRef | null; sex: "FEMININO" | "MASCULINO"; build?: string | null; skinTone?: string | null; body?: BodyParams | null;
  pieces: Look3dPiece[]; environment: ResolvedEnvironment; light?: LightMode; view?: AvatarView; onCanvas?: (c: HTMLCanvasElement) => void;
}) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  sex = avatar?.model?.sex ?? sex;
  const params = body ?? bodyParamsOf({ sex, build, avatar });
  const H = buildSpec(params).stature;
  const target: [number, number, number] = [0, H * 0.56, 0];
  const dist = H * 2.7;
  const env = environment.featured;
  return (
    <Canvas shadows camera={{ fov: 32, near: 0.05, far: 30, position: [0, target[1], dist] }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.toneMappingExposure = 1; onCanvas?.(gl.domElement); }}
      aria-label={t("tryOn.cena_aria", { marca: env.name })}>
      <color attach="background" args={[light === "night" ? "#0B0C0F" : env.wall]} />
      <fog attach="fog" args={[light === "night" ? "#0B0C0F" : env.wall, 9, 18]} />
      <Lights light={light} accent={env.accent} />
      <Room env={env} others={environment.others} light={light} reduced={reduced} />
      <group position={[0, 0.04, 0]}>
        <Mannequin mannequin={{ sex, build: build ?? "MEDIUM", skinTone: avatar ? null : skinTone ?? null, head: avatar ? "AVATAR" : "PADRAO", avatar }} pieces={pieces} sway={false} body={params} />
      </group>
      <Rig view={view} target={target} dist={dist} />
      <OrbitControls target={target} enablePan={false} minDistance={1.4} maxDistance={dist * 1.25} maxPolarAngle={Math.PI * 0.52} />
    </Canvas>
  );
}
