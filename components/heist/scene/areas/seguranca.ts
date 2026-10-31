/*
 * MET Gala Heist v2 — Sala de segurança — monitoramento (Z09): decoração sem colisão (paredes, teto, piso, objetos), luzes e o que anima.
 * Código movido de interior-rooms.ts; o módulo da área (AREA, no fim) diz as salas, o construtor e o que ele substitui.
 */
import * as THREE from "three";
import { BOX0, geo, mat } from "../interior-batch";
import { SANS, drawnTexture } from "../interior-tex";
import { type RoomsCtx, A, B, wallPlane, signMat, framedPoster } from "./kit";
import type { AreaModule } from "./types";

/** Sala de segurança: planta do museu na parede, quadro de chaves, relógio, fluorescente. */
function seguranca(c: RoomsCtx) {
  const P = c.P, room = "seguranca";
  const plan = drawnTexture("museumPlan", 512, 512, (g, w, h) => {
    g.fillStyle = "#0e1a26"; g.fillRect(0, 0, w, h); g.strokeStyle = "#7fd7ff"; g.lineWidth = 3;
    const rect = (x0: number, z0: number, x1: number, z1: number) => g.strokeRect(((x0 + 24) / 48) * w, ((z0 + 24) / 48) * h, ((x1 - x0) / 48) * w, ((z1 - z0) / 48) * h);
    rect(-22, -22, -12.5, -6.5); rect(-12, -22, 12, -6.5); rect(12.5, -22, 22, -6.5); rect(-22, -6, -12.5, 16); rect(-12, -6, 12, 14); rect(12.5, -6, 22, 4); rect(12.5, 4.5, 22, 14); rect(-8, 14.5, 8, 24); rect(-22, 16.5, -8.5, 24);
    g.fillStyle = "#ff4b4b"; g.beginPath(); g.arc(((-17.25 + 24) / 48) * w, ((-14.25 + 24) / 48) * h, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#7fd7ff"; g.font = `600 22px ${SANS}`; g.fillText(c.copy.securityRoom, 16, h - 18);
  });
  framedPoster(c, room, plan, -19.2, 1.9, 7.47, Math.PI, 1.2, 1.2, P.darkSteel);
  B(c, room, P.darkSteel, -21.9, 1.3, 3.2, 0.08, 0.9, 0.7, 0, true);                           // quadro de chaves
  for (let i = 0; i < 12; i++) c.inst.add(room, "keyTag", BOX0(), [P.yellow, P.redPaint, P.goldBright][i % 3], mat(-21.85, 1.4 + Math.floor(i / 4) * 0.22, 2.95 + (i % 4) * 0.16, 0, 0.01, 0.08, 0.03));
  c.batch.add(room, P.black, geo("clock", () => new THREE.CylinderGeometry(0.16, 0.16, 0.04, 24).rotateX(Math.PI / 2)), mat(-20.2, 2.6, 2.03));
  c.inst.add(room, "fluoroTube", geo("fluoroTube", () => new THREE.BoxGeometry(1.2, 0.05, 0.12)), P.fluoro, mat(-20.2, 3.5, 4.8, Math.PI / 2));
  A(c, room, -20.2, 3.3, 4.8, "#e6f3ff", 6, 5);
  wallPlane(c, room, signMat(c.copy.securityRoom, "service"), -18.53, 2.95, 4.75, -Math.PI / 2, 1.4, 0.35);
}

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = { id: "seguranca", rooms: ["seguranca"], dress: seguranca };
