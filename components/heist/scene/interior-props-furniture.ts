/*
 * MET Gala Heist v2 — mobília do interior (interior-props.ts): mesas e bancadas (recepção, produção, camarim), sofá,
 * bar do lounge, espelho dourado, piano de cauda, banco de museu, chapelaria e araras.
 */
import * as THREE from "three";
import { BOX0, CYL, CYL0, SPH, geo } from "./interior-batch";
import { fabric, glow, solid } from "./interior-mats";
import { rand } from "./interior-tex";
import { roseGeometry } from "./interior-hall";
import type { InteriorRoom } from "./interior-shell";
import type { Foot, PropsCtx } from "./interior-props";
import { L, anchor, bottle, box, coupe, flute, lathe, worldOf } from "./interior-props-kit";
import { callSheetTexture } from "./interior-props-textures";

/** Mesas: recepção (vestíbulo), produção e monitores (bastidores), camarim. */
export function desk(c: PropsCtx, room: InteriorRoom, f: Foot, variant: number) {
  const P = c.P;
  if (room === "vestibulo") {
    // balcão de recepção curvo: frente de nogueira com frisos de latão, tampo de mármore, tablet, buquê e luminária
    box(c, room, P.walnut, f, 0, 0, 0, f.w, 1.02, f.d, { cast: true });
    for (const y of [0.18, 0.95]) box(c, room, P.brass, f, 0, y, f.d / 2 + 0.002, f.w, 0.02, 0.01);
    box(c, room, P.marbleWhite, f, 0, 1.02, 0, f.w + 0.06, 0.04, f.d + 0.06);
    box(c, room, P.plasticDark, f, -0.5, 1.06, -0.05, 0.25, 0.012, 0.18, { ry: 0.2 });
    c.batch.add(room, P.glass, CYL0(16), L(f, 0.75, 1.06, -0.05, 0, 0.07, 0.25, 0.07));
    const rose = roseGeometry(c.q), roseMat = solid("roseMat", "#ffffff", { rough: 0.72, side: THREE.DoubleSide, env: 0.4 });
    for (let k = 0; k < 9; k++) { const a = k * 2.4, d = 0.03 + (k % 3) * 0.04; c.inst.add(room, "rose", rose, roseMat, L(f, 0.75 + Math.cos(a) * d, 1.33 + (k % 2) * 0.03, -0.05 + Math.sin(a) * d, a, 0.05), new THREE.Color(["#f4c3cf", "#f3ece0", "#c0304f"][k % 3])); }
    c.batch.add(room, P.brass, lathe("bankerLamp", [[0, 0], [0.09, 0], [0.09, 0.02], [0.012, 0.03], [0.012, 0.32], [0, 0.32]], 14), L(f, 0.1, 1.06, -0.12));
    c.batch.add(room, solid("bankerShade", "#0d4a2e", { rough: 0.25, env: 1 }), geo("bankerShadeGeo", () => new THREE.CylinderGeometry(0.03, 0.12, 0.09, 18, 1, true)), L(f, 0.1, 1.4, -0.12, 0, 1, 1, 1, 0.1));
    anchor(c, room, worldOf(f, 0.1, 1.3, 0.2), "#ffd9a0", 3, 3);
    return;
  }
  if (variant === 4) {
    // bancada do camarim: tampo branco, gavetas, maquiagem, secador e escovas
    box(c, room, P.plasticDark, f, 0, 0, 0, f.w, 0.76, f.d, { cast: true });
    box(c, room, P.marbleWhite, f, 0, 0.76, 0, f.w + 0.02, 0.03, f.d + 0.02);
    const R = rand(77);
    for (let k = 0; k < 18; k++) { const x = (R() - 0.5) * (f.w - 0.2), z = (R() - 0.5) * (f.d - 0.2); c.inst.add(room, "makeup", k % 3 ? CYL0(8) : BOX0(), k % 2 ? P.black : P.goldBright, L(f, x, 0.79, z, R() * 3, 0.02 + R() * 0.02, 0.05 + R() * 0.1, 0.02 + R() * 0.02)); }
    return;
  }
  if (room === "bastidores" && variant === 1) {
    // mesa da produção diante dos monitores: notebooks, rádios, café
    box(c, room, P.black, f, 0, 0.72, 0, f.w, 0.04, f.d, { cast: true });
    for (const x of [-f.w / 2 + 0.06, f.w / 2 - 0.06]) for (const z of [-f.d / 2 + 0.06, f.d / 2 - 0.06]) box(c, room, P.darkSteel, f, x, 0, z, 0.04, 0.72, 0.04);
    for (const x of [-0.8, 0.5]) { box(c, room, P.darkSteel, f, x, 0.76, 0.05, 0.34, 0.02, 0.24); box(c, room, glow("laptopScreen", "#9fc6ff", 1.4), f, x, 0.77, -0.07, 0.32, 0.22, 0.01, { ry: 0 }); }
    for (let k = 0; k < 3; k++) c.inst.add(room, "radio", BOX0(), P.black, L(f, -0.2 + k * 0.12, 0.76, 0.15, 0, 0.06, 0.2, 0.04));
    c.inst.add(room, "coffee", CYL0(10), P.paperWhite, L(f, 1.0, 0.76, 0.1, 0, 0.04, 0.11, 0.04));
    return;
  }
  // mesa da produção nos bastidores (a da folha de chamada): mesa dobrável preta, notebook, roteiro, a folha de chamada
  box(c, room, P.black, f, 0, 0.72, 0, f.w, 0.04, f.d, { cast: true });
  for (const x of [-f.w / 2 + 0.06, f.w / 2 - 0.06]) for (const z of [-f.d / 2 + 0.06, f.d / 2 - 0.06]) box(c, room, P.darkSteel, f, x, 0, z, 0.04, 0.72, 0.04);
  box(c, room, P.darkSteel, f, 0.6, 0.76, 0, 0.34, 0.02, 0.24);
  box(c, room, glow("laptopScreen", "#9fc6ff", 1.4), f, 0.6, 0.77, -0.12, 0.32, 0.22, 0.01);
  // a folha de chamada voltada para o lado de quem chega (sul, z +): bem legível
  const sheet = new THREE.MeshStandardMaterial({ map: callSheetTexture(c.copy), roughness: 0.9, emissiveMap: callSheetTexture(c.copy), emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.12 });
  c.batch.add(room, sheet, geo("planeUp", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), L(f, -0.05, 0.765, -0.24, Math.PI, 0.3, 1, 0.41));
  c.inst.add(room, "coffee", CYL0(10), P.paperWhite, L(f, -0.6, 0.76, 0.1, 0, 0.04, 0.11, 0.04));
  c.batch.add(room, P.black, lathe("deskLamp", [[0, 0], [0.08, 0], [0.08, 0.02], [0.01, 0.03], [0.01, 0.45], [0, 0.45]], 12), L(f, -0.95, 0.76, -0.2));
  c.batch.add(room, P.black, geo("deskLampHead", () => new THREE.ConeGeometry(0.08, 0.14, 16, 1, true)), L(f, -0.9, 1.18, -0.1, 0, 1, 1, 1, 2.2));
  anchor(c, room, worldOf(f, -0.6, 1.1, 0.1), "#fff0d0", 3, 2.8);
}

/** Sofá de veludo: base, encosto, braços, almofadas e pés de latão. */
export function sofa(c: PropsCtx, room: InteriorRoom, f: Foot, cover: THREE.Material) {
  const P = c.P, w = f.w, d = f.d;
  box(c, room, cover, f, 0, 0.12, 0.04, w - 0.2, 0.3, d - 0.12, { cast: true });
  box(c, room, cover, f, 0, 0.12, -d / 2 + 0.12, w, 0.72, 0.24, { cast: true });
  for (const s of [-1, 1]) box(c, room, cover, f, s * (w / 2 - 0.1), 0.12, 0.04, 0.2, 0.48, d - 0.12);
  const n = Math.max(2, Math.round((w - 0.4) / 0.7));
  for (let k = 0; k < n; k++) { const x = -w / 2 + 0.2 + (k + 0.5) * ((w - 0.4) / n); c.batch.add(room, cover, geo("cushion", () => new THREE.CapsuleGeometry(0.1, 0.4, 4, 8).rotateZ(Math.PI / 2).scale(1, 1.1, 2.8)), L(f, x, 0.48, 0.05, 0, ((w - 0.4) / n) / 0.62, 1, (d - 0.3) / 0.56)); }
  for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) for (const z of [-d / 2 + 0.08, d / 2 - 0.08]) c.inst.add(room, "sofaLeg", CYL0(8), P.brass, L(f, x, 0, z, 0, 0.025, 0.12, 0.025));
}

/** Bar do lounge: frente de mogno em almofadas com filetes dourados, tampo de mármore negro, trilho de latão, taças. */
export function bar(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P, w = f.w, d = f.d, h = 1.08;
  box(c, room, P.mahogany, f, 0, 0, 0, w, h - 0.05, d, { cast: true });
  // almofadas da frente (lado +z local = frente, para o salão), com moldura dourada como na referência
  const panels = Math.round(w / 1.0);
  for (let k = 0; k < panels; k++) {
    const x = -w / 2 + (k + 0.5) * (w / panels), pw = w / panels - 0.16;
    box(c, room, P.walnut, f, x, 0.16, d / 2, pw, h - 0.42, 0.02);
    for (const [px, py, sx, sy] of [[x, 0.16, pw, 0.02], [x, h - 0.28, pw, 0.02], [x - pw / 2, 0.16, 0.02, h - 0.42], [x + pw / 2, 0.16, 0.02, h - 0.42]] as [number, number, number, number][]) box(c, room, P.gold, f, px, py, d / 2 + 0.012, sx, sy, 0.012);
  }
  box(c, room, P.marbleDark, f, 0, h - 0.05, 0.03, w + 0.12, 0.05, d + 0.16);
  c.batch.add(room, P.brass, CYL(10), L(f, 0, 0.18, d / 2 + 0.14, 0, 0.022, w, 0.022, 0, Math.PI / 2));                 // descanso de pés
  box(c, room, glow("barUnderglow", "#ffb05a", 1.6), f, 0, 0.04, d / 2 + 0.01, w, 0.012, 0.012);
  const R = rand(5);
  for (let k = 0; k < 9; k++) c.inst.add(room, k % 2 ? "coupe" : "flute", k % 2 ? coupe() : flute(), P.glass, L(f, -w / 2 + 0.3 + R() * (w - 0.6), h, 0.05 + (R() - 0.5) * 0.2));
  for (let k = 0; k < 3; k++) c.inst.add(room, "bottle", bottle(), [P.bottleGreen, P.bottleAmber, P.bottleClear][k], L(f, -w / 2 + 1 + k * 1.8, h, -0.15, 0, 1.2));
  c.batch.add(room, P.chrome, CYL0(12), L(f, 0.8, h, -0.2, 0, 0.06, 0.22, 0.06));                                           // balde de gelo
  for (let k = 0; k < 3; k++) anchor(c, room, worldOf(f, -w / 2 + (k + 0.5) * (w / 3), 1.6, -0.6), "#ffb867", 5, 3.6);
}

/** Espelho dourado do lounge e o espelho de camarim com lâmpadas dos bastidores. */
export function wallMirror(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  box(c, room, P.gold, f, 0, 0.35, 0, f.w, 2.6, f.d * 0.6, { cast: true });
  box(c, room, P.mirror, f, 0, 0.47, f.d * 0.3, f.w - 0.22, 2.36, 0.01);
  c.batch.add(room, P.gold, geo("mirrorCrest", () => new THREE.TorusGeometry(0.3, 0.05, 8, 24, Math.PI)), L(f, 0, 2.95, f.d * 0.3));
}

/** Piano de cauda laqueado com tampa aberta, estante, pernas torneadas e banqueta. */
export function piano(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P, w = f.w, d = f.d;
  const body = geo("pianoBody", () => {
    const s = new THREE.Shape(); s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, 0.05); s.bezierCurveTo(0.5, 0.35, 0.2, 0.25, 0.1, 0.5); s.lineTo(-0.5, 0.5); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 20 }).rotateX(-Math.PI / 2);
  });
  c.batch.add(room, P.lacquer, body, L(f, 0, 0.66, 0, Math.PI, w, 1, d), { cast: true });
  // tampa aberta (aprox. 40°) e o suporte
  c.batch.add(room, P.lacquer, geo("pianoLid", () => { const s = new THREE.Shape(); s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, 0.05); s.bezierCurveTo(0.5, 0.35, 0.2, 0.25, 0.1, 0.5); s.lineTo(-0.5, 0.5); s.closePath(); return new THREE.ShapeGeometry(s, 20).rotateX(-Math.PI / 2); }), L(f, 0.02, 0.97, 0, Math.PI, w, 1, d, 0, -0.7));
  c.batch.add(room, P.black, CYL(6), L(f, -0.1, 1.15, 0.1, 0, 0.01, 0.42, 0.01));
  box(c, room, P.black, f, 0, 0.66, d / 2 - 0.1, w * 0.85, 0.12, 0.2);
  c.batch.add(room, solid("ivory", "#f2ede0", { rough: 0.3 }), BOX0(), L(f, 0, 0.78, d / 2 - 0.08, 0, w * 0.82, 0.015, 0.14));
  for (const [x, z] of [[-w / 2 + 0.12, d / 2 - 0.12], [w / 2 - 0.12, d / 2 - 0.12], [0.1, -d / 2 + 0.15]]) c.batch.add(room, P.lacquer, lathe("pianoLeg", [[0.05, 0], [0.06, 0.05], [0.045, 0.3], [0.06, 0.55], [0.065, 0.66], [0, 0.66]], 12), L(f, x, 0, z));
}

/** Banco de museu: assento de couro, estrutura de aço escovado. */
export function bench(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  box(c, room, P.leatherBlack, f, 0, 0.38, 0, f.w, 0.08, f.d * 0.95);
  for (const s of [-1, 1]) box(c, room, P.steel, f, s * (f.w / 2 - 0.15), 0, 0, 0.04, 0.38, f.d * 0.85);
}

/** Chapelaria: balcão com tampo de latão, campainha, fichas numeradas; casacos pendurados no fundo (parede leste). */
export function coatCheck(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  box(c, room, P.walnut, f, 0, 0, 0, f.w, 1.05, f.d, { cast: true });
  box(c, room, P.brass, f, 0, 1.05, 0, f.w + 0.06, 0.03, f.d + 0.06);
  c.batch.add(room, P.goldBright, SPH(12), L(f, 0.8, 1.08, 0, 0, 0.05, 0.035, 0.05));
  for (let k = 0; k < 8; k++) c.inst.add(room, "ticket", BOX0(), P.paperWhite, L(f, -1.2 + k * 0.06, 1.08, 0.05, 0, 0.035, 0.002, 0.06));
  // trilho de casacos atrás do balcão (a 1,9 m da frente, junto à parede)
  const R = rand(3);
  c.batch.add(room, P.chrome, CYL(8), L(f, 0, 1.75, -2.1, 0, 0.015, f.w - 0.1, 0.015, 0, Math.PI / 2));
  for (let k = 0; k < 14; k++) {
    const x = -f.w / 2 + 0.2 + k * ((f.w - 0.4) / 13), col = ["#151517", "#2b1d16", "#3a3a3d", "#5a1d2a", "#1c2630"][Math.floor(R() * 5)];
    c.inst.add(room, "coat", geo("coatGeo", () => new THREE.CapsuleGeometry(0.17, 0.75, 4, 10).scale(1, 1, 0.38)), fabric(`coat-${col}`, col, c.q), L(f, x, 1.2, -2.1, (R() - 0.5) * 0.3));
  }
  anchor(c, room, worldOf(f, 0, 2.2, -1), "#ffd8a0", 3, 3.5);
}

/** Arara (esconderijo): estrutura cromada com capas de roupa (bastidores, doca) ou casacos (vestíbulo). */
export function rack(c: PropsCtx, room: InteriorRoom, f: Foot, id: string) {
  const P = c.P, R = rand(id.length * 11 + id.charCodeAt(id.length - 1)), H = 1.85;
  for (const s of [-1, 1]) { c.batch.add(room, P.chrome, CYL0(8), L(f, s * (f.w / 2 - 0.03), 0.06, 0, 0, 0.015, H - 0.06, 0.015)); box(c, room, P.chrome, f, s * (f.w / 2 - 0.03), 0, 0, 0.04, 0.03, f.d); }
  c.batch.add(room, P.chrome, CYL(8), L(f, 0, H, 0, 0, 0.015, f.w, 0.015, 0, Math.PI / 2));
  const coats = room === "vestibulo", n = 7;
  for (let k = 0; k < n; k++) {
    const x = -f.w / 2 + 0.12 + k * ((f.w - 0.24) / (n - 1));
    if (coats) c.inst.add(room, "coat", geo("coatGeo", () => new THREE.CapsuleGeometry(0.17, 0.75, 4, 10).scale(1, 1, 0.38)), fabric(`coat-${["#151517", "#2b1d16", "#3a3a3d"][k % 3]}`, ["#151517", "#2b1d16", "#3a3a3d"][k % 3], c.q), L(f, x, H - 0.62, 0, Math.PI / 2 + (R() - 0.5) * 0.2));
    else c.inst.add(room, "garmentBag", geo("bagGeo", () => new THREE.BoxGeometry(0.08, 1.3, 0.55).translate(0, -0.65, 0)), P.garmentBag, L(f, x, H - 0.04, 0, (R() - 0.5) * 0.25));
  }
}
