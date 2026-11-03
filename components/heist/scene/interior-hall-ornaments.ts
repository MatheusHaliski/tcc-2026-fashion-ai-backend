/*
 * MET Gala Heist v2 — ornamentos do Grande Salão reaproveitados pelas outras salas (interior-hall.ts): a rosa
 * instanciada (com folha, pétala caída e a paleta de cores), o castiçal de cinco velas e o lustre de cristal.
 */
import * as THREE from "three";
import { Batch, CYL, CYL0, Instances, geo, mat, mul } from "./interior-batch";
import { solid, type Palette } from "./interior-mats";
import type { Quality } from "./interior-tex";

/* ---------- rosa (instanciada) ---------- */
/** Botão de rosa: anéis de pétalas curvas abrindo para fora (high: 3 anéis; low: 2). Raio ~1, base em y = 0. */
export function roseGeometry(q: Quality): THREE.BufferGeometry {
  return geo(`rose-${q}`, () => {
    const rings = q === "high" ? [{ n: 4, r: 0.18, out: 0.18, h: 0.75 }, { n: 6, r: 0.45, out: 0.4, h: 0.68 }, { n: 8, r: 0.75, out: 0.55, h: 0.5 }] : [{ n: 5, r: 0.3, out: 0.3, h: 0.7 }, { n: 7, r: 0.7, out: 0.55, h: 0.5 }];
    const pos: number[] = [], idx: number[] = []; const SA = q === "high" ? 3 : 2, SU = 2;
    rings.forEach((ring, ri) => {
      for (let p = 0; p < ring.n; p++) {
        const c = (p / ring.n) * Math.PI * 2 + ri * 0.6, half = (Math.PI / ring.n) * 1.25, base = pos.length / 3;
        for (let u = 0; u <= SU; u++) for (let a = 0; a <= SA; a++) {
          const t = u / SU, wTaper = Math.sin(Math.PI * (0.2 + 0.8 * t)) * 0.9 + 0.1, ang = c + (a / SA - 0.5) * 2 * half * wTaper;
          const rad = ring.r + ring.out * t * t + 0.06 * Math.sin((a / SA) * Math.PI), y = ring.h * t * (1.15 - 0.3 * t) + 0.12 * ri * (1 - t);
          pos.push(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
        }
        for (let u = 0; u < SU; u++) for (let a = 0; a < SA; a++) { const k = base + u * (SA + 1) + a; idx.push(k, k + SA + 1, k + 1, k + 1, k + SA + 1, k + SA + 2); }
      }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const bud = new THREE.SphereGeometry(0.22, 8, 6).translate(0, 0.42, 0);
    const merged = new THREE.BufferGeometry(); const bp = bud.toNonIndexed().getAttribute("position").array as Float32Array, gp = g.toNonIndexed();
    const all = new Float32Array(gp.getAttribute("position").array.length + bp.length); all.set(gp.getAttribute("position").array as Float32Array); all.set(bp, gp.getAttribute("position").array.length);
    merged.setAttribute("position", new THREE.BufferAttribute(all, 3)); merged.computeVertexNormals();
    return merged;
  });
}
export const leafGeometry = () => geo("leaf", () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.45, 0.5, 0, 1.2); s.quadraticCurveTo(-0.45, 0.5, 0, 0); return new THREE.ShapeGeometry(s, 4); });
export const petalGeometry = () => geo("petal", () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.6, 0.4, 0.1, 1); s.quadraticCurveTo(-0.5, 0.5, 0, 0); return new THREE.ShapeGeometry(s, 3).rotateX(-Math.PI / 2); });

const ROSE_COLORS: [string, number][] = [["#f4c3cf", 4], ["#f8dbe2", 3], ["#f3ece0", 3], ["#ef9a8c", 1.5], ["#c0304f", 1.2], ["#ecd3a8", 1.5], ["#e7a6bb", 2]];
export function roseColor(r: () => number): THREE.Color {
  const tot = ROSE_COLORS.reduce((a, [, w]) => a + w, 0); let x = r() * tot;
  for (const [c, w] of ROSE_COLORS) { x -= w; if (x <= 0) return new THREE.Color(c).multiplyScalar(0.92 + r() * 0.12); }
  return new THREE.Color(ROSE_COLORS[0][0]);
}

/* ---------- castiçal ---------- */
const candelabraStem = () => geo("candStem", () => new THREE.LatheGeometry([[0.16, 0], [0.16, 0.03], [0.06, 0.06], [0.05, 0.25], [0.09, 0.3], [0.03, 0.36], [0.035, 0.75], [0.07, 0.8], [0.03, 0.84]].map(([x, y]) => new THREE.Vector2(x, y)), 16));
/** Castiçal de cinco velas em ouro velho (escala s), com velas e chamas instanciadas. */
export function candelabra(room: string, at: THREE.Matrix4, s: number, P: Palette, batch: Batch, inst: Instances, flames: THREE.Vector3[]) {
  batch.add(room, P.gold, candelabraStem(), mul(at, mat(0, 0, 0, 0, s)));
  const arms = 4, armR = 0.26 * s, y = 0.78 * s;
  for (let k = 0; k < arms; k++) {
    const a = (k / arms) * Math.PI * 2 + Math.PI / 4, x = Math.cos(a) * armR, z = Math.sin(a) * armR;
    batch.add(room, P.gold, CYL(8), mul(at, mat(x / 2, y, z / 2, -a, 0.012 * s, armR, 0.012 * s, 0, Math.PI / 2)));
    batch.add(room, P.gold, CYL0(10), mul(at, mat(x, y, z, 0, 0.03 * s, 0.04 * s, 0.03 * s)));
  }
  const tips: [number, number, number][] = [[0, 0.84 * s, 0], ...Array.from({ length: arms }, (_, k) => { const a = (k / arms) * Math.PI * 2 + Math.PI / 4; return [Math.cos(a) * armR, y + 0.04 * s, Math.sin(a) * armR] as [number, number, number]; })];
  const v = new THREE.Vector3();
  for (const [x, yy, z] of tips) {
    inst.add(room, "candle", CYL0(8), P.candle, mul(at, mat(x, yy, z, 0, 0.018 * s, 0.22 * s, 0.018 * s)));
    inst.add(room, "flame", geo("flameGeo", () => new THREE.SphereGeometry(1, 6, 5).scale(0.5, 1.4, 0.5)), P.flame, mul(at, mat(x, yy + 0.25 * s, z, 0, 0.022 * s)));
    v.set(x, yy + 0.25 * s, z).applyMatrix4(at); flames.push(v.clone());
  }
}

/** Lustre de cristal: haste, dois anéis de braços com lâmpadas de vela e cascata de cristais. */
export function chandelier(room: string, x: number, y: number, z: number, ceiling: number, q: Quality, P: Palette, batch: Batch, inst: Instances, out: THREE.Vector3[], scale = 1) {
  const s = scale;
  batch.add(room, P.gold, CYL(8), mat(x, (ceiling + y + 0.9 * s) / 2, z, 0, 0.018, ceiling - y - 0.9 * s, 0.018));
  batch.add(room, P.gold, geo("chBody", () => new THREE.LatheGeometry([[0.02, 0], [0.12, 0.05], [0.07, 0.25], [0.1, 0.5], [0.05, 0.7], [0.08, 0.85], [0.02, 0.92]].map(([a, b]) => new THREE.Vector2(a, b)), 16)), mat(x, y, z, 0, s));
  const crystal = geo("crystal", () => new THREE.OctahedronGeometry(1, 0).scale(0.5, 1.3, 0.5));
  const crystalMat = solid("crystalMat", "#f6f3ff", { metal: 0.1, rough: 0.02, env: 2.2, transparent: true, opacity: 0.85 });
  for (const [ry, rr, n] of [[0.32, 0.85, 10], [0.62, 0.5, 6]] as [number, number, number][]) {
    batch.add(room, P.gold, geo(`chRing${rr}`, () => new THREE.TorusGeometry(rr, 0.015, 6, 48).rotateX(Math.PI / 2)), mat(x, y + ry * s, z, 0, s));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * rr * s, pz = z + Math.sin(a) * rr * s;
      batch.add(room, P.gold, CYL0(8), mat(px, y + ry * s, pz, 0, 0.03 * s, 0.05 * s, 0.03 * s));
      inst.add(room, "chCandle", CYL0(8), P.candle, mat(px, y + (ry + 0.05) * s, pz, 0, 0.016 * s, 0.12 * s, 0.016 * s));
      inst.add(room, "chBulb", geo("flameGeo", () => new THREE.SphereGeometry(1, 6, 5).scale(0.5, 1.4, 0.5)), P.bulbWarm, mat(px, y + (ry + 0.2) * s, pz, 0, 0.03 * s));
      if (q === "high") for (let d = 0; d < 3; d++) inst.add(room, "crystal", crystal, crystalMat, mat(px, y + (ry - 0.06 - d * 0.08) * s, pz, a, 0.022 * s));
    }
    if (q === "high") for (let k = 0; k < n * 3; k++) { const a = (k / (n * 3)) * Math.PI * 2; inst.add(room, "crystal", crystal, crystalMat, mat(x + Math.cos(a) * rr * 0.7 * s, y + (ry - 0.2) * s, z + Math.sin(a) * rr * 0.7 * s, a, 0.028 * s)); }
  }
  out.push(new THREE.Vector3(x, y + 0.4 * s, z));
}
