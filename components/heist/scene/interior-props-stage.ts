/*
 * MET Gala Heist v2 — palco e produção (interior-props.ts): o palco da apresentação com treliça e refletores, o tablado
 * do quarteto, o telão de LED do salão, a parede de monitores e o espelho de camarim dos bastidores e o vaporizador.
 */
import * as THREE from "three";
import { BOX0, CYL, CYL0, SPH, geo } from "./interior-batch";
import { fabric, glow, solid } from "./interior-mats";
import type { InteriorRoom } from "./interior-shell";
import type { Foot, PropsCtx } from "./interior-props";
import { L, anchor, box, worldOf } from "./interior-props-kit";
import { cctvTexture, screenTexture } from "./interior-props-textures";

/** Palco da apresentação (0,6 m): tablado laqueado, saia de veludo, fita de LED na borda e treliça com refletores. */
export function runwayStage(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P, h = 0.6;
  box(c, room, P.velvetBlack, f, 0, 0, 0, f.w, h - 0.04, f.d, { cast: true });
  box(c, room, P.lacquer, f, 0, h - 0.04, 0, f.w + 0.04, 0.04, f.d + 0.04);
  c.inst.add(room, "stageLed", BOX0(), glow("stageLed", "#ffe1b3", 2.4), L(f, 0, h - 0.02, f.d / 2 + 0.025, 0, f.w, 0.012, 0.012));
  // pedestal do microfone e retorno de palco
  c.batch.add(room, P.chrome, CYL0(8), L(f, -0.6, h, 0.8, 0, 0.01, 1.4, 0.01)); c.batch.add(room, P.black, SPH(10), L(f, -0.6, h + 1.42, 0.8, 0, 0.03));
  box(c, room, P.black, f, 0.9, h, 1.1, 0.5, 0.3, 0.35, { ry: 0.3 });
  // treliça sobre o palco com quatro refletores apontando para a plateia
  for (const x of [-f.w / 2 + 0.15, f.w / 2 - 0.15]) box(c, room, P.steel, f, x, 0, -f.d / 2 + 0.2, 0.12, 4.6, 0.12);
  box(c, room, P.steel, f, 0, 4.5, -f.d / 2 + 0.2, f.w, 0.16, 0.16);
  for (let k = 0; k < 4; k++) {
    const x = -f.w / 2 + (k + 0.5) * (f.w / 4);
    c.batch.add(room, P.black, CYL(14), L(f, x, 4.3, -f.d / 2 + 0.35, 0, 0.12, 0.3, 0.12, 0.6));
    c.inst.add(room, "parLens", geo("parLens", () => new THREE.CircleGeometry(0.1, 16)), glow("parLens", "#fff1d6", 3), L(f, x, 4.23, -f.d / 2 + 0.47, 0, 1, 1, 1, 0.6 - Math.PI / 2 + Math.PI / 2));
    anchor(c, room, worldOf(f, x, 4.1, -f.d / 2 + 0.8), "#ffe6c0", 16, 9);
  }
}
/** Tablado do quarteto de cordas (0,3 m): carpete, quatro cadeiras douradas, estantes de partitura e o estojo do violoncelo. */
export function quartetStage(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P, h = 0.3;
  box(c, room, P.velvetBlack, f, 0, 0, 0, f.w, h - 0.03, f.d, { cast: true });
  box(c, room, fabric("quartetCarpet", "#4a0f1d", c.q), f, 0, h - 0.03, 0, f.w + 0.02, 0.03, f.d + 0.02);
  for (let k = 0; k < 4; k++) {
    const x = -f.w / 2 + (k + 0.5) * (f.w / 4), z = -0.25 - (k === 0 || k === 3 ? 0 : 0.35);
    // estante de partitura com a folha
    c.batch.add(room, P.black, CYL0(6), L(f, x, h, z + 0.6, 0, 0.008, 1.0, 0.008));
    box(c, room, P.black, f, x, h + 0.98, z + 0.62, 0.42, 0.28, 0.01, { ry: 0 });
    box(c, room, P.paperWhite, f, x, h + 1.0, z + 0.605, 0.38, 0.24, 0.006);
  }
  c.batch.add(room, P.lacquer, geo("celloCase", () => new THREE.CapsuleGeometry(0.2, 0.9, 4, 12).scale(1, 1, 0.55)), L(f, f.w / 2 - 0.25, h + 0.65, -f.d / 2 + 0.3, 0, 1, 1, 1, 0.2));
  anchor(c, room, worldOf(f, 0, 2.6, 0.5), "#ffcf96", 6, 5);
}

/** Telão de LED no norte do salão (moldura preta, imagem emissiva que respira). */
export function ledWall(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  box(c, room, P.black, f, 0, 0.9, 0, f.w + 0.1, 3.2, f.d, { cast: true });
  const m = new THREE.MeshBasicMaterial({ map: screenTexture(c.copy), toneMapped: true, color: new THREE.Color(1.6, 1.6, 1.6) });
  const mesh = new THREE.Mesh(geo("plane", () => new THREE.PlaneGeometry(1, 1)), m); mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(L(f, 0, 2.5, f.d / 2 + 0.006, 0, f.w - 0.12, 2.9, 1)); c.group.add(mesh); mesh.userData.room = room;
  c.animated.push({ kind: "screen", mesh, room });
  anchor(c, room, worldOf(f, 0, 2.5, 1.2), "#c86cff", 5, 7);
}
/** Parede de monitores da produção nos bastidores (circuito de câmeras do palco). */
export function monitorWall(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  for (let k = 0; k < 3; k++) {
    const x = -f.w / 2 + (k + 0.5) * (f.w / 3);
    box(c, room, P.black, f, x, 1.3, 0, f.w / 3 - 0.08, 0.62, f.d);
    const mesh = new THREE.Mesh(geo("plane", () => new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: cctvTexture(10 + k), color: new THREE.Color(1.3, 1.3, 1.3) }));
    mesh.matrixAutoUpdate = false; mesh.matrix.copy(L(f, x, 1.61, f.d / 2 + 0.004, 0, f.w / 3 - 0.14, 0.52, 1)); c.group.add(mesh); mesh.userData.room = room;
    c.animated.push({ kind: "cctv", mesh, room });
  }
  anchor(c, room, worldOf(f, 0, 1.6, 0.8), "#9fd8ff", 1.6, 3);
}

export function makeupMirror(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P, n = 3;
  for (let k = 0; k < n; k++) {
    const x = -f.w / 2 + (k + 0.5) * (f.w / n), mw = f.w / n - 0.12;
    box(c, room, P.black, f, x, 1.0, 0, mw + 0.1, 1.1, f.d * 0.5);
    box(c, room, P.mirror, f, x, 1.05, f.d * 0.25, mw - 0.1, 1.0, 0.01);
    for (let b = 0; b < 5; b++) for (const s of [-1, 1]) c.inst.add(room, "vanityBulb", SPH(8), P.bulbWarm, L(f, x + s * (mw / 2 + 0.01), 1.12 + b * 0.22, f.d * 0.3, 0, 0.035));
    for (let b = 0; b < 4; b++) c.inst.add(room, "vanityBulb", SPH(8), P.bulbWarm, L(f, x - mw / 2 + (b + 0.5) * (mw / 4), 2.1, f.d * 0.3, 0, 0.035));
    anchor(c, room, worldOf(f, x, 1.7, 0.6), "#ffdcaa", 4, 3);
  }
}

/** Vaporizador de roupa: base com reservatório, haste, mangueira e cabeça, com vapor saindo. */
export function steamer(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  c.batch.add(room, P.plastic, CYL0(16), L(f, 0, 0, 0, 0, f.r * 0.9, 0.32, f.r * 0.9));
  c.batch.add(room, solid("tank", "#aac9d8", { rough: 0.2, transparent: true, opacity: 0.6 }), CYL0(16), L(f, 0, 0.32, 0, 0, f.r * 0.6, 0.18, f.r * 0.6));
  c.batch.add(room, P.chrome, CYL0(8), L(f, 0.05, 0.5, 0, 0, 0.012, 1.1, 0.012));
  c.batch.add(room, P.plasticDark, geo("hose", () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.4, 0.05), new THREE.Vector3(0.2, 0.7, 0.2), new THREE.Vector3(0.05, 1.3, 0.12), new THREE.Vector3(0.06, 1.55, 0.05)]), 24, 0.02, 6)), L(f, 0, 0, 0));
  box(c, room, P.plastic, f, 0.06, 1.55, 0.04, 0.1, 0.16, 0.06);
  const steam = new THREE.Mesh(geo("steamGeo", () => new THREE.ConeGeometry(0.12, 0.6, 12, 1, true).translate(0, 0.3, 0)), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
  steam.matrixAutoUpdate = false; steam.matrix.copy(L(f, 0.06, 1.72, 0.04)); c.group.add(steam); steam.userData.room = room; c.animated.push({ kind: "steam", mesh: steam, room });
}
