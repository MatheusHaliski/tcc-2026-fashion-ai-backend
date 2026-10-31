/*
 * MET Gala Heist v2 — Bastidores — camarins, ateliê e produção (Z11): decoração sem colisão (paredes, teto, piso, objetos), luzes e o que anima.
 * Código movido de interior-rooms.ts; o módulo da área (AREA, no fim) diz as salas, o construtor e o que ele substitui.
 */
import * as THREE from "three";
import { CYL, SPH, geo, mat } from "../interior-batch";
import { solid } from "../interior-mats";
import { SANS, drawnTexture } from "../interior-tex";
import { type RoomsCtx, A, B, wallPlane, signMat, framedPoster, beacon } from "./kit";
import type { AreaModule } from "./types";

/** Bastidores: cortinas pretas, aviso de silêncio, quadro do roteiro, cabos, cases de estrada e luzes de serviço. */
function bastidores(c: RoomsCtx) {
  const P = c.P, room = "bastidores";
  const drape = geo("bkDrape", () => { const g = new THREE.PlaneGeometry(1, 3.8, 24, 2); const p = g.getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) p.setZ(i, 0.04 * Math.sin(p.getX(i) * 28)); g.translate(0, 1.9, 0); g.computeVertexNormals(); return g; });
  for (let z = -5.5; z <= 3.5; z += 1) if (z < -3.4 || z > -0.6) c.batch.add(room, P.velvetBlack, drape, mat(12.56, 0.3, z, Math.PI / 2));
  wallPlane(c, room, signMat(c.copy.silence, "staff"), 17, 3.3, -5.97, 0, 2.6, 0.5);
  wallPlane(c, room, signMat(c.copy.backstage, "service"), 12.53, 3.6, -2, Math.PI / 2, 1.6, 0.4);
  // quadro do roteiro (run of show) na parede sul
  const ros = drawnTexture(`runOfShow-${c.copy.runOfShow[0]}`, 512, 640, (g, w, h) => {
    g.fillStyle = "#f4f4f0"; g.fillRect(0, 0, w, h); g.fillStyle = "#111"; g.textAlign = "left"; g.textBaseline = "top";
    g.font = `700 40px ${SANS}`; g.fillText(c.copy.runOfShow[0], 30, 30);
    g.font = `500 30px ${SANS}`; c.copy.runOfShow.slice(1).forEach((r, i) => g.fillText(r, 30, 110 + i * 60));
    g.strokeStyle = "#c2102a"; g.lineWidth = 5; g.beginPath(); g.moveTo(24, 110 + 3 * 60 + 18); g.lineTo(w - 24, 110 + 3 * 60 + 18); g.stroke();
  });
  framedPoster(c, room, ros, 13.6, 2.1, 3.97, Math.PI, 0.9, 1.15, P.black);
  // cases de estrada encostados na parede sul e cabos no chão
  for (let k = 0; k < 3; k++) B(c, room, solid("roadCase", "#151618", { rough: 0.5 }), 20.9 - k * 0.0, 0, 3.6 - k * 0.6, 0.9, 0.7 - k * 0.1, 0.5, 0, true);
  const cable = (pts: number[][]) => c.batch.add(room, P.rubber, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0.012, z))), 40, 0.012, 5, false));
  cable([[12.6, -2.2], [14, -2.4], [15.5, -2.1], [17.2, -2.6], [18.4, -4.4], [19.6, -5.2]]); cable([[12.6, -1.6], [13.6, 0.4], [15.2, 1.4]]);
  // luzes de serviço (lâmpada em gaiola) e o forro escuro
  for (const [x, z] of [[14.5, -3], [18.5, -3], [16.5, 1.5], [20.6, -1]]) { c.batch.add(room, P.black, CYL(6), mat(x, 4.3, z, 0, 0.006, 0.6, 0.006)); c.inst.add(room, "cageBulb", SPH(10), P.bulbWarm, mat(x, 3.95, z, 0, 0.06)); A(c, room, x, 3.9, z, "#ffd9a6", 8, 6.5); }
  beacon(c, room, 12.6, 3.8, 2.6, 1, 0);
}

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = { id: "bastidores", rooms: ["bastidores"], dress: bastidores };
