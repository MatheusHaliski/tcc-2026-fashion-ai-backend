/*
 * MET Gala Heist v2 — trajes do Instituto do Traje: manequim de exposição (cabeça abstrata, braços em pose), vestidos com
 * volume real (corpete, cintura, saia com pregas que se abrem na barra, cauda nas costas, frente e verso acabados),
 * camada de tule translúcido, bordado de cristais, babados em níveis, estola, luvas de ópera, os dois vestidos-escultura
 * (pétalas de latão e plissê de papel de seda) e os acessórios das vitrines de parede (chapéus, luvas, bolsas, leque,
 * sapatos). As joias (colar, tiara, brincos, anéis) servem à galeria e à Sala das Joias. Tudo por revolução e
 * deformação, em metros, com a frente para +z e a base em y = 0.
 */
import * as THREE from "three";
import { CYL0, SPH, geo, type Batch, type Instances } from "../interior-batch";
import { fabric } from "../interior-mats";
import type { Quality } from "../interior-tex";
import { type Fr, gemGeo, lathe, once, paint, pearlGeo, plain } from "./galeria-kit";

/* ---------- materiais ---------- */
/** Manequim de fibra em gesso fosco marfim (o padrão de museu). */
export const mannequinMat = () => plain("galeria-manequim", "#e9e2d4", { rough: 0.62, env: 0.6 });
/** Tecido acetinado com brilho rasante; degradê opcional (barra → topo); transparente para tule. */
export function satin(key: string, color: string, o: { stops?: string[]; sheen?: string; rough?: number; clear?: number; opacity?: number } = {}): THREE.MeshPhysicalMaterial {
  return once(`galeria-traje-${key}`, () => new THREE.MeshPhysicalMaterial({
    color: o.stops ? "#ffffff" : color, roughness: o.rough ?? 0.42, metalness: 0, sheen: 1, sheenColor: new THREE.Color(o.sheen ?? "#ffffff"), sheenRoughness: 0.3,
    clearcoat: o.clear ?? 0.2, clearcoatRoughness: 0.4, side: THREE.DoubleSide, envMapIntensity: 1,
    map: o.stops ? paint(`galeria-degrade-${key}`, 8, 256, (g, w, h) => { const grd = g.createLinearGradient(0, h, 0, 0); o.stops!.forEach((c, i) => grd.addColorStop(i / Math.max(1, o.stops!.length - 1), c)); g.fillStyle = grd; g.fillRect(0, 0, w, h); }) : null,
    transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, depthWrite: (o.opacity ?? 1) >= 1,
  }));
}
/** Cristais bordados e strass: quase sem rugosidade, reflexo forte, uma pontinha de emissivo para cintilar no escuro. */
export const crystalMat = () => plain("galeria-cristal", "#f4f8ff", { rough: 0.02, metal: 0.1, env: 3, emissive: "#9fb4ff", ei: 0.35 });
export const goldMat = () => plain("galeria-ouro", "#d8b25c", { metal: 1, rough: 0.22 });
export const whiteGoldMat = () => plain("galeria-ouroBranco", "#dfe2e6", { metal: 1, rough: 0.16 });
export const pearlMat = () => plain("galeria-perola", "#f3ece0", { rough: 0.18, env: 1.6 });

/* ---------- vestidos ---------- */
export type Cut = "ball" | "column" | "mermaid";
const BODICE: [number, number][] = [[0.155, 1.05], [0.136, 1.1], [0.15, 1.2], [0.168, 1.28], [0.164, 1.34], [0.135, 1.385], [0.118, 1.405]];
function profile(cut: Cut): [number, number][] {
  switch (cut) {
    case "ball": return [[0.88, 0.015], [0.86, 0.09], [0.78, 0.3], [0.62, 0.56], [0.42, 0.82], [0.23, 0.98], [0.158, 1.03], ...BODICE];
    case "column": return [[0.31, 0.015], [0.29, 0.2], [0.26, 0.5], [0.235, 0.8], [0.2, 0.95], [0.165, 1.03], ...BODICE];
    case "mermaid": return [[0.66, 0.015], [0.55, 0.1], [0.34, 0.28], [0.21, 0.45], [0.18, 0.6], [0.192, 0.78], [0.2, 0.9], [0.172, 1.0], ...BODICE];
  }
}
/** Raio do perfil numa altura (interpolado). */
export function radiusAt(cut: Cut, y: number): number {
  const p = profile(cut); if (y <= p[0][1]) return p[0][0];
  for (let i = 1; i < p.length; i++) if (y <= p[i][1]) { const t = (y - p[i - 1][1]) / (p[i][1] - p[i - 1][1]); return p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t; }
  return p[p.length - 1][0];
}
interface GownOpt { scale?: number; folds?: number; amp?: number; tail?: number; pleats?: number; pleatAmp?: number; drape?: number; seed?: number }
/**
 * Vestido por revolução: seção oval (frente e costas mais rasas), pregas que se abrem para a barra, cauda que alonga a
 * barra nas costas (−z), plissê vertical opcional e drapeado diagonal no corpete. uv.y = altura (degradê do tecido).
 */
export function gownGeo(key: string, cut: Cut, q: Quality, o: GownOpt = {}): THREE.BufferGeometry {
  return geo(`galeria-gown-${key}-${q}`, () => {
    const prof = profile(cut), seg = q === "high" ? 96 : 48, sc = o.scale ?? 1, top = prof[prof.length - 1][1];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * sc, y)), seg);
    const p = g.getAttribute("position") as THREE.BufferAttribute, uv = g.getAttribute("uv") as THREE.BufferAttribute, ph = o.seed ?? 0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
      const fold = y < 1.02 ? (1 - y / 1.02) ** 1.5 : 0;
      let k = 1 + fold * (o.amp ?? 0.06) * (Math.sin(a * (o.folds ?? 14) + ph) + 0.55 * Math.sin(a * ((o.folds ?? 14) * 1.7 + 3) + ph * 2.1));
      if (o.pleats) { const t = (((a * o.pleats) / (Math.PI * 2)) % 1 + 1) % 1; k *= 1 + (o.pleatAmp ?? 0.08) * (Math.abs(t * 2 - 1) - 0.5) * 2; }
      if (o.drape && y > 0.95) k *= 1 + o.drape * Math.sin(a * 5 + y * 26) * smoothstep(0.95, 1.15, y);
      const tail = Math.max(0, -Math.sin(a)) * Math.max(0, 1 - y / 0.4) * (o.tail ?? 0);
      const rr = r * k;
      p.setXYZ(i, Math.cos(a) * rr, y, Math.sin(a) * rr * 0.84 - tail);
      uv.setY(i, y / top);
    }
    g.computeVertexNormals(); return g;
  });
}
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Babado (um nível de tule): anel que se abre de rt (em cima) para rb (barra) com franzido ondulado. */
function flounceGeo(key: string, rt: number, rb: number, h: number, q: Quality): THREE.BufferGeometry {
  return geo(`galeria-babado-${key}-${q}`, () => {
    const seg = q === "high" ? 120 : 64, g = new THREE.LatheGeometry([new THREE.Vector2(rb, 0), new THREE.Vector2(rb * 0.97, h * 0.35), new THREE.Vector2((rb + rt) / 2, h * 0.7), new THREE.Vector2(rt, h)], seg);
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z), w = 1 + (1 - y / h) * 0.09 * Math.sin(a * 34 + y * 8); p.setXYZ(i, Math.cos(a) * r * w, y, Math.sin(a) * r * w * 0.84); }
    g.computeVertexNormals(); return g;
  });
}

/* ---------- manequim ---------- */
const capsule = (key: string, r: number, len: number) => geo(`galeria-cap-${key}`, () => new THREE.CapsuleGeometry(r, len, 4, 12));
/** Segmento de cápsula entre dois pontos (matriz). */
function limb(F: Fr, a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.Matrix4 {
  const d = b.clone().sub(a), len = d.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(r / 0.05, (len + 2 * r) / (0.2 + 0.1), r / 0.05));
  return F(0, 0, 0).multiply(m);
}
export type ArmPose = "down" | "hip" | "raised" | "none";
/**
 * Manequim de exposição: tronco torneado (busto, cintura, quadril), pescoço, cabeça abstrata em ovo inclinada, ombros e
 * braços em pose; a haste e a base de latão (aparecem nos vestidos curtos e nos que não chegam ao chão).
 */
export function mannequin(b: Batch, room: string, F: Fr, o: { arms?: ArmPose; head?: boolean; glove?: THREE.Material | null; base?: boolean } = {}) {
  const M = mannequinMat();
  b.add(room, M, lathe("galeria-manTorso", [[0.0, 0.92], [0.15, 0.93], [0.17, 1.0], [0.14, 1.08], [0.13, 1.13], [0.155, 1.24], [0.165, 1.31], [0.15, 1.37], [0.1, 1.44], [0.052, 1.5], [0.045, 1.58], [0, 1.6]], 28), F(0, 0, 0, 0, 1, 1, 0.82), { cast: true });
  if (o.head !== false) b.add(room, M, geo("galeria-manHead", () => new THREE.SphereGeometry(1, 20, 14).scale(0.082, 0.112, 0.096)), F(0, 1.7, 0.012, 0, 1, 1, 1, -0.18));
  for (const s of [-1, 1]) b.add(room, M, SPH(12), F(s * 0.155, 1.385, 0, 0, 0.058, 0.05, 0.05));
  const arms = o.arms ?? "down";
  if (arms !== "none") for (const s of [-1, 1]) {
    const V = (x: number, y: number, z: number) => new THREE.Vector3(s * x, y, z);
    const sh = V(0.175, 1.37, 0), el = arms === "raised" && s > 0 ? V(0.3, 1.58, 0.05) : arms === "hip" ? V(0.27, 1.14, -0.04) : V(0.215, 1.1, 0.02);
    const wr = arms === "raised" && s > 0 ? V(0.26, 1.82, 0.1) : arms === "hip" ? V(0.17, 0.98, 0.06) : V(0.22, 0.85, 0.07);
    b.add(room, M, capsule("arm", 0.05, 0.2), limb(F, sh, el, 0.038));
    b.add(room, o.glove ?? M, capsule("arm", 0.05, 0.2), limb(F, el, wr, 0.031));
    const hand = wr.clone().add(wr.clone().sub(el).normalize().multiplyScalar(0.06));
    b.add(room, o.glove ?? M, geo("galeria-manHand", () => new THREE.SphereGeometry(1, 10, 8).scale(0.028, 0.07, 0.045)), F(hand.x, hand.y - 0.035, hand.z, 0, 1, 1, 1, 0, s * 0.15));
  }
  if (o.base !== false) {
    b.add(room, plain("galeria-latao", "#c9a24b", { metal: 1, rough: 0.28 }), CYL0(10), F(0, 0.02, 0, 0, 0.016, 0.9, 0.016));
    b.add(room, plain("galeria-latao", "#c9a24b", { metal: 1, rough: 0.28 }), lathe("galeria-manFoot", [[0, 0], [0.2, 0], [0.205, 0.01], [0.19, 0.025], [0.04, 0.035], [0, 0.04]], 28), F(0, 0, 0));
  }
}

/* ---------- os vestidos das vitrines ---------- */
/** Contas/cristais espalhados na superfície do vestido (frente mais densa), instanciados. */
function beads(inst: Instances, room: string, F: Fr, cut: Cut, n: number, y0: number, y1: number, seed: number, sc = 1, size = 0.005, key = "galeria-conta", m: THREE.Material = crystalMat(), front = 0.65) {
  let s = seed >>> 0 || 1; const R = () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; };
  for (let k = 0; k < n; k++) {
    const y = y0 + (y1 - y0) * Math.pow(R(), 0.8), a = R() < front ? Math.PI / 2 + (R() - 0.5) * 2.2 : R() * Math.PI * 2, r = radiusAt(cut, y) * sc * 1.012;
    inst.add(room, key, gemGeo(), m, F(Math.cos(a) * r, y, Math.sin(a) * r * 0.84, R() * 3, size * (0.7 + R() * 0.7)));
  }
}
/**
 * Vestido Aurora (réplica): saia de baile em degradê lilás → rosa → ouro, sobressaia de tule translúcido, cauda,
 * cinto de cetim dourado e cristais bordados no corpete e na saia.
 */
export function auroraGown(b: Batch, inst: Instances, room: string, F: Fr, q: Quality) {
  mannequin(b, room, F, { arms: "down", base: false });
  b.add(room, satin("aurora", "#ffffff", { stops: ["#9c86f0", "#d79ad8", "#f3a3b8", "#fbd3a6", "#fde7b8"], sheen: "#fff3e0" }), gownGeo("aurora", "ball", q, { tail: 0.55, folds: 16, amp: 0.07 }), F(0, 0, 0), { cast: true });
  b.add(room, satin("auroraTule", "#f6eaff", { opacity: 0.32, rough: 0.6, sheen: "#ffffff", clear: 0 }), gownGeo("auroraTule", "ball", q, { scale: 1.06, tail: 0.68, folds: 23, amp: 0.1, seed: 1.7 }), F(0, 0, 0));
  b.add(room, satin("auroraCinto", "#d9b46a", { sheen: "#fff1c8", rough: 0.3 }), geo("galeria-cinto", () => new THREE.TorusGeometry(0.152, 0.018, 8, 40).rotateX(Math.PI / 2).scale(1, 1, 0.84)), F(0, 1.035, 0));
  beads(inst, room, F, "ball", q === "high" ? 320 : 150, 1.06, 1.38, 31, 1, 0.0045);
  beads(inst, room, F, "ball", q === "high" ? 260 : 110, 0.12, 1.0, 37, 1.02, 0.006);
}
/** Coluna de veludo (1962): veludo azul-noite, estola branca, luvas de ópera de cetim marfim e um broche. */
export function velvetGown(b: Batch, inst: Instances, room: string, F: Fr, q: Quality) {
  const glove = satin("luvaMarfim", "#efe6d5", { sheen: "#ffffff", rough: 0.35 });
  mannequin(b, room, F, { arms: "hip", glove, base: false });
  b.add(room, fabric("galeria-veludoNoite", "#141c3a", q, { sheen: "#6f84ff", rough: 0.55 }), gownGeo("veludo", "column", q, { folds: 9, amp: 0.05, tail: 0.12 }), F(0, 0, 0), { cast: true });
  b.add(room, fabric("galeria-estola", "#f4f1ea", q, { sheen: "#ffffff", rough: 0.95 }), geo("galeria-estolaGeo", () => new THREE.TorusGeometry(0.2, 0.055, 10, 36).scale(1, 0.82, 1).rotateX(Math.PI / 2 - 0.25)), F(0, 1.36, -0.01), { cast: true });
  for (let k = 0; k < 7; k++) inst.add(room, "galeria-conta", gemGeo(), crystalMat(), F(Math.cos(k * 0.9) * 0.018 + 0.07, 1.27 + Math.sin(k * 0.9) * 0.018, 0.145, k, 0.007));
  inst.add(room, "galeria-gemaAzul", gemGeo(), plain("galeria-safira", "#2a4bd8", { rough: 0.03, env: 3, emissive: "#1a2a80", ei: 0.4 }), F(0.07, 1.27, 0.15, 0, 0.012));
}
/** Tule carmim (1959): sereia com corpete drapeado e cinco níveis de babados de tule. */
export function tulleGown(b: Batch, inst: Instances, room: string, F: Fr, q: Quality) {
  mannequin(b, room, F, { arms: "down", base: false });
  b.add(room, satin("carmim", "#8e0f24", { sheen: "#ff9aa8", rough: 0.38 }), gownGeo("carmim", "mermaid", q, { drape: 0.05, folds: 11, amp: 0.05, tail: 0.25 }), F(0, 0, 0), { cast: true });
  const tule = satin("carmimTule", "#a3122c", { opacity: 0.86, rough: 0.6, sheen: "#ff8fa0", clear: 0 });
  for (let k = 0; k < 5; k++) {
    const y = 0.02 + k * 0.085, rb = radiusAt("mermaid", y) * 1.1 + 0.02, rt = radiusAt("mermaid", y + 0.14) * 1.02;
    b.add(room, tule, flounceGeo(`t${k}`, rt, rb, 0.15, q), F(0, y, -0.02 * (4 - k) * 0.5, k * 0.4));
  }
  void inst;
}

/* ---------- vestidos-escultura ---------- */
/** «Pétalas»: núcleo de seda bronze coberto por centenas de pétalas de latão dourado em escamas, abrindo na barra. */
export function petalsGown(b: Batch, inst: Instances, room: string, F: Fr, q: Quality) {
  mannequin(b, room, F, { arms: "none", base: false });
  b.add(room, satin("bronzeSeda", "#3a2412", { sheen: "#c98a4a", rough: 0.5 }), gownGeo("petalasNucleo", "mermaid", q, { folds: 8, amp: 0.02 }), F(0, 0, 0), { cast: true });
  // pétala: calota rasa (bojo para +z, comprimento em y), girada para fora e com a ponta de baixo levantada (escamas)
  const petal = geo("galeria-petala", () => new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2.2).scale(0.03, 0.012, 0.045).rotateX(Math.PI / 2));
  const gold = plain("galeria-petalaOuro", "#d6a64a", { metal: 1, rough: 0.3, env: 1.3 });
  const step = q === "high" ? 0.04 : 0.055;
  for (let y = 0.04, row = 0; y < 1.38; y += step, row++) {
    const r = radiusAt("mermaid", y) * 1.02, n = Math.max(8, Math.round((2 * Math.PI * r) / (q === "high" ? 0.05 : 0.07))), flare = Math.max(0, 1 - y / 0.45);
    for (let k = 0; k < n; k++) {
      const a = (k + (row % 2) * 0.5) / n * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.84, outward = Math.atan2(0.84 * Math.cos(a), Math.sin(a));
      inst.add(room, "galeria-petala", petal, gold, F(x, y, z, outward, 1 + flare * 0.6, 1 + flare * 0.5, 1, -(0.45 + flare * 0.7)));
    }
  }
}
/** «Plissê»: coluna de papel de seda em plissê fundo e a gola-leque plissada atrás da cabeça. */
export function plisseGown(b: Batch, room: string, F: Fr, q: Quality) {
  mannequin(b, room, F, { arms: "down", base: false });
  const paper = satin("plisse", "#f1ece2", { sheen: "#ffffff", rough: 0.62, clear: 0 });
  b.add(room, paper, gownGeo("plisse", "column", q, { pleats: 36, pleatAmp: 0.16, amp: 0.0, scale: 1.08 }), F(0, 0, 0), { cast: true });
  b.add(room, paper, geo(`galeria-gola-${q}`, () => {
    const g = new THREE.CircleGeometry(0.36, q === "high" ? 72 : 40, 0, Math.PI), p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), a = Math.atan2(y, x), r = Math.hypot(x, y); p.setZ(i, (r / 0.36) * 0.025 * (Math.abs(((a * 30 / Math.PI) % 2) - 1) * 2 - 1)); }
    g.computeVertexNormals(); return g;
  }), F(0, 1.42, -0.09, 0, 1, 1, 1, -0.2));
}

/* ---------- acessórios das vitrines de parede ---------- */
const felt = (key: string, color: string, q: Quality) => fabric(`galeria-feltro-${key}`, color, q, { rough: 0.95 });
/** Cabeça de feltro num suporte de latão que sai de y0 (topo da cabeça em h). */
export function headStand(b: Batch, room: string, F: Fr, x: number, z: number, y0: number, h: number, q: Quality) {
  b.add(room, plain("galeria-latao", "#c9a24b", { metal: 1, rough: 0.28 }), CYL0(10), F(x, y0, z, 0, 0.012, h - 0.2 - y0, 0.012));
  b.add(room, plain("galeria-latao", "#c9a24b", { metal: 1, rough: 0.28 }), CYL0(20), F(x, y0, z, 0, 0.07, 0.012, 0.07));
  b.add(room, felt("cabeca", "#cfc3ad", q), geo("galeria-cabecaFeltro", () => new THREE.SphereGeometry(1, 16, 12).scale(0.085, 0.115, 0.1)), F(x, h - 0.11, z));
}
/** Chapéus: 0 capelina de aba larga com fita, 1 casquete com véu, 2 cloche. Pousados numa cabeça de altura h. */
export function hat(b: Batch, room: string, F: Fr, x: number, z: number, h: number, kind: number, q: Quality) {
  if (kind === 0) {
    b.add(room, felt("capelina", "#151517", q), lathe("galeria-capelina", [[0.29, 0], [0.3, 0.008], [0.12, 0.03], [0.105, 0.12], [0.06, 0.135], [0, 0.138]], 32), F(x, h - 0.07, z, 0, 1, 1, 1, 0.12));
    b.add(room, satin("fitaRosa", "#c75a7c", { rough: 0.35 }), geo("galeria-fitaChapeu", () => new THREE.CylinderGeometry(0.108, 0.112, 0.03, 32, 1, true)), F(x, h - 0.03, z, 0, 1, 1, 1, 0.12));
  } else if (kind === 1) {
    b.add(room, fabric("galeria-veludoVinho", "#4a0f22", q), lathe("galeria-casquete", [[0.1, 0], [0.1, 0.06], [0.07, 0.075], [0, 0.078]], 28), F(x, h - 0.05, z, 0, 1, 1, 1, -0.2));
    b.add(room, satin("veu", "#1a1a1e", { opacity: 0.35, rough: 0.8, clear: 0 }), geo("galeria-veu", () => new THREE.SphereGeometry(0.13, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.4)), F(x, h - 0.12, z + 0.01, 0, 1, 0.9, 1, 0.5));
  } else {
    b.add(room, felt("cloche", "#6b5a7a", q), lathe("galeria-cloche", [[0.13, 0], [0.135, 0.02], [0.115, 0.1], [0.07, 0.15], [0, 0.16]], 28), F(x, h - 0.09, z));
    b.add(room, satin("fitaPreta", "#111", { rough: 0.3 }), geo("galeria-fitaCloche", () => new THREE.TorusGeometry(0.122, 0.008, 6, 32).rotateX(Math.PI / 2)), F(x, h - 0.065, z));
  }
}
/** Luva longa num suporte de mão (em pé). */
export function gloveStand(b: Batch, room: string, F: Fr, x: number, z: number, y: number, m: THREE.Material, len = 0.42) {
  b.add(room, m, capsule("luva", 0.05, 0.2), F(x, y + len / 2 + 0.03, z, 0, 0.68, len / 0.3, 0.6));
  b.add(room, m, geo("galeria-mao", () => new THREE.SphereGeometry(1, 10, 8).scale(0.036, 0.065, 0.016)), F(x, y + len + 0.08, z));
  for (let k = 0; k < 4; k++) b.add(room, m, capsule("dedo", 0.05, 0.2), F(x - 0.027 + k * 0.018, y + len + 0.15 + (k === 0 || k === 3 ? -0.012 : 0), z, 0, 0.17, 0.2, 0.17));
  b.add(room, plain("galeria-acrilico", "#e8eef0", { rough: 0.05, transparent: true, opacity: 0.35 }), CYL0(12), F(x, y, z, 0, 0.04, 0.03, 0.04));
}
/** Bolsa de mão (clutch) com fecho de latão. */
export function clutch(b: Batch, room: string, F: Fr, x: number, y: number, z: number, ry: number, m: THREE.Material) {
  b.add(room, m, geo("galeria-clutch", () => { const s = new THREE.Shape(); s.moveTo(-0.13, 0); s.lineTo(0.13, 0); s.quadraticCurveTo(0.15, 0.06, 0.12, 0.13); s.lineTo(-0.12, 0.13); s.quadraticCurveTo(-0.15, 0.06, -0.13, 0); return new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }).translate(0, 0, -0.0175); }), F(x, y, z, ry, 1, 1, 1, -0.25));
  b.add(room, goldMat(), geo("galeria-fecho", () => new THREE.TorusGeometry(0.012, 0.004, 6, 12)), F(x, y + 0.135, z, ry, 1, 1, 1, Math.PI / 2 - 0.25));
}
/** Leque aberto de seda pintada num suporte. */
export function fan(b: Batch, room: string, F: Fr, x: number, y: number, z: number, ry: number) {
  b.add(room, satin("leque", "#e9d6c0", { rough: 0.5 }), geo("galeria-lequeGeo", () => {
    const g = new THREE.CircleGeometry(0.22, 48, 0.15, Math.PI - 0.3), p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getY(i), p.getX(i)), r = Math.hypot(p.getX(i), p.getY(i)); p.setZ(i, (r / 0.22) * 0.012 * Math.sin(a * 44)); }
    g.computeVertexNormals(); return g;
  }), F(x, y, z, ry, 1, 1, 1, -0.15));
  b.add(room, plain("galeria-madreperola", "#efe8e0", { rough: 0.25, env: 1.5 }), CYL0(6), F(x, y - 0.04, z, ry, 0.006, 0.06, 0.006));
}
/** Escarpim de cetim (salto agulha) — perfil lateral extrudado. */
export function pump(b: Batch, room: string, F: Fr, x: number, y: number, z: number, ry: number, m: THREE.Material) {
  b.add(room, m, geo("galeria-escarpim", () => {
    const s = new THREE.Shape(); s.moveTo(-0.11, 0.075); s.lineTo(-0.105, 0.0); s.lineTo(-0.098, 0.0); s.lineTo(-0.09, 0.07); s.quadraticCurveTo(-0.02, 0.06, 0.05, 0.012); s.quadraticCurveTo(0.1, 0.0, 0.13, 0.012);
    s.quadraticCurveTo(0.135, 0.035, 0.09, 0.045); s.quadraticCurveTo(0.03, 0.06, -0.02, 0.085); s.quadraticCurveTo(-0.07, 0.1, -0.11, 0.075);
    return new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 8 }).translate(0, 0, -0.03).rotateY(-Math.PI / 2);
  }), F(x, y, z, ry));
}

/* ---------- joias (galeria e Sala das Joias) ---------- */
/** Colar em arco: pedras brancas graduadas e uma pedra de cor no centro (frente para +z do quadro). */
export function necklace(inst: Instances, room: string, F: Fr, x: number, y: number, z: number, r: number, n: number, center: THREE.Material, key = "galeria-colar") {
  for (let s = 0; s <= n; s++) {
    const a = Math.PI * (0.08 + 0.84 * (s / n)), mid = 1 - Math.abs(s / n - 0.5) * 2, sz = 0.004 + 0.004 * mid;
    inst.add(room, `${key}-b`, gemGeo(), crystalMat(), F(x + Math.cos(a) * r, y - Math.sin(a) * r * 0.55, z + Math.sin(a) * r * 0.25, s, sz));
    if (s % 2 === 0) inst.add(room, `${key}-o`, SPH(6), whiteGoldMat(), F(x + Math.cos(a) * r, y - Math.sin(a) * r * 0.55 + 0.006, z + Math.sin(a) * r * 0.25 - 0.002, 0, 0.0025));
  }
  inst.add(room, `${key}-c`, gemGeo(), center, F(x, y - r * 0.6, z + r * 0.25 + 0.004, 0.4, 0.012, 0.016, 0.009));
}
/** Colar de pérolas de duas voltas. */
export function pearls(inst: Instances, room: string, F: Fr, x: number, y: number, z: number, r: number) {
  for (let t = 0; t < 2; t++) for (let s = 0; s <= 26; s++) { const a = Math.PI * (0.06 + 0.88 * (s / 26)), rr = r + t * 0.025; inst.add(room, "galeria-perola", pearlGeo(), pearlMat(), F(x + Math.cos(a) * rr, y - Math.sin(a) * rr * 0.6 - t * 0.012, z + Math.sin(a) * rr * 0.25, 0, 0.0065)); }
}
/** Tiara: aro de ouro branco com pontas de brilhantes, mais alta no centro. */
export function tiara(b: Batch, inst: Instances, room: string, F: Fr, x: number, y: number, z: number, s = 1, center: THREE.Material = crystalMat()) {
  b.add(room, whiteGoldMat(), geo("galeria-tiaraAro", () => new THREE.TorusGeometry(0.075, 0.0035, 6, 32, Math.PI).rotateX(-0.35)), F(x, y, z, 0, s));
  for (let k = 0; k <= 12; k++) {
    const t = k / 12, a = Math.PI * t, tall = 1 - Math.abs(t - 0.5) * 1.6;
    const px = x + Math.cos(a) * 0.075 * s, pz = z - Math.sin(a) * 0.075 * s * 0.35, h = (0.012 + 0.03 * Math.max(0, tall)) * s;
    inst.add(room, "galeria-tiaraPonta", CYL0(5), whiteGoldMat(), F(px, y + Math.sin(a) * 0.075 * s * 0.94, pz, 0, 0.0015 * s, h, 0.0015 * s));
    inst.add(room, "galeria-tiaraGema", gemGeo(), k === 6 ? center : crystalMat(), F(px, y + Math.sin(a) * 0.075 * s * 0.94 + h, pz, k, (k === 6 ? 0.008 : 0.0045) * s));
  }
}
/** Par de brincos em gota pendurados num suporte em T. */
export function earrings(b: Batch, inst: Instances, room: string, F: Fr, x: number, y: number, z: number, m: THREE.Material) {
  b.add(room, plain("galeria-veludoPreto", "#0e0e10", { rough: 0.9 }), CYL0(8), F(x, y, z, 0, 0.006, 0.16, 0.006));
  b.add(room, plain("galeria-veludoPreto", "#0e0e10", { rough: 0.9 }), CYL0(8), F(x, y + 0.16, z, 0, 0.006, 0.12, 0.006, 0, Math.PI / 2));
  for (const s of [-1, 1]) { inst.add(room, "galeria-brincoTopo", gemGeo(), crystalMat(), F(x + s * 0.045, y + 0.14, z + 0.008, 0, 0.005)); inst.add(room, "galeria-brincoGota", pearlGeo(), m, F(x + s * 0.045, y + 0.105, z + 0.008, 0, 0.009, 0.014, 0.009)); }
}
/** Anel com pedra (pousado). */
export function ring(inst: Instances, room: string, F: Fr, x: number, y: number, z: number, m: THREE.Material) {
  inst.add(room, "galeria-anelAro", geo("galeria-anel", () => new THREE.TorusGeometry(0.009, 0.0018, 6, 18)), goldMat(), F(x, y + 0.01, z, 0, 1));
  inst.add(room, "galeria-anelGema", gemGeo(), m, F(x, y + 0.021, z, 0.5, 0.005));
}
/** Busto de veludo preto para colar (pescoço e colo). */
export function jewelBust(b: Batch, room: string, F: Fr, x: number, y: number, z: number, s = 1) {
  b.add(room, plain("galeria-veludoPreto", "#0e0e10", { rough: 0.9 }), lathe("galeria-bustoJoia", [[0, 0], [0.13, 0], [0.135, 0.03], [0.1, 0.12], [0.06, 0.2], [0.045, 0.3], [0.04, 0.33], [0, 0.335]], 24), F(x, y, z, 0, s, s, s * 0.72));
}
