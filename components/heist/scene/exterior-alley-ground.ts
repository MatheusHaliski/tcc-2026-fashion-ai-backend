/*
 * MET Gala Heist v2 — beco (Z15): o chão do beco. Asfalto velho dos dois lados da canaleta central de concreto (perfil em
 * V, com quatro grelhas de ferro sobre a caixa de captação), a tampa do bueiro de onde sai o vapor, remendos de asfalto
 * novo (a vala de serviço junto ao museu e o quadrado em volta do bueiro), poças rasas com película de óleo onde a água
 * para (nas grelhas, nas bicas dos canos, sob o carro, perto da caçamba), a faixa de sujeira do pé das paredes, lixo
 * espalhado (panfletos, jornal, papelão, embalagens, folhas, chiclete, manchas), bitucas (concentradas onde a cozinha
 * vizinha fuma e na boca do beco), mato nas frestas e algumas latas e garrafas em 3D.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { Bag, box, quadFloor, tm } from "./exterior-alley-geo";
import { rng, type Rect01 } from "./exterior-alley-tex";
import { Y0 } from "./exterior-alley-props";
import { WALL_G, Z_END, Z_MOUTH } from "./exterior-alley-facade";

export const ALLEY_X0 = 22.5, GUTTER = { x0: 26.0, x1: 26.5, depth: 0.035 };
/** Grelhas da canaleta (centro em z) e o bueiro do vapor. */
export const GRATES = [18.6, 4.2, -8.6, -19.4], MANHOLE = new THREE.Vector3(25.2, Y0, 1.5);

export interface GroundOut { butts: THREE.Matrix4[]; weeds: THREE.Matrix4[] }

/** Quad deitado (normal +y) pelos quatro cantos (x, z) e os UV de cada canto; acerta o sentido para a face ficar para cima. */
function upQuad(c: [number, number][], uvs: [number, number][], y: number): THREE.BufferGeometry {
  const ax = c[1][0] - c[0][0], az = c[1][1] - c[0][1], bx = c[2][0] - c[0][0], bz = c[2][1] - c[0][1];
  const order = az * bx - ax * bz > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(order.flatMap((i) => [c[i][0], y, c[i][1]]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(order.flatMap(() => [0, 1, 0]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(order.flatMap((i) => uvs[i]), 2));
  return g;
}

export function alleyGround(bag: Bag, props: Prop[], gd: Record<string, Rect01>, pd: Record<string, Rect01>, high: boolean): GroundOut {
  const r = rng(515);
  const uv = (c: Rect01): [number, number, number, number] => [c.u0, c.v0, c.u1, c.v1];
  // onde há móvel (e o carro): nada de lixo solto por baixo
  const blocked = props.filter((p) => p.room === "beco").map((p) => p.shape.type === "box" ? { x0: p.shape.x0 - 0.05, z0: p.shape.z0 - 0.05, x1: p.shape.x1 + 0.05, z1: p.shape.z1 + 0.05 } : { x0: p.shape.x - p.shape.r, z0: p.shape.z - p.shape.r, x1: p.shape.x + p.shape.r, z1: p.shape.z + p.shape.r });
  const free = (x: number, z: number) => !blocked.some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);

  /* ---------- asfalto e canaleta ---------- */
  bag.add("asphalt", box(ALLEY_X0, Y0 - 0.3, Z_END, GUTTER.x0, Y0, Z_MOUTH), { worldUv: true });
  bag.add("asphalt", box(GUTTER.x1, Y0 - 0.3, Z_END, 30, Y0, Z_MOUTH), { worldUv: true });
  const mid = (GUTTER.x0 + GUTTER.x1) / 2, gz: [number, number][] = [];
  let z = Z_END; for (const g of [...GRATES].sort((a, b) => a - b)) { gz.push([z, g - 0.45]); z = g + 0.45; } gz.push([z, Z_MOUTH]);
  for (const [a, b] of gz) for (const [xa, xb] of [[GUTTER.x0, mid], [mid, GUTTER.x1]] as [number, number][]) {
    const ya = xa === GUTTER.x0 ? Y0 : Y0 - GUTTER.depth, yb = xb === GUTTER.x1 ? Y0 : Y0 - GUTTER.depth, g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([xa, ya, b, xb, yb, b, xb, yb, a, xa, ya, b, xb, yb, a, xa, ya, a], 3)); g.computeVertexNormals();
    bag.add("concrete", g, { worldUv: true });
  }
  bag.add("concrete", box(GUTTER.x0, Y0 - 0.3, Z_END, GUTTER.x1, Y0 - GUTTER.depth - 0.02, Z_MOUTH), { worldUv: true });   // fundo (sob as grelhas)
  // grelhas: caixa escura, quadro de cantoneira e barras de ferro fundido
  for (const g of GRATES) {
    bag.add("rubber", box(GUTTER.x0 + 0.02, Y0 - 0.4, g - 0.43, GUTTER.x1 - 0.02, Y0 - 0.05, g + 0.43));
    for (const [x0, x1, z0, z1] of [[GUTTER.x0, GUTTER.x1, g - 0.47, g - 0.43], [GUTTER.x0, GUTTER.x1, g + 0.43, g + 0.47], [GUTTER.x0 - 0.02, GUTTER.x0 + 0.03, g - 0.47, g + 0.47], [GUTTER.x1 - 0.03, GUTTER.x1 + 0.02, g - 0.47, g + 0.47]]) bag.add("iron", box(x0, Y0 - 0.03, z0, x1, Y0 + 0.004, z1));
    for (let k = 0; k < 9; k++) { const zz = g - 0.4 + k * 0.1; bag.add("iron", box(GUTTER.x0 + 0.03, Y0 - 0.04, zz - 0.012, GUTTER.x1 - 0.03, Y0 + 0.002, zz + 0.012)); }
    bag.add("iron", box(mid - 0.012, Y0 - 0.04, g - 0.43, mid + 0.012, Y0 + 0.001, g + 0.43));
  }
  // tampa do bueiro (de onde sai o vapor) com o aro e o quadrado de remendo em volta
  bag.add("manhole", new THREE.CircleGeometry(0.33, 28).rotateX(-Math.PI / 2), { m: tm(MANHOLE.x, Y0 + 0.007, MANHOLE.z) });
  bag.add("iron", new THREE.TorusGeometry(0.345, 0.018, 4, 32).rotateX(Math.PI / 2), { m: tm(MANHOLE.x, Y0 + 0.004, MANHOLE.z, 0, 1, 0.4, 1) });
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; bag.add("iron", box(-0.012, 0, -0.04, 0.012, 0.006, 0.04), { m: tm(MANHOLE.x + Math.cos(a) * 0.3, Y0 + 0.007, MANHOLE.z + Math.sin(a) * 0.3, -a) }); }

  // caixa de gordura do restaurante (tampa de concreto com alças, junto da porta da cozinha) e a tampa do hidrômetro
  bag.add("concrete", box(28.95, Y0 - 0.02, 16.6, 29.55, Y0 + 0.018, 17.2), { worldUv: true });
  for (const z of [16.75, 17.05]) bag.add("iron", box(29.2, Y0 + 0.018, z - 0.008, 29.3, Y0 + 0.03, z + 0.008));
  bag.add("iron", box(28.2, Y0, 24.0, 28.6, Y0 + 0.012, 24.35));

  /* ---------- remendos ---------- */
  for (const [x, zc, w, d] of [[23.9, 11, 0.6, 9.5], [MANHOLE.x, MANHOLE.z, 1.3, 1.3], [27.4, -8.2, 1.7, 1.2], [24.6, -16.2, 1.0, 1.5], [25.1, 21.6, 2.0, 1.4], [28.3, 3.6, 0.9, 2.6], [23.4, -4.8, 1.2, 0.9]] as [number, number, number, number][]) {
    bag.add("patch", quadFloor(x, Y0 + 0.0025, zc, w, d, 0, [x - w / 2, -zc - d / 2, x + w / 2, -zc + d / 2]));
  }

  /* ---------- poças (onde a água para) ---------- */
  for (const [x, zc, w, d, cell, ry] of [
    [mid, GRATES[0] - 0.2, 1.7, 1.1, "p1", 0.1], [mid - 0.2, GRATES[2] - 0.1, 2.3, 1.3, "p0", -0.2], [mid + 0.1, GRATES[3], 2.6, 1.5, "p2", 0.4], [mid - 0.3, GRATES[1] + 0.5, 1.4, 1.0, "p3", 0],
    [28.0, -0.9, 1.3, 0.9, "p3", 0.3], [29.2, 7.0, 1.3, 0.8, "p0", 1.2], [29.15, 0.5, 1.2, 0.8, "p2", 1.4], [27.1, 9.4, 1.1, 0.75, "p1", 0.5], [24.6, 12.4, 2.6, 1.5, "p0", 0.7], [25.0, -20.6, 2.4, 1.3, "p2", 0.2], [24.2, 23.2, 1.5, 1.0, "p3", -0.5],
  ] as [number, number, number, number, string, number][]) bag.add("puddle", quadFloor(x, Y0 + 0.004, zc, w, d, ry, uv(pd[cell])));

  /* ---------- sujeira e lixo (decalques) ---------- */
  // faixa de sujeira no pé das duas paredes (trechos de 3 m, alternando o sentido do desenho)
  const grime = gd.grime;
  for (let zz = Z_END; zz < Z_MOUTH - 0.05; zz += 3) {
    const len = Math.min(3, Z_MOUTH - zz), flip = Math.round((zz - Z_END) / 3) % 2 === 1;
    const ua = flip ? grime.u1 : grime.u0, ub = ua + (flip ? -1 : 1) * (grime.u1 - grime.u0) * (len / 3);
    // u da célula corre ao longo da parede; v vai do pé da parede (escuro, v0) para fora (some, v1)
    const strip = (xWall: number, xOut: number) => bag.add("groundDecal", upQuad([[xWall, zz], [xWall, zz + len], [xOut, zz + len], [xOut, zz]], [[ua, grime.v0], [ub, grime.v0], [ub, grime.v1], [ua, grime.v1]], Y0 + 0.003));
    strip(ALLEY_X0 + 0.1, ALLEY_X0 + 0.1 + 0.55 + r() * 0.35);
    strip(WALL_G - 0.03, WALL_G - 0.03 - 0.5 - r() * 0.4);
  }
  // lixo espalhado: mais perto das paredes, da caçamba e da boca do beco; nada no meio do caminho do carro
  const scatter = (cells: string[], n: number, area: () => [number, number], size: [number, number]) => {
    for (let k = 0; k < n; k++) {
      const [x, zz] = area(); if (!free(x, zz)) continue;
      const c = gd[cells[k % cells.length]], s = size[0] + r() * (size[1] - size[0]), asp = (c.u1 - c.u0) / (c.v1 - c.v0) * 0.5;
      bag.add("groundDecal", quadFloor(x, Y0 + 0.0035 + k * 0.00001, zz, s * Math.min(1.6, asp), s, r() * Math.PI * 2, uv(c)));
    }
  };
  const nearWall = (): [number, number] => { const east = r() < 0.6; return [east ? 28.6 + r() * 1.1 : 22.75 + r() * 0.9, Z_END + 0.6 + r() * (Z_MOUTH - Z_END - 1.2)]; };
  const anywhere = (): [number, number] => [22.8 + r() * 6.9, Z_END + 0.6 + r() * (Z_MOUTH - Z_END - 1.2)];
  const mouth = (): [number, number] => [23 + r() * 6.5, 20.5 + r() * 3.8];
  scatter(["flyer0", "flyer1", "flyer2", "flyer3"], high ? 18 : 12, () => (r() < 0.4 ? mouth() : nearWall()), [0.2, 0.26]);
  scatter(["newspaper", "cardboard"], 5, nearWall, [0.4, 0.55]);
  scatter(["oil0", "oil1"], 7, anywhere, [0.6, 1.2]);
  scatter(["leaves"], high ? 14 : 9, nearWall, [0.35, 0.5]);
  scatter(["gum"], 8, () => (r() < 0.5 ? mouth() : anywhere()), [0.4, 0.6]);
  scatter(["wrapper", "cup"], 7, nearWall, [0.14, 0.2]);
  scatter(["steps"], 3, anywhere, [0.6, 0.8]);
  // manchas molhadas nas bicas dos canos e marcas de pneu na entrada do beco e junto ao carro
  for (const zz of [7.0, 0.5]) bag.add("groundDecal", quadFloor(29.35, Y0 + 0.0032, zz, 1.0, 0.8, 0.2, uv(gd.wetStain)));
  for (const [x, zz, ry, s] of [[25.4, 22.8, 0.3, 1.6], [26.8, 19.6, -0.1, 1.4], [27.5, 12.4, 0.05, 1.3], [27.6, 4.6, 3.1, 1.3]] as [number, number, number, number][]) bag.add("groundDecal", quadFloor(x, Y0 + 0.0031, zz, s, s, ry, uv(gd.tire)));

  /* ---------- bitucas (onde se fuma: porta da cozinha e boca do beco) ---------- */
  const butts: THREE.Matrix4[] = [];
  const drop = (cx: number, cz: number, rad: number, n: number) => {
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad, x = cx + Math.cos(a) * d, zz = cz + Math.sin(a) * d;
      if (x < ALLEY_X0 + 0.05 || x > WALL_G - 0.03 || !free(x, zz)) continue;
      const bent = r() < 0.4, len = 0.025 + r() * 0.02;
      butts.push(tm(x, Y0 + 0.004, zz, r() * Math.PI * 2, 1, 1, len / 0.05, Math.PI / 2 + (bent ? 0.25 : 0)));
    }
  };
  drop(29.15, 18.5, 1.1, high ? 70 : 40); drop(26.5, 23.2, 2.4, high ? 34 : 20); drop(23.4, -13.6, 1.0, 12); drop(28.9, -5.1, 0.9, 14);
  for (let k = 0; k < (high ? 40 : 20); k++) { const [x, zz] = anywhere(); drop(x, zz, 0.05, 1); }

  /* ---------- mato das frestas (pé das paredes e em volta das grelhas) ---------- */
  const weeds: THREE.Matrix4[] = [];
  const tuft = (x: number, zz: number, s: number) => { if (!free(x, zz)) return; const ry = r() * Math.PI; weeds.push(tm(x, Y0, zz, ry, s, s * (0.8 + r() * 0.5), s)); weeds.push(tm(x, Y0, zz, ry + Math.PI / 2, s, s * (0.8 + r() * 0.5), s)); };
  for (let k = 0; k < (high ? 46 : 26); k++) { const east = r() < 0.55; tuft(east ? WALL_G - 0.06 - r() * 0.12 : ALLEY_X0 + 0.14 + r() * 0.1, Z_END + 0.5 + r() * (Z_MOUTH - Z_END - 1), 0.16 + r() * 0.2); }
  for (const g of GRATES) for (let k = 0; k < 3; k++) tuft(GUTTER.x0 - 0.06 + r() * 0.62, g + (r() - 0.5) * 1.1, 0.1 + r() * 0.12);

  /* ---------- latas e garrafas (3D) ---------- */
  const can = new THREE.CylinderGeometry(0.033, 0.033, 0.06, 12).scale(1, 1, 0.55), bottle = new THREE.LatheGeometry([[0, 0], [0.035, 0], [0.036, 0.16], [0.016, 0.22], [0.012, 0.27], [0, 0.27]].map(([a, b]) => new THREE.Vector2(a, b)), 12);
  for (let k = 0; k < 7; k++) {
    const [x, zz] = nearWall(); if (!free(x, zz)) continue;
    if (k % 3 === 2) bag.add("glassSheen", bottle, { m: tm(x, Y0 + 0.035, zz, r() * 6, 1, 1, 1, Math.PI / 2) });
    else bag.add("paintGloss", can, { m: tm(x, Y0 + 0.018, zz, r() * 6, 1, 1, 1, Math.PI / 2), color: ["#b71c1c", "#c8ccd0", "#1e5aa8"][k % 3] });
  }
  return { butts, weeds };
}
