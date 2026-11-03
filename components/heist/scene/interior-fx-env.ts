/*
 * MET Gala Heist v2 — clima de reflexo de cada sala do interior (interior-fx.ts): cópias dos materiais com o ambiente
 * sintético do clima (ou a sonda da própria sala) e a foto cúbica de cada sala que vira o reflexo dela.
 */
import * as THREE from "three";
import type { RoomId } from "@/lib/heist/types";
import { ENV_INTENSITY, PROBE_SIZE, envFor, type EnvMood } from "./interior-mats";
import { INTERIOR, type InteriorRoom } from "./interior-shell";
import type { LightAnchor } from "./interior-props";
import type { LightPool } from "./interior-fx-lights";

/* ---------- clima de cada sala ---------- */
export const MOOD: Record<InteriorRoom, EnvMood> = {
  vestibulo: "warm", salao: "warm", lounge: "warm", terraco: "warm", galeria: "gallery", bastidores: "backstage",
  servico: "cool", seguranca: "cool", doca: "cool", cofre: "vault",
};


const envClones = new WeakMap<THREE.WebGLRenderer, Map<string, THREE.Material>>();
/**
 * Cópia do material com o ambiente da sala: primeiro o sintético do clima (âmbar, galeria, fluorescente), depois — no
 * "high" — a sonda tirada da própria sala (`probe`). O piso espelhado é único por sala e recebe o ambiente direto.
 */
export function roomMaterial(m: THREE.Material, room: InteriorRoom, gl: THREE.WebGLRenderer, probe?: THREE.Texture): THREE.Material {
  const std = m as THREE.MeshStandardMaterial;
  if (!std.isMeshStandardMaterial) return m;                                  // básicos (telas, chamas) e shaders ficam como estão
  const mood = MOOD[room];
  if (m.userData.mirror) { if (probe) { std.envMap = probe; std.envMapIntensity = (m.userData.envBase as number) * PROBE_INTENSITY[mood]; } return m; }
  let per = envClones.get(gl); if (!per) { per = new Map(); envClones.set(gl, per); }
  const key = probe ? `${m.uuid}|${room}|${probe.uuid}` : `${m.uuid}|${mood}`;
  let c = per.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!c) {
    const base = (m.userData.envBase as number | undefined) ?? std.envMapIntensity;
    c = std.clone(); c.name = `${m.name.split("@")[0]}@${probe ? room : mood}`; c.userData = { ...m.userData, envBase: base };
    c.envMap = probe ?? envFor(gl, mood); c.envMapIntensity = base * (probe ? PROBE_INTENSITY[mood] : ENV_INTENSITY[mood]);
    per.set(key, c);
  }
  return c;
}
/** Troca os materiais das malhas de uma sala pelas cópias com o ambiente dela. */
export function applyRoomEnv(root: THREE.Object3D, room: InteriorRoom, gl: THREE.WebGLRenderer, probe?: THREE.Texture) {
  root.traverse((o) => {
    const me = o as THREE.Mesh; if (!me.isMesh) return;
    me.material = Array.isArray(me.material) ? me.material.map((x) => roomMaterial(x, room, gl, probe)) : roomMaterial(me.material, room, gl, probe);
  });
}
/** Peso da sonda (luz real da sala, mais escura que os painéis sintéticos). */
const PROBE_INTENSITY: Record<EnvMood, number> = { warm: 0.75, gallery: 0.7, backstage: 0.95, cool: 0.9, vault: 1.6 };

/* ---------- sondas de reflexo por sala ---------- */
/** Onde cada sala se fotografa para o próprio reflexo (altura de olho, no meio do espaço livre). */
export const PROBE_AT: Record<InteriorRoom, [number, number, number]> = {
  vestibulo: [0, 1.8, 19.4], salao: [0, 2.2, 9.2], galeria: [0, 1.8, -12.6], lounge: [17, 1.7, 9.6], terraco: [17.2, 1.8, -14],
  bastidores: [17, 1.7, -1.2], servico: [-17.25, 1.6, 4.75], seguranca: [-20.2, 1.6, 4.8], doca: [-15, 2, 20.2], cofre: [-15.6, 1.8, -12],
};
/**
 * Uma foto cúbica de cada sala, acesa pelas âncoras dela, vira (filtrada por PMREM) o reflexo e a luz difusa de fundo
 * dos materiais daquela sala: o latão do lounge reflete o bar e as arandelas, o vidro das vitrines reflete a galeria, o
 * espelho do camarim mostra o camarim (MH-03-08). Tirada uma vez, depois que a cena acende; de quebra compila todos os
 * materiais de uma vez (sem engasgo ao entrar numa sala nova). Só o interior aparece na foto (gente e rua escondidas).
 */
export function captureProbes(gl: THREE.WebGLRenderer, scene: THREE.Scene, root: THREE.Object3D, rooms: Map<InteriorRoom, THREE.Group>, pool: LightPool, anchors: readonly LightAnchor[], keep: readonly THREE.Object3D[]): Map<InteriorRoom, THREE.Texture> {
  const out = new Map<InteriorRoom, THREE.Texture>();
  const rt = new THREE.WebGLCubeRenderTarget(PROBE_SIZE, { type: THREE.HalfFloatType });
  const cube = new THREE.CubeCamera(0.05, 80, rt);
  const pm = new THREE.PMREMGenerator(gl);
  const hidden: THREE.Object3D[] = [];
  for (const ch of scene.children) if (ch !== root && !keep.includes(ch) && ch.visible) { ch.visible = false; hidden.push(ch); }
  const vis = new Map<THREE.Object3D, boolean>(); for (const g of rooms.values()) vis.set(g, g.visible);
  const only = new Set<RoomId>(), focus = new THREE.Vector3();
  for (const room of INTERIOR) {
    for (const [r, g] of rooms) g.visible = r === room;
    only.clear(); only.add(room); focus.set(...PROBE_AT[room]);
    pool.update(anchors, only, only, focus, 0, (a) => (a.alarm ? 0 : 1), true);
    cube.position.copy(focus); cube.update(gl, scene);
    out.set(room, pm.fromCubemap(rt.texture).texture);
  }
  for (const [g, v] of vis) g.visible = v;
  for (const o of hidden) o.visible = true;
  pm.dispose(); rt.dispose();
  return out;
}
