/*
 * MET Gala Heist v2 — doca (Z12): a empilhadeira patolada elétrica carregando na parede (e a barra
 * entre dois pontos que o cabo do carregador usa). Saiu de doca-props.ts sem mudança.
 */
import * as THREE from "three";
import { BOX0, CYL0, geo, mat, mul } from "../interior-batch";
import type { PropsCtx } from "../interior-props";
import type { Rect } from "./doca-tex";
import { ROOM, type Foot, type Mat, type DocaMats, tint, L, bx, cy, decal } from "./doca-mats";

/** Barra (cilindro) de a até b, no referencial do móvel. */
export function seg(c: PropsCtx, m: Mat, f: Foot, a: [number, number, number], b: [number, number, number], r: number, color?: THREE.ColorRepresentation) {
  const A3 = new THREE.Vector3(...a), B3 = new THREE.Vector3(...b), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B3.clone().sub(A3).normalize());
  c.batch.add(ROOM, m, color ? tint(CYL0(6), "cyl06", color) : CYL0(6), mul(mat(f.cx, 0, f.cz, f.yaw), new THREE.Matrix4().compose(A3, q, new THREE.Vector3(r, A3.distanceTo(B3), r))));
}

/** Empilhadeira patolada elétrica estacionada junto à parede sul, carregando (1,7 × 0,74 m, torre de 2,0 m): chassi da
 * bateria com o timão em pé, torre de dois estágios com cilindro, correntes e tela de proteção, garfos baixados sobre
 * as patolas, roletes e rodízios, a plaqueta de capacidade e o cabo do carregador na tomada industrial da parede.
 * Comprimento ao longo de x local (garfos para +x); a parede fica em +z local, o lado −z dá para a doca. */
export function stacker(c: PropsCtx, M: DocaMats, A: Record<string, Rect>, f: Foot) {
  const zc = -0.05, yel = "#dfa91b", dark = "#2a2d31", black = "#1c1e21", wall = f.d / 2, room = zc - 0.32;
  // chassi (bateria e tração): corpo amarelo, tampa preta, rodapé, para-choque de borracha, frisos e venezianas
  bx(c, M.paint, f, -0.51, 0.07, zc, 0.62, 0.79, 0.64, yel, { cast: true });
  bx(c, M.paint, f, -0.51, 0.86, zc, 0.65, 0.06, 0.67, black);
  bx(c, M.paint, f, -0.51, 0.03, zc, 0.6, 0.05, 0.6, black);
  bx(c, M.rubber, f, -0.835, 0.1, zc, 0.03, 0.15, 0.6);
  bx(c, M.paint, f, -0.51, 0.47, room - 0.001, 0.6, 0.006, 0.004, "#7a5d10"); bx(c, M.paint, f, -0.29, 0.1, room - 0.001, 0.006, 0.74, 0.004, "#7a5d10");
  for (let k = 0; k < 5; k++) bx(c, M.paint, f, -0.74 + k * 0.035, 0.16, room - 0.002, 0.014, 0.2, 0.004, "#3a2e0b");
  decal(c, M.signs, f, "stacker", A.stacker, -0.52, 0.66, room - 0.004, 0.36, 0.18, Math.PI);
  decal(c, M.signs, f, "stackerHz", A.hazard, -0.824, 0.5, zc, 0.5, 0.1, -Math.PI / 2);
  // painel na tampa: indicador de bateria aceso, chave e o botão de emergência
  bx(c, M.plastic, f, -0.66, 0.92, zc - 0.13, 0.11, 0.014, 0.07, "#101418"); c.batch.add(ROOM, M.ledGreen, BOX0(), L(f, -0.67, 0.934, zc - 0.13, 0, 0.06, 0.004, 0.03));
  cy(c, M.chrome, f, -0.58, 0.92, zc - 0.13, 0.012, 0.025);
  cy(c, M.plastic, f, -0.72, 0.92, zc + 0.14, 0.03, 0.03, "#e2b322"); cy(c, M.plastic, f, -0.72, 0.95, zc + 0.14, 0.036, 0.028, "#c62828");
  // timão: articulação, braço quase de pé (posição de descanso) e a cabeça com as manoplas, aceleradores e o botão de reversão
  const tilt = 0.12, arm = 0.9, tx = -0.71 - Math.sin(tilt) * arm, ty = 0.96 + Math.cos(tilt) * arm;
  bx(c, M.paint, f, -0.71, 0.9, zc, 0.13, 0.08, 0.15, black);
  bx(c, M.paint, f, -0.71, 0.96, zc, 0.05, arm, 0.05, black, { rz: tilt });
  bx(c, M.plastic, f, tx, ty - 0.04, zc, 0.13, 0.09, 0.34, black, { rz: tilt });
  for (const s of [-1, 1]) { cy(c, M.rubber, f, tx, ty + 0.005, zc + s * 0.17, 0.024, 0.1, undefined, { rx: s * Math.PI / 2 }); bx(c, M.plastic, f, tx - 0.03, ty + 0.03, zc + s * 0.13, 0.03, 0.05, 0.05, "#e2b322"); }
  cy(c, M.plastic, f, tx - 0.06, ty, zc, 0.028, 0.03, "#c62828", { rz: Math.PI / 2 });
  // torre: montantes externos (perfil C) e internos, travessas, cilindro hidráulico, cabeçote, polias e correntes
  for (const s of [-1, 1]) { bx(c, M.paint, f, -0.15, 0.07, zc + s * 0.29, 0.08, 1.93, 0.05, dark, { cast: true }); bx(c, M.paint, f, -0.13, 0.1, zc + s * 0.235, 0.06, 1.86, 0.04, "#3a3e43"); }
  bx(c, M.paint, f, -0.15, 1.94, zc, 0.09, 0.07, 0.64, yel); bx(c, M.paint, f, -0.17, 0.95, zc, 0.05, 0.06, 0.6, dark);
  cy(c, M.paint, f, -0.15, 0.12, zc, 0.045, 0.95, dark); cy(c, M.chrome, f, -0.15, 1.07, zc, 0.028, 0.5);
  bx(c, M.paint, f, -0.15, 1.57, zc, 0.07, 0.05, 0.3, dark);
  for (const s of [-1, 1]) { cy(c, M.galv, f, -0.15, 1.6, zc + s * 0.1 - 0.015, 0.045, 0.03, undefined, { rx: Math.PI / 2 }); bx(c, M.galv, f, -0.105, 0.36, zc + s * 0.1, 0.018, 1.24, 0.012); }
  // tela de proteção do operador (policarbonato com a grade)
  c.batch.add(ROOM, M.glass, BOX0(), L(f, -0.205, 0.97, zc, 0, 0.008, 0.95, 0.5));
  for (let k = 0; k < 4; k++) bx(c, M.paint, f, -0.2, 0.97, zc - 0.2 + k * 0.133, 0.006, 0.95, 0.006, dark);
  for (let j = 0; j < 5; j++) bx(c, M.paint, f, -0.2, 1.0 + j * 0.22, zc, 0.006, 0.006, 0.5, dark);
  // porta-garfos com o encosto de carga (grade) e os garfos baixados sobre as patolas
  bx(c, M.paint, f, -0.085, 0.08, zc, 0.04, 0.42, 0.62, dark);
  for (const s of [-1, 1]) bx(c, M.paint, f, -0.08, 0.5, zc + s * 0.29, 0.03, 0.7, 0.03, dark);
  for (const y of [0.74, 0.97, 1.17]) bx(c, M.paint, f, -0.08, y, zc, 0.03, 0.025, 0.61, dark);
  for (let k = 0; k < 4; k++) bx(c, M.paint, f, -0.08, 0.5, zc - 0.18 + k * 0.12, 0.02, 0.68, 0.02, dark);
  for (const s of [-1, 1]) {
    const z = zc + s * 0.17;
    bx(c, M.paint, f, -0.055, 0.1, z, 0.04, 0.38, 0.1, "#26282b");
    bx(c, M.paint, f, 0.37, 0.1, z, 0.86, 0.045, 0.1, "#26282b", { cast: true }); bx(c, M.paint, f, 0.82, 0.1, z, 0.04, 0.025, 0.1, "#26282b");
    bx(c, M.paint, f, 0.3, 0.015, z, 1.0, 0.08, 0.13, yel);                                                    // patola
    c.batch.add(ROOM, M.rubber, geo("doca-wheel", () => new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2)), L(f, 0.74, 0.04, z, Math.PI / 2, 0.1, 0.04, 0.04));
  }
  // roda de tração e rodízios estabilizadores sob o chassi
  c.batch.add(ROOM, M.rubber, geo("doca-wheel", () => new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2)), L(f, -0.5, 0.115, zc, Math.PI / 2, 0.08, 0.115, 0.115));
  for (const s of [-1, 1]) c.batch.add(ROOM, M.rubber, geo("doca-wheel", () => new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2)), L(f, -0.75, 0.05, zc + s * 0.25, Math.PI / 2, 0.04, 0.05, 0.05));
  // carregador: tomada industrial azul na parede (com eletroduto e tampa), plugue e o cabo saindo do conector do chassi
  bx(c, M.plastic, f, -0.45, 0.56, wall - 0.03, 0.12, 0.16, 0.06, "#1e5aa8"); bx(c, M.plastic, f, -0.45, 0.63, wall - 0.066, 0.1, 0.07, 0.012, "#174a8c");
  bx(c, M.plastic, f, -0.45, 0.46, wall - 0.035, 0.07, 0.1, 0.05, "#1e5aa8");
  bx(c, M.galv, f, -0.45, 0.72, wall - 0.015, 0.025, 1.3, 0.025);
  bx(c, M.plastic, f, -0.42, 0.48, zc + 0.335, 0.08, 0.07, 0.03, "#c62828");
  // (o cabo passa na frente do bate-carrinho de borracha da parede)
  const cable: [number, number, number][] = [[-0.42, 0.5, zc + 0.35], [-0.43, 0.22, zc + 0.36], [-0.45, 0.12, wall - 0.07], [-0.46, 0.36, wall - 0.075], [-0.45, 0.47, wall - 0.05]];
  for (let k = 0; k < cable.length - 1; k++) seg(c, M.plastic, f, cable[k], cable[k + 1], 0.011, "#151515");
}
