/*
 * MET Gala Heist v2 — mobiliário da avenida: mobiliário de rua com colisão — abrigo e placa de ônibus, banca de jornal, lixeira,
 * parquímetro, paraciclo com bicicletas, caixas de jornal e a placa de proibido estacionar.
 */
import * as THREE from "three";
import { boxGeo, lathe, tubeThrough } from "./exterior-geometry";
import { flyerUV, INT } from "./exterior-citytex";
import { add, iuv, type Parts, quadUV, T } from "./exterior-furniture-parts";

/* ---------- modelos (frente para +z; o móvel da planta dá o centro e o giro) ---------- */
/** Abrigo de ônibus de 4 m: a peça "busShelter" é a parede de vidro do fundo; o abrigo avança 1,4 m para a rua. */
export function busShelter(P: Parts, M: THREE.Matrix4) {
  const x0 = -2, x1 = 2, zb = 0, zf = 1.42;
  for (const x of [x0 + 0.05, x1 - 0.05]) add(P, "steel", boxGeo(x - 0.05, 0, zb - 0.05, x + 0.05, 2.5, zb + 0.05), M);
  add(P, "steel", boxGeo(x0 - 0.12, 2.42, zb - 0.12, x1 + 0.12, 2.5, zf + 0.12), M);                         // teto: quadro
  add(P, "glass", boxGeo(x0 - 0.06, 2.5, zb - 0.06, x1 + 0.06, 2.52, zf + 0.06), M);                         // teto: vidro
  add(P, "led", boxGeo(x0, 2.38, zf + 0.02, x1, 2.42, zf + 0.1), M);                                          // fita de LED na beira
  add(P, "glass", boxGeo(x0 + 0.1, 0.12, zb - 0.01, x1 - 0.1, 2.32, zb + 0.01), M);                           // fundo de vidro
  add(P, "steel", boxGeo(x0 + 0.1, 0.06, zb - 0.03, x1 - 0.1, 0.12, zb + 0.03), M); add(P, "steel", boxGeo(x0 + 0.1, 2.32, zb - 0.03, x1 - 0.1, 2.38, zb + 0.03), M);
  for (const x of [-0.65, 0.65]) add(P, "steel", boxGeo(x - 0.025, 0.12, zb - 0.03, x + 0.025, 2.32, zb + 0.03), M);
  add(P, "frost", boxGeo(x0 + 0.1, 1.42, zb + 0.012, x1 - 0.1, 1.5, zb + 0.016), M);                         // faixa jateada (para ninguém trombar)
  add(P, "glass", boxGeo(x0, 0.12, zb, x0 + 0.02, 2.32, 0.8), M);                                             // vidro lateral (oeste, meia profundidade)
  // painel de anúncio aceso (leste, dupla face) com o quadro de alumínio
  add(P, "steel", boxGeo(x1 - 0.16, 0.05, zb, x1, 2.38, zf), M);
  add(P, "ad", quadUV(zb + 0.08, 0.3, zf - 0.08, 2.25, 0, [0, 0, 1, 1]).rotateY(-Math.PI / 2).translate(x1 - 0.165, 0, 0), M);
  add(P, "ad", quadUV(zb + 0.08, 0.3, zf - 0.08, 2.25, 0, [0, 0, 1, 1]).rotateY(Math.PI / 2).translate(x1 + 0.005, 0, zf), M);
  // banco de ripas de madeira com os apoios de aço e o mapa da linha no vidro
  for (let k = 0; k < 4; k++) add(P, "wood", boxGeo(-1.3, 0.42, 0.08 + k * 0.085, 1.3, 0.46, 0.15 + k * 0.085), M);
  for (const x of [-1.15, 0, 1.15]) add(P, "steel", boxGeo(x - 0.03, 0, 0.08, x + 0.03, 0.42, 0.42), M);
  add(P, "routeMap", quadUV(-1.9, 1.0, -1.3, 1.85, zb + 0.03, [0, 0, 1, 1]), M);
}
export function busStopSign(P: Parts, M: THREE.Matrix4) {
  add(P, "steel", boxGeo(-0.035, 0, -0.035, 0.035, 2.9, 0.035), M);
  add(P, "busSign", quadUV(-0.3, 2.3, 0.3, 2.9, 0.04, [0, 0, 1, 1]), M); add(P, "busSign", quadUV(-0.3, 2.3, 0.3, 2.9, -0.04, [0, 0, 1, 1], true), M);
  add(P, "steel", boxGeo(-0.32, 2.28, -0.035, 0.32, 2.92, 0.035), M);
  add(P, "paintBlack", boxGeo(-0.18, 1.3, -0.07, 0.18, 1.85, 0.07), M);                                      // caixinha do horário
}
/** Banca de jornal 2,5 × 1,5 m: caixa de chapa verde, beiral, faixa com o nome, vitrine de revistas acesa e cartazes. */
export function newsstand(P: Parts, M: THREE.Matrix4, r: () => number) {
  const w = 2.5, d = 1.5, h = 2.35;
  add(P, "kiosk", boxGeo(-w / 2, 0, -d / 2, w / 2, 0.95, d / 2), M);
  add(P, "kiosk", boxGeo(-w / 2, 0.95, -d / 2, -w / 2 + 0.12, h, d / 2), M); add(P, "kiosk", boxGeo(w / 2 - 0.12, 0.95, -d / 2, w / 2, h, d / 2), M);
  add(P, "kiosk", boxGeo(-w / 2, 0.95, -d / 2, w / 2, h, -d / 2 + 0.1), M);
  add(P, "kiosk", boxGeo(-w / 2 - 0.2, h, -d / 2 - 0.15, w / 2 + 0.2, h + 0.14, d / 2 + 0.35), M);
  add(P, "kioskSign", quadUV(-w / 2 - 0.15, h + 0.16, w / 2 + 0.15, h + 0.56, d / 2 + 0.36, [0, 0, 1, 1]), M);
  add(P, "kiosk", boxGeo(-w / 2 - 0.18, h + 0.14, d / 2 + 0.3, w / 2 + 0.18, h + 0.6, d / 2 + 0.36), M);
  add(P, "inside", quadUV(-w / 2 + 0.12, 0.95, w / 2 - 0.12, h - 0.05, -d / 2 + 0.11, iuv(INT.magazines)), M);
  add(P, "inside", quadUV(-w / 2 + 0.15, 0.96, w / 2 - 0.15, 1.35, d / 2 - 0.02, iuv(INT.magazines)), M);   // revistas na frente, em pé no balcão
  add(P, "steel", boxGeo(-w / 2, 0.93, d / 2 - 0.05, w / 2, 0.97, d / 2 + 0.12), M);                          // balcão
  // cartazes colados nas laterais (lambe-lambe)
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
    const fz = -d / 2 + 0.1 + k * 0.33, fy = 1.05 + (k % 2) * 0.5, fw = 0.3;
    const q = quadUV(0, 0, fw, fw / 0.707, 0, flyerUV(Math.floor(r() * 16))); q.rotateY(sx * Math.PI / 2); q.translate(sx * (w / 2 + 0.003), fy, fz + (sx > 0 ? fw : 0));
    add(P, "poster", q, M);
  }
}
/** Lixeira de aço Ø 0,46 × 0,95 m: corpo de chapa com frisos verticais, anel, tampa abaulada com a boca e o saco preto. */
export function bin(P: Parts, M: THREE.Matrix4) {
  add(P, "binBody", lathe([[0, 0.02], [0.2, 0.02], [0.23, 0.08], [0.23, 0.8], [0.235, 0.82], [0.0, 0.82]], 20), M);
  for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; add(P, "binBody", boxGeo(-0.012, 0.12, 0.226, 0.012, 0.76, 0.246).rotateY(a), M); }
  add(P, "steel", lathe([[0.235, 0.82], [0.245, 0.84], [0.22, 0.9], [0.13, 0.95], [0.12, 0.92], [0.2, 0.86], [0.2, 0.83]], 20), M);
  add(P, "bag", lathe([[0, 0.83], [0.12, 0.84], [0.13, 0.9], [0.0, 0.88]], 10), M);
  add(P, "steel", lathe([[0, 0], [0.18, 0], [0.18, 0.02], [0, 0.02]], 16), M);
}
/** Parquímetro: haste e cabeça com o visor, a fenda das moedas e o adesivo do "P". */
export function meter(P: Parts, M: THREE.Matrix4) {
  add(P, "steel", boxGeo(-0.035, 0, -0.035, 0.035, 1.1, 0.035), M);
  add(P, "steel", boxGeo(-0.12, 1.1, -0.08, 0.12, 1.48, 0.08), M);
  add(P, "steel", lathe([[0, 1.48], [0.12, 1.48], [0.09, 1.54], [0, 1.56]], 12), M);
  add(P, "led", boxGeo(-0.07, 1.36, 0.08, 0.07, 1.42, 0.085), M);
  add(P, "paintBlue", boxGeo(-0.06, 1.16, 0.08, 0.06, 1.28, 0.084), M);
}
/** Paraciclo de 3 arcos (Ø 4,5 cm) com duas bicicletas presas. */
export function bikeRack(P: Parts, M: THREE.Matrix4) {
  for (const x of [-0.9, 0, 0.9]) add(P, "steel", tubeThrough([[x - 0.3, 0, 0], [x - 0.3, 0.7, 0], [x - 0.22, 0.85, 0], [x + 0.22, 0.85, 0], [x + 0.3, 0.7, 0], [x + 0.3, 0, 0]], 0.024, 18, 8), M);
  // bicicletas de perfil, ao lado dos arcos (rodas Ø 0,62 m, entre-eixos 1 m)
  for (const [x, flip] of [[-0.45, 0], [0.45, Math.PI]] as const) {
    const B = M.clone().multiply(T(x, 0, 0, flip));
    for (const zz of [-0.5, 0.5]) { add(P, "tire", new THREE.TorusGeometry(0.31, 0.022, 8, 28).rotateY(Math.PI / 2).translate(0, 0.33, zz), B); add(P, "steel", new THREE.TorusGeometry(0.28, 0.008, 4, 24).rotateY(Math.PI / 2).translate(0, 0.33, zz), B); }
    // quadro (diamante), garfo, guidão e selim
    add(P, "bikeFrame", tubeThrough([[0, 0.33, -0.5], [0, 0.5, 0.0], [0, 0.82, 0.38], [0, 0.33, 0.5]], 0.018, 10, 6), B);
    add(P, "bikeFrame", tubeThrough([[0, 0.33, -0.5], [0, 0.78, -0.12], [0, 0.82, 0.38]], 0.018, 8, 6), B);
    add(P, "bikeFrame", tubeThrough([[0, 0.5, 0.0], [0, 0.78, -0.12]], 0.018, 2, 6), B);
    add(P, "steel", tubeThrough([[-0.25, 0.98, 0.45], [0, 0.95, 0.42], [0.25, 0.98, 0.45]], 0.012, 6, 6), B);
    add(P, "steel", tubeThrough([[0, 0.82, 0.38], [0, 0.97, 0.43]], 0.014, 2, 6), B);
    add(P, "bag", boxGeo(-0.07, 0.86, -0.22, 0.07, 0.9, -0.02), B);
  }
}
/** Duas caixas de jornal (vermelha e azul) com a janela da primeira página. */
export function newsBoxes(P: Parts, M: THREE.Matrix4) {
  for (const [x, key] of [[-0.3, "paintRed"], [0.3, "paintBlue"]] as const) {
    add(P, key, boxGeo(x - 0.25, 0.08, -0.2, x + 0.25, 1.0, 0.2), M);
    add(P, "steel", boxGeo(x - 0.22, 0, -0.18, x + 0.22, 0.08, 0.18), M);
    add(P, "inside", quadUV(x - 0.18, 0.55, x + 0.18, 0.88, 0.205, iuv(INT.magazines)), M);
    add(P, "steel", boxGeo(x - 0.2, 0.52, 0.2, x + 0.2, 0.55, 0.22), M);
  }
}
/** Placa de proibido estacionar (evento) num poste fino. */
export function noParking(P: Parts, M: THREE.Matrix4) {
  add(P, "steel", boxGeo(-0.03, 0, -0.03, 0.03, 2.5, 0.03), M);
  add(P, "parkSign", quadUV(-0.25, 1.85, 0.25, 2.45, 0.035, [0, 0, 1, 1]), M); add(P, "parkSign", quadUV(-0.25, 1.85, 0.25, 2.45, -0.035, [0, 0, 1, 1], true), M);
}
