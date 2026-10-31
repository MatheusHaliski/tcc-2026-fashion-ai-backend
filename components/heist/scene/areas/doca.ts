/*
 * MET Gala Heist v2 — Doca de carga (Z12): decoração sem colisão (paredes, teto, piso, objetos), luzes e o que anima.
 * Código movido de interior-rooms.ts; o módulo da área (AREA, no fim) diz as salas, o construtor e o que ele substitui.
 */
import * as THREE from "three";
import { SPH, geo, mat } from "../interior-batch";
import { glow, solid } from "../interior-mats";
import { type RoomsCtx, A, B, wallPlane, signMat, beacon } from "./kit";
import type { AreaModule } from "./types";

/** Doca de carga: moldura da porta de enrolar (por dentro), faixas de alerta, luzes de vapor de sódio, paletes e o letreiro. */
function doca(c: RoomsCtx) {
  const P = c.P, room = "doca";
  B(c, room, P.yellow, -19, 0, 23.7, 4.4, 0.006, 0.4);
  for (let i = 0; i < 9; i++) B(c, room, P.black, -21.1 + i * 0.5, 0.0065, 23.7, 0.2, 0.006, 0.4, Math.PI / 4);
  for (const x of [-21.2, -16.8]) B(c, room, P.yellow, x, 0, 23.85, 0.18, 1.2, 0.15, 0, true);
  wallPlane(c, room, signMat(c.copy.dock, "service"), -15, 4.6, 16.53, 0, 3, 0.7);
  wallPlane(c, room, signMat(c.copy.staffOnly, "staff"), -19, 3.0, 16.53, 0, 1.5, 0.38);
  // paletes com carga do bufê encostados na parede norte (fora do caminho)
  for (const x of [-9.3, -10.4]) { B(c, room, P.crateWood, x, 0, 16.9, 1.0, 0.14, 0.7); B(c, room, solid("shrinkWrap", "#d8dde0", { rough: 0.25, transparent: true, opacity: 0.8 }), x, 0.14, 16.9, 0.95, 0.9, 0.65); }
  for (const [x, z] of [[-20, 19], [-14, 19], [-11, 22.5], [-17, 22.5]]) { c.inst.add(room, "sodium", geo("sodiumGeo", () => new THREE.CylinderGeometry(0.22, 0.28, 0.18, 14, 1, true)), P.darkSteel, mat(x, 5.6, z)); c.inst.add(room, "sodiumBulb", SPH(10), glow("sodiumGlow", "#ffb35c", 2.4), mat(x, 5.5, z, 0, 0.09)); A(c, room, x, 5.3, z, "#ffb35c", 14, 9); }
  beacon(c, room, -21.9, 4.2, 18.5, 1, 0);
}

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = { id: "doca", rooms: ["doca"], dress: doca };
