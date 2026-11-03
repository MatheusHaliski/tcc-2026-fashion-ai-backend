/*
 * MET Gala Heist v2 — peças em exposição (interior-props.ts): bustos com vestidos dos bastidores, vitrines do Instituto
 * do Traje, vitrines de joias da Sala das Joias, estátuas da galeria e o pedestal com o diamante (anéis da trava,
 * cúpula, brilho e a geometria do brilhante).
 */
import * as THREE from "three";
import { BOX0, CYL0, SPH, geo } from "./interior-batch";
import { glow, solid } from "./interior-mats";
import { drawSymbol, drawnTexture, rand } from "./interior-tex";
import { dressFormParts, gownGeometry, gownMaterial, statueGeometry, type GownCut } from "./interior-dress";
import type { InteriorRoom } from "./interior-shell";
import type { Foot, PropsCtx } from "./interior-props";
import { RING_SYMBOLS } from "@/lib/heist/level";
import { L, anchor, box, lathe, worldOf } from "./interior-props-kit";
import { labelTexture } from "./interior-props-textures";

const GOWNS: { cut: GownCut; color: string; stops?: string[]; sheen?: string }[] = [
  { cut: "ball", color: "#ffffff", stops: ["#a88bff", "#f3a3b8", "#fde7b8"], sheen: "#fff3e0" },         // Aurora (réplica de exposição)
  { cut: "column", color: "#0f1320", sheen: "#7d8cff" },                                                   // coluna de veludo
  { cut: "mermaid", color: "#8e0f24", sheen: "#ff9aa8" },                                                  // tule carmim
  { cut: "aline", color: "#d9c39a", sheen: "#fff4d6" },
  { cut: "mermaid", color: "#2f4f7a", sheen: "#c8dcff" },
  { cut: "ball", color: "#f2f0ea", sheen: "#ffffff" },
];
/** Busto de costura com um vestido (bastidores: looks do desfile final). */
export function mannequin(c: PropsCtx, room: InteriorRoom, f: Foot, id: string) {
  const k = (id.charCodeAt(id.length - 1) + 1) % GOWNS.length;
  dressForm(c, room, (x, y, z, ry = 0, s = 1) => L(f, x, y, z, ry, s), GOWNS[k], `bk${k}`);
}
function dressForm(c: PropsCtx, room: InteriorRoom, at: (x: number, y: number, z: number, ry?: number, s?: number) => THREE.Matrix4, g: (typeof GOWNS)[number], key: string, gown = true) {
  const P = c.P, parts = dressFormParts();
  c.batch.add(room, P.brass, parts.foot, at(0, 0, 0)); c.batch.add(room, P.brass, parts.pole, at(0, 0.04, 0));
  c.batch.add(room, solid("formLinen", "#d8cdb6", { rough: 0.9 }), parts.torso, at(0, 0, 0), { cast: true });
  c.batch.add(room, P.walnut, parts.neck, at(0, 0, 0));
  if (gown) c.batch.add(room, gownMaterial(key, g.color, { stops: g.stops, sheen: g.sheen }), gownGeometry(g.cut, c.q), at(0, 0.03, 0, 0, 1), { cast: true });
}

/** Vitrine do Instituto do Traje: plinto, cúpula de vidro, luz interna e as peças (vestidos em bustos ou chapéus e luvas). */
export function vitrine(c: PropsCtx, room: InteriorRoom, f: Foot, variant: number, id: string) {
  const P = c.P, w = f.w, d = f.d, plinth = 0.45, top = 2.75;
  box(c, room, P.black, f, 0, 0, 0, w, plinth, d, { cast: true });
  box(c, room, P.brass, f, 0, plinth - 0.02, 0, w + 0.01, 0.02, d + 0.01);
  box(c, room, solid("vitrineFloor", "#1a1716", { rough: 0.6 }), f, 0, plinth, 0, w - 0.04, 0.005, d - 0.04);
  // vidro (cinco faces) e o forro iluminado em cima
  for (const [x, z, sx, sz] of [[0, d / 2, w, 0.01], [0, -d / 2, w, 0.01], [w / 2, 0, 0.01, d], [-w / 2, 0, 0.01, d]] as [number, number, number, number][]) box(c, room, P.glass, f, x, plinth, z, sx, top - plinth, sz);
  box(c, room, P.glass, f, 0, top - 0.005, 0, w, 0.01, d);
  box(c, room, P.black, f, 0, top, 0, w + 0.04, 0.12, d + 0.04);
  c.inst.add(room, "caseLight", BOX0(), glow("caseLight", "#fff2d8", 2.2), L(f, 0, top - 0.02, 0, 0, w - 0.3, 0.012, d - 0.3));
  if (variant === 3) {
    // chapéus e luvas sobre cabeças de feltro e mãos de exposição
    for (let k = 0; k < 2; k++) {
      const z = -d / 2 + (k + 0.5) * (d / 2);
      c.batch.add(room, P.black, CYL0(12), L(f, 0, plinth, z, 0, 0.04, 0.6, 0.04));
      c.batch.add(room, solid("feltHead", "#cfc3ad", { rough: 0.95 }), SPH(14), L(f, 0, plinth + 0.72, z, 0, 0.1, 0.13, 0.11));
      c.batch.add(room, k ? P.velvetBlack : P.velvetRose, lathe(`hat${k}`, k ? [[0.3, 0], [0.31, 0.01], [0.12, 0.02], [0.11, 0.12], [0.0, 0.14]] : [[0.22, 0], [0.22, 0.01], [0.1, 0.03], [0.1, 0.16], [0.0, 0.17]], 24), L(f, 0, plinth + 0.8, z, 0, 1, 1, 1, 0.15));
      c.batch.add(room, solid("glove", "#efe6d5", { rough: 0.7 }), geo("gloveGeo", () => new THREE.CapsuleGeometry(0.035, 0.32, 4, 8)), L(f, 0.25, plinth + 0.25, z, 0, 1, 1, 1, 0.5));
    }
  } else {
    const g = GOWNS[variant === 1 ? 0 : variant === 0 ? 1 : 2];
    dressForm(c, room, (x, y, z, ry = 0, s = 1) => L(f, x, plinth + y, z, ry + Math.PI * 0.06, s), g, `case${variant}`);
  }
  // plaquinha da peça no plinto (frente)
  const labels = c.copy.caseLabels, txt = labels[variant === 1 ? 0 : variant === 0 ? 1 : variant === 2 ? 2 : 3];
  const lm = new THREE.MeshStandardMaterial({ map: labelTexture(txt), roughness: 0.6 });
  c.batch.add(room, lm, geo("plane", () => new THREE.PlaneGeometry(1, 1)), L(f, w / 2 - 0.35, 0.3, d / 2 + 0.003, 0, 0.5, 0.25, 1));
  anchor(c, room, worldOf(f, 0, 2.2, 0), "#fff1dc", variant === 1 ? 9 : 5, 4.5);
  void id;
}

/** Vitrine de joias da Sala das Joias (parede): gabinete laqueado, veludo, colares e tiaras em bustos. */
export function jewelCase(c: PropsCtx, room: InteriorRoom, f: Foot, id: string) {
  const P = c.P, w = f.w, d = f.d, R = rand(id.length * 31 + id.charCodeAt(3));
  box(c, room, P.lacquer, f, 0, 0, 0, w, 0.9, d, { cast: true });
  box(c, room, P.velvetBlack, f, 0, 0.9, 0, w - 0.06, 0.02, d - 0.06);
  for (const [x, z, sx, sz] of [[0, d / 2, w, 0.01], [0, -d / 2, w, 0.01], [w / 2, 0, 0.01, d], [-w / 2, 0, 0.01, d]] as [number, number, number, number][]) box(c, room, P.glass, f, x, 0.9, z, sx, 0.75, sz);
  box(c, room, P.glass, f, 0, 1.65, 0, w, 0.01, d);
  box(c, room, P.brass, f, 0, 1.65, 0, w + 0.03, 0.04, d + 0.03);
  c.inst.add(room, "caseLight", BOX0(), glow("caseLight", "#fff2d8", 2.2), L(f, 0, 1.64, 0, 0, w - 0.1, 0.01, d - 0.1));
  const n = Math.max(1, Math.round(Math.max(w, d) / 0.55));
  const gem = geo("gem", () => new THREE.OctahedronGeometry(1, 0)), gold = P.goldBright;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n - 0.5, x = w > d ? t * w : 0, z = w > d ? 0 : t * d;
    // o busto olha para dentro da sala: vitrine encostada na parede oeste olha para +x, na norte para +z
    const face = d > w ? Math.PI / 2 : 0, fx = Math.sin(face), fz = Math.cos(face);
    c.batch.add(room, P.velvetBlack, geo("bust", () => new THREE.LatheGeometry([[0.0, 0], [0.11, 0], [0.12, 0.05], [0.07, 0.2], [0.05, 0.3], [0.0, 0.32]].map(([a, b]) => new THREE.Vector2(a, b)), 20).scale(1, 1, 0.7)), L(f, x, 0.92, z, face));
    // colar: arco de pedras na frente do busto
    for (let s = 0; s < 11; s++) { const a = Math.PI * (0.15 + 0.7 * (s / 10)), side = Math.cos(a) * 0.06; c.inst.add(room, "neckGem", gem, s === 5 ? solid("ruby", "#c2102a", { rough: 0.05, env: 2.5 }) : solid("gemWhite", "#ffffff", { rough: 0.02, env: 3 }), L(f, x + side * fz + fx * 0.07, 1.12 - Math.sin(a) * 0.03, z - side * fx + fz * 0.07, R(), s === 5 ? 0.016 : 0.009)); }
    c.inst.add(room, "tiara", geo("tiaraGeo", () => new THREE.TorusGeometry(0.06, 0.006, 6, 24, Math.PI)), gold, L(f, x, 1.24, z, face));
  }
  anchor(c, room, worldOf(f, 0, 1.5, 0), "#fff4e6", 3.5, 2.5);
}

/** Estátua clássica de mármore sobre plinto (galeria). */
export function statue(c: PropsCtx, room: InteriorRoom, f: Foot, id: string) {
  const P = c.P, marble = solid("statueMarble", "#efeae0", { rough: 0.38, env: 0.9 });
  box(c, room, P.marbleDark, f, 0, 0, 0, f.r * 1.9, 1.0, f.r * 1.9, { cast: true });
  box(c, room, P.marbleWhite, f, 0, 1.0, 0, f.r * 2.05, 0.06, f.r * 2.05);
  const v = id.charCodeAt(id.length - 1) % 2;
  c.batch.add(room, marble, statueGeometry(v), L(f, 0, 1.06, 0, v ? Math.PI * 0.85 : Math.PI * 0.15, 0.95), { cast: true });
  anchor(c, room, worldOf(f, 0, 3.4, 0.9), "#ffe9cc", 7, 4.5);
}

/** Pedestal do diamante: coluna de mármore negro, os três anéis de latão da trava (símbolos), cúpula de vidro e almofada. */
export function pedestal(c: PropsCtx, room: InteriorRoom, f: Foot) {
  const P = c.P;
  c.batch.add(room, P.marbleDark, lathe("pedestalCol", [[0, 0], [0.5, 0], [0.5, 0.08], [0.42, 0.14], [0.36, 0.2], [0.34, 0.9], [0.42, 0.98], [0.46, 1.05], [0, 1.05]], 40), L(f, 0, 0, 0), { cast: true });
  // anéis da trava com os símbolos gravados (★ ☾ ♛ ♥ em volta)
  const ringTex = drawnTexture("ringSymbols", 1024, 64, (g, w, h) => {
    g.fillStyle = "#6b4f1d"; g.fillRect(0, 0, w, h); g.fillStyle = "#f2d38a";
    for (let k = 0; k < 16; k++) drawSymbol(g, RING_SYMBOLS[k % 4], (k + 0.5) * (w / 16), h / 2, h * 0.32);
  });
  const ringMat = new THREE.MeshStandardMaterial({ map: ringTex, metalness: 0.9, roughness: 0.3, color: "#e2c27a" });
  for (const y of [0.42, 0.56, 0.7]) c.batch.add(room, ringMat, geo("ringBand", () => new THREE.CylinderGeometry(0.355, 0.355, 0.1, 48, 1, true)), L(f, 0, y, 0));
  c.batch.add(room, P.velvetRed, geo("cushion2", () => new THREE.SphereGeometry(0.16, 20, 10).scale(1, 0.3, 1)), L(f, 0, 1.08, 0));
  for (const [x, z, sx, sz] of [[0, 0.22, 0.44, 0.01], [0, -0.22, 0.44, 0.01], [0.22, 0, 0.01, 0.44], [-0.22, 0, 0.01, 0.44]] as [number, number, number, number][]) box(c, room, P.glass, f, x, 1.05, z, sx, 0.46, sz);
  box(c, room, P.glass, f, 0, 1.51, 0, 0.44, 0.01, 0.44);
  box(c, room, P.brass, f, 0, 1.05, 0, 0.47, 0.02, 0.47);
  // o diamante (lapidação brilhante), aparece só enquanto está no pedestal
  const diamond = new THREE.Mesh(diamondGeometry(), new THREE.MeshPhysicalMaterial({ color: "#f4fbff", metalness: 0.05, roughness: 0.0, envMapIntensity: 3.2, clearcoat: 1, clearcoatRoughness: 0, iridescence: 0.6, iridescenceIOR: 1.6, flatShading: true }));
  diamond.position.copy(worldOf(f, 0, 1.2, 0)); diamond.scale.setScalar(0.07); diamond.userData.room = room; c.group.add(diamond);
  c.animated.push({ kind: "diamond", mesh: diamond, room });
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTexture(), color: new THREE.Color("#ffffff").multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  glint.position.copy(worldOf(f, 0.03, 1.27, 0.02)); glint.scale.setScalar(0.2); glint.renderOrder = 6; glint.userData.room = room; c.group.add(glint);
  c.animated.push({ kind: "glint", mesh: glint, room });
  anchor(c, room, worldOf(f, 0, 3.8, 0), "#f2f6ff", 14, 6);
}
function glintTexture(): THREE.Texture {
  return drawnTexture("diamondGlint", 128, 128, (g, w, h) => {
    const c = w / 2, grd = g.createRadialGradient(c, c, 0, c, c, c * 0.35); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (const [a, l] of [[0, 1], [Math.PI / 2, 1], [Math.PI / 4, 0.45], [-Math.PI / 4, 0.45]] as [number, number][]) {
      g.save(); g.translate(c, c); g.rotate(a); const lg = g.createLinearGradient(-c * l, 0, c * l, 0); lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, "rgba(255,255,255,0.95)"); lg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = lg; g.beginPath(); g.moveTo(-c * l, 0); g.lineTo(0, -2.2); g.lineTo(c * l, 0); g.lineTo(0, 2.2); g.closePath(); g.fill(); g.restore();
    }
  }, false);
}
/** Brilhante redondo: coroa, mesa e pavilhão facetados (57 facetas aproximadas). */
export function diamondGeometry(): THREE.BufferGeometry {
  return geo("diamond", () => {
    const n = 16, pts: number[] = [], tbl = 0.55, girdle = 1, crownH = 0.32, pavH = 0.86;
    const ring = (r: number, y: number, off = 0) => Array.from({ length: n }, (_, k) => { const a = ((k + off) / n) * Math.PI * 2; return [Math.cos(a) * r, y, Math.sin(a) * r]; });
    const T = ring(tbl, crownH, 0.5), G = ring(girdle, 0), C = [0, crownH, 0], B = [0, -pavH, 0];
    const tri = (a: number[], b: number[], c2: number[]) => pts.push(...a, ...b, ...c2);
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      tri(C, T[k2], T[k]);                                                       // mesa
      tri(T[k], T[k2], G[k2]); tri(T[k], G[k2], G[k]);                           // coroa
      tri(G[k], G[k2], B);                                                       // pavilhão
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); g.computeVertexNormals(); return g;
  });
}
