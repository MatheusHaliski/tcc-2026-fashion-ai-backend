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
  fila: { pos: [17.6, 0.0, 30.4], target: [3, -0.3, 31.6], player: [17, -1.6, 30.6] },
  fachada: { pos: [-5.3, -0.65, 32.5], target: [-3.5, 8.8, 24.5], player: [-5.2, -1.6, 32.6] },
  beco: { pos: [26.4, 0.0, 21.5], target: [23.4, 0.8, -12], player: [26, -1.6, 21] },
  revendedor: { pos: [-23.8, 0.05, 44.4], target: [-28.2, -0.5, 49], player: [-25, -1.6, 46] },
  fas: { pos: [1.6, 1.5, 25.6], target: [0, -0.6, 46], player: [1.4, 0, 25.4] },
  doca: { pos: [-12.5, -0.1, 31.5], target: [-19, 0.5, 24.5], player: [-14, -1.6, 30] },
  drone: { pos: [-58, 55, 37], target: [4, 0, 36], player: [-20, -1.6, 40], fov: 50 },
  cidade: { pos: [26, 0.2, 44.2], target: [-30, 4, 47], player: [26, -1.6, 44.4] },
  calcada: { pos: [-11.6, -0.55, 47.3], target: [-13.4, -1.55, 49.4], player: [-11.6, -1.6, 47.3] },
  vitrines: { pos: [3, 0.15, 47.6], target: [-5, 1.2, 51.3], player: [3, -1.6, 47.6] },
};

function Rig({ cam, view, ready }: { cam: (typeof CAMS)[string]; view: React.MutableRefObject<SceneView>; ready: () => void }) {
  const { camera, scene, gl } = useThree();
  const frames = useRef(0);
  const done = useRef<(() => Record<string, string>) | null>(null);
  useEffect(() => { camera.position.set(...cam.pos); camera.lookAt(...cam.target); (camera as THREE.PerspectiveCamera).fov = cam.fov ?? 55; (camera as THREE.PerspectiveCamera).updateProjectionMatrix(); }, [camera, cam]);
  useFrame((_, dt) => {
    const v = view.current; v.time += dt; v.player.x = cam.player[0]; v.player.y = cam.player[1]; v.player.z = cam.player[2];
    const info = gl.info;
    if (frames.current === 14) {
      // soma todas as passadas de um quadro e separa por passada: cena, reflexo da pista, mapas de sombra e pós (chamadas/triângulos)
      info.autoReset = false; info.reset();
      const passes: Record<string, [number, number]> = {}, sh = [0, 0];
      const render = gl.render, shadow = gl.shadowMap.render;
      gl.shadowMap.render = (...a: Parameters<typeof shadow>) => { const c0 = info.render.calls, t0 = info.render.triangles; shadow.apply(gl.shadowMap, a); sh[0] += info.render.calls - c0; sh[1] += info.render.triangles - t0; };
      gl.render = (s: THREE.Object3D, c: THREE.Camera) => {
        const c0 = info.render.calls, t0 = info.render.triangles, s0 = sh[0], s1 = sh[1];
        render.call(gl, s, c);
        const k = c === camera ? "cena" : (c as THREE.OrthographicCamera).isOrthographicCamera ? "pos" : "reflexo", p = (passes[k] ??= [0, 0]);
        p[0] += info.render.calls - c0 - (sh[0] - s0); p[1] += info.render.triangles - t0 - (sh[1] - s1);
      };
      done.current = () => {
        gl.render = render; gl.shadowMap.render = shadow;
        const out: Record<string, string> = {};
        for (const [k, [c, t]] of Object.entries(passes)) out[k] = `${c}/${Math.round(t / 1000)}k`;
        if (sh[0]) out.sombras = `${sh[0]}/${Math.round(sh[1] / 1000)}k`;
        return out;
      };
    }
    if (frames.current === 15) {
      const passes = done.current?.(); done.current = null;
      (window as unknown as { __heistRuaInfo?: object }).__heistRuaInfo = { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0, passes };
      info.autoReset = true;
    }
    if (++frames.current === 16) {
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
  // câmera livre para as capturas das áreas: ?pos=x,y,z&target=x,y,z[&player=x,y,z][&fov=n]
  const n = (k: string, len: number) => { const v = (params.get(k) ?? "").split(",").map(Number); return v.length === len && v.every(Number.isFinite) ? v as [number, number, number] : null; };
  const fp = n("pos", 3), ft = n("target", 3);
  const cam = fp && ft ? { pos: fp, target: ft, player: n("player", 3) ?? [fp[0], -1.6, fp[2]] as [number, number, number], fov: Number(params.get("fov")) || undefined } : CAMS[key] ?? CAMS.avenida;
  const view = useRef<SceneView>((() => { const v = emptyView(); v.playerRoom = "rua"; v.doors = { ...v.doors, front: params.get("door") === "1", dockGate: false, carpetGate: false } as SceneView["doors"]; return v; })());
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
