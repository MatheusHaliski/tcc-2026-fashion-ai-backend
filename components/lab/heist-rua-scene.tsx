"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { emptyView, type SceneView } from "@/lib/heist/view";
import { HeistExterior } from "@/components/heist/scene/exterior";
import { HeistPostFX, HeistSky } from "@/components/heist/scene/sky";

/** Enquadramentos: posição da câmera, alvo e onde a "jogadora" estaria (muda névoa, flashes e luzes). */
const CAMS: Record<string, { pos: [number, number, number]; target: [number, number, number]; player: [number, number, number]; fov?: number }> = {
  avenida: { pos: [4.2, 0.35, 49.6], target: [-2.5, 5.2, 25], player: [4, -1.6, 47.5] },
  escadaria: { pos: [0.6, -0.15, 35.2], target: [0, 2.6, 24], player: [0, -1.6, 32.8] },
  fila: { pos: [17.2, -0.05, 32.2], target: [3, -0.4, 31.2], player: [16.5, -1.6, 32.3] },
  fachada: { pos: [-7.5, -0.7, 32], target: [-4, 8.5, 24.5], player: [-7, -1.6, 32.4] },
  beco: { pos: [26.4, 0.0, 21.5], target: [23.4, 0.8, -12], player: [26, -1.6, 21] },
  revendedor: { pos: [-23.8, 0.05, 44.4], target: [-28.2, -0.5, 49], player: [-25, -1.6, 46] },
  fas: { pos: [1.6, 1.5, 25.6], target: [0, -0.6, 46], player: [1.4, 0, 25.4] },
  doca: { pos: [-12.5, -0.1, 31.5], target: [-19, 0.5, 24.5], player: [-14, -1.6, 30] },
  drone: { pos: [34, 26, 74], target: [0, 0, 28], player: [0, -1.6, 40], fov: 42 },
};

function Rig({ cam, view, ready }: { cam: (typeof CAMS)[string]; view: React.MutableRefObject<SceneView>; ready: () => void }) {
  const { camera, scene } = useThree();
  const frames = useRef(0);
  useEffect(() => { camera.position.set(...cam.pos); camera.lookAt(...cam.target); (camera as THREE.PerspectiveCamera).fov = cam.fov ?? 55; (camera as THREE.PerspectiveCamera).updateProjectionMatrix(); }, [camera, cam]);
  useFrame((_, dt) => {
    const v = view.current; v.time += dt; v.player.x = cam.player[0]; v.player.y = cam.player[1]; v.player.z = cam.player[2];
    if (++frames.current === 40) {
      // depuração: malhas com posição inválida (NaN) estragam o bloom inteiro
      const bad: string[] = [];
      scene.traverse((o) => {
        const m = o as THREE.Mesh; const p = m.geometry?.getAttribute?.("position"); if (!p) return;
        let nan = 0; const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
        for (let i = 0; i < p.count; i++) { const v = [p.getX(i), p.getY(i), p.getZ(i)]; if (v.some((c) => !Number.isFinite(c))) { nan++; continue; } for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } }
        if (!nan) return;
        const mat = m.material as THREE.MeshStandardMaterial, chain: string[] = []; for (let q: THREE.Object3D | null = m; q; q = q.parent) chain.push(q.name || q.type);
        bad.push(`${m.type} nan=${nan}/${p.count} lo=${lo.map((c) => c.toFixed(1))} hi=${hi.map((c) => c.toFixed(1))} color=${mat?.color?.getHexString?.()} rough=${mat?.roughness} metal=${mat?.metalness} chain=${chain.slice(0, 5).join("<")}`);
      });
      (window as unknown as { __nan?: string[] }).__nan = bad;
      ready();
    }
  });
  return null;
}

export default function HeistRuaScene() {
  const params = useMemo(() => new URLSearchParams(typeof location === "undefined" ? "" : location.search), []);
  const key = params.get("cam") ?? "avenida", q = (params.get("q") === "low" ? "low" : "high") as "high" | "low", post = params.get("fx") !== "0";
  const cam = CAMS[key] ?? CAMS.avenida;
  const view = useRef<SceneView>((() => { const v = emptyView(); v.playerRoom = "rua"; v.doors = { ...v.doors, front: true, dockGate: false, carpetGate: false } as SceneView["doors"]; return v; })());
  return (
    <Canvas shadows={q === "high"} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true }} camera={{ fov: 55, near: 0.05, far: 500, position: cam.pos }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
      <Rig cam={cam} view={view} ready={() => { (window as unknown as { __heistRuaReady?: boolean }).__heistRuaReady = true; }} />
      <HeistSky quality={q} view={view} />
      <HeistExterior view={view} quality={q} />
      {post && <HeistPostFX quality={q} view={view} letterbox={params.get("lb") ? Number(params.get("lb")) : 0} />}
      <OrbitControls target={cam.target} enableDamping={false} />
    </Canvas>
  );
}
