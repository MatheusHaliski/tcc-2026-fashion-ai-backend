"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { deg } from "@/components/room3d/room-props";
import { MIRROR_NORMAL } from "@/lib/room3d/mirror-session";
import { CORNERS, viewPose, type SavedView } from "@/lib/room3d/camera-views";
import type { CameraOptions } from "@/lib/room3d/room-settings";
import { ROOM_CAMERA_EVENT, ROOM_TURN_EVENT, ROOM_ZOOM_EVENT } from "@/lib/room3d/interaction";
import { roomCenter } from "@/lib/room3d/room-bounds";

/* Câmera do Meu Quarto 3D fora do modo andar: enquadrar um módulo, girar a órbita, lente, pontos de vista, névoa e a pose atual. */

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Enquadra a câmera numa posição (Mostrar no quarto — RF32.CA09); depois devolve o controle. Módulo noutra parede (o
 * 2º guarda-roupa, a oeste): a câmera também gira até ficar de frente para ele (`facing`, a normal da frente no chão).
 */
export function CameraRig({ focus, facing, home, homeDist, controls }: { focus: [number, number, number] | null; facing?: [number, number] | null; home: [number, number, number]; homeDist: number; controls: React.RefObject<unknown> }) {
  const { camera, gl } = useThree();
  const key = focus ? focus.join(",") : `home-${home.join(",")}`;
  const animating = useRef(true), turning = useRef<boolean | null>(null);
  useEffect(() => { animating.current = true; turning.current = null; }, [key]);
  // a pessoa mexeu na câmera (arrastar, roda, pinça, Q/E ou os botões de girar e aproximar/afastar): o enquadramento para ali
  useEffect(() => {
    type Starts = { addEventListener: (type: "start", fn: () => void) => void; removeEventListener: (type: "start", fn: () => void) => void };
    const el = gl.domElement, c = controls.current as Starts | null;
    const stop = () => { animating.current = false; };
    const onKey = (e: KeyboardEvent) => { if (e.code === "KeyQ" || e.code === "KeyE") stop(); };
    const onAnalog = (e: Event) => { const a = (e as CustomEvent).detail; if (a?.x || a?.y || a?.zoom) stop(); };
    el.addEventListener(ROOM_CAMERA_EVENT, onAnalog);
    el.addEventListener(ROOM_TURN_EVENT, stop); el.addEventListener(ROOM_ZOOM_EVENT, stop); el.addEventListener("keydown", onKey); c?.addEventListener("start", stop);
    return () => { el.removeEventListener(ROOM_CAMERA_EVENT, onAnalog); el.removeEventListener(ROOM_TURN_EVENT, stop); el.removeEventListener(ROOM_ZOOM_EVENT, stop); el.removeEventListener("keydown", onKey); c?.removeEventListener("start", stop); };
  }, [gl, controls]);
  useFrame((_, dt) => {
    const c = controls.current as { target: THREE.Vector3; minDistance: number; maxDistance: number; update: () => void } | null; if (!c || !animating.current) return;
    // a distância do enquadramento respeita o limite de zoom da órbita: fora dele o update() a puxaria de volta a cada
    // quadro e o enquadramento nunca terminaria (desfazendo o Afastar)
    const want = focus ? new THREE.Vector3(...focus) : new THREE.Vector3(...home); const dist = THREE.MathUtils.clamp(focus ? 3.0 : homeDist, c.minDistance, c.maxDistance);
    c.target.lerp(want, 1 - Math.exp(-3 * dt));
    const dir = camera.position.clone().sub(c.target);
    if (focus && facing) {
      const delta = Math.atan2(Math.sin(Math.atan2(facing[0], facing[1]) - Math.atan2(dir.x, dir.z)), Math.cos(Math.atan2(facing[0], facing[1]) - Math.atan2(dir.x, dir.z)));
      if (turning.current === null) turning.current = Math.abs(delta) > deg(35);   // dentro dos 35° de sempre, mantém o ângulo da pessoa
      if (turning.current) { const done = Math.abs(delta) < 0.005; dir.applyAxisAngle(UP, done ? delta : delta * (1 - Math.exp(-3 * dt))); if (done) turning.current = false; }
    }
    const next = THREE.MathUtils.damp(dir.length(), dist, 2.5, dt);
    camera.position.copy(c.target.clone().add(dir.setLength(next)));
    c.update();
    if (c.target.distanceTo(want) < 0.01 && Math.abs(next - dist) < 0.01 && !turning.current) animating.current = false;
  });
  return null;
}

/**
 * Modo foto/órbita: os botões da interface (room-scene-controls.tsx) giram a cena de 45° em 45° em torno do alvo (volta
 * inteira, agora que as paredes somem por trás) e aproximam/afastam; Q/E também giram com o canvas focado.
 */
export function OrbitTurn({ controls, reduced, speed = 1, invertX = false, invertY = false }: { controls: React.RefObject<unknown>; reduced: boolean; speed?: number; invertX?: boolean; invertY?: boolean }) {
  const { gl, camera } = useThree();
  const pending = useRef(0); const axes = useRef({ x: 0, y: 0, zoom: 0 });
  useEffect(() => {
    const el = gl.domElement; el.tabIndex = 0;
    const orbit = () => controls.current as { target: THREE.Vector3; minDistance: number; maxDistance: number; update: () => void } | null;
    const turn = (e: Event) => { pending.current += Math.sign(Number((e as CustomEvent).detail) || 0) * deg(45); };
    const zoom = (e: Event) => {
      const c = orbit(); if (!c) return;
      const off = camera.position.clone().sub(c.target), closer = Number((e as CustomEvent).detail) > 0;
      off.setLength(THREE.MathUtils.clamp(off.length() * (closer ? 0.85 : 1.18), c.minDistance, c.maxDistance)); camera.position.copy(c.target).add(off); c.update();
    };
    const key = (e: KeyboardEvent) => { if (e.code !== "KeyQ" && e.code !== "KeyE") return; e.preventDefault(); pending.current += (e.code === "KeyQ" ? 1 : -1) * deg(45); };
    const analog = (e: Event) => { axes.current = (e as CustomEvent).detail; };
    el.addEventListener(ROOM_CAMERA_EVENT, analog);
    el.addEventListener(ROOM_TURN_EVENT, turn); el.addEventListener(ROOM_ZOOM_EVENT, zoom); el.addEventListener("keydown", key);
    return () => { el.removeEventListener(ROOM_CAMERA_EVENT, analog); el.removeEventListener(ROOM_TURN_EVENT, turn); el.removeEventListener(ROOM_ZOOM_EVENT, zoom); el.removeEventListener("keydown", key); };
  }, [gl, camera, controls]);
  useFrame((_, dt) => {
    const c = controls.current as { target: THREE.Vector3; update: () => void } | null; if (!c) return;
    if (axes.current.x || axes.current.y || axes.current.zoom) {
      const sphere = new THREE.Spherical().setFromVector3(camera.position.clone().sub(c.target));
      sphere.radius = THREE.MathUtils.clamp(sphere.radius * Math.exp((axes.current.zoom ?? 0) * dt), (c as { minDistance?: number }).minDistance ?? .7, (c as { maxDistance?: number }).maxDistance ?? 12);
      // sensibilidade e eixos invertidos da aba Configurações
      sphere.theta += axes.current.x * dt * 1.1 * speed * (invertX ? -1 : 1); sphere.phi = THREE.MathUtils.clamp(sphere.phi + axes.current.y * dt * .7 * speed * (invertY ? -1 : 1), .2, Math.PI / 2 - .05);
      camera.position.copy(c.target).add(new THREE.Vector3().setFromSpherical(sphere)); c.update();
    }
    if (Math.abs(pending.current) < 1e-4) return;
    const step = reduced || Math.abs(pending.current) < 0.002 ? pending.current : pending.current * (1 - Math.exp(-8 * dt));
    pending.current -= step;
    camera.position.sub(c.target).applyAxisAngle(UP, step).add(c.target); c.update();
  });
  return null;
}

export function ResponsiveFov({ fov }: { fov?: number | null }) {
  const { camera, size } = useThree();
  // a abertura de base fica em userData.baseFov: o controle do avatar abre um pouco mais dentro do quarto (room-avatar-controller.tsx);
  // a lente escolhida nas Configurações vale no lugar da automática (pela proporção da tela)
  useEffect(() => { const cam = camera as THREE.PerspectiveCamera; const aspect = size.width / Math.max(1, size.height); cam.fov = cam.userData.baseFov = fov ?? (aspect < 0.8 ? 62 : aspect < 1.1 ? 48 : 38); cam.updateProjectionMatrix(); }, [camera, size.width, size.height, fov]);
  return null;
}

/**
 * Ponto de vista da aba Configurações com a câmera livre desligada (fora do modo andar): canto do teto, planta, casa de
 * bonecas, guarda-roupa, entrada, o que o espelho vê, cinematográfica ou uma vista salva. A câmera vai até a pose
 * (corte seco com movimento reduzido) e a órbita fica parada; num canto, girar (Q/E, botões) passa ao canto vizinho.
 */
export function PresetCamera({ options, mirror, door, onViewStep }: { options: CameraOptions; mirror: [number, number, number]; door: [number, number, number]; onViewStep?: (step: number) => void }) {
  const { camera, size, gl } = useThree();
  const look = useRef<THREE.Vector3 | null>(null);
  const stepRef = useRef(onViewStep); stepRef.current = onViewStep;
  const corner = !options.saved && CORNERS.includes(options.view);
  useEffect(() => {
    if (!corner) return;
    const el = gl.domElement;
    const turn = (e: Event) => { const d = Math.sign(Number((e as CustomEvent).detail) || 0); if (d) stepRef.current?.(-d); };
    const key = (e: KeyboardEvent) => { if ((e.code === "KeyQ" || e.code === "KeyE") && !e.repeat) { e.preventDefault(); stepRef.current?.(e.code === "KeyQ" ? -1 : 1); } };
    el.addEventListener(ROOM_TURN_EVENT, turn); el.addEventListener("keydown", key);
    return () => { el.removeEventListener(ROOM_TURN_EVENT, turn); el.removeEventListener("keydown", key); };
  }, [gl, corner]);
  // ao voltar à câmera livre, a lente volta à de base (a órbita retoma dali)
  useEffect(() => () => { const lens = camera as THREE.PerspectiveCamera; if (lens.userData.baseFov) { lens.fov = lens.userData.baseFov; lens.updateProjectionMatrix(); } }, [camera]);
  useFrame(({ clock }, dt) => {
    const pose = options.saved
      ? { position: new THREE.Vector3(...options.saved.position), target: new THREE.Vector3(...options.saved.target), fov: undefined }
      : viewPose(options.view, { mirror: { x: mirror[0], z: mirror[2] }, mirrorNormal: MIRROR_NORMAL, door: { x: door[0], z: door[2] }, time: clock.elapsedTime, aspect: size.width / Math.max(1, size.height), still: options.still });
    if (!pose) return;
    if (!look.current) look.current = camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(3).add(camera.position);
    const k = options.cut ? 1 : 1 - Math.exp(-3.2 * dt);
    camera.position.lerp(pose.position, k); look.current.lerp(pose.target, k); camera.lookAt(look.current);
    const lens = camera as THREE.PerspectiveCamera, want = options.fov ?? pose.fov ?? lens.userData.baseFov ?? lens.fov;
    if (Math.abs(lens.fov - want) > 0.01) { lens.fov += (want - lens.fov) * k; lens.updateProjectionMatrix(); }
  });
  return null;
}

/** A névoa acompanha a distância da câmera: de longe (planta, casa de bonecas) o quarto não some no nevoeiro. */
export function FogFollow() {
  const center = useMemo(() => roomCenter().setY(1), []);
  useFrame(({ camera, scene }) => {
    const fog = scene.fog as THREE.Fog | null; if (!fog) return;
    const near = Math.max(8, camera.position.distanceTo(center) * 0.9);
    fog.near = near; fog.far = near + 8;
  });
  return null;
}

/** Guarda a câmera de agora (posição e para onde olha) para salvar como vista favorita. */
export function CameraProbe({ poseRef }: { poseRef: React.MutableRefObject<SavedView | null> }) {
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    camera.getWorldDirection(dir);
    const p = camera.position, round = (n: number) => Math.round(n * 1000) / 1000;
    poseRef.current = { position: [round(p.x), round(p.y), round(p.z)], target: [round(p.x + dir.x * 3), round(p.y + dir.y * 3), round(p.z + dir.z * 3)] };
  });
  return null;
}
