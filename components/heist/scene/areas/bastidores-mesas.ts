/*
 * MET Gala Heist v2 — bastidores (Z11): as mesas da produção e os monitores, na forma de colisão da planta — mesa da
 * produção diante dos monitores (notebooks, intercom, timecode, headsets, luminária azul), mesa da folha de chamada
 * (a pista) e a parede de monitores do palco com a tela do programa. Saiu de bastidores-moveis.ts sem mudança.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { CYL0, SPH, geo } from "../interior-batch";
import { glow, solid } from "../interior-mats";
import { SANS, drawnTexture, rand } from "../interior-tex";
import { callSheetTexture, cctvTexture, foot, type PropsCtx } from "../interior-props";
import { Fr, SM, lathe, light, rbox, tube } from "./servico-kit";
import { COL, TINT, room } from "./bastidores-tinta";

/* ======================= mesas da produção e monitores ======================= */
function tableFrame(f: Fr, S: ReturnType<typeof SM>, w: number, d: number, h: number, skirtSides: ("front" | "back" | "left" | "right")[]) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.i("bk-tableLeg", CYL0(8), S.steelBlack, sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06), 0, 0.016, h - 0.03, 0.016);
  f.rbox(solid("bk-tableTop", "#1a1a1c", { rough: 0.5 }), 0, h - 0.03, 0, w, 0.03, d, 0.008, 0, true);
  const skirt = solid("bk-skirtMat", "#0c0c0d", { rough: 0.95, side: THREE.DoubleSide });
  for (const s of skirtSides) {
    const alongX = s === "front" || s === "back", sign = s === "front" || s === "right" ? 1 : -1;
    f.g(skirt, geo(`bk-skirtGeo-${alongX ? w.toFixed(2) : d.toFixed(2)}`, () => { const L = alongX ? w : d, g = new THREE.PlaneGeometry(L, h - 0.04, Math.round(L * 30), 1); const p = g.getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) p.setZ(i, 0.012 * Math.sin(p.getX(i) * 40)); g.translate(0, (h - 0.04) / 2, 0); g.computeVertexNormals(); return g; }),
      alongX ? 0 : sign * (w / 2 + 0.005), 0.02, alongX ? sign * (d / 2 + 0.005) : 0, alongX ? (sign > 0 ? 0 : Math.PI) : sign * Math.PI / 2);
  }
}
/** Notebook aberto (tela acesa) no referencial `f`, olhando para −z local (para quem usa). */
function laptop(f: Fr, S: ReturnType<typeof SM>, x: number, y: number, z: number, ry: number, screen: THREE.Material) {
  const g = f.sub(x, y, z, ry);
  g.rbox(S.alu, 0, 0, 0, 0.34, 0.016, 0.24, 0.006); g.box(S.plasticBlack, 0, 0.0165, -0.02, 0.29, 0.001, 0.11);
  const lid = g.sub(0, 0.016, 0.12, 0, 0.32);
  lid.rbox(S.alu, 0, 0, -0.006, 0.34, 0.23, 0.012, 0.006); lid.box(screen, 0, 0.012, -0.0125, 0.31, 0.2, 0.001);
}
/** Mesa da produção diante dos monitores (desk variante 1): notebooks, central de intercom, relógio de timecode,
 * headsets, roteiro, rádios e a luminária azul de bastidor. */
export function productionDesk(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d, R = rand(631);
  tableFrame(f, S, w, d, 0.74, ["front", "left", "right"]);
  const scr = glow("bk-laptopScreen", "#8fb8ff", 1.3);
  laptop(f, S, -0.75, 0.74, 0.05, 0, scr); laptop(f, S, 0.6, 0.74, 0.08, 0.15, scr);
  // central de intercom (comunicação com o palco): caixa com botões, LEDs e o microfone de haste
  const ic = f.sub(-0.1, 0.74, 0.18, Math.PI);
  ic.rbox(S.plasticBlack, 0, 0, 0, 0.44, 0.09, 0.22, 0.01); ic.box(S.steelBlack, 0, 0.06, 0.111, 0.42, 0.03, 0.002);
  for (let k = 0; k < 8; k++) { ic.i("bk-icBtn", rbox(0.03, 0.012, 0.03, 0.004), k % 3 ? S.plasticGrey : S.plasticRed, -0.18 + k * 0.05, 0.09, -0.04); ic.i("bk-led", SPH(5), glow(k % 3 ? "bk-ledGreen" : "bk-ledRed", k % 3 ? "#3dff73" : "#ff3030", 2.3), -0.18 + k * 0.05, 0.075, 0.112, 0, 0.004); }
  ic.g(S.plasticBlack, tube([[0.17, 0.09, 0.0], [0.17, 0.25, 0.02], [0.14, 0.33, -0.08]], 0.005, 12, 5), 0, 0, 0); ic.g(S.plasticBlack, SPH(8), 0.14, 0.335, -0.09, 0, 0.012, 0.012, 0.025);
  // relógio de timecode (dígitos vermelhos)
  const tcTex = drawnTexture("bk-timecode", 256, 64, (g, W, H) => { g.fillStyle = "#050505"; g.fillRect(0, 0, W, H); g.fillStyle = "#ff3324"; g.font = `700 44px monospace`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("23:04:17", W / 2, H / 2 + 2); });
  const tc = f.sub(0.15, 0.74, -0.25, Math.PI);
  tc.rbox(S.plasticBlack, 0, 0, 0, 0.26, 0.08, 0.08, 0.008); c.batch.add(room, new THREE.MeshBasicMaterial({ map: tcTex, color: new THREE.Color(1.6, 1.6, 1.6) }), geo("plane", () => new THREE.PlaneGeometry(1, 1)), tc.m(0, 0.04, 0.041, 0, 0.22, 0.055, 1));
  // headsets, roteiro (fichário aberto), rádios, garrafas e cabos descendo
  for (const x of [-1.2, 1.15]) { const h = f.sub(x, 0.78, -0.1, R()); h.g(S.plasticBlack, geo("bk-headband", () => new THREE.TorusGeometry(0.085, 0.008, 6, 20, Math.PI)), 0, 0, 0, 0, 1, 1, 1, Math.PI / 2, 0); for (const s of [-1, 1]) h.g(S.plasticBlack, SPH(10), s * 0.085, -0.01, 0, 0, 0.04, 0.03, 0.04); }
  f.box(S.plasticBlack, 0.95, 0.74, -0.15, 0.32, 0.03, 0.27, 0.2); f.box(S.paper, 0.88, 0.771, -0.15, 0.15, 0.003, 0.25, 0.2); f.box(S.paper, 1.03, 0.771, -0.12, 0.15, 0.003, 0.25, 0.2);
  for (let k = 0; k < 2; k++) { f.rbox(S.plasticBlack, -0.35 + k * 0.08, 0.74, -0.22, 0.06, 0.17, 0.035, 0.008); f.cyl(S.plasticBlack, -0.335 + k * 0.08, 0.91, -0.22, 0.006, 0.09, 6); }
  for (let k = 0; k < 2; k++) f.g(S.glassClear, lathe("waterBtl", [[0, 0], [0.033, 0], [0.034, 0.18], [0.015, 0.22], [0.015, 0.25], [0, 0.25]], 12), 1.25 - k * 0.08, 0.74, 0.22);
  for (let k = 0; k < 3; k++) f.g(S.cable, tube([[-0.9 + k * 0.6, 0.74, 0.3], [-0.92 + k * 0.6, 0.5, 0.42], [-0.85 + k * 0.6, 0.02, 0.5]], 0.007, 12, 5), 0, 0, 0);
  // luminária azul de bastidor (gooseneck) sobre o roteiro
  f.cyl(S.steelBlack, 1.3, 0.74, 0.25, 0.05, 0.02, 12); f.g(S.steelBlack, tube([[1.3, 0.76, 0.25], [1.3, 1.0, 0.2], [1.2, 1.12, 0.05], [1.08, 1.08, -0.05]], 0.006, 16, 5), 0, 0, 0);
  f.g(glow("bk-blueLamp", "#4f74ff", 2.6), SPH(8), 1.07, 1.06, -0.06, 0, 0.03, 0.015, 0.03);
  light(c, room, f.p(1.05, 1.0, -0.1), "#5f7fff", 1.4, 2.2); light(c, room, f.p(0, 1.05, -0.3), "#9fc6ff", 1.6, 2.6);
}
/** Mesa da folha de chamada (desk variante 2): a folha (a pista) no mesmo lugar de sempre, notebook, prancheta,
 * fitas gaffer coloridas, cronômetro, rádios e o fichário do contrarregra. */
export function callDesk(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d;
  tableFrame(f, S, w, d, 0.74, ["front", "left", "right"]);
  const sheet = new THREE.MeshStandardMaterial({ map: callSheetTexture(c.copy), roughness: 0.9, emissiveMap: callSheetTexture(c.copy), emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.12 });
  c.batch.add(room, sheet, geo("planeUp", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), f.m(-0.05, 0.765, -0.24, Math.PI, 0.3, 1, 0.41));
  laptop(f, S, 0.62, 0.74, 0.05, 0.2, glow("bk-laptopScreen", "#8fb8ff", 1.3));
  f.rbox(S.wood, -0.55, 0.74, -0.05, 0.24, 0.012, 0.33, 0.004, 0.25); f.box(S.chrome, -0.55, 0.755, -0.2, 0.08, 0.012, 0.03, 0.25); f.box(S.paper, -0.55, 0.754, -0.04, 0.21, 0.002, 0.28, 0.25);
  for (let k = 0; k < 4; k++) c.inst.add(room, "bk-tapeRollC", geo("bk-tapeRoll", () => new THREE.TorusGeometry(0.045, 0.02, 8, 20).rotateX(Math.PI / 2)), TINT(), f.m(-1.0 + k * 0.1, 0.765, 0.25), COL(["#f2f2f2", "#f1c21b", "#e2387f", "#2e9bff"][k]));
  for (let k = 0; k < 3; k++) { f.rbox(S.plasticBlack, 0.1 + k * 0.08, 0.74, 0.28, 0.06, 0.17, 0.035, 0.008); f.cyl(S.plasticBlack, 0.115 + k * 0.08, 0.91, 0.28, 0.006, 0.09, 6); }
  f.cyl(S.plasticYellow, 0.95, 0.74, -0.25, 0.035, 0.02, 14); f.box(S.plasticBlack, 1.05, 0.74, 0.2, 0.3, 0.05, 0.24, 0.1);
  f.g(S.glassClear, lathe("waterBtl", [[0, 0], [0.033, 0], [0.034, 0.18], [0.015, 0.22], [0.015, 0.25], [0, 0.25]], 12), -0.85, 0.74, -0.3);
  light(c, room, f.p(0, 1.6, -0.3), "#fff0d0", 2.8, 3);
}
/** Parede de monitores do palco (screen): quadro de perfilado, três telas das câmeras e a tela do programa (a passarela). */
export function monitorWall(p: Prop, c: PropsCtx) {
  const S = SM(c.q), F = foot(p), f = Fr.at(c, room, F.cx, 0, F.cz, F.yaw), w = F.w, d = F.d;
  for (const x of [-w / 2 + 0.1, 0, w / 2 - 0.1]) f.box(S.steelBlack, x, 0.9, -d / 2 + 0.03, 0.04, 1.45, 0.04);
  for (const y of [1.18, 1.72]) f.box(S.steelBlack, 0, y, -d / 2 + 0.05, w - 0.1, 0.04, 0.03);
  const sw = (w - 0.3) / 3;
  for (let k = 0; k < 3; k++) {
    const x = -w / 2 + 0.15 + (k + 0.5) * sw;
    f.rbox(S.plasticBlack, x, 1.12, -d / 2 + 0.1, sw - 0.06, 0.5, 0.05, 0.008);
    const m = new THREE.Mesh(geo("plane", () => new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: cctvTexture(10 + k), color: new THREE.Color(1.3, 1.3, 1.3) }));
    m.matrixAutoUpdate = false; m.matrix.copy(f.m(x, 1.37, -d / 2 + 0.126, 0, sw - 0.1, 0.44, 1)); c.group.add(m); m.userData.room = room; c.animated.push({ kind: "cctv", mesh: m, room });
  }
  const prog = drawnTexture("bk-program", 512, 288, (g, W, H) => {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1a0a1e"); bg.addColorStop(1, "#05040a"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = "#2a1a2e"; g.beginPath(); g.moveTo(W * 0.42, H * 0.3); g.lineTo(W * 0.58, H * 0.3); g.lineTo(W * 0.85, H); g.lineTo(W * 0.15, H); g.closePath(); g.fill();
    for (let k = 0; k < 6; k++) { const gr = g.createRadialGradient(W * (0.2 + k * 0.12), 0, 2, W * (0.2 + k * 0.12), H * 0.5, H * 0.7); gr.addColorStop(0, "rgba(255,230,190,0.5)"); gr.addColorStop(1, "rgba(255,230,190,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    g.fillStyle = "#f2e6d0"; g.beginPath(); g.ellipse(W / 2, H * 0.62, 16, 52, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(W / 2, H * 0.43, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ff3030"; g.beginPath(); g.arc(22, 22, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = "#ffffff"; g.font = `700 18px ${SANS}`; g.fillText("PGM", 36, 28);
  });
  f.rbox(S.plasticBlack, 0, 1.78, -d / 2 + 0.08, 0.7, 0.42, 0.05, 0.008);
  c.batch.add(room, new THREE.MeshBasicMaterial({ map: prog, color: new THREE.Color(1.25, 1.25, 1.25) }), geo("plane", () => new THREE.PlaneGeometry(1, 1)), f.m(0, 1.99, -d / 2 + 0.106, 0, 0.64, 0.36, 1));
  light(c, room, f.p(0, 1.5, 0.8), "#9fd8ff", 1.8, 3);
}
