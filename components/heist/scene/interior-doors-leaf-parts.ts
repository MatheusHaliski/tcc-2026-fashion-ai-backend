/*
 * MET Gala Heist v2 — peças comuns das folhas de porta (interior-doors-leaf.ts): a especificação da folha e a espessura
 * de cada família, os materiais, a montagem por material (geometria mesclada) e as peças que todas usam — almofada
 * levantada, quadro com furo, peça numa face, dobradiças à vista e o corpo da mola aérea.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { geo, mat } from "./interior-batch";
import { glass, solid, type Palette } from "./interior-mats";
import type { RoomId } from "@/lib/heist/types";

export type LeafStyle = "grand" | "steel" | "padded" | "stage" | "french" | "jib" | "vault";
export interface LeafSpec {
  style: LeafStyle; w: number; h: number;
  /** +1: o lado de puxar (para onde a folha abre) é a frente (+z); −1: é o verso */
  pull: 1 | -1;
  /** sala para onde a frente (+z) e o verso (−z) olham */
  front: RoomId | null; back: RoomId | null;
  /** texto do estêncil (palco) */
  stencil?: string;
  /** mola aérea */
  closer?: boolean;
  /** porta disfarçada: coordenada (ao longo da parede) da dobradiça e o sentido da folha, para a cantaria casar com a parede */
  wallUv?: { origin: number; dir: number };
}
export const LEAF_T: Record<LeafStyle, number> = { grand: 0.075, steel: 0.05, padded: 0.08, stage: 0.055, french: 0.055, jib: 0.06, vault: 0.3 };

/* ---------- materiais das portas ---------- */
const dm = (key: string, color: string, o: Parameters<typeof solid>[2] = {}) => solid(`vestibulo-door-${key}`, color, o);
export function doorMats(P: Palette) {
  return {
    walnut: P.walnut, gold: P.gold, brass: P.brass, chrome: P.chrome,
    steelPaint: dm("steelPaint", "#4d5761", { metal: 0.45, rough: 0.48 }),
    steelPaintLight: dm("steelPaintLight", "#8a9095", { metal: 0.4, rough: 0.5 }),
    inox: dm("inox", "#b9bdc1", { metal: 0.95, rough: 0.3 }),
    rubber: dm("rubber", "#121212", { rough: 0.85 }),
    leather: dm("leatherOx", "#4a1418", { rough: 0.55, env: 0.8 }),
    mahogany: P.mahogany,
    blackDoor: dm("blackDoorBase", "#141416", { rough: 0.7 }),
    alu: dm("alu", "#a8adb3", { metal: 0.85, rough: 0.35 }),
    whitePaint: dm("whitePaint", "#e9e5dc", { rough: 0.42, env: 0.8 }),
    vaultSteel: dm("vaultSteel", "#8f949a", { metal: 0.95, rough: 0.2, env: 1.2 }),
    vaultDark: dm("vaultDark", "#5c6167", { metal: 0.9, rough: 0.32 }),
    limestone: P.limestone, marbleDark: P.marbleDark,
    glassClear: glass("vestibulo-door-glass", { opacity: 0.2, tint: "#dbe8ea" }),
    glassWire: glass("vestibulo-door-wire", { opacity: 0.38, tint: "#c3ccd0", rough: 0.12 }),
  };
}
export type DoorMats = ReturnType<typeof doorMats>;

/* ---------- montagem por material ---------- */
export class Parts {
  private by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(m: THREE.Material, g: THREE.BufferGeometry, M?: THREE.Matrix4) {
    const src = g.index ? g.toNonIndexed() : g.clone(); if (!src.getAttribute("normal")) src.computeVertexNormals();
    const out = new THREE.BufferGeometry(); out.setAttribute("position", src.getAttribute("position").clone()); out.setAttribute("normal", src.getAttribute("normal").clone());
    out.setAttribute("uv", src.getAttribute("uv")?.clone() ?? new THREE.BufferAttribute(new Float32Array(src.getAttribute("position").count * 2), 2));
    if (M) out.applyMatrix4(M);
    let l = this.by.get(m); if (!l) { l = []; this.by.set(m, l); } l.push(out);
  }
  box(m: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) { this.add(m, BOXN(), mat((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, Math.max(1e-4, x1 - x0), Math.max(1e-4, y1 - y0), Math.max(1e-4, z1 - z0))); }
  done(): { m: THREE.Material; g: THREE.BufferGeometry }[] { return [...this.by].map(([m, l]) => ({ m, g: mergeGeometries(l, false) ?? l[0] })); }
}
export const BOXN = () => geo("vestibulo-door-box", () => new THREE.BoxGeometry(1, 1, 1));
export const CYLN = (seg = 12) => geo(`vestibulo-door-cyl${seg}`, () => new THREE.CylinderGeometry(1, 1, 1, seg));
export const raised = (w: number, h: number, d: number, b: number) => geo(`vestibulo-door-raised-${w.toFixed(3)}-${h.toFixed(3)}-${d}-${b}`, () => {
  const s = new THREE.Shape(), x = w / 2 - b, y = h / 2 - b; s.moveTo(-x, -y); s.lineTo(x, -y); s.lineTo(x, y); s.lineTo(-x, y); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - b), bevelEnabled: true, bevelSize: b, bevelThickness: b * 0.7, bevelSegments: 2 });
});
export const frame = (w: number, h: number, fw: number, d: number, b = 0.006) => geo(`vestibulo-door-frame-${w.toFixed(3)}-${h.toFixed(3)}-${fw}-${d}`, () => {
  const s = new THREE.Shape(), x = w / 2, y = h / 2; s.moveTo(-x, -y); s.lineTo(x, -y); s.lineTo(x, y); s.lineTo(-x, y); s.closePath();
  const hole = new THREE.Path(), ix = x - fw, iy = y - fw; hole.moveTo(-ix, -iy); hole.lineTo(-ix, iy); hole.lineTo(ix, iy); hole.lineTo(ix, -iy); hole.closePath(); s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - b), bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 2 });
});
/** Peça em uma face: `side` +1 = frente (+z), −1 = verso; `z` = distância da face central da folha. */
export const onFace = (side: number, x: number, y: number, z: number) => mat(x, y, side * z, side > 0 ? 0 : Math.PI);

/** Dobradiças à vista (canecas e capas) na borda da dobradiça, do lado de puxar. */
export function hinges(p: Parts, m: THREE.Material, h: number, t: number, pull: number, n: number, r = 0.012) {
  for (let k = 0; k < n; k++) {
    const y = n === 1 ? h / 2 : 0.25 + k * ((h - 0.5) / (n - 1));
    p.add(m, CYLN(12), mat(-0.004, y, pull * (t / 2 + 0.002), 0, r, 0.12, r));
    p.add(m, geo("vestibulo-door-hingeTip", () => new THREE.SphereGeometry(1, 10, 6)), mat(-0.004, y + 0.065, pull * (t / 2 + 0.002), 0, r * 0.9, r * 1.4, r * 0.9));
    p.box(m, 0, y - 0.06, pull > 0 ? t / 2 : -t / 2 - 0.002, 0.05, y + 0.06, pull > 0 ? t / 2 + 0.002 : -t / 2);
  }
}
/**
 * Corpo da mola aérea em braço paralelo: preso na face de EMPURRAR da folha, junto da dobradiça (a folha gira no meio da
 * parede de 50 cm; deste lado o braço e a sapata nunca cruzam a folha quando ela abre).
 */
export function closerBody(p: Parts, m: THREE.Material, h: number, t: number, side: number) {
  const z0 = side * (t / 2), z1 = side * (t / 2 + 0.055);
  p.box(m, 0.08, h - 0.16, Math.min(z0, z1), 0.4, h - 0.08, Math.max(z0, z1));
  p.add(m, CYLN(12), mat(0.12, h - 0.12, side * (t / 2 + 0.06), 0, 0.016, 0.03, 0.016));
}
