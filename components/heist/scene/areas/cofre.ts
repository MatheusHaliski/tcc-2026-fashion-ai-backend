/*
 * MET Gala Heist v2 — Sala das Joias (Z08): decoração sem colisão (paredes, teto, piso, objetos), luzes e o que anima.
 * Código movido de interior-rooms.ts; o módulo da área (AREA, no fim) diz as salas, o construtor e o que ele substitui.
 */
import * as THREE from "three";
import { LASERS } from "@/lib/heist/level";
import { BOX0, CYL, CYL0, SPH, mat, mul } from "../interior-batch";
import { type RoomsCtx, A, wallPlane, signMat, beacon, lightCone } from "./kit";
import type { AreaModule } from "./types";

/** Sala das Joias: lambri de latão, focos duros sobre o pedestal, postes emissores dos lasers, câmeras, luz de segurança. */
function cofre(c: RoomsCtx) {
  const P = c.P, room = "cofre", H = 5.2;
  // lambri de latão a 1 m e friso dourado alto nas quatro paredes
  for (const [x0, z0, x1, z1] of [[-22, -22, -12.5, -22], [-22, -6.5, -12.5, -6.5], [-22, -22, -22, -6.5], [-12.5, -22, -12.5, -6.5]] as [number, number, number, number][]) {
    const alongX = z0 === z1, len = alongX ? x1 - x0 : z1 - z0, inward = alongX ? (z0 < -10 ? 1 : -1) : (x0 < -15 ? 1 : -1);
    const at = (a: number, y: number, sx: number, sy: number, sz: number) => alongX ? mat(x0 + a, y, z0 + inward * 0.02, 0, sx, sy, sz) : mat(x0 + inward * 0.02, y, z0 + a, 0, sz, sy, sx);
    // o friso baixo não cruza os vãos (porta da galeria a leste, janela ao norte)
    const gaps: [number, number][] = alongX ? (z0 < -10 ? [[-20.05 - x0, -18.95 - x0]] : []) : (x0 > -15 ? [[-16.05 - z0, -13.95 - z0]] : []);
    let a0 = 0;
    for (const [g0, g1] of [...gaps, [len, len] as [number, number]]) { if (g0 > a0) c.batch.add(room, P.brass, BOX0(), at((a0 + g0) / 2, 1.0, g0 - a0, 0.04, 0.03)); a0 = g1; }
    c.batch.add(room, P.gold, BOX0(), at(len / 2, 3.6, len, 0.06, 0.03));
  }
  // anel de focos no teto sobre o pedestal (luz branca dura) e o cone de luz
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4, x = -17.25 + Math.cos(a) * 1.6, z = -14.25 + Math.sin(a) * 1.6;
    c.batch.add(room, P.black, CYL(14), mat(x, H - 0.2, z, 0, 0.09, 0.3, 0.09));
    lightCone(c, room, new THREE.Vector3(x, H - 0.35, z), new THREE.Vector3(-17.25, 1.15, -14.25), 0.32, "#eef4ff", 0.1);
  }
  A(c, room, -17.25, H - 0.6, -14.25, "#f0f5ff", 30, 9);
  for (const [x, z] of [[-20.5, -9], [-14, -9], [-20.5, -20], [-14, -20]]) A(c, room, x, H - 0.4, z, "#dbe6ff", 12, 7);
  // postes emissores dos lasers (os feixes são da simulação/coordenador)
  const seen = new Set<string>();
  for (const L of LASERS) for (const p of [L.a, L.b]) {
    const key = `${p.x},${p.z}`; if (seen.has(key)) continue; seen.add(key);
    c.batch.add(room, P.black, CYL0(12), mat(p.x, 0, p.z, 0, 0.06, 1.65, 0.06));
    c.batch.add(room, P.chrome, CYL0(12), mat(p.x, 1.65, p.z, 0, 0.07, 0.04, 0.07));
    for (const y of [0.35, 0.9, 1.45]) c.inst.add(room, "laserLens", SPH(8), P.ledRed, mat(p.x, y, p.z, 0, 0.025));
  }
  // câmeras de segurança nos cantos e a placa da sala
  for (const [x, z, ry] of [[-21.7, -21.7, Math.PI * 0.25], [-12.8, -6.8, -Math.PI * 0.75], [-12.8, -21.7, -Math.PI * 0.25]] as [number, number, number][]) {
    const at = mat(x, H - 0.4, z, ry);
    c.batch.add(room, P.plastic, BOX0(), mul(at, mat(0, -0.06, 0.12, 0, 0.12, 0.12, 0.3)));
    c.batch.add(room, P.plastic, BOX0(), mul(at, mat(0, 0, 0, 0, 0.04, 0.12, 0.04)));
    c.inst.add(room, "ledRed", SPH(6), P.ledRed, mul(at, mat(0.04, -0.02, 0.28, 0, 0.01)));
  }
  wallPlane(c, room, signMat(c.copy.jewelPlaque, "brass"), -17.25, 3.1, -21.97, 0, 2.4, 0.5);
  beacon(c, room, -21.9, 4.4, -14.3, 1, 0); beacon(c, room, -12.6, 4.4, -10.5, -1, 0);
}

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = { id: "cofre", rooms: ["cofre"], dress: cofre };
