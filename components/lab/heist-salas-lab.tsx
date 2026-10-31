"use client";
/*
 * Laboratório do interior do MET Gala Heist v2: as salas do museu sem a simulação e sem gente (HeistPeople é de outro
 * módulo). Câmera livre (arrastar/rolar) com enquadramentos prontos em ?cam= e chaves para fotografar cada estado:
 *   ?q=low|high  qualidade · ?alarm=1 giroflex · ?vision=1 contornos da Visão · ?power=0 Sala das Joias sem energia
 *   ?diamond=0 pedestal vazio · ?doors=0 todas as portas fechadas · ?sky=1 céu, lua e névoa da rua por cima
 *   ?fx=0 sem pós-processamento · ?hud=0 sem o painel de números
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DOORS } from "@/lib/heist/level";
import type { DoorId, RoomId } from "@/lib/heist/types";
import { emptyView, type SceneView } from "@/lib/heist/view";
import { HeistInterior } from "@/components/heist/scene/interior";
import { HeistPostFX, HeistSky } from "@/components/heist/scene/sky";

type V3 = [number, number, number];
/** Enquadramentos: posição da câmera, alvo, a sala da "jogadora" e onde ela estaria (x, z). */
const CAMS: Record<string, { pos: V3; target: V3; room: RoomId; player: [number, number]; fov?: number }> = {
  salao: { pos: [8.6, 2.3, 13.2], target: [-1.5, 2.9, 1.2], room: "salao", player: [6.5, 11.5] },
  floral: { pos: [3.8, 1.75, 9.9], target: [0, 2.6, 4.5], room: "salao", player: [3, 9] },
  mezanino: { pos: [-10.6, 6.6, 12.8], target: [2, 2, 1], room: "salao", player: [-6, 12], fov: 60 },
  bar: { pos: [14.6, 1.7, 7.4], target: [20.4, 1.5, 10.4], room: "lounge", player: [15.5, 8] },
  lounge: { pos: [21.3, 2.0, 13.4], target: [14.6, 1.5, 6.6], room: "lounge", player: [20.4, 13] },
  vestibulo: { pos: [0.6, 1.8, 23.3], target: [0, 2.3, 15], room: "vestibulo", player: [0.4, 22.4] },
  galeria: { pos: [0, 1.75, -7.2], target: [0, 1.9, -21.5], room: "galeria", player: [0, -8.2] },
  vitrines: { pos: [-3.4, 1.7, -11.4], target: [-6.5, 1.3, -14.5], room: "galeria", player: [-3.6, -11.8] },
  bastidores: { pos: [21.2, 1.8, 3.3], target: [14.6, 1.3, -3.4], room: "bastidores", player: [20.4, 2.6] },
  labirinto: { pos: [-13.25, 1.65, 14.6], target: [-13.25, 1.45, 3], room: "servico", player: [-13.25, 13.8] },
  seguranca: { pos: [-18.85, 1.75, 7.25], target: [-21.4, 1.0, 3.0], room: "seguranca", player: [-19.3, 6.6] },
  joias: { pos: [-13.0, 1.85, -7.4], target: [-17.25, 1.0, -14.25], room: "cofre", player: [-13.4, -8.2] },
  pedestal: { pos: [-15.2, 1.55, -12.3], target: [-17.25, 1.15, -14.25], room: "cofre", player: [-15.4, -12.6] },
  terraco: { pos: [13.3, 1.7, -9.6], target: [19.5, 1.5, -19.5], room: "terraco", player: [13.8, -10.2] },
  doca: { pos: [-9.3, 2.1, 23.4], target: [-18, 1.4, 17.4], room: "doca", player: [-10, 22.8] },
};

function Rig({ cam, view, hud }: { cam: (typeof CAMS)[string]; view: React.MutableRefObject<SceneView>; hud: React.RefObject<HTMLDivElement | null> }) {
  const { camera, gl } = useThree();
  const acc = useRef({ t: 0, n: 0 });
  useEffect(() => {
    camera.position.set(...cam.pos); camera.lookAt(...cam.target);
    const pc = camera as THREE.PerspectiveCamera; pc.fov = cam.fov ?? 55; pc.updateProjectionMatrix();
    const v = view.current; v.playerRoom = cam.room; v.player.x = cam.player[0]; v.player.z = cam.player[1]; v.player.room = cam.room;
  }, [camera, cam, view]);
  useFrame((_, dt) => {
    const v = view.current; v.time += dt;
    const w = window as unknown as { __heistSalasFrame?: number; __heistSalasReady?: boolean; __heistSalasCam?: string };
    w.__heistSalasCam = Object.keys(CAMS).find((k) => CAMS[k] === cam);
    w.__heistSalasFrame = (w.__heistSalasFrame ?? 0) + 1; if (w.__heistSalasFrame === 8) w.__heistSalasReady = true;
    acc.current.t += dt; acc.current.n++;
    if (hud.current && acc.current.n >= 30) {
      const i = gl.info.render;
      hud.current.textContent = `${(acc.current.n / acc.current.t).toFixed(0)} fps · ${i.calls} draws · ${(i.triangles / 1000).toFixed(0)}k tri · sala ${v.playerRoom}`;
      acc.current = { t: 0, n: 0 };
    }
  });
  return null;
}

function LabScene({ hud }: { hud: React.RefObject<HTMLDivElement | null> }) {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const [key, setKey] = useState(params.get("cam") ?? "salao"), cam = CAMS[key] ?? CAMS.salao;
  const q = (params.get("q") === "low" ? "low" : "high") as "high" | "low";
  const view = useRef<SceneView>((() => {
    const v = emptyView(); v.playerRoom = cam.room;
    v.player.x = cam.player[0]; v.player.z = cam.player[1]; v.player.room = cam.room;
    const open = params.get("doors") !== "0";
    v.doors = Object.fromEntries(DOORS.map((d) => [d.id, open])) as Record<DoorId, boolean>;
    v.alarm = params.get("alarm") === "1"; v.vision = params.get("vision") === "1";
    v.lasersPowered = params.get("power") !== "0"; v.diamondOnPedestal = params.get("diamond") !== "0";
    return v;
  })());
  const sky = params.get("sky") === "1", post = params.get("fx") !== "0";
  // para as capturas: troca de enquadramento e de estado sem recarregar (a montagem do interior é o que demora)
  useEffect(() => {
    const w = window as unknown as { __heistSalas?: unknown };
    w.__heistSalas = {
      cams: Object.keys(CAMS), go: (k: string) => setKey(k),
      set: (o: Partial<Pick<SceneView, "alarm" | "vision" | "lasersPowered" | "diamondOnPedestal">> & { doors?: boolean }) => {
        const v = view.current; Object.assign(v, { ...o, doors: v.doors });
        if (o.doors !== undefined) v.doors = Object.fromEntries(DOORS.map((d) => [d.id, o.doors])) as Record<DoorId, boolean>;
      },
    };
  }, []);
  return (
    <Canvas shadows={q === "high"} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true }} camera={{ fov: cam.fov ?? 55, near: 0.05, far: 400, position: cam.pos }}
      onCreated={({ gl, scene }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1; gl.outputColorSpace = THREE.SRGBColorSpace; if (!sky) scene.background = new THREE.Color("#030406"); }}>
      <Rig cam={cam} view={view} hud={hud} />
      {sky && <HeistSky quality={q} view={view} />}
      <HeistInterior view={view} quality={q} />
      {post && <HeistPostFX quality={q} view={view} />}
      <OrbitControls target={cam.target} enableDamping={false} />
    </Canvas>
  );
}

export default function HeistSalasLab() {
  const [ready, setReady] = useState(false);
  const hud = useRef<HTMLDivElement | null>(null);
  useEffect(() => { setReady(true); }, []);
  const showHud = ready && new URLSearchParams(location.search).get("hud") !== "0";
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      {ready && <LabScene hud={hud} />}
      {showHud && <div ref={hud} style={{ position: "absolute", left: 8, bottom: 6, font: "11px ui-monospace, monospace", color: "#9fe8ff", opacity: 0.75, pointerEvents: "none" }} />}
    </div>
  );
}
