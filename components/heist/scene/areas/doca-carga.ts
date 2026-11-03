/*
 * MET Gala Heist v2 — doca (Z12): a carga — flight cases empilhados, paleteira com palete carregado, o
 * palete e a pilha de paletes vazios com cones. Saiu de doca-props.ts sem mudança.
 */
import * as THREE from "three";
import { BOX0, CYL0, SPH, geo } from "../interior-batch";
import type { PropsCtx } from "../interior-props";
import type { Rect } from "./doca-tex";
import { ROOM, type Foot, type DocaMats, tint, boxUV, L, bx, cy, decal, caster, rand } from "./doca-mats";

/** Dois flight cases empilhados (cada um 1,2 × 0,6 × 0,8 m + rodízios de 0,15 m). */
export function flightStack(c: PropsCtx, M: DocaMats, A: Record<string, Rect>, f: Foot) {
  const W = Math.min(1.2, f.w), D = Math.min(0.6, f.d);
  const one = (y: number, ry: number, label: string, gaffer: string, lift: number) => {
    const cw = 0.15, H = 0.8;
    // rodízios e a tábua dos rodízios
    bx(c, M.wood, f, 0, y + cw - 0.02, 0, W - 0.04, 0.02, D - 0.04, undefined, { ry });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) caster(c, M, f, sx * (W / 2 - 0.1), sz * (D / 2 - 0.09), cw - 0.02, ry, y);
    const y0 = y + cw;
    bx(c, M.laminate, f, 0, y0, 0, W - 0.01, H, D - 0.01, undefined, { ry, cast: true });
    // perfis de alumínio nas 12 arestas e o friso da tampa
    const e = 0.022;
    for (const yy of [y0, y0 + H - e]) { for (const sz of [-1, 1]) bx(c, M.alu, f, 0, yy, sz * (D / 2 - e / 2), W + 0.004, e, e, undefined, { ry }); for (const sx of [-1, 1]) bx(c, M.alu, f, sx * (W / 2 - e / 2), yy, 0, e, e, D + 0.004, undefined, { ry }); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(c, M.alu, f, sx * (W / 2 - e / 2), y0, sz * (D / 2 - e / 2), e, H, e, undefined, { ry });
    bx(c, M.alu, f, 0, y0 + H * 0.74, 0, W + 0.008, 0.03, D + 0.008, undefined, { ry });
    // cantos de esfera (cromados), fechos borboleta na frente e atrás, alças embutidas nas laterais
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const yy of [y0 + 0.02, y0 + H - 0.02]) c.inst.add(ROOM, "doca-ball", SPH(10), M.chrome as THREE.Material, L(f, sx * (W / 2 - 0.004), yy, sz * (D / 2 - 0.004), ry, 0.032));
    for (const sz of [-1, 1]) for (const sx of [-0.32, 0.32]) { bx(c, M.chrome, f, sx, y0 + H * 0.74 - 0.05, sz * (D / 2 + 0.006), 0.08, 0.1, 0.012, undefined, { ry }); bx(c, M.chrome, f, sx, y0 + H * 0.74 - 0.01, sz * (D / 2 + 0.014), 0.05, 0.02, 0.012, undefined, { ry }); }
    for (const sx of [-1, 1]) { bx(c, M.chrome, f, sx * (W / 2 + 0.006), y0 + H * 0.45, 0, 0.012, 0.12, 0.2, undefined, { ry }); bx(c, M.paint, f, sx * (W / 2 + 0.016), y0 + H * 0.47, 0, 0.02, 0.03, 0.13, "#151515", { ry }); }
    // estêncil na frente e a fita gaffer com a etiqueta na tampa
    decal(c, M.signs, f, label, A[label], 0, y0 + H * 0.38, D / 2 + 0.003 + lift, W * 0.78, W * 0.78 / 4, ry);
    decal(c, M.signs, f, gaffer, A[gaffer], 0.25, y0 + H * 0.9, D / 2 + 0.004 + lift, 0.36, 0.09, ry);
  };
  one(0, 0, "caseLight", "gaffer0", 0);
  one(0.95, 0.04, "caseCostume", "gaffer1", 0);
}

/** Paleteira manual com palete carregado (fardos e caixas do bufê envoltos em filme), garfos ao longo de x local. */
export function palletJack(c: PropsCtx, M: DocaMats, A: Record<string, Rect>, f: Foot) {
  const x0 = -f.w / 2, pw = 1.2, pd = Math.min(1.0, f.d), red = "#c62f23";
  pallet(c, M, f, x0 + pw / 2, 0, pw, pd, "#c9ad84");
  // carga: duas camadas de fardos (garrafas de água) e caixas do bufê por cima, envolto em filme
  for (let ly = 0; ly < 2; ly++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const x = x0 + 0.22 + i * 0.38, z = -pd / 2 + 0.26 + j * 0.48, y = 0.144 + ly * 0.3;
    bx(c, M.plastic, f, x, y, z, 0.36, 0.28, 0.46, ly ? "#d8e6ee" : "#cfe0ea");
    for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) c.inst.add(ROOM, "doca-bottleCap", CYL0(8), M.plastic as THREE.Material, L(f, x - 0.12 + a * 0.12, y + 0.28, z - 0.17 + b * 0.115, 0, 0.018, 0.02, 0.018));
  }
  for (let i = 0; i < 2; i++) c.batch.add(ROOM, M.signs, boxUV("cateringBox", A.cateringBox), L(f, x0 + 0.35 + i * 0.55, 0.744, 0, (i - 0.5) * 0.06, 0.5, 0.26, 0.6));
  c.batch.add(ROOM, M.film, BOX0(), L(f, x0 + pw / 2, 0.15, 0, 0, pw - 0.02, 0.62, pd - 0.02));
  decal(c, M.signs, f, "gaffer3", A.gaffer3, x0 + 0.4, 0.62, pd / 2 - 0.005, 0.36, 0.09);
  // paleteira: garfos dentro do palete, rodinhas na ponta, corpo com a bomba hidráulica, rodas de direção e o timão
  for (const z of [-0.27, 0.27]) { bx(c, M.paint, f, x0 + 0.62, 0.012, z, 1.15, 0.07, 0.16, red); c.batch.add(ROOM, M.rubber, geo("doca-wheel", () => new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2)), L(f, x0 + 0.1, 0.035, z, Math.PI / 2, 0.035, 0.07, 0.035)); }
  const bxj = x0 + pw + 0.12;
  bx(c, M.paint, f, bxj, 0.03, 0, 0.22, 0.22, 0.56, red, { cast: true });
  cy(c, M.chrome, f, bxj, 0.25, 0, 0.045, 0.32);
  bx(c, M.paint, f, bxj, 0.56, 0, 0.12, 0.08, 0.14, red);
  for (const z of [-0.09, 0.09]) c.batch.add(ROOM, M.rubber, geo("doca-wheel", () => new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2)), L(f, bxj + 0.05, 0.09, z, Math.PI / 2, 0.09, 0.05, 0.09));
  // timão inclinado (para trás) com a alavanca
  const tilt = -0.42, hx = bxj + 0.02;
  for (const z of [-0.12, 0.12]) bx(c, M.paint, f, hx, 0.62, z, 0.03, 0.95, 0.03, "#1e1e1e", { rz: tilt });
  bx(c, M.paint, f, hx + Math.sin(-tilt) * 0.95, 0.62 + Math.cos(tilt) * 0.95, 0, 0.035, 0.035, 0.3, "#1e1e1e");
  bx(c, M.chrome, f, hx + Math.sin(-tilt) * 0.85, 0.62 + Math.cos(tilt) * 0.85, 0, 0.012, 0.012, 0.16, undefined, { rz: tilt - 0.5 });
}
/** Palete PBR (1,2 × 1,0 × 0,144 m) no chão, centro (cx, cz) local. */
function pallet(c: PropsCtx, M: DocaMats, f: Foot, cx: number, cz: number, w: number, d: number, tone: string, y = 0) {
  const r = rand(Math.round(cx * 100) + Math.round(y * 1000) + 7), t = (k: number) => new THREE.Color(tone).multiplyScalar(0.85 + 0.25 * ((k * 0.618) % 1) + (r() - 0.5) * 0.06);
  for (const dz of [-d / 2 + 0.05, 0, d / 2 - 0.05]) bx(c, M.matte, f, cx, y, cz + dz, w, 0.022, 0.1, t(1));
  for (const dz of [-d / 2 + 0.05, 0, d / 2 - 0.05]) for (const dx of [-w / 2 + 0.05, 0, w / 2 - 0.05]) bx(c, M.matte, f, cx + dx, y + 0.022, cz + dz, 0.1, 0.078, 0.1, t(2));
  for (const dx of [-w / 2 + 0.05, 0, w / 2 - 0.05]) bx(c, M.matte, f, cx + dx, y + 0.1, cz, 0.1, 0.022, d, t(3));
  for (let k = 0; k < 7; k++) bx(c, M.matte, f, cx, y + 0.122, cz - d / 2 + 0.05 + k * ((d - 0.1) / 6), w, 0.022, k === 0 || k === 6 ? 0.1 : 0.085, t(k + 4));
}

/** Pilha de paletes vazios (7 × 0,144 m) com três cones de sinalização empilhados em cima. */
export function palletStack(c: PropsCtx, M: DocaMats, f: Foot) {
  const w = Math.min(1.2, f.w), d = Math.min(1.0, f.d), tones = ["#c9ab7e", "#b5a084", "#d2b48a", "#a69886", "#c4a57a", "#b8a689", "#cdb088"];   // pinho de palete, uns acinzentados pelo uso
  for (let k = 0; k < 7; k++) pallet(c, M, f, (k % 2 ? 0.015 : -0.01), 0, w - (k % 3) * 0.01, d, tones[k], k * 0.144);
  const top = 7 * 0.144;
  for (let k = 0; k < 3; k++) {
    const y = top + k * 0.09;
    c.batch.add(ROOM, M.plastic, tint(geo("doca-cone", () => new THREE.ConeGeometry(0.14, 0.62, 18, 1, true).translate(0, 0.31, 0)), "doca-cone", "#f25c19"), L(f, 0.2, y + 0.03, 0.1));
    c.batch.add(ROOM, M.plastic, tint(geo("doca-coneBase", () => new THREE.BoxGeometry(0.36, 0.03, 0.36).translate(0, 0.015, 0)), "doca-coneBase", "#1a1a1a"), L(f, 0.2, y, 0.1));
  }
  c.batch.add(ROOM, M.plastic, tint(geo("doca-coneBand", () => new THREE.CylinderGeometry(0.07, 0.095, 0.1, 18, 1, true).translate(0, 0.05, 0)), "doca-coneBand", "#f4f4f0"), L(f, 0.2, top + 0.18 + 0.33, 0.1));
}
