/* MET Gala Heist v2 — alturas do piso: calçada, pista, meio-fio, escadaria do tapete e rampa da doca (floorY). */
import type { Vec } from "./types";

/* ---------- alturas ---------- */
export const SIDEWALK_Y = -1.6, ROAD_Y = -1.75, CURB_Z = 33, FAR_CURB_Z = 43;
/** Escadaria: x −6…6, patamar até z 25,5, doze degraus até z 31. */
export const STAIRS = { x0: -6, x1: 6, top: 25.5, bottom: 31, steps: 12 };
export const DOCK_RAMP = { x0: -21, x1: -17, z0: 24.5, z1: 28.5 };
/** Altura do piso em (x, z): prédio em 0, calçada e beco em −1,6, pista em −1,75, degraus da escadaria e rampa da doca. */
export function floorY(p: Vec): number {
  if (p.z < 24.5 && p.x < 22.5) return 0;
  if (p.z < 24.5) return SIDEWALK_Y;                                                   // beco
  if (p.x >= STAIRS.x0 && p.x <= STAIRS.x1 && p.z <= STAIRS.bottom) {
    if (p.z <= STAIRS.top) return 0;
    const k = Math.min(STAIRS.steps, Math.ceil(((p.z - STAIRS.top) / (STAIRS.bottom - STAIRS.top)) * STAIRS.steps));
    return (SIDEWALK_Y * k) / STAIRS.steps;
  }
  if (p.x >= DOCK_RAMP.x0 && p.x <= DOCK_RAMP.x1 && p.z <= DOCK_RAMP.z1) return SIDEWALK_Y * (p.z - DOCK_RAMP.z0) / (DOCK_RAMP.z1 - DOCK_RAMP.z0);
  if (p.z > CURB_Z && p.z < FAR_CURB_Z) return ROAD_Y;
  return SIDEWALK_Y;
}
