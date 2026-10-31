/*
 * MET Gala Heist v2 — Sala de segurança, a central de monitoramento (Z09). Sala de 3,5 × 5,5 m dentro do labirinto:
 *  - piso vinílico técnico em placas de 60 cm (com duas tampas de acesso por onde sobem os cabos do console), parede em
 *    pintura técnica com barra grafite, painéis acústicos de tecido, forro acústico a 3,2 m com luminárias embutidas,
 *    difusor de ar, detector e câmera dome;
 *  - console de monitores na parede oeste, de frente para o posto do chefe (seis telas com as câmeras que já existem e o
 *    joystick das câmeras), mesa de coordenação com a base de rádios, headsets, telefone e o livro de ocorrências, dois
 *    racks ventilados (um de porta aberta: switches, gravadores e o nobreak piscando), armário do café, o cofre do cartão,
 *    o quadro de luz (o que corta a energia da Sala das Joias) entreaberto e o quadro de chaves;
 *  - o painel do palco e da pista na parede: a cena de luz da festa, o DJ e o salão, que muda com o tempo e fica vermelho
 *    no alarme (o "estado da festa" do blueprint).
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import type { SceneLocale } from "../interior-copy";
import { BOX0, CYL, CYL0, QuadBuilder, SPH, geo } from "../interior-batch";
import { fabric, glow, solid } from "../interior-mats";
import { SANS, drawnTexture, fit, rand, type Quality } from "../interior-tex";
import { cctvTexture, foot, type PropsCtx } from "../interior-props";
import { type RoomsCtx, A, beacon } from "./kit";
import type { AreaModule } from "./types";
import { Fr, SM, lathe, light, localeOf, mazeInfo, once, pbrMat, rbox, sign, signOn, texCeilMineral, texPaintSeg, texVinyl, tube } from "./servico-kit";
import { cctvCam, smokeDetector, wallClock } from "./servico-pecas";

const room = "seguranca", H = 3.2;
const SHOW: Record<SceneLocale, { head: string; scene: string; scenes: string[]; dj: string; hall: string; alarm: string; where: string }> = {
  "pt-BR": { head: "PALCO · PISTA", scene: "CENA", scenes: ["ÂMBAR LENTO", "ROSA PULSO", "BRANCO DESFILE", "VIOLETA PISTA"], dj: "DJ 124 BPM", hall: "SALÃO 412 CONVIDADOS", alarm: "ALARME", where: "SALA DAS JOIAS" },
  en: { head: "STAGE · FLOOR", scene: "SCENE", scenes: ["SLOW AMBER", "PINK PULSE", "RUNWAY WHITE", "FLOOR VIOLET"], dj: "DJ 124 BPM", hall: "HALL 412 GUESTS", alarm: "ALARM", where: "JEWEL ROOM" },
  es: { head: "ESCENARIO · PISTA", scene: "ESCENA", scenes: ["ÁMBAR LENTO", "ROSA PULSO", "BLANCO DESFILE", "VIOLETA PISTA"], dj: "DJ 124 BPM", hall: "SALÓN 412 INVITADOS", alarm: "ALARMA", where: "SALA DE LAS JOYAS" },
};
/** Uma tela do painel do palco e da pista (quatro cenas que se revezam e a tela do alarme). */
function showTexture(loc: SceneLocale, k: number, alarm: boolean): THREE.Texture {
  const t = SHOW[loc];
  return drawnTexture(`seg-show-${loc}-${k}-${alarm ? 1 : 0}`, 512, 288, (g, w, h) => {
    if (alarm) {
      g.fillStyle = "#3a0306"; g.fillRect(0, 0, w, h); g.fillStyle = "#ff2a2a"; g.fillRect(0, 0, w, 56);
      g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `800 40px ${SANS}`; g.fillText(t.alarm, w / 2, 30);
      g.fillStyle = "#ffb3b3"; const px = fit(g, t.where, (p) => `800 ${p}px ${SANS}`, 46, w - 40); g.font = `800 ${px}px ${SANS}`; g.fillText(t.where, w / 2, h * 0.52);
      g.font = `600 22px ${SANS}`; g.fillText("23:1" + k + ":0" + (k * 3 % 10), w / 2, h * 0.8);
      return;
    }
    const cols = ["#ffb35a", "#ff5fa8", "#f4f4f4", "#a36bff"], c = cols[k];
    g.fillStyle = "#06090f"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#14243a"; g.fillRect(0, 0, w, 40); g.fillStyle = "#cfe8ff"; g.font = `700 22px ${SANS}`; g.textBaseline = "middle"; g.textAlign = "left"; g.fillText(t.head, 14, 21);
    g.textAlign = "right"; g.fillText(`23:0${k * 2}`, w - 14, 21);
    t.scenes.forEach((s, i) => { const y = 64 + i * 42; g.fillStyle = i === k ? c : "#1a2433"; g.fillRect(12, y, 220, 34); g.fillStyle = i === k ? "#0b0b0b" : "#8fa6c0"; g.textAlign = "left"; g.font = `700 16px ${SANS}`; g.fillText(`${t.scene} ${i + 1}  ${s}`, 20, y + 17); });
    // mini planta da pista com os refletores na cor da cena
    g.strokeStyle = "#3e5a7a"; g.lineWidth = 2; g.strokeRect(250, 58, 248, 150);
    for (let i = 0; i < 12; i++) { const x = 266 + (i % 6) * 43, y = 76 + Math.floor(i / 6) * 112; g.fillStyle = (i + k) % 3 === 0 ? "#ffffff" : c; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = c; g.globalAlpha = 0.25; g.beginPath(); g.ellipse(374, 133, 90, 40, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    for (let i = 0; i < 9; i++) { g.fillStyle = "#cfe8ff"; g.beginPath(); g.arc(320 + (i * 37) % 120, 118 + (i * 23) % 36, 4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#cfe8ff"; g.textAlign = "left"; g.font = `600 18px ${SANS}`; g.fillText(t.dj, 14, h - 46); g.fillText(t.hall, 14, h - 20);
    for (let i = 0; i < 24; i++) { const v = 0.3 + 0.7 * Math.abs(Math.sin(i * 0.9 + k * 1.7)); g.fillStyle = c; g.fillRect(260 + i * 10, h - 18 - v * 50, 7, v * 50); }
  });
}
/** Planta do museu na parede (traços ciano, o ponto vermelho é o diamante). */
function planTexture(label: string): THREE.Texture {
  return drawnTexture(`seg-plan-${label}`, 512, 512, (g, w, h) => {
    g.fillStyle = "#0e1a26"; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(127,215,255,0.18)"; g.lineWidth = 1;
    for (let k = 0; k < 16; k++) { g.beginPath(); g.moveTo((k / 16) * w, 0); g.lineTo((k / 16) * w, h); g.stroke(); g.beginPath(); g.moveTo(0, (k / 16) * h); g.lineTo(w, (k / 16) * h); g.stroke(); }
    g.strokeStyle = "#7fd7ff"; g.lineWidth = 3;
    const rect = (x0: number, z0: number, x1: number, z1: number) => g.strokeRect(((x0 + 24) / 48) * w, ((z0 + 24) / 48) * h, ((x1 - x0) / 48) * w, ((z1 - z0) / 48) * h);
    rect(-22, -22, -12.5, -6.5); rect(-12, -22, 12, -6.5); rect(12.5, -22, 22, -6.5); rect(-22, -6, -12.5, 16); rect(-12, -6, 12, 14); rect(12.5, -6, 22, 4); rect(12.5, 4.5, 22, 14); rect(-8, 14.5, 8, 24); rect(-22, 16.5, -8.5, 24);
    g.fillStyle = "#ff4b4b"; g.beginPath(); g.arc(((-17.25 + 24) / 48) * w, ((-14.25 + 24) / 48) * h, 8, 0, Math.PI * 2); g.fill();
    for (const [x, z] of [[-20.2, 4.8], [-13.25, 15], [-17.25, -5], [0, 5], [17, -1]]) { g.fillStyle = "#ffe36a"; g.beginPath(); g.arc(((x + 24) / 48) * w, ((z + 24) / 48) * h, 4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#7fd7ff"; g.font = `600 22px ${SANS}`; g.fillText(label, 16, h - 18);
  });
}

/* ---------- móveis da planta desenhados pela sala ---------- */
/** Console de monitoramento: tampo de borda boleada, calha de cabos, seis telas das câmeras num quadro de parede,
 * dois teclados, o joystick das câmeras e o microfone do sistema de som. */
function monitorConsole(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, R = rand(511);
  // corpo: painel frontal recuado, laterais, tampo de laminado grafite com borda emborrachada
  for (const s of [-1, 1]) f.box(S.steelBlack, s * (w / 2 - 0.02), 0, 0, 0.04, 0.72, d - 0.04);
  f.box(S.steelBlack, 0, 0.08, -d / 2 + 0.1, w - 0.06, 0.6, 0.02);
  f.box(S.paintGrey, 0, 0.1, 0.05, w - 0.08, 0.04, d - 0.3);
  f.rbox(solid("seg-top", "#2a2d31", { rough: 0.55 }), 0, 0.72, 0, w, 0.035, d, 0.012, 0, true);
  f.rbox(S.rubber, 0, 0.715, d / 2 - 0.02, w, 0.045, 0.05, 0.02);
  // quadro de parede com seis telas (duas fileiras), molduras finas e as imagens das câmeras que se revezam
  const sw = (w - 0.12) / 3, sh = 0.4;
  for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) f.box(S.steelBlack, x, 0.75, -d / 2 + 0.04, 0.04, 1.55, 0.04);
  for (const y of [1.05, 1.5]) f.box(S.steelBlack, 0, y + 0.1, -d / 2 + 0.05, w - 0.04, 0.04, 0.03);
  for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
    const x = -w / 2 + 0.06 + (k + 0.5) * sw, y = 0.98 + r * 0.45;
    f.rbox(S.plasticBlack, x, y, -d / 2 + 0.1, sw - 0.025, sh, 0.045, 0.008, (k - 1) * -0.12);
    const m = new THREE.Mesh(geo("plane", () => new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: cctvTexture(r * 3 + k), color: new THREE.Color(1.25, 1.25, 1.25) }));
    m.matrixAutoUpdate = false; m.matrix.copy(f.sub(x, y + sh / 2, -d / 2 + 0.1, (k - 1) * -0.12).m(0, 0, 0.0235, 0, sw - 0.05, sh - 0.03, 1)); m.userData.room = room;
    c.group.add(m); c.animated.push({ kind: "cctv", mesh: m, room });
    f.i("seg-ledOn", SPH(6), glow("seg-ledBlue", "#5ab4ff", 2.2), x + sw / 2 - 0.04, y + 0.012, -d / 2 + 0.124, 0, 0.004);
  }
  // teclados, mouses, joystick (PTZ), microfone de mesa, fichas e o copo
  for (const s of [-1, 1]) {
    f.rbox(S.plasticBlack, s * 0.42, 0.755, 0.08, 0.44, 0.02, 0.15, 0.006, 0.0);
    for (let k = 0; k < 4; k++) f.i("seg-keys", BOX0(), S.plasticGrey, s * 0.42, 0.775, 0.03 + k * 0.032, 0, 0.4, 0.004, 0.022);
    f.rbox(S.plasticBlack, s * 0.42 + 0.3, 0.755, 0.1, 0.06, 0.025, 0.1, 0.02);
  }
  f.rbox(S.plasticBlack, 0, 0.755, 0.12, 0.26, 0.04, 0.18, 0.012);
  f.g(S.plasticBlack, lathe("ptz", [[0, 0], [0.03, 0], [0.025, 0.02], [0.012, 0.03], [0.014, 0.12], [0.022, 0.14], [0, 0.15]], 12), 0.06, 0.795, 0.12, 0, 1, 1, 1, -0.2, 0);
  for (let k = 0; k < 6; k++) f.i("seg-btn", CYL0(8), [S.plasticRed, S.plasticGreen, S.plasticYellow][k % 3], -0.06 + (k % 3) * 0.035, 0.795, 0.08 + Math.floor(k / 3) * 0.05, 0, 0.012, 0.008, 0.012);
  f.cyl(S.plasticBlack, -0.05, 0.755, -0.12, 0.05, 0.02, 12);
  f.g(S.plasticBlack, tube([[-0.05, 0.775, -0.12], [-0.05, 0.95, -0.1], [-0.03, 1.02, 0.0], [-0.02, 1.0, 0.05]], 0.006, 16, 6), 0, 0, 0);
  for (let k = 0; k < 4; k++) f.i("seg-paper", BOX0(), S.paper, 0.6 + (R() - 0.5) * 0.12, 0.756 + k * 0.002, -0.05 + (R() - 0.5) * 0.1, (R() - 0.5) * 0.4, 0.21, 0.001, 0.29);
  f.g(S.porcelain, lathe("mug", [[0, 0], [0.04, 0], [0.042, 0.1], [0.038, 0.1], [0.036, 0.008], [0, 0.008]], 16), -0.7, 0.755, 0.2);
  f.g(S.porcelain, geo("seg-mugHandle", () => new THREE.TorusGeometry(0.026, 0.007, 6, 12, Math.PI)), -0.66, 0.805, 0.2, Math.PI / 2, 1, 1, 1, 0, -Math.PI / 2);
  // calha de cabos sob o tampo e o feixe que sobe pela parede até o forro
  f.box(S.galv, 0, 0.55, -d / 2 + 0.15, w - 0.2, 0.08, 0.12);
  for (let k = 0; k < 3; k++) f.cyl(S.cable, -0.2 + k * 0.05, 1.95, -d / 2 + 0.06, 0.012, H - 1.95, 8);
  light(c, room, f.p(0, 1.4, 0.4), "#7fe0c8", 2.4, 3);
}
/** Cofre do cartão: aço grosso de cantos boleados sobre base, porta com rebaixo, dobradiças, teclado e manopla. */
function safe(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d;
  const steel = solid("seg-safeSteel", "#3c4148", { metal: 0.85, rough: 0.34 }), door = solid("seg-safeDoor", "#4c525a", { metal: 0.85, rough: 0.28 });
  f.box(S.steelBlack, 0, 0, 0, w - 0.06, 0.06, d - 0.06);
  f.rbox(steel, 0, 0.06, 0, w, 0.94, d, 0.035, 0, true);
  f.rbox(door, -0.02, 0.12, d / 2 - 0.005, w - 0.14, 0.82, 0.04, 0.02);
  f.box(S.steelBlack, -0.02, 0.12, d / 2 - 0.012, w - 0.12, 0.82, 0.006);
  for (const y of [0.25, 0.8]) f.cyl(S.chrome, -w / 2 + 0.06, y, d / 2 + 0.012, 0.022, 0.12, 12);
  // teclado digital com visor e LED, manopla de três raios e a placa do fabricante (fictício)
  f.rbox(S.plasticBlack, 0.12, 0.62, d / 2 + 0.03, 0.15, 0.2, 0.02, 0.008);
  f.box(glow("seg-safeLcd", "#7dffb0", 1.1), 0.12, 0.76, d / 2 + 0.041, 0.1, 0.03, 0.002);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) f.i("seg-safeKey", rbox(0.028, 0.022, 0.01, 0.004), S.chrome, 0.08 + k * 0.04, 0.635 + r * 0.03, d / 2 + 0.044);
  f.i("seg-ledRed", SPH(6), glow("seg-ledRedS", "#ff2a2a", 2.4), 0.2, 0.79, d / 2 + 0.042, 0, 0.006);
  const hub = f.sub(0.12, 0.42, d / 2 + 0.05);
  hub.cylZ(S.chrome, 0, 0, 0.01, 0.045, 0.04, 16);
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.3; hub.g(S.chrome, CYL(8), Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0.03, 0, 0.009, 0.14, 0.009, 0, a - Math.PI / 2); hub.g(S.chrome, SPH(8), Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0.03, 0, 0.016); }
  f.box(S.brass, -0.18, 0.92, d / 2 + 0.03, 0.18, 0.04, 0.004);
}
/** Quadro de luz geral: armário cinza entreaberto com os disjuntores no trilho, o geral vermelho, etiquetas, o aviso de
 * alta tensão na porta e os eletrodutos subindo para o forro. */
function fusePanel(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = 1.1, d = F.d;
  const grey = solid("seg-panelGrey", "#8b9095", { metal: 0.5, rough: 0.48 });
  f.rbox(grey, 0, 0.88, 0, w, 1.24, d, 0.01, 0, true);
  f.box(S.steelBlack, 0, 0.94, d / 2 - 0.004, w - 0.08, 1.12, 0.006);
  for (let r = 0; r < 3; r++) {
    const y = 1.12 + r * 0.32; f.box(S.alu, 0, y + 0.06, d / 2 - 0.006, w - 0.16, 0.035, 0.012);
    for (let k = 0; k < 12; k++) { const x = -w / 2 + 0.14 + k * ((w - 0.28) / 11); f.i("seg-breaker", rbox(0.055, 0.1, 0.06, 0.004), S.plasticWhite, x, y + 0.025, d / 2 + 0.01); f.i("seg-toggle", BOX0(), k % 5 === 3 ? S.plasticRed : S.plasticBlack, x, y + 0.08, d / 2 + 0.042, 0, 0.012, 0.022, 0.012); f.i("seg-label", BOX0(), S.paper, x, y - 0.012, d / 2 - 0.002, 0, 0.05, 0.02, 0.003); }
  }
  f.rbox(S.plasticRed, w / 2 - 0.16, 1.98, d / 2 + 0.01, 0.12, 0.1, 0.08, 0.01);
  // porta aberta (~60°, dobradiça do lado norte: de quem entra pela porta da sala se veem os disjuntores) com o aviso
  const dr = f.sub(w / 2, 0, d / 2 + 0.005, 1.05);
  dr.rbox(grey, -w / 2, 0.9, 0.0, w - 0.02, 1.2, 0.022, 0.006);
  signOn(c, dr, "highVoltage", -w / 2, 1.85, 0.012, 0.14);
  dr.box(S.chrome, -w + 0.08, 1.4, 0.012, 0.03, 0.09, 0.02);
  for (const y of [1.0, 1.9]) f.cyl(S.chrome, w / 2 - 0.01, y, d / 2 + 0.01, 0.01, 0.1, 8);
  for (const x of [-0.3, -0.1, 0.1, 0.3]) f.cyl(S.galv, x, 2.12, -0.02, 0.016, H - 2.12, 8);
  f.box(S.galv, 0, H - 0.12, 0, w + 0.2, 0.06, 0.2);
}
/* ---------- móveis próprios da sala ---------- */
/** Mesa de coordenação: base de carregamento com seis rádios, headsets, telefone, livro de ocorrências, luminária. */
function coordDesk(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, R = rand(523);
  for (const s of [-1, 1]) f.box(S.steelBlack, s * (w / 2 - 0.02), 0, 0, 0.04, 0.72, d - 0.04);
  f.box(S.steelBlack, 0, 0.12, -d / 2 + 0.06, w - 0.06, 0.55, 0.02);
  f.rbox(solid("seg-top", "#2a2d31", { rough: 0.55 }), 0, 0.72, 0, w, 0.035, d, 0.012, 0, true);
  f.rbox(S.rubber, 0, 0.715, d / 2 - 0.02, w, 0.045, 0.05, 0.02);
  // gabinete do computador e nobreak embaixo
  f.rbox(S.plasticBlack, -w / 2 + 0.2, 0, -0.05, 0.2, 0.45, 0.45, 0.01); f.i("seg-ledOn", SPH(6), glow("seg-ledBlue", "#5ab4ff", 2.2), -w / 2 + 0.25, 0.4, 0.18, 0, 0.005);
  f.rbox(S.plasticBlack, w / 2 - 0.2, 0, -0.1, 0.18, 0.25, 0.38, 0.01);
  // base de rádios (seis), com antena e LED de carga
  const base = f.sub(-0.35, 0.755, -0.22);
  base.rbox(S.plasticBlack, 0, 0, 0, 0.6, 0.06, 0.16, 0.01);
  for (let k = 0; k < 6; k++) { const x = -0.25 + k * 0.1; base.rbox(S.plasticBlack, x, 0.05, 0, 0.06, 0.16, 0.035, 0.008, 0, false); base.i("seg-antenna", CYL0(6), S.plasticBlack, x + 0.015, 0.21, 0, 0, 0.006, 0.09, 0.006); base.i("seg-ledCharge", SPH(6), glow(k % 4 === 1 ? "seg-ledAmberS" : "seg-ledGreenS", k % 4 === 1 ? "#ffb02a" : "#37ff6e", 2.2), x, 0.035, 0.081, 0, 0.005); }
  // dois headsets (arco, conchas e haste do microfone)
  for (const [x, z, ry] of [[0.25, -0.05, 0.4], [0.55, 0.12, -0.3]] as [number, number, number][]) {
    const h = f.sub(x, 0.79, z, ry);
    h.g(S.plasticBlack, geo("seg-headband", () => new THREE.TorusGeometry(0.085, 0.008, 6, 20, Math.PI)), 0, 0, 0, 0, 1, 1, 1, Math.PI / 2, 0);
    for (const s of [-1, 1]) h.g(S.plasticBlack, lathe("earcup", [[0, 0], [0.04, 0], [0.042, 0.02], [0.03, 0.035], [0, 0.036]], 14), s * 0.085, -0.02, 0, 0, 1, 1, 1, 0, s * Math.PI / 2);
    h.g(S.plasticBlack, tube([[0.1, -0.02, 0], [0.11, -0.01, 0.07], [0.06, -0.015, 0.13]], 0.004, 10, 5), 0, 0, 0);
  }
  // telefone, livro de ocorrências aberto com canetas, prancheta, copo de café e a luminária articulada
  f.rbox(S.plasticBlack, 0.0, 0.755, 0.18, 0.2, 0.06, 0.22, 0.02, 0.1); f.box(S.plasticBlack, 0.0, 0.81, 0.13, 0.19, 0.04, 0.05, 0.1);
  f.box(S.plasticBlue, -0.25, 0.755, 0.15, 0.48, 0.012, 0.32, -0.05); f.box(S.paper, -0.37, 0.768, 0.15, 0.22, 0.004, 0.3, -0.05); f.box(S.paper, -0.13, 0.768, 0.15, 0.22, 0.004, 0.3, -0.05);
  for (let k = 0; k < 9; k++) f.i("seg-line", BOX0(), S.plasticBlue, -0.25 + (k % 2 ? 0.12 : -0.12), 0.7725, 0.04 + Math.floor(k / 2) * 0.05, -0.05, 0.18, 0.0005, 0.002);
  f.cylX(S.plasticBlue, -0.05, 0.775, 0.27, 0.005, 0.14, 6); f.cylX(S.plasticRed, -0.05, 0.775, 0.29, 0.005, 0.14, 6);
  f.g(S.paper, lathe("cup", [[0, 0], [0.032, 0], [0.042, 0.11], [0, 0.11]], 14), 0.62, 0.755, -0.25);
  // luminária de mesa: base, haste, braço e cúpula voltada para o livro
  f.cyl(S.steelBlack, -0.68, 0.755, -0.25, 0.07, 0.02, 14); f.cyl(S.steelBlack, -0.68, 0.775, -0.25, 0.01, 0.42, 8);
  f.cylZ(S.steelBlack, -0.68, 1.19, -0.08, 0.01, 0.36, 8); f.g(S.steelBlack, geo("seg-lampHead", () => new THREE.ConeGeometry(0.07, 0.11, 16, 1, true)), -0.68, 1.15, 0.1);
  f.g(S.opalWarm, SPH(8), -0.68, 1.11, 0.1, 0, 0.03);
  light(c, room, f.p(-0.68, 1.0, 0.1), "#ffe4b8", 1.6, 1.8);
  void R;
}
/** Dois racks ventilados de 42U (porta perfurada; o da direita aberto: switches, gravadores e o nobreak). */
function racks(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), d = F.d, R = rand(541), H2 = 2.0;
  const mesh = solid("seg-mesh", "#16181b", { metal: 0.5, rough: 0.6, transparent: true, opacity: 0.88 });
  for (let k = 0; k < 2; k++) {
    const g = f.sub(-0.3 + k * 0.6, 0, 0);
    g.box(S.steelBlack, 0, 0.05, 0, 0.6, H2 - 0.05, d); for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.i("seg-rackFoot", CYL0(8), S.steelBlack, sx * 0.25, 0, sz * (d / 2 - 0.08), 0, 0.025, 0.05, 0.025);
    for (let j = 0; j < 2; j++) g.cyl(S.steelBlack, -0.12 + j * 0.24, H2, -0.1, 0.07, 0.02, 18);
    // equipamentos (vistos pela porta perfurada ou com a porta aberta)
    for (let u = 0; u < 9; u++) {
      const y = 0.12 + u * 0.2, kind = (u + k) % 3;
      g.box(kind === 2 ? S.plasticGrey : S.plasticBlack, 0, y, d / 2 - 0.08, 0.5, kind === 0 ? 0.088 : 0.17, 0.05);
      for (let l = 0; l < (kind === 0 ? 8 : 4); l++) { const bl = R() > 0.3; g.i(bl ? "seg-ledBlink" : "seg-ledOn", SPH(5), bl ? glow("seg-ledBlinkG", "#46ff7c", 2.4) : glow("seg-ledAmberS", "#ffb02a", 2.2), -0.2 + l * 0.055, y + 0.05, d / 2 - 0.054, 0, 0.004); }
      if (kind === 0) for (let l = 0; l < 6; l++) g.i("seg-patch", BOX0(), [S.plasticBlue, S.plasticYellow, S.plasticRed, S.plasticGreen][l % 4], -0.15 + l * 0.05, y + 0.02, d / 2 - 0.05, 0, 0.012, 0.05, 0.03);
    }
    const open = k === 1, dr = g.sub(-0.3, 0, d / 2 + 0.005, open ? -1.25 : 0);
    dr.box(S.steelBlack, 0.3, 0.06, 0, 0.6, H2 - 0.08, 0.008); dr.box(mesh, 0.3, 0.2, 0.006, 0.5, H2 - 0.4, 0.004);
    dr.box(S.chrome, 0.54, 0.95, 0.02, 0.025, 0.18, 0.025);
    dr.box(S.paper, 0.3, H2 - 0.16, 0.007, 0.16, 0.05, 0.002);
  }
  // nobreak no pé do rack aberto
  f.rbox(S.plasticBlack, 0.3, 0.05, 0.05, 0.48, 0.26, d - 0.2, 0.01); f.box(glow("seg-upsLcd", "#5ab4ff", 1.3), 0.3, 0.2, d / 2 - 0.05, 0.1, 0.04, 0.002);
}
/** Armário do café: duas portas, cafeteira com jarra, canecas, copos de papel, açucareiro e lixeira ao lado. */
function cafe(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d;
  f.rbox(S.paintCream, 0, 0.06, 0, w, 0.82, d, 0.01, 0, true); f.box(S.plasticBlack, 0, 0, 0.02, w - 0.04, 0.06, d - 0.06);
  for (const s of [-1, 1]) { f.box(S.paintCream, s * w / 4, 0.1, d / 2 + 0.004, w / 2 - 0.012, 0.74, 0.016); f.box(S.chrome, s * 0.04, 0.6, d / 2 + 0.018, 0.012, 0.1, 0.014); }
  f.box(solid("seg-cafeTop", "#3a3d42", { rough: 0.4 }), 0, 0.88, 0, w + 0.02, 0.03, d + 0.02);
  const m = f.sub(-0.1, 0.91, -0.05);
  m.rbox(S.plasticBlack, 0, 0, 0, 0.22, 0.04, 0.24, 0.01); m.rbox(S.plasticBlack, 0, 0, -0.08, 0.22, 0.36, 0.08, 0.02); m.rbox(S.plasticBlack, 0, 0.3, 0.02, 0.22, 0.06, 0.2, 0.02);
  m.g(S.glassClear, lathe("carafe", [[0, 0], [0.07, 0], [0.075, 0.08], [0.05, 0.16], [0.04, 0.18], [0, 0.18]], 18), 0, 0.04, 0.03);
  m.g(solid("seg-coffee", "#2a160b", { rough: 0.1 }), lathe("coffeeIn", [[0, 0], [0.066, 0], [0.068, 0.07], [0, 0.07]], 18), 0, 0.045, 0.03);
  m.i("seg-ledRed", SPH(6), glow("seg-ledRedS", "#ff2a2a", 2.4), 0.08, 0.022, 0.121, 0, 0.005);
  for (let k = 0; k < 3; k++) f.g([S.porcelain, S.plasticBlue, S.paintRed][k], lathe("mug", [[0, 0], [0.04, 0], [0.042, 0.1], [0.038, 0.1], [0.036, 0.008], [0, 0.008]], 16), 0.12 + (k % 2) * 0.09, 0.91, -0.1 + k * 0.08);
  f.cyl(S.paper, 0.2, 0.91, 0.17, 0.035, 0.2, 12); f.cyl(S.glassClear, -0.25, 0.91, 0.18, 0.04, 0.1, 12);
  f.cyl(S.plasticGrey, w / 2 + 0.2, 0, 0.05, 0.13, 0.36, 16);
}

/* ---------- decoração da sala ---------- */
function seguranca(c: RoomsCtx) {
  const S = SM(c.q), info = mazeInfo(), R = rand(557), loc = localeOf(c.copy);
  /* piso vinílico, forro acústico e luminárias embutidas */
  const fl = new QuadBuilder(), ce = new QuadBuilder();
  for (const r of info.floors) {
    if (r.room !== "seguranca") continue;
    fl.quad([[r.x0, 0.002, r.z1], [r.x1, 0.002, r.z1], [r.x1, 0.002, r.z0], [r.x0, 0.002, r.z0]], [0, 1, 0], [[r.x0 / 1.2, -r.z1 / 1.2], [r.x1 / 1.2, -r.z1 / 1.2], [r.x1 / 1.2, -r.z0 / 1.2], [r.x0 / 1.2, -r.z0 / 1.2]]);
    ce.quad([[r.x0, H, r.z0], [r.x1, H, r.z0], [r.x1, H, r.z1], [r.x0, H, r.z1]], [0, -1, 0], [[r.x0 / 1.2, r.z0 / 1.2], [r.x1 / 1.2, r.z0 / 1.2], [r.x1 / 1.2, r.z1 / 1.2], [r.x0 / 1.2, r.z1 / 1.2]]);
  }
  c.batch.add(room, pbrMat(`seg-floor-vinil-${c.q}`, texVinyl(c.q), { env: 0.7, offset: true }), fl.geometry(), undefined, { receive: true });
  c.batch.add(room, pbrMat(`seg-ceil-acustico-${c.q}`, texCeilMineral(c.q), { tint: "#c9ccd0", env: 0.6, bounce: 0.24 }), ce.geometry());
  // tampas de acesso no piso (chapa com ilhós e o feixe de cabos subindo para o console) e o capacho da porta
  for (const z of [5.7, 6.9]) { const f = Fr.at(c, room, -21.0, 0, z); f.box(S.alu, 0, 0.002, 0, 0.6, 0.006, 0.6); f.cyl(S.rubber, -0.15, 0.004, 0.0, 0.05, 0.006, 16); f.g(S.cable, tube([[-0.15, 0.0, 0], [-0.18, 0.25, 0.02], [-0.22, 0.6, 0.0]], 0.022, 10, 6), 0, 0, 0); }
  { const f = Fr.at(c, room, -19.0, 0, 4.75, Math.PI / 2); f.rbox(S.rubberGrey, 0, 0.002, 0, 1.2, 0.012, 0.7, 0.01); for (let k = 0; k < 12; k++) f.i("seg-matRib", BOX0(), S.rubber, -0.55 + k * 0.1, 0.014, 0, 0, 0.012, 0.004, 0.62); }
  for (const [x, z] of [[-20.25, 3.9], [-20.25, 6.3]]) {
    const f = Fr.at(c, room, x, H, z);
    f.box(S.paintWhite, 0, -0.02, 0, 0.62, 0.02, 1.22); f.box(S.opal, 0, -0.03, 0, 0.5, 0.012, 1.1);
    for (let k = 0; k < 6; k++) f.i("seg-louver", BOX0(), S.paintWhite, -0.25 + k * 0.1, -0.04, 0, 0, 0.006, 0.02, 1.1);
    A(c, room, x, H - 0.35, z, "#eef4ff", 6, 5.2);
  }
  { const f = Fr.at(c, room, -19.4, H, 6.6); f.box(S.paintWhite, 0, -0.03, 0, 0.6, 0.03, 0.6); for (let k = 0; k < 4; k++) f.box(S.paintWhite, 0, -0.06 + k * 0.006, 0, 0.5 - k * 0.1, 0.012, 0.5 - k * 0.1); }
  smokeDetector(c, room, -19.6, H, 3.0);
  { const f = Fr.at(c, room, -20.2, H, 4.6); f.g(S.plasticWhite, lathe("dome2", [[0, -0.022], [0.09, -0.02], [0.09, 0]], 20), 0, 0, 0); f.g(S.glassDark, SPH(14), 0, -0.02, 0, 0, 0.065, 0.055, 0.065); }
  /* paredes: painéis acústicos de tecido em moldura, rodapé técnico, sinalização, quadros */
  const panelMat = fabric("seg-acoustic", "#2d3239", c.q, { rough: 0.95 });
  const panel = (x: number, y: number, z: number, ry: number, w: number, h: number) => { const f = Fr.at(c, room, x, y, z, ry); f.rbox(panelMat, 0, 0, 0.025, w, h, 0.05, 0.01); f.box(S.alu, 0, -0.006, 0.0, w + 0.012, 0.006, 0.006); };
  for (const z of [5.95, 6.75]) panel(-18.5, 0.98, z, -Math.PI / 2, 0.7, 0.86);
  for (const x of [-21.6, -20.85]) panel(x, 2.25, 7.5, Math.PI, 0.65, 0.6);
  panel(-19.65, 2.2, 2.0, 0, 0.9, 0.6);
  // painel do palco e da pista (tela grande na parede sul, sobre a mesa de coordenação)
  const show = new THREE.Mesh(geo("plane", () => new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: showTexture(loc, 0, false), color: new THREE.Color(1.15, 1.15, 1.15) }));
  {
    const f = Fr.at(c, room, -20.35, 0, 7.5, Math.PI);
    f.rbox(S.plasticBlack, 0, 1.12, 0.02, 1.04, 0.62, 0.04, 0.01);
    show.matrixAutoUpdate = false; show.matrix.copy(f.m(0, 1.43, 0.041, 0, 0.98, 0.555, 1)); show.userData.room = room; c.group.add(show);
    f.box(S.steelBlack, 0, 1.3, 0.005, 0.3, 0.25, 0.01);
    light(c, room, f.p(0, 1.43, 0.5), "#a98cff", 1.4, 2.4);
  }
  let frame = -1, wasAlarm = false;
  c.ticks.push({ room, tick: (t, _dt, v) => {
    const k = Math.floor(t / 3.5) % 4, alarm = !!v.alarm;
    if (k === frame && alarm === wasAlarm && !alarm) return;
    const m = show.material as THREE.MeshBasicMaterial, tex = showTexture(loc, alarm ? Math.floor(t * 2) % 2 : k, alarm);
    if (m.map !== tex) { m.map = tex; m.needsUpdate = true; }
    m.color.setScalar(alarm ? (Math.floor(t * 2) % 2 ? 1.6 : 0.8) : 1.15); frame = k; wasAlarm = alarm;
  } });
  // os LEDs dos racks piscam (um material só para todos)
  const blink = glow("seg-ledBlinkG", "#46ff7c", 2.4);
  c.ticks.push({ room, tick: (t) => { blink.color.setRGB(0.27, 1, 0.49).multiplyScalar(Math.sin(t * 9.1) > -0.2 ? 2.4 : 0.25); } });
  // planta do museu e quadro de plantão (escala) na parede leste, relógio, placa da central
  {
    const f = Fr.at(c, room, -18.5, 0, 6.35, -Math.PI / 2), pm = new THREE.MeshStandardMaterial({ map: planTexture(c.copy.securityRoom), roughness: 0.4, emissiveMap: planTexture(c.copy.securityRoom), emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.25 });
    f.box(S.alu, 0, 1.92, 0.01, 0.84, 0.84, 0.02);
    c.batch.add(room, once(`seg-planMat-${c.copy.securityRoom}`, () => pm), geo("plane", () => new THREE.PlaneGeometry(1, 1)), f.m(0, 2.34, 0.021, 0, 0.8, 0.8, 1));
  }
  {
    const f = Fr.at(c, room, -19.6, 0, 2.0, 0);
    f.box(S.alu, 0, 1.2, 0.01, 1.1, 0.7, 0.02); f.box(S.white, 0, 1.22, 0.021, 1.06, 0.66, 0.002);
    signOn(c, f, "duty", -0.12, 1.55, 0.022, 0.5, { depth: 0.001 });
    f.box(S.alu, 0, 1.16, 0.05, 1.0, 0.025, 0.06); for (let k = 0; k < 3; k++) f.i("seg-marker", CYL(8), [S.plasticBlack, S.plasticRed, S.plasticBlue][k], 0.2 + k * 0.08, 1.2, 0.06, 0, 0.009, 0.12, 0.009, 0, Math.PI / 2);
  }
  wallClock(c, room, -18.95, 2.62, 2.02, 0, 11, 4);
  sign(c, room, "monitoring", -18.505, 2.82, 4.75, -Math.PI / 2, 0.16);
  // quadro de chaves (parede oeste, entre os racks e o quadro de luz): armário com porta de vidro, ganchos e chaveiros
  {
    const f = Fr.at(c, room, -22, 0, 3.6, Math.PI / 2);
    f.rbox(S.paintGrey, 0, 1.25, 0.04, 0.56, 0.66, 0.08, 0.008); f.box(S.paintCream, 0, 1.28, 0.081, 0.5, 0.6, 0.002);
    for (let k = 0; k < 20; k++) {
      const x = -0.2 + (k % 5) * 0.1, y = 1.82 - Math.floor(k / 5) * 0.15;
      f.i("seg-hook", CYL(6), S.chrome, x, y, 0.09, 0, 0.003, 0.025, 0.003, Math.PI / 2, 0);
      if (R() > 0.2) { f.i("seg-key", BOX0(), S.brass, x, y - 0.06, 0.094, 0, 0.012, 0.05, 0.003); f.i("seg-keyTag", BOX0(), [S.plasticYellow, S.plasticRed, S.plasticBlue, S.plasticGreen][k % 4], x, y - 0.1, 0.095, 0, 0.025, 0.035, 0.004); }
    }
    f.box(S.glassClear, 0, 1.25, 0.084, 0.54, 0.64, 0.004);
  }
  // eletrocalha no alto da parede oeste: dos racks até o console
  { const f = Fr.at(c, room, -21.75, 2.92, 4.75, 0); f.box(S.galv, 0, 0, 0, 0.25, 0.004, 5.4); for (const s of [-1, 1]) f.box(S.galv, s * 0.123, 0, 0, 0.004, 0.055, 5.4); f.cylZ(S.cable, -0.05, 0.022, 0, 0.018, 5.4, 8); f.cylZ(S.cableGrey, 0.05, 0.02, 0, 0.014, 5.4, 8); }
  // cadeiras de escritório giratórias (decoração: uma no console, uma afastada da mesa)
  for (const [x, z, ry] of [[-21.0, 6.45, -Math.PI / 2 + 0.4], [-19.85, 6.2, 2.7]] as [number, number, number][]) {
    const f = Fr.at(c, room, x, 0, z, ry);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; f.i("seg-chairLeg", BOX0(), S.steelBlack, Math.sin(a) * 0.15, 0.06, Math.cos(a) * 0.15, a, 0.03, 0.03, 0.3); f.i("seg-chairWheel", SPH(8), S.plasticBlack, Math.sin(a) * 0.29, 0.03, Math.cos(a) * 0.29, 0, 0.03); }
    f.cyl(S.chrome, 0, 0.08, 0, 0.025, 0.36, 10);
    f.rbox(fabric("seg-chairFab", "#1f2227", c.q), 0, 0.44, 0, 0.5, 0.08, 0.48, 0.03);
    f.rbox(fabric("seg-chairFab", "#1f2227", c.q), 0, 0.55, -0.22, 0.46, 0.55, 0.06, 0.03);
    for (const s of [-1, 1]) f.box(S.plasticBlack, s * 0.25, 0.5, -0.02, 0.04, 0.2, 0.3);
  }
  cctvCam(c, room, -18.52, 2.95, 7.25, -Math.PI / 2, -Math.PI * 0.8);
  beacon(c, room, -21.9, 2.9, 6.3, 1, 0);
}

/** Sombra da luminária do forro (só "high"). */
const KEYS = [{ p: [-20.25, 3.1, 4.75] as [number, number, number], aim: [-20.4, 0, 5.0] as [number, number, number], angle: 1.25, i: 18, color: "#eef4ff" }];
const wallSeg = (q: Quality) => pbrMat(`seg-wall-pintura-${q}`, texPaintSeg(q), { vertex: true, env: 0.5 });

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = {
  id: "seguranca", rooms: ["seguranca"], dress: seguranca,
  props: {
    monitor: monitorConsole, safe, panel: fusePanel,
    fixture: (p, c) => { if (p.model === "segCoord") coordDesk(p, c); else if (p.model === "segRack") racks(p, c); else if (p.model === "segCafe") cafe(p, c); },
  },
  surfaces: { seguranca: { wall: wallSeg, wallTile: [2, 3.2] } },
  keys: { seguranca: KEYS },
};
