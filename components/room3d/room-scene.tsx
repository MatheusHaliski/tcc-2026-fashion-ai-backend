"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mediaUrl } from "@/lib/api/client";

/* RF32 — Meu Quarto 3D (React Three Fiber). Móvel FAI Origem paramétrico (molde = função de parâmetros, acabamento =
 * dado), peças como planos com a foto sem fundo (GLB quando houver modelo 3D do RF16), câmera 3/4 editorial limitada.
 * Unidades em metros. */

export interface RoomPiece3D { id: string; name: string; category: string; subcategory: string; colorHex?: string | null; imageUrl?: string | null; thumbnailUrl?: string | null; model3dUrl?: string | null; address?: string | null; addressLabel?: string | null; moduleId?: string | null; states?: string[]; }
export interface RoomModule3D { id: string; slotType: string; label: string; capacity?: number; category?: string | null; finish?: { color?: string; roughness?: number; texture?: string; kelvin?: number } | null; pieces?: RoomPiece3D[]; lookBoxes?: { id: string; title: string; coverImageUrl?: string | null; lookDoDia?: boolean }[]; accessibleLabel?: string; }
export interface RoomData3D {
  modules: RoomModule3D[]; pieces: Record<string, RoomPiece3D>; basket?: RoomPiece3D[]; chair?: RoomPiece3D[]; saleRack?: { name: string; pieces: RoomPiece3D[] } | null;
  showcase?: RoomPiece3D[] | unknown; mirrorDailyLook?: { schemeId: string; title: string; coverImageUrl?: string | null } | null; monogram?: string | null;
  ambient?: { period?: string; reduceMotion?: boolean }; camera?: { zoom?: [number, number]; azimuth?: [number, number]; polar?: [number, number] }; level?: string;
}
export interface RoomSceneHandle { open: string[]; }

const W = 2.4, D = 0.6, DOOR_W = 0.6;
const Y = { base0: 0, base1: 0.3, drawers1: 0.96, doors1: 2.16, top1: 2.5 };
const DRAWER_H = (Y.drawers1 - Y.base1) / 3, DRAWER_W = W / 8;
const deg = (d: number) => (d * Math.PI) / 180;

/** Texturas carregadas por fora do Suspense: uma foto que falha vira cor lisa, sem derrubar a cena. */
const texCache = new Map<string, Promise<THREE.Texture | null>>();
function loadTexture(url: string): Promise<THREE.Texture | null> {
  let p = texCache.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const l = new THREE.TextureLoader(); l.setCrossOrigin("anonymous");
      l.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; resolve(t); }, undefined, () => resolve(null));
    });
    texCache.set(url, p);
  }
  return p;
}
function useTex(url?: string | null) {
  const [t, setT] = useState<THREE.Texture | null>(null);
  useEffect(() => { let alive = true; const u = mediaUrl(url ?? null); if (!u) return; loadTexture(u).then((x) => alive && setT(x)); return () => { alive = false; }; }, [url]);
  return t;
}
/** Rótulo desenhado num canvas (sem fonte remota). */
function useLabel(text: string, opts: { w?: number; h?: number; bg?: string; fg?: string; font?: string } = {}) {
  return useMemo(() => {
    const w = opts.w ?? 256, h = opts.h ?? 64; const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d")!;
    if (opts.bg) { g.fillStyle = opts.bg; g.fillRect(0, 0, w, h); }
    g.fillStyle = opts.fg ?? "#3a3a3a"; g.font = opts.font ?? `600 ${Math.round(h * 0.42)}px Inter, Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text.length > 22 ? text.slice(0, 21) + "…" : text, w / 2, h / 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [text, opts.w, opts.h, opts.bg, opts.fg, opts.font]);
}

/** Peça: plano com a foto sem fundo; GLB quando existir. Estados: esquecida (poeira), favorita (cabide dourado), destaque. */
function PieceMesh({ p, w, h, highlight, onPick, lying = false }: { p: RoomPiece3D; w: number; h: number; highlight: boolean; onPick: (id: string) => void; lying?: boolean }) {
  const tex = useTex(p.imageUrl ?? p.thumbnailUrl);
  const [glb, setGlb] = useState<THREE.Group | null>(null);
  useEffect(() => {
    if (!p.model3dUrl) return; let alive = true; const u = mediaUrl(p.model3dUrl); if (!u) return;
    new GLTFLoader().load(u, (g) => { if (!alive) return; const box = new THREE.Box3().setFromObject(g.scene); const s = box.getSize(new THREE.Vector3()); const k = Math.min(w / s.x, h / s.y); g.scene.scale.setScalar(k); setGlb(g.scene); }, undefined, () => undefined);
    return () => { alive = false; };
  }, [p.model3dUrl, w, h]);
  const forgotten = p.states?.includes("ESQUECIDA");
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (highlight && ref.current) (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25 + 0.2 * Math.sin(clock.elapsedTime * 4); });
  const click = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick(p.id); };
  return (
    <group rotation={lying ? [-0.3, 0, 0] : [0, 0, 0]}>
      {glb ? <primitive object={glb} onClick={click} /> : (
        <mesh ref={ref} onClick={click} castShadow onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial map={tex ?? undefined} color={tex ? (forgotten ? "#b9b4aa" : "#ffffff") : p.colorHex ?? "#cccccc"} transparent alphaTest={0.08} side={THREE.DoubleSide}
            roughness={0.85} emissive={highlight ? "#ffd54a" : "#000000"} emissiveIntensity={highlight ? 0.35 : 0} />
        </mesh>
      )}
      {forgotten && <mesh position={[0, 0, 0.004]}><planeGeometry args={[w, h]} /><meshBasicMaterial color="#8d8a84" transparent opacity={0.18} depthWrite={false} /></mesh>}
      {highlight && <pointLight position={[0, 0, 0.35]} intensity={1.6} distance={1.2} color="#ffe6a0" />}
    </group>
  );
}

function Hanger({ gold }: { gold?: boolean }) {
  const mat = <meshStandardMaterial color={gold ? "#C9A227" : "#6b5a4a"} metalness={gold ? 0.9 : 0.2} roughness={gold ? 0.25 : 0.6} />;
  return (
    <group>
      <mesh position={[0, 0.03, 0]}><torusGeometry args={[0.022, 0.004, 8, 16, Math.PI * 1.4]} />{mat}</mesh>
      <mesh position={[0, -0.03, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.005, 0.005, 0.4, 8]} />{mat}</mesh>
    </group>
  );
}

/** Porta com cabideiro atrás: dobradiça na borda externa do par; abre com animação (RF32.CA03). */
function DoorBay({ m, index, open, onToggle, finish, highlight, onPick }: { m: RoomModule3D; index: number; open: boolean; onToggle: () => void; finish: THREE.MeshStandardMaterialParameters; highlight: string | null; onPick: (id: string) => void }) {
  const hingeLeft = index % 2 === 0; const x0 = -W / 2 + index * DOOR_W; const h = Y.doors1 - Y.drawers1;
  const door = useRef<THREE.Group>(null); const target = open ? (hingeLeft ? -deg(105) : deg(105)) : 0;
  useFrame((_, dt) => { if (door.current) door.current.rotation.y = THREE.MathUtils.damp(door.current.rotation.y, target, 7, dt); });
  const logo = useLabel("FAI", { w: 128, h: 64, fg: "rgba(0,0,0,.18)", font: "700 40px Georgia, serif" });
  const pieces = m.pieces ?? [];
  return (
    <group position={[x0, Y.drawers1, 0]}>
      {/* cabideiro */}
      <mesh position={[DOOR_W / 2, h - 0.12, -D / 2 + 0.28]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.012, 0.012, DOOR_W - 0.04, 12]} /><meshStandardMaterial color="#b7b7b7" metalness={0.8} roughness={0.3} /></mesh>
      {pieces.slice(0, 6).map((p, i) => {
        const x = 0.1 + (i * (DOOR_W - 0.2)) / Math.max(1, Math.min(6, pieces.length) - 1 || 1);
        return <group key={p.id} position={[pieces.length === 1 ? DOOR_W / 2 : x, h - 0.16, -D / 2 + 0.28 + (i % 2) * 0.02]} rotation={[0, open ? 0 : 0, 0]}>
          <Hanger gold={p.states?.includes("FAVORITA")} />
          <group position={[0, -0.36, 0.01]}><PieceMesh p={p} w={0.42} h={0.62} highlight={highlight === p.id} onPick={onPick} /></group>
        </group>;
      })}
      {/* luz interna (acende com a porta aberta) */}
      {open && <pointLight position={[DOOR_W / 2, h - 0.05, 0]} intensity={0.8} distance={1.4} color="#fff1d6" />}
      {/* porta */}
      <group ref={door} position={[hingeLeft ? 0 : DOOR_W, 0, D / 2]}>
        <mesh position={[hingeLeft ? DOOR_W / 2 : -DOOR_W / 2, h / 2, 0.01]} castShadow onClick={(e) => { e.stopPropagation(); onToggle(); }}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
          <boxGeometry args={[DOOR_W - 0.006, h - 0.006, 0.02]} /><meshStandardMaterial {...finish} />
        </mesh>
        {/* puxador cava + logo gravado */}
        <mesh position={[hingeLeft ? DOOR_W - 0.03 : -DOOR_W + 0.03, h / 2, 0.021]}><boxGeometry args={[0.012, 0.28, 0.004]} /><meshStandardMaterial color="#d6d2ca" roughness={0.9} /></mesh>
        <mesh position={[hingeLeft ? DOOR_W / 2 : -DOOR_W / 2, h * 0.72, 0.0215]}><planeGeometry args={[0.16, 0.08]} /><meshBasicMaterial map={logo} transparent /></mesh>
      </group>
    </group>
  );
}

/** Gaveta: desliza para fora e mostra as peças dobradas; frente com o rótulo da categoria. */
function Drawer({ m, n, open, onToggle, finish, highlight, onPick }: { m: RoomModule3D; n: number; open: boolean; onToggle: () => void; finish: THREE.MeshStandardMaterialParameters; highlight: string | null; onPick: (id: string) => void }) {
  const col = (n - 1) % 8, row = Math.floor((n - 1) / 8);
  const x = -W / 2 + col * DRAWER_W + DRAWER_W / 2, y = Y.drawers1 - (row + 0.5) * DRAWER_H;
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (g.current) g.current.position.z = THREE.MathUtils.damp(g.current.position.z, open ? 0.34 : 0, 8, dt); });
  const label = useLabel(m.category ?? m.label, { w: 256, h: 48, fg: "#4a453c" });
  const pieces = m.pieces ?? [];
  return (
    <group ref={g} position={[x, y, 0]}>
      <mesh position={[0, 0, D / 2 - 0.01]} castShadow onClick={(e) => { e.stopPropagation(); onToggle(); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
        <boxGeometry args={[DRAWER_W - 0.008, DRAWER_H - 0.008, 0.02]} /><meshStandardMaterial {...finish} />
      </mesh>
      <mesh position={[0, DRAWER_H / 2 - 0.035, D / 2 + 0.0012]}><boxGeometry args={[DRAWER_W * 0.5, 0.01, 0.004]} /><meshStandardMaterial color="#cfcac1" /></mesh>
      <mesh position={[0, -0.02, D / 2 + 0.001]}><planeGeometry args={[DRAWER_W * 0.86, 0.045]} /><meshBasicMaterial map={label} transparent /></mesh>
      {pieces.length > 0 && <mesh position={[DRAWER_W / 2 - 0.03, DRAWER_H / 2 - 0.03, D / 2 + 0.002]}><circleGeometry args={[0.012, 16]} /><meshBasicMaterial color="#1F7A76" /></mesh>}
      {/* caixa interna + peças dobradas */}
      <mesh position={[0, -DRAWER_H / 2 + 0.02, 0.05]}><boxGeometry args={[DRAWER_W - 0.03, 0.01, D - 0.14]} /><meshStandardMaterial color="#efeae1" /></mesh>
      {open && pieces.slice(0, 4).map((p, i) => (
        // peças "sobem" da gaveta aberta para ficarem visíveis de frente (abrir = exibir as peças da posição, RF32.CA03)
        <group key={p.id} position={[pieces.length === 1 ? 0 : (i - (Math.min(4, pieces.length) - 1) / 2) * DRAWER_W * 0.62, DRAWER_H / 2 + 0.1, 0.12 + (i % 2) * 0.02]}>
          <PieceMesh p={p} w={DRAWER_W * 0.62} h={0.2} highlight={highlight === p.id} onPick={onPick} lying />
        </group>))}
    </group>
  );
}

function LookBox({ b, i }: { b: { id: string; title: string; coverImageUrl?: string | null; lookDoDia?: boolean }; i: number }) {
  const tex = useTex(b.coverImageUrl);
  const x = -W / 2 + 0.16 + i * 0.3;
  return (
    <group position={[x, Y.doors1 + 0.16, 0.02]}>
      <RoundedBox args={[0.26, 0.26, 0.4]} radius={0.01} castShadow><meshStandardMaterial color={b.lookDoDia ? "#f5d9a8" : "#e9e3d7"} roughness={0.9} /></RoundedBox>
      <mesh position={[0, 0, 0.201]}><planeGeometry args={[0.2, 0.2]} /><meshStandardMaterial map={tex ?? undefined} color={tex ? "#fff" : "#d8d2c6"} /></mesh>
    </group>
  );
}

/** Espelho inteligente com o Look do Dia (RF33). */
function Mirror({ look }: { look?: RoomData3D["mirrorDailyLook"] }) {
  const tex = useTex(look?.coverImageUrl);
  const title = useLabel(look?.title ? `Look do Dia · ${look.title}` : "Monte o look de hoje", { w: 512, h: 64, fg: "#f6f1e7", bg: "rgba(20,20,24,.55)" });
  return (
    <group position={[-W / 2 - 0.95, 0, 0.2]} rotation={[0, deg(28), 0]}>
      <mesh position={[0, 0.95, 0]} castShadow><boxGeometry args={[0.62, 1.8, 0.04]} /><meshStandardMaterial color="#2b2622" metalness={0.4} roughness={0.35} /></mesh>
      <mesh position={[0, 0.95, 0.021]}><planeGeometry args={[0.54, 1.7]} /><meshStandardMaterial color="#cfd8de" metalness={0.95} roughness={0.08} /></mesh>
      {tex && <mesh position={[0, 1.02, 0.024]}><planeGeometry args={[0.44, 0.9]} /><meshStandardMaterial map={tex} transparent alphaTest={0.05} /></mesh>}
      <mesh position={[0, 0.3, 0.025]}><planeGeometry args={[0.5, 0.06]} /><meshBasicMaterial map={title} transparent /></mesh>
    </group>
  );
}

function Basket({ pieces, onPick, highlight }: { pieces: RoomPiece3D[]; onPick: (id: string) => void; highlight: string | null }) {
  return (
    <group position={[W / 2 + 0.55, 0, 0.45]}>
      <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.24, 0.2, 0.4, 24, 1, true]} /><meshStandardMaterial color="#b89a6a" roughness={1} side={THREE.DoubleSide} /></mesh>
      {pieces.slice(0, 3).map((p, i) => <group key={p.id} position={[-0.06 + i * 0.06, 0.36, 0]} rotation={[-0.4, i * 0.6, 0]}><PieceMesh p={p} w={0.28} h={0.28} highlight={highlight === p.id} onPick={onPick} /></group>)}
    </group>
  );
}

function SaleRack({ rack, onPick, highlight }: { rack: { name: string; pieces: RoomPiece3D[] }; onPick: (id: string) => void; highlight: string | null }) {
  const tag = useLabel(rack.name, { w: 384, h: 64, fg: "#fff", bg: "#C6275E" });
  return (
    <group position={[W / 2 + 1.25, 0, -0.05]} rotation={[0, -deg(25), 0]}>
      {[-0.4, 0.4].map((x) => <mesh key={x} position={[x, 0.7, 0]}><cylinderGeometry args={[0.012, 0.012, 1.4, 8]} /><meshStandardMaterial color="#9a9a9a" metalness={0.8} roughness={0.3} /></mesh>)}
      <mesh position={[0, 1.38, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.012, 0.012, 0.84, 8]} /><meshStandardMaterial color="#9a9a9a" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0, 1.5, 0]}><planeGeometry args={[0.6, 0.1]} /><meshBasicMaterial map={tag} transparent /></mesh>
      {rack.pieces.slice(0, 4).map((p, i) => <group key={p.id} position={[-0.3 + i * 0.2, 1.3, 0.02 * i]}><Hanger /><group position={[0, -0.34, 0.01]}><PieceMesh p={p} w={0.36} h={0.55} highlight={highlight === p.id} onPick={onPick} /></group></group>)}
    </group>
  );
}

function Chair({ pieces, onPick, highlight }: { pieces: RoomPiece3D[]; onPick: (id: string) => void; highlight: string | null }) {
  const wood = <meshStandardMaterial color="#8a6a4a" roughness={0.7} />;
  return (
    <group position={[-W / 2 - 0.35, 0, 1.0]} rotation={[0, deg(35), 0]}>
      <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[0.45, 0.05, 0.45]} />{wood}</mesh>
      <mesh position={[0, 0.72, -0.2]} castShadow><boxGeometry args={[0.45, 0.5, 0.04]} />{wood}</mesh>
      {[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x, 0.22, z]}><boxGeometry args={[0.04, 0.45, 0.04]} />{wood}</mesh>)}
      {pieces.slice(0, 3).map((p, i) => <group key={p.id} position={[-0.05 + i * 0.05, 0.62 + i * 0.03, -0.15]} rotation={[-0.2, 0, 0.1 * i]}><PieceMesh p={p} w={0.4} h={0.4} highlight={highlight === p.id} onPick={onPick} /></group>)}
    </group>
  );
}

/** Enquadra a câmera numa posição (Mostrar no quarto — RF32.CA09) respeitando os limites 3/4; depois devolve o controle. */
function CameraRig({ focus, controls }: { focus: [number, number, number] | null; controls: React.RefObject<unknown> }) {
  const { camera } = useThree();
  const key = focus ? focus.join(",") : "home";
  const animating = useRef(true);
  useEffect(() => { animating.current = true; }, [key]);
  useFrame((_, dt) => {
    const c = controls.current as { target: THREE.Vector3; update: () => void } | null; if (!c || !animating.current) return;
    const want = focus ? new THREE.Vector3(...focus) : new THREE.Vector3(0, 1.2, 0); const dist = focus ? 3.0 : 5.3;
    c.target.lerp(want, 1 - Math.exp(-3 * dt));
    const dir = camera.position.clone().sub(c.target); const len = dir.length(); const next = THREE.MathUtils.damp(len, dist, 2.5, dt);
    camera.position.copy(c.target.clone().add(dir.setLength(next)));
    c.update();
    if (c.target.distanceTo(want) < 0.01 && Math.abs(next - dist) < 0.01) animating.current = false;
  });
  return null;
}

/** Celular em retrato: abre o campo de visão para o móvel inteiro caber sem sair do enquadramento 3/4. */
function ResponsiveFov() {
  const { camera, size } = useThree();
  useEffect(() => { const cam = camera as THREE.PerspectiveCamera; const aspect = size.width / Math.max(1, size.height); cam.fov = aspect < 0.8 ? 62 : aspect < 1.1 ? 48 : 38; cam.updateProjectionMatrix(); }, [camera, size.width, size.height]);
  return null;
}

/** Posição (em coordenadas da cena) de um módulo, para o enquadramento. */
export function moduleAnchor(id: string): [number, number, number] {
  if (id.startsWith("door:")) { const i = Number(id.split(":")[1]) - 1; return [-W / 2 + i * DOOR_W + DOOR_W / 2, Y.drawers1 + 0.6, 0.2]; }
  if (id.startsWith("drawer:")) { const n = Number(id.split(":")[1]); const col = (n - 1) % 8, row = Math.floor((n - 1) / 8); return [-W / 2 + col * DRAWER_W + DRAWER_W / 2, Y.drawers1 - (row + 0.5) * DRAWER_H + 0.05, 0.6]; }
  if (id === "top") return [0, Y.doors1 + 0.17, 0.2];
  if (id === "base") return [0, 0.15, 0.3];
  if (id === "basket") return [W / 2 + 0.55, 0.3, 0.45];
  if (id === "chair") return [-W / 2 - 0.35, 0.6, 1.0];
  if (id === "sale") return [W / 2 + 1.25, 1.0, 0];
  return [0, 1.2, 0];
}

export default function RoomScene({ data, open, onToggle, highlight, focusModule, onPick, onReady }: {
  data: RoomData3D; open: Set<string>; onToggle: (moduleId: string) => void; highlight: string | null; focusModule: string | null;
  onPick: (pieceId: string) => void; onReady?: (canvas: HTMLCanvasElement) => void;
}) {
  const controls = useRef<unknown>(null);
  const night = data.ambient?.period === "night";
  const byId = useMemo(() => Object.fromEntries(data.modules.map((m) => [m.id, m])), [data.modules]);
  const doorFinish = byId["door:1"]?.finish ?? { color: "#F4F2EF", roughness: 0.8 };
  const finish: THREE.MeshStandardMaterialParameters = { color: doorFinish.color ?? "#F4F2EF", roughness: doorFinish.roughness ?? 0.8, metalness: 0.02 };
  const cam = data.camera ?? {}; const az = cam.azimuth ?? [-35, 35], po = cam.polar ?? [55, 80], zoom = cam.zoom ?? [0.8, 1.6];
  const focus = focusModule ? moduleAnchor(focusModule) : null;
  const shoes = byId["base"]?.pieces ?? [];
  const showcase = Array.isArray(data.showcase) ? (data.showcase as RoomPiece3D[]) : [];
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }} camera={{ fov: 38, position: [1.75, 2.35, 4.8], near: 0.05, far: 40 }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; onReady?.(gl.domElement); }} aria-label="Meu Quarto em 3D">
      <color attach="background" args={[night ? "#1d1f2a" : "#efe9df"]} />
      <fog attach="fog" args={[night ? "#1d1f2a" : "#efe9df", 7, 14]} />
      <hemisphereLight args={[night ? "#9aa0c8" : "#ffffff", night ? "#2a2433" : "#d9cbb5", night ? 0.7 : 0.9]} />
      <directionalLight position={[3, 5, 4]} intensity={night ? 0.6 : 1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-2} />
      {night && <pointLight position={[1.8, 2.3, 1.6]} intensity={2} distance={5} color="#ffd9a0" />}
      {/* quarto: piso, parede do fundo e lateral, tapete */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[12, 12]} /><meshStandardMaterial color={night ? "#5a4636" : "#b8906a"} roughness={0.75} /></mesh>
      <mesh position={[0, 2, -D / 2 - 0.02]} receiveShadow><planeGeometry args={[12, 4]} /><meshStandardMaterial color={night ? "#343747" : "#e8e1d4"} roughness={1} /></mesh>
      <mesh position={[-3.2, 2, 2]} rotation={[0, Math.PI / 2, 0]} receiveShadow><planeGeometry args={[6, 4]} /><meshStandardMaterial color={night ? "#2e3140" : "#e2dacb"} roughness={1} /></mesh>
      {byId["rug"] && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 1.3]} receiveShadow><circleGeometry args={[1.1, 48]} /><meshStandardMaterial color={night ? "#6b4c5c" : "#d9b8a0"} roughness={1} /></mesh>}
      {/* carcaça do FAI Origem */}
      <group>
        <mesh position={[0, Y.top1 / 2, -D / 2 + 0.01]}><boxGeometry args={[W, Y.top1, 0.02]} /><meshStandardMaterial {...finish} color="#e7e2d9" /></mesh>
        {[-W / 2 - 0.01, W / 2 + 0.01].map((x) => <mesh key={x} position={[x, Y.top1 / 2, 0]} castShadow receiveShadow><boxGeometry args={[0.02, Y.top1, D]} /><meshStandardMaterial {...finish} /></mesh>)}
        {[Y.base1, Y.drawers1, Y.doors1, Y.top1].map((y) => <mesh key={y} position={[0, y, 0]} castShadow receiveShadow><boxGeometry args={[W + 0.04, 0.02, D]} /><meshStandardMaterial {...finish} /></mesh>)}
        {[1, 2, 3].map((i) => <mesh key={i} position={[-W / 2 + i * DOOR_W, (Y.drawers1 + Y.doors1) / 2, 0]}><boxGeometry args={[0.018, Y.doors1 - Y.drawers1, D - 0.02]} /><meshStandardMaterial {...finish} /></mesh>)}
      </group>
      {/* portas 1–4 com cabideiro */}
      {[1, 2, 3, 4].map((n) => { const m = byId[`door:${n}`]; return m ? <DoorBay key={n} m={m} index={n - 1} open={open.has(m.id)} onToggle={() => onToggle(m.id)} finish={finish} highlight={highlight} onPick={onPick} /> : null; })}
      {/* 24 gavetas */}
      {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => { const m = byId[`drawer:${n}`]; return m ? <Drawer key={n} m={m} n={n} open={open.has(m.id)} onToggle={() => onToggle(m.id)} finish={finish} highlight={highlight} onPick={onPick} /> : null; })}
      {/* maleiro: caixas de look */}
      {(byId["top"]?.lookBoxes ?? []).slice(0, 8).map((b, i) => <LookBox key={b.id} b={b} i={i} />)}
      {/* base: calçados enfileirados */}
      {shoes.slice(0, 10).map((p, i) => <group key={p.id} position={[-W / 2 + 0.16 + i * 0.23, 0.14, 0.12]}><PieceMesh p={p} w={0.22} h={0.2} highlight={highlight === p.id} onPick={onPick} /></group>)}
      {/* vitrine da peça ícone */}
      {showcase.length > 0 && <group position={[W / 2 + 0.55, 0, -0.05]}>
        <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[0.36, 0.9, 0.36]} /><meshStandardMaterial color="#f4f1ea" roughness={0.6} /></mesh>
        <mesh position={[0, 1.12, 0]}><boxGeometry args={[0.34, 0.44, 0.34]} /><meshPhysicalMaterial color="#ffffff" transmission={0.9} roughness={0.05} thickness={0.02} transparent opacity={0.35} /></mesh>
        <group position={[0, 1.1, 0]}><PieceMesh p={showcase[0]} w={0.26} h={0.26} highlight={highlight === showcase[0].id} onPick={onPick} /></group>
      </group>}
      <Mirror look={data.mirrorDailyLook} />
      {(data.basket ?? []).length > 0 && <Basket pieces={data.basket ?? []} onPick={onPick} highlight={highlight} />}
      {data.saleRack && data.saleRack.pieces.length > 0 && <SaleRack rack={data.saleRack} onPick={onPick} highlight={highlight} />}
      <Chair pieces={data.chair ?? []} onPick={onPick} highlight={highlight} />
      <ContactShadows position={[0, 0.005, 0.4]} opacity={0.35} scale={8} blur={2.4} far={3} />
      <OrbitControls ref={controls as never} makeDefault enablePan={false} target={[0, 1.2, 0]}
        minAzimuthAngle={deg(az[0])} maxAzimuthAngle={deg(az[1])} minPolarAngle={deg(po[0])} maxPolarAngle={deg(po[1])}
        minDistance={5.3 / zoom[1]} maxDistance={5.3 / zoom[0]} enableDamping dampingFactor={0.08} />
      <CameraRig focus={focus} controls={controls} />
      <ResponsiveFov />
    </Canvas>
  );
}
