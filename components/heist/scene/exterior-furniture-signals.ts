/*
 * MET Gala Heist v2 — mobiliário da avenida: fora da área andável — semáforos das esquinas (com os brilhos) e o armário do controlador.
 */
import * as THREE from "three";
import { SIDEWALK_Y } from "@/lib/heist/level";
import { boxGeo, lathe, tubeThrough } from "./exterior-geometry";
import { flyerUV } from "./exterior-citytex";
import type { GlowSpec } from "./exterior-glow";
import { add, type Parts, quadUV, T } from "./exterior-furniture-parts";

/* ---------- fora da área andável: semáforos, controlador e placas de rua ---------- */
/** Semáforo de esquina: coluna, braço de `arm` m (o −z local aponta o braço) e duas cabeças viradas para o rumo `face`
 * (giro no mundo); semáforo de pedestre com a mão vermelha e as placas com os nomes das ruas. */
export function signal(P: Parts, x: number, z: number, armYaw: number, face: number, arm: number, glows: GlowSpec[]) {
  const M = T(x, SIDEWALK_Y, z, armYaw);
  add(P, "paintBlack", lathe([[0, 0], [0.2, 0], [0.2, 0.05], [0.13, 0.12], [0.11, 6.2], [0, 6.2]], 12), M);
  add(P, "paintBlack", tubeThrough([[0, 5.9, 0], [0, 6.05, -1.5], [0, 6.1, -arm]], 0.07, 12, 8), M);
  for (const d of [arm * 0.45, arm * 0.9]) {
    const H = M.clone().multiply(T(0, 5.2, -d, face - armYaw));
    add(P, "paintBlack", boxGeo(-0.17, 0, -0.14, 0.17, 0.95, 0.14), H);
    add(P, "paintBlack", boxGeo(-0.17, 0.95, -0.02, 0.17, 1.0, 0.02), H);
    for (let k = 0; k < 3; k++) { add(P, k === 0 ? "sigRed" : "sigOff", lathe([[0, 0], [0.1, 0], [0, 0.005]], 12).rotateX(Math.PI / 2).translate(0, 0.78 - k * 0.3, 0.145), H); add(P, "paintBlack", lathe([[0.11, 0], [0.13, 0], [0.12, 0.12], [0.11, 0.12]], 12).rotateX(Math.PI / 2).translate(0, 0.78 - k * 0.3, 0.14), H); }
    glows.push({ pos: new THREE.Vector3(0, 0.78, 0.25).applyMatrix4(H), size: 0.9, color: "#ff2a1a", strength: 0.8 });
  }
  // semáforo de pedestre (mão vermelha) e as placas com o nome das ruas
  const ped = M.clone().multiply(T(0, 2.4, 0.15));
  add(P, "paintBlack", boxGeo(-0.17, 0, 0, 0.17, 0.4, 0.22), ped); add(P, "sigRed", boxGeo(-0.1, 0.22, 0.221, 0.1, 0.36, 0.223), ped);
  glows.push({ pos: new THREE.Vector3(0, 0.29, 0.35).applyMatrix4(ped), size: 0.5, color: "#ff4a2a", strength: 0.6 });
  add(P, "streetSign", quadUV(-0.7, 3.35, 0.7, 3.62, 0.03, [0, 0.5, 1, 1]).rotateY(Math.PI / 2), M); add(P, "streetSign", quadUV(-0.7, 3.35, 0.7, 3.62, -0.03, [0, 0.5, 1, 1], true).rotateY(Math.PI / 2), M);
  add(P, "streetSign", quadUV(-0.7, 3.66, 0.7, 3.93, 0.03, [0, 0, 1, 0.5]), M); add(P, "streetSign", quadUV(-0.7, 3.66, 0.7, 3.93, -0.03, [0, 0, 1, 0.5], true), M);
}
export function cabinet(P: Parts, M: THREE.Matrix4, r: () => number) {
  add(P, "cabinet", boxGeo(-0.4, 0, -0.25, 0.4, 1.35, 0.25), M);
  add(P, "cabinet", boxGeo(-0.43, 1.35, -0.28, 0.43, 1.4, 0.28), M);
  for (let k = 0; k < 7; k++) { const fw = 0.24 + r() * 0.08, fx = -0.38 + r() * (0.76 - fw), fy = 0.25 + r() * 0.75; add(P, "poster", quadUV(fx, fy, fx + fw, fy + fw / 0.707, 0.252 + k * 0.001, flyerUV(Math.floor(r() * 16))), M); }
}
