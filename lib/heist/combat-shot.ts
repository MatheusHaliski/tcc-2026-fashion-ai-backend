/* MET Gala Heist v2 — o raio do tiro: primeira parede ou porta fechada na grade, móveis que param a bala, cabeça/corpo do segurança e civil na frente. */
import type { Civilian, Guard, SimState, Vec } from "./types";
import { CELL, GW, X0, Z0, cellOf, inGrid, propsNear, segBox, segCircle } from "./world";
import { floorY } from "./level";
import type { SimCtx } from "./state";

export interface V3 { x: number; y: number; z: number }

/** Primeira parede (ou porta fechada) no plano ao longo do raio: distância horizontal. */
function wallDistance(ctx: SimCtx, s: SimState, o: Vec, yaw: number, maxD: number): number {
  const w = ctx.world, dx = Math.sin(yaw), dz = Math.cos(yaw);
  let [i, j] = cellOf(o.x, o.z);
  const si = dx > 0 ? 1 : -1, sj = dz > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(CELL / dx) : Infinity, tdz = dz !== 0 ? Math.abs(CELL / dz) : Infinity;
  let tmx = dx !== 0 ? ((X0 + (i + (si > 0 ? 1 : 0)) * CELL) - o.x) / dx : Infinity, tmz = dz !== 0 ? ((Z0 + (j + (sj > 0 ? 1 : 0)) * CELL) - o.z) / dz : Infinity;
  let t = 0;
  for (let n = 0; n < 400 && t < maxD; n++) {
    if (!inGrid(i, j)) return t;
    const c = w.grid[j * GW + i];
    if (c === 0) return t;
    if (c === 2) { const d = w.doors[w.doorAt[j * GW + i]]; if (d.lock === "vent" || d.lock === "climb" || (!s.doors[d.id] && d.id !== "carpetGate")) return t; }
    if (tmx < tmz) { t = tmx; i += si; tmx += tdx; } else { t = tmz; j += sj; tmz += tdz; }
  }
  return maxD;
}

/** Tiro de `o` (altura oy) na direção (yaw, pitch): devolve o segurança atingido (e se foi na cabeça) ou o ponto de impacto. */
export function castShot(s: SimState, ctx: SimCtx, o: Vec, oy: number, yaw: number, pitch: number, maxD = 45): { guard: Guard | null; head: boolean; t: number; point: V3; civ: Civilian | null } {
  const cp = Math.cos(pitch), D = { x: Math.sin(yaw) * cp, y: Math.sin(pitch), z: Math.cos(yaw) * cp };
  let tMax = wallDistance(ctx, s, o, yaw, maxD * cp) / Math.max(cp, 1e-3);
  // móveis altos e vidro param a bala; baixos só se o raio passa abaixo de ~0,95 m do piso
  const end = { x: o.x + D.x * tMax, z: o.z + D.z * tMax };
  for (const k of propsNear(ctx.world, Math.min(o.x, end.x), Math.min(o.z, end.z), Math.max(o.x, end.x), Math.max(o.z, end.z))) {
    const p = ctx.world.props[k];
    const t2 = p.shape.type === "box" ? segBox(o, end, p.shape) : segCircle(o, end, p.shape);
    if (t2 === null) continue;
    const t = t2 * tMax, y = oy + D.y * t - floorY({ x: o.x + D.x * t, z: o.z + D.z * t });
    if (p.height === "low" && y > 0.95) continue;
    if (t < tMax) tMax = t;
  }
  let best: Guard | null = null, bestT = tMax, head = false;
  for (const g of s.guards) {
    if (!g.active || g.state === "DOWN" || g.state === "GRABBED") continue;
    const gy = floorY(g.pos), rx = g.pos.x - o.x, rz = g.pos.z - o.z, hl = D.x * D.x + D.z * D.z;
    // cabeça: esfera de 14 cm a 1,66 m
    const hc = { x: rx, y: gy + 1.66 - oy, z: rz }, b = hc.x * D.x + hc.y * D.y + hc.z * D.z, c = hc.x * hc.x + hc.y * hc.y + hc.z * hc.z - 0.14 * 0.14, disc = b * b - c;
    if (disc >= 0) { const t = b - Math.sqrt(disc); if (t > 0.2 && t < bestT) { best = g; bestT = t; head = true; continue; } }
    // corpo: cilindro de 30 cm de raio até 1,55 m
    if (hl < 1e-6) continue;
    const t = (rx * D.x + rz * D.z) / hl;
    if (t <= 0.2 || t >= bestT) continue;
    const px = o.x + D.x * t - g.pos.x, pz = o.z + D.z * t - g.pos.z, y = oy + D.y * t - gy;
    if (px * px + pz * pz < 0.3 * 0.3 && y > 0.05 && y < 1.55) { best = g; bestT = t; head = false; }
  }
  // a bala não atravessa gente: quem está na frente (convidado, garçom, fã) para o tiro antes do alvo
  let civ: Civilian | null = null;
  const hl = D.x * D.x + D.z * D.z;
  if (hl > 1e-6) for (const c of s.civs) {
    const rx = c.pos.x - o.x, rz = c.pos.z - o.z, t = (rx * D.x + rz * D.z) / hl;
    if (t <= 0.3 || t >= bestT) continue;
    const px = o.x + D.x * t - c.pos.x, pz = o.z + D.z * t - c.pos.z, y = oy + D.y * t - (c.y ?? floorY(c.pos));
    if (px * px + pz * pz < 0.27 * 0.27 && y > 0.05 && y < 1.6) { civ = c; best = null; bestT = t; head = false; }
  }
  return { guard: best, head, t: bestT, point: { x: o.x + D.x * bestT, y: oy + D.y * bestT, z: o.z + D.z * bestT }, civ };
}
