"use client";
import { useEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { StudioLight, useCanvasTexture, useReducedMotion, useTex, type Avatar3dRef, type Look3dPiece } from "@/components/three/common";
import { Mannequin, bodyParamsOf } from "@/components/three/mannequin";
import { useBodyAsset, type HumanParts } from "@/components/three/human-avatar";
import { SceneDebug, type SceneDebugOptions } from "@/components/three/scene-debug";
import { buildSpec, type BodyParams } from "@/lib/avatar3d/body-spec";
import type { BrandEnvironment, LightMode, ResolvedEnvironment } from "@/lib/tryon/fitting-room";
import type { AvatarView } from "@/components/three/avatar-viewer";
import { ReferenceGallery } from "@/components/three/store-fixtures";
import type { StoreScene } from "@/lib/scene3d/scene";
import { resolveFittingStudio, STUDIO_PALETTE, type FittingStudioProfile } from "@/lib/scene3d/fitting-studio";
import { approach, orbitGoal, type FittingCameraApi, type OrbitLimitState, type OrbitPose } from "@/lib/scene3d/orbit-steps";
import { useI18n } from "@/lib/i18n/i18n";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { applyIdle } from "@/lib/avatar3d/human/pose";
import { PAD, usePad, type Axis } from "@/lib/input/gamepad";
import { atMirror, faceMirror, FITTING_MIRROR, mirrorNormal, mirrorSpot, placeOf, walkStep, walkToward, type Floor, type FittingPlace, type FittingWalkApi } from "@/lib/scene3d/fitting-walk";
import {
  BACK_Z, box, CabinBench, CabinEntrance, CeilingSpots, CornerPlant, cyl, DOOR_GAP, FRONT_Z, PaintedWall, Pouf, PROP_CUT, ROOM_CZ, ROOM_D, ROOM_W, Rug, SIDE_X, WALL_H,
  useCutaway, useFused, useLiteDecor, useStudioKit, wallCut, type Part, type StudioKit,
} from "@/components/three/fitting-cabin";

/** Browser Three.js fitting studio in metres. Architecture is conceptual, not a
 * reconstruction of a physical store. Catalogue photos are framed references;
 * parametric clothing on the avatar remains a visual preview, not a fitted asset.
 */
const ANGLE: Record<AvatarView, number> = { front: 0, left34: -35, right34: 35, profile: 90, back: 180 };
type V3 = [number, number, number];
type Controls = ComponentRef<typeof OrbitControls>;
function Rig({ view, target, dist, yaw }: { view: AvatarView; target: [number, number, number]; dist: number; yaw?: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const angle = (yaw ?? ANGLE[view]) * Math.PI / 180;
    camera.position.set(target[0] + Math.sin(angle) * dist, target[1] + .12, target[2] + Math.cos(angle) * dist);
    camera.lookAt(...target); camera.updateProjectionMatrix();
  }, [view, camera, target, dist, yaw]);
  return null;
}

/**
 * Botões de acessibilidade (fora do Canvas, em components/try-on): giram 30° e aproximam pela mesma órbita do arrasto,
 * em movimento suave — ou de uma vez com "reduzir movimento". Arrastar ou trocar de vista interrompe o giro.
 */
function CameraSteps({ controls, dist, view, yaw, reduced, onCamera }: {
  controls: RefObject<Controls | null>; dist: number; view: AvatarView; yaw?: number; reduced: boolean; onCamera?: (api: FittingCameraApi | null) => void;
}) {
  const camera = useThree((s) => s.camera);
  const tween = useRef<{ pose: OrbitPose; goal: OrbitPose } | null>(null);
  const sph = useMemo(() => new THREE.Spherical(), []), off = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => { tween.current = null; }, [view, yaw]);
  useEffect(() => {
    const c = controls.current; if (!c || !onCamera) return;
    const limits = { minRadius: c.minDistance, maxRadius: c.maxDistance };
    const home = (() => { sph.setFromVector3(off.set(0, .12, dist)); return { theta: 0, phi: sph.phi, radius: sph.radius }; })();
    const poseNow = (): OrbitPose => { sph.setFromVector3(off.subVectors(camera.position, c.target)); return { theta: sph.theta, phi: sph.phi, radius: sph.radius }; };
    const listeners = new Set<(s: OrbitLimitState) => void>(); let last = "";
    const emit = () => {
      const d = camera.position.distanceTo(c.target), state = { atMin: d <= c.minDistance + .01, atMax: d >= c.maxDistance - .01 }, key = `${state.atMin}|${state.atMax}`;
      if (key !== last) { last = key; listeners.forEach((l) => l(state)); }
    };
    const cancel = () => { tween.current = null; };
    c.addEventListener("start", cancel); c.addEventListener("change", emit);
    onCamera({
      step: (action) => { const pose = tween.current?.pose ?? poseNow(); tween.current = { pose, goal: orbitGoal(tween.current?.goal ?? pose, action, limits, home) }; },
      subscribe: (listener) => { listeners.add(listener); last = ""; emit(); return () => { listeners.delete(listener); }; },
    });
    return () => { c.removeEventListener("start", cancel); c.removeEventListener("change", emit); onCamera(null); };
  }, [controls, camera, dist, onCamera, sph, off]);
  useFrame((_, dt) => {
    const tw = tween.current, c = controls.current; if (!tw || !c) return;
    tw.pose = approach(tw.pose, tw.goal, reduced ? 1 : 1 - Math.exp(-dt * 9));
    camera.position.setFromSpherical(sph.set(tw.pose.radius, tw.pose.phi, tw.pose.theta)).add(c.target); c.update();
    if (tw.pose === tw.goal) tween.current = null;
  });
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
  useEffect(() => () => word.dispose(), [word]);
  const image = logo?.image as HTMLImageElement | undefined;
  const aspect = image?.width ? image.width / Math.max(1, image.height) : 4;
  const width = Math.min(1.2, .32 * aspect);
  // um pouco menor e mais baixa que antes: inteira acima da cabeça na vista de frente (antes saía cortada pelo topo)
  return <group name={`studio-identity-${env.key}`} position={[0, 2.25, BACK_Z + .03]} scale={.85}>
    <mesh><boxGeometry args={[1.48, .5, .03]} /><meshStandardMaterial color="#F7F5F0" roughness={.85} /></mesh>
    <mesh position={[0, -.25, .016]}><planeGeometry args={[1.48, .012]} /><meshStandardMaterial color={env.accent} roughness={.8} /></mesh>
    <mesh position={[0, 0, .019]}><planeGeometry args={logo ? [width, width / aspect] : [1.36, .34]} /><meshBasicMaterial map={logo ?? word} transparent toneMapped={false} /></mesh>
  </group>;
}

/**
 * Espelho de corpo inteiro em pé: moldura de madeira (de costas ele ainda é um móvel) e dois pés no chão. Com o avatar
 * na frente dele (`live`), o vidro reflete de verdade (Reflector: a cabine desenhada de novo pela câmera espelhada);
 * longe, é um vidro liso, sem o custo de desenhar a cena duas vezes.
 */
function Mirror({ kit, live }: { kit: StudioKit; live: boolean }) {
  const frame = useFused(() => [box(.82, 2.18, .04, [0, 0, 0]), box(.07, .1, .32, [-.33, -1.13, -.04]), box(.07, .1, .32, [.33, -1.13, -.04])], []);
  const geometry = useMemo(() => new THREE.PlaneGeometry(.75, 2.1), []);
  const glass = useMemo(() => live ? new Reflector(geometry, { textureWidth: 512, textureHeight: 1024, clipBias: .003,
    color: new THREE.Color().setRGB(.46, .47, .48, THREE.LinearSRGBColorSpace) }) : null, [geometry, live]);
  useEffect(() => () => glass?.dispose(), [glass]);
  return <group name="studio-full-height-mirror" position={[FITTING_MIRROR.x, FITTING_MIRROR.height, FITTING_MIRROR.z]} rotation={[0, FITTING_MIRROR.yaw, 0]} userData={PROP_CUT}>
    <mesh geometry={frame} material={kit.wood} />
    {glass ? <primitive object={glass} position={[0, 0, .025]} />
      : <mesh geometry={geometry} position={[0, 0, .025]}><meshStandardMaterial color="#ECEEEB" metalness={1} roughness={.04} /></mesh>}
  </group>;
}
/** Banco e cabideiro junto à parede do fundo: madeira e metal escovado (a cor da marca fica só nos detalhes). */
function BenchAndRail({ kit }: { kit: StudioKit }) {
  const wood = useFused(() => [box(1.05, .1, .43, [0, .46, 0]), box(.045, .41, .34, [-.43, .205, 0]), box(.045, .41, .34, [.43, .205, 0]), ...[-.3, 0, .3].flatMap((x): Part[] => [
    { ...box(.18, .014, .018, [x - .075, 1.54, -.25]), rot: [0, 0, .55] }, { ...box(.18, .014, .018, [x + .075, 1.54, -.25]), rot: [0, 0, -.55] },
  ])], []);
  const metal = useFused(() => [
    cyl(.012, .012, 1.1, [0, 1.7, -.25], [0, 0, Math.PI / 2], 10),
    ...[-.3, 0, .3].map((x): Part => ({ g: new THREE.TorusGeometry(.026, .005, 6, 12, Math.PI * 1.4), at: [x, 1.635, -.25] })),
  ], []);
  return <group name="studio-bench-and-hangers" position={[-1.48, 0, BACK_Z + .43]} userData={PROP_CUT}>
    <mesh geometry={wood} material={kit.wood} /><mesh geometry={metal} material={kit.hardware} />
  </group>;
}
/** semente estável por marca (o quadro abstrato muda de composição entre marcas, nunca entre visitas) */
const seedOf = (key: string) => { let h = 2166136261; for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/**
 * Cabine fechada: fundo (placa, galeria, banco), laterais e a parede da frente como entrada (porta, banco estofado,
 * quadro, ganchos, placa luminosa). A parede virada para a câmera e os móveis que tapariam o avatar saem de cena
 * (useCutaway); o tapete e os spots ficam sempre.
 */
function Room({ profile, target, mirrorLive = false }: { profile: FittingStudioProfile; target: V3; mirrorLive?: boolean }) {
  const { t } = useI18n(), p = profile.palette, kit = useStudioKit(p), lite = useLiteDecor(), root = useRef<THREE.Group>(null);
  useCutaway(root, target);
  return <group ref={root} name="conceptual-fitting-studio">
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, ROOM_CZ]} receiveShadow><planeGeometry args={[ROOM_W, ROOM_D]} /><meshStandardMaterial color={p.floor} roughness={.88} /></mesh>
    <mesh position={[0, WALL_H, ROOM_CZ]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[ROOM_W, ROOM_D]} /><meshStandardMaterial color={p.ceiling} roughness={.95} /></mesh>
    <CeilingSpots kit={kit} /><Rug palette={p} />
    <group name="studio-back-wall" userData={wallCut(0, 1, BACK_Z, .7)}>
      <PaintedWall kit={kit} palette={p} width={ROOM_W} position={[0, 0, BACK_Z]} />
      <IdentityPlaque env={profile.brand} />
      <ReferenceGallery products={profile.photographs} label={t("tryOn.reference_images")} position={[1.72, 1.55, BACK_Z + .03]} />
      <BenchAndRail kit={kit} />
    </group>
    <group name="studio-front-wall" userData={wallCut(0, -1, -FRONT_Z, .5)}>
      <PaintedWall kit={kit} palette={p} width={ROOM_W} gaps={[DOOR_GAP]} gain={1.2} position={[0, 0, FRONT_Z]} rotation={[0, Math.PI, 0]} />
      <CabinEntrance kit={kit} palette={p} sign={t("tryOn.cabine_placa")} seed={seedOf(profile.brand.key)} lite={lite} />
      <CabinBench kit={kit} />
      {!lite && <><CornerPlant kit={kit} /><Pouf kit={kit} /></>}
    </group>
    {[-1, 1].map(side => <group key={side} name={`studio-side-wall-${side < 0 ? "left" : "right"}`} userData={wallCut(-side, 0, -SIDE_X, .5)}>
      <PaintedWall kit={kit} palette={p} width={ROOM_D} position={[side * SIDE_X, 0, ROOM_CZ]} rotation={[0, -side * Math.PI / 2, 0]} />
    </group>)}
    <Mirror kit={kit} live={mirrorLive} />
  </group>;
}

const WALK_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};
/**
 * Andar pela cabine: setas/WASD (com a cena em foco), analógico esquerdo ou direcional do controle, ou os botões "Ir ao
 * espelho"/"Voltar ao centro". A câmera acompanha o avatar (o alvo da órbita anda junto) e, ao chegar na frente do
 * espelho, passa para a primeira pessoa (na altura dos olhos, olhando o vidro): a pessoa vê a roupa vestida no reflexo,
 * como no espelho do Meu Quarto. Andar de novo devolve a câmera para trás do avatar. No controle: analógico direito e L1/R1 giram a câmera,
 * × vai ao espelho (ou volta ao centro se já estiver nele) e ○ volta ao centro.
 */
function Walker({ actor, parts, controls, height, reduced, onPlace, onWalk }: {
  actor: RefObject<THREE.Group | null>; parts: HumanParts | null; controls: RefObject<Controls | null>; height: number; reduced: boolean;
  onPlace: (place: FittingPlace) => void; onWalk?: (api: FittingWalkApi | null) => void;
}) {
  const { camera, gl } = useThree();
  const at = useRef<Floor>({ x: 0, z: 0 }), yaw = useRef(0), phase = useRef(0), keys = useRef(new Set<string>());
  const pad = useRef<{ move: Axis; look: Axis }>({ move: { x: 0, y: 0 }, look: { x: 0, y: 0 } });
  const goal = useRef<Floor | null>(null), place = useRef<FittingPlace>("center"), framed = useRef(false);
  const listeners = useRef(new Set<(p: FittingPlace) => void>());
  const sph = useMemo(() => new THREE.Spherical(), []);
  // a câmera em primeira pessoa volta para trás do avatar sozinha quando ele começa a andar (ver useFrame)
  const go = (to: "mirror" | "center") => { goal.current = to === "mirror" ? mirrorSpot() : { x: 0, z: 0 }; };
  useEffect(() => {
    const canvas = gl.domElement; canvas.tabIndex = 0;
    const down = (e: KeyboardEvent) => { if (WALK_KEYS[e.code]) { e.preventDefault(); keys.current.add(e.code); goal.current = null; } };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.code); };
    const clear = () => keys.current.clear(), focus = () => canvas.focus();
    canvas.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", clear); canvas.addEventListener("blur", clear); canvas.addEventListener("pointerdown", focus);
    onWalk?.({ to: go, subscribe: (l) => { listeners.current.add(l); l(place.current); return () => { listeners.current.delete(l); }; } });
    return () => { canvas.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear); canvas.removeEventListener("blur", clear); canvas.removeEventListener("pointerdown", focus); onWalk?.(null); };
  }, [gl, onWalk]);
  usePad(true, (f) => {
    pad.current = { move: f.move, look: f.look };
    if (f.move.x || f.move.y) goal.current = null;
    if (f.tapped(PAD.cross)) go(atMirror(at.current) ? "center" : "mirror");
    if (f.tapped(PAD.circle)) go("center");
  }, () => { pad.current = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } }; });
  useFrame(({ clock }, dt) => {
    const c = controls.current, a = actor.current; if (!c || !a) return;
    const kx = [...keys.current].reduce((s, k) => s + (WALK_KEYS[k]?.[0] ?? 0), 0), ky = [...keys.current].reduce((s, k) => s + (WALK_KEYS[k]?.[1] ?? 0), 0);
    const input = { x: Math.max(-1, Math.min(1, kx + pad.current.move.x)), y: Math.max(-1, Math.min(1, ky + pad.current.move.y)) };
    const cameraYaw = Math.atan2(camera.position.x - c.target.x, camera.position.z - c.target.z);
    let heading: number | null = null;
    const step = walkStep(at.current, input, dt, cameraYaw);
    if (step) { at.current = step.at; heading = step.heading; goal.current = null; }
    else if (goal.current) { const w = walkToward(at.current, goal.current, dt); at.current = w.at; heading = w.heading; if (w.arrived) goal.current = null; }
    const moving = heading !== null, mirror = atMirror(at.current);
    const turnTo = (want: number, rate: number) => { yaw.current += Math.atan2(Math.sin(want - yaw.current), Math.cos(want - yaw.current)) * Math.min(1, dt * rate); };
    if (moving) turnTo(heading!, 9); else if (mirror) turnTo(faceMirror(at.current), 6);
    a.position.set(at.current.x, 0, at.current.z); a.rotation.y = yaw.current;
    if (parts) {
      applyIdle(parts.human, parts.pose, clock.elapsedTime, moving ? 0 : .3);
      phase.current += moving ? dt * 7 : 0;
      if (moving) for (const [side, offset] of [["Left", 0], ["Right", Math.PI]] as const) {
        const swing = Math.sin(phase.current + offset) * .32;
        parts.human.bone(`${side}UpLeg`).rotateX(swing); parts.human.bone(`${side}Leg`).rotateX(Math.max(0, -swing) * .8);
        parts.human.bone(`${side}Arm`).rotateX(-swing * .6);
      }
    }
    const n = mirrorNormal(), k = reduced ? 1 : Math.min(1, dt * 6);
    // no espelho e parado: primeira pessoa — olhos do avatar, um palmo à frente do rosto, olhando o centro do vidro
    if (mirror && !moving) {
      if (!framed.current) { framed.current = true; c.enabled = false; }
      const eye = new THREE.Vector3(at.current.x - n.x * .16, height * .93, at.current.z - n.z * .16);
      camera.position.lerp(eye, reduced ? 1 : Math.min(1, dt * 4));
      camera.lookAt(FITTING_MIRROR.x, height * .55, FITTING_MIRROR.z);
      const now = placeOf(at.current);
      if (now !== place.current) { place.current = now; onPlace(now); listeners.current.forEach((l) => l(now)); }
      return;
    }
    if (framed.current) {
      // saiu do espelho: a câmera volta para trás do avatar, de frente para onde ele está
      framed.current = false; c.enabled = true;
      c.target.set(at.current.x, height * .6, at.current.z);
      camera.position.set(at.current.x + n.x * 2.4, height * .8, at.current.z + n.z * 2.4);
    }
    // a órbita segue o avatar: alvo e câmera andam juntos (o ângulo escolhido pela pessoa fica)
    const delta = new THREE.Vector3(at.current.x - c.target.x, height * .6 - c.target.y, at.current.z - c.target.z).multiplyScalar(k);
    c.target.add(delta); camera.position.add(delta);
    // analógico direito / L1-R1: gira a câmera em volta do avatar (e sobe/desce um pouco)
    if (pad.current.look.x || pad.current.look.y) {
      sph.setFromVector3(camera.position.clone().sub(c.target));
      sph.theta -= pad.current.look.x * dt * 1.6; sph.phi = THREE.MathUtils.clamp(sph.phi + pad.current.look.y * dt * .9, .35, Math.PI * .52);
      camera.position.setFromSpherical(sph).add(c.target);
    }
    c.update();
    const now = placeOf(at.current);
    if (now !== place.current) { place.current = now; onPlace(now); listeners.current.forEach((l) => l(now)); }
  });
  return null;
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

export default function FittingRoomScene({ avatar, sex, build, skinTone, body, pieces, environment, scene, light = "store", view = "front", onCanvas, onProfile, debug, cameraYaw, closeUp = false, onCamera, onWalk }: {
  avatar: Avatar3dRef | null; sex: "FEMININO" | "MASCULINO"; build?: string | null; skinTone?: string | null; body?: BodyParams | null;
  pieces: Look3dPiece[]; environment: ResolvedEnvironment; scene?: StoreScene | null; light?: LightMode; view?: AvatarView; onCanvas?: (c: HTMLCanvasElement) => void;
  /** o perfil do estúdio desenhado (objetos com função, paleta, fotos de referência) — inventário da auditoria */
  onProfile?: (profile: FittingStudioProfile) => void;
  /** laboratório/auditoria: wireframe, corpo oculto, pesos e poses de verificação (components/three/scene-debug.tsx) */
  debug?: SceneDebugOptions | null;
  /** laboratório: ângulo livre da câmera (graus) para o giro de 360°, e enquadramento só do avatar */
  cameraYaw?: number; closeUp?: boolean;
  /** botões de acessibilidade do palco: recebem os passos de câmera (girar 30°, aproximar, voltar à frente) */
  onCamera?: (api: FittingCameraApi | null) => void;
  /** botões "Ir ao espelho"/"Voltar ao centro": andar até um ponto e acompanhar onde o avatar está */
  onWalk?: (api: FittingWalkApi | null) => void;
}) {
  const { t } = useI18n(), asset = useBodyAsset(), reduced = useReducedMotion(), controls = useRef<Controls>(null);
  const [parts, setParts] = useState<HumanParts | null>(null);
  const actor = useRef<THREE.Group>(null), [mirrorLive, setMirrorLive] = useState(false);
  // laboratório e auditoria (pose de verificação, giro de 360°) ficam com o avatar parado no centro
  const walking = !debug && cameraYaw === undefined;
  sex = avatar?.model?.sex ?? sex;
  const params = body ?? bodyParamsOf({ sex, build, avatar }), height = buildSpec(params).stature;
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
      <Lights light={light} /><Room key={env.key} profile={profile} target={target} mirrorLive={mirrorLive} />
      <group ref={actor} name="fitting-avatar">
        <Mannequin mannequin={{ sex, build: build ?? "MEDIUM", skinTone: avatar ? null : skinTone ?? null, head: avatar ? "AVATAR" : "PADRAO", avatar }} pieces={pieces} sway={false} body={params}
          fallback={null} still={!!debug?.pose} externalPose={walking} onHuman={setParts} />
      </group>
      {walking && <Walker actor={actor} parts={parts} controls={controls} height={height} reduced={reduced} onPlace={(p) => setMirrorLive(p === "mirror")} onWalk={onWalk} />}
      {debug && <SceneDebug parts={parts} options={debug} />}
      <Rig view={view} target={target} dist={dist} yaw={cameraYaw} /><OrbitControls ref={controls} target={target} enablePan={false} minDistance={1.4} maxDistance={dist * 1.25} maxPolarAngle={Math.PI * .52} />
      <CameraSteps controls={controls} dist={dist} view={view} yaw={cameraYaw} reduced={reduced} onCamera={onCamera} />
    </Canvas>
    <p className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/90 px-3 py-1 text-xs text-neutral-700">{t("tryOn.studio_conceptual")}</p>
  </div>;
}
