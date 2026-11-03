/*
 * MET Gala Heist v2 — avenida: medidas da avenida (meio-fios, calçada de lá, degraus da escadaria), os móveis da rua e
 * do beco, as pistas (avenida e transversais) e as cabeças dos postes (para as luzes).
 */
import * as THREE from "three";
import { baseProps, floorY, ROAD_Y, SIDEWALK_Y, STAIRS } from "@/lib/heist/level";
import type { Prop } from "@/lib/heist/types";
import { merge, worldUV } from "./exterior-geometry";
import { CITY_X, CROSS, CROSS_Z1, FAR_LINE } from "./exterior-blocks";

export const X_FAR = CITY_X;                       // até onde a avenida segue (some na névoa)
export const CURB0 = 32.85, CURB1 = 33.05, FAR0 = 42.95, FAR1 = 43.15, FAR_END = FAR_LINE;
export const STEP_D = (STAIRS.bottom - STAIRS.top) / STAIRS.steps;
export const stepY = (k: number) => (SIDEWALK_Y * k) / STAIRS.steps;     // degrau k (1…12): 0 = patamar

export const streetProps = (): Prop[] => baseProps().filter((p) => p.room === "rua" || p.room === "beco");
/** Plano da pista (reflexo real no "high": exterior.tsx escolhe o material). */
let roadGeo: THREE.BufferGeometry | null = null;
export function roadGeometry(): THREE.BufferGeometry {
  if (!roadGeo) { roadGeo = new THREE.PlaneGeometry(X_FAR * 2, FAR0 - CURB1, 1, 1); roadGeo.rotateX(-Math.PI / 2); roadGeo.translate(0, ROAD_Y, (CURB1 + FAR0) / 2); worldUV(roadGeo); }
  return roadGeo;
}

/* ---------- chão ---------- */
/** Pistas das ruas transversais (asfalto sem reflexo de verdade), do meio-fio da avenida até o fim da quadra. */
export function crossRoadGeometry(): THREE.BufferGeometry {
  return merge(CROSS.map((c) => { const g = new THREE.PlaneGeometry(c.road1 - c.road0, CROSS_Z1 - FAR0, 1, 1); g.rotateX(-Math.PI / 2); g.translate((c.road0 + c.road1) / 2, ROAD_Y, (FAR0 + CROSS_Z1) / 2); return worldUV(g); }));
}

/** Cabeças dos postes: lanternas de ferro fundido no meio-fio do museu (4,55 m) e luminárias de LED de 8 m no meio-fio de
 * lá, com o braço por cima da pista. */
export function streetLights(props: Prop[]): { pos: THREE.Vector3; kind: "lantern" | "led" }[] {
  return props.filter((p) => p.kind === "lampPost" && p.shape.type === "circle").map((p) => {
    const s = p.shape as { x: number; z: number }, led = s.z > 38;
    return { pos: led ? new THREE.Vector3(s.x, floorY(s) + 8.15, s.z - 1.85) : new THREE.Vector3(s.x, floorY(s) + 4.55, s.z), kind: led ? "led" as const : "lantern" as const };
  });
}
