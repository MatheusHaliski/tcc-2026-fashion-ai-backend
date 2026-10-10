"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mediaUrl } from "@/lib/api/client";
import {
  ClosetLights, Cobweb, CorkBoard, deg, DressForm, DustPuff, EmptyDrawerCharm, FaiBox, GoldDot, HangTag, KeyHook, Label3D, Lamp, LightSwitch,
  pointer, RoomWindow, sketchDraw, Sparkles, TailorTape, useCanvasTex, WallCalendar,
} from "@/components/room3d/room-props";
import RoomAvatarController, { type RoomGameplay } from "./room-avatar-controller";
import { snapshotCrop } from "@/lib/room3d/mirror-session";
import { RoomInteraction } from "@/lib/room3d/interaction";
import { useI18n } from "@/lib/i18n/i18n";

/* RF27/RF32 — Meu Quarto 3D (React Three Fiber). Móvel FAI Origem paramétrico (molde = função de parâmetros, acabamento =
 * dado), peças como planos com a foto sem fundo (GLB quando houver modelo 3D do RF16), câmera 3/4 editorial limitada.
 * Todos os elementos de docs/meu-quarto/05-elementos-do-quarto.md: móvel, objetos do quarto, módulos por nível (RF30) e
 * elementos dos desafios ativos. Unidades em metros. */

export interface RoomPiece3D { id: string; name: string; category: string; subcategory: string; colorHex?: string | null; imageUrl?: string | null; thumbnailUrl?: string | null; model3dUrl?: string | null; address?: string | null; addressLabel?: string | null; moduleId?: string | null; states?: string[]; wearCount?: number; salePrice?: number | null; origin?: string | null; }
export interface RoomModule3D { id: string; slotType: string; label: string; mold?: string | null; capacity?: number; category?: string | null; empty?: boolean; finish?: { color?: string; roughness?: number; metalness?: number; texture?: string; material?: string; kelvin?: number; guided?: boolean; artUrl?: string | null; logoUrl?: string | null; labelText?: string | null; creator?: string | null } | null; pieces?: RoomPiece3D[]; lookBoxes?: { id: string; title: string; coverImageUrl?: string | null; lookDoDia?: boolean }[]; accessibleLabel?: string; }
export interface RoomDecoration { type: string; name?: string; days?: number; polaroids?: { schemeId: string; coverImageUrl?: string | null }[]; tapedPieceIds?: string[]; taggedPieceIds?: string[]; theme?: string; }
export interface RoomData3D {
  modules: RoomModule3D[]; pieces: Record<string, RoomPiece3D>; basket?: RoomPiece3D[]; chair?: RoomPiece3D[]; saleRack?: { name: string; pieces: RoomPiece3D[] } | null;
  showcase?: RoomPiece3D[] | unknown; mirrorDailyLook?: { schemeId: string; title: string; coverImageUrl?: string | null } | null; monogram?: string | null;
  ambient?: { period?: string; reduceMotion?: boolean; seasonal?: string | null }; camera?: { zoom?: [number, number]; azimuth?: [number, number]; polar?: [number, number] }; level?: string;
  decorations?: RoomDecoration[]; closetLights?: { score?: number | null; band?: string | null; milestones: { at: number; label: string; lit: boolean }[]; lit: number } | null;
  unboxing?: { inventoryId: string; sku: string; name: string; slotType: string }[]; keys?: { id: string; username: string }[]; light?: { kelvin?: number; guided?: boolean } | null;
}
/** Estado do espelho e do Vista-me vindo da página (RF28). */
export interface MirrorOverlay { pieces: { id: string; imageUrl?: string | null }[]; postIt?: string | null; closingKey?: number; celebrate?: boolean;
  /** PROV-2D — reflexo no vidro: a Prévia 2D do Avatar 3D vestindo as peças do espelho (só em memória) */
  reflectionUrl?: string | null;
  /** vista do guarda-roupa tirada do espelho ao abrir a prova (QUARTO-ESPELHO): fundo do reflexo */
  snapshot?: { url: string; aspect: number } | null;
  /** RF28 — botões 3D dentro do vidro: usar o look pendurado, pedir outra sugestão, tirar uma peça */
  onUse?: () => void; onAnother?: () => void; onTakeOneOff?: () => void; }
export interface RoomSceneProps {
  gameplay?: RoomGameplay;
  data: RoomData3D; open: Set<string>; onToggle: (moduleId: string) => void; highlight: string | null; focusModule: string | null;
  onPick: (pieceId: string) => void; onReady?: (canvas: HTMLCanvasElement) => void;
  lit?: Set<string>; mirror?: MirrorOverlay; dark?: boolean; onToggleTheme?: () => void; onVistaMe?: () => void; onCopilot?: () => void;
  copilotPoint?: string | null; copilotTalking?: boolean; onKeys?: () => void; onUnbox?: () => void; unboxing?: boolean; onAddToDrawer?: (moduleId: string) => void;
}

export const LEVELS = ["ESTREIA", "STUDIO", "LOFT", "CLOSET", "ATELIER", "PENTHOUSE", "MAISON"];
const atLeast = (level: string | undefined, want: string) => LEVELS.indexOf(level ?? "ESTREIA") >= LEVELS.indexOf(want);

const W = 2.4, D = 0.6, DOOR_W = 0.6, EXT_W = 1.8;
const Y = { base0: 0, base1: 0.3, drawers1: 0.96, doors1: 2.16, top1: 2.5 };
const DRAWER_H = (Y.drawers1 - Y.base1) / 3, DRAWER_W = W / 8, EXT_DRAWER_W = EXT_W / 4;

/** Temperatura de cor (K) → RGB aproximado, para a iluminação guiada. */
export function kelvinColor(k: number) {
  const t = k / 100; let r: number, g: number, b: number;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
  else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255; }
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

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
  useEffect(() => { let alive = true; const u = mediaUrl(url ?? null); if (!u || u.endsWith("/null")) return; loadTexture(u).then((x) => alive && setT(x)); return () => { alive = false; }; }, [url]);
  return t;
}

/**
 * Reflexo do espelho (PROV-2D): a Prévia 2D do avatar chega como data: URL só em memória. Sem o cache global de
 * texturas (que guardaria cada foto para sempre): a textura anterior é descartada quando chega a nova, e o reflexo
 * antigo continua no vidro até lá (sem piscar).
 */
function useReflection(url?: string | null) {
  const [t, setT] = useState<THREE.Texture | null>(null);
  const cur = useRef<THREE.Texture | null>(null);
  useEffect(() => {
    // sem foto (look trocado ou captura falhou): larga o reflexo anterior para as peças de reserva aparecerem
    if (!url) { cur.current?.dispose(); cur.current = null; setT(null); return; }
    let alive = true;
    new THREE.TextureLoader().load(url, (x) => {
      if (!alive) { x.dispose(); return; }
      x.colorSpace = THREE.SRGBColorSpace; cur.current?.dispose(); cur.current = x; setT(x);
    }, undefined, () => { if (alive) { cur.current?.dispose(); cur.current = null; setT(null); } });
    return () => { alive = false; };
  }, [url]);
  useEffect(() => () => { cur.current?.dispose(); cur.current = null; }, []);
  return t;
}

interface Ctx { highlight: string | null; onPick: (id: string) => void; reduced: boolean; tagged: Set<string>; hanger?: THREE.MeshStandardMaterialParameters; engine?: RoomInteraction; }

/** Register actual world anchors, not screen-space click areas. */
function InteractionAnchor({ ctx, id, kind, available = true, position = [0, 0, 0], children, progress }: {
  ctx: Ctx; id: string; kind: "handle" | "piece"; available?: boolean; position?: [number, number, number]; children?: React.ReactNode; progress?: (delta: number) => void;
}) {
  const object = useRef<THREE.Group>(null), marker = useRef<THREE.Mesh>(null);
  useFrame(() => { if (marker.current) { const near = ctx.engine?.hover === id; marker.current.scale.setScalar(near ? 1.6 : 1); (marker.current.material as THREE.MeshBasicMaterial).color.set(near ? "#4ade80" : "#fbbf24"); } });
  useEffect(() => {
    if (!ctx.engine || !object.current) return;
    const target = { id, kind, object: object.current, available: () => available && (kind !== "piece" || !ctx.engine!.hidden.has(id)), progress };
    ctx.engine.targets.set(id, target);
    return () => { if (ctx.engine?.targets.get(id) === target) ctx.engine.targets.delete(id); };
  }, [ctx.engine, id, kind, available, progress]);
  return <group ref={object} position={position}>{children}{ctx.engine && available && <mesh ref={marker}><sphereGeometry args={[.016, 8, 6]} /><meshBasicMaterial color="#fbbf24" transparent opacity={.85} /></mesh>}</group>;
}

/**
 * Peça: plano com a foto sem fundo; GLB quando existir. Estados: esquecida (poeira + teia, "puff" ao resgatar),
 * croqui (desenho técnico que ganha cor quando a foto chega), 30 usos (ponto dourado), 2ª chance (etiqueta).
 */
function PieceMesh({ p, w, h, ctx, lying = false, onPuff }: { p: RoomPiece3D; w: number; h: number; ctx: Ctx; lying?: boolean; onPuff?: () => void }) {
  const { t } = useI18n();
  const tex = useTex(p.imageUrl ?? p.thumbnailUrl);
  const croqui = !!p.states?.includes("CROQUI") || !(p.imageUrl ?? p.thumbnailUrl);
  const sketch = useCanvasTex(`sketch-${p.category}`, 256, 256, sketchDraw(p.category));
  const [glb, setGlb] = useState<THREE.Group | null>(null);
  const [puff, setPuff] = useState(0);
  const highlight = ctx.highlight === p.id;
  useEffect(() => {
    if (!p.model3dUrl) return; let alive = true; const u = mediaUrl(p.model3dUrl); if (!u) return;
    new GLTFLoader().load(u, (g) => { if (!alive) return; const box = new THREE.Box3().setFromObject(g.scene); const s = box.getSize(new THREE.Vector3()); const k = Math.min(w / Math.max(.001, s.x), h / Math.max(.001, s.y), .04 / Math.max(.001, s.z)); const center = box.getCenter(new THREE.Vector3()); g.scene.scale.multiplyScalar(k); g.scene.position.multiplyScalar(k).addScaledVector(center, -k); setGlb(g.scene); }, undefined, () => undefined);
    return () => { alive = false; };
  }, [p.model3dUrl, w, h]);
  // croqui → foto: transição de ~600 ms quando a foto aprovada chega (DET-M03)
  const wasCroqui = useRef(croqui); const fade = useRef<THREE.Mesh>(null); const fadeStart = useRef(-1);
  useEffect(() => { if (wasCroqui.current && !croqui) fadeStart.current = performance.now(); wasCroqui.current = croqui; }, [croqui]);
  const forgotten = !!p.states?.includes("ESQUECIDA");
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (highlight && ref.current) (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25 + 0.2 * Math.sin(clock.elapsedTime * 4);
    if (fade.current) { const t = fadeStart.current < 0 ? 1 : Math.min(1, (performance.now() - fadeStart.current) / 600); (fade.current.material as THREE.MeshBasicMaterial).opacity = 1 - t; fade.current.visible = t < 1; }
  });
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (forgotten && !ctx.reduced) { setPuff((x) => x + 1); onPuff?.(); setTimeout(() => ctx.onPick(p.id), 380); } else ctx.onPick(p.id);
  };
  const map = croqui ? sketch : tex ?? undefined;
  return (
    <group visible={!ctx.engine?.hidden.has(p.id)} rotation={lying ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
      {glb && !croqui ? <primitive object={glb} onClick={click} /> : (
        <mesh ref={ref} onClick={click} castShadow {...pointer}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial map={map} color={map ? (forgotten ? "#b9b4aa" : "#ffffff") : p.colorHex ?? "#cccccc"} transparent alphaTest={croqui ? 0 : 0.08} side={THREE.DoubleSide}
            roughness={0.85} emissive={highlight ? "#ffd54a" : "#000000"} emissiveIntensity={highlight ? 0.35 : 0} />
        </mesh>
      )}
      {!croqui && <mesh ref={fade} position={[0, 0, 0.003]} visible={false}><planeGeometry args={[w, h]} /><meshBasicMaterial map={sketch} transparent opacity={0} depthWrite={false} /></mesh>}
      {forgotten && <><mesh position={[0, 0, 0.004]}><planeGeometry args={[w, h]} /><meshBasicMaterial color="#8d8a84" transparent opacity={0.18} depthWrite={false} /></mesh><Cobweb w={w} h={h} /></>}
      <group position={[0, 0, 0.02]}><DustPuff trigger={puff} reduced={ctx.reduced} /></group>
      {p.states?.includes("30_USOS") && <GoldDot position={[-w / 2 + 0.03, h / 2 - 0.03, 0.01]} />}
      {ctx.tagged.has(p.id) && <HangTag text={t("room3d.roomScene.n2_chance")} color="#fde2e4" fg="#9d174d" position={[w / 2 - 0.04, h / 2 - 0.1, 0.02]} />}
      {highlight && <pointLight position={[0, 0, 0.35]} intensity={1.6} distance={1.2} color="#ffe6a0" />}
    </group>
  );
}

function Hanger({ gold, finish }: { gold?: boolean; finish?: THREE.MeshStandardMaterialParameters }) {
  const mat = gold ? <meshStandardMaterial color="#C9A227" metalness={0.9} roughness={0.25} /> : <meshStandardMaterial color={finish?.color ?? "#6b5a4a"} metalness={finish?.metalness ?? 0.2} roughness={finish?.roughness ?? 0.6} />;
  return (
    <group>
      <mesh position={[0, 0.03, 0]}><torusGeometry args={[0.022, 0.004, 8, 16, Math.PI * 1.4]} />{mat}</mesh>
      <mesh position={[0, -0.03, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.005, 0.005, 0.4, 8]} />{mat}</mesh>
      {/* cabide especial da favorita: ombreiras de veludo */}
      {gold && [-0.16, 0.16].map((x) => <mesh key={x} position={[x, -0.03, 0]}><sphereGeometry args={[0.018, 10, 8]} /><meshStandardMaterial color="#7a1f3d" roughness={1} /></mesh>)}
    </group>
  );
}

/** Cabide que balança quando a peça esquecida volta (DET-D03). */
function HangingPiece({ p, x, z, pw, ph, ctx }: { p: RoomPiece3D; x: number; z: number; pw: number; ph: number; ctx: Ctx }) {
  const g = useRef<THREE.Group>(null); const swing = useRef(-1);
  useFrame(() => { if (!g.current) return; const t = swing.current < 0 ? 99 : (performance.now() - swing.current) / 1000; g.current.rotation.z = t < 1.6 ? Math.sin(t * 14) * 0.12 * (1 - t / 1.6) : 0; });
  return (
    <group ref={g} position={[x, 0, z]} visible={!ctx.engine?.hidden.has(p.id)}>
      <InteractionAnchor ctx={ctx} id={p.id} kind="piece" available={!!p.moduleId && !!ctx.engine?.progress.get(p.moduleId) && ctx.engine.progress.get(p.moduleId)! > .6} />
      <Hanger gold={p.states?.includes("FAVORITA")} finish={ctx.hanger} />
      <group position={[0, -ph / 2 - 0.05, 0.01]}><PieceMesh p={p} w={pw} h={ph} ctx={ctx} onPuff={() => { if (!ctx.reduced) swing.current = performance.now(); }} /></group>
    </group>
  );
}

function LoosePiece({ engine, p, ctx }: { engine: RoomInteraction; p: RoomPiece3D; ctx: Ctx }) {
  const object = useRef<THREE.Group>(null), velocity = useRef(0);
  useEffect(() => {
    if (!object.current) return;
    const carry = { id: `carry:${p.id}`, kind: "piece" as const, object: object.current, available: () => false };
    const ground = { id: p.id, kind: "piece" as const, object: object.current, available: () => engine.dropped.has(p.id) && object.current!.position.y < .08 };
    engine.targets.set(carry.id, carry);
    const original = engine.targets.get(p.id); engine.targets.set(p.id, ground);
    return () => { engine.targets.delete(carry.id); if (engine.targets.get(p.id) === ground) { if (original) engine.targets.set(p.id, original); else engine.targets.delete(p.id); } };
  }, [engine, p.id]);
  useFrame((_, dt) => {
    const dropped = engine.dropped.get(p.id); if (!object.current || !dropped) { velocity.current = 0; return; }
    velocity.current += Math.min(dt, .05) * 9.8;
    dropped.y = Math.max(.035, dropped.y - velocity.current * Math.min(dt, .05));
    dropped.x = THREE.MathUtils.clamp(dropped.x, -2.8, 5.5); dropped.z = THREE.MathUtils.clamp(dropped.z, .8, 4.4);
    object.current.position.copy(dropped); object.current.rotation.set(-Math.PI / 2, 0, 0);
  });
  return <group ref={object} name={`room-carried-${p.id}`} position={engine.dropped.get(p.id)?.toArray() ?? [0, 1, 1]}>
    <Hanger finish={ctx.hanger} /><group position={[0, -.32, 0]}><PieceMesh p={p} w={.38} h={.52} ctx={{ ...ctx, engine: undefined }} /></group>
  </group>;
}
function LoosePieces({ engine, pieces, ctx }: { engine: RoomInteraction; pieces: Record<string, RoomPiece3D>; ctx: Ctx }) {
  return <>{[...new Set([...(engine.held ? [engine.held] : []), ...engine.dropped.keys()])].map(id => pieces[id] ? <LoosePiece key={id} engine={engine} p={pieces[id]} ctx={ctx} /> : null)}</>;
}

/** Frente com o logo de fábrica, ou o monograma a partir do Studio (DET-K03). */
function DoorMark({ text, w, h, position, plate }: { text: string; w: number; h: number; position: [number, number, number]; plate?: RoomModule3D["finish"] }) {
  const logo = useTex(plate?.logoUrl);
  if (!plate) return <Label3D text={text} w={w} h={h} px={128} fg="rgba(0,0,0,.2)" font={`700 ${text.length > 3 ? 30 : 44}px Georgia, serif`} position={position} />;
  // placa de logo comprada na loja (RF39): material/cor da placa + logo da marca ou nome gravado
  return (
    <group position={position}>
      <mesh position={[0, 0, 0.002]}><boxGeometry args={[w + 0.03, h + 0.02, 0.006]} /><meshStandardMaterial color={plate.color ?? "#C9A227"} metalness={plate.metalness ?? 0.6} roughness={plate.roughness ?? 0.3} /></mesh>
      {logo ? <mesh position={[0, 0, 0.0055]}><planeGeometry args={[h * 0.9, h * 0.9]} /><meshBasicMaterial map={logo} transparent /></mesh>
        : <Label3D text={(plate.labelText ?? text).slice(0, 12)} w={w} h={h} px={256} fg="rgba(0,0,0,.6)" font="700 56px Georgia, serif" position={[0, 0, 0.0055]} />}
    </group>
  );
}

/** Porta com cabideiro atrás: dobradiça na borda externa do par; abre com animação e acende quando o Vista-me aponta. */
function DoorBay({ m, x0, doorW, hingeLeft, open, lit, onToggle, finish, handle, mark, taped, light, ctx, plate }: {
  m: RoomModule3D; x0: number; doorW: number; hingeLeft: boolean; open: boolean; lit: boolean; onToggle: () => void; finish: THREE.MeshStandardMaterialParameters; handle: string;
  mark: string; taped: boolean; light: string; ctx: Ctx; plate?: RoomModule3D["finish"];
}) {
  const h = Y.doors1 - Y.drawers1;
  const art = useTex(m.finish?.artUrl); // arte da marca/celebridade aplicada na porta (RF39)
  const door = useRef<THREE.Group>(null); const front = useRef<THREE.Mesh>(null);
  useEffect(() => { ctx.engine?.progress.set(m.id, Number(open)); }, [open, m.id, ctx.engine]);
  useEffect(() => { const mesh = front.current; if (!ctx.engine || !mesh) return; ctx.engine.solids.add(mesh); return () => { ctx.engine?.solids.delete(mesh); }; }, [ctx.engine]);
  useFrame(({ clock }, dt) => {
    const angle = (ctx.engine?.progress.get(m.id) ?? Number(open)) * (hingeLeft ? -deg(105) : deg(105));
    if (door.current) door.current.rotation.y = ctx.reduced ? angle : THREE.MathUtils.damp(door.current.rotation.y, angle, 7, dt);
    if (front.current) (front.current.material as THREE.MeshStandardMaterial).emissiveIntensity = lit ? 0.35 + 0.15 * Math.sin(clock.elapsedTime * 3) : 0;
  });
  const pieces = (m.pieces ?? []).filter(p => !ctx.engine?.hidden.has(p.id)); const n = Math.min(doorW > 0.7 ? 8 : 6, pieces.length);
  return (
    <group position={[x0, Y.drawers1, 0]}>
      <mesh position={[doorW / 2, h - .45, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, D - .08, 12]} /><meshStandardMaterial color={ctx.hanger?.color ? String(ctx.hanger.color) : "#b7b7b7"} metalness={ctx.hanger?.metalness ?? 0.8} roughness={ctx.hanger?.roughness ?? 0.3} /></mesh>
      {pieces.slice(0, n).map((p, i) => (
        <group key={p.id} position={[0, h - .48, 0]}>
          <HangingPiece p={{ ...p, moduleId: m.id }} x={doorW / 2} z={.16 - i * .32 / Math.max(1, n - 1)} pw={Math.min(.42, doorW - .08)} ph={0.62} ctx={ctx} />
        </group>
      ))}
      {(open || lit) && <pointLight position={[doorW / 2, h - 0.05, 0]} intensity={lit ? 1.4 : 0.8} distance={1.4} color={lit ? "#ffe6a0" : light} />}
      <group ref={door} position={[hingeLeft ? 0 : doorW, 0, D / 2]}>
        <mesh ref={front} position={[hingeLeft ? doorW / 2 : -doorW / 2, h / 2, 0.01]} castShadow onClick={(e) => { e.stopPropagation(); onToggle(); }} {...pointer}>
          <boxGeometry args={[doorW - 0.006, h - 0.006, 0.02]} /><meshStandardMaterial key={art ? art.uuid : "plain"} {...finish} color={art ? "#ffffff" : finish.color} map={art ?? undefined} emissive="#ffd27a" emissiveIntensity={0} />
        </mesh>
        <InteractionAnchor ctx={ctx} id={m.id} kind="handle" position={[hingeLeft ? doorW - .03 : -doorW + .03, h / 2, .021]} progress={delta => { ctx.engine?.progress.set(m.id, THREE.MathUtils.clamp((ctx.engine.progress.get(m.id) ?? Number(open)) + delta, 0, 1)); ctx.engine?.notify(); }}>
        <mesh><boxGeometry args={[0.012, 0.28, 0.004]} /><meshStandardMaterial color={handle} roughness={0.9} /></mesh></InteractionAnchor>
        <DoorMark text={mark} w={0.16} h={0.08} plate={plate} position={[hingeLeft ? doorW / 2 : -doorW / 2, h * 0.72, 0.0215]} />
        {taped && <TailorTape width={0.2} position={[hingeLeft ? doorW - 0.03 : -doorW + 0.03, h / 2, 0.028]} rotation={[0, 0, 0.5]} />}
      </group>
    </group>
  );
}

/** Gaveta: desliza para fora e mostra as peças; frente com o rótulo; vazia mostra sachê de lavanda e meia sem par. */
function Drawer({ m, x, y, w, open, lit, onToggle, finish, handle, taped, onAdd, ctx }: {
  m: RoomModule3D; x: number; y: number; w: number; open: boolean; lit: boolean; onToggle: () => void; finish: THREE.MeshStandardMaterialParameters; handle: string; taped: boolean; onAdd: () => void; ctx: Ctx;
}) {
  const g = useRef<THREE.Group>(null); const front = useRef<THREE.Mesh>(null);
  useEffect(() => { ctx.engine?.progress.set(m.id, Number(open)); }, [open, m.id, ctx.engine]);
  useEffect(() => { const mesh = front.current; if (!ctx.engine || !mesh) return; ctx.engine.solids.add(mesh); return () => { ctx.engine?.solids.delete(mesh); }; }, [ctx.engine]);
  useFrame(({ clock }, dt) => {
    const extension = (ctx.engine?.progress.get(m.id) ?? Number(open)) * .34;
    if (g.current) g.current.position.z = ctx.reduced ? extension : THREE.MathUtils.damp(g.current.position.z, extension, 8, dt);
    if (front.current) (front.current.material as THREE.MeshStandardMaterial).emissiveIntensity = lit ? 0.35 + 0.15 * Math.sin(clock.elapsedTime * 3) : 0;
  });
  const pieces = m.pieces ?? [];
  return (
    <group ref={g} position={[x, y, 0]}>
      <mesh ref={front} position={[0, 0, D / 2 - 0.01]} castShadow onClick={(e) => { e.stopPropagation(); onToggle(); }} {...pointer}>
        <boxGeometry args={[w - 0.008, DRAWER_H - 0.008, 0.02]} /><meshStandardMaterial {...finish} emissive="#ffd27a" emissiveIntensity={0} />
      </mesh>
      <InteractionAnchor ctx={ctx} id={m.id} kind="handle" position={[0, DRAWER_H / 2 - .035, D / 2 + .0012]} progress={delta => { ctx.engine?.progress.set(m.id, THREE.MathUtils.clamp((ctx.engine.progress.get(m.id) ?? Number(open)) + delta, 0, 1)); ctx.engine?.notify(); }}><mesh><boxGeometry args={[w * 0.5, 0.01, 0.004]} /><meshStandardMaterial color={handle} /></mesh></InteractionAnchor>
      <Label3D text={m.category ?? m.label} w={w * 0.86} h={0.045} fg="#4a453c" position={[0, -0.02, D / 2 + 0.001]} />
      {pieces.length > 0 && <mesh position={[w / 2 - 0.03, DRAWER_H / 2 - 0.03, D / 2 + 0.002]}><circleGeometry args={[0.012, 16]} /><meshBasicMaterial color="#1F7A76" /></mesh>}
      {taped && <TailorTape width={w * 0.9} position={[0, DRAWER_H / 2 - 0.035, D / 2 + 0.008]} />}
      <mesh position={[0, -DRAWER_H / 2 + 0.02, 0.05]}><boxGeometry args={[w - 0.03, 0.01, D - 0.14]} /><meshStandardMaterial color="#efeae1" /></mesh>
      {open && pieces.length === 0 && <group position={[0, -DRAWER_H / 2 + 0.03, D / 2 - 0.12]}><EmptyDrawerCharm width={w} onAdd={onAdd} /></group>}
      {(open || (ctx.engine?.progress.get(m.id) ?? 0) > .6) && pieces.slice(0, 4).map((p, i) => (
        <group key={p.id} position={[(i % 2 ? 1 : -1) * w / 4, -DRAWER_H / 2 + .04, -.08 + Math.floor(i / 2) * .18]}>
          <InteractionAnchor ctx={ctx} id={p.id} kind="piece" available={(ctx.engine?.progress.get(m.id) ?? Number(open)) > .6} />
          <PieceMesh p={p} w={(w - .06) / 2} h={.15} ctx={ctx} lying />
        </group>))}
      {lit && <pointLight position={[0, 0, D / 2 + 0.2]} intensity={0.6} distance={0.6} color="#ffe6a0" />}
    </group>
  );
}

function LookBox({ b, x, season, count }: { b?: { id: string; title: string; coverImageUrl?: string | null; lookDoDia?: boolean }; x: number; season?: string; count?: number }) {
  const { t } = useI18n();
  const tex = useTex(b?.coverImageUrl);
  return (
    <group position={[x, Y.doors1 + 0.16, 0.02]}>
      <RoundedBox args={[0.26, 0.26, 0.4]} radius={0.01} castShadow><meshStandardMaterial color={season ? "#cfe0ea" : b?.lookDoDia ? "#f5d9a8" : "#e9e3d7"} roughness={0.9} /></RoundedBox>
      {b && <mesh position={[0, 0, 0.201]}><planeGeometry args={[0.2, 0.2]} /><meshStandardMaterial map={tex ?? undefined} color={tex ? "#fff" : "#d8d2c6"} /></mesh>}
      {season && <Label3D text={t("room3d.roomScene.pecas", { season, value: count ?? 0 })} w={0.22} h={0.14} px={192} bg="#f7fbfd" fg="#29485c" position={[0, 0, 0.202]} />}
    </group>
  );
}

/** Contorno do espelho pelo molde da loja (RF28 como item modular): retangular, arco, oval ou camarim. */
function mirrorShape(mold: string | null | undefined, w: number, h: number): THREE.Shape {
  const s = new THREE.Shape(); const hw = w / 2, hh = h / 2;
  if (mold === "ESP-OVL") { s.absellipse(0, 0, hw, hh, 0, Math.PI * 2, false, 0); return s; }
  if (mold === "ESP-ARC") { s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, hh - hw); s.absarc(0, hh - hw, hw, 0, Math.PI, false); s.lineTo(-hw, -hh); return s; }
  const r = 0.02;
  s.moveTo(-hw + r, -hh); s.lineTo(hw - r, -hh); s.quadraticCurveTo(hw, -hh, hw, -hh + r); s.lineTo(hw, hh - r); s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh); s.quadraticCurveTo(-hw, hh, -hw, hh - r); s.lineTo(-hw, -hh + r); s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

/** Botão 3D no vidro do espelho (RF28): pílula com rótulo, alvo de clique maior que o desenho. */
function GlassButton({ text, position, w, onClick, primary }: { text: string; position: [number, number, number]; w: number; onClick: () => void; primary?: boolean }) {
  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick(); }} {...pointer}>
      <RoundedBox args={[w, 0.075, 0.014]} radius={0.03} smoothness={4}><meshStandardMaterial color={primary ? "#C6275E" : "#f6f1e7"} emissive={primary ? "#C6275E" : "#000000"} emissiveIntensity={primary ? 0.3 : 0} roughness={0.5} /></RoundedBox>
      <Label3D text={text} w={w - 0.03} h={0.05} px={384} fg={primary ? "#ffffff" : "#2b2622"} font="600 30px Inter, Arial, sans-serif" position={[0, 0, 0.009]} />
    </group>
  );
}

/**
 * Smart Mirror (RF28): Look do Dia, peças penduradas com post-it do que falta, tema da Batalha na Passarela escrito no
 * vidro, fecho do Vista-me com a luz subindo, brilho de conquista das luzes do closet e os botões 3D dentro do vidro
 * (Vista-me, Usar este look, Outra sugestão, Tira uma coisa). O formato e a moldura vêm do módulo "mirror" do quarto,
 * trocável na loja como qualquer outro componente (retangular, arco, oval, camarim com luzes).
 */
function Mirror({ position, look, overlay, theme, onVistaMe, reduced, module }: { position: [number, number, number]; look?: RoomData3D["mirrorDailyLook"]; overlay?: MirrorOverlay; theme?: string | null; onVistaMe?: () => void; reduced: boolean; module?: RoomModule3D }) {
  const { t } = useI18n();
  const tex = useTex(look?.coverImageUrl);
  const reflection = useReflection(overlay?.reflectionUrl);
  const snapshot = useReflection(overlay?.snapshot?.url);
  // o vidro é alto e estreito; a foto tem a proporção do canvas: fica o miolo, sem esticar
  useEffect(() => { if (!snapshot || !overlay?.snapshot) return; const c = snapshotCrop(0.82 / 1.7, overlay.snapshot.aspect); snapshot.repeat.set(...c.repeat); snapshot.offset.set(...c.offset); snapshot.needsUpdate = true; }, [snapshot, overlay?.snapshot]);
  const riser = useRef<THREE.Mesh>(null); const start = useRef(-1);
  useEffect(() => { if (overlay?.closingKey) start.current = performance.now(); }, [overlay?.closingKey]);
  useFrame(() => {
    const m = riser.current; if (!m) return;
    const t = start.current < 0 ? 1 : (performance.now() - start.current) / (reduced ? 1 : 1400);
    m.visible = t < 1; if (t >= 1) return;
    m.scale.y = Math.max(0.01, t); m.position.y = 0.1 + (1.7 * t) / 2; (m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t * 0.6);
  });
  const mold = module?.mold ?? "ESP-RET"; const f = module?.finish ?? {};
  const frameGeo = useMemo(() => new THREE.ExtrudeGeometry(mirrorShape(mold, .9, 1.8), { depth: 0.04, bevelEnabled: false, curveSegments: 48 }), [mold]);
  const glassGeo = useMemo(() => new THREE.ShapeGeometry(mirrorShape(mold, .82, 1.7), 48), [mold]);
  const hanging = overlay?.pieces ?? [];
  const vanity = mold === "ESP-CAM";
  return (
    <group position={position} rotation={[0, deg(28), 0]}>
      <mesh geometry={frameGeo} position={[0, 0.95, -0.02]} castShadow><meshStandardMaterial color={f.color ?? "#2b2622"} metalness={f.metalness ?? 0.4} roughness={f.roughness ?? 0.35} /></mesh>
      <mesh geometry={glassGeo} position={[0, 0.95, 0.021]}><meshStandardMaterial color="#b7c3cb" metalness={0.55} roughness={0.12} /></mesh>
      {vanity && [-1, 1].flatMap((side) => [0, 1, 2, 3, 4].map((i) => <mesh key={`${side}-${i}`} position={[side * 0.28, 0.3 + i * 0.32, 0.04]}><sphereGeometry args={[0.024, 16, 12]} /><meshStandardMaterial color="#fff4d6" emissive="#ffd9a0" emissiveIntensity={1.2} toneMapped={false} /></mesh>))}
      {/* reflexo: o avatar da pessoa vestindo o look do espelho; sem ele, a capa do Look do Dia ou as peças penduradas */}
      {/* fundo do reflexo: a vista do guarda-roupa tirada do espelho ao abrir a prova; o avatar (PNG com alfa) por cima */}
      {snapshot && <mesh position={[0, 0.95, 0.0225]}><planeGeometry args={[0.8, 1.66]} /><meshBasicMaterial map={snapshot} color="#dfe5e9" toneMapped={false} /></mesh>}
      {reflection && <mesh position={[0, 1.2, 0.024]}><planeGeometry args={[0.5, 1.0]} /><meshBasicMaterial map={reflection} color="#ececec" transparent alphaTest={0.02} /></mesh>}
      {!reflection && tex && hanging.length === 0 && <mesh position={[0, 1.08, 0.024]}><planeGeometry args={[0.4, 0.8]} /><meshStandardMaterial map={tex} transparent alphaTest={0.05} /></mesh>}
      {!reflection && hanging.slice(0, 4).map((p, i) => <MirrorPiece key={p.id} url={p.imageUrl} position={[i % 2 ? 0.12 : -0.12, 1.38 - Math.floor(i / 2) * 0.38, 0.026]} />)}
      <mesh ref={riser} position={[0, 0.1, 0.03]} visible={false}><planeGeometry args={[0.54, 1.7]} /><meshBasicMaterial color="#fff4cf" transparent opacity={0.5} depthWrite={false} /></mesh>
      {overlay?.celebrate && <group position={[0, 0.4, 0.03]}><Sparkles reduced={reduced} /></group>}
    </group>
  );
}
function MirrorPiece({ url, position }: { url?: string | null; position: [number, number, number] }) {
  const tex = useTex(url);
  return <mesh position={position}><planeGeometry args={[0.22, 0.34]} /><meshStandardMaterial map={tex ?? undefined} color={tex ? "#fff" : "#d8d2c6"} transparent alphaTest={0.05} /></mesh>;
}

function Basket({ position, pieces, ctx }: { position: [number, number, number]; pieces: RoomPiece3D[]; ctx: Ctx }) {
  const { t } = useI18n();
  return (
    <group position={position}>
      <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.24, 0.2, 0.4, 24, 1, true]} /><meshStandardMaterial color="#b89a6a" roughness={1} side={THREE.DoubleSide} /></mesh>
      {pieces.slice(0, 3).map((p, i) => <group key={p.id} position={[-0.06 + i * 0.06, 0.36, 0]} rotation={[-0.4, i * 0.6, 0]}><PieceMesh p={p} w={0.28} h={0.28} ctx={ctx} /></group>)}
      <HangTag text={t("room3d.roomScene.para_lavar")} position={[0.2, 0.36, 0.2]} w={0.13} />
    </group>
  );
}

/** Arara do Desapego: etiqueta de preço e selo Garimpo nas peças de brechó. */
function SaleRack({ position, rack, ctx }: { position: [number, number, number]; rack: { name: string; pieces: RoomPiece3D[] }; ctx: Ctx }) {
  const { t } = useI18n();
  return (
    <group position={position} rotation={[0, -deg(25), 0]}>
      {[-0.4, 0.4].map((x) => <mesh key={x} position={[x, 0.7, 0]}><cylinderGeometry args={[0.012, 0.012, 1.4, 8]} /><meshStandardMaterial color="#9a9a9a" metalness={0.8} roughness={0.3} /></mesh>)}
      <mesh position={[0, 1.38, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.012, 0.012, 0.84, 8]} /><meshStandardMaterial color="#9a9a9a" metalness={0.8} roughness={0.3} /></mesh>
      <Label3D text={rack.name} w={0.6} h={0.1} px={384} fg="#fff" bg="#C6275E" position={[0, 1.5, 0]} />
      {rack.pieces.slice(0, 4).map((p, i) => (
        <group key={p.id} position={[-0.3 + i * 0.2, 1.3, 0.02 * i]}>
          <Hanger /><group position={[0, -0.34, 0.01]}><PieceMesh p={p} w={0.36} h={0.55} ctx={ctx} /></group>
          {p.salePrice != null && <HangTag text={`R$ ${Math.round(Number(p.salePrice))}`} position={[0.12, -0.12, 0.04]} />}
          {p.states?.includes("GARIMPO") && <HangTag text={t("common.garimpo")} color="#1F7A76" fg="#fff" position={[-0.1, -0.24, 0.04]} w={0.11} />}
        </group>))}
    </group>
  );
}

function Chair({ position, pieces, ctx }: { position: [number, number, number]; pieces: RoomPiece3D[]; ctx: Ctx }) {
  const wood = <meshStandardMaterial color="#8a6a4a" roughness={0.7} />;
  return (
    <group position={position} rotation={[0, deg(35), 0]}>
      <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[0.45, 0.05, 0.45]} />{wood}</mesh>
      <mesh position={[0, 0.72, -0.2]} castShadow><boxGeometry args={[0.45, 0.5, 0.04]} />{wood}</mesh>
      {[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x, 0.22, z]}><boxGeometry args={[0.04, 0.45, 0.04]} />{wood}</mesh>)}
      {pieces.slice(0, 3).map((p, i) => <group key={p.id} position={[-0.05 + i * 0.05, 0.62 + i * 0.03, -0.15]} rotation={[-0.2, 0, 0.1 * i]}><PieceMesh p={p} w={0.4} h={0.4} ctx={ctx} /></group>)}
    </group>
  );
}

/** Nível Closet: vitrine de bolsas (nichos de vidro) com o porta-joias em cima. */
function BagDisplay({ position, bags, jewelry, ctx }: { position: [number, number, number]; bags: RoomPiece3D[]; jewelry: RoomPiece3D[]; ctx: Ctx }) {
  const { t } = useI18n();
  return (
    <group position={position}>
      <mesh position={[0, 0.8, 0]} castShadow><boxGeometry args={[0.62, 1.6, 0.4]} /><meshStandardMaterial color="#efe9df" roughness={0.6} transparent opacity={0.25} /></mesh>
      {[0.02, 0.55, 1.08, 1.6].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[0.64, 0.02, 0.42]} /><meshStandardMaterial color="#d9cbb5" /></mesh>)}
      {[-0.31, 0.31].map((x) => <mesh key={x} position={[x, 0.8, 0]}><boxGeometry args={[0.02, 1.6, 0.42]} /><meshStandardMaterial color="#d9cbb5" /></mesh>)}
      {bags.slice(0, 6).map((p, i) => <group key={p.id} position={[i % 2 ? 0.14 : -0.14, 0.28 + Math.floor(i / 2) * 0.53, 0.05]}><PieceMesh p={p} w={0.24} h={0.24} ctx={ctx} /></group>)}
      <mesh position={[0, 1.36, 0.21]}><planeGeometry args={[0.6, 0.5]} /><meshPhysicalMaterial color="#ffffff" transmission={0.9} roughness={0.05} transparent opacity={0.2} /></mesh>
      <Label3D text={t("room3d.roomScene.vitrine_de_bolsas")} w={0.5} h={0.05} fg="#6b5a4a" position={[0, 0.1, 0.215]} />
      {/* porta-joias */}
      <group position={[0, 1.61, 0]}>
        <RoundedBox args={[0.3, 0.1, 0.2]} radius={0.015} position={[0, 0.05, 0]}><meshStandardMaterial color="#7a1f3d" roughness={0.8} /></RoundedBox>
        <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.006, 0.006, 0.12, 6]} /><meshStandardMaterial color="#C9A227" metalness={0.9} roughness={0.2} /></mesh>
        {jewelry.slice(0, 4).map((p, i) => <group key={p.id} position={[-0.09 + i * 0.06, 0.2, 0.02]}><PieceMesh p={p} w={0.07} h={0.07} ctx={ctx} /></group>)}
      </group>
    </group>
  );
}

/** Nível Atelier: ilha central (bancada) para comparar 2–3 looks lado a lado. */
function Island({ position, boxes }: { position: [number, number, number]; boxes: { id: string; title: string; coverImageUrl?: string | null }[] }) {
  const { t } = useI18n();
  return (
    <group position={position}>
      <RoundedBox args={[1.1, 0.42, 0.42]} radius={0.02} position={[0, 0.21, 0]} castShadow><meshStandardMaterial color="#e9e3d7" roughness={0.7} /></RoundedBox>
      <mesh position={[0, 0.425, 0]}><boxGeometry args={[1.14, 0.02, 0.46]} /><meshStandardMaterial color="#8a6a4a" roughness={0.5} /></mesh>
      {boxes.slice(0, 3).map((b, i) => <IslandCard key={b.id} b={b} x={-0.35 + i * 0.35} />)}
      <Label3D text={t("room3d.roomScene.ilha_compare_looks")} w={0.5} h={0.05} fg="#6b5a4a" position={[0, 0.2, 0.215]} />
    </group>
  );
}
function IslandCard({ b, x }: { b: { title: string; coverImageUrl?: string | null }; x: number }) {
  const tex = useTex(b.coverImageUrl);
  return <group position={[x, 0.6, 0]} rotation={[-0.15, 0, 0]}><mesh><boxGeometry args={[0.26, 0.34, 0.01]} /><meshStandardMaterial color="#fff" /></mesh><mesh position={[0, 0.02, 0.006]}><planeGeometry args={[0.22, 0.26]} /><meshStandardMaterial map={tex ?? undefined} color={tex ? "#fff" : "#d8d2c6"} /></mesh></group>;
}

/** Enquadra a câmera numa posição (Mostrar no quarto — RF32.CA09) respeitando os limites 3/4; depois devolve o controle. */
function CameraRig({ focus, home, homeDist, controls }: { focus: [number, number, number] | null; home: [number, number, number]; homeDist: number; controls: React.RefObject<unknown> }) {
  const { camera } = useThree();
  const key = focus ? focus.join(",") : `home-${home.join(",")}`;
  const animating = useRef(true);
  useEffect(() => { animating.current = true; }, [key]);
  useFrame((_, dt) => {
    const c = controls.current as { target: THREE.Vector3; update: () => void } | null; if (!c || !animating.current) return;
    const want = focus ? new THREE.Vector3(...focus) : new THREE.Vector3(...home); const dist = focus ? 3.0 : homeDist;
    c.target.lerp(want, 1 - Math.exp(-3 * dt));
    const dir = camera.position.clone().sub(c.target); const next = THREE.MathUtils.damp(dir.length(), dist, 2.5, dt);
    camera.position.copy(c.target.clone().add(dir.setLength(next)));
    c.update();
    if (c.target.distanceTo(want) < 0.01 && Math.abs(next - dist) < 0.01) animating.current = false;
  });
  return null;
}

function ResponsiveFov() {
  const { camera, size } = useThree();
  useEffect(() => { const cam = camera as THREE.PerspectiveCamera; const aspect = size.width / Math.max(1, size.height); cam.fov = aspect < 0.8 ? 62 : aspect < 1.1 ? 48 : 38; cam.updateProjectionMatrix(); }, [camera, size.width, size.height]);
  return null;
}

/** Posições fixas dos objetos (dependem do nível: o Loft acrescenta 1,8 m de móvel à direita). */
function layoutFor(level?: string) {
  const ext = atLeast(level, "LOFT") ? EXT_W + 0.04 : 0;
  const xr = W / 2 + ext;
  return {
    ext, xr,
    showcase: [xr + 0.35, 0, -0.08] as [number, number, number],
    bags: [xr + 1.0, 0, -0.08] as [number, number, number],
    sale: [xr + (atLeast(level, "CLOSET") ? 1.85 : 1.2), 0, 0.05] as [number, number, number],
    basket: [xr + 0.5, 0, 0.55] as [number, number, number],
    window: [xr + (atLeast(level, "CLOSET") ? 1.5 : 1.05), 2.05, -D / 2 - 0.005] as [number, number, number],
    lamp: [xr + (atLeast(level, "CLOSET") ? 2.5 : 1.9), 0, 0.35] as [number, number, number],
    calendar: [xr + 0.35, 1.72, -D / 2 - 0.005] as [number, number, number],
    mirror: [xr + .75, 0, 1.1] as [number, number, number],
    chair: [-W / 2 - 0.75, 0, 1.75] as [number, number, number],
    bust: [-W / 2 - 0.45, 0, 0.0] as [number, number, number],
    switch: [-W / 2 - 0.2, 1.15, -D / 2 - 0.005] as [number, number, number],
    keys: [-W / 2 - 0.2, 1.5, -D / 2 - 0.005] as [number, number, number],
    cork: [-W / 2 - 1.05, 2.35, -D / 2 - 0.005] as [number, number, number],
    box: [0.95, 0, 1.45] as [number, number, number],
    island: [-0.45, 0, 1.55] as [number, number, number],
  };
}

/** Posição (em coordenadas da cena) de um módulo, para o enquadramento e para o busto apontar. */
export function moduleAnchor(id: string, level?: string): [number, number, number] {
  const L = layoutFor(level);
  if (id.startsWith("door:")) {
    const i = Number(id.split(":")[1]) - 1;
    if (i >= 4) return [W / 2 + 0.02 + (i - 4) * (EXT_W / 2) + EXT_W / 4, Y.drawers1 + 0.6, 0.2];
    return [-W / 2 + i * DOOR_W + DOOR_W / 2, Y.drawers1 + 0.6, 0.2];
  }
  if (id.startsWith("drawer:")) {
    const n = Number(id.split(":")[1]);
    if (n > 24) { const k = n - 25; return [W / 2 + 0.02 + (k % 4) * EXT_DRAWER_W + EXT_DRAWER_W / 2, Y.drawers1 - (Math.floor(k / 4) + 0.5) * DRAWER_H + 0.05, 0.6]; }
    const col = (n - 1) % 8, row = Math.floor((n - 1) / 8); return [-W / 2 + col * DRAWER_W + DRAWER_W / 2, Y.drawers1 - (row + 0.5) * DRAWER_H + 0.05, 0.6];
  }
  if (id === "top" || id === "season") return [0, Y.doors1 + 0.17, 0.2];
  if (id === "base" || id === "shoe") return [0, 0.15, 0.3];
  if (id === "basket") return [L.basket[0], 0.3, L.basket[2]];
  if (id === "chair") return [L.chair[0], 0.6, L.chair[2]];
  if (id === "sale") return [L.sale[0], 1.0, L.sale[2]];
  if (id === "bags" || id === "jewelry") return [L.bags[0], 1.0, 0.1];
  if (id === "island") return [L.island[0], 0.5, L.island[2]];
  if (id === "mirror") return [L.mirror[0], 1.1, L.mirror[2]];
  return [L.ext / 2, 1.2, 0];
}

export default function RoomScene({ data, open, onToggle, highlight, focusModule, onPick, onReady, lit = new Set(), mirror, dark, onToggleTheme, onVistaMe, onCopilot,
  copilotPoint, copilotTalking, onKeys, onUnbox, unboxing, onAddToDrawer, gameplay }: RoomSceneProps) {
  const { t } = useI18n();
  const controls = useRef<unknown>(null);
  const [, refreshInteractions] = useState(0);
  useEffect(() => { if (!gameplay) return; const refresh = () => refreshInteractions(n => n + 1); gameplay.engine.listeners.add(refresh); return () => { gameplay.engine.listeners.delete(refresh); }; }, [gameplay?.engine]);
  const reduced = !!data.ambient?.reduceMotion;
  const period = dark ? "night" : data.ambient?.period === "fixed" ? "afternoon" : data.ambient?.period ?? "afternoon";
  const night = period === "night";
  const level = data.level ?? "ESTREIA";
  const L = useMemo(() => layoutFor(level), [level]);
  useEffect(() => { gameplay?.engine.mirror.set(...L.mirror); }, [gameplay?.engine, L]);
  const byId = useMemo(() => Object.fromEntries(data.modules.map((m) => [m.id, m])), [data.modules]);
  const doorFinish = byId["door:1"]?.finish ?? { color: "#F4F2EF", roughness: 0.8 };
  const signature = atLeast(level, "MAISON") && !!byId["signature"];
  const finishOf = (m?: RoomModule3D): THREE.MeshStandardMaterialParameters => {
    const f: NonNullable<RoomModule3D["finish"]> = m?.finish ?? doorFinish; const glass = f?.material === "VIDRO" || f?.material === "ACRILICO";
    return { color: f?.color ?? doorFinish.color ?? "#F4F2EF", roughness: f?.roughness ?? doorFinish.roughness ?? 0.8, metalness: f?.metalness ?? 0.02, transparent: glass, opacity: glass ? 0.6 : 1 };
  };
  const carcass = { ...finishOf(byId["door:1"]), transparent: false, opacity: 1 };
  const handle = byId["handles"]?.finish?.color ?? "#d6d2ca";
  const plate = byId["logo"]?.finish && (byId["logo"].finish.logoUrl || byId["logo"].finish.labelText || byId["logo"].finish.material) ? byId["logo"].finish : undefined;
  const hangerFinish = byId["hangers"]?.finish ? finishOf(byId["hangers"]) : undefined;
  const kelvin = data.light?.guided ? data.light.kelvin ?? 4000 : 4000;
  const lightColor = kelvinColor(kelvin);
  const mark = atLeast(level, "STUDIO") && data.monogram ? data.monogram : "FAI";
  const cam = data.camera ?? {}; const az = cam.azimuth ?? [-35, 35], po = cam.polar ?? [55, 80], zoom = cam.zoom ?? [0.8, 1.6];
  const focus = focusModule ? moduleAnchor(focusModule, level) : null;
  const homeDist = 5.3 + L.ext * 0.9;
  const shoes = [...(byId["base"]?.pieces ?? []), ...(byId["shoe"]?.pieces ?? [])];
  const showcase = Array.isArray(data.showcase) ? (data.showcase as RoomPiece3D[]) : [];
  const decos = data.decorations ?? [];
  const deco = (t: string) => decos.find((d) => d.type === t);
  const tagged = useMemo(() => new Set(deco("etiqueta_2a_chance")?.taggedPieceIds ?? []), [decos]); // eslint-disable-line react-hooks/exhaustive-deps
  const tapedIds = useMemo(() => new Set(deco("fita_alfaiate")?.tapedPieceIds ?? []), [decos]); // eslint-disable-line react-hooks/exhaustive-deps
  const taped = (m?: RoomModule3D) => !!m && tapedIds.size > 0 && (m.pieces ?? []).some((p) => tapedIds.has(p.id));
  const ctx: Ctx = { highlight, onPick, reduced, tagged, hanger: hangerFinish, engine: gameplay?.engine };
  const boxes: NonNullable<RoomModule3D["lookBoxes"]> = [];
  const penthouse = atLeast(level, "PENTHOUSE") && !!byId["season"];
  const pointAt = copilotPoint ? moduleAnchor(copilotPoint, level) : null;
  const litAny = (ids: string[]) => ids.some((i) => lit.has(i));
  const closetW = W + L.ext;
  return (
    <Canvas shadows dpr={gameplay ? [1, 1.5] : [1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }} camera={{ fov: 38, position: [1.75 + L.ext / 2, 2.35, 4.8 + L.ext * 0.8], near: 0.05, far: 40 }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; onReady?.(gl.domElement); }} aria-label={t("room3d.roomScene.meu_quarto_em_3d")}>
      <color attach="background" args={[night ? "#1d1f2a" : "#efe9df"]} />
      <fog attach="fog" args={[night ? "#1d1f2a" : "#efe9df", 8, 16]} />
      <hemisphereLight args={[night ? "#9aa0c8" : period === "morning" ? "#eef4ff" : "#fff6e8", night ? "#2a2433" : "#d9cbb5", night ? 0.55 : 0.9]} />
      <directionalLight position={[3, 5, 4]} intensity={night ? 0.35 : period === "golden" ? 1.3 : 1.6} color={period === "golden" ? "#ffd2a0" : period === "morning" ? "#f1f6ff" : "#ffffff"} castShadow shadow-mapSize={gameplay ? [1024, 1024] : [2048, 2048]} shadow-camera-left={-5} shadow-camera-right={6} shadow-camera-top={4} shadow-camera-bottom={-2} />
      {/* quarto: piso, parede do fundo e lateral, tapete */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[16, 12]} /><meshStandardMaterial color={night ? "#5a4636" : "#b8906a"} roughness={0.75} /></mesh>
      <mesh position={[0, 2, -D / 2 - 0.02]} receiveShadow><planeGeometry args={[16, 4]} /><meshStandardMaterial color={night ? "#343747" : "#e8e1d4"} roughness={1} /></mesh>
      <mesh position={[-3.4, 2, 2]} rotation={[0, Math.PI / 2, 0]} receiveShadow><planeGeometry args={[6, 4]} /><meshStandardMaterial color={night ? "#2e3140" : "#e2dacb"} roughness={1} /></mesh>
      {byId["rug"] && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[L.ext / 2, 0.004, 1.3]} receiveShadow><circleGeometry args={[1.1, 48]} /><meshStandardMaterial color={night ? "#6b4c5c" : "#d9b8a0"} roughness={1} /></mesh>}

      {/* carcaça do FAI Origem (+ extensão do Loft) */}
      <group>
        <mesh position={[L.ext / 2, Y.top1 / 2, -D / 2 + 0.01]}><boxGeometry args={[closetW, Y.top1, 0.02]} /><meshStandardMaterial {...carcass} color="#e7e2d9" /></mesh>
        {[-W / 2 - 0.01, W / 2 + 0.01, ...(L.ext ? [W / 2 + L.ext + 0.01] : [])].map((x) => <mesh key={x} position={[x, Y.top1 / 2, 0]} castShadow receiveShadow><boxGeometry args={[0.02, Y.top1, D]} /><meshStandardMaterial {...carcass} /></mesh>)}
        {[Y.base1, Y.drawers1, Y.doors1, Y.top1].map((y) => <mesh key={y} position={[L.ext / 2, y, 0]} castShadow receiveShadow><boxGeometry args={[closetW + 0.04, 0.02, D]} /><meshStandardMaterial {...carcass} /></mesh>)}
        {[1, 2, 3].map((i) => <mesh key={i} position={[-W / 2 + i * DOOR_W, (Y.drawers1 + Y.doors1) / 2, 0]}><boxGeometry args={[0.018, Y.doors1 - Y.drawers1, D - 0.02]} /><meshStandardMaterial {...carcass} /></mesh>)}
        {L.ext > 0 && <mesh position={[W / 2 + 0.02 + EXT_W / 2, (Y.drawers1 + Y.doors1) / 2, 0]}><boxGeometry args={[0.018, Y.doors1 - Y.drawers1, D - 0.02]} /><meshStandardMaterial {...carcass} /></mesh>}
        {/* closet de assinatura (Maison): filetes dourados e placa */}
        {signature && <>
          {[Y.base1, Y.drawers1, Y.doors1, Y.top1].map((y) => <mesh key={`g${y}`} position={[L.ext / 2, y, D / 2 + 0.002]}><boxGeometry args={[closetW + 0.04, 0.008, 0.004]} /><meshStandardMaterial color="#C9A227" metalness={0.9} roughness={0.2} /></mesh>)}
          <Label3D text={t("room3d.roomScene.closet_de_assinatura", { value: data.monogram ? ` · ${data.monogram}` : "" })} w={0.9} h={0.08} px={512} bg="#1a1a1a" fg="#E9B949" font="italic 600 30px Georgia, serif" position={[L.ext / 2, Y.top1 + 0.3, 0.02]} />
        </>}
        {/* iluminação guiada (Studio+): fita de LED sob o maleiro na temperatura escolhida */}
        {atLeast(level, "STUDIO") && <mesh position={[L.ext / 2, Y.doors1 - 0.015, D / 2 - 0.04]}><boxGeometry args={[closetW - 0.06, 0.008, 0.01]} /><meshBasicMaterial color={lightColor} toneMapped={false} /></mesh>}
      </group>

      {/* portas 1–4 (e 5–6 do Loft) com cabideiro */}
      {[1, 2, 3, 4].map((n) => { const m = byId[`door:${n}`]; return m ? <DoorBay key={n} m={m} x0={-W / 2 + (n - 1) * DOOR_W} doorW={DOOR_W} hingeLeft={(n - 1) % 2 === 0} open={open.has(m.id)} lit={lit.has(m.id)} onToggle={() => onToggle(m.id)} finish={finishOf(m)} handle={handle} mark={mark} taped={taped(m)} light={lightColor} ctx={ctx} plate={plate} /> : null; })}
      {L.ext > 0 && [5, 6].map((n) => { const m = byId[`door:${n}`]; return m ? <DoorBay key={n} m={m} x0={W / 2 + 0.02 + (n - 5) * (EXT_W / 2)} doorW={EXT_W / 2} hingeLeft={n === 5} open={open.has(m.id)} lit={lit.has(m.id)} onToggle={() => onToggle(m.id)} finish={finishOf(m)} handle={handle} mark={mark} taped={taped(m)} light={lightColor} ctx={ctx} plate={plate} /> : null; })}
      {/* 24 gavetas (+12 do Loft) */}
      {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => { const m = byId[`drawer:${n}`]; if (!m) return null; const col = (n - 1) % 8, row = Math.floor((n - 1) / 8);
        return <Drawer key={n} m={m} x={-W / 2 + col * DRAWER_W + DRAWER_W / 2} y={Y.drawers1 - (row + 0.5) * DRAWER_H} w={DRAWER_W} open={open.has(m.id)} lit={lit.has(m.id)} onToggle={() => onToggle(m.id)} finish={finishOf(m)} handle={handle} taped={taped(m)} onAdd={() => onAddToDrawer?.(m.id)} ctx={ctx} />; })}
      {L.ext > 0 && Array.from({ length: 12 }, (_, i) => i + 25).map((n) => { const m = byId[`drawer:${n}`]; if (!m) return null; const k = n - 25;
        return <Drawer key={n} m={m} x={W / 2 + 0.02 + (k % 4) * EXT_DRAWER_W + EXT_DRAWER_W / 2} y={Y.drawers1 - (Math.floor(k / 4) + 0.5) * DRAWER_H} w={EXT_DRAWER_W} open={open.has(m.id)} lit={lit.has(m.id)} onToggle={() => onToggle(m.id)} finish={finishOf(m)} handle={handle} taped={taped(m)} onAdd={() => onAddToDrawer?.(m.id)} ctx={ctx} />; })}

      {/* maleiro: caixas de look; no Penthouse, as caixas da troca de estação; na Cápsula, a caixa trancada com fita */}
      {boxes.slice(0, penthouse ? 6 : tapedIds.size ? 7 : 8).map((b, i) => <LookBox key={b.id} b={b} x={-W / 2 + 0.16 + i * 0.3} />)}
      {penthouse && <LookBox x={-W / 2 + 0.16 + 6 * 0.3} season={t("room3d.roomScene.fora_de_estacao")} count={(byId["season"]?.pieces ?? []).length} />}
      {tapedIds.size > 0 && <group position={[-W / 2 + 0.16 + 7 * 0.3, 0, 0]}><LookBox x={0} season={t("room3d.roomScene.fora_da_capsula")} count={tapedIds.size} /><TailorTape width={0.3} position={[0, Y.doors1 + 0.16, 0.225]} rotation={[0, 0, 0.6]} /></group>}
      {L.ext > 0 && boxes.slice(8, 13).map((b, i) => <LookBox key={b.id} b={b} x={W / 2 + 0.2 + i * 0.32} />)}

      {/* base de calçados (vira Sapateira no Closet) com LED que acende no Vista-me */}
      {atLeast(level, "CLOSET") && <mesh position={[L.ext / 2, 0.16, 0.05]} rotation={[-0.25, 0, 0]}><boxGeometry args={[closetW - 0.04, 0.012, 0.36]} /><meshStandardMaterial color="#d9cbb5" /></mesh>}
      {shoes.slice(0, atLeast(level, "CLOSET") ? 16 : 10).map((p, i) => <group key={p.id} position={[-W / 2 + 0.16 + i * 0.23, 0.14, 0.12]}><PieceMesh p={p} w={0.22} h={0.2} ctx={ctx} /></group>)}
      <mesh position={[L.ext / 2, 0.02, D / 2 - 0.01]}><boxGeometry args={[closetW - 0.04, 0.01, 0.01]} /><meshBasicMaterial color={litAny(["base", "shoe"]) ? "#ffd27a" : "#9b958a"} toneMapped={false} /></mesh>
      {litAny(["base", "shoe"]) && <pointLight position={[L.ext / 2, 0.2, 0.6]} intensity={1} distance={1.6} color="#ffe6a0" />}
      {atLeast(level, "CLOSET") && <Label3D text={t("room3d.roomScene.sapateira")} w={0.34} h={0.05} fg="#6b5a4a" position={[L.ext / 2, 0.26, D / 2 + 0.005]} />}

      {/* luzes do closet: marcos do Inventory Score */}
      {data.closetLights && data.closetLights.milestones.length > 0 && <group position={[L.ext / 2, 0, 0]}><ClosetLights y={Y.top1 + 0.1} width={closetW} milestones={data.closetLights.milestones} celebrate={!!mirror?.celebrate} reduced={reduced} /></group>}

      {/* vitrine da peça ícone */}
      {showcase.length > 0 && <group position={L.showcase}>
        <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[0.36, 0.9, 0.36]} /><meshStandardMaterial color="#f4f1ea" roughness={0.6} /></mesh>
        <mesh position={[0, 1.12, 0]}><boxGeometry args={[0.34, 0.44, 0.34]} /><meshPhysicalMaterial color="#ffffff" transmission={0.9} roughness={0.05} thickness={0.02} transparent opacity={0.35} /></mesh>
        <group position={[0, 1.1, 0]}><PieceMesh p={showcase[0]} w={0.26} h={0.26} ctx={ctx} /></group>
        <Label3D text={t("room3d.roomScene.peca_icone")} w={0.3} h={0.05} fg="#6b5a4a" position={[0, 0.8, 0.185]} />
      </group>}
      {atLeast(level, "CLOSET") && (byId["bags"] || byId["jewelry"]) && <BagDisplay position={L.bags} bags={byId["bags"]?.pieces ?? []} jewelry={byId["jewelry"]?.pieces ?? []} ctx={ctx} />}
      {atLeast(level, "ATELIER") && byId["island"] && <Island position={L.island} boxes={boxes.slice(0, 3)} />}

      <Mirror position={L.mirror} look={data.mirrorDailyLook} overlay={mirror} theme={deco("tema_espelho")?.theme ?? null} onVistaMe={onVistaMe} reduced={reduced} module={byId["mirror"]} />
      <DressForm position={L.bust} pointAt={pointAt} talking={!!copilotTalking} onClick={() => onCopilot?.()} reduced={reduced} />
      {(data.basket ?? []).length > 0 && <Basket position={L.basket} pieces={data.basket ?? []} ctx={ctx} />}
      {data.saleRack && data.saleRack.pieces.length > 0 && <SaleRack position={L.sale} rack={data.saleRack} ctx={ctx} />}
      <Chair position={L.chair} pieces={data.chair ?? []} ctx={ctx} />

      {/* parede: interruptor (tema), gancho das chaves, janela, calendário e quadro de cortiça */}
      <LightSwitch position={L.switch} on={!dark} onToggle={() => onToggleTheme?.()} />
      <KeyHook position={L.keys} keys={data.keys ?? []} onClick={() => onKeys?.()} />
      <RoomWindow position={L.window} period={period} seasonal={data.ambient?.seasonal && data.ambient.seasonal !== "null" ? data.ambient.seasonal : null} />
      <Lamp position={L.lamp} on={night} />
      {deco("calendario_parede") && <WallCalendar position={L.calendar} days={deco("calendario_parede")!.days ?? 0} />}
      {deco("quadro_cortica") && <CorkBoard position={L.cork} days={deco("quadro_cortica")!.days ?? 10} polaroids={deco("quadro_cortica")!.polaroids ?? []} />}

      {/* Caixa FAI: item comprado esperando o unboxing */}
      {(data.unboxing?.length ?? 0) > 0 && <FaiBox position={L.box} count={data.unboxing!.length} opening={!!unboxing} onOpen={() => onUnbox?.()} />}

      <ContactShadows position={[L.ext / 2, 0.005, 0.4]} opacity={0.35} scale={10} blur={2.4} far={3} />
      {gameplay && <RoomAvatarController gameplay={gameplay} closetRight={W / 2 + L.ext} />}
      {gameplay && <LoosePieces engine={gameplay.engine} pieces={data.pieces} ctx={ctx} />}
      {!gameplay && <OrbitControls ref={controls as never} makeDefault enablePan={false} target={[L.ext / 2, 1.2, 0]}
        minAzimuthAngle={deg(az[0])} maxAzimuthAngle={deg(az[1])} minPolarAngle={deg(po[0])} maxPolarAngle={deg(po[1])}
        minDistance={homeDist / zoom[1]} maxDistance={homeDist / zoom[0]} enableDamping dampingFactor={0.08} />}
      {!gameplay && <CameraRig focus={focus} home={[L.ext / 2, 1.2, 0]} homeDist={homeDist} controls={controls} />}
      <ResponsiveFov />
    </Canvas>
  );
}
