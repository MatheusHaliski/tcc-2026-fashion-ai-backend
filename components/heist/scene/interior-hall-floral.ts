/*
 * MET Gala Heist v2 — a instalação floral do centro do Grande Salão (interior-hall.ts): o balcão redondo coberto de
 * rosas, a coroa de rosas de quase sete metros com fios de pérolas e remate dourado, castiçais acesos e pétalas caídas.
 */
import * as THREE from "three";
import { Batch, CYL0, Instances, SPH, geo, mat } from "./interior-batch";
import { M, solid } from "./interior-mats";
import type { Quality } from "./interior-tex";
import { candelabra, leafGeometry, petalGeometry, roseColor, roseGeometry } from "./interior-hall-ornaments";

/** A instalação floral do centro do salão (prop "floral", r 1,6 m): balcão de rosas e a coroa de rosas. */
export function buildFloral(q: Quality, cx: number, cz: number, rad: number, batch: Batch, inst: Instances, flames: THREE.Vector3[]) {
  const P = M(q), room = "salao", rose = roseGeometry(q), leaf = leafGeometry(), petal = petalGeometry();
  const roseMat = solid("roseMat", "#ffffff", { rough: 0.72, side: THREE.DoubleSide, env: 0.4 });
  const leafMat = solid("leafMat", "#2f5a2c", { rough: 0.7, side: THREE.DoubleSide, env: 0.3 });
  let seed = 7; const r = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const dense = q === "high" ? 1 : 0.45, R = rad - 0.08, H = 1.05;
  batch.add(room, solid("mossBase", "#1f2a1b", { rough: 1 }), CYL0(32), mat(cx, 0, cz, 0, R - 0.06, H, R - 0.06));
  const put = (x: number, y: number, z: number, nx: number, ny: number, nz: number, s: number) => {
    const m = new THREE.Matrix4(), up = new THREE.Vector3(nx, ny, nz).normalize(), qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    qq.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2));
    m.compose(new THREE.Vector3(x, y, z), qq, new THREE.Vector3(s, s, s)); inst.add(room, "rose", rose, roseMat, m, roseColor(r));
  };
  // lateral do balcão (em fiadas) e o topo em cúpula baixa
  const side = Math.round(2 * Math.PI * R / 0.17);
  for (let row = 0; row < 7; row++) for (let k = 0; k < side; k++) {
    if (r() > dense) continue;
    const a = (k + (row % 2) * 0.5) / side * Math.PI * 2 + r() * 0.05, y = 0.1 + row * 0.15 + r() * 0.03;
    put(cx + Math.cos(a) * R, y, cz + Math.sin(a) * R, Math.cos(a), 0.15, Math.sin(a), 0.085 + r() * 0.03);
  }
  for (let ring = 0; ring < 9; ring++) {
    const rr = R * (1 - ring / 9) * 0.98, n = Math.max(1, Math.round(2 * Math.PI * rr / 0.17));
    for (let k = 0; k < n; k++) { if (r() > dense) continue; const a = (k / n) * Math.PI * 2 + ring * 0.4, y = H + 0.06 + 0.22 * (1 - (rr / R) ** 2); put(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr, Math.cos(a) * rr / R * 0.6, 1, Math.sin(a) * rr / R * 0.6, 0.09 + r() * 0.03); }
  }
  for (let k = 0; k < 260 * dense; k++) {
    const a = r() * Math.PI * 2, y = 0.08 + r() * (H + 0.1), m = mat(cx + Math.cos(a) * (R + 0.02), y, cz + Math.sin(a) * (R + 0.02), -a + Math.PI / 2, 0.09 + r() * 0.04, 0.09 + r() * 0.04, 1, -0.4 + r() * 0.8, (r() - 0.5) * 1.2);
    inst.add(room, "leaf", leaf, leafMat, m);
  }
  // a coroa: 8 nervuras que se abrem até 2,1 m e se fecham no remate a ~6,8 m
  const ribs = 8, top = 6.8;
  const ribMat = solid("ribMat", "#203222", { rough: 0.95 });
  for (let k = 0; k < ribs; k++) {
    const a = (k / ribs) * Math.PI * 2;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16, rr = 1.05 + 1.05 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.55) - 0.75 * t * t, y = H + 0.15 + (top - H - 0.15) * t; pts.push(new THREE.Vector3(cx + Math.cos(a) * Math.max(0.12, rr), y, cz + Math.sin(a) * Math.max(0.12, rr))); }
    const curve = new THREE.CatmullRomCurve3(pts);
    batch.add(room, ribMat, new THREE.TubeGeometry(curve, 40, 0.1, 6, false));
    const len = curve.getLength(), n = Math.round(len / (0.16 / Math.max(0.5, dense)));
    for (let i = 0; i < n; i++) {
      const t = i / n, p = curve.getPointAt(t), tan = curve.getTangentAt(t), out = new THREE.Vector3(p.x - cx, 0, p.z - cz).normalize();
      for (const [side2, lift] of [[0, 0], [1, 0.4], [-1, 0.4]]) {
        if (side2 !== 0 && r() > dense * 0.8) continue;
        const perp = new THREE.Vector3().crossVectors(tan, out).normalize().multiplyScalar(side2 * 0.11);
        const nrm = out.clone().multiplyScalar(1).add(new THREE.Vector3(0, lift, 0)).add(perp.clone().multiplyScalar(4));
        put(p.x + perp.x + out.x * 0.05, p.y + perp.y, p.z + perp.z + out.z * 0.05, nrm.x, nrm.y + 0.2, nrm.z, 0.075 + r() * 0.03);
      }
    }
    // fio de pérolas em catenária até a próxima nervura (na altura de maior abertura)
    if (q === "high") {
      const b = ((k + 1) / ribs) * Math.PI * 2, y0 = H + 2.2, ra = 2.05;
      const pA = new THREE.Vector3(cx + Math.cos(a) * ra, y0, cz + Math.sin(a) * ra), pB = new THREE.Vector3(cx + Math.cos(b) * ra, y0, cz + Math.sin(b) * ra);
      for (let i = 1; i < 26; i++) { const t = i / 26, p = pA.clone().lerp(pB, t); p.y -= Math.sin(Math.PI * t) * 0.55; inst.add(room, "pearl", SPH(8), solid("pearl", "#f7f1e6", { rough: 0.15, env: 1.6 }), mat(p.x, p.y, p.z, 0, 0.028)); }
    }
  }
  // remate: esfera de rosas brancas e a estrela dourada
  for (let k = 0; k < 40 * dense + 10; k++) { const u = r() * Math.PI * 2, v = Math.acos(2 * r() - 1), rr = 0.42; put(cx + Math.sin(v) * Math.cos(u) * rr, top + 0.25 + Math.cos(v) * rr, cz + Math.sin(v) * Math.sin(u) * rr, Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u), 0.08); }
  const star = geo("finialStar", () => { const s = new THREE.Shape(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? 0.16 : 0.42; if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }).translate(0, 0, -0.03); });
  for (const ry of [0, Math.PI / 2]) batch.add(room, P.goldBright, star, mat(cx, top + 0.95, cz, ry));
  // castiçais sobre as rosas, na borda do balcão
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; candelabra(room, mat(cx + Math.cos(a) * (R - 0.3), H + 0.12, cz + Math.sin(a) * (R - 0.3), a), 1.15, P, batch, inst, flames); }
  // pétalas caídas no terrazzo em volta
  for (let k = 0; k < 220 * dense; k++) {
    const a = r() * Math.PI * 2, d = rad + 0.05 + Math.pow(r(), 2) * 2.4;
    inst.add(room, "fallenPetal", petal, roseMat, mat(cx + Math.cos(a) * d, 0.004 + r() * 0.002, cz + Math.sin(a) * d, r() * Math.PI * 2, 0.03 + r() * 0.02), roseColor(r));
  }
}
