/*
 * MET Gala Heist v2 — avenida: geometria do chão da avenida (calçadas, meio-fio, faixas, bueiros) e da escadaria com o
 * tapete da gala, memorizada por hook.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { DOCK_RAMP, ROAD_Y, SIDEWALK_Y, STAIRS } from "@/lib/heist/level";
import { boxGeo, merge, worldUV } from "./exterior-geometry";
import { CROSS, CROSS_Z1 } from "./exterior-blocks";
import { CURB0, CURB1, FAR0, FAR1, FAR_END, STEP_D, stepY, X_FAR } from "./exterior-street-layout";

export function useGround() {
  return useMemo(() => {
    const sidewalk: THREE.BufferGeometry[] = [], curb: THREE.BufferGeometry[] = [];
    // calçada do museu (fora da escadaria e da rampa da doca), do meio-fio até a fachada
    for (const [x0, x1, z0] of [[-X_FAR, DOCK_RAMP.x0, 24.5], [DOCK_RAMP.x0, DOCK_RAMP.x1, DOCK_RAMP.z1], [DOCK_RAMP.x1, STAIRS.x0, 24.5], [STAIRS.x0, STAIRS.x1, STAIRS.bottom], [STAIRS.x1, X_FAR, 24.5]] as const) sidewalk.push(boxGeo(x0, SIDEWALK_Y - 0.3, z0, x1, SIDEWALK_Y, CURB0));
    // calçada de lá (fãs, revendedor, lojas), interrompida pelas transversais, e as calçadas delas até o fim da quadra
    const breaks = [-X_FAR, ...CROSS.flatMap((c) => [c.road0 - 0.2, c.road1 + 0.2]), X_FAR];
    for (let i = 0; i < breaks.length; i += 2) sidewalk.push(boxGeo(breaks[i], SIDEWALK_Y - 0.3, FAR1, breaks[i + 1], SIDEWALK_Y, FAR_END + 0.6));
    for (const c of CROSS) {
      sidewalk.push(boxGeo(c.walk0 - 0.6, SIDEWALK_Y - 0.3, FAR_END + 0.6, c.road0 - 0.2, SIDEWALK_Y, CROSS_Z1), boxGeo(c.road1 + 0.2, SIDEWALK_Y - 0.3, FAR_END + 0.6, c.walk1 + 0.6, SIDEWALK_Y, CROSS_Z1));
      curb.push(boxGeo(c.road0 - 0.2, ROAD_Y - 0.2, FAR1, c.road0, SIDEWALK_Y, CROSS_Z1), boxGeo(c.road1, ROAD_Y - 0.2, FAR1, c.road1 + 0.2, SIDEWALK_Y, CROSS_Z1));
    }
    // meio-fio de granito dos dois lados da avenida (a face desce até a pista), aberto nas transversais
    curb.push(boxGeo(-X_FAR, ROAD_Y - 0.2, CURB0, X_FAR, SIDEWALK_Y, CURB1));
    for (let i = 0; i < breaks.length; i += 2) curb.push(boxGeo(breaks[i], ROAD_Y - 0.2, FAR0, breaks[i + 1], SIDEWALK_Y, FAR1));
    // faixas: linha dupla amarela no meio, tracejadas brancas, faixas de pedestres nas esquinas e as linhas de retenção
    const yellow: THREE.BufferGeometry[] = [], white: THREE.BufferGeometry[] = [];
    const stripe = (x0: number, z0: number, x1: number, z1: number, to: THREE.BufferGeometry[]) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, ROAD_Y + 0.004, (z0 + z1) / 2); to.push(worldUV(g)); };
    const zebraX = (x0: number, x1: number) => { for (let z = CURB1 + 0.3; z < FAR0 - 0.4; z += 1.1) stripe(x0, z, x1, z + 0.6, white); };
    const gaps: [number, number][] = CROSS.map((c) => [c.walk0 - 4.8, c.walk1 + 4.8]);
    const yellowRun = (z0: number, z1: number) => { let x = -X_FAR; for (const [g0, g1] of gaps) { stripe(x, z0, g0, z1, yellow); x = g1; } stripe(x, z0, X_FAR, z1, yellow); };
    yellowRun(37.86, 37.96); yellowRun(38.06, 38.16);
    for (let x = -X_FAR; x < X_FAR; x += 6) { if (gaps.some(([g0, g1]) => x + 3 > g0 && x < g1)) continue; stripe(x, 35.42, x + 3, 35.52, white); stripe(x, 40.52, x + 3, 40.62, white); }
    for (const c of CROSS) {
      zebraX(c.walk0 - 4.4, c.walk0 - 0.6); zebraX(c.walk1 + 0.6, c.walk1 + 4.4);
      stripe(c.walk0 - 4.8, CURB1 + 0.2, c.walk0 - 4.5, 37.8, white); stripe(c.walk1 + 4.5, 38.2, c.walk1 + 4.8, FAR0 - 0.2, white);
      for (let x = c.road0 + 0.3; x < c.road1 - 0.4; x += 1.1) stripe(x, FAR1 + 0.6, x + 0.6, FAR1 + 3.6, white);
      stripe(c.road0 + 0.2, FAR1 + 4.0, (c.road0 + c.road1) / 2, FAR1 + 4.3, white);
      for (let z = FAR1 + 6; z < CROSS_Z1; z += 6) stripe((c.road0 + c.road1) / 2 - 0.06, z, (c.road0 + c.road1) / 2 + 0.06, z + 3, white);
    }
    // tampas de bueiro e grelhas de drenagem no meio-fio
    const iron: THREE.BufferGeometry[] = [];
    for (const [x, z] of [[-12, 36.4], [14, 39.6], [27, 36.8], [-58, 39.2], [-37.5, 70], [50.5, 88]]) { const c = new THREE.CylinderGeometry(0.34, 0.34, 0.02, 24); c.translate(x, ROAD_Y + 0.006, z); iron.push(worldUV(c)); }
    for (const x of [-18.5, -1, 13.5, 26]) iron.push(boxGeo(x - 0.45, ROAD_Y + 0.001, CURB1, x + 0.45, ROAD_Y + 0.012, CURB1 + 0.35));
    for (const x of [-22, -6.5, 9, 24]) iron.push(boxGeo(x - 0.45, ROAD_Y + 0.001, FAR0 - 0.35, x + 0.45, ROAD_Y + 0.012, FAR0));
    return { sidewalk: merge(sidewalk), curb: merge(curb), yellow: merge(yellow), white: merge(white), iron: merge(iron) };
  }, []);
}

/* ---------- escadaria e tapete ---------- */
export function useStairs() {
  return useMemo(() => {
    const steps: THREE.BufferGeometry[] = [], nosing: THREE.BufferGeometry[] = [];
    steps.push(boxGeo(STAIRS.x0, SIDEWALK_Y - 0.02, 24.5, STAIRS.x1, 0, STAIRS.top));                  // patamar
    for (let k = 1; k <= STAIRS.steps; k++) {
      const z0 = STAIRS.top + (k - 1) * STEP_D, z1 = STAIRS.top + k * STEP_D, y = stepY(k);
      steps.push(boxGeo(STAIRS.x0, SIDEWALK_Y - 0.02, z0, STAIRS.x1, y, z1));
      nosing.push(boxGeo(STAIRS.x0, y - 0.035, z0 - 0.025, STAIRS.x1, y + 0.004, z0 + 0.03));          // focinho do degrau
    }
    // tapete: polilinha (z, y) do meio-fio até as portas, com pisos e espelhos; estendida em x de −2,4 a 2,4
    const line: [number, number][] = [[CURB1, SIDEWALK_Y]];
    let cz = STAIRS.bottom - STEP_D, cy = SIDEWALK_Y; line.push([cz, cy]);
    for (let k = STAIRS.steps - 1; k >= 0; k--) { const y = k === 0 ? 0 : stepY(k); line.push([cz, y]); cz = k === 0 ? 24.5 : cz - STEP_D; line.push([cz, y]); cy = y; }
    const W = 2.4, pos: number[] = [], uv: number[] = [], nor: number[] = [];
    let len = 0;
    for (let i = 0; i < line.length - 1; i++) {
      const [za, ya] = line[i], [zb, yb] = line[i + 1];
      const seg = Math.hypot(zb - za, yb - ya); if (seg < 1e-4) continue;
      const vertical = Math.abs(yb - ya) > Math.abs(zb - za);
      const off = vertical ? [0, 0, 0.007] : [0, 0.007, 0];                                             // tapete por cima da pedra
      const n = vertical ? [0, 0, 1] : [0, 1, 0];
      const quad = [[-W, za, ya, len], [W, za, ya, len], [W, zb, yb, len + seg], [-W, zb, yb, len + seg]];
      for (const k of [0, 1, 2, 0, 2, 3]) { const [x, z, y, l] = quad[k]; pos.push(x + off[0], y + off[1], z + off[2]); uv.push((x + W) / (2 * W), l / 2); nor.push(n[0], n[1], n[2]); }
      len += seg;
    }
    const carpet = new THREE.BufferGeometry();
    carpet.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); carpet.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); carpet.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    return { steps: merge(steps), nosing: merge(nosing), carpet };
  }, []);
}
