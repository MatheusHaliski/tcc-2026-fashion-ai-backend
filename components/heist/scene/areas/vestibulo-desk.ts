/*
 * MET Gala Heist v2 — Vestíbulo: o balcão curvo de credenciamento "Nocturne" (laca negra com aletas de latão, tampo de
 * nero, gavetas do lado da recepção, livro de presença, leitores de QR, pulseiras em bandejas, tablet, orquídea e a
 * luminária) e a placa pendurada sobre ele.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { BOX0, CYL, CYL0, SPH, mat, mul } from "../interior-batch";
import { foot } from "../interior-props";
import { ROOM, VM, lathe, prism, raisedPanel, vCopy, vFabric, vGeo, vGlow, vMat, vSolid, vTex, type VPalette } from "./vestibulo-kit";
import { L, PLANE_UP, PLANE_V, W, light, type Ctx, type Foot } from "./vestibulo-furniture-kit";

/* ======================= balcão de credenciamento "Nocturne" ======================= */
/** Arco da frente (convexo para a entrada): corda 3 m, flecha 0,28 m; a recepcionista fica do lado de trás (−z local). */
export function desk(p: Prop, c: Ctx) {
  const f = foot(p), V = VM(c.q), half = f.w / 2, sag = 0.28, R = (half * half + sag * sag) / (2 * sag), cz = f.d / 2 - R, depth = 0.66;
  const arc = (r: number, n = 24): [number, number][] => { const a = Math.asin(half / R), out: [number, number][] = []; for (let i = 0; i <= n; i++) { const t = -a + (i / n) * 2 * a; out.push([Math.sin(t) * r, cz + Math.cos(t) * r]); } return out; };
  const band = (r0: number, r1: number) => [...arc(r1), ...arc(r0).reverse()];
  const P = (pts: [number, number][], y0: number, y1: number) => prism(pts, y0, y1);
  const add = (m: THREE.Material, g: THREE.BufferGeometry, x = 0, y = 0, z = 0, cast = false) => c.batch.add(ROOM, m, g, L(f, x, y, z), { cast });
  // rodapé recuado de nero com a fita de luz embaixo (o balcão "flutua"), corpo de laca negra e o tampo alto de nero
  add(V.nero, vGeo(`deskPlinth${f.w}`, () => P(band(R - depth + 0.05, R - 0.05), 0, 0.1)));
  c.inst.add(ROOM, "vestibulo-deskLed", BOX0(), vGlow("deskLed", "#ffcf8a", 1.8), L(f, 0, 0.1, f.d / 2 - 0.1, 0, f.w - 0.5, 0.008, 0.02));
  add(V.blackLacquer, vGeo(`deskBody${f.w}`, () => P(band(R - depth, R), 0.1, 1.04)), 0, 0, 0, true);
  add(V.nero, vGeo(`deskTop${f.w}`, () => P(band(R - 0.3, R + 0.06), 1.04, 1.1)), 0, 0, 0, true);
  add(V.brass, vGeo(`deskEdge${f.w}`, () => P(band(R + 0.055, R + 0.07), 1.035, 1.105)));
  add(V.brass, vGeo(`deskKick${f.w}`, () => P(band(R - 0.002, R + 0.008), 0.1, 0.14)));
  // aletas verticais de latão na frente curva (a cada ~19 cm) e a faixa dourada no alto
  const a0 = Math.asin(half / R);
  for (let k = 1; k < 16; k++) { const t = -a0 + (k / 16) * 2 * a0; c.inst.add(ROOM, "vestibulo-deskFin", BOX0(), V.brass, mul(L(f, Math.sin(t) * (R + 0.012), 0.16, cz + Math.cos(t) * (R + 0.012)), mat(0, 0, 0, t, 0.022, 0.84, 0.024))); }
  add(V.gilt, vGeo(`deskBand${f.w}`, () => P(band(R - 0.001, R + 0.006), 0.96, 0.99)));
  // lado de trás: mesa de trabalho a 0,76 m em nogueira com quatro gaveteiros e puxadores de latão
  add(V.walnut, vGeo(`deskWork${f.w}`, () => P(band(R - depth - 0.14, R - depth + 0.02), 0.73, 0.77)), 0, 0, 0, true);
  for (const x of [-1.05, -0.35, 0.35, 1.05]) {
    const t = Math.asin(x / (R - depth)), zz = cz + Math.cos(t) * (R - depth) - 0.02;
    for (let k = 0; k < 3; k++) {
      c.batch.add(ROOM, V.walnut, raisedPanel("drawer", 0.52, 0.16, 0.014, 0.006), mul(L(f, x, 0.21 + k * 0.19, zz), mat(0, 0, 0, Math.PI - t)));
      c.inst.add(ROOM, "vestibulo-drawerPull", CYL(10), V.brass, mul(L(f, x, 0.21 + k * 0.19, zz - 0.03), mat(0, 0, 0, -t, 0.008, 0.14, 0.008, 0, Math.PI / 2)));
    }
  }
  // sobre o tampo: livro de presença aberto com caneta, leitores de QR, bandejas de pulseiras, tablet, orquídea
  const book = guestBookTexture(c);
  const pageM = vMat("guestBookMat", () => new THREE.MeshStandardMaterial({ map: book, roughness: 0.85 }));
  c.batch.add(ROOM, V.leather, BOX0(), L(f, -0.15, 1.1, 0.12, 0.12, 0.52, 0.018, 0.36));
  c.batch.add(ROOM, pageM, vGeo("bookPages", () => { const g = new THREE.PlaneGeometry(0.48, 0.32, 8, 1), pp = g.getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < pp.count; i++) pp.setZ(i, 0.012 * Math.sin(Math.abs(pp.getX(i)) / 0.24 * Math.PI * 0.5 + Math.PI * 0.5) + 0.004); g.rotateX(-Math.PI / 2); return g; }), L(f, -0.15, 1.12, 0.12, 0.12));
  c.batch.add(ROOM, V.blackLacquer, CYL(8), L(f, 0.05, 1.135, 0.2, 0.7, 0.005, 0.15, 0.005, 0, Math.PI / 2));
  c.batch.add(ROOM, V.gilt, CYL(8), L(f, 0.0, 1.135, 0.18, 0.7, 0.0055, 0.03, 0.0055, 0, Math.PI / 2));
  for (const x of [-1.05, 0.65]) qrReader(c, V, f, x, 1.1, 0.0);
  for (const [x, col] of [[0.25, "#f3d06a"], [0.42, "#e8e2d6"]] as [number, string][]) {
    c.batch.add(ROOM, V.brass, lathe("tray", [[0, 0], [0.09, 0], [0.1, 0.012], [0.095, 0.016], [0, 0.006]], 20), L(f, x, 1.1, 0.05, 0, 1, 1, 1));
    for (let k = 0; k < 9; k++) c.inst.add(ROOM, "vestibulo-wristband", vGeo("wristbandGeo", () => new THREE.TorusGeometry(0.03, 0.006, 4, 14).rotateX(Math.PI / 2).scale(1, 1, 0.5)), vFabric(`band-${col}`, col, c.q), L(f, x + (k % 3 - 1) * 0.045, 1.11 + Math.floor(k / 3) * 0.006, 0.05 + (Math.floor(k / 3) - 1) * 0.04, k));
  }
  c.batch.add(ROOM, V.bronze, BOX0(), L(f, 0.95, 1.1, -0.12, -0.25 + Math.PI, 0.05, 0.12, 0.04));
  c.batch.add(ROOM, V.blackMatte, BOX0(), L(f, 0.95, 1.2, -0.11, -0.25 + Math.PI, 0.26, 0.18, 0.012, -0.35));
  c.batch.add(ROOM, vGlow("tabletScreen", "#a8c8ff", 0.9), PLANE_UP(), L(f, 0.95, 1.29, -0.104, Math.PI - 0.25, 0.24, 1, 0.16, Math.PI / 2 - 0.35));
  orchid(c, V, f, 1.25, 1.1, -0.05);
  // luminária de mesa de latão com cúpula verde na mesa de trabalho (ilumina o livro)
  c.batch.add(ROOM, V.brass, lathe("deskLampV", [[0, 0], [0.08, 0], [0.08, 0.015], [0.012, 0.03], [0.012, 0.36], [0, 0.36]], 14), L(f, -0.95, 0.77, -0.46));
  c.batch.add(ROOM, vSolid("lampShadeGreen", "#0d4a2e", { rough: 0.22, env: 1.2, side: THREE.DoubleSide }), vGeo("lampShadeV", () => new THREE.CylinderGeometry(0.035, 0.13, 0.1, 18, 1, true)), L(f, -0.95, 1.15, -0.42, 0, 1, 1, 1, 0.15));
  c.inst.add(ROOM, "vestibulo-deskLampBulb", SPH(8), V.bulb, L(f, -0.95, 1.12, -0.42, 0, 0.03));
  light(c, W(f, -0.6, 1.4, -0.2), "#ffdcaa", 3.2, 3.2);
  // placa pendurada sobre o balcão: vidro negro com letras douradas, presa por duas correntes ao teto
  const tx = vCopy(c.copy);
  const sign = vTex(`deskSign-${tx.checkin}`, 1024, 256, (g, w, h) => {
    g.fillStyle = "#08080a"; g.fillRect(0, 0, w, h); g.strokeStyle = "#c9a24b"; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = "#e3c27a"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `600 ${Math.round(h * 0.38)}px 'Didot', 'Bodoni 72', Georgia, 'DejaVu Serif', serif`; g.fillText(tx.checkin, w / 2, h * 0.52);
  });
  const sm = vMat(`deskSignMat-${tx.checkin}`, () => new THREE.MeshStandardMaterial({ map: sign, roughness: 0.15, metalness: 0.2, emissiveMap: sign, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.25 }));
  c.batch.add(ROOM, V.brass, BOX0(), L(f, 0, 3.0, 0.0, 0, 2.06, 0.56, 0.035));
  for (const s of [1, -1]) c.batch.add(ROOM, sm, PLANE_V(), L(f, 0, 3.28, s * 0.0185, s > 0 ? 0 : Math.PI, 2.0, 0.5, 1));
  for (const x of [-0.85, 0.85]) c.batch.add(ROOM, V.brass, CYL0(6), L(f, x, 3.56, 0, 0, 0.006, 6.5 - 3.56, 0.006));
}
/** Páginas do livro de presença: duas colunas manuscritas com assinaturas. */
function guestBookTexture(c: Ctx): THREE.Texture {
  const tx = vCopy(c.copy);
  return vTex(`guestBook-${tx.guestBook}`, 1024, 680, (g, w, h) => {
    g.fillStyle = "#f4ecd9"; g.fillRect(0, 0, w, h);
    const sh = g.createLinearGradient(w / 2 - 40, 0, w / 2 + 40, 0); sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(0.5, "rgba(80,60,30,0.35)"); sh.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = sh; g.fillRect(w / 2 - 40, 0, 80, h);
    g.fillStyle = "#6a1418"; g.font = `600 30px 'Didot', Georgia, serif`; g.textAlign = "center"; g.fillText(tx.guestBook, w * 0.25, 52); g.fillText("Gala Lumière", w * 0.75, 52);
    g.strokeStyle = "rgba(120,100,70,0.35)"; g.lineWidth = 1.5;
    for (let y = 90; y < h - 20; y += 34) for (const x0 of [30, w / 2 + 30]) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w / 2 - 70, y); g.stroke(); }
    g.strokeStyle = "#1b2a52"; g.lineWidth = 2.2;
    for (let k = 0; k < 22; k++) {
      const col = k < 12 ? 0 : 1, row = k % 12, x0 = col * w / 2 + 40 + (row % 3) * 20, y0 = 84 + row * 34;
      g.beginPath(); g.moveTo(x0, y0); for (let i = 1; i < 24; i++) g.lineTo(x0 + i * (8 + (k % 5)), y0 - 6 * Math.sin(i * 0.9 + k) - (i % 4 === 0 ? 8 : 0)); g.stroke();
    }
  });
}
/** Leitor de QR de balcão: base de bronze, coluna, cabeça inclinada com vidro escuro e o LED verde. */
function qrReader(c: Ctx, V: VPalette, f: Foot, x: number, y: number, z: number) {
  c.batch.add(ROOM, V.bronze, lathe("qrBase", [[0, 0], [0.06, 0], [0.06, 0.012], [0.02, 0.02], [0, 0.02]], 16), L(f, x, y, z));
  c.batch.add(ROOM, V.bronze, CYL0(10), L(f, x, y + 0.02, z, 0, 0.012, 0.12, 0.012));
  c.batch.add(ROOM, V.blackMatte, BOX0(), L(f, x, y + 0.13, z, 0, 0.1, 0.035, 0.08, 0.5));
  c.batch.add(ROOM, vSolid("qrGlass", "#101820", { rough: 0.05, metal: 0.3, env: 1.4 }), BOX0(), L(f, x, y + 0.135, z + 0.012, 0, 0.07, 0.03, 0.05, 0.5));
  c.inst.add(ROOM, "vestibulo-qrLed", SPH(6), V.ledGreen, L(f, x + 0.035, y + 0.16, z + 0.03, 0, 0.005));
}
/** Orquídea branca num cachepô de nero: hastes arqueadas com flores. */
function orchid(c: Ctx, V: VPalette, f: Foot, x: number, y: number, z: number) {
  c.batch.add(ROOM, V.nero, lathe("orchidPot", [[0, 0], [0.07, 0], [0.085, 0.14], [0.08, 0.15], [0, 0.15]], 18), L(f, x, y, z));
  const bloom = vGeo("orchidBloom", () => { const s = new THREE.Shape(); for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2, r = 0.028 * (0.6 + 0.4 * Math.abs(Math.cos(a * 2.5))); if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ShapeGeometry(s, 2); });
  const bm = vSolid("orchidWhite", "#fbf6f2", { rough: 0.6, side: THREE.DoubleSide, env: 0.4 });
  for (let s = 0; s < 2; s++) {
    const pts: THREE.Vector3[] = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(W(f, x + (s ? -1 : 1) * t * t * 0.18, y + 0.14 + t * 0.42 - t * t * 0.12, z + t * 0.05)); }
    c.batch.add(ROOM, vSolid("orchidStem", "#3c5a2a", { rough: 0.7 }), new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.004, 5, false));
    for (let k = 3; k <= 8; k++) { const q = pts[k]; c.inst.add(ROOM, "vestibulo-orchid", bloom, bm, mat(q.x, q.y - 0.02, q.z + 0.02, f.yaw + k, 1, 1, 1, -0.3)); }
  }
}
