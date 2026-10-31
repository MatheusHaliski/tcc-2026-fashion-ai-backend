/*
 * MET Gala Heist v2 — Labirinto de serviço — copa e circulação da equipe (Z10): decoração sem colisão (paredes, teto, piso, objetos), luzes e o que anima.
 * Código movido de interior-rooms.ts; o módulo da área (AREA, no fim) diz as salas, o construtor e o que ele substitui.
 */
import * as THREE from "three";
import { MAZE, mazeCell } from "@/lib/heist/level";
import { BOX0, CYL, geo, mat } from "../interior-batch";
import { solid } from "../interior-mats";
import { type RoomsCtx, A, B, wallPlane, signMat, beacon } from "./kit";
import type { AreaModule } from "./types";

/** Labirinto de serviço: fluorescentes frias (algumas piscando), canos no teto, faixas amarelas, placas e os armários. */
function servico(c: RoomsCtx) {
  const P = c.P, room = "servico", H = 3.6;
  const tube = geo("fluoroTube", () => new THREE.BoxGeometry(1.2, 0.05, 0.12));
  const housing = geo("fluoroHousing", () => new THREE.BoxGeometry(1.3, 0.06, 0.2));
  let k = 0;
  for (let col = 0; col < MAZE.cols; col++) for (let row = 0; row < MAZE.rows; row++) {
    if (col <= 1 && row >= 4 && row <= 6) continue;                              // sala de segurança
    if ((col + row) % 2) continue;
    const p = mazeCell(col, row), along = (col + row) % 4 === 0 ? 0 : Math.PI / 2;
    c.inst.add(room, "fluoroHousing", housing, P.plasticDark, mat(p.x, H - 0.05, p.z, along));
    c.inst.add(room, "fluoroTube", tube, P.fluoro, mat(p.x, H - 0.1, p.z, along));
    A(c, room, p.x, H - 0.25, p.z, "#dff0ff", 5, 4.2, { flicker: (k++ % 5 === 0) ? 1 : 0 });
  }
  // canos correndo no alto, por cima das divisórias (3,2 m) e sob o forro (3,6 m)
  for (const [x, col] of [[-21.75, "#8a8f93"], [-12.8, "#9b2a24"]] as [number, string][]) c.batch.add(room, solid(`pipe${col}`, col, { metal: 0.6, rough: 0.45 }), CYL(10), mat(x, 3.42, 5, 0, 0.06, 22, 0.06, Math.PI / 2));
  c.batch.add(room, solid("pipeSteel", "#9aa0a6", { metal: 0.7, rough: 0.4 }), CYL(10), mat(-17, 3.45, -5.75, 0, 0.05, 9.5, 0.05, 0, Math.PI / 2));
  // faixas amarelas de piso ao longo dos corredores principais e placas
  for (let row = 0; row < MAZE.rows; row += 2) { const p = mazeCell(2, row); B(c, room, P.yellow, p.x, 0.003, p.z, 0.06, 0.004, 1.4); }
  wallPlane(c, room, signMat(c.copy.staffOnly, "staff"), -12.53, 2.6, 10, -Math.PI / 2, 1.5, 0.38);
  wallPlane(c, room, signMat(c.copy.serviceCorridor, "service"), -19, 2.6, 15.97, Math.PI, 1.6, 0.4);
  wallPlane(c, room, signMat(c.copy.exit, "exit"), -19, 2.9, 15.97, Math.PI, 0.6, 0.18);
  // armários de funcionários na parede leste (perto do uniforme do armário)
  for (let i = 0; i < 4; i++) {
    const z = -0.2 + i * 0.45;
    B(c, room, solid("lockerGrey", "#5d6670", { metal: 0.5, rough: 0.5 }), -12.65, 0.05, z, 0.3, 1.9, 0.42, 0, true);
    for (let s = 0; s < 3; s++) c.inst.add(room, "lockerVent", BOX0(), P.darkSteel, mat(-12.8, 1.5 + s * 0.05, z, 0, 0.005, 0.015, 0.25));
    c.inst.add(room, "lockerHandle", BOX0(), P.chrome, mat(-12.8, 1.0, z + 0.14, 0, 0.01, 0.12, 0.02));
  }
  beacon(c, room, -21.9, 3.0, 9.2, 1, 0); beacon(c, room, -12.6, 3.0, -2.6, -1, 0);
}

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = { id: "servico", rooms: ["servico"], dress: servico };
