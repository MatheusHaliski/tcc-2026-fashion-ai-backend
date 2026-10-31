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
import { emptyView, type ActorView, type SceneView } from "@/lib/heist/view";
import { PLAYER_ARRIVAL, WAITER_UNIFORM } from "@/lib/heist/outfits";
import { MOTIONS, MOTION_DURATION } from "@/lib/avatar3d/human/locomotion";
import type { Anim, Hold, LookId } from "@/lib/heist/types";

export type Preset = "multidao" | "close" | "anims" | "troca" | "caida" | "tiro" | "agachada" | "jogadora" | "pessoa" | "pista" | "dj" | "comer" | "salao60";
const CAMS: Record<Preset, { pos: [number, number, number]; target: [number, number, number]; fov: number }> = {
  multidao: { pos: [0.55, 1.78, 6.9], target: [0, 1.25, 0], fov: 50 },
  close: { pos: [0.1, 1.62, 2.15], target: [0, 1.5, 0], fov: 38 },
  anims: { pos: [0, 7.5, 13.5], target: [0, 0.8, 1.5], fov: 50 },
  troca: { pos: [1.1, 1.3, 3.1], target: [0, 0.95, 0], fov: 42 },
  caida: { pos: [0.4, 2.9, 4.4], target: [0, 0.25, 0], fov: 46 },
  tiro: { pos: [3.6, 1.7, 2.6], target: [0, 1.1, -1.4], fov: 46 },
  agachada: { pos: [0.45, 1.35, 3.4], target: [0, 1.0, -3], fov: 52 },
  jogadora: { pos: [0.75, 1.45, 2.5], target: [0, 1.0, 0], fov: 42 },
  pessoa: { pos: [0.65, 1.25, 3.2], target: [0, 0.92, 0], fov: 42 },
  pista: { pos: [3.4, 2.5, 6.4], target: [0, 0.95, -0.6], fov: 50 },
  dj: { pos: [0.85, 1.55, 2.05], target: [0, 1.15, -0.1], fov: 44 },
  comer: { pos: [2.3, 1.7, 3.0], target: [-0.1, 1.0, -0.7], fov: 48 },
  salao60: { pos: [9.5, 6.2, 11], target: [0, 0.8, -0.5], fov: 52 },
};
/** Onde fica o DJ (a cabine de apoio fica à frente dele, como a do Grande Salão: DJ_DESK) e a mesa de doces (centro). */
const BOOTH = { pista: { x: 0, z: -4.1 }, dj: { x: 0, z: 0 }, salao60: { x: 0, z: -6.7 } } as const;
const SWEETS = { comer: { x: 0, z: -1.3 }, salao60: { x: 6.2, z: 1.5 } } as const;
/** Pares que se olham e quem dança sozinho de frente para o DJ, em volta do ponto (cx, cz). */
function dancers(prefix: string, cx: number, cz: number, n: number, seed0: number): Spec[] {
  const out: Spec[] = [];
  for (let i = 0; i < n; i++) {
    const col = i % 4, row = Math.floor(i / 4), x = cx + (col - 1.5) * 1.35 + (row % 2) * 0.4, z = cz + row * 1.25;
    const pair = i % 3 !== 2, seed = seed0 + i * 17;
    if (pair) { out.push({ id: `${prefix}${i}a`, look: "guestF", seed, x: x - 0.42, z, yaw: Math.PI / 2, anim: "dance" }, { id: `${prefix}${i}b`, look: "guestM", seed: seed + 5, x: x + 0.42, z, yaw: -Math.PI / 2, anim: "dance" }); }
    else out.push({ id: `${prefix}${i}s`, look: i % 2 ? "guestM" : "guestF", seed, x, z, yaw: Math.PI + 0.2 * Math.sin(i), anim: "dance" });
  }
  return out;
}
/** Quem come em volta da mesa de doces (de frente para ela) e o chef atrás dela. */
function eaters(prefix: string, cx: number, cz: number, n: number, seed0: number): Spec[] {
  const out: Spec[] = [{ id: `${prefix}chef`, look: "chef", seed: seed0, x: cx + 0.4, z: cz - 0.75, yaw: 0, anim: "interact" }];
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n - 1) - 0.5) * 1.9, x = cx + Math.sin(a) * 1.55, z = cz + Math.cos(a) * 1.1 + 0.15;
    out.push({ id: `${prefix}${i}`, look: i % 2 ? "guestM" : "guestF", seed: seed0 + 7 * i + 3, x, z, yaw: Math.atan2(cx - x, cz - z) + (i % 3 - 1) * 0.5, anim: "eat", hold: "plate" });
  }
  return out;
}

interface Spec {
  id: string; look: LookId; seed: number; x: number; z: number; yaw: number; anim: Anim; hold?: Hold;
  /** caminho: posição, giro e velocidade no instante t */
  path?: (t: number) => { x: number; z: number; yaw: number; speed: number; anim?: Anim };
  /** gesto com começo e fim: repete a cada `loop` s */
  loop?: number; lookAtPlayer?: boolean; lookAtCam?: boolean; hitEvery?: number; tired?: number;
}
interface PlayerSpec { x: number; z: number; yaw: number; anim: Anim; hold?: Hold; loop?: number; path?: Spec["path"]; hitEvery?: number; tired?: number }

const circle = (cx: number, cz: number, r: number, w: number, ph = 0) => (t: number) => {
  const a = ph + w * t; return { x: cx + r * Math.cos(a), z: cz + r * Math.sin(a), yaw: Math.atan2(-r * Math.sin(a) * w, r * Math.cos(a) * w), speed: Math.abs(r * w) };
};
/** Roda de conversa: k pessoas olhando para o centro. */
function ring(prefix: string, cx: number, cz: number, k: number, seed0: number, anims: Anim[]): Spec[] {
  return Array.from({ length: k }, (_, i) => {
    const a = (i / k) * Math.PI * 2 + seed0, x = cx + Math.sin(a) * 0.62, z = cz + Math.cos(a) * 0.62;
    const anim = anims[i % anims.length];
    return { id: `${prefix}${i}`, look: (i + seed0) % 2 ? "guestM" : "guestF", seed: seed0 * 31 + i * 7, x, z, yaw: a + Math.PI, anim, hold: anim === "drink" ? "glass" : anim === "phone" ? "phone" : null };
  });
}

function scenario(p: Preset, who: { look: LookId; seed: number; anim: Anim }): { actors: Spec[]; player: PlayerSpec } {
  switch (p) {
    case "multidao": return {
      player: { x: 0.25, z: 4.6, yaw: Math.PI, anim: "idle" },
      actors: [
        ...ring("a", -1.6, 1.5, 3, 1, ["talk", "drink", "talk"]), ...ring("b", 1.5, 0.9, 4, 2, ["drink", "talk", "talk", "idle"]),
        ...ring("c", -0.4, -1.4, 3, 3, ["talk", "phone", "drink"]), ...ring("d", 2.6, -2.2, 2, 4, ["talk", "drink"]), ...ring("e", -3.2, -1.2, 3, 5, ["drink", "talk", "talk"]),
        { id: "w1", look: "waiter", seed: 11, x: 0, z: 0, yaw: 0, anim: "serve", hold: "tray", path: circle(0.2, 0.2, 2.9, 0.33) },
        { id: "w2", look: "waitress", seed: 12, x: 0, z: 0, yaw: 0, anim: "serve", hold: "tray", path: circle(-0.8, -0.3, 1.9, -0.45, 2) },
        { id: "p1", look: "guestF", seed: 77, x: 0, z: 0, yaw: 0, anim: "talk", path: circle(0.3, 0.6, 3.6, 0.22, 4) },
        { id: "p2", look: "guestM", seed: 78, x: 0, z: 0, yaw: 0, anim: "talk", path: circle(0.3, 0.6, 3.15, 0.22, 4.12) },
        { id: "g1", look: "guard", seed: 5, x: -3.6, z: 1.8, yaw: Math.PI / 2.4, anim: "guard" },
        { id: "g2", look: "guard", seed: 6, x: 3.8, z: 0.4, yaw: -Math.PI / 2, anim: "guard", lookAtPlayer: true },
        { id: "bt", look: "bartender", seed: 9, x: 0.3, z: -4.2, yaw: 0, anim: "serve" },
      ],
    };
    case "close": return {
      player: { x: 0, z: 9, yaw: 0, anim: "idle" },
      actors: [
        { id: "c1", look: "guestF", seed: 2, x: -0.55, z: 0, yaw: 0.35, anim: "talk", lookAtCam: true },
        { id: "c2", look: "guestM", seed: 3, x: 0.6, z: -0.2, yaw: -0.4, anim: "drink", hold: "glass" },
        { id: "c3", look: "guestF", seed: 9, x: 0.05, z: -0.8, yaw: 0, anim: "look", lookAtCam: true },
      ],
    };
    case "anims": {
      const looks: LookId[] = ["guestF", "guestM", "guard", "waiter", "fan", "paparazzo", "guestF", "crew"];
      const holdOf = (m: Anim): Hold => (m === "photo" ? "camera" : m === "serve" ? "tray" : m === "drink" ? "glass" : m === "phone" ? "phone" : m === "aim" || m === "shoot" || m === "reload" ? "pistol" : m === "stab" ? "knife" : m === "play" ? "violin" : m === "celebrate" ? "diamond" : null);
      return {
        player: { x: 0, z: 9, yaw: 0, anim: "idle" },
        actors: MOTIONS.map((m, i) => {
          const col = i % 8, row = Math.floor(i / 8);
          const moving = m === "walk" || m === "run" || m === "sneak" || m === "discreet" || m === "tired" || m === "flee" || m === "crawl";
          return { id: `m-${m}`, look: looks[i % looks.length], seed: 100 + i * 13, x: (col - 3.5) * 1.6, z: (row - 2) * 1.9, yaw: 0, anim: m, hold: holdOf(m),
            loop: MOTION_DURATION[m] ? MOTION_DURATION[m]! + 1.2 : undefined, tired: m === "tired" ? 1 : 0,
            path: moving ? (t: number) => ({ x: (col - 3.5) * 1.6, z: (row - 2) * 1.9, yaw: 0, speed: m === "run" || m === "flee" ? 4 : m === "crawl" ? 0.6 : 1.2 }) : undefined } as Spec;
        }),
      };
    }
    case "troca": return { player: { x: 0, z: 0, yaw: 0.25, anim: "change", loop: 3.6 }, actors: [] };
    case "jogadora": return { player: { x: 0, z: 0, yaw: 0.3, anim: "idle" }, actors: [] };
    case "pessoa": return { player: { x: 0, z: 9, yaw: 0, anim: "idle" }, actors: [{ id: "x1", look: who.look, seed: who.seed, x: 0, z: 0, yaw: 0.3, anim: who.anim, hold: who.anim === "eat" ? "plate" : who.anim === "dj" ? "headphones" : who.anim === "serve" ? "tray" : undefined }] };
    case "pista": return {
      player: { x: 2.6, z: 4.2, yaw: Math.PI + 0.4, anim: "idle" },
      actors: [{ id: "dj", look: "dj", seed: 3, x: BOOTH.pista.x, z: BOOTH.pista.z, yaw: 0, anim: "dj", hold: "headphones" }, ...dancers("d", 0, -1.6, 8, 11),
        { id: "w1", look: "waiter", seed: 11, x: 0, z: 0, yaw: 0, anim: "serve", hold: "tray", path: circle(0.3, 0.2, 3.6, 0.22) }],
    };
    case "dj": return { player: { x: 0, z: 9, yaw: 0, anim: "idle" }, actors: [{ id: "dj", look: "dj", seed: who.seed, x: 0, z: 0, yaw: 0, anim: "dj", hold: "headphones" }] };
    case "comer": return {
      player: { x: 2.4, z: 3.5, yaw: Math.PI, anim: "idle" },
      actors: [...eaters("e", SWEETS.comer.x, SWEETS.comer.z, 5, 21),
        { id: "w1", look: "waiter", seed: 12, x: -1.7, z: 0.9, yaw: 0.9, anim: "serve", hold: "tray" },
        { id: "w2", look: "waitress", seed: 13, x: 0, z: 0, yaw: 0, anim: "serve", hold: "tray", path: circle(0, 0.2, 2.6, -0.25, 1.5) }],
    };
    case "salao60": {
      const actors: Spec[] = [{ id: "dj", look: "dj", seed: 4, x: BOOTH.salao60.x, z: BOOTH.salao60.z, yaw: 0, anim: "dj", hold: "headphones" },
        ...dancers("d", -0.4, -4.6, 12, 31), ...eaters("e", SWEETS.salao60.x, SWEETS.salao60.z, 6, 41)];
      for (let i = 0; i < 6; i++) actors.push(...ring(`r${i}`, -6.5 + (i % 3) * 3.4, 1.4 + Math.floor(i / 3) * 3.2, 3 + (i % 2), 7 + i, ["talk", "drink", "talk", "phone"]));
      for (let i = 0; i < 6; i++) actors.push({ id: `w${i}`, look: i % 2 ? "waitress" : "waiter", seed: 60 + i, x: 0, z: 0, yaw: 0, anim: "serve", hold: "tray", path: circle(-1 + (i % 3) * 2, 1 + Math.floor(i / 3) * 2, 2.2 + i * 0.35, (i % 2 ? 1 : -1) * 0.3, i) });
      for (const [i, [x, z, yaw]] of ([[-9, -3, 1.2], [9, -3, -1.2], [-9, 5, 1.6], [9, 5, -1.6]] as const).entries()) actors.push({ id: `g${i}`, look: "guard", seed: 70 + i, x, z, yaw, anim: "guard" });
      return { player: { x: 2, z: 7, yaw: Math.PI, anim: "idle" }, actors };
    }
    case "caida": return {
      player: { x: 0, z: 0.2, yaw: 0.4, anim: "downed", loop: 5 },
      actors: [
        { id: "k1", look: "guard", seed: 31, x: -1.8, z: -1.2, yaw: 1.2, anim: "dead", loop: 5 },
        { id: "k2", look: "guardHeavy", seed: 32, x: 1.9, z: -1.4, yaw: -0.8, anim: "knockedOut", loop: 5 },
      ],
    };
    case "tiro": return {
      player: { x: 0.2, z: 1.2, yaw: Math.PI * 0.95, anim: "aim", hold: "pistol", hitEvery: 1.3, tired: 0.7 },
      actors: [{ id: "s1", look: "guard", seed: 41, x: -0.3, z: -3.6, yaw: 0.05, anim: "aim", hold: "pistol", lookAtPlayer: true }],
    };
    case "agachada": return {
      player: { x: 0, z: 1.4, yaw: Math.PI, anim: "sneak", path: (t) => ({ x: 0.05 * Math.sin(t), z: 1.4 - ((t * 0.55) % 3.2), yaw: Math.PI, speed: 0.55 }) },
      actors: [{ id: "s2", look: "guard", seed: 44, x: 0, z: -5.4, yaw: 0, anim: "guard" }],
    };
  }
}

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
