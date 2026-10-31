"use client";
/*
 * MET Gala Heist v2 — câmera em terceira pessoa sobre o ombro: segue a jogadora, gira com o mouse/analógico, aproxima na
 * mira, não atravessa parede, porta fechada nem móvel alto (encurta a haste) e não passa do teto. Na cena do diamante faz
 * o close e depois vira para a porta por onde os seguranças entram; no game over e na vitória gira devagar em volta dela.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { SimState } from "@/lib/heist/types";
import type { SceneView } from "@/lib/heist/view";
import { CELL, GW, X0, Z0, cellOf, inGrid, insideProp, roomAt, type World } from "@/lib/heist/world";
import { DIAMOND_POS, VAULT_ENTRY, floorY } from "@/lib/heist/level";
import { OUTDOOR } from "@/lib/heist/state";
import type { HeistControls } from "./input";
import type { HeistSettings } from "./settings";

const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

/** Pé-direito por sala (a câmera não sobe além do teto). */
const CEILING: Partial<Record<string, number>> = { salao: 8.6, servico: 3.1, seguranca: 3.1, doca: 5.2 };
const ceilingAt = (room: string) => (OUTDOOR.has(room as never) ? 60 : CEILING[room] ?? 4.7);

/** Até onde a haste da câmera vai de `from` na direção (dx, dz) sem entrar em parede, porta fechada ou móvel alto. */
function boom(world: World, s: SimState, from: THREE.Vector3, dir: THREE.Vector3, max: number): number {
  const h = Math.hypot(dir.x, dir.z);
  if (h < 1e-4) return max;
  for (let t = 0.2; t <= max; t += 0.1) {
    const x = from.x + dir.x * t, z = from.z + dir.z * t;
    const [i, j] = cellOf(x, z);
    if (!inGrid(i, j)) return Math.max(0.3, t - 0.25);
    const c = world.grid[j * GW + i];
    if (c === 0) return Math.max(0.3, t - 0.3);
    if (c === 2) { const d = world.doors[world.doorAt[j * GW + i]]; if (!s.doors[d.id] && d.id !== "carpetGate") return Math.max(0.3, t - 0.3); }
    const y = from.y + dir.y * t;
    const p = insideProp(world, { x, z }, 0.12);
    if (p && (p.height === "tall" || p.height === "glass") && y - floorY({ x, z }) < 2.6) return Math.max(0.3, t - 0.25);
  }
  return max;
}
void CELL; void X0; void Z0;

/** Enquadramento fixo do laboratório (?shot=): a câmera fica parada nele, o jogo continua rodando (pessoas, luzes). */
export interface LabShot { pos: [number, number, number]; target: [number, number, number]; fov?: number }
export function HeistCamera({ view, sim, world, controls, reducedMotion, settings, shot = null }: { view: React.MutableRefObject<SceneView>; sim: React.MutableRefObject<{ s: SimState }>; world: World; controls: HeistControls; reducedMotion: boolean; settings: HeistSettings; shot?: LabShot | null }) {
  const { camera } = useThree();
  const cur = useRef({ pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 62, init: false, shake: 0, lastHit: -1, inBeat: false });
  const tmp = useRef({ pivot: new THREE.Vector3(), dir: new THREE.Vector3(), want: new THREE.Vector3(), look: new THREE.Vector3(), right: new THREE.Vector3() });
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt), s = sim.current.s, p = s.player, v = view.current, c = cur.current, T = tmp.current;
    const cam = camera as THREE.PerspectiveCamera;
    if (shot) {
      cam.position.set(...shot.pos); cam.lookAt(...shot.target);
      if (cam.fov !== (shot.fov ?? 50)) { cam.fov = shot.fov ?? 50; cam.updateProjectionMatrix(); }
      return;
    }
    const crouchH = p.mode === "CRAWL" ? 0.55 : p.crouch ? 1.05 : 1.55;
    T.pivot.set(p.pos.x, p.y + crouchH, p.pos.z);
    let fov = settings.fov, smooth = 10;
    const beat = s.beat;
    if (beat) {
      // cena curta do subobjetivo: segue os enquadramentos (de/para, com suavização), sem a jogadora no controle
      let t = s.time - beat.at, shot = beat.shots[0];
      for (const sh of beat.shots) { shot = sh; if (t <= sh.dur) break; t -= sh.dur; }
      const u = ease(Math.min(1, Math.max(0, t / shot.dur)));
      T.want.set(shot.from[0] + (shot.to[0] - shot.from[0]) * u, shot.from[1] + (shot.to[1] - shot.from[1]) * u, shot.from[2] + (shot.to[2] - shot.from[2]) * u);
      const lt = shot.lookTo ?? shot.look;
      T.look.set(shot.look[0] + (lt[0] - shot.look[0]) * u, shot.look[1] + (lt[1] - shot.look[1]) * u, shot.look[2] + (lt[2] - shot.look[2]) * u);
      fov = shot.fov ?? 50; smooth = 30;
    } else if (s.phase === "CUTSCENE" && s.cutscene) {
      const t = s.cutscene.t;
      if (t < 4.4) {
        // close: de frente para ela e o diamante, girando devagar
        const a = p.yaw + Math.PI + 0.5 - t * 0.12;
        T.want.set(p.pos.x + Math.sin(a) * 1.5, p.y + 1.6, p.pos.z + Math.cos(a) * 1.5);
        T.look.set(p.pos.x, p.y + 1.35, p.pos.z);
        fov = 42; smooth = 3;
      } else {
        // a porta abre: por cima do ombro dela, olhando os seguranças entrando
        const toDoor = new THREE.Vector3(VAULT_ENTRY.x - p.pos.x, 0, VAULT_ENTRY.z - p.pos.z).normalize();
        T.want.set(p.pos.x - toDoor.x * 1.8 + toDoor.z * 0.5, p.y + 1.9, p.pos.z - toDoor.z * 1.8 - toDoor.x * 0.5);
        T.look.set(VAULT_ENTRY.x, 1.3, VAULT_ENTRY.z);
        fov = 50; smooth = 4;
      }
    } else if (s.phase === "LOST" || s.phase === "WON") {
      const t = s.time - s.phaseAt, a = (reducedMotion ? 0.6 : 0.6 + t * 0.18);
      const r = s.phase === "LOST" ? 2.4 : 3.2, h = s.phase === "LOST" ? 2.3 : 1.8;
      T.want.set(p.pos.x + Math.sin(a) * r, p.y + h, p.pos.z + Math.cos(a) * r);
      T.look.set(p.pos.x, p.y + (s.phase === "LOST" ? 0.25 : 1.2), p.pos.z);
      fov = 50; smooth = 2.5;
    } else {
      const aiming = p.aiming;
      const yaw = controls.yaw, pitch = controls.pitch;
      const dist = (aiming ? 1.55 : p.crouch ? 2.6 : 3.3) * settings.camDistance, side = (aiming ? 0.55 : 0.38) * (settings.shoulder === "left" ? -1 : 1);
      // direção para trás da câmera (oposta ao olhar) e o ombro direito
      T.dir.set(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      T.right.set(-Math.cos(yaw), 0, Math.sin(yaw));
      const sideDir = T.right.clone().multiplyScalar(Math.sign(side) || 1), sideLen = Math.abs(side);
      const shoulder = T.pivot.clone().addScaledVector(sideDir, sideLen * Math.min(1, boom(world, s, T.pivot, sideDir, sideLen + 0.2) / (sideLen + 0.2)));
      const len = boom(world, s, shoulder, T.dir, dist);
      T.want.copy(shoulder).addScaledVector(T.dir, len);
      const room = roomAt({ x: T.want.x, z: T.want.z });
      T.want.y = Math.min(T.want.y, floorY({ x: T.want.x, z: T.want.z }) + ceilingAt(room) - 0.25);
      T.want.y = Math.max(T.want.y, floorY({ x: T.want.x, z: T.want.z }) + 0.3);
      T.look.copy(shoulder).addScaledVector(T.dir, -10);
      fov = aiming ? settings.fov - 16 : p.speed > 3 ? settings.fov + 6 : settings.fov; smooth = aiming ? 18 : 12;
    }
    // corte seco no começo de cada enquadramento da cena curta
    const cut = beat ? beat.shots.reduce<number[]>((acc, sh) => [...acc, (acc[acc.length - 1] ?? 0) + sh.dur], [0]).some((at) => Math.abs(s.time - beat.at - at) < dt * 0.75) : false;
    if (!c.init || cut) { c.pos.copy(T.want); c.look.copy(T.look); c.init = true; }
    // ao sair da cena curta a câmera volta para trás dela pelo caminho mais curto
    if (c.inBeat && !beat) { controls.yaw = p.yaw; controls.pitch = -0.12; }
    c.inBeat = !!beat;
    const k = 1 - Math.exp(-smooth * dt);
    c.pos.lerp(T.want, k); c.look.lerp(T.look, Math.min(1, k * 1.4));
    // tremida curta ao levar tiro (desligada com "reduzir movimento")
    if (!reducedMotion && settings.shake && p.lastHitAt !== c.lastHit) { c.lastHit = p.lastHitAt; if (p.lastHitAt > 0) c.shake = 0.12; }
    c.shake = Math.max(0, c.shake - dt * 0.6);
    camera.position.copy(c.pos);
    if (c.shake > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * c.shake, (Math.random() - 0.5) * c.shake, 0));
    camera.lookAt(c.look);
    c.fov += (fov - c.fov) * Math.min(1, dt * 6);
    if (Math.abs(cam.fov - c.fov) > 0.01) { cam.fov = c.fov; cam.updateProjectionMatrix(); }
    void v; void DIAMOND_POS;
  });
  return null;
}
