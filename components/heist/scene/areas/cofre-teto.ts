/*
 * MET Gala Heist v2 — Sala das Joias (Z08): o teto de laca em caixotões com o tambor, a cúpula dourada e
 * o anel de spots sobre o pedestal. Saiu de cofre.ts sem mudança.
 */
import * as THREE from "three";
import { CYL, CYL0, geo, mat } from "../interior-batch";
import { type RoomsCtx, lightCone } from "./kit";
import { bx, lathe, lit, once, plain } from "./galeria-kit";
import { lacquerPlum } from "./cofre-tex";
import { ROOM, H, PX, PZ } from "./cofre-planta";

/* ---------- teto: caixotões de laca, tambor e cúpula dourada sobre o pedestal ---------- */
export function ceiling(c: RoomsCtx) {
  const lac = lacquerPlum(), gold = c.P.gold, XB = [-19.6, -14.9], ZB = [-19.6, -8.9];
  for (const x of XB) { bx(c.batch, ROOM, lac, mat(x, H - 0.26, -14.25, 0, 0.3, 0.26, 15.5), true); for (const s of [-1, 1]) c.batch.add(ROOM, gold, CYL(8), mat(x + s * 0.14, H - 0.255, -14.25, 0, 0.008, 15.5, 0.008, Math.PI / 2)); }
  for (const z of ZB) { bx(c.batch, ROOM, lac, mat(-17.25, H - 0.26, z, 0, 9.5, 0.26, 0.3), true); for (const s of [-1, 1]) c.batch.add(ROOM, gold, CYL(8), mat(-17.25, H - 0.255, z + s * 0.14, 0, 0.008, 9.5, 0.008, 0, Math.PI / 2)); }
  // tambor (laca por fora, aro dourado) e a cúpula com folha de ouro, vista por dentro
  // o tambor é visto por fora (da sala) e por dentro (de baixo da cúpula): laca de duas faces
  const lac2 = once("cofre-lacaDupla", () => new THREE.MeshPhysicalMaterial({ color: "#1c0d17", roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 1.2, side: THREE.DoubleSide }));
  c.batch.add(ROOM, lac2, geo("cofre-tambor", () => new THREE.CylinderGeometry(2.08, 2.08, 0.5, 72, 1, true).translate(0, 0.25, 0)), mat(PX, H - 0.5, PZ));
  c.batch.add(ROOM, gold, geo("cofre-tamborAro", () => new THREE.TorusGeometry(2.08, 0.04, 8, 96).rotateX(Math.PI / 2)), mat(PX, H - 0.5, PZ));
  c.batch.add(ROOM, gold, geo("cofre-tamborAro2", () => new THREE.TorusGeometry(2.08, 0.018, 6, 96).rotateX(Math.PI / 2)), mat(PX, H - 0.36, PZ));
  const R = (2.0 ** 2 + 0.4 ** 2) / 0.8, th = Math.asin(2.0 / R);
  c.batch.add(ROOM, plain("cofre-folhaOuro", "#b8914a", { metal: 1, rough: 0.34, side: THREE.BackSide }), geo("cofre-cupula", () => new THREE.SphereGeometry(R, 72, 10, 0, Math.PI * 2, 0, th).translate(0, -R, 0)), mat(PX, H - 0.04, PZ));
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; bx(c.batch, ROOM, gold, mat(PX + Math.cos(a) * 1.25, 4.93, PZ + Math.sin(a) * 1.25, -a, 1.5, 0.02, 0.025, 0, -0.245)); }
  c.batch.add(ROOM, gold, lathe("cofre-rosetaCupula", [[0, -0.12], [0.06, -0.1], [0.12, -0.05], [0.16, 0], [0, 0]], 24), mat(PX, H - 0.06, PZ));
  // anel de spots dentro da cúpula: os quatro dos feixes duros no pedestal e quatro de apoio
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8, x = PX + Math.cos(a) * 1.55, z = PZ + Math.sin(a) * 1.55, y = H - 0.42;
    c.batch.add(ROOM, plain("cofre-pretoFosco", "#141416", { rough: 0.5 }), CYL0(16), mat(x, y, z, 0, 0.075, 0.14, 0.075));
    c.batch.add(ROOM, lit("cofre-lenteSpot", "#f4f8ff", 3), geo("cofre-lenteGeo", () => new THREE.CircleGeometry(0.05, 18).rotateX(Math.PI / 2)), mat(x, y - 0.002, z));
    if (k % 2 === 0) lightCone(c, ROOM, new THREE.Vector3(x, y - 0.02, z), new THREE.Vector3(PX, 1.15, PZ), 0.3, "#eef4ff", 0.065);
  }
  // spots embutidos nos caixotões da borda, mirando as vitrines e os nichos
  for (const [x, z] of [[-20.8, -20.8], [-17.25, -20.8], [-13.7, -20.8], [-20.8, -14.25], [-13.7, -11.5], [-20.8, -7.7], [-17.25, -7.7], [-13.7, -7.7], [-20.8, -11.0], [-20.8, -17.5]] as [number, number][]) {
    c.batch.add(ROOM, plain("cofre-pretoFosco", "#141416", { rough: 0.5 }), geo("cofre-latinha", () => new THREE.CylinderGeometry(0.07, 0.07, 0.03, 18, 1, true)), mat(x, H - 0.015, z));
    c.batch.add(ROOM, lit("cofre-lenteSpot", "#f4f8ff", 3), geo("cofre-lenteEmbutida", () => new THREE.CircleGeometry(0.045, 18).rotateX(Math.PI / 2)), mat(x, H - 0.02, z));
  }
  // detector de fumaça e grelha de retorno do ar condicionado (sala climatizada)
  c.batch.add(ROOM, plain("galeria-plastico", "#e8e6e0", { rough: 0.5 }), CYL0(20), mat(-17.25, H - 0.04, -10.6, 0, 0.065, 0.04, 0.065));
  for (let k = 0; k < 6; k++) bx(c.batch, ROOM, plain("cofre-grelha", "#2a2224", { metal: 0.5, rough: 0.5 }), mat(-17.25, H - 0.02, -18.4 + k * 0.08, 0, 0.9, 0.02, 0.03));
}
