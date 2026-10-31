/*
 * MET Gala Heist v2 — Doca de carga (Z12, apoio e doca): o fundo de serviço do museu por onde chegam o bufê, a produção
 * do desfile e as obras. Concreto polido com juntas e faixas pintadas, bloco pintado com barrado e para-choques de
 * borracha, estrutura metálica aparente com telha de aço, eletrocalhas, sprinklers e luminárias industriais de LED, e a
 * porta de enrolar vista por dentro (guias, caixa do rolo, motor, corrente de manobra e a botoeira).
 *
 * O módulo da área (AREA, no fim) troca a casca (piso, parede e teto próprios: doca-tex.ts), desenha os móveis próprios
 * (doca-props.ts: estantes, bancada de conferência, guarita, flight cases, paleteira, empilhadeira patolada, carros
 * térmicos, bebedouro, paletes) e a caixa de obra (a `crate` que ficou), decora as paredes e o teto, acende as luminárias (âncoras) e anima a
 * cortina do portão e o exaustor.
 */
import * as THREE from "three";
import { BOX0, CYL0, SPH, geo, mat } from "../interior-batch";
import { glow } from "../interior-mats";
import type { InteriorRoom } from "../interior-shell";
import { type RoomsCtx, A, beacon, signMat, wallPlane } from "./kit";
import type { AreaModule } from "./types";
import { FLOOR_TILE, WALL_TILE, deckSurface, docaAtlas, floorSurface, wallSurface, type Rect } from "./doca-tex";
import { artCrate, docaFixture, docaMats, planeUV, tint, type DocaMats } from "./doca-props";

const R: InteriorRoom = "doca";
/** Planta da sala (x −22…−8,5, z 16,5…24, pé-direito 6 m) e os vãos. */
const X0 = -22, X1 = -8.5, Z0 = 16.5, Z1 = 24, H = 6;
const GATE = { x0: -21, x1: -17, h: 4.2 };
/** Vigas principais (norte–sul) e secundárias (leste–oeste) da estrutura, e as luminárias de LED. */
const BEAMS_X = [-18.625, -15.25, -11.875], BEAMS_Z = [18.4, 20.25, 22.1];
const LAMPS: [number, number][] = [[-19.6, 18.6], [-15.25, 18.6], [-10.9, 18.6], [-19.6, 22.0], [-15.25, 22.0], [-10.9, 22.0]];

/* ---------- ajudantes no espaço da sala ---------- */
const box = (c: RoomsCtx, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: THREE.ColorRepresentation, o: { ry?: number; rx?: number; rz?: number; cast?: boolean } = {}) =>
  c.batch.add(R, m, color ? tint(BOX0(), "box0", color) : BOX0(), mat(x, y, z, o.ry ?? 0, sx, sy, sz, o.rx ?? 0, o.rz ?? 0), { cast: o.cast });
/** Barra (cilindro) de a até b. */
function bar(c: RoomsCtx, m: THREE.Material, a: [number, number, number], b: [number, number, number], r: number, color?: THREE.ColorRepresentation, seg = 8) {
  const A3 = new THREE.Vector3(...a), B3 = new THREE.Vector3(...b), len = A3.distanceTo(B3), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B3.clone().sub(A3).normalize());
  const M4 = new THREE.Matrix4().compose(A3, q, new THREE.Vector3(r, len, r));
  c.batch.add(R, m, color ? tint(CYL0(seg), `cyl0${seg}`, color) : CYL0(seg), M4);
}
/** Desenho da folha num plano na parede (ry = para onde olha; 0 = +z). */
const sign = (c: RoomsCtx, m: THREE.Material, name: string, r: Rect, x: number, y: number, z: number, ry: number, w: number, h: number) => c.batch.add(R, m, planeUV(name, r), mat(x, y, z, ry, w, h, 1));
/** Desenho deitado no piso (marcas): centro, tamanho e giro. */
const mark = (c: RoomsCtx, M: DocaMats, name: string, r: Rect, x: number, z: number, w: number, d: number, ry = 0, lift = 0.004) => c.batch.add(R, M.marks, planeUV(name, r), mat(x, lift, z, ry, w, d, 1, -Math.PI / 2));

/* ======================= teto: estrutura, utilidades e luz ======================= */
function ceiling(c: RoomsCtx, M: DocaMats) {
  const steel = "#59616a";
  // vigas I principais (0,45 m) apoiadas em chapas nas paredes norte e sul
  for (const x of BEAMS_X) {
    box(c, M.paint, x, H - 0.02, (Z0 + Z1) / 2, 0.2, 0.02, Z1 - Z0, steel); box(c, M.paint, x, H - 0.45, (Z0 + Z1) / 2, 0.2, 0.022, Z1 - Z0, steel);
    box(c, M.paint, x, H - 0.43, (Z0 + Z1) / 2, 0.012, 0.41, Z1 - Z0, steel, { cast: true });
    for (const z of [Z0 + 0.012, Z1 - 0.012]) box(c, M.paint, x, H - 0.75, z, 0.32, 0.36, 0.024, "#4b5259");
    for (let z = Z0 + 1.2; z < Z1 - 0.5; z += 1.5) for (const s of [-1, 1]) box(c, M.paint, x + s * 0.03, H - 0.43, z, 0.006, 0.4, 0.08, "#4b5259");   // enrijecedores
  }
  // vigas secundárias (0,25 m) e as tesouras de canto (mãos-francesas) nas paredes leste e oeste
  for (const z of BEAMS_Z) {
    box(c, M.paint, (X0 + X1) / 2, H - 0.015, z, X1 - X0, 0.015, 0.12, steel); box(c, M.paint, (X0 + X1) / 2, H - 0.25, z, X1 - X0, 0.015, 0.12, steel);
    box(c, M.paint, (X0 + X1) / 2, H - 0.24, z, X1 - X0, 0.23, 0.008, steel);
    for (const [x, s] of [[X0, 1], [X1, -1]] as [number, number][]) bar(c, M.paint, [x + s * 0.02, H - 1.1, z], [x + s * 0.7, H - 0.26, z], 0.03, steel);
  }
  // eletrocalha perfurada correndo junto à parede norte e descendo pela leste, presa por tirantes
  const tray = (xa: number, za: number, xb: number, zb: number) => {
    const alongX = Math.abs(xb - xa) > Math.abs(zb - za), cx = (xa + xb) / 2, cz = (za + zb) / 2, len = alongX ? Math.abs(xb - xa) : Math.abs(zb - za), y = 4.72;
    box(c, M.galv, cx, y, cz, alongX ? len : 0.3, 0.012, alongX ? 0.3 : len);
    for (const s of [-1, 1]) box(c, M.galv, alongX ? cx : cx + s * 0.15, y, alongX ? cz + s * 0.15 : cz, alongX ? len : 0.012, 0.09, alongX ? 0.012 : len);
    // cabos (três maços) e os tirantes de 1,5 em 1,5 m
    for (let k = 0; k < 3; k++) { const o = -0.08 + k * 0.08; box(c, c.P.black, alongX ? cx : cx + o, y + 0.015, alongX ? cz + o : cz, alongX ? len : 0.035, 0.035, alongX ? 0.035 : len); }
    for (let t = 0.3; t < len; t += 1.5) { const px = alongX ? Math.min(xa, xb) + t : cx, pz = alongX ? cz : Math.min(za, zb) + t; for (const s of [-1, 1]) bar(c, M.galv, [alongX ? px : px + s * 0.17, y - 0.04, alongX ? pz + s * 0.17 : pz], [alongX ? px : px + s * 0.17, H, alongX ? pz + s * 0.17 : pz], 0.006, undefined, 6); box(c, M.galv, px, y - 0.05, pz, alongX ? 0.04 : 0.4, 0.03, alongX ? 0.4 : 0.04); }
  };
  tray(X0 + 0.3, 17.15, X1 - 0.4, 17.15); tray(X1 - 0.4, 17.15, X1 - 0.4, Z1 - 0.4);
  // eletrodutos descendo da calha: quadro de força (oeste), motor do portão, relógio de ponto e botoeira
  for (const [x, z, y1] of [[X0 + 0.06, 18.45, 1.95], [X0 + 0.06, 18.75, 1.95], [-16.45, Z1 - 0.06, 1.47], [X1 - 0.06, 18.62, 1.6], [X1 - 0.06, 17.8, 2.0]] as [number, number, number][]) {
    bar(c, M.galv, [x, y1, z], [x, 4.7, z], 0.016, undefined, 8);
    for (let y = y1 + 0.5; y < 4.6; y += 1.2) box(c, M.galv, x, y, z, 0.05, 0.02, 0.05);
  }
  // sprinklers: tubulação principal vermelha (leste–oeste) e ramais (norte–sul) com bicos pendentes de 2 em 2 m
  const red = "#b3221c";
  bar(c, M.paint, [X0 + 0.2, 5.4, 20.25], [X1 - 0.2, 5.4, 20.25], 0.055, red, 12);
  for (const x of [-20.3, -16.95, -13.55, -10.2]) {
    bar(c, M.paint, [x, 5.42, 17.0], [x, 5.42, 23.5], 0.025, red, 8);
    for (const z of [17.3, 19.3, 21.3, 23.3]) {
      bar(c, M.paint, [x, 5.42, z], [x, 5.22, z], 0.012, red, 6);
      c.inst.add(R, "doca-sprinkler", geo("doca-sprHead", () => new THREE.CylinderGeometry(0.03, 0.012, 0.04, 10)), c.P.brass, mat(x, 5.2, z));
      c.inst.add(R, "doca-sprDefl", geo("doca-sprDeflGeo", () => new THREE.CylinderGeometry(0.035, 0.035, 0.004, 12)), c.P.brass, mat(x, 5.17, z));
    }
    for (let z = 17.6; z < 23.5; z += 2.2) bar(c, M.galv, [x, 5.45, z], [x, H, z], 0.006, undefined, 6);
  }
  for (const x of [X0 + 1.5, -13, X1 - 1.5]) bar(c, M.galv, [x, 5.47, 20.25], [x, H, 20.25], 0.008, undefined, 6);
  // detectores de fumaça no teto
  for (const [x, z] of [[-17, 19.3], [-12.5, 21.3], [-20.5, 23.0]]) c.inst.add(R, "doca-smoke", geo("doca-smokeGeo", () => new THREE.CylinderGeometry(0.07, 0.075, 0.04, 16)), c.P.plastic, mat(x, H - 0.02, z));
  // luminárias industriais de LED (tipo "UFO" com aletas), penduradas por cabo de aço, e as âncoras de luz
  for (const [k, [x, z]] of LAMPS.entries()) {
    const y = 4.62;
    bar(c, M.galv, [x, y + 0.2, z], [x, H - (BEAMS_X.includes(x) ? 0.45 : 0), z], 0.004, undefined, 4);
    c.batch.add(R, M.paint, tint(geo("doca-ufo", () => new THREE.CylinderGeometry(0.17, 0.19, 0.08, 24).translate(0, 0.04, 0)), "doca-ufo", "#2b2e32"), mat(x, y, z));
    for (let j = 0; j < 12; j++) { const a = (j / 12) * Math.PI * 2; c.inst.add(R, "doca-fin", BOX0(), M.paint as THREE.Material, mat(x + Math.cos(a) * 0.1, y + 0.08, z + Math.sin(a) * 0.1, -a, 0.16, 0.08, 0.008)); }
    c.batch.add(R, M.paint, tint(geo("doca-ufoTop", () => new THREE.CylinderGeometry(0.05, 0.07, 0.12, 14).translate(0, 0.06, 0)), "doca-ufoTop", "#2b2e32"), mat(x, y + 0.08, z));
    c.inst.add(R, "doca-ufoLens", geo("doca-ufoLensGeo", () => new THREE.CircleGeometry(0.16, 24).rotateX(Math.PI / 2)), M.led, mat(x, y - 0.002, z));
    A(c, R, x, y - 0.35, z, "#eef3ff", 13, 9.5, { flicker: k === 4 ? 1 : 0 });
  }
}

/* ======================= portão de enrolar (por dentro) ======================= */
function gate(c: RoomsCtx, M: DocaMats, at: Record<string, Rect>) {
  const z = Z1 - 0.01, { x0, x1, h } = GATE;
  // guias em U dos dois lados, caixa do rolo (capô) com o motor e a corrente de manobra
  for (const x of [x0 - 0.06, x1 + 0.06]) { box(c, M.galv, x, 0, z - 0.06, 0.12, h + 0.25, 0.1); box(c, M.galv, x + (x < x0 ? -0.05 : 0.05), 0, z - 0.06, 0.02, h + 0.25, 0.14); }
  box(c, M.galv, (x0 + x1) / 2, h + 0.05, z - 0.3, x1 - x0 + 0.6, 0.7, 0.6, undefined, { cast: true });
  box(c, M.paint, (x0 + x1) / 2, h + 0.05, z - 0.605, x1 - x0 + 0.6, 0.7, 0.01, "#9aa0a5");
  box(c, M.paint, x1 + 0.55, h + 0.12, z - 0.3, 0.32, 0.42, 0.36, "#2e5d8a");                         // motor
  bar(c, M.paint, [x1 + 0.39, h + 0.33, z - 0.3], [x1 + 0.31, h + 0.33, z - 0.3], 0.09, "#2e5d8a", 14);
  for (const dz of [-0.36, -0.24]) bar(c, M.galv, [x1 + 0.72, h + 0.1, z + dz], [x1 + 0.72, 1.1, z + dz], 0.007, undefined, 4);   // corrente
  // botoeira (abre/para/fecha) com o eletroduto e o aviso; para-choques de borracha e cantoneiras zebradas nas quinas
  box(c, M.paint, x1 + 0.55, 1.25, z - 0.06, 0.16, 0.22, 0.1, "#e2b322");
  sign(c, M.signs, "buttons", at.buttons, x1 + 0.55, 1.36, z - 0.115, Math.PI, 0.14, 0.18);
  // na frente do capô: altura livre, a saída iluminada e o aviso do portão automático; na parede acima, o letreiro
  const hood = z - 0.612;
  sign(c, M.signs, "clearance", at.clearance, x0 + 0.55, h + 0.4, hood, Math.PI, 0.8, 0.3);
  sign(c, M.lit, "exit2", at.exit, (x0 + x1) / 2, h + 0.4, hood, Math.PI, 0.62, 0.26);
  sign(c, M.signs, "gateWarn", at.gateWarn, x1 - 0.65, h + 0.4, hood, Math.PI, 1.1, 0.41);
  sign(c, M.signs, "dockTitle", at.dockTitle, (x0 + x1) / 2, 5.42, z - 0.012, Math.PI, 3.4, 0.64);
  for (const x of [x0 - 0.25, x1 + 0.25]) { box(c, c.P.rubber, x, 0.15, z - 0.12, 0.22, 0.42, 0.22); box(c, c.P.rubber, x, 0.7, z - 0.12, 0.22, 0.42, 0.22); }
  // cortina de lâminas por dentro (sobe com o portão: mesma conta do portão de fora, em exterior-facade)
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 42; k++) { const g = new THREE.BoxGeometry(x1 - x0, 0.085, 0.03); g.translate((x0 + x1) / 2, k * 0.1 + 0.0425, 0); parts.push(g); }
  for (let k = 0; k < 42; k++) { const g = new THREE.BoxGeometry(x1 - x0, 0.012, 0.012); g.translate((x0 + x1) / 2, k * 0.1 + 0.092, -0.018); parts.push(g); }
  const bottom = new THREE.BoxGeometry(x1 - x0, 0.06, 0.05); bottom.translate((x0 + x1) / 2, 0.03, 0); parts.push(bottom);
  const slats = new THREE.Mesh(mergeGeos(parts), M.galv); slats.position.set(0, 0, Z1 + 0.06); slats.castShadow = true; slats.userData.room = R; c.group.add(slats);
  const st = { open: -1 };
  c.ticks.push({ room: R, tick: (_t, dt, v) => {
    const target = v.doors.dockGate ? 1 : 0;
    st.open = st.open < 0 ? target : st.open + (target - st.open) * Math.min(1, dt * 1.6);
    const s = Math.max(0.02, 1 - st.open); slats.scale.y = s; slats.position.y = 4.15 * (1 - s); slats.updateMatrix();
  } });
}
function mergeGeos(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  for (const g of list) { const x = g.index ? g.toNonIndexed() : g; pos.push(...(x.getAttribute("position").array as Float32Array)); nor.push(...(x.getAttribute("normal").array as Float32Array)); uv.push(...(x.getAttribute("uv").array as Float32Array)); }
  const out = new THREE.BufferGeometry(); out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

/* ======================= paredes ======================= */
function walls(c: RoomsCtx, M: DocaMats, at: Record<string, Rect>) {
  const zebra = (x: number, z: number, ry: number) => { box(c, c.P.yellow, x, 0, z, 0.08, 1.2, 0.08, undefined, { ry }); for (let k = 0; k < 6; k++) box(c, c.P.black, x, 0.1 + k * 0.2, z, 0.085, 0.07, 0.085, undefined, { ry: ry + 0.0 }); };
  // cantoneiras zebradas (borracha) nas quinas da porta de serviço e da porta lateral, por fora do batente (no portão,
  // as guias e os para-choques fazem esse papel)
  for (const x of [-20.15, -17.85]) zebra(x, Z0 + 0.045, 0);
  for (const z of [19.85, 22.65]) zebra(X1 - 0.045, z, 0);
  // bate-carrinho de borracha preta (dois frisos) nas paredes leste e sul, fora dos vãos
  const rail = (xa: number, za: number, xb: number, zb: number) => { for (const y of [0.22, 0.42]) box(c, c.P.rubber, (xa + xb) / 2, y, (za + zb) / 2, Math.max(0.05, Math.abs(xb - xa)), 0.06, Math.max(0.05, Math.abs(zb - za))); };
  rail(GATE.x1 + 0.35, Z1 - 0.025, X1 - 0.05, Z1 - 0.025); rail(X1 - 0.025, 22.7, X1 - 0.025, Z1 - 0.05); rail(X1 - 0.025, 17.45, X1 - 0.025, 19.8);
  rail(X0 + 0.025, 21.35, X0 + 0.025, Z1 - 0.1);
  // placas: segurança e orientação (a "SOMENTE FUNCIONÁRIOS" e "DOCA" no idioma do jogo, pelo kit)
  wallPlane(c, R, signMat(c.copy.staffOnly, "staff"), X1 - 0.015, 2.95, 18.9, -Math.PI / 2, 1.3, 0.33);
  wallPlane(c, R, signMat(c.copy.dock, "service"), -13.6, 3.6, Z0 + 0.015, 0, 2.6, 0.62);
  sign(c, M.signs, "epi", at.epi, X0 + 0.012, 1.95, 21.85, Math.PI / 2, 0.36, 0.54);
  sign(c, M.signs, "forklift", at.forklift, X0 + 0.012, 1.95, 22.45, Math.PI / 2, 0.36, 0.54);
  sign(c, M.signs, "noSmoking", at.noSmoking, X0 + 0.012, 1.95, 23.05, Math.PI / 2, 0.36, 0.54);
  sign(c, M.signs, "speed", at.speed, -15.3, 2.1, Z1 - 0.012, Math.PI, 0.42, 0.42);
  sign(c, M.signs, "visitors", at.visitors, X0 + 0.012, 2.45, 22.45, Math.PI / 2, 1.3, 0.24);
  // saídas iluminadas (sobre a porta lateral e o portão) e as luzes de emergência (bloco autônomo de dois faróis)
  sign(c, M.lit, "exit", at.exit, X1 - 0.03, 2.92, 21.25, -Math.PI / 2, 0.6, 0.25);
  for (const [x, y, z, ry] of [[X1 - 0.05, 3.25, 21.25, -Math.PI / 2], [-19, 2.95, Z0 + 0.05, 0], [-14.3, 5.0, Z1 - 0.05, Math.PI]] as [number, number, number, number][]) {
    const fwd = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), side = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
    box(c, M.plastic, x + fwd.x * 0.03, y, z + fwd.z * 0.03, Math.abs(side.x) * 0.36 + 0.06, 0.12, Math.abs(side.z) * 0.36 + 0.06, "#ecebe6");
    for (const s of [-1, 1]) c.inst.add(R, "doca-emHead", SPH(10), c.P.plastic, mat(x + fwd.x * 0.09 + side.x * s * 0.12, y + 0.02, z + fwd.z * 0.09 + side.z * s * 0.12, 0, 0.04));
    c.inst.add(R, "doca-emLed", SPH(6), M.ledGreen, mat(x + fwd.x * 0.065, y + 0.04, z + fwd.z * 0.065, 0, 0.008));
  }
  // parede leste: mural de avisos, relógio de ponto e porta-cartões, extintor (com placa e quadrado no piso), mapa de fuga
  const ex = X1 - 0.012, ryE = -Math.PI / 2;
  box(c, c.P.walnut, ex - 0.012, 1.2, 17.85, 0.025, 0.74, 0.94); sign(c, M.signs, "notices", at.notices, ex - 0.028, 1.57, 17.85, ryE, 0.9, 0.68);
  box(c, M.plastic, ex - 0.05, 1.25, 18.62, 0.1, 0.3, 0.24, "#d9d6cc"); sign(c, M.signs, "clock", at.clock, ex - 0.102, 1.4, 18.62, ryE, 0.22, 0.22);
  box(c, M.paint, ex - 0.03, 1.0, 19.1, 0.06, 0.5, 0.42, "#5c6066"); sign(c, M.signs, "cards", at.cards, ex - 0.062, 1.25, 19.1, ryE, 0.4, 0.22);
  extinguisher(c, M, at, X1, 19.62, -1, "co2");
  box(c, c.P.black, ex - 0.008, 1.35, 23.0, 0.012, 0.5, 0.66); sign(c, M.signs, "evac", at.evac, ex - 0.016, 1.6, 23.0, ryE, 0.62, 0.46);
  // bebedouro: o dispensador de copos ao lado
  cyl(c, M.plastic, X1 - 0.07, 1.15, 16.72, 0.04, 0.45, "#f0eee8"); box(c, M.galv, X1 - 0.03, 1.4, 16.72, 0.04, 0.05, 0.1);
  // parede oeste: quadro de força (com eletrodutos e a placa), exaustor no alto
  box(c, M.paint, X0 + 0.11, 0.95, 18.6, 0.2, 0.95, 0.62, "#8c9298", { cast: true });
  box(c, M.paint, X0 + 0.215, 1.0, 18.6, 0.01, 0.85, 0.56, "#7d838a");
  box(c, c.P.chrome, X0 + 0.225, 1.4, 18.85, 0.02, 0.1, 0.03);
  sign(c, M.signs, "electric", at.electric, X0 + 0.222, 1.68, 18.6, Math.PI / 2, 0.18, 0.18);
  exhaust(c, M);
  // parede sul, a oeste do portão: extintor de pó
  extinguisher(c, M, at, -21.5, Z1, 1, "pqs");
  // vassoura e pá encostadas na parede oeste (ao lado da guarita) e o carrinho de mão entre a estante e a bancada
  bar(c, c.P.oak, [X0 + 0.22, 0.02, 21.5], [X0 + 0.05, 1.32, 21.58], 0.012, undefined, 6);
  box(c, c.P.black, X0 + 0.24, 0.0, 21.5, 0.06, 0.05, 0.28, undefined, { rz: 0.1 });
  box(c, c.P.black, X0 + 0.06, 0.02, 21.82, 0.04, 0.3, 0.26, undefined, { rz: -0.2 });
  const ht = new THREE.Vector3(-12.8, 0, 16.62);
  for (const s of [-1, 1]) bar(c, M.paint, [ht.x + s * 0.13, 0.12, ht.z + 0.25], [ht.x + s * 0.13, 1.3, ht.z + 0.02], 0.016, "#c62f23");
  for (const y of [0.5, 0.9]) bar(c, M.paint, [ht.x - 0.13, y, ht.z + 0.25 - (y - 0.12) * 0.19], [ht.x + 0.13, y, ht.z + 0.25 - (y - 0.12) * 0.19], 0.01, "#c62f23");
  box(c, M.paint, ht.x, 0.02, ht.z + 0.3, 0.28, 0.015, 0.2, "#7a7f85");
  for (const s of [-1, 1]) c.batch.add(R, c.P.rubber, geo("doca-wheelV", () => new THREE.CylinderGeometry(1, 1, 1, 14).rotateZ(Math.PI / 2)), mat(ht.x + s * 0.15, 0.11, ht.z + 0.24, 0, 0.03, 0.11, 0.11));
}
/** Extintor na parede (suporte, cilindro vermelho, válvula, mangueira), a placa vermelha acima e o quadrado no piso. */
function extinguisher(c: RoomsCtx, M: DocaMats, at: Record<string, Rect>, x: number, z: number, dir: 1 | -1, kind: "pqs" | "co2") {
  // dir: 1 = na parede sul (olha para −z); −1 = na parede leste (olha para −x)
  const fwd = dir === 1 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(-1, 0, 0), ry = dir === 1 ? Math.PI : -Math.PI / 2;
  const px = x + fwd.x * 0.13, pz = z + fwd.z * 0.13, r = kind === "co2" ? 0.075 : 0.085, h = kind === "co2" ? 0.62 : 0.5, y0 = 1.6 - h - 0.15;
  box(c, M.paint, x + fwd.x * 0.02, y0 + h * 0.5, z + fwd.z * 0.02, dir === 1 ? 0.08 : 0.04, 0.08, dir === 1 ? 0.04 : 0.08, "#2a2a2a");
  cyl(c, M.paint, px, y0, pz, r, h, "#c3141a");
  c.batch.add(R, M.paint, tint(geo("doca-extDome", () => new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2)), "doca-extDome", "#c3141a"), mat(px, y0 + h, pz, 0, r, r * 0.6, r));
  box(c, M.paint, px, y0 + h + r * 0.5, pz, 0.05, 0.08, 0.04, "#1a1a1a");
  if (kind === "co2") box(c, M.paint, px + fwd.x * 0.04, y0 + 0.1, pz + fwd.z * 0.04, 0.06, 0.2, 0.06, "#151515", { rx: 0.3 });
  else bar(c, M.paint, [px, y0 + h + 0.04, pz], [px + fwd.x * 0.07, y0 + 0.2, pz + fwd.z * 0.07], 0.008, "#151515");
  sign(c, M.signs, `ext-${x}`, at.extinguisher, x + fwd.x * 0.012, 1.95, z + fwd.z * 0.012, ry, 0.3, 0.3);
  mark(c, M, `extF-${x}`, at.extFloor, x + fwd.x * 0.42, z + fwd.z * 0.42, 0.7, 0.7);
}
const cyl = (c: RoomsCtx, m: THREE.Material, x: number, y: number, z: number, r: number, h: number, color?: THREE.ColorRepresentation) => c.batch.add(R, m, color ? tint(CYL0(16), "cyl016", color) : CYL0(16), mat(x, y, z, 0, r, h, r));
/** Exaustor axial na parede oeste, no alto: moldura, anel, grade e a hélice que gira. */
function exhaust(c: RoomsCtx, M: DocaMats) {
  const x = X0 + 0.02, y = 4.55, z = 18.1;
  box(c, M.galv, x + 0.06, y - 0.4, z, 0.12, 0.8, 0.8);
  c.batch.add(R, M.galv, geo("doca-fanRing", () => new THREE.CylinderGeometry(0.34, 0.34, 0.16, 28, 1, true).rotateZ(Math.PI / 2)), mat(x + 0.1, y, z));
  for (let k = 1; k <= 4; k++) c.batch.add(R, M.galv, geo(`doca-fanGuard${k}`, () => new THREE.TorusGeometry(0.08 * k, 0.004, 4, 28).rotateY(Math.PI / 2)), mat(x + 0.19, y, z));
  for (let k = 0; k < 4; k++) box(c, M.galv, x + 0.19, y, z, 0.006, 0.66, 0.006, undefined, { rx: (k / 4) * Math.PI });
  const blades = new THREE.Mesh(geo("doca-fanBlades", () => { const parts: THREE.BufferGeometry[] = []; for (let k = 0; k < 5; k++) { const b = new THREE.BoxGeometry(0.006, 0.26, 0.09); b.translate(0, 0.15, 0); b.rotateY(0.3); b.rotateX((k / 5) * Math.PI * 2); parts.push(b); } const hub = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 14).rotateZ(Math.PI / 2); parts.push(hub); return mergeGeos(parts); }), c.P.darkSteel);
  blades.position.set(x + 0.1, y, z); blades.userData.room = R; c.group.add(blades);
  c.ticks.push({ room: R, tick: (t) => { blades.rotation.x = t * 7.5; } });
}

/* ======================= piso: faixas e marcas ======================= */
function floorMarks(c: RoomsCtx, M: DocaMats, at: Record<string, Rect>) {
  // zebrado na boca do portão (por dentro) e o "não obstruir" diante das portas e do quadro de força
  for (let k = 0; k < 8; k++) mark(c, M, `hz${k}`, at.hazard, GATE.x0 + 0.25 + k * 0.5, Z1 - 0.22, 0.5, 0.38);
  mark(c, M, "kc-service", at.keepClear, -19, Z0 + 0.72, 1.9, 1.3);
  mark(c, M, "kc-side", at.keepClear, X1 - 0.68, 21.25, 2.4, 1.25, Math.PI / 2);
  mark(c, M, "kc-panel", at.keepClear, X0 + 0.62, 18.6, 0.9, 0.9);
  // corredor de pedestres (porta lateral ↔ porta de serviço): duas faixas amarelas, setas e o letreiro
  for (let x = -17.4; x < -10.0; x += 0.98) for (const z of [18.65, 19.75]) mark(c, M, `ped${x}-${z}`, at.lineYellow, x + 0.49, z, 0.98, 0.09);
  for (const [x, ry] of [[-16.2, Math.PI / 2], [-11.6, -Math.PI / 2]] as [number, number][]) mark(c, M, `arr${x}`, at.arrow, x, 19.2, 0.5, 0.5, ry);
  mark(c, M, "ped-text", at.pedestres, -13.9, 19.2, 1.4, 0.5, Math.PI);
  // vagas de palete (cantos brancos) em volta da paleteira e dos paletes vazios, e as marcas de pneu e de óleo
  mark(c, M, "pb-jack", at.palletBox, -13.55, 23.5, 1.95, 1.15); mark(c, M, "pb-stack", at.palletBox, -21.35, 17.1, 1.45, 1.2);
  mark(c, M, "pb-cases", at.palletBox, -12.4, 20.3, 1.5, 0.9);
  for (const [x, z, ry, s] of [[-18.2, 22.2, 0.3, 2.2], [-15.6, 21.4, 2.4, 1.8], [-12.2, 22.3, -0.6, 1.6], [-20.4, 21.9, 1.2, 1.4]] as [number, number, number, number][]) mark(c, M, `tire${x}`, at.tire, x, z, s, s, ry, 0.0035);
  for (const [x, z, s] of [[-18.6, 20.6, 0.9], [-14.0, 22.5, 0.7], [-10.9, 19.9, 0.6]] as [number, number, number][]) mark(c, M, `oil${x}`, at.stain, x, z, s, s, x, 0.0033);
}

/* ======================= a doca ======================= */
function doca(c: RoomsCtx) {
  const M = docaMats(c.q, c.P), at = docaAtlas(c.q).rects;
  ceiling(c, M); gate(c, M, at); walls(c, M, at); floorMarks(c, M, at);
  // giroflex de emergência (alarme) na parede oeste, alto
  beacon(c, R, X0 + 0.1, 4.2, 23.0, 1, 0);
  // brilho fraco na boca do portão (a luz da rua entrando pelas frestas da cortina)
  c.batch.add(R, glow("doca-gateLeak", "#ffb46a", 0.35, { additive: true }), geo("doca-leak", () => new THREE.PlaneGeometry(1, 1)), mat(-19, 0.03, Z1 - 0.05, Math.PI, 4.0, 0.06, 1));
}

/** Módulo da área (ver areas/types.ts). */
export const AREA: AreaModule = {
  id: "doca", rooms: ["doca"], dress: doca,
  props: {
    fixture: docaFixture,
    // a caixa alta que ficou na planta é a caixa de obra do museu (Instituto do Traje), de compensado e sarrafos
    crate: (p, c) => artCrate(c, p),
  },
  surfaces: {
    doca: {
      floor: (q) => surfaceMat("floor", q, () => floorSurface(q), { metal: 0, env: 1 }), floorTile: FLOOR_TILE, floorMirror: [0.32, 0.03],
      wall: (q) => surfaceMat("wall", q, () => wallSurface(q), { env: 0.5 }), wallTile: WALL_TILE,
      ceil: (q) => surfaceMat("deck", q, () => deckSurface(q), { metal: 0.55, env: 0.6 }),
      trims: false,
    },
  },
  keys: {
    doca: [
      { p: [-19.6, 4.55, 20.3], aim: [-19.2, 0, 20.3], angle: 1.1, i: 46, color: "#eef3ff" },
      { p: [-12.6, 4.55, 20.3], aim: [-12.6, 0, 20.3], angle: 1.15, i: 50, color: "#eef3ff" },
    ],
  },
};
const smats = new Map<string, THREE.MeshStandardMaterial>();
/** Material da casca (cor + relevo + rugosidade) com cor por vértice (a oclusão dos cantos que a casca calcula). */
function surfaceMat(key: string, q: string, make: () => { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }, o: { metal?: number; env?: number } = {}): THREE.MeshStandardMaterial {
  const k = `${key}-${q}`; const hit = smats.get(k); if (hit) return hit;
  const s = make(), m = new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, roughness: 1, metalness: o.metal ?? 0, vertexColors: true, envMapIntensity: o.env ?? 1, shadowSide: THREE.DoubleSide });
  m.name = `doca-${key}`; smats.set(k, m); return m;
}
