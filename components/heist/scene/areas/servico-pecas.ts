/*
 * MET Gala Heist v2 — peças técnicas da área de serviço (labirinto, copa, segurança e bastidores), cada uma com a forma e
 * a medida da peça real: luminária estanque, sprinkler, detector de fumaça, câmera de vigilância, extintor no suporte
 * com a placa e a demarcação de piso, abrigo de hidrante, acionador manual de alarme, luz de emergência, relógio,
 * para-choque (bate-maca) e cantoneira de inox, lixeira com pedal, cavalete de piso molhado, pia de lavar as mãos com os
 * dispensers, e a cortina de tiras de PVC. Tudo em lotes (geometria mesclada por material) e instâncias.
 */
import * as THREE from "three";
import { BOX0, CYL, CYL0, SPH, geo, mat, mul } from "../interior-batch";
import { glow } from "../interior-mats";
import type { InteriorCopy } from "../interior-copy";
import type { Quality } from "../interior-tex";
import { Fr, SM, lathe, rbox, sign, signOn, tube, xyz, type Sink, type WCorner, type WFace } from "./servico-kit";

type C = Sink & { q: Quality; copy: InteriorCopy };

/** Luminária estanque linear (1,27 m): base de policarbonato cinza, difusor leitoso aceso, tampas e presilhas de inox. */
export function vaporTight(c: C, room: string, x: number, y: number, z: number, alongX: boolean, warm = false, diffuser?: THREE.Material) {
  const S = SM(c.q), f = Fr.at(c, room, x, y, z, alongX ? 0 : Math.PI / 2);
  f.i("srv-lumBody", rbox(1.27, 0.06, 0.1, 0.02), S.plasticGrey, 0, -0.06, 0);
  f.i(diffuser ? `srv-lumDiff-${diffuser.uuid}` : warm ? "srv-lumDiffW" : "srv-lumDiff", geo("srv-lumDiffGeo", () => new THREE.CylinderGeometry(0.05, 0.05, 1.18, 14, 1, false, Math.PI, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.7, 1)), diffuser ?? (warm ? S.opalWarm : S.opal), 0, -0.06, 0);
  for (const s of [-1, 1]) {
    f.i("srv-lumCap", rbox(0.05, 0.075, 0.105, 0.015), S.plasticGrey, s * 0.61, -0.085, 0);
    for (const k of [-0.32, 0.32]) f.i("srv-lumClip", BOX0(), S.inox, k, -0.085, s * 0.053, 0, 0.03, 0.075, 0.004);
  }
  f.i("srv-lumBracket", BOX0(), S.galv, -0.4, -0.006, 0, 0, 0.06, 0.006, 0.08); f.i("srv-lumBracket", BOX0(), S.galv, 0.4, -0.006, 0, 0, 0.06, 0.006, 0.08);
}
/** Sprinkler pendente no forro: canopla cromada, corpo, ampola vermelha e defletor. */
export function sprinkler(c: C, room: string, x: number, y: number, z: number) {
  const S = SM(c.q), f = Fr.at(c, room, x, y, z);
  f.i("srv-sprEsc", CYL(16), S.chrome, 0, -0.004, 0, 0, 0.042, 0.008, 0.042);
  f.i("srv-sprBody", lathe("sprBody2", [[0, -0.05], [0.006, -0.05], [0.006, -0.03], [0.012, -0.018], [0.012, 0], [0, 0]], 10), S.brass, 0, -0.006, 0);
  f.i("srv-sprBulb", CYL(8), glow("srv-sprBulb", "#e0242b", 1.2), 0, -0.04, 0, 0, 0.0035, 0.018, 0.0035);
  f.i("srv-sprDef", CYL(12), S.brass, 0, -0.058, 0, 0, 0.018, 0.002, 0.018);
}
/** Detector de fumaça óptico: base boleada branca e LED vermelho. */
export function smokeDetector(c: C, room: string, x: number, y: number, z: number) {
  const S = SM(c.q), f = Fr.at(c, room, x, y, z);
  f.i("srv-smoke", lathe("smokeDet2", [[0, -0.043], [0.03, -0.042], [0.055, -0.034], [0.062, -0.012], [0.06, 0]], 18), S.plasticWhite, 0, 0, 0);
  f.i("srv-ledRed", SPH(6), glow("srv-ledRedS", "#ff2b2b", 2.2), 0.022, -0.036, 0, 0, 0.004);
}
/** Câmera de vigilância tipo bala no suporte de parede (aponta para `yaw` e um pouco para baixo). */
export function cctvCam(c: C, room: string, x: number, y: number, z: number, wallYaw: number, aimYaw: number) {
  const S = SM(c.q), w = Fr.at(c, room, x, y, z, wallYaw);
  w.box(S.plasticWhite, 0, -0.06, 0.01, 0.09, 0.12, 0.02);
  w.cylZ(S.plasticWhite, 0, 0, 0.09, 0.012, 0.16, 8);
  const h = Fr.at(c, room, ...xyz(w.p(0, -0.02, 0.18)), aimYaw).sub(0, 0, 0, 0, 0.35);
  h.rbox(S.plasticWhite, 0, -0.04, 0.02, 0.085, 0.08, 0.22, 0.02);
  h.box(S.plasticWhite, 0, 0.042, 0.04, 0.1, 0.006, 0.26);
  h.cylZ(S.glassDark, 0, 0.0, 0.135, 0.028, 0.012, 14);
  h.i("srv-ledRed", SPH(6), glow("srv-ledRedS", "#ff2b2b", 2.2), 0.03, 0.025, 0.13, 0, 0.004);
}
/** Extintor de pó ABC (6 kg) no suporte de parede, com a placa acima e a demarcação de piso vermelha e amarela.
 * (x, z) = ponto da parede, `ry` = direção para onde a parede olha. */
export function extinguisher(c: C, room: string, x: number, z: number, ry: number, floorMark = true) {
  const S = SM(c.q), f = Fr.at(c, room, x, 0, z, ry);
  f.box(S.steelBlack, 0, 1.05, 0.012, 0.09, 0.42, 0.024);                                   // suporte
  f.box(S.steelBlack, 0, 1.18, 0.07, 0.18, 0.03, 0.1);
  const b = f.sub(0, 0.98, 0.11);
  b.g(S.paintRed, lathe("extBody", [[0, 0], [0.074, 0], [0.08, 0.02], [0.08, 0.44], [0.07, 0.49], [0.04, 0.52], [0.022, 0.53], [0, 0.53]], 22), 0, 0, 0, 0, 1, 1, 1, 0, 0, true);
  b.cyl(S.paper, 0, 0.16, 0, 0.0805, 0.16, 22);                                             // rótulo
  b.cyl(S.chrome, 0, 0.53, 0, 0.022, 0.05, 12);                                             // válvula
  b.box(S.chrome, -0.035, 0.575, 0, 0.12, 0.012, 0.03, 0); b.box(S.plasticBlack, 0.0, 0.6, 0, 0.13, 0.012, 0.028, 0, false);
  b.cylZ(S.plasticWhite, 0.03, 0.555, 0.025, 0.017, 0.012, 14); b.cylZ(glow("srv-gaugeGreen", "#3fd16b", 1.1), 0.03, 0.555, 0.032, 0.006, 0.002, 8);
  b.g(S.rubber, tube([[0.02, 0.55, 0], [0.11, 0.5, 0.02], [0.12, 0.25, 0.06], [0.1, 0.12, 0.05]], 0.011, 18, 6), 0, 0, 0);
  b.cyl(S.plasticBlack, 0.1, 0.06, 0.05, 0.016, 0.07, 8);
  signOn(c, f, "extinguisher", 0, 1.95, 0.004, 0.3);
  if (floorMark) { f.box(S.paintYellow, 0, 0.001, 0.45, 0.7, 0.002, 0.7); f.box(S.paintRed, 0, 0.0015, 0.45, 0.5, 0.002, 0.5); }
}
/** Abrigo de mangueira (hidrante): caixa vermelha com visor de vidro, mangueira aduchada e esguicho. */
export function hoseCabinet(c: C, room: string, x: number, z: number, ry: number) {
  const S = SM(c.q), f = Fr.at(c, room, x, 0, z, ry);
  f.rbox(S.paintRed, 0, 0.9, 0.085, 0.75, 0.9, 0.17, 0.012, 0, true);
  f.box(S.paintRed, 0, 0.93, 0.172, 0.69, 0.84, 0.01);
  f.box(S.glassClear, 0, 1.25, 0.18, 0.4, 0.4, 0.004);
  f.box(S.white, 0, 1.17, 0.176, 0.48, 0.07, 0.004);
  f.box(S.chrome, 0.3, 1.25, 0.18, 0.02, 0.14, 0.02);
  for (const k of [0, 1, 2]) f.g(S.white, geo("srv-hoseRoll", () => new THREE.TorusGeometry(0.15, 0.022, 6, 24)), 0, 1.25 - k * 0.05, 0.1, 0, 1, 1, 1);
  f.cylX(S.brass, 0.05, 1.38, 0.12, 0.018, 0.16, 10);
  signOn(c, f, "hose", 0, 2.15, 0.004, 0.36);
  f.box(S.paintYellow, 0, 0.001, 0.5, 1.0, 0.002, 0.7); f.box(S.paintRed, 0, 0.0015, 0.5, 0.8, 0.002, 0.5);
}
/** Acionador manual do alarme de incêndio e a sirene com flash logo acima. */
export function alarmPoint(c: C, room: string, x: number, z: number, ry: number) {
  const S = SM(c.q), f = Fr.at(c, room, x, 0, z, ry);
  f.rbox(S.paintRed, 0, 1.3, 0.025, 0.12, 0.12, 0.05, 0.01);
  signOn(c, f, "alarm", 0, 1.36, 0.05, 0.1, { depth: 0.001 });
  f.rbox(S.paintRed, 0, 2.25, 0.04, 0.11, 0.14, 0.08, 0.02); f.cylZ(S.poly, 0, 2.32, 0.08, 0.03, 0.03, 12);
}
/** Luz de emergência de dois faróis (bloco autônomo) com LED verde de carga. */
export function emergencyLight(c: C, room: string, x: number, y: number, z: number, ry: number) {
  const S = SM(c.q), f = Fr.at(c, room, x, y, z, ry);
  f.rbox(S.plasticWhite, 0, 0, 0.035, 0.32, 0.11, 0.07, 0.015);
  for (const s of [-1, 1]) { f.g(S.plasticWhite, SPH(10), s * 0.1, 0.13, 0.06, 0, 0.045, 0.045, 0.04); f.g(S.poly, SPH(10), s * 0.1, 0.13, 0.085, 0, 0.032, 0.032, 0.025); }
  f.i("srv-ledGreen", SPH(6), glow("srv-ledGreenS", "#37ff6e", 2.2), 0.13, 0.03, 0.072, 0, 0.004);
}
/** Relógio de parede de escritório: aro preto, mostrador branco com marcas e ponteiros. */
export function wallClock(c: C, room: string, x: number, y: number, z: number, ry: number, hour = 11, minute = 7) {
  const S = SM(c.q), f = Fr.at(c, room, x, y, z, ry);
  f.g(S.plasticBlack, geo("srv-clockRim", () => new THREE.TorusGeometry(0.15, 0.018, 8, 32)), 0, 0, 0.03);
  f.cylZ(S.white, 0, 0, 0.022, 0.15, 0.02, 32);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; f.box(S.plasticBlack, Math.sin(a) * 0.125, Math.cos(a) * 0.125 - 0.012, 0.034, 0.008, k % 3 ? 0.014 : 0.024, 0.002, -a); }
  const ha = ((hour % 12) + minute / 60) / 12 * Math.PI * 2, ma = minute / 60 * Math.PI * 2;
  f.g(S.plasticBlack, BOX0(), 0, 0, 0.037, 0, 0.012, 0.075, 0.002, 0, -ha); f.g(S.plasticBlack, BOX0(), 0, 0, 0.039, 0, 0.008, 0.11, 0.002, 0, -ma);
  f.g(S.paintRed, BOX0(), 0, 0, 0.041, 0, 0.003, 0.12, 0.002, 0, -1.9);
}
/** Para-choque de parede (bate-maca) ao longo da face: perfil de vinil com friso e ponteiras boleadas. */
export function crashRail(c: C, f: WFace, y = 0.82, skip?: (a: number, b: number) => boolean) {
  const S = SM(c.q), len = f.b - f.a - 0.16; if (len < 0.4 || (skip && skip(f.a, f.b))) return;
  const mid = (f.a + f.b) / 2, ry = f.axis === "x" ? (f.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : f.dir > 0 ? 0 : Math.PI;
  const x = f.axis === "x" ? f.plane : mid, z = f.axis === "x" ? mid : f.plane, r = Fr.at(c, f.room, x, y, z, ry);
  r.box(S.alu, 0, 0, 0.006, len, 0.15, 0.012);
  r.rbox(S.vinylGrey, 0, 0.012, 0.02, len, 0.126, 0.028, 0.008);
  r.box(S.vinylDark, 0, 0.068, 0.0345, len, 0.014, 0.002);
  for (const s of [-1, 1]) r.rbox(S.vinylDark, s * (len / 2 + 0.03), 0.005, 0.02, 0.06, 0.14, 0.036, 0.015);
}
/** Cantoneira de inox (1,3 m) na quina saliente da parede, com o rodapé de borracha contornando. */
export function cornerGuard(c: C, k: WCorner, h = 1.3) {
  const S = SM(c.q);
  c.inst.add(k.room, "srv-cgA", BOX0(), S.inox, mat(k.x + k.sx * 0.0012, 0.1, k.z - k.sz * 0.025, 0, 0.0024, h, 0.05));
  c.inst.add(k.room, "srv-cgB", BOX0(), S.inox, mat(k.x - k.sx * 0.025, 0.1, k.z + k.sz * 0.0012, 0, 0.05, h, 0.0024));
}
/** Lixeira de inox com pedal (50 L): balde, tampa basculante, pedal e anel de borracha. */
export function pedalBin(c: C, room: string, x: number, z: number, ry: number, lid = "#c8ccd0") {
  const S = SM(c.q), f = Fr.at(c, room, x, 0, z, ry);
  f.cyl(S.rubber, 0, 0, 0, 0.17, 0.03, 20);
  f.g(S.inox, lathe("binBody", [[0, 0.03], [0.16, 0.03], [0.165, 0.6], [0.162, 0.62], [0, 0.62]], 24), 0, 0, 0, 0, 1, 1, 1, 0, 0, true);
  f.g(lid === "#c8ccd0" ? S.inoxDark : S.plasticBlack, lathe("binLid", [[0.168, 0], [0.17, 0.02], [0.12, 0.06], [0, 0.07]], 24), 0, 0.62, 0);
  f.box(S.plasticBlack, 0, 0.01, 0.17, 0.12, 0.02, 0.07);
}
/** Cavalete amarelo de piso molhado (duas abas articuladas). */
export function wetFloorSign(c: C, room: string, x: number, z: number, ry: number) {
  const S = SM(c.q), f = Fr.at(c, room, x, 0, z, ry), a = 0.28;
  for (const s of [-1, 1]) {
    const p = f.sub(0, 0.62, 0, s > 0 ? 0 : Math.PI, -a);
    p.rbox(S.plasticYellow, 0, -0.64, 0.0, 0.31, 0.64, 0.016, 0.01);
    signOn(c, p, "wetFloor", 0, -0.33, 0.008, 0.36, { depth: 0.001 });
  }
  f.box(S.plasticYellow, 0, 0.6, 0, 0.12, 0.04, 0.05);
}
/** Pia de lavar as mãos de inox na parede (válvula de joelho), com sabonete, papel-toalha e a placa. */
export function handSink(c: C, room: string, x: number, z: number, ry: number) {
  const S = SM(c.q), f = Fr.at(c, room, x, 0, z, ry);
  f.box(S.inox, 0, 0.62, 0.2, 0.42, 0.24, 0.4); f.box(S.inox, 0, 0.86, 0.02, 0.42, 0.18, 0.04);
  f.box(S.inoxDark, 0, 0.8, 0.22, 0.34, 0.06, 0.3);
  f.g(S.chrome, tube([[0, 0.86, 0.04], [0, 1.05, 0.06], [0, 1.08, 0.16], [0, 0.98, 0.22]], 0.011, 16, 8), 0, 0, 0);
  f.box(S.chrome, 0.12, 0.5, 0.38, 0.08, 0.04, 0.06); f.cyl(S.chrome, 0, 0.52, 0.2, 0.02, 0.1, 8);
  f.rbox(S.plasticWhite, 0.32, 1.2, 0.05, 0.1, 0.2, 0.1, 0.02); f.box(S.plasticGrey, 0.32, 1.17, 0.1, 0.03, 0.03, 0.02);
  f.rbox(S.plasticWhite, -0.36, 1.25, 0.06, 0.3, 0.36, 0.12, 0.025); f.box(S.paper, -0.36, 1.235, 0.11, 0.2, 0.06, 0.02);
  signOn(c, f, "handWash", 0, 1.6, 0.004, 0.27);
}
/** Cortina de tiras de PVC (porta da cozinha): trilho de inox e tiras transparentes sobrepostas. `w` ao longo de x local. */
export function stripCurtain(c: C, room: string, x: number, z: number, ry: number, w: number, top = 2.45) {
  const S = SM(c.q), f = Fr.at(c, room, x, 0, z, ry), n = Math.round(w / 0.17);
  f.box(S.inox, 0, top, 0, w, 0.05, 0.05);
  for (let k = 0; k < n; k++) f.box(S.stripPvc, -w / 2 + (k + 0.5) * (w / n), 0.015, (k % 2) * 0.006 - 0.003, w / n + 0.05, top - 0.015, 0.003, ((k * 7) % 5 - 2) * 0.01);
}
/** Prateleira de parede de inox (lisa ou gradeada) em mãos-francesas, (x, y, z) = centro da borda da parede. */
export function wallShelf(c: C, room: string, x: number, y: number, z: number, ry: number, w: number, d = 0.35) {
  const S = SM(c.q), f = Fr.at(c, room, x, y, z, ry);
  f.box(S.inox, 0, 0, d / 2, w, 0.025, d); f.box(S.inox, 0, 0.025, d - 0.01, w, 0.03, 0.012);
  for (const s of [-1, 1]) { const bx = s * (w / 2 - 0.12); f.box(S.galv, bx, -0.2, 0.01, 0.025, 0.22, 0.02); f.g(S.galv, BOX0(), bx, -0.18, d * 0.45, 0, 0.02, Math.hypot(0.18, d * 0.8), 0.02, Math.PI / 2 - Math.atan2(0.18, d * 0.8), 0); }
  return f;
}
/** Rodapé sanitário de inox (copa) com curva para o piso. */
export function stainlessKick(c: C, f: WFace) {
  const S = SM(c.q), len = f.b - f.a, mid = (f.a + f.b) / 2, ry = f.axis === "x" ? (f.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : f.dir > 0 ? 0 : Math.PI;
  const x = f.axis === "x" ? f.plane : mid, z = f.axis === "x" ? mid : f.plane, r = Fr.at(c, f.room, x, 0, z, ry);
  r.box(S.inox, 0, 0, 0.004, len, 0.15, 0.008);
  r.g(S.inox, geo("srv-cove", () => new THREE.CylinderGeometry(0.03, 0.03, 1, 8, 1, true, Math.PI, Math.PI / 2).rotateZ(Math.PI / 2)), 0, 0.03, 0.03, 0, len, 1, 1);
}
void CYL0; void mul; void sign;
