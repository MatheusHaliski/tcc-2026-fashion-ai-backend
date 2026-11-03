"use client";
/*
 * Laboratório das pessoas do MET Gala Heist v2 (só desenvolvimento): uma sala escura de gala (piso de madeira polida,
 * parede azul-petróleo, luz quente de arandelas) e um SceneView de exemplo animado aqui mesmo, sem simulação, para ver
 * a multidão, os gestos, a troca de roupa, a queda, o tiro, a jogadora de vestido de perto, uma pessoa de cada aparência
 * (`pessoa`, com `look` e `seed`), a pista com o DJ (`pista`, `dj`), a mesa de doces (`comer`) e o salão cheio com 64
 * pessoas (`salao60`, desempenho: chamadas de desenho em window.__heistGenteInfo). A cabine do DJ e a mesa de doces daqui
 * são só apoio (o Grande Salão desenha as de verdade). `?cam=` escolhe a cena; `?q=low` testa a qualidade baixa.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { HeistPeople } from "@/components/heist/people/people";
import { emptyView, type SceneView } from "@/lib/heist/view";
import { PLAYER_ARRIVAL, WAITER_UNIFORM } from "@/lib/heist/outfits";
import type { Anim, LookId } from "@/lib/heist/types";
import { BOOTH, CAMS, SWEETS, scenario, type Preset } from "./heist-gente-scenarios";

export type { Preset } from "./heist-gente-scenarios";

/** Anima o SceneView de exemplo: posições, gestos com começo e fim em laço, tiro levado, olhar. */
function Animator({ view, preset, at, who, onSwap }: { view: React.MutableRefObject<SceneView>; preset: Preset; at?: number; who: { look: LookId; seed: number; anim: Anim }; onSwap: (uniform: boolean) => void }) {
  const sc = useMemo(() => scenario(preset, who), [preset, who]);
  const { camera } = useThree();
  const t0 = useRef(-1), swapped = useRef(false), lastShot = useRef(-9);
  useEffect(() => {
    const v = view.current;
    v.actors = sc.actors.map((s) => ({ ...emptyView().player, id: s.id, kind: s.look === "guard" || s.look === "guardHeavy" ? "guard" : "civ", look: s.look, seed: s.seed, x: s.x, z: s.z, yaw: s.yaw, anim: s.anim, hold: s.hold ?? null, room: "salao" }));
  }, [sc, view]);
  useFrame(({ clock }) => {
    if (t0.current < 0) t0.current = clock.elapsedTime;
    const t = at ?? clock.elapsedTime - t0.current, v = view.current;
    v.time = t;
    const pl = v.player, ps = sc.player;
    const loopT = (loop?: number) => (loop ? t % loop : t);
    // jogadora
    const pp = ps.path?.(t);
    pl.x = pp?.x ?? ps.x; pl.z = pp?.z ?? ps.z; pl.yaw = pp?.yaw ?? ps.yaw; pl.speed = pp?.speed ?? 0; pl.y = 0;
    pl.anim = ps.anim; pl.animT = loopT(ps.loop); pl.hold = ps.hold ?? null; pl.tired = ps.tired ?? 0; pl.visible = true;
    if (ps.hitEvery) { const k = Math.floor(t / ps.hitEvery); pl.hitAt = k * ps.hitEvery; }
    if (preset === "troca") {
      // as peças trocam a 45 % da animação (o corpo encolhido); a cada volta, vestido ↔ uniforme
      const cycle = Math.floor(t / (ps.loop ?? 3.6)), swapNow = pl.animT >= 2.6 * 0.45;
      const uniform = (cycle % 2 === 0) === swapNow;
      if (uniform !== swapped.current) { swapped.current = uniform; onSwap(uniform); }
      if (pl.animT > 2.7) pl.anim = "idle";
    }
    // figurantes
    sc.actors.forEach((s, i) => {
      const a = v.actors[i]; if (!a) return;
      const p = s.path?.(t);
      a.x = p?.x ?? s.x; a.z = p?.z ?? s.z; a.yaw = p?.yaw ?? s.yaw; a.speed = p?.speed ?? 0; a.y = 0;
      a.anim = p?.anim ?? s.anim; a.animT = loopT(s.loop); a.tired = s.tired ?? 0; a.visible = true;
      a.lookAt = s.lookAtPlayer ? { x: pl.x, y: 1.55, z: pl.z } : s.lookAtCam ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : null;
      if (preset === "tiro" && s.id === "s1") {
        const k = t % 1.3; a.anim = k < 0.25 ? "shoot" : "aim"; a.animT = k < 0.25 ? k : k - 0.25;
        a.aimPitch = Math.atan2(1.2 - 1.4, Math.hypot(pl.x - a.x, pl.z - a.z));
        if (k < 0.02 && t - lastShot.current > 1) lastShot.current = t;
      }
      a.hold = s.hold ?? null;
    });
  });
  return null;
}

function Room() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl); const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env; scene.environmentIntensity = 0.32; scene.background = new THREE.Color("#07090b");
    return () => { scene.environment = null; env.dispose(); pm.dispose(); };
  }, [gl, scene]);
  return <group>
    {/* piso de madeira escura polida e parede azul-petróleo com faixa dourada */}
    <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#2a1a11" roughness={0.26} metalness={0.05} /></mesh>
    <mesh position={[0, 4, -6.5]} receiveShadow><planeGeometry args={[40, 8]} /><meshStandardMaterial color="#0f2a31" roughness={0.85} /></mesh>
    <mesh position={[0, 3.2, -6.45]}><planeGeometry args={[40, 0.08]} /><meshStandardMaterial color="#b8924a" metalness={0.9} roughness={0.3} emissive="#3a2a10" /></mesh>
    <hemisphereLight args={["#5d6f80", "#1a120c", 0.35]} />
    <spotLight position={[2.5, 6.5, 4]} angle={0.62} penumbra={0.7} intensity={140} color="#ffd9a8" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
    {[[-4, 2.6, -6], [0, 2.6, -6], [4, 2.6, -6]].map(([x, y, z], i) => <group key={i} position={[x, y, z]}>
      <pointLight color="#ffb46a" intensity={14} distance={9} decay={2} position={[0, 0, 0.4]} />
      <mesh><sphereGeometry args={[0.07, 12, 8]} /><meshBasicMaterial color="#fff0c8" /></mesh>
    </group>)}
    <pointLight position={[-3, 2.4, 3.5]} color="#7fa6c9" intensity={10} distance={10} />
  </group>;
}

/** Chamadas de desenho e triângulos do quadro anterior (desempenho do salão cheio), em window.__heistGenteInfo. */
function Stats() {
  const { gl } = useThree(); const last = useRef(0);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 1) return; last.current = clock.elapsedTime;
    (window as unknown as { __heistGenteInfo?: unknown }).__heistGenteInfo = { calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, programs: gl.info.programs?.length ?? 0 };
  });
  return null;
}
/** Apoio do laboratório: cabine do DJ como a do Grande Salão (tampo a 1,05 m, players a ±0,62 m e mixer no meio, 0,55 m à
 * frente dos pés do DJ) e mesa de doces (0,76 m) com bolos. */
function LabProps({ preset }: { preset: Preset }) {
  const booth = (BOOTH as Partial<Record<Preset, { x: number; z: number }>>)[preset], sweets = (SWEETS as Partial<Record<Preset, { x: number; z: number }>>)[preset];
  return <group>
    {booth && <group position={[booth.x, 0, booth.z]}>
      <mesh position={[0, 0.525, 0.7]} castShadow receiveShadow><boxGeometry args={[2.4, 1.05, 0.8]} /><meshStandardMaterial color="#141416" roughness={0.3} metalness={0.3} /></mesh>
      <mesh position={[0, 0.5, 1.105]}><boxGeometry args={[2.36, 0.9, 0.02]} /><meshStandardMaterial color="#1c1c22" emissive="#3a1f6a" emissiveIntensity={0.6} roughness={0.3} /></mesh>
      {[-0.62, 0.62].map((x) => <group key={x} position={[x, 1.05, 0.55]}>
        <mesh position={[0, 0.05, 0]} castShadow><boxGeometry args={[0.32, 0.1, 0.41]} /><meshStandardMaterial color="#1d1e21" roughness={0.4} metalness={0.35} /></mesh>
        <mesh position={[0.012, 0.112, -0.04]}><cylinderGeometry args={[0.1, 0.104, 0.014, 32]} /><meshStandardMaterial color="#b9bdc2" roughness={0.32} metalness={0.9} /></mesh>
      </group>)}
      <mesh position={[0, 1.1, 0.55]} castShadow><boxGeometry args={[0.3, 0.095, 0.38]} /><meshStandardMaterial color="#2a2a30" roughness={0.3} metalness={0.6} /></mesh>
    </group>}
    {sweets && <group position={[sweets.x, 0, sweets.z]}>
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow><boxGeometry args={[2.4, 0.76, 0.8]} /><meshStandardMaterial color="#efe9de" roughness={0.85} /></mesh>
      {[-0.8, 0, 0.8].map((x, i) => <group key={x} position={[x, 0.76, -0.05]}>
        <mesh position={[0, 0.09, 0]} castShadow><cylinderGeometry args={[0.16 - i * 0.02, 0.16 - i * 0.02, 0.18, 28]} /><meshStandardMaterial color={["#f4e8f0", "#4a2618", "#f3e6cf"][i]} roughness={0.6} /></mesh>
        <mesh position={[0, 0.005, 0]}><cylinderGeometry args={[0.22, 0.22, 0.01, 28]} /><meshStandardMaterial color="#d8d8dc" roughness={0.2} metalness={0.9} /></mesh>
      </group>)}
    </group>}
  </group>;
}

/** `at`: tempo parado da cena (s), para capturar um instante do gesto; `look`/`seed`/`anim`: quem aparece em `pessoa`. */
export default function HeistGenteScene({ preset, quality, at, look = "guestF", seed = 1, anim = "idle" }: { preset: Preset; quality: "high" | "low"; at?: number; look?: LookId; seed?: number; anim?: Anim }) {
  const who = useMemo(() => ({ look, seed, anim }), [look, seed, anim]);
  const view = useRef<SceneView>(emptyView());
  const [uniform, setUniform] = useState(false);
  const pieces = uniform ? WAITER_UNIFORM : PLAYER_ARRIVAL;
  const cam = CAMS[preset];
  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: cam.pos, fov: cam.fov, near: 0.05, far: 200 }}
    onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
    <Room />
    <LabProps preset={preset} />
    <Stats />
    <Animator view={view} preset={preset} at={at} who={who} onSwap={setUniform} />
    <HeistPeople view={view} playerPieces={pieces} quality={quality} onProgress={(p) => { (window as unknown as { __heistGenteProgress?: number }).__heistGenteProgress = p; }} />
    <OrbitControls target={cam.target} makeDefault />
  </Canvas>;
}
