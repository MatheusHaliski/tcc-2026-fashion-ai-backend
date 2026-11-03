/*
 * MET Gala Heist v2 — mobiliário da avenida: móveis únicos da entrada da gala (Z01) — banco de granito, vaso monumental com buxo, totem,
 * painel de fotos, refletor em tripé e o balcão do manobrista.
 */
import * as THREE from "three";
import { boxGeo, lathe, tubeThrough } from "./exterior-geometry";
import { add, type Parts, quadUV } from "./exterior-furniture-parts";

/* ---------- móveis únicos da entrada (Z01) ---------- */
/** Banco esculpido de granito 2,4 × 0,6 × 0,45: assento com a borda boleada sobre dois blocos recuados e a inscrição. */
export function stoneBench(P: Parts, M: THREE.Matrix4) {
  const sh = new THREE.Shape(); const w = 1.2, d = 0.3;
  sh.moveTo(-w, -d); sh.lineTo(w, -d); sh.quadraticCurveTo(w + 0.06, -d, w + 0.06, -d + 0.06); sh.lineTo(w + 0.06, d - 0.06); sh.quadraticCurveTo(w + 0.06, d, w, d); sh.lineTo(-w, d); sh.quadraticCurveTo(-w - 0.06, d, -w - 0.06, d - 0.06); sh.lineTo(-w - 0.06, -d + 0.06); sh.quadraticCurveTo(-w - 0.06, -d, -w, -d);
  const seat = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 6 });
  seat.rotateX(-Math.PI / 2); seat.translate(0, 0.31, 0);
  add(P, "granite", seat, M);
  for (const x of [-0.75, 0.75]) add(P, "granite", boxGeo(x - 0.28, 0, -0.22, x + 0.28, 0.31, 0.22), M);
  add(P, "inscription", quadUV(-0.9, 0.36, 0.9, 0.44, 0.335, [0, 0, 1, 1]), M);
}
/** Vaso monumental de pedra (Ø 0,9 × 1,2 m) com o buxo podado em bola e a luz embutida no chão. */
export function urn(P: Parts, M: THREE.Matrix4, leaves: THREE.Matrix4[], r: () => number) {
  add(P, "stone", lathe([[0, 0], [0.42, 0], [0.42, 0.12], [0.36, 0.16], [0.2, 0.2], [0.17, 0.32], [0.24, 0.38], [0.38, 0.55], [0.45, 0.86], [0.47, 0.98], [0.43, 1.02], [0.42, 1.06], [0, 1.06]], 28), M);
  add(P, "soil", lathe([[0, 1.02], [0.41, 1.02], [0, 1.03]], 16), M);
  for (let k = 0; k < 90; k++) { const u = r() * Math.PI * 2, v = Math.acos(2 * r() - 1), rr = 0.42 + r() * 0.06; leaves.push(M.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(v) * Math.cos(u) * rr, 1.5 + Math.cos(v) * rr, Math.sin(v) * Math.sin(u) * rr), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6)), new THREE.Vector3(0.28, 0.28, 0.28)))); }
  add(P, "steel", lathe([[0, 0.005], [0.09, 0.005], [0.09, 0.02], [0, 0.02]], 14).translate(0.62, 0, 0.35), M);
  add(P, "led", lathe([[0, 0.02], [0.06, 0.02], [0, 0.022]], 12).translate(0.62, 0, 0.35), M);
}
/** Totem da gala (Ø 0,3 × 1,05 m): coluna de latão escovado com a face de vidro acesa e a inscrição. */
export function totem(P: Parts, M: THREE.Matrix4) {
  add(P, "brass", lathe([[0, 0], [0.2, 0], [0.2, 0.03], [0.15, 0.05], [0.15, 1.0], [0.16, 1.02], [0.16, 1.05], [0, 1.05]], 20), M);
  add(P, "totemFace", quadUV(-0.11, 0.45, 0.11, 0.95, 0.151, [0, 0, 1, 1]), M);
}
/** Painel de fotos 3 × 2,4 m em treliça de alumínio: duas torres treliçadas, travessa, lona com os logotipos, sapatas e
 * sacos de areia. Frente para +z (para a calçada). */
export function stepRepeat(P: Parts, M: THREE.Matrix4) {
  const tower = (x: number) => {
    for (const [dx, dz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) add(P, "alu", boxGeo(x + dx - 0.02, 0.06, dz - 0.02, x + dx + 0.02, 2.75, dz + 0.02), M);
    for (let y = 0.1; y < 2.7; y += 0.3) for (const [a, b] of [[[-0.14, -0.14], [0.14, -0.14]], [[0.14, -0.14], [0.14, 0.14]], [[0.14, 0.14], [-0.14, 0.14]], [[-0.14, 0.14], [-0.14, -0.14]]]) add(P, "alu", tubeThrough([[x + a[0], y, a[1]], [x + b[0], y + 0.15, b[1]]], 0.008, 1, 4), M);
    add(P, "steel", boxGeo(x - 0.32, 0, -0.32, x + 0.32, 0.06, 0.32), M);
    add(P, "bag", boxGeo(x - 0.28, 0.06, 0.12, x + 0.12, 0.2, 0.32), M);
  };
  tower(-1.62); tower(1.62);
  for (const y of [2.62, 2.9]) for (const z of [-0.14, 0.14]) add(P, "alu", boxGeo(-1.62, y - 0.02, z - 0.02, 1.62, y + 0.02, z + 0.02), M);
  add(P, "step", quadUV(-1.5, 0.15, 1.5, 2.55, 0.02, [0, 0, 1, 1]), M);
  add(P, "kiosk", quadUV(-1.5, 0.15, 1.5, 2.55, -0.02, [0, 0, 1, 1], true), M);
  // tapete vermelho na frente, onde se posa
  add(P, "carpetPatch", boxGeo(-1.6, 0, 0.35, 1.6, 0.012, 1.95), M);
}
/** Refletor de foto em tripé com a sombrinha difusora (luz fria). */
export function lightStand(P: Parts, M: THREE.Matrix4) {
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; add(P, "steel", tubeThrough([[0, 0.9, 0], [Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32]], 0.012, 1, 5), M); }
  add(P, "steel", boxGeo(-0.015, 0.9, -0.015, 0.015, 2.2, 0.015), M);
  const box = lathe([[0, 0], [0.42, 0.12], [0.45, 0.16], [0, 0.16]], 8); box.rotateX(-Math.PI / 2 - 0.4); box.translate(0, 2.25, 0);
  add(P, "paintBlack", box, M);
  add(P, "led", lathe([[0, 0], [0.41, 0.12], [0, 0.121]], 8).rotateX(-Math.PI / 2 - 0.4).translate(0, 2.25, 0.004), M);
}
/** Balcão do manobrista (1,2 × 0,6 × 1,1 m): púlpito laqueado com friso de latão, o quadro de chaves com porta de vidro,
 * a luminária, a placa e o porta-guarda-chuvas com três guarda-chuvas. */
export function valetStand(P: Parts, M: THREE.Matrix4) {
  add(P, "lacquer", boxGeo(-0.45, 0, -0.25, 0.45, 1.05, 0.25), M);
  add(P, "brass", boxGeo(-0.48, 1.05, -0.28, 0.48, 1.09, 0.28), M);
  add(P, "brass", boxGeo(-0.46, 0.08, -0.26, 0.46, 0.11, 0.26), M);
  add(P, "lacquer", boxGeo(-0.3, 1.09, -0.25, 0.3, 1.6, -0.12), M);                                          // quadro de chaves
  add(P, "glass", boxGeo(-0.27, 1.12, -0.12, 0.27, 1.57, -0.11), M);
  for (let k = 0; k < 12; k++) add(P, "brass", boxGeo(-0.22 + (k % 6) * 0.088, 1.45 - Math.floor(k / 6) * 0.18, -0.2, -0.2 + (k % 6) * 0.088, 1.47 - Math.floor(k / 6) * 0.18, -0.12), M);
  add(P, "valetSign", quadUV(-0.4, 0.45, 0.4, 0.85, 0.252, [0, 0, 1, 1]), M);
  add(P, "brass", tubeThrough([[0.35, 1.09, -0.15], [0.35, 1.4, -0.15], [0.28, 1.48, -0.05]], 0.012, 8, 6), M);
  add(P, "led", boxGeo(0.22, 1.43, -0.08, 0.32, 1.47, 0.02), M);
  // porta-guarda-chuvas (cilindro de latão) com três guarda-chuvas fechados
  add(P, "brass", lathe([[0, 0], [0.13, 0], [0.13, 0.55], [0.12, 0.56], [0.12, 0.02], [0, 0.02]], 14).translate(0.68, 0, 0.05), M);
  for (let k = 0; k < 3; k++) { const a = k * 2.1; add(P, "paintBlack", lathe([[0, 0.1], [0.035, 0.5], [0.045, 0.8], [0.012, 0.9], [0, 0.95]], 8).translate(0.68 + Math.cos(a) * 0.05, 0, 0.05 + Math.sin(a) * 0.05), M); }
}
