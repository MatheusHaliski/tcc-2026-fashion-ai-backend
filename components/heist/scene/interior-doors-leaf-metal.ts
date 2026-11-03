/*
 * MET Gala Heist v2 — folhas de porta de aço (interior-doors-leaf.ts): a de aço com visor aramado e barra antipânico,
 * a preta de palco com estêncil, a disfarçada na parede do salão e a blindada da Sala das Joias.
 */
import * as THREE from "three";
import { geo, mat } from "./interior-batch";
import { solid } from "./interior-mats";
import { CYLN, LEAF_T, Parts, closerBody, frame, hinges, onFace, type DoorMats, type LeafSpec } from "./interior-doors-leaf-parts";
import { jeweledTexture, stageTexture } from "./interior-doors-leaf-tex";

export function steel(p: Parts, M: DoorMats, s: LeafSpec) {
  const { w, h } = s, t = LEAF_T.steel, paint = s.front === "vestibulo" || s.back === "vestibulo" ? M.steelPaint : M.steelPaintLight;
  // chapa com o recorte do visor (montada em quatro partes) e o vidro aramado com baguetes dos dois lados
  const vx0 = w * 0.3, vx1 = w * 0.7, vy0 = 1.35, vy1 = 1.95;
  p.box(paint, 0, 0, -t / 2, w, vy0, t / 2); p.box(paint, 0, vy1, -t / 2, w, h, t / 2);
  p.box(paint, 0, vy0, -t / 2, vx0, vy1, t / 2); p.box(paint, vx1, vy0, -t / 2, w, vy1, t / 2);
  p.box(M.glassWire, vx0, vy0, -0.004, vx1, vy1, 0.004);
  for (const side of [1, -1]) p.add(paint, frame(vx1 - vx0 + 0.06, vy1 - vy0 + 0.06, 0.035, 0.012, 0.004), onFace(side, w / 2, (vy0 + vy1) / 2, t / 2));
  // bordas boleadas (a chapa dobrada) e as chapas de chute inox
  for (const x of [0.004, w - 0.004]) p.add(paint, CYLN(8), mat(x, h / 2, 0, 0, t / 2, h, t / 2));
  for (const side of [1, -1]) p.box(M.inox, 0.03, 0.0, side > 0 ? t / 2 : -t / 2 - 0.002, w - 0.03, 0.3, side > 0 ? t / 2 + 0.002 : -t / 2);
  // lado de empurrar: barra antipânico (caixas nas pontas e a barra); lado de puxar: alavanca com espelho
  const ps = -s.pull, z = ps * (t / 2);
  p.box(M.inox, 0.12, 0.92, Math.min(z, z + ps * 0.07), 0.24, 1.08, Math.max(z, z + ps * 0.07));
  p.box(M.inox, w - 0.2, 0.9, Math.min(z, z + ps * 0.075), w - 0.04, 1.1, Math.max(z, z + ps * 0.075));
  p.add(M.inox, CYLN(14), mat((0.24 + w - 0.2) / 2, 1.0, z + ps * 0.055, 0, 0.022, w - 0.44, 0.022, 0, Math.PI / 2));
  p.box(M.rubber, (0.24 + w - 0.2) / 2 - 0.1, 0.985, Math.min(z + ps * 0.075, z + ps * 0.08), (0.24 + w - 0.2) / 2 + 0.1, 1.015, Math.max(z + ps * 0.075, z + ps * 0.08));
  const zp = s.pull * (t / 2);
  p.box(M.inox, w - 0.12, 0.95, Math.min(zp, zp + s.pull * 0.008), w - 0.06, 1.15, Math.max(zp, zp + s.pull * 0.008));
  p.add(M.inox, CYLN(10), mat(w - 0.09, 1.05, zp + s.pull * 0.035, 0, 0.012, 0.06, 0.012, Math.PI / 2));
  p.add(M.inox, CYLN(10), mat(w - 0.15, 1.05, zp + s.pull * 0.065, 0, 0.011, 0.13, 0.011, 0, Math.PI / 2));
  hinges(p, M.inox, h, t, s.pull, 3, 0.012);
  if (s.closer) closerBody(p, M.steelPaintLight, h, t, -s.pull);
}

export function stage(p: Parts, M: DoorMats, s: LeafSpec) {
  const { w, h } = s, t = LEAF_T.stage, tex = stageTexture(s.stencil ?? "PALCO");
  const black = solid(`vestibulo-door-stage-${s.stencil}`, "#ffffff", { rough: 0.72 }); (black as THREE.MeshStandardMaterial).map = tex;
  // chapa com o furo do visor redondo; uv = (x/w, y/h) na frente e espelhado no verso, para o estêncil caber na folha e
  // ler direito dos dois lados (e nas duas folhas de um vão duplo, que são uma o espelho da outra)
  const slab = geo(`vestibulo-door-stageSlab2-${w.toFixed(3)}-${h.toFixed(3)}`, () => {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(w, 0); sh.lineTo(w, h); sh.lineTo(0, h); sh.closePath();
    const hole = new THREE.Path(); hole.absarc(w / 2, 1.62, 0.15, 0, Math.PI * 2, true); sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 24 }); g.translate(0, 0, -t / 2);
    const pos = g.getAttribute("position") as THREE.BufferAttribute, uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) { const u = pos.getX(i) / w; uv.setXY(i, pos.getZ(i) < 0 ? 1 - u : u, pos.getY(i) / h); }
    return g;
  });
  p.add(black, slab);
  for (const side of [1, -1]) p.add(M.rubber, geo("vestibulo-door-portRing", () => new THREE.TorusGeometry(0.155, 0.018, 8, 28)), onFace(side, w / 2, 1.62, t / 2));
  p.add(M.glassWire, geo("vestibulo-door-portGlass", () => new THREE.CircleGeometry(0.15, 28)), mat(w / 2, 1.62, 0));
  const ps = -s.pull, zps = ps * (t / 2), zp = s.pull * (t / 2);
  p.box(M.alu, w - 0.2, 1.05, Math.min(zps, zps + ps * 0.003), w - 0.05, 1.45, Math.max(zps, zps + ps * 0.003));
  p.add(M.alu, CYLN(12), mat(w - 0.1, 1.15, zp + s.pull * 0.05, 0, 0.014, 0.35, 0.014));
  for (const y of [1.0, 1.3]) p.add(M.alu, CYLN(8), mat(w - 0.1, y, zp + s.pull * 0.025, 0, 0.009, 0.05, 0.009, Math.PI / 2));
  for (const side of [1, -1]) p.box(M.alu, 0.03, 0, side > 0 ? t / 2 : -t / 2 - 0.002, w - 0.03, 0.25, side > 0 ? t / 2 + 0.002 : -t / 2);
  hinges(p, M.alu, h, t, s.pull, 3, 0.012);
  if (s.closer) closerBody(p, M.blackDoor, h, t, -s.pull);
}

export function jib(p: Parts, M: DoorMats, s: LeafSpec) {
  const { w, h } = s, t = LEAF_T.jib, salaoSide = s.front === "salao" ? 1 : -1;
  p.box(M.steelPaintLight, 0, 0, -t / 2, w, h, t / 2);
  // do lado do salão: a mesma cantaria da parede (uv no referencial da parede: u = posição/2,4 m, v = altura/1,2 m, as
  // juntas continuam as da parede) e o rodapé de mármore negro da casca; nenhuma ferragem à vista além da fechadura
  const face = new THREE.PlaneGeometry(w - 0.004, h - 0.18, 1, 1);
  if (salaoSide < 0) face.rotateY(Math.PI);                                       // virada para o verso (−z)
  face.translate(w / 2, 0.18 + (h - 0.18) / 2, salaoSide * (t / 2 + 0.002));
  const fp = face.getAttribute("position") as THREE.BufferAttribute, fu = face.getAttribute("uv") as THREE.BufferAttribute, U = s.wallUv ?? { origin: 0, dir: 1 };
  for (let i = 0; i < fp.count; i++) fu.setXY(i, (U.origin + U.dir * fp.getX(i)) / 2.4, fp.getY(i) / 1.2);
  p.add(M.limestone, face);
  { const z0 = salaoSide * (t / 2), z1 = salaoSide * (t / 2 + 0.022); p.box(M.marbleDark, 0, 0, Math.min(z0, z1), w, 0.18, Math.max(z0, z1)); }
  // do lado do serviço: barra de empurrar e chapa de chute
  const ss = -salaoSide, zs = ss * (t / 2);
  p.add(M.inox, CYLN(12), mat(w / 2, 1.0, zs + ss * 0.06, 0, 0.02, w - 0.3, 0.02, 0, Math.PI / 2));
  for (const x of [0.15, w - 0.15]) p.box(M.inox, x - 0.03, 0.96, Math.min(zs, zs + ss * 0.07), x + 0.03, 1.04, Math.max(zs, zs + ss * 0.07));
  p.box(M.inox, 0.03, 0, Math.min(zs, zs + ss * 0.002), w - 0.03, 0.28, Math.max(zs, zs + ss * 0.002));
  hinges(p, M.inox, h, t, ss, 2, 0.01);
}
export function vault(p: Parts, M: DoorMats, s: LeafSpec) {
  const { w, h } = s, t = LEAF_T.vault, out = s.front === "galeria" ? 1 : -1;
  const jewel = solid("vestibulo-door-vaultJewel", "#ffffff", { metal: 0.95, rough: 0.28, env: 1.2 }); (jewel as THREE.MeshStandardMaterial).map = jeweledTexture();
  p.box(M.vaultSteel, 0, 0, -t / 2, w, h, t / 2);
  // face de fora: quadro em dois degraus, painel guilhochê, volante, disco do segredo e placa
  p.add(M.vaultDark, frame(w - 0.08, h - 0.08, 0.12, 0.03, 0.01), onFace(out, w / 2, h / 2, t / 2));
  p.add(M.vaultSteel, frame(w - 0.32, h - 0.32, 0.06, 0.05, 0.012), onFace(out, w / 2, h / 2, t / 2));
  p.box(jewel, 0.22, 0.22, out > 0 ? t / 2 : -t / 2 - 0.01, w - 0.22, h - 0.22, out > 0 ? t / 2 + 0.01 : -t / 2);
  const cx = w * 0.5, cy = h * 0.47, zw = out * (t / 2 + 0.11);
  p.add(M.chrome, geo("vestibulo-door-wheel", () => new THREE.TorusGeometry(0.3, 0.03, 10, 36)), mat(cx, cy, zw, out > 0 ? 0 : Math.PI));
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; p.add(M.chrome, CYLN(10), mat(cx + Math.cos(a) * 0.15, cy + Math.sin(a) * 0.15, zw, 0, 0.018, 0.3, 0.018, 0, a - Math.PI / 2)); p.add(M.chrome, geo("vestibulo-door-knob", () => new THREE.SphereGeometry(0.04, 12, 8)), mat(cx + Math.cos(a) * 0.36, cy + Math.sin(a) * 0.36, zw)); }
  p.add(M.chrome, CYLN(20), mat(cx, cy, out * (t / 2 + 0.06), 0, 0.07, 0.12, 0.07, Math.PI / 2));
  p.add(M.vaultDark, CYLN(32), mat(cx, cy + 0.62, out * (t / 2 + 0.03), 0, 0.12, 0.06, 0.12, Math.PI / 2));
  p.add(M.chrome, CYLN(32), mat(cx, cy + 0.62, out * (t / 2 + 0.065), 0, 0.09, 0.02, 0.09, Math.PI / 2));
  p.box(M.brass, cx - 0.22, h - 0.42, out > 0 ? t / 2 + 0.01 : -t / 2 - 0.016, cx + 0.22, h - 0.3, out > 0 ? t / 2 + 0.016 : -t / 2 - 0.01);
  // seis trancas cromadas saindo da borda e as duas dobradiças cilíndricas
  for (let k = 0; k < 6; k++) p.add(M.chrome, CYLN(14), mat(w + 0.04, 0.35 + k * (h - 0.7) / 5, 0, 0, 0.045, 0.16, 0.045, 0, Math.PI / 2));
  for (const y of [0.55, h - 0.55]) { p.add(M.vaultDark, CYLN(20), mat(-0.02, y, out * (t / 2 - 0.02), 0, 0.075, 0.42, 0.075)); p.add(M.chrome, CYLN(20), mat(-0.02, y + 0.23, out * (t / 2 - 0.02), 0, 0.06, 0.04, 0.06)); }
  // face de dentro: o mecanismo das trancas atrás do vidro (barras, engrenagem central)
  const zi = -out * (t / 2 + 0.03);
  p.box(M.vaultDark, 0.2, 0.25, Math.min(zi, -out * t / 2), w - 0.12, h - 0.25, Math.max(zi, -out * t / 2));
  for (let k = 0; k < 6; k++) p.box(M.chrome, w * 0.45, 0.35 + k * (h - 0.7) / 5 - 0.03, Math.min(zi, zi - out * 0.03), w - 0.06, 0.35 + k * (h - 0.7) / 5 + 0.03, Math.max(zi, zi - out * 0.03));
  p.add(M.brass, geo("vestibulo-door-gear", () => { const sh = new THREE.Shape(); for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2, r = i % 4 < 2 ? 0.2 : 0.17; if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false }); }), onFace(-out, w * 0.42, h / 2, t / 2 + 0.03));
  p.box(M.glassClear, 0.24, 0.3, Math.min(zi - out * 0.06, zi - out * 0.065), w - 0.16, h - 0.3, Math.max(zi - out * 0.06, zi - out * 0.065));
}
