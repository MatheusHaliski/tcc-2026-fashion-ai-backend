/*
 * MET Gala Heist v2 — folhas de porta de madeira e couro (interior-doors-leaf.ts): a nobre de nogueira (salão e
 * galeria), a acolchoada de couro capitonê (lounge) e a francesa de vidros (terraço).
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { geo, mat } from "./interior-batch";
import { CYLN, LEAF_T, Parts, closerBody, frame, hinges, onFace, raised, type DoorMats, type LeafSpec } from "./interior-doors-leaf-parts";

/* ---------- famílias ---------- */
export function grand(p: Parts, M: DoorMats, s: LeafSpec) {
  const { w, h } = s, t = LEAF_T.grand, st = 0.17, rails: [number, number][] = [[0, 0.3], [1.0, 1.18], [2.72, 2.86], [h - 0.18, h]];
  p.box(M.walnut, 0, 0, -t / 2, st, h, t / 2); p.box(M.walnut, w - st, 0, -t / 2, w, h, t / 2);
  for (const [a, b] of rails) p.box(M.walnut, st, a, -t / 2, w - st, b, t / 2);
  const panels: [number, number][] = [[0.3, 1.0], [1.18, 2.72], [2.86, h - 0.18]];
  for (const [a, b] of panels) {
    const pw = w - 2 * st, ph = b - a, cx = w / 2, cy = (a + b) / 2;
    p.box(M.walnut, st, a, -0.012, w - st, b, 0.012);
    for (const side of [1, -1]) {
      p.add(M.walnut, raised(pw - 0.07, ph - 0.07, 0.024, 0.014), onFace(side, cx, cy, 0.012));
      p.add(M.walnut, frame(pw + 0.02, ph + 0.02, 0.05, 0.03, 0.01), onFace(side, cx, cy, t / 2 - 0.008));
      p.add(M.gold, frame(pw - 0.1, ph - 0.1, 0.009, 0.03, 0.003), onFace(side, cx, cy, 0.012));
      // entalhes: florão no painel de cima, losango em relevo no grande e a cartela no de baixo
      if (b > h - 0.5) { p.add(M.gold, geo("vestibulo-door-rosette", () => { const sh = new THREE.Shape(); for (let i = 0; i <= 48; i++) { const a2 = (i / 48) * Math.PI * 2, r = 0.13 * (0.75 + 0.25 * Math.abs(Math.cos(a2 * 4))); if (i) sh.lineTo(Math.cos(a2) * r, Math.sin(a2) * r); else sh.moveTo(Math.cos(a2) * r, Math.sin(a2) * r); } return new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }); }), onFace(side, cx, cy, 0.03)); }
      else if (ph > 1) { p.add(M.walnut, geo("vestibulo-door-lozenge", () => { const sh = new THREE.Shape(); sh.moveTo(0, -0.42); sh.lineTo(0.2, 0); sh.lineTo(0, 0.42); sh.lineTo(-0.2, 0); sh.closePath(); return new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.016, bevelSegments: 2 }); }), onFace(side, cx, cy, 0.03)); }
      else p.add(M.gold, geo("vestibulo-door-cartouche", () => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(0.14, 0.08, 0.025)), onFace(side, cx, cy, 0.03));
    }
  }
  // ferragens: puxador vertical de 0,9 m do lado de puxar, placa de empurrar do outro, chapas de chute dos dois lados
  const hx = w - 0.09, pz = s.pull * (t / 2);
  p.add(M.brass, CYLN(14), mat(hx, 1.4, pz + s.pull * 0.065, 0, 0.018, 0.9, 0.018));
  for (const y of [1.0, 1.8]) p.add(M.brass, CYLN(10), mat(hx, y, pz + s.pull * 0.035, 0, 0.011, 0.06, 0.011, Math.PI / 2));
  p.box(M.brass, hx - 0.06, 1.15, -s.pull * (t / 2 + 0.004), hx + 0.06, 1.65, -s.pull * (t / 2));
  for (const side of [1, -1]) p.box(M.brass, 0.02, 0.0, side > 0 ? t / 2 : -t / 2 - 0.003, w - 0.02, 0.26, side > 0 ? t / 2 + 0.003 : -t / 2);
  hinges(p, M.brass, h, t, s.pull, 4, 0.016);
  if (s.closer) closerBody(p, M.brass, h, t, -s.pull);
}

export function padded(p: Parts, M: DoorMats, s: LeafSpec) {
  const { w, h } = s, t = LEAF_T.padded;
  p.box(M.mahogany, 0, 0, -t / 2 + 0.015, w, h, t / 2 - 0.015);
  // almofada de couro capitonê (losangos de 22 × 30 cm) com botões e o friso de tachas
  const pw = w - 0.12, ph = h - 0.22, pad = geo(`vestibulo-door-tufted-${pw.toFixed(3)}-${ph.toFixed(3)}`, () => {
    // só a face de couro é subdividida (os losangos afundam nos botões); o lado do estofado é uma caixa fina
    const g = new THREE.PlaneGeometry(pw, ph, 18, 44), pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const u = (x + pw / 2) / 0.22, v = (y + ph / 2) / 0.3, du = u - Math.round(u), dv = v - Math.round(v), du2 = u + 0.5 - Math.round(u + 0.5), dv2 = v + 0.5 - Math.round(v + 0.5);
      const d = Math.min(Math.hypot(du * 0.22, dv * 0.3), Math.hypot(du2 * 0.22, dv2 * 0.3)), edge = Math.min(pw / 2 - Math.abs(x), ph / 2 - Math.abs(y));
      pos.setZ(i, 0.012 + 0.02 * Math.min(1, d / 0.1) * Math.min(1, edge / 0.05));
    }
    g.computeVertexNormals();
    const side = new THREE.BoxGeometry(pw, ph, 0.012).translate(0, 0, 0.006);
    const a = g.toNonIndexed(), b = side.toNonIndexed();
    return mergeGeometries([a, b].map((x) => { const y = new THREE.BufferGeometry(); y.setAttribute("position", x.getAttribute("position")); y.setAttribute("normal", x.getAttribute("normal")); y.setAttribute("uv", x.getAttribute("uv")); return y; }), false) ?? a;
  });
  for (const side of [1, -1]) {
    p.add(M.leather, pad, onFace(side, w / 2, 0.11 + ph / 2, t / 2 - 0.015));
    for (let i = 0; i <= Math.floor(pw / 0.22); i++) for (let j = 0; j <= Math.floor(ph / 0.3); j++) for (const off of [0, 0.5]) {
      const x = -pw / 2 + (i + off) * 0.22, y = -ph / 2 + (j + off) * 0.3; if (Math.abs(x) > pw / 2 - 0.04 || Math.abs(y) > ph / 2 - 0.04) continue;
      p.add(M.leather, geo("vestibulo-door-button", () => new THREE.SphereGeometry(1, 8, 5)), mat(w / 2 + x * side, 0.11 + ph / 2 + y, side * (t / 2 - 0.004), 0, 0.012, 0.012, 0.006));
    }
    const nail = geo("vestibulo-door-nail", () => new THREE.IcosahedronGeometry(1, 0));
    for (let k = 0; k * 0.05 < pw; k++) for (const y of [0.11 + 0.02, 0.11 + ph - 0.02]) p.add(M.brass, nail, mat(0.06 + k * 0.05 + 0.025, y, side * (t / 2 + 0.006), 0, 0.007));
    for (let k = 0; k * 0.05 < ph; k++) for (const x of [0.08, w - 0.08]) p.add(M.brass, nail, mat(x, 0.11 + k * 0.05 + 0.025, side * (t / 2 + 0.006), 0, 0.007));
  }
  // placa oval de empurrar, puxador em D do outro lado, chapa de chute
  const ps = -s.pull;
  p.add(M.brass, geo("vestibulo-door-ovalPlate", () => new THREE.CylinderGeometry(1, 1, 1, 28).rotateX(Math.PI / 2).scale(0.09, 0.2, 0.004)), mat(w - 0.16, 1.3, ps * (t / 2 + 0.006)));
  const dz = s.pull * (t / 2);
  p.add(M.brass, geo("vestibulo-door-dpull", () => new THREE.TorusGeometry(0.11, 0.013, 8, 18, Math.PI).rotateZ(-Math.PI / 2)), mat(w - 0.13, 1.1, dz + s.pull * 0.012, s.pull > 0 ? Math.PI / 2 : -Math.PI / 2));
  for (const side of [1, -1]) p.box(M.brass, 0.03, 0, side > 0 ? t / 2 : -t / 2 - 0.003, w - 0.03, 0.1, side > 0 ? t / 2 + 0.003 : -t / 2);
  hinges(p, M.brass, h, t, s.pull, 3, 0.013);
  if (s.closer) closerBody(p, M.brass, h, t, -s.pull);
}

export function french(p: Parts, M: DoorMats, s: LeafSpec) {
  const { w, h } = s, t = LEAF_T.french, st = 0.11, bot = 0.32, top = 0.12, bar = 0.026;
  p.box(M.whitePaint, 0, 0, -t / 2, st, h, t / 2); p.box(M.whitePaint, w - st, 0, -t / 2, w, h, t / 2);
  p.box(M.whitePaint, st, 0, -t / 2, w - st, bot, t / 2); p.box(M.whitePaint, st, h - top, -t / 2, w - st, h, t / 2);
  for (const side of [1, -1]) p.add(M.whitePaint, raised(w - 2 * st - 0.05, bot - 0.1, 0.014, 0.008), onFace(side, w / 2, bot / 2 + 0.02, t / 2));
  const gx0 = st, gx1 = w - st, gy0 = bot, gy1 = h - top;
  p.box(M.glassClear, gx0, gy0, -0.003, gx1, gy1, 0.003);
  p.box(M.whitePaint, w / 2 - bar / 2, gy0, -0.016, w / 2 + bar / 2, gy1, 0.016);
  for (let k = 1; k < 5; k++) { const y = gy0 + k * (gy1 - gy0) / 5; p.box(M.whitePaint, gx0, y - bar / 2, -0.016, gx1, y + bar / 2, 0.016); }
  // cremona (vareta de latão) na borda do encontro e maçanetas dos dois lados
  p.add(M.brass, CYLN(10), mat(w - 0.05, h / 2, s.pull * (t / 2 + 0.012), 0, 0.007, h - 0.2, 0.007));
  for (const side of [1, -1]) { p.add(M.brass, geo("vestibulo-door-rose", () => new THREE.CylinderGeometry(0.028, 0.028, 0.01, 18).rotateX(Math.PI / 2)), onFace(side, w - 0.06, 1.05, t / 2 + 0.005)); p.add(M.brass, CYLN(10), mat(w - 0.12, 1.05, side * (t / 2 + 0.05), 0, 0.009, 0.11, 0.009, 0, Math.PI / 2)); }
  hinges(p, M.brass, h, t, s.pull, 3, 0.011);
}
