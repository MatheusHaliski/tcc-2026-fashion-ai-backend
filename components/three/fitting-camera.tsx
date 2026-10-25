"use client";
/*
 * Câmera do provador 3D: vista inicial (Rig), passos dos botões de acessibilidade e a câmera de detalhe — foco que gruda
 * no calçado e percurso pela superfície do corpo (gola, ombro, peito, cintura, quadril, joelho, barra, calçado). As
 * paradas vêm do corpo em repouso (lib/scene3d/detail-camera.ts) e seguem o corpo posado em cena pela pele de um vértice
 * âncora; a câmera desliza até elas em movimento suave (de uma vez com "reduzir movimento").
 */
import { useEffect, useMemo, useRef, type ComponentRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarView } from "@/components/three/avatar-viewer";
import type { HumanParts } from "@/components/three/human-avatar";
import { bodyParam } from "@/lib/avatar3d/human/garments";
import {
  moveStop, surfaceStops, travelPose, wheelDolly, wheelTravel,
  type DetailMode, type DetailState, type DetailStop, type StopKey, type V3,
} from "@/lib/scene3d/detail-camera";
import { approach, orbitGoal, type FittingCameraApi, type OrbitLimitState, type OrbitPose } from "@/lib/scene3d/orbit-steps";

export const VIEW_ANGLE: Record<AvatarView, number> = { front: 0, left34: -35, right34: 35, profile: 90, back: 180 };
export type Controls = ComponentRef<typeof OrbitControls>;

/** Corpo inteiro: a órbita de sempre. Detalhe: a câmera chega a 12 cm da peça e se afasta até 1,2 m. */
export const BODY_MIN_DISTANCE = 1.4;
export const DETAIL_LIMITS = { min: 0.12, max: 1.2 } as const;

export function Rig({ view, target, dist, yaw }: { view: AvatarView; target: V3; dist: number; yaw?: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const angle = (yaw ?? VIEW_ANGLE[view]) * Math.PI / 180;
    camera.position.set(target[0] + Math.sin(angle) * dist, target[1] + .12, target[2] + Math.cos(angle) * dist);
    camera.lookAt(...target); camera.updateProjectionMatrix();
  }, [view, camera, target, dist, yaw]);
  return null;
}

/**
 * Paradas na pose da cena: a pele (esqueleto na pose de exibição) é aplicada no vértice âncora de cada parada, em
 * coordenadas do mundo (inclui a altura da sola e qualquer deslocamento do avatar); alvo e câmera andam junto.
 */
export function posedStops(parts: HumanParts, rest: DetailStop[]): DetailStop[] {
  const mesh = parts.human.body, rv = parts.asset.body.renderVertex, c = parts.composed.body;
  mesh.updateWorldMatrix(true, true);
  const render = new Map<number, number>(rest.map((s) => [s.anchor, -1]));
  for (let r = 0, left = render.size; r < rv.length && left > 0; r++) if (render.get(rv[r]) === -1) { render.set(rv[r], r); left--; }
  const v = new THREE.Vector3();
  return rest.map((s) => {
    const from: V3 = [c[s.anchor * 3], c[s.anchor * 3 + 1], c[s.anchor * 3 + 2]], r = render.get(s.anchor) ?? -1;
    if (r >= 0) mesh.getVertexPosition(r, v); else v.set(...from);
    mesh.localToWorld(v);
    return moveStop(s, from, [v.x, v.y, v.z]);
  });
}

/**
 * O corpo montado chega por aqui (não por estado do React): a câmera lê na hora do foco e avisa os controles quando as
 * paradas ficam prontas. Um objeto estável por cena.
 */
export interface HumanStore { get(): HumanParts | null; set(parts: HumanParts): void; subscribe(listener: () => void): () => void }
export function humanStore(): HumanStore {
  let current: HumanParts | null = null; const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (parts) => { current = parts; listeners.forEach((l) => l()); },
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}

type Glide = { target: THREE.Vector3; eye: THREE.Vector3; min: number; max: number };
type Detail = { mode: DetailMode; t: number; stops: DetailStop[] };
const BODY: Detail = { mode: "corpo", t: 0, stops: [] };

/**
 * Botões de acessibilidade (fora do Canvas, em components/try-on): giram 30° e aproximam pela mesma órbita do arrasto.
 * Câmera de detalhe: o alvo do OrbitControls vai para a parada (arrastar continua girando, agora em volta do tênis ou
 * da gola). Arrastar ou trocar de vista interrompe o movimento; trocar de vista volta ao corpo inteiro.
 */
export function CameraSteps({ controls, dist, target, view, yaw, reduced, human, onCamera }: {
  controls: RefObject<Controls | null>; dist: number; target: V3; view: AvatarView; yaw?: number; reduced: boolean;
  human: HumanStore; onCamera?: (api: FittingCameraApi | null) => void;
}) {
  const camera = useThree((s) => s.camera);
  const tween = useRef<{ pose: OrbitPose; goal: OrbitPose } | null>(null);
  const glide = useRef<Glide | null>(null);
  const detail = useRef<Detail>(BODY);
  const sph = useMemo(() => new THREE.Spherical(), []), off = useMemo(() => new THREE.Vector3(), []);
  const live = useRef({ view, yaw }); live.current = { view, yaw };
  const hooks = useRef({ reset: () => {}, settle: () => {} });
  /** paradas no corpo em repouso, recalculadas só quando o corpo composto muda */
  const restCache = useRef<{ of: unknown; stops: DetailStop[] }>({ of: null, stops: [] });
  const restStops = useRef(() => {
    const P = human.get(); if (!P) return [];
    if (restCache.current.of !== P.composed) restCache.current = { of: P.composed, stops: surfaceStops(P.composed.body, bodyParam(P.asset, P.composed)) };
    return restCache.current.stops;
  }).current;
  useEffect(() => { tween.current = null; hooks.current.reset(); }, [view, yaw]);
  useEffect(() => {
    const c = controls.current; if (!c || !onCamera) return;
    detail.current = BODY; glide.current = null;
    c.minDistance = BODY_MIN_DISTANCE; c.maxDistance = dist * 1.25;
    const home = (() => { sph.setFromVector3(off.set(0, .12, dist)); return { theta: 0, phi: sph.phi, radius: sph.radius }; })();
    const homeEye = () => { const a = (live.current.yaw ?? VIEW_ANGLE[live.current.view]) * Math.PI / 180; return new THREE.Vector3(target[0] + Math.sin(a) * dist, target[1] + .12, target[2] + Math.cos(a) * dist); };
    const poseNow = (): OrbitPose => { sph.setFromVector3(off.subVectors(camera.position, c.target)); return { theta: sph.theta, phi: sph.phi, radius: sph.radius }; };
    const listeners = new Set<(s: OrbitLimitState) => void>(); let last = "";
    const emit = () => {
      const d = camera.position.distanceTo(c.target), state = { atMin: d <= c.minDistance + .01, atMax: d >= c.maxDistance - .01 }, key = `${state.atMin}|${state.atMax}`;
      if (key !== last) { last = key; listeners.forEach((l) => l(state)); }
    };
    const detailListeners = new Set<(s: DetailState) => void>();
    const state = (): DetailState => { const d = detail.current; return { mode: d.mode, t: d.t, stops: (d.stops.length ? d.stops : restStops()).map((s) => s.key) }; };
    const sync = () => { const s = state(); detailListeners.forEach((l) => l(s)); };
    /** desliza alvo e câmera; sem o limite de distância no meio do caminho (o OrbitControls daria um salto) */
    const glideTo = (to: THREE.Vector3 | V3, eye: THREE.Vector3 | V3, min: number, max: number) => {
      tween.current = null;
      const v = (p: THREE.Vector3 | V3) => p instanceof THREE.Vector3 ? p.clone() : new THREE.Vector3(...p);
      glide.current = { target: v(to), eye: v(eye), min, max };
      c.minDistance = 0; c.maxDistance = Infinity;
    };
    /** chega de uma vez (botão de órbita no meio do deslize) */
    const settle = () => {
      const g = glide.current; if (!g) return;
      c.target.copy(g.target); camera.position.copy(g.eye); c.minDistance = g.min; c.maxDistance = g.max; glide.current = null; c.update(); emit();
    };
    /** arrastar no meio do deslize: para onde está, com limites que aceitam a distância atual */
    const cancel = () => {
      tween.current = null;
      const g = glide.current; if (!g) return;
      const d = camera.position.distanceTo(c.target); c.minDistance = Math.min(g.min, d); c.maxDistance = Math.max(g.max, d); glide.current = null;
    };
    const reset = () => {
      const gliding = !!glide.current; glide.current = null;
      if (detail.current.mode === "corpo" && !gliding) return;
      detail.current = BODY; c.target.set(...target); c.minDistance = BODY_MIN_DISTANCE; c.maxDistance = dist * 1.25; c.update(); sync(); emit();
    };
    const focus = (mode: DetailMode, at?: StopKey) => {
      if (c.enabled === false) return;
      if (mode === "corpo") { detail.current = BODY; glideTo(target, homeEye(), BODY_MIN_DISTANCE, dist * 1.25); sync(); return; }
      const P = human.get(), rest = restStops(); if (!P || !rest.length) return;
      const stops = posedStops(P, rest), prev = detail.current;
      if (mode === "calcado") {
        const i = stops.findIndex((s) => s.key === "calcado"); if (i < 0) return;
        detail.current = { mode, t: i, stops }; glideTo(stops[i].target, stops[i].eye, DETAIL_LIMITS.min, DETAIL_LIMITS.max);
      } else {
        const i = at ? stops.findIndex((s) => s.key === at) : -1;
        const t = i >= 0 ? i : prev.mode === "percurso" ? Math.min(prev.t, stops.length - 1) : 0, pose = travelPose(stops, t)!;
        detail.current = { mode, t, stops }; glideTo(pose.target, pose.eye, DETAIL_LIMITS.min, DETAIL_LIMITS.max);
      }
      sync();
    };
    const travel = (t: number) => {
      if (detail.current.mode !== "percurso") focus("percurso");
      const d = detail.current; if (d.mode !== "percurso" || !d.stops.length) return;
      const next = Math.min(d.stops.length - 1, Math.max(0, t)), pose = travelPose(d.stops, next)!;
      detail.current = { ...d, t: next }; glideTo(pose.target, pose.eye, DETAIL_LIMITS.min, DETAIL_LIMITS.max); sync();
    };
    /** roda já decidida para a câmera (rolagem inteligente no FittingStage); false = no limite, a página rola */
    const wheel = (deltaY: number, pinch = false) => {
      if (c.enabled === false) return false;
      const d = detail.current;
      if (!pinch && d.mode === "percurso" && d.stops.length) { const r = wheelTravel(d.t, deltaY, d.stops.length); if (r.consumed) travel(r.t); return r.consumed; }
      const g = glide.current, to = g ? g.target : c.target, eye = g ? g.eye : camera.position;
      const min = g ? g.min : c.minDistance, max = g ? g.max : c.maxDistance;
      const r = wheelDolly(eye.distanceTo(to), deltaY, min, max); if (!r.consumed) return false;
      const goal = off.subVectors(eye, to).setLength(r.radius).add(to).clone();
      if (g) g.eye.copy(goal); else glideTo(c.target, goal, min, max);
      return true;
    };
    hooks.current = { reset, settle };
    // corpo montado (ou trocado): os enquadramentos de detalhe ficam disponíveis; o detalhe aberto volta ao corpo inteiro
    // (o mesmo corpo com outro nível de detalhe do cabelo não tira a pessoa do detalhe)
    let body = human.get()?.composed;
    const offHuman = human.subscribe(() => {
      const next = human.get()?.composed, changed = next !== body; body = next;
      if (changed && detail.current.mode !== "corpo") reset(); else sync();
    });
    c.addEventListener("start", cancel); c.addEventListener("change", emit);
    onCamera({
      step: (action) => {
        if (c.enabled === false) return; settle();
        const pose = tween.current?.pose ?? poseNow(), limits = { minRadius: c.minDistance, maxRadius: c.maxDistance };
        tween.current = { pose, goal: orbitGoal(tween.current?.goal ?? pose, action, limits, home) };
      },
      subscribe: (listener) => { listeners.add(listener); last = ""; emit(); return () => { listeners.delete(listener); }; },
      detail: {
        focus, travel, wheel,
        subscribe: (listener) => { detailListeners.add(listener); listener(state()); return () => { detailListeners.delete(listener); }; },
      },
    });
    return () => {
      offHuman(); c.removeEventListener("start", cancel); c.removeEventListener("change", emit); onCamera(null);
      hooks.current = { reset: () => {}, settle: () => {} };
    };
  }, [controls, camera, dist, target, onCamera, sph, off, human, restStops]);
  useFrame((_, dt) => {
    const c = controls.current; if (!c) return;
    if (c.enabled === false) { tween.current = null; if (glide.current) hooks.current.settle(); return; }
    const g = glide.current;
    if (g) {
      const k = reduced ? 1 : 1 - Math.exp(-dt * 7);
      c.target.lerp(g.target, k); camera.position.lerp(g.eye, k);
      if (c.target.distanceTo(g.target) < 1e-3 && camera.position.distanceTo(g.eye) < 1e-3) hooks.current.settle();
      else c.update();
      return;
    }
    const tw = tween.current; if (!tw) return;
    tw.pose = approach(tw.pose, tw.goal, reduced ? 1 : 1 - Math.exp(-dt * 9));
    camera.position.setFromSpherical(sph.set(tw.pose.radius, tw.pose.phi, tw.pose.theta)).add(c.target); c.update();
    if (tw.pose === tw.goal) tween.current = null;
  });
  return null;
}
