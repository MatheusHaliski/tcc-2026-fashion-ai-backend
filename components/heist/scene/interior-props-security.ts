/*
 * MET Gala Heist v2 — segurança e serviço (interior-props.ts): mesa de monitores, cofre do cartão e quadro de luz da sala
 * de segurança, engradados e cases da doca, detector de metais e pedestais com cordão de veludo.
 */
import * as THREE from "three";
import { BOX0, CYL0, SPH, geo } from "./interior-batch";
import { solid } from "./interior-mats";
import { rand } from "./interior-tex";
import type { Prop } from "@/lib/heist/types";
import type { InteriorRoom } from "./interior-shell";
import type { Foot, PropsCtx } from "./interior-props";
import { L, anchor, box, lathe, worldOf } from "./interior-props-kit";
import { cctvTexture } from "./interior-props-textures";

/** Mesa de monitores da sala de segurança: seis telas de câmeras sobre a bancada, teclado, rádio, café. */
export function monitorDesk(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  box(c, room, P.darkSteel, f, 0, 0, 0, f.w, 0.74, f.d, { cast: true });
  box(c, room, P.black, f, 0, 0.74, 0, f.w + 0.02, 0.03, f.d + 0.02);
  for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
    const x = -f.w / 2 + (k + 0.5) * (f.w / 3), y = 0.95 + r * 0.42;
    box(c, room, P.black, f, x, y, -f.d / 2 + 0.12, f.w / 3 - 0.04, 0.38, 0.05, { ry: 0 });
    const mesh = new THREE.Mesh(geo("plane", () => new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: cctvTexture(r * 3 + k), color: new THREE.Color(1.25, 1.25, 1.25) }));
    mesh.matrixAutoUpdate = false; mesh.matrix.copy(L(f, x, y + 0.19, -f.d / 2 + 0.147, 0, f.w / 3 - 0.08, 0.33, 1)); c.group.add(mesh); mesh.userData.room = room;
    c.animated.push({ kind: "cctv", mesh, room });
  }
  box(c, room, P.black, f, 0, 0.77, 0.15, 0.45, 0.02, 0.15);
  c.inst.add(room, "radio", BOX0(), P.black, L(f, 0.5, 0.77, 0.2, 0, 0.06, 0.2, 0.04));
  c.inst.add(room, "coffee", CYL0(10), P.paperWhite, L(f, -0.5, 0.77, 0.2, 0, 0.04, 0.11, 0.04));
  anchor(c, room, worldOf(f, 0, 1.3, 0.5), "#7fe0a8", 2.2, 3);
}
/** Cofre do cartão (sala de segurança): aço com teclado, maçaneta em roda e LED. */
export function safe(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  box(c, room, solid("safeSteel", "#3b3f45", { metal: 0.85, rough: 0.35 }), f, 0, 0, 0, f.w, 1.0, f.d, { cast: true });
  box(c, room, solid("safeDoor", "#4a4f56", { metal: 0.85, rough: 0.3 }), f, 0, 0.06, f.d / 2, f.w - 0.08, 0.88, 0.02);
  c.batch.add(room, P.chrome, geo("safeWheel", () => new THREE.TorusGeometry(0.09, 0.012, 6, 20)), L(f, 0.12, 0.5, f.d / 2 + 0.03));
  box(c, room, P.black, f, -0.2, 0.6, f.d / 2 + 0.02, 0.12, 0.16, 0.015);
  c.inst.add(room, "ledRed", SPH(6), P.ledRed, L(f, -0.2, 0.72, f.d / 2 + 0.03, 0, 0.008));
}
/** Quadro de luz: caixa cinza com disjuntores, etiquetas de alerta e eletrodutos subindo para o teto. */
export function fusePanel(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  box(c, room, solid("panelGrey", "#8a8f93", { metal: 0.6, rough: 0.5 }), f, 0, 0.9, 0, f.w, 1.2, f.d, { cast: true });
  box(c, room, P.darkSteel, f, 0, 1.0, f.d / 2, f.w - 0.12, 1.0, 0.01);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) c.inst.add(room, "breaker", BOX0(), P.black, L(f, -f.w / 2 + 0.28 + k * ((f.w - 0.56) / 2), 1.15 + r * 0.28, f.d / 2 + 0.012, 0, 0.12, 0.14, 0.02));
  box(c, room, P.yellow, f, 0, 1.92, f.d / 2 + 0.002, 0.4, 0.12, 0.004);
  for (const x of [-0.25, 0, 0.25]) c.batch.add(room, P.steel, CYL0(8), L(f, x, 2.1, 0, 0, 0.025, 1.3, 0.025));
}

/** Caixas da doca: engradados de pinho (altos e baixos) e cases de bufê pretos com cantoneiras. */
export function crate(c: PropsCtx, room: InteriorRoom, f: Foot, h: Prop["height"], variant: number, id: string) {
  const P = c.P, H = h === "tall" ? 1.95 : 0.95, R = rand(id.length * 19 + id.charCodeAt(id.length - 1));
  if (variant === 2) {
    // pilha de cases de bufê
    const layers = Math.round(H / 0.48);
    for (let k = 0; k < layers; k++) {
      const y = k * 0.48, ry = (R() - 0.5) * 0.05;
      box(c, room, solid("flightCase", "#16171a", { rough: 0.55 }), f, 0, y, 0, f.w - 0.02, 0.46, f.d - 0.02, { cast: true, ry });
      for (const s of [-1, 1]) for (const t of [-1, 1]) c.inst.add(room, "corner", BOX0(), P.steel, L(f, s * (f.w / 2 - 0.02), y, t * (f.d / 2 - 0.02), ry, 0.06, 0.46, 0.06));
    }
    return;
  }
  const n = h === "tall" ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const y = k * (H / n), sh = H / n;
    box(c, room, P.crateWood, f, 0, y, 0, f.w - 0.02, sh - 0.02, f.d - 0.02, { cast: true });
    for (const s of [-1, 1]) box(c, room, P.crateWood, f, s * (f.w / 2 - 0.04), y + 0.02, f.d / 2 - 0.005, 0.09, sh - 0.06, 0.02);
    c.batch.add(room, solid("stencil", "#1e1e1e", { rough: 0.9 }), BOX0(), L(f, 0, y + sh * 0.45, f.d / 2 + 0.002, 0, 0.4, 0.12, 0.002));
  }
}

/** Detector de metais: coluna com barras de LED (a viga liga as duas colunas por cima — interior-rooms). */
export function detector(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  box(c, room, solid("detectorGrey", "#c9cbcd", { rough: 0.4 }), f, 0, 0, 0, f.w, 2.25, f.d, { cast: true });
  for (let k = 0; k < 8; k++) c.inst.add(room, "detLed", BOX0(), P.ledGreen, L(f, 0, 0.4 + k * 0.2, f.d / 2 + 0.002, 0, f.w * 0.5, 0.05, 0.004));
}
/** Pedestais de latão com cordão de veludo vermelho. */
export function rope(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const alongX = f.w >= f.d, len = Math.max(f.w, f.d), n = Math.max(2, Math.round(len / 1.3) + 1), P = c.P;
  const post = lathe("stanchion", [[0, 0], [0.16, 0], [0.16, 0.02], [0.04, 0.05], [0.025, 0.08], [0.025, 0.9], [0.045, 0.93], [0.05, 0.98], [0, 1.0]], 18);
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < n; k++) { const t = -len / 2 + 0.08 + (k / (n - 1)) * (len - 0.16), x = alongX ? t : 0, z = alongX ? 0 : t; c.batch.add(room, P.brass, post, L(f, x, 0, z)); pts.push(worldOf(f, x, 0.9, z)); }
  for (let k = 0; k < n - 1; k++) {
    const a = pts[k], b = pts[k + 1], mid = a.clone().lerp(b, 0.5); mid.y -= 0.16;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    c.batch.add(room, P.velvetRed, new THREE.TubeGeometry(curve, 12, 0.022, 6, false));
  }
}
