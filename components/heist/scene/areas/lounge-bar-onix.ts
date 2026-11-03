/*
 * MET Gala Heist v2 — lounge (Z05): o bar de ônix de Davi (balcão curvo, estação do barman e o que está
 * sobre ele) e as banquetas de bar. Saiu de lounge-mob.ts sem mudança.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import type { PropsCtx } from "../interior-props";
import { BOX0, CYL, CYL0, SPH, geo, mat, mul } from "../interior-batch";
import { glow, solid } from "../interior-mats";
import { rand } from "../interior-tex";
import { areaMat, at, footOf, lamp, lathe, tube, world } from "./lounge-kit";
import { menuTexture } from "./lounge-tex";
import { ROOM, loungeMats } from "./lounge-mats";
import { box, put, bottleAt, glassAt, votive } from "./lounge-copos";

/* ======================= bar de ônix (Davi) ======================= */
/** Contorno do bar em planta (x ao longo, z para a frente): cabeceiras em quarto de círculo; `back` é a borda de trás,
 *  `ins` recua (positivo) ou avança (negativo) a frente e as cabeceiras. */
function barShape(W: number, D: number, back: number, ins: number): THREE.Shape {
  const r = D / 2 - ins, cx = W / 2 - D / 2, s = new THREE.Shape();
  s.moveTo(-W / 2 + ins, back); s.lineTo(W / 2 - ins, back); s.lineTo(W / 2 - ins, 0);
  s.absarc(cx, 0, r, 0, Math.PI / 2, false); s.lineTo(-cx, r); s.absarc(-cx, 0, r, Math.PI / 2, Math.PI, false); s.lineTo(-W / 2 + ins, back);
  return s;
}
/** Laje com o contorno do bar entre y0 e y1. */
const slab = (key: string, s: THREE.Shape, h: number, bevel = 0) => geo(key, () => new THREE.ExtrudeGeometry(s, { depth: h - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 18 }).rotateX(Math.PI / 2).translate(0, h - bevel, 0));
/** Caminho da frente do bar afastado `off` da face (pontos, normais para fora e comprimento acumulado): lateral norte,
 *  cabeceira curva, frente reta, cabeceira curva, lateral sul. */
function frontPath(W: number, D: number, off: number, back: number): { p: THREE.Vector2[]; n: THREE.Vector2[]; s: number[] } {
  const r = D / 2 + off, cx = W / 2 - D / 2, p: THREE.Vector2[] = [], n: THREE.Vector2[] = [];
  const push = (x: number, z: number, nx: number, nz: number) => { p.push(new THREE.Vector2(x, z)); n.push(new THREE.Vector2(nx, nz)); };
  push(W / 2 + off, back, 1, 0);
  for (let k = 0; k <= 10; k++) { const a = (k / 10) * Math.PI / 2; push(cx + Math.cos(a) * r, Math.sin(a) * r, Math.cos(a), Math.sin(a)); }
  for (let k = 0; k <= 10; k++) { const a = Math.PI / 2 + (k / 10) * Math.PI / 2; push(-cx + Math.cos(a) * r, Math.sin(a) * r, Math.cos(a), Math.sin(a)); }
  push(-W / 2 - off, back, -1, 0);
  const s = [0]; for (let k = 1; k < p.length; k++) s.push(s[k - 1] + p[k].distanceTo(p[k - 1]));
  return { p, n, s };
}
/** Fita vertical ao longo do caminho, de y0 a y1 (normais para fora; uv = comprimento / escala, altura / escala). */
function ribbon(key: string, path: ReturnType<typeof frontPath>, y0: number, y1: number, uvScale: number): THREE.BufferGeometry {
  return geo(key, () => {
    const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
    path.p.forEach((pt, k) => {
      for (const y of [y0, y1]) { pos.push(pt.x, y, pt.y); nor.push(path.n[k].x, 0, path.n[k].y); uv.push(path.s[k] / uvScale, y / uvScale); }
      if (k) { const b = (k - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    return g;
  });
}
/** Ponto e normal do caminho a um comprimento `s`. */
export function along(path: ReturnType<typeof frontPath>, s: number): { x: number; z: number; ry: number } {
  let k = 1; while (k < path.s.length - 1 && path.s[k] < s) k++;
  const t = (s - path.s[k - 1]) / Math.max(1e-6, path.s[k] - path.s[k - 1]), p = path.p[k - 1].clone().lerp(path.p[k], t), n = path.n[k - 1].clone().lerp(path.n[k], t).normalize();
  return { x: p.x, z: p.y, ry: Math.atan2(n.x, n.y) };
}

export function onyxBar(p: Prop, c: PropsCtx) {
  const f = footOf(p), P = c.P, L = loungeMats(c.q, P), W = f.w, D = f.d, H = 1.1, back = -D / 2;
  // corpo de nogueira, rodapé de mármore negro recuado, faixa alta da frente (o "die") e o tampo com sobra de 6 cm
  put(c, L.marble, slab("lounge-barPlinth", barShape(W, D, back + 0.05, 0.07), 0.1), at(f, 0, 0, 0));
  put(c, L.walnut, slab("lounge-barBody", barShape(W, D, back, 0.012), 0.8), at(f, 0, 0.1, 0), true);
  put(c, L.walnut, slab("lounge-barDie", barShape(W, D, -0.16, 0.012), 0.15), at(f, 0, 0.9, 0), true);
  put(c, L.marble, slab("lounge-barTop", barShape(W, D, -0.2, -0.06), 0.05, 0.012), at(f, 0, 1.05, 0), true);
  // frente de ônix iluminada por dentro, com filetes de latão em cima e embaixo e pilastras caneladas a cada ~1 m
  const face = frontPath(W, D, 0.004, back + 0.06);
  put(c, L.onyxGlow, ribbon("lounge-barOnyx", face, 0.13, 0.98, 1.3), at(f, 0, 0, 0));
  const trim = frontPath(W, D, 0.012, back + 0.06);
  for (const [y0, y1] of [[0.1, 0.13], [0.98, 1.02]]) put(c, L.brass, ribbon(`lounge-barTrim${y0}`, trim, y0, y1, 1), at(f, 0, 0, 0));
  const total = face.s[face.s.length - 1];
  for (let s = 0.3; s < total - 0.2; s += total / 8) {
    const a = along(face, s);
    for (const dx of [-0.018, 0, 0.018]) c.inst.add(ROOM, "lounge-flute", CYL(8), L.brass, mul(at(f, a.x, 0.13, a.z, a.ry), mat(dx, 0.425, 0.012, 0, 0.008, 0.85, 0.008)));
    c.batch.add(ROOM, L.brass, BOX0(), mul(at(f, a.x, 0.13, a.z, a.ry), mat(0, 0.0, 0.006, 0, 0.07, 0.035, 0.02)));
    c.batch.add(ROOM, L.brass, BOX0(), mul(at(f, a.x, 0.93, a.z, a.ry), mat(0, 0.0, 0.006, 0, 0.07, 0.05, 0.02)));
  }
  // descanso de braço em couro (rolo) na borda do tampo e o trilho de pés de latão com mãos-francesas
  const pts = (off: number, y: number, k0: number, k1: number) => { const fp = frontPath(W, D, off, back + 0.08); return fp.p.slice(k0, fp.p.length - k1).map((v) => [v.x, y, v.y] as [number, number, number]); };
  put(c, L.leatherOx, tube("lounge-barArmrest", pts(0.07, 1.1, 1, 1), 0.045, 120, 10), at(f, 0, 0, 0));
  put(c, L.brass, tube("lounge-barFootrail", pts(0.2, 0.2, 1, 1), 0.024, 120, 10), at(f, 0, 0, 0));
  const rail = frontPath(W, D, 0.1, back + 0.08);
  for (let s = 0.6; s < rail.s[rail.s.length - 1] - 0.4; s += 0.9) { const a = along(rail, s); c.batch.add(ROOM, L.brass, CYL(10), mul(at(f, a.x, 0.2, a.z, a.ry), mat(0, 0, 0, 0, 0.014, 0.2, 0.014, Math.PI / 2))); }
  c.batch.add(ROOM, glow("lounge-barUnder", "#ffa94e", 1.6), ribbon("lounge-barUnderGlow", frontPath(W, D, -0.055, back + 0.1), 0.098, 0.104, 1), at(f, 0, 0, 0));
  // estação do barman (de costas para a parede): tampo de inox a 0,92 m, cuba de gelo, pia, trilho de garrafas, tábua
  box(c, L.steel, f, 0, 0.9, -0.39, W - 0.3, 0.022, 0.42);
  // cuba de gelo (borda de inox sobre o tampo, gelo amontoado) e a pia com a torneira em pescoço de ganso
  for (const [x, z, sx, sz] of [[-0.9, -0.22, 0.6, 0.02], [-0.9, -0.56, 0.6, 0.02], [-1.19, -0.39, 0.02, 0.34], [-0.61, -0.39, 0.02, 0.34]] as [number, number, number, number][]) box(c, L.steel, f, x, 0.922, z, sx, 0.05, sz);
  for (let k = 0; k < 60; k++) { const R = rand(900 + k); c.inst.add(ROOM, "lounge-iceCube", BOX0(), L.ice, at(f, -0.9 + (R() - 0.5) * 0.5, 0.924 + R() * 0.035, -0.39 + (R() - 0.5) * 0.28, R() * 3, 0.03, 0.03, 0.03)); }
  box(c, P.darkSteel, f, 0.7, 0.921, -0.39, 0.4, 0.004, 0.28);
  c.batch.add(ROOM, L.steel, lathe("lounge-faucet", [[0.012, 0], [0.012, 0.22], [0.01, 0.24], [0, 0.24]], 8), at(f, 0.7, 0.92, -0.55));
  c.batch.add(ROOM, L.steel, CYL(8), at(f, 0.7, 1.15, -0.5, 0, 0.01, 0.12, 0.01, Math.PI / 2));
  // trilho de garrafas nas costas do balcão (do lado do barman)
  box(c, L.steel, f, 0, 0.45, back - 0.05, W - 0.6, 0.02, 0.1);
  box(c, L.steel, f, 0, 0.55, back - 0.1, W - 0.6, 0.03, 0.01);
  for (let k = 0; k < 9; k++) { const x = -1.8 + k * 0.45; bottleAt(c, ROOM, L, at(f, x, 0.47, back - 0.05, Math.PI), [0, 3, 2, 0, 1, 3, 0, 2, 3][k] as 0 | 1 | 2 | 3, k + 3); }
  box(c, solid("lounge-board", "#a07a4a", { rough: 0.8 }), f, 1.4, 0.922, -0.4, 0.4, 0.02, 0.26);
  for (let k = 0; k < 4; k++) c.inst.add(ROOM, "lounge-limeHalf", geo("lounge-limeHalfGeo", () => new THREE.SphereGeometry(0.03, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), L.lime, at(f, 1.3 + k * 0.07, 0.942, -0.42 + (k % 2) * 0.06));
  for (let k = 0; k < 12; k++) glassAt(c, ROOM, L, at(f, -2.4 + (k % 6) * 0.09, 1.013, -0.5 + Math.floor(k / 6) * 0.09, 0, 1, 1, 1, Math.PI), 2, null);
  // sobre o tampo (y 1,1): a estação de Davi no meio, as taças dos convidados, o balde de champanhe, velas e cardápios
  const top = 1.1, front = D / 2 - 0.05;
  c.batch.add(ROOM, L.steel, lathe("lounge-tin", [[0, 0], [0.04, 0], [0.046, 0.18], [0.044, 0.185], [0, 0.185]], 16), at(f, 0.1, top, front - 0.25));
  c.batch.add(ROOM, L.glassClear, lathe("lounge-mixGlass", [[0, 0], [0.045, 0], [0.047, 0.14], [0.044, 0.14], [0.04, 0.01], [0, 0.01]], 16), at(f, -0.12, top, front - 0.28));
  c.inst.add(ROOM, "lounge-fillMix", CYL0(12), L.drinkAmber, at(f, -0.12, top + 0.012, front - 0.28, 0, 0.04, 0.07, 0.04));
  c.batch.add(ROOM, L.steel, CYL(6), at(f, -0.1, top + 0.13, front - 0.28, 0, 0.003, 0.3, 0.003, 0.18));
  c.batch.add(ROOM, L.steel, lathe("lounge-cobbler", [[0, 0], [0.04, 0], [0.043, 0.12], [0.03, 0.17], [0.012, 0.2], [0.014, 0.23], [0, 0.235]], 16), at(f, 0.32, top, front - 0.3));
  c.batch.add(ROOM, L.steel, lathe("lounge-jigger", [[0.022, 0], [0.012, 0.035], [0.022, 0.07], [0, 0.07]], 12), at(f, 0.22, top, front - 0.12));
  glassAt(c, ROOM, L, at(f, 0.0, top, front - 0.08), 0, L.drinkRose);
  glassAt(c, ROOM, L, at(f, -0.32, top, front - 0.1), 1, L.drinkGold);
  c.inst.add(ROOM, "lounge-olive", SPH(8), L.olive, at(f, -0.3, top + 0.15, front - 0.1, 0, 0.012, 0.009, 0.009));
  for (const [x, k] of [[-1.95, 0], [1.95, 2], [-1.6, 3], [2.2, 1]] as [number, 0 | 1 | 2 | 3][]) glassAt(c, ROOM, L, at(f, x, top, front - 0.1), k, k === 0 ? L.drinkRose : k === 1 ? L.drinkGold : L.drinkAmber);
  // balde de champanhe (latão martelado) com gelo e garrafa inclinada
  c.batch.add(ROOM, L.brass, lathe("lounge-bucket", [[0, 0], [0.09, 0], [0.1, 0.02], [0.115, 0.2], [0.125, 0.215], [0.11, 0.215], [0.1, 0.03], [0, 0.03]], 20), at(f, -2.55, top, -0.02));
  for (const s of [-1, 1]) c.batch.add(ROOM, L.brass, geo("lounge-bucketRing", () => new THREE.TorusGeometry(0.03, 0.006, 6, 12)), at(f, -2.55 + s * 0.12, top + 0.17, -0.02, Math.PI / 2));
  for (let k = 0; k < 14; k++) { const R = rand(700 + k); c.inst.add(ROOM, "lounge-iceCube", BOX0(), L.ice, at(f, -2.55 + (R() - 0.5) * 0.15, top + 0.17 + R() * 0.03, -0.02 + (R() - 0.5) * 0.15, R() * 3, 0.03, 0.03, 0.03)); }
  bottleAt(c, ROOM, L, at(f, -2.55, top + 0.05, -0.02, 0.3, 1, 1, 1, 0.32), 0, 12, new THREE.Color("#22311f"));
  for (const x of [-1.05, 0.95, 2.6]) votive(c, f, x, top, front - 0.18, L);
  // cardápios em tenda (papel dobrado) com a carta da casa
  const menu = areaMat("lounge-menuMat", () => new THREE.MeshStandardMaterial({ map: menuTexture("Bar Lumière"), roughness: 0.85, side: THREE.DoubleSide }));
  for (const x of [-1.35, 1.4]) for (const s of [-1, 1]) c.batch.add(ROOM, menu, geo("lounge-menuLeaf", () => new THREE.PlaneGeometry(0.1, 0.15).translate(0, 0.075, 0)), at(f, x, top, front - 0.2 + s * 0.035, s > 0 ? 0 : Math.PI, 1, 1, 1, -0.24));
  // tigela de castanhas, rosa num vaso fino e a campainha de balcão
  c.batch.add(ROOM, L.brass, lathe("lounge-bowl", [[0, 0], [0.03, 0], [0.07, 0.04], [0.075, 0.045], [0, 0.03]], 18), at(f, 0.62, top, front - 0.16));
  for (let k = 0; k < 12; k++) { const R = rand(800 + k); c.inst.add(ROOM, "lounge-nut", SPH(6), solid("lounge-nutMat", "#a9773e", { rough: 0.7 }), at(f, 0.62 + (R() - 0.5) * 0.08, top + 0.035 + R() * 0.01, front - 0.16 + (R() - 0.5) * 0.08, R() * 3, 0.014, 0.01, 0.01)); }
  c.batch.add(ROOM, L.glassClear, lathe("lounge-budVase", [[0, 0], [0.025, 0], [0.028, 0.03], [0.012, 0.12], [0.016, 0.2], [0, 0.2]], 12), at(f, 1.15, top, front - 0.3));
  c.batch.add(ROOM, L.leaf, CYL(5), at(f, 1.15, top + 0.25, front - 0.3, 0, 0.003, 0.22, 0.003));
  c.inst.add(ROOM, "lounge-roseBud", SPH(8), L.rose, at(f, 1.15, top + 0.37, front - 0.3, 0, 0.022, 0.03, 0.022));
  c.batch.add(ROOM, L.brass, lathe("lounge-bell", [[0, 0], [0.04, 0], [0.04, 0.006], [0.036, 0.03], [0.012, 0.05], [0.004, 0.065], [0, 0.07]], 16), at(f, 2.0, top, front - 0.32));
  // pendentes sobre o balcão (o teto é do lounge.ts; a luz do bar sai daqui)
  for (const x of [-2, 0, 2]) lamp(c.anchors, ROOM, world(f, x, 1.9, 0.1), "#ffb466", 6, 4.2);
  lamp(c.anchors, ROOM, world(f, 0, 0.6, D / 2 + 0.6), "#ff9a48", 2.4, 2.4);
}

/* ======================= banqueta de bar ======================= */
export function barStool(p: Prop, c: PropsCtx) {
  const f = footOf(p), L = loungeMats(c.q, c.P);
  c.batch.add(ROOM, L.brass, lathe("lounge-stoolBase", [[0, 0], [0.2, 0], [0.205, 0.008], [0.19, 0.022], [0.06, 0.04], [0.04, 0.05], [0, 0.05]], 28), at(f, 0, 0, 0), { cast: true });
  c.batch.add(ROOM, L.brass, lathe("lounge-stoolPost", [[0.03, 0], [0.03, 0.6], [0.045, 0.61], [0.05, 0.64], [0.12, 0.66], [0.13, 0.67], [0, 0.67]], 16), at(f, 0, 0.04, 0), { cast: true });
  c.batch.add(ROOM, L.brass, geo("lounge-stoolRing", () => new THREE.TorusGeometry(0.165, 0.012, 8, 32).rotateX(Math.PI / 2)), at(f, 0, 0.3, 0));
  for (let k = 0; k < 3; k++) c.batch.add(ROOM, L.brass, CYL(6), at(f, 0, 0.3, 0, (k / 3) * Math.PI * 2, 0.008, 0.165, 0.008, Math.PI / 2, 0));
  // assento estofado (couro boi-sangue) com vivo e encosto baixo em meia-lua
  c.batch.add(ROOM, L.leatherOx, lathe("lounge-stoolSeat", [[0, 0], [0.19, 0], [0.205, 0.02], [0.21, 0.05], [0.2, 0.075], [0.16, 0.09], [0, 0.092]], 28), at(f, 0, 0.67, 0), { cast: true });
  c.batch.add(ROOM, L.brass, geo("lounge-stoolPipe", () => new THREE.TorusGeometry(0.205, 0.006, 6, 32).rotateX(Math.PI / 2)), at(f, 0, 0.69, 0));
  c.batch.add(ROOM, L.leatherOx, geo("lounge-stoolBack", () => new THREE.TorusGeometry(0.19, 0.035, 10, 20, Math.PI).rotateX(Math.PI / 2).scale(1, 1.6, 1)), at(f, 0, 0.86, 0, Math.PI));
  for (const s of [-1, 1]) c.batch.add(ROOM, L.brass, CYL(6), at(f, s * 0.17, 0.76, -0.07, 0, 0.008, 0.12, 0.008));
}
