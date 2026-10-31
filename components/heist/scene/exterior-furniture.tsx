"use client";
/*
 * MET Gala Heist v2 — mobiliário da avenida. Com colisão (móveis "fixture" da rua em baseProps(), desenhados aqui pelo
 * `model`): o ponto de ônibus com abrigo (vidro, banco, painel de anúncio aceso, mapa da linha e a placa), a banca de
 * jornal, as lixeiras de aço, os parquímetros, o paraciclo com as bicicletas presas, as caixas de jornal, a placa de
 * proibido estacionar e os móveis únicos da entrada da gala (Z01): bancos esculpidos em granito com a inscrição, vasos
 * monumentais de pedra com buxo e a luz embutida, o painel de fotos com a treliça de alumínio e os refletores em tripé e o
 * balcão do manobrista com o quadro de chaves e o porta-guarda-chuvas. Sem colisão (fora da área andável): os semáforos
 * das esquinas com braço sobre a avenida, o armário do controlador cheio de lambe-lambe e as placas com o nome das ruas.
 *
 * Tudo é montado em coordenadas locais (frente para +z, chão em y = 0), levado ao mundo pelo móvel e fundido por material.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { floorY, SIDEWALK_Y } from "@/lib/heist/level";
import type { Prop } from "@/lib/heist/types";
import { boxGeo, lathe, merge, tubeThrough } from "./exterior-geometry";
import type { ExteriorMaterials } from "./exterior-materials";
import { bannerTex, inscriptionTex, leafTex, prng, signTex, SIGNAGE, type Quality } from "./exterior-textures";
import { cellUV, flyerAtlas, flyerUV, INT, INT_COLS, INT_ROWS, interiorAtlas, stepRepeatTex } from "./exterior-citytex";
import { GlowField, type GlowSpec } from "./exterior-glow";
import { CROSS } from "./exterior-blocks";
import type { Anchor, Pool } from "./exterior-blocks";

type Parts = Map<string, THREE.BufferGeometry[]>;
const add = (parts: Parts, key: string, g: THREE.BufferGeometry, M: THREE.Matrix4) => { g.applyMatrix4(M); const l = parts.get(key); if (l) l.push(g); else parts.set(key, [g]); };
const T = (x: number, y: number, z: number, ry = 0) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
/** Quad com UV dado, virado para +z (local). */
function quadUV(x0: number, y0: number, x1: number, y1: number, z: number, uv: [number, number, number, number], back = false) {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0); if (back) g.rotateY(Math.PI); g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
  const [u0, v0, u1, v1] = uv, a = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) a.setXY(i, u0 + a.getX(i) * (u1 - u0), v0 + a.getY(i) * (v1 - v0));
  return g;
}
const iuv = (k: number) => cellUV(k, INT_COLS, INT_ROWS);

/* ---------- modelos (frente para +z; o móvel da planta dá o centro e o giro) ---------- */
/** Abrigo de ônibus de 4 m: a peça "busShelter" é a parede de vidro do fundo; o abrigo avança 1,4 m para a rua. */
function busShelter(P: Parts, M: THREE.Matrix4) {
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
function busStopSign(P: Parts, M: THREE.Matrix4) {
  add(P, "steel", boxGeo(-0.035, 0, -0.035, 0.035, 2.9, 0.035), M);
  add(P, "busSign", quadUV(-0.3, 2.3, 0.3, 2.9, 0.04, [0, 0, 1, 1]), M); add(P, "busSign", quadUV(-0.3, 2.3, 0.3, 2.9, -0.04, [0, 0, 1, 1], true), M);
  add(P, "steel", boxGeo(-0.32, 2.28, -0.035, 0.32, 2.92, 0.035), M);
  add(P, "paintBlack", boxGeo(-0.18, 1.3, -0.07, 0.18, 1.85, 0.07), M);                                      // caixinha do horário
}
/** Banca de jornal 2,5 × 1,5 m: caixa de chapa verde, beiral, faixa com o nome, vitrine de revistas acesa e cartazes. */
function newsstand(P: Parts, M: THREE.Matrix4, r: () => number) {
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
function bin(P: Parts, M: THREE.Matrix4) {
  add(P, "binBody", lathe([[0, 0.02], [0.2, 0.02], [0.23, 0.08], [0.23, 0.8], [0.235, 0.82], [0.0, 0.82]], 20), M);
  for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; add(P, "binBody", boxGeo(-0.012, 0.12, 0.226, 0.012, 0.76, 0.246).rotateY(a), M); }
  add(P, "steel", lathe([[0.235, 0.82], [0.245, 0.84], [0.22, 0.9], [0.13, 0.95], [0.12, 0.92], [0.2, 0.86], [0.2, 0.83]], 20), M);
  add(P, "bag", lathe([[0, 0.83], [0.12, 0.84], [0.13, 0.9], [0.0, 0.88]], 10), M);
  add(P, "steel", lathe([[0, 0], [0.18, 0], [0.18, 0.02], [0, 0.02]], 16), M);
}
/** Parquímetro: haste e cabeça com o visor, a fenda das moedas e o adesivo do "P". */
function meter(P: Parts, M: THREE.Matrix4) {
  add(P, "steel", boxGeo(-0.035, 0, -0.035, 0.035, 1.1, 0.035), M);
  add(P, "steel", boxGeo(-0.12, 1.1, -0.08, 0.12, 1.48, 0.08), M);
  add(P, "steel", lathe([[0, 1.48], [0.12, 1.48], [0.09, 1.54], [0, 1.56]], 12), M);
  add(P, "led", boxGeo(-0.07, 1.36, 0.08, 0.07, 1.42, 0.085), M);
  add(P, "paintBlue", boxGeo(-0.06, 1.16, 0.08, 0.06, 1.28, 0.084), M);
}
/** Paraciclo de 3 arcos (Ø 4,5 cm) com duas bicicletas presas. */
function bikeRack(P: Parts, M: THREE.Matrix4) {
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
function newsBoxes(P: Parts, M: THREE.Matrix4) {
  for (const [x, key] of [[-0.3, "paintRed"], [0.3, "paintBlue"]] as const) {
    add(P, key, boxGeo(x - 0.25, 0.08, -0.2, x + 0.25, 1.0, 0.2), M);
    add(P, "steel", boxGeo(x - 0.22, 0, -0.18, x + 0.22, 0.08, 0.18), M);
    add(P, "inside", quadUV(x - 0.18, 0.55, x + 0.18, 0.88, 0.205, iuv(INT.magazines)), M);
    add(P, "steel", boxGeo(x - 0.2, 0.52, 0.2, x + 0.2, 0.55, 0.22), M);
  }
}
/** Placa de proibido estacionar (evento) num poste fino. */
function noParking(P: Parts, M: THREE.Matrix4) {
  add(P, "steel", boxGeo(-0.03, 0, -0.03, 0.03, 2.5, 0.03), M);
  add(P, "parkSign", quadUV(-0.25, 1.85, 0.25, 2.45, 0.035, [0, 0, 1, 1]), M); add(P, "parkSign", quadUV(-0.25, 1.85, 0.25, 2.45, -0.035, [0, 0, 1, 1], true), M);
}

/* ---------- móveis únicos da entrada (Z01) ---------- */
/** Banco esculpido de granito 2,4 × 0,6 × 0,45: assento com a borda boleada sobre dois blocos recuados e a inscrição. */
function stoneBench(P: Parts, M: THREE.Matrix4) {
  const sh = new THREE.Shape(); const w = 1.2, d = 0.3;
  sh.moveTo(-w, -d); sh.lineTo(w, -d); sh.quadraticCurveTo(w + 0.06, -d, w + 0.06, -d + 0.06); sh.lineTo(w + 0.06, d - 0.06); sh.quadraticCurveTo(w + 0.06, d, w, d); sh.lineTo(-w, d); sh.quadraticCurveTo(-w - 0.06, d, -w - 0.06, d - 0.06); sh.lineTo(-w - 0.06, -d + 0.06); sh.quadraticCurveTo(-w - 0.06, -d, -w, -d);
  const seat = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 6 });
  seat.rotateX(-Math.PI / 2); seat.translate(0, 0.31, 0);
  add(P, "granite", seat, M);
  for (const x of [-0.75, 0.75]) add(P, "granite", boxGeo(x - 0.28, 0, -0.22, x + 0.28, 0.31, 0.22), M);
  add(P, "inscription", quadUV(-0.9, 0.36, 0.9, 0.44, 0.335, [0, 0, 1, 1]), M);
}
/** Vaso monumental de pedra (Ø 0,9 × 1,2 m) com o buxo podado em bola e a luz embutida no chão. */
function urn(P: Parts, M: THREE.Matrix4, leaves: THREE.Matrix4[], r: () => number) {
  add(P, "stone", lathe([[0, 0], [0.42, 0], [0.42, 0.12], [0.36, 0.16], [0.2, 0.2], [0.17, 0.32], [0.24, 0.38], [0.38, 0.55], [0.45, 0.86], [0.47, 0.98], [0.43, 1.02], [0.42, 1.06], [0, 1.06]], 28), M);
  add(P, "soil", lathe([[0, 1.02], [0.41, 1.02], [0, 1.03]], 16), M);
  for (let k = 0; k < 90; k++) { const u = r() * Math.PI * 2, v = Math.acos(2 * r() - 1), rr = 0.42 + r() * 0.06; leaves.push(M.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(v) * Math.cos(u) * rr, 1.5 + Math.cos(v) * rr, Math.sin(v) * Math.sin(u) * rr), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6)), new THREE.Vector3(0.28, 0.28, 0.28)))); }
  add(P, "steel", lathe([[0, 0.005], [0.09, 0.005], [0.09, 0.02], [0, 0.02]], 14).translate(0.62, 0, 0.35), M);
  add(P, "led", lathe([[0, 0.02], [0.06, 0.02], [0, 0.022]], 12).translate(0.62, 0, 0.35), M);
}
/** Totem da gala (Ø 0,3 × 1,05 m): coluna de latão escovado com a face de vidro acesa e a inscrição. */
function totem(P: Parts, M: THREE.Matrix4) {
  add(P, "brass", lathe([[0, 0], [0.2, 0], [0.2, 0.03], [0.15, 0.05], [0.15, 1.0], [0.16, 1.02], [0.16, 1.05], [0, 1.05]], 20), M);
  add(P, "totemFace", quadUV(-0.11, 0.45, 0.11, 0.95, 0.151, [0, 0, 1, 1]), M);
}
/** Painel de fotos 3 × 2,4 m em treliça de alumínio: duas torres treliçadas, travessa, lona com os logotipos, sapatas e
 * sacos de areia. Frente para +z (para a calçada). */
function stepRepeat(P: Parts, M: THREE.Matrix4) {
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
function lightStand(P: Parts, M: THREE.Matrix4) {
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; add(P, "steel", tubeThrough([[0, 0.9, 0], [Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32]], 0.012, 1, 5), M); }
  add(P, "steel", boxGeo(-0.015, 0.9, -0.015, 0.015, 2.2, 0.015), M);
  const box = lathe([[0, 0], [0.42, 0.12], [0.45, 0.16], [0, 0.16]], 8); box.rotateX(-Math.PI / 2 - 0.4); box.translate(0, 2.25, 0);
  add(P, "paintBlack", box, M);
  add(P, "led", lathe([[0, 0], [0.41, 0.12], [0, 0.121]], 8).rotateX(-Math.PI / 2 - 0.4).translate(0, 2.25, 0.004), M);
}
/** Balcão do manobrista (1,2 × 0,6 × 1,1 m): púlpito laqueado com friso de latão, o quadro de chaves com porta de vidro,
 * a luminária, a placa e o porta-guarda-chuvas com três guarda-chuvas. */
function valetStand(P: Parts, M: THREE.Matrix4) {
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

/* ---------- fora da área andável: semáforos, controlador e placas de rua ---------- */
/** Semáforo de esquina: coluna, braço de `arm` m (o −z local aponta o braço) e duas cabeças viradas para o rumo `face`
 * (giro no mundo); semáforo de pedestre com a mão vermelha e as placas com os nomes das ruas. */
function signal(P: Parts, x: number, z: number, armYaw: number, face: number, arm: number, glows: GlowSpec[]) {
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
function cabinet(P: Parts, M: THREE.Matrix4, r: () => number) {
  add(P, "cabinet", boxGeo(-0.4, 0, -0.25, 0.4, 1.35, 0.25), M);
  add(P, "cabinet", boxGeo(-0.43, 1.35, -0.28, 0.43, 1.4, 0.28), M);
  for (let k = 0; k < 7; k++) { const fw = 0.24 + r() * 0.08, fx = -0.38 + r() * (0.76 - fw), fy = 0.25 + r() * 0.75; add(P, "poster", quadUV(fx, fy, fx + fw, fy + fw / 0.707, 0.252 + k * 0.001, flyerUV(Math.floor(r() * 16))), M); }
}

/* ---------- textos pintados ---------- */
/** Mapa da linha no abrigo: o traçado das quatro linhas, os pontos e o "você está aqui". */
function routeMapTex(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = 256; c.height = 360; const g = c.getContext("2d")!;
  g.fillStyle = "#f4f2ec"; g.fillRect(0, 0, 256, 360); g.fillStyle = "#123a6b"; g.fillRect(0, 0, 256, 44);
  g.fillStyle = "#ffffff"; g.font = "700 22px Arial, sans-serif"; g.textAlign = "center"; g.fillText("LINHAS NOTURNAS", 128, 30);
  const r = prng(88), cols = ["#e0201c", "#1d6fd1", "#f2a900", "#2e9e4f"];
  cols.forEach((col, k) => { g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); let x = 30 + k * 10, y = 70; g.moveTo(x, y); for (let s = 0; s < 6; s++) { x = Math.min(226, Math.max(30, x + (r() - 0.5) * 80)); y += 45; g.lineTo(x, y); } g.stroke(); });
  for (let k = 0; k < 14; k++) { g.fillStyle = "#ffffff"; g.strokeStyle = "#222"; g.lineWidth = 2; g.beginPath(); g.arc(30 + r() * 196, 70 + r() * 260, 5, 0, Math.PI * 2); g.fill(); g.stroke(); }
  g.fillStyle = "#e0201c"; g.beginPath(); g.arc(128, 200, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = "#111"; g.font = "600 13px Arial, sans-serif"; g.fillText("VOCÊ ESTÁ AQUI", 128, 226);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function useTextures(q: Quality) {
  return useMemo(() => ({
    ad: bannerTex(q, "lumiere"),
    busSign: signTex("bus-stop", ["PONTO DE ÔNIBUS", "207 · 315 · 422 · NOTURNO N12"], { w: 256, h: 256, bg: "#123a6b", ink: "#ffffff", font: "sans" }),
    kioskSign: signTex("kiosk", ["BANCA DA AVENIDA", "JORNAIS · REVISTAS · CIGARROS · BALAS"], { w: 768, h: 128, bg: "#0f3d2a", ink: "#f3e9c8", font: "sans" }),
    parkSign: signTex("no-parking", ["PROIBIDO ESTACIONAR", "EVENTO · 18H ÀS 4H", "GUINCHO"], { w: 256, h: 320, bg: "#f2f2f2", ink: "#c1121f", font: "sans", border: "#c1121f" }),
    valetSign: signTex("valet", ["MANOBRISTA", "GALA LUMIÈRE"], { w: 512, h: 256, bg: "#0c0b0a", ink: "#d9b779", font: "serif", border: "#b8913f" }),
    totem: signTex("totem", ["GALA", "LUMIÈRE", "CONVIDADOS"], { w: 192, h: 448, bg: "#0c0b0a", ink: "#e8cf96", font: "serif" }),
    street: signTex("street-names", [SIGNAGE.avenue, SIGNAGE.street], { w: 512, h: 192, bg: "#0f5a32", ink: "#ffffff", font: "sans", border: "#ffffff" }),
    inscription: inscriptionTex(q, "MUSEU VESPER · MCMXXXI"),
    routeMap: routeMapTex(),
  }), [q]);
}

/** Luz e brilho próprios do mobiliário (âncoras para a luz de verdade, halos e poças). */
export function furnitureLights(props: Prop[]): { anchors: Anchor[]; glows: GlowSpec[]; pools: Pool[] } {
  const anchors: Anchor[] = [], glows: GlowSpec[] = [], pools: Pool[] = [];
  for (const p of props) {
    if (p.kind !== "fixture") continue;
    const c = p.shape.type === "box" ? { x: (p.shape.x0 + p.shape.x1) / 2, z: (p.shape.z0 + p.shape.z1) / 2 } : { x: p.shape.x, z: p.shape.z }, y = floorY(c), yaw = p.yaw ?? 0;
    const fwd = (d: number, h: number) => new THREE.Vector3(c.x + Math.sin(yaw) * d, y + h, c.z + Math.cos(yaw) * d);
    if (p.model === "busShelter") { anchors.push({ pos: fwd(0.7, 2.2), color: "#eef4ff", i: 14 }); glows.push({ pos: fwd(1.45, 2.4), size: 2.6, color: "#e8f0ff", strength: 0.45 }); pools.push({ pos: fwd(0.9, 0), rx: 2.4, rz: 1.6, color: "#e8f0ff", s: 0.16, rot: yaw }); }
    if (p.model === "newsstand") { anchors.push({ pos: fwd(1.2, 1.9), color: "#fff0d0", i: 12 }); pools.push({ pos: fwd(1.5, 0), rx: 1.8, rz: 1.4, color: "#ffe2b0", s: 0.16, rot: yaw }); }
    if (p.model === "monumentalVase") glows.push({ pos: new THREE.Vector3(c.x + 0.62, y + 0.05, c.z + 0.35), size: 0.6, color: "#ffd9a0", strength: 0.7 });
    if (p.model === "stepRepeat") anchors.push({ pos: fwd(2.4, 2.3), color: "#f4f6ff", i: 20 });
  }
  return { anchors, glows, pools };
}

export function HeistFurniture({ props, m, q }: { props: Prop[]; m: ExteriorMaterials; q: Quality }) {
  const tex = useTextures(q);
  const data = useMemo(() => {
    const P: Parts = new Map(), leaves: THREE.Matrix4[] = [], glows: GlowSpec[] = [], r = prng(707);
    for (const p of props) {
      if (p.kind !== "fixture" || !p.model) continue;
      const c = p.shape.type === "box" ? { x: (p.shape.x0 + p.shape.x1) / 2, z: (p.shape.z0 + p.shape.z1) / 2 } : { x: p.shape.x, z: p.shape.z };
      const M = T(c.x, floorY(c), c.z, p.yaw ?? 0);
      switch (p.model) {
        case "busShelter": busShelter(P, M); break;
        case "busStopSign": busStopSign(P, M); break;
        case "newsstand": newsstand(P, M, r); break;
        case "bin": bin(P, M); break;
        case "meter": meter(P, M); break;
        case "bikeRack": bikeRack(P, M); break;
        case "newsBox": newsBoxes(P, M); break;
        case "noParking": noParking(P, M); break;
        case "stoneBench": stoneBench(P, M); break;
        case "monumentalVase": urn(P, M, leaves, r); break;
        case "stepRepeat": stepRepeat(P, M); break;
        case "lightStand": lightStand(P, M); break;
        case "valetStand": valetStand(P, M); break;
        default: break;                                                            // peças só de colisão (lateral do abrigo, banco)
      }
    }
    // totens acesos no portão do tapete (dentro dos cordões: sem colisão nova)
    for (const x of [-1.95, 1.95]) totem(P, T(x, floorY({ x, z: 31.25 }), 31.25, 0));
    // semáforos das esquinas (braço sobre a avenida) e o armário do controlador
    signal(P, CROSS[0].walk1 - 0.6, 43.7, 0, Math.PI / 2, 7.5, glows);              // braço para o norte, luzes para o leste (para a rua)
    signal(P, CROSS[1].walk0 + 0.6, 43.7, 0, -Math.PI / 2, 7.5, glows);
    signal(P, CROSS[0].road0 - 1.2, 32.6, Math.PI, Math.PI / 2, 4.5, glows);
    cabinet(P, T(CROSS[0].walk1 - 1.1, SIDEWALK_Y, 45.2, Math.PI / 2), r);
    const merged = new Map<string, THREE.BufferGeometry>(); for (const [k, l] of P) merged.set(k, merge(l));
    return { merged, leaves, glows };
  }, [props]);
  const mats = useMemo<Record<string, THREE.Material>>(() => {
    const em = (c: string, i: number) => new THREE.MeshStandardMaterial({ color: "#111111", emissive: new THREE.Color(c), emissiveIntensity: i, roughness: 0.4 });
    const pic = (t: THREE.Texture, glow = 0, rough = 0.6) => new THREE.MeshStandardMaterial({ map: t, emissiveMap: glow ? t : null, emissive: new THREE.Color(glow ? "#ffffff" : "#000000"), emissiveIntensity: glow, roughness: rough });
    const step = stepRepeatTex(q).clone(); step.repeat.set(1, 1); step.needsUpdate = true;
    return {
      steel: new THREE.MeshStandardMaterial({ color: "#3b4046", roughness: 0.38, metalness: 0.75 }), alu: m.aluminium, routeMap: pic(tex.routeMap, 0.55, 0.3), glass: new THREE.MeshStandardMaterial({ color: "#9fb4c0", roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false, envMapIntensity: 1.4 }),
      frost: new THREE.MeshStandardMaterial({ color: "#e8eef2", roughness: 0.6, transparent: true, opacity: 0.55 }), led: em("#eef4ff", 4), wood: new THREE.MeshStandardMaterial({ color: "#6a4a30", roughness: 0.55 }),
      ad: pic(tex.ad, 0.9, 0.3), busSign: pic(tex.busSign, 0.25), kiosk: new THREE.MeshStandardMaterial({ color: "#1f3d2c", roughness: 0.55, metalness: 0.4 }), kioskSign: pic(tex.kioskSign, 0.6, 0.4),
      inside: new THREE.MeshBasicMaterial({ map: interiorAtlas(q) }), poster: new THREE.MeshStandardMaterial({ map: flyerAtlas(q), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }),
      binBody: new THREE.MeshStandardMaterial({ color: "#21302a", roughness: 0.5, metalness: 0.55 }), bag: new THREE.MeshStandardMaterial({ color: "#0b0b0c", roughness: 0.35 }),
      paintBlue: new THREE.MeshStandardMaterial({ color: "#1d4f9a", roughness: 0.45, metalness: 0.3 }),
      paintRed: new THREE.MeshStandardMaterial({ color: "#a3161d", roughness: 0.45, metalness: 0.3 }), paintBlack: new THREE.MeshStandardMaterial({ color: "#151617", roughness: 0.45, metalness: 0.5 }),
      tire: m.rubber, bikeFrame: new THREE.MeshStandardMaterial({ color: "#2f6a8a", roughness: 0.35, metalness: 0.5 }), parkSign: pic(tex.parkSign, 0.05),
      granite: m.granite, inscription: new THREE.MeshStandardMaterial({ map: tex.inscription, transparent: true, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }),
      stone: m.stone, soil: m.soil, brass: m.brass, totemFace: pic(tex.totem, 0.9, 0.3), step: new THREE.MeshStandardMaterial({ map: step, roughness: 0.75 }),
      carpetPatch: m.carpet, lacquer: new THREE.MeshPhysicalMaterial({ color: "#060606", roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
      valetSign: pic(tex.valetSign, 0.35, 0.4),
      sigRed: em("#ff2418", 5), sigOff: new THREE.MeshStandardMaterial({ color: "#1a1410", roughness: 0.2 }), streetSign: pic(tex.street, 0.12, 0.45),
      cabinet: new THREE.MeshStandardMaterial({ color: "#8a9096", roughness: 0.5, metalness: 0.5 }),
    };
  }, [q, m, tex]);
  const leafMat = useMemo(() => new THREE.MeshStandardMaterial({ map: leafTex(q, "dark"), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: new THREE.Color("#7f9466") }), [q]);
  const leafGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const leafMesh = useMemo(() => {
    const im = new THREE.InstancedMesh(leafGeo, leafMat, Math.max(1, data.leaves.length));
    data.leaves.forEach((x, i) => im.setMatrixAt(i, x)); im.count = data.leaves.length; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; return im;
  }, [data, leafGeo, leafMat]);
  const castKeys = new Set(["steel", "kiosk", "binBody", "granite", "stone", "lacquer", "alu", "paintBlack", "wood", "paintRed", "paintBlue"]);
  return (
    <group>
      {[...data.merged.entries()].map(([k, g]) => <mesh key={k} geometry={g} material={mats[k] ?? m.galvanized} castShadow={q === "high" && castKeys.has(k)} receiveShadow renderOrder={k === "glass" || k === "frost" ? 2 : 0} />)}
      <primitive object={leafMesh} />
      <GlowField items={data.glows} />
    </group>
  );
}
