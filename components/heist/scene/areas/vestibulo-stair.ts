/*
 * MET Gala Heist v2 — Vestíbulo: a escadaria monumental (Z14) e a galeria sobre a porta do salão. Uma escada em U em cada
 * canto norte (móvel "vestStair", caixa de colisão x ±3,9…±8, z 14,5…17,9): sete degraus retos subindo para a parede
 * lateral a partir do degrau de arranque arredondado, dez degraus em leque contornando a coluna-pilar (Ø 0,4 m) e oito
 * degraus junto à parede norte subindo de volta para o centro até a galeria a 4,42 m. Degrau de 17 × 30 cm na linha de
 * piso (a 0,95 m da coluna), largura 1,5 m. Pedra maciça com pisos de Carrara de borda boleada, passadeira vermelha com
 * varões de latão em cada dobra, banzo fechado com capeamento, balaústres torneados de mármore, corrimão de mogno em
 * hélice na curva, torchère de bronze no arranque e lanternas no alto. A galeria (7,8 × 1,5 m) liga as duas escadas sobre
 * a porta do salão, com balaustrada, friso dourado, forro em caixotões com spots e o estandarte da gala.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { BOX0, CYL, CYL0, mat, mul } from "../interior-batch";
import type { PropsCtx, LightAnchor } from "../interior-props";
import type { RoomsCtx } from "./kit";
import { BOXC, GALLERY_Y, GOING, RISE, ROOM, VM, beam, frameGeo, lathe, prism, vGeo, vGlow, vMat, vTex, type VPalette } from "./vestibulo-kit";

type Ctx = Pick<PropsCtx, "q" | "batch" | "inst" | "anchors">;
/** Medidas da escada leste (a oeste é o espelho em x). */
export const ST = {
  w: 1.5, newel: [6.3, 16.2] as [number, number], rn: 0.2, ro: 1.7, lowZ: [16.4, 17.9] as [number, number], upZ: [14.5, 16.0] as [number, number],
  xBottom: 4.2, xTop: 3.9, nLow: 7, nTurn: 10, nUp: 8,
};
const SLAB = 0.035;
/** Altura do focinho (linha dos degraus) em cada trecho: lance de baixo (x), leque (φ) e lance de cima (x). */
const hLow = (x: number) => RISE + (x - ST.xBottom) * (RISE / GOING);
const hTurn = (phi: number) => RISE * (ST.nLow + 1) + (phi / (Math.PI / ST.nTurn)) * RISE;
const hUp = (x: number) => RISE * (ST.nLow + ST.nTurn + 1) + (ST.newel[0] - x) * (RISE / GOING);
const RAIL = 0.9;

/* ---------- geometrias auxiliares ---------- */
/** Balaústre torneado de mármore (altura 1, base em 0). */
const baluster = () => lathe("stairBaluster", [[0.055, 0], [0.055, 0.06], [0.04, 0.09], [0.035, 0.14], [0.05, 0.22], [0.062, 0.34], [0.05, 0.47], [0.028, 0.6], [0.026, 0.72], [0.04, 0.8], [0.04, 0.86], [0.05, 0.9], [0.05, 0.96], [0, 1]], 12);

/** Constrói uma escada (sinal +1: leste, −1: oeste) nos lotes da sala. */
export function buildStair(p: Prop, c: Ctx) {
  const V = VM(c.q), sg = p.shape.type === "box" && p.shape.x0 < 0 ? -1 : 1, X = (x: number) => sg * x;
  const [ncx, ncz] = [X(ST.newel[0]), ST.newel[1]];
  const at = (phi: number, rho: number): [number, number] => [ncx + sg * rho * Math.sin(phi), ncz + rho * Math.cos(phi)];
  const add = (m: THREE.Material, g: THREE.BufferGeometry, M?: THREE.Matrix4, cast = false) => c.batch.add(ROOM, m, g, M, { cast });
  const runnerW = 1.0, [lz0, lz1] = ST.lowZ, [uz0, uz1] = ST.upZ, lwalk = (lz0 + lz1) / 2, uwalk = (uz0 + uz1) / 2;

  /* ---------- lance de baixo: degrau de arranque arredondado + seis retos ---------- */
  for (let i = 1; i <= ST.nLow; i++) {
    const xa = ST.xBottom + GOING * (i - 1), xb = xa + GOING, h = i * RISE;
    if (i === 1) {
      // degrau de arranque: a ponta oeste é um meio círculo (raio = meia largura) que envolve a base do pilar
      const r = (lz1 - lz0) / 2, cz = (lz0 + lz1) / 2, pts: [number, number][] = [[X(xb), lz0], [X(xb), lz1]];
      for (let k = 0; k <= 16; k++) { const a = Math.PI / 2 + (k / 16) * Math.PI; pts.push([X(xa + 0.3 + Math.cos(a) * r * 0.75), cz + Math.sin(a) * r]); }
      add(V.stoneMold, prism(pts, 0, h - SLAB), undefined, true); add(V.carrara, prism(pts, h - SLAB, h));
    } else {
      add(V.stoneMold, BOX0(), mat(X((xa + xb) / 2), 0, (lz0 + lz1) / 2, 0, GOING, h - SLAB, lz1 - lz0), true);
      add(V.carrara, BOX0(), mat(X((xa + xb) / 2 - 0.0125), h - SLAB, (lz0 + lz1) / 2, 0, GOING + 0.025, SLAB, lz1 - lz0 + 0.02));
      c.inst.add(ROOM, "vestibulo-nosing", CYL(10), V.carrara, mat(X(xa - 0.025), h - SLAB / 2, (lz0 + lz1) / 2, 0, SLAB / 2, lz1 - lz0 + 0.02, SLAB / 2, Math.PI / 2, 0));
    }
    // passadeira: no piso e no espelho, varão de latão na dobra
    add(V.redCarpet, BOX0(), mat(X((xa + xb) / 2), h, lwalk, 0, GOING, 0.01, runnerW));
    if (i > 1) {
      add(V.redCarpet, BOX0(), mat(X(xa - 0.005), h - RISE, lwalk, 0, 0.012, RISE - SLAB, runnerW));
      // o varão fica no piso de baixo, encostado no espelho (o espelho do lance de baixo olha para −x no leste)
      c.inst.add(ROOM, "vestibulo-stairRod", CYL(10), V.brass, mat(X(xa - 0.02), h - RISE + 0.018, lwalk, 0, 0.008, runnerW + 0.1, 0.008, Math.PI / 2, 0));
      for (const s of [-1, 1]) c.inst.add(ROOM, "vestibulo-rodEye", vGeo("rodEyeGeo", () => new THREE.SphereGeometry(0.016, 10, 6)), V.brass, mat(X(xa - 0.02), h - RISE + 0.018, lwalk + s * (runnerW / 2 + 0.06)));
    }
  }
  /* ---------- leque: dez degraus contornando a coluna (por fora: arco de r 1,7 até φ = 90°; depois as paredes) ---------- */
  const rOut = (phi: number) => phi <= Math.PI / 2 + 1e-6 ? ST.ro : Math.min(ST.ro / Math.max(1e-3, Math.sin(phi)), ST.ro / Math.max(1e-3, -Math.cos(phi)));
  for (let k = 0; k < ST.nTurn; k++) {
    const pa = (k / ST.nTurn) * Math.PI, pb = ((k + 1) / ST.nTurn) * Math.PI, h = (ST.nLow + 1 + k) * RISE;
    const inner: [number, number][] = [], outer: [number, number][] = [], phis: number[] = [];
    for (let i = 0; i <= 6; i++) phis.push(pa + (pb - pa) * (i / 6));
    if (pa < Math.PI * 0.75 && pb > Math.PI * 0.75) { phis.push(Math.PI * 0.75); phis.sort((a, b) => a - b); }
    for (const ph of phis) { inner.push(at(ph, ST.rn)); outer.push(at(ph, rOut(ph))); }
    const poly = [...inner, ...outer.reverse()];
    add(V.stoneMold, prism(poly, 0, h - SLAB), undefined, true); add(V.carrara, prism(poly, h - SLAB, h));
    // focinho ao longo do raio de entrada (pa), passadeira em setor sobre a linha de piso e o varão na dobra
    const n0 = at(pa, ST.rn), n1 = at(pa, rOut(pa)), off = 0.025, tx = sg * Math.cos(pa), tz = -Math.sin(pa);   // tangente (sentido da subida)
    add(V.carrara, BOXC(), beam(new THREE.Vector3(n0[0] - tx * off, h - SLAB / 2, n0[1] - tz * off), new THREE.Vector3(n1[0] - tx * off, h - SLAB / 2, n1[1] - tz * off), SLAB, SLAB));
    const rw: [number, number][] = [];
    for (let i = 0; i <= 4; i++) rw.push(at(pa + (pb - pa) * (i / 4), 0.45));
    for (let i = 4; i >= 0; i--) rw.push(at(pa + (pb - pa) * (i / 4), 1.45));
    add(V.redCarpet, prism(rw, h, h + 0.01));
    const r0 = at(pa, 0.45), r1 = at(pa, 1.45);
    add(V.redCarpet, BOXC(), beam(new THREE.Vector3(r0[0] - tx * 0.007, h - RISE / 2 - SLAB / 2, r0[1] - tz * 0.007), new THREE.Vector3(r1[0] - tx * 0.007, h - RISE / 2 - SLAB / 2, r1[1] - tz * 0.007), 0.012, RISE - SLAB));
    c.inst.add(ROOM, "vestibulo-stairRodB", BOXC(), V.brass, beam(new THREE.Vector3(r0[0] - tx * 0.02, h - RISE + 0.018, r0[1] - tz * 0.02), new THREE.Vector3(r1[0] - tx * 0.02, h - RISE + 0.018, r1[1] - tz * 0.02), 0.016, 0.016));
  }
  /* ---------- lance de cima: oito degraus junto à parede norte até a galeria ---------- */
  for (let j = 1; j <= ST.nUp; j++) {
    const xb = ST.newel[0] - GOING * (j - 1), xa = xb - GOING, h = (ST.nLow + ST.nTurn + j) * RISE;
    add(V.stoneMold, BOX0(), mat(X((xa + xb) / 2), 0, (uz0 + uz1) / 2, 0, GOING, h - SLAB, uz1 - uz0), true);
    add(V.carrara, BOX0(), mat(X((xa + xb) / 2 + 0.0125), h - SLAB, (uz0 + uz1) / 2, 0, GOING + 0.025, SLAB, uz1 - uz0));
    c.inst.add(ROOM, "vestibulo-nosing", CYL(10), V.carrara, mat(X(xb + 0.025), h - SLAB / 2, (uz0 + uz1) / 2, 0, SLAB / 2, uz1 - uz0, SLAB / 2, Math.PI / 2, 0));
    add(V.redCarpet, BOX0(), mat(X((xa + xb) / 2), h, uwalk, 0, GOING, 0.01, runnerW));
    add(V.redCarpet, BOX0(), mat(X(xb + 0.005), h - RISE, uwalk, 0, 0.012, RISE - SLAB, runnerW));
    c.inst.add(ROOM, "vestibulo-stairRod", CYL(10), V.brass, mat(X(xb + 0.02), h - RISE + 0.018, uwalk, 0, 0.008, runnerW + 0.1, 0.008, Math.PI / 2, 0));
    for (const s of [-1, 1]) c.inst.add(ROOM, "vestibulo-rodEye", vGeo("rodEyeGeo", () => new THREE.SphereGeometry(0.016, 10, 6)), V.brass, mat(X(xb + 0.02), h - RISE + 0.018, uwalk + s * (runnerW / 2 + 0.06)));
  }
  // o último espelho (até a galeria) e a passadeira que entra 30 cm na galeria
  add(V.carrara, BOX0(), mat(X(ST.xTop), GALLERY_Y - RISE, (uz0 + uz1) / 2, 0, 0.02, RISE, uz1 - uz0));

  /* ---------- espinha entre os lances (banzo interno do lance de cima) com almofadas ---------- */
  const spineTop = (x: number) => hUp(x) + 0.22;
  const sp = vGeo(`spine${sg}`, () => {
    const s = new THREE.Shape(); s.moveTo(X(ST.xTop), 0); s.lineTo(X(ST.newel[0]), 0); s.lineTo(X(ST.newel[0]), spineTop(ST.newel[0])); s.lineTo(X(ST.xTop), spineTop(ST.xTop)); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: uz1 - lz0 === 0 ? 0.4 : lz0 - uz1, bevelEnabled: false }); g.translate(0, 0, uz1); return g;
  });
  add(V.stoneMold, sp, undefined, true);
  // capeamento inclinado de Carrara e as almofadas da face sul (vistas do lance de baixo e da sala)
  add(V.carrara, BOXC(), beam(new THREE.Vector3(X(ST.newel[0]), spineTop(ST.newel[0]) + 0.03, (uz1 + lz0) / 2), new THREE.Vector3(X(ST.xTop), spineTop(ST.xTop) + 0.03, (uz1 + lz0) / 2), lz0 - uz1 + 0.06, 0.06));
  for (const [x0, x1] of [[4.35, 5.25], [5.4, 6.05]] as [number, number][]) {
    const yb = hLow(x1) + 0.35, yt = spineTop(x1) - 0.45, cx = X((x0 + x1) / 2);
    if (yt - yb < 0.4) continue;
    // almofada entalhada na pedra: moldura de calcário em relevo, filete dourado e o campo de Botticino
    add(V.stoneMold, frameGeo("spinePanel", x1 - x0, yt - yb, 0.07, 0.035, 0.012), mat(cx, (yb + yt) / 2, lz0, 0), true);
    add(V.gilt, frameGeo("spinePanelGilt", x1 - x0 - 0.16, yt - yb - 0.16, 0.012, 0.012, 0.003), mat(cx, (yb + yt) / 2, lz0, 0));
    add(V.botticino, BOX0(), mat(cx, yb + 0.07, lz0 + 0.004, 0, x1 - x0 - 0.14, yt - yb - 0.14, 0.008));
  }

  /* ---------- banzo externo do lance de baixo e do leque (fechado), com capeamento ---------- */
  const stringTop = (x: number) => hLow(x) + 0.2;
  const so = vGeo(`outerString${sg}`, () => {
    const s = new THREE.Shape(), x0 = ST.xBottom + 0.3, x1 = ST.newel[0];
    s.moveTo(X(x0), 0); s.lineTo(X(x1), 0); s.lineTo(X(x1), stringTop(x1)); s.lineTo(X(x0), stringTop(x0)); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false }); g.translate(0, 0, lz1 - 0.06); return g;
  });
  add(V.stoneMold, so, undefined, true);
  add(V.carrara, BOXC(), beam(new THREE.Vector3(X(ST.xBottom + 0.3), stringTop(ST.xBottom + 0.3) + 0.03, lz1 - 0.02), new THREE.Vector3(X(ST.newel[0]), stringTop(ST.newel[0]) + 0.03, lz1 - 0.02), 0.13, 0.06));
  // banzo curvo do leque (0 ≤ φ ≤ 90°): parede fina em hélice com a borda de cima em degrau suave
  const curveGeo = vGeo(`curveString${sg}`, () => {
    const pos: number[] = [], nor: number[] = [], uv: number[] = [], N = 32, r0 = ST.ro - 0.08, r1 = ST.ro;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI / 2, b = ((i + 1) / N) * Math.PI / 2, ta = hTurn(a) + 0.2, tb = hTurn(b) + 0.2;
      const pa0 = at(a, r0), pa1 = at(a, r1), pb0 = at(b, r0), pb1 = at(b, r1);
      const quad = (p: number[][], n: number[]) => { for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...p[k]); nor.push(...n); uv.push(p[k][0], p[k][1]); } };
      const no = [sg * Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)];
      // face de fora (para a sala), face de dentro e o topo
      quad(sg > 0 ? [[pa1[0], 0, pa1[1]], [pb1[0], 0, pb1[1]], [pb1[0], tb, pb1[1]], [pa1[0], ta, pa1[1]]] : [[pb1[0], 0, pb1[1]], [pa1[0], 0, pa1[1]], [pa1[0], ta, pa1[1]], [pb1[0], tb, pb1[1]]], no);
      quad(sg > 0 ? [[pb0[0], 0, pb0[1]], [pa0[0], 0, pa0[1]], [pa0[0], ta, pa0[1]], [pb0[0], tb, pb0[1]]] : [[pa0[0], 0, pa0[1]], [pb0[0], 0, pb0[1]], [pb0[0], tb, pb0[1]], [pa0[0], ta, pa0[1]]], no.map((v, k) => (k === 1 ? 0 : -v)));
      quad(sg > 0 ? [[pa0[0], ta, pa0[1]], [pa1[0], ta, pa1[1]], [pb1[0], tb, pb1[1]], [pb0[0], tb, pb0[1]]] : [[pa1[0], ta, pa1[1]], [pa0[0], ta, pa0[1]], [pb0[0], tb, pb0[1]], [pb1[0], tb, pb1[1]]], [0, 1, 0]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); return g;
  });
  add(V.stoneMold, curveGeo, undefined, true);
  // rodapé de nero nas faces da escada que dão para a sala (banzo reto, banzo curvo e a ponta sob a galeria)
  add(V.nero, BOX0(), mat(X((ST.xBottom + 0.3 + ST.newel[0]) / 2), 0, lz1 + 0.025, 0, ST.newel[0] - ST.xBottom - 0.3, 0.18, 0.035));
  add(V.nero, vGeo(`curvePlinth${sg}`, () => {
    const pts: [number, number][] = [], N = 24;
    for (let i = 0; i <= N; i++) pts.push(at((i / N) * Math.PI / 2, ST.ro + 0.03));
    for (let i = N; i >= 0; i--) pts.push(at((i / N) * Math.PI / 2, ST.ro - 0.01));
    return prism(pts, 0, 0.18);
  }));
  add(V.nero, BOX0(), mat(X(ST.xTop - 0.0175), 0, (uz0 + lz0) / 2, 0, 0.035, 0.18, lz0 - uz0));
  // almofada alta entalhada na ponta da escada sob a galeria (a face que olha para a porta do salão)
  const ex = X(ST.xTop), ey0 = 0.5, ey1 = GALLERY_Y - 0.55, ez = (uz0 + lz0) / 2;
  add(V.stoneMold, frameGeo("endPanel", lz0 - uz0 - 0.3, ey1 - ey0, 0.08, 0.035, 0.012), mat(ex, (ey0 + ey1) / 2, ez, -sg * Math.PI / 2), true);
  add(V.gilt, frameGeo("endPanelGilt", lz0 - uz0 - 0.48, ey1 - ey0 - 0.18, 0.012, 0.012, 0.003), mat(ex, (ey0 + ey1) / 2, ez, -sg * Math.PI / 2));
  // rodapé em degrau contra as paredes (norte, atrás do lance de cima; e o canto do leque)
  for (let j = 1; j <= ST.nUp; j++) { const xb = ST.newel[0] - GOING * (j - 1), h = (ST.nLow + ST.nTurn + j) * RISE; add(V.nero, BOX0(), mat(X(xb - GOING / 2), h, uz0 + 0.015, 0, GOING + 0.02, 0.18, 0.03)); }

  /* ---------- balaustradas, corrimãos e pilares ---------- */
  const bal = baluster(), railM = V.mahogany;
  const putBal = (x: number, z: number, y0: number, y1: number) => c.inst.add(ROOM, "vestibulo-stairBal", bal, V.carrara, mat(x, y0, z, 0, 1, y1 - y0, 1));
  // lance de baixo (borda sul) e o leque (arco r 1,64): balaústres a cada ~15 cm e o corrimão em hélice
  const railPts: THREE.Vector3[] = [];
  for (let x = ST.xBottom + 0.42; x <= ST.newel[0] + 1e-6; x += 0.15) putBal(X(x), lz1 - 0.02, stringTop(x) + 0.06, hLow(x) + RAIL - 0.04);
  for (let x = ST.xBottom + 0.3; x <= ST.newel[0]; x += 0.3) railPts.push(new THREE.Vector3(X(x), hLow(x) + RAIL, lz1 - 0.02));
  const arcLen = (Math.PI / 2) * 1.64, nb = Math.floor(arcLen / 0.15);
  for (let k = 1; k <= nb; k++) { const ph = (k / nb) * Math.PI / 2, [x, z] = at(ph, ST.ro - 0.04); putBal(x, z, hTurn(ph) + 0.26, hTurn(ph) + RAIL - 0.04); }
  for (let k = 1; k <= 10; k++) { const ph = (k / 10) * Math.PI / 2 - (k === 10 ? 0.02 : 0), [x, z] = at(ph, ST.ro - 0.04); railPts.push(new THREE.Vector3(x, hTurn(ph) + RAIL, z)); }
  add(railM, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 80, 0.036, 10, false), undefined, true);
  add(V.brass, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts.map((v) => v.clone().setY(v.y - 0.075))), 80, 0.01, 6, false));
  // espinha: corrimão do lance de cima até a galeria
  const upRail: THREE.Vector3[] = [];
  for (let x = ST.newel[0] - 0.3; x >= ST.xTop - 1e-6; x -= 0.15) { putBal(X(x), (uz1 + lz0) / 2, spineTop(x) + 0.06, hUp(x) + RAIL - 0.04); }
  for (let x = ST.newel[0] - 0.25; x >= ST.xTop; x -= 0.3) upRail.push(new THREE.Vector3(X(x), hUp(x) + RAIL, (uz1 + lz0) / 2));
  upRail.push(new THREE.Vector3(X(ST.xTop), GALLERY_Y + RAIL, (uz1 + lz0) / 2));
  add(railM, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(upRail), 40, 0.036, 10, false), undefined, true);
  // coluna-pilar do leque (do chão até acima do corrimão de cima), com capitel dourado e urna
  const colTop = hUp(ST.newel[0]) + RAIL + 0.25;
  add(V.carrara, lathe("newelCol", [[0, 0], [0.24, 0], [0.24, 0.12], [0.2, 0.2], [0.2, 0.25], [0.19, 1], [0, 1]], 28), mat(ncx, 0, ncz, 0, 1, colTop, 1), true);
  add(V.gilt, lathe("newelCap", [[0.18, 0], [0.24, 0.08], [0.26, 0.16], [0.22, 0.2], [0, 0.2]], 24), mat(ncx, colTop, ncz));
  add(V.bronze, lathe("newelUrn", [[0, 0], [0.07, 0], [0.05, 0.04], [0.12, 0.14], [0.13, 0.2], [0.08, 0.26], [0.1, 0.28], [0, 0.3]], 20), mat(ncx, colTop + 0.2, ncz));
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; c.inst.add(ROOM, "vestibulo-newelFlute", CYL0(6), V.stoneMold, mat(ncx + Math.cos(a) * 0.19, 0.3, ncz + Math.sin(a) * 0.19, 0, 0.018, colTop - 0.6, 0.018)); }
  // pilar de arranque sobre o degrau redondo, com a torchère de bronze de três globos
  const bx = X(ST.xBottom + 0.12), bz = lz1 - 0.2;
  add(V.nero, BOX0(), mat(bx, RISE, bz, 0, 0.42, 0.12, 0.42));
  add(V.carrara, BOX0(), mat(bx, RISE + 0.12, bz, 0, 0.34, 0.86, 0.34), true);
  add(V.nero, frameGeo("newelPanel", 0.22, 0.6, 0.03, 0.012), mat(bx, RISE + 0.55, bz + 0.17, 0));
  add(V.nero, frameGeo("newelPanel", 0.22, 0.6, 0.03, 0.012), mat(bx + sg * -0.17, RISE + 0.55, bz, -sg * Math.PI / 2));
  add(V.carrara, lathe("newelCapSq", [[0.25, 0], [0.27, 0.04], [0.25, 0.08], [0.2, 0.1], [0, 0.1]], 4), mat(bx, RISE + 0.98, bz, Math.PI / 4));
  torchere(c, V, bx, RISE + 1.08, bz);
  // lanterna no alto, onde a escada chega à galeria
  galleryLamp(c, V, X(ST.xTop), GALLERY_Y + RAIL + 0.08, (uz1 + lz0) / 2);
}

/** Torchère de bronze: base, haste com nós, três braços com globos foscos acesos. */
function torchere(c: Ctx, V: VPalette, x: number, y: number, z: number) {
  c.batch.add(ROOM, V.bronze, lathe("torchBase", [[0, 0], [0.13, 0], [0.12, 0.04], [0.06, 0.08], [0.035, 0.2], [0.05, 0.24], [0.03, 0.3], [0.03, 0.7], [0.05, 0.74], [0.025, 0.78], [0, 0.8]], 20), mat(x, y, z), { cast: true });
  const globe = vGlow("torchGlobe", "#ffe2b0", 1.7);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.3, ax = x + Math.cos(a) * 0.17, az = z + Math.sin(a) * 0.17;
    c.batch.add(ROOM, V.bronze, BOXC(), beam(new THREE.Vector3(x, y + 0.72, z), new THREE.Vector3(ax, y + 0.8, az), 0.022, 0.022));
    c.batch.add(ROOM, V.bronze, lathe("torchCup", [[0, 0], [0.04, 0.01], [0.05, 0.04], [0, 0.04]], 12), mat(ax, y + 0.8, az));
    c.inst.add(ROOM, "vestibulo-torchGlobe", vGeo("torchGlobeGeo", () => new THREE.SphereGeometry(0.075, 18, 12)), globe, mat(ax, y + 0.9, az));
  }
  c.inst.add(ROOM, "vestibulo-torchGlobe", vGeo("torchGlobeGeo", () => new THREE.SphereGeometry(0.075, 18, 12)), globe, mat(x, y + 1.0, z, 0, 1.15));
  c.anchors.push({ x, y: y + 1.0, z, color: "#ffd59a", intensity: 5.5, distance: 5, room: ROOM } as LightAnchor);
}
/** Lanterna de bronze e vidro sobre o pilar do alto da escada. */
function galleryLamp(c: Ctx, V: VPalette, x: number, y: number, z: number) {
  c.batch.add(ROOM, V.carrara, BOX0(), mat(x, y - 0.12, z, 0, 0.3, 0.12, 0.3));
  c.batch.add(ROOM, V.bronze, BOX0(), mat(x, y, z, 0, 0.2, 0.02, 0.2));
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.batch.add(ROOM, V.bronze, BOX0(), mat(x + dx * 0.085, y + 0.02, z + dz * 0.085, 0, 0.016, 0.34, 0.016));
  c.batch.add(ROOM, V.bronze, lathe("lampRoof", [[0, 0], [0.15, 0], [0.04, 0.12], [0.02, 0.18], [0, 0.2]], 4), mat(x, y + 0.36, z, Math.PI / 4));
  c.inst.add(ROOM, "vestibulo-lampGlass", BOX0(), vGlow("lampGlass", "#ffd9a0", 1.6), mat(x, y + 0.04, z, 0, 0.15, 0.3, 0.15));
  c.anchors.push({ x, y: y + 0.25, z, color: "#ffcf8f", intensity: 3, distance: 4, room: ROOM } as LightAnchor);
}

/* ======================= galeria sobre a porta do salão ======================= */
/** Galeria (x −3,9…3,9, z 14,5…16, piso a 4,42 m): laje, friso dourado, balaustrada, forro com caixotões e spots, estandarte. */
export function buildGallery(c: RoomsCtx) {
  const V = VM(c.q), x0 = -ST.xTop, x1 = ST.xTop, z0 = 14.5, z1 = 16.0, top = GALLERY_Y, th = 0.16;
  c.batch.add(ROOM, V.carrara, BOX0(), mat(0, top - 0.03, (z0 + z1) / 2, 0, x1 - x0, 0.03, z1 - z0));
  c.batch.add(ROOM, V.stoneMold, BOX0(), mat(0, top - th, (z0 + z1) / 2, 0, x1 - x0, th - 0.03, z1 - z0), { cast: true });
  // passadeira da galeria (continua a das escadas)
  c.batch.add(ROOM, V.redCarpet, BOX0(), mat(0, top, (z0 + z1) / 2, 0, x1 - x0, 0.01, 1.0));
  // frente da laje: arquitrave, friso com filete dourado e cornija
  c.batch.add(ROOM, V.stoneMold, BOX0(), mat(0, top - 0.42, z1 + 0.04, 0, x1 - x0, 0.3, 0.1), { cast: true });
  c.batch.add(ROOM, V.gilt, BOX0(), mat(0, top - 0.27, z1 + 0.095, 0, x1 - x0, 0.03, 0.012));
  c.batch.add(ROOM, V.stoneMold, BOX0(), mat(0, top - 0.12, z1 + 0.06, 0, x1 - x0 + 0.1, 0.1, 0.16));
  // consolos em voluta sob a frente (presos às faces das escadas e sobre as pilastras da porta)
  for (const x of [-2.65, 2.65]) {
    c.batch.add(ROOM, V.stoneMold, BOX0(), mat(x, 0, z0 + 0.06, 0, 0.42, top - th - 0.45, 0.12), { cast: true });
    c.batch.add(ROOM, V.stoneMold, vGeo("galConsole", () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0, 0.8); s.quadraticCurveTo(0.9, 0.85, 1.4, 0.76); s.lineTo(1.4, 0.62); s.quadraticCurveTo(0.6, 0.55, 0.2, 0.05); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.24, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }); }), mat(x + 0.12, top - th - 0.8, z0, -Math.PI / 2), { cast: true });
    c.batch.add(ROOM, V.gilt, vGeo("galConsoleScroll", () => new THREE.TorusGeometry(0.07, 0.02, 8, 18)), mat(x, top - th - 0.68, z0 + 0.18, Math.PI / 2));
  }
  // forro: caixotões rasos e dois spots que iluminam a porta do salão
  for (let k = 0; k < 5; k++) {
    const x = x0 + (k + 0.5) * ((x1 - x0) / 5);
    c.batch.add(ROOM, V.plaster, frameGeo("galSoffit", (x1 - x0) / 5 - 0.12, z1 - z0 - 0.2, 0.06, 0.05, 0.01), mat(x, top - th - 0.002, (z0 + z1) / 2, 0, 1, 1, 1, Math.PI / 2));
    if (k === 1 || k === 3) { c.inst.add(ROOM, "vestibulo-galSpot", vGeo("galSpotGeo", () => new THREE.CircleGeometry(0.07, 18).rotateX(Math.PI / 2)), vGlow("galSpot", "#fff0d6", 2.2), mat(x, top - th - 0.06, (z0 + z1) / 2 + 0.1)); c.anchors.push({ x, y: top - th - 0.3, z: (z0 + z1) / 2 + 0.2, color: "#ffe8c8", intensity: 4, distance: 5, room: ROOM }); }
  }
  // balaustrada da frente: plinto, balaústres, corrimão de Carrara com filete de mogno
  c.batch.add(ROOM, V.carrara, BOX0(), mat(0, top, z1 - 0.08, 0, x1 - x0, 0.12, 0.2));
  for (let x = x0 + 0.12; x < x1 - 0.08; x += 0.155) c.inst.add(ROOM, "vestibulo-stairBal", baluster(), V.carrara, mat(x, top + 0.12, z1 - 0.08, 0, 1, RAIL - 0.2, 1));
  c.batch.add(ROOM, V.carrara, BOX0(), mat(0, top + RAIL - 0.08, z1 - 0.08, 0, x1 - x0, 0.08, 0.22), { cast: true });
  c.batch.add(ROOM, V.mahogany, CYL(12), mat(0, top + RAIL + 0.02, z1 - 0.08, 0, 0.04, x1 - x0, 0.04, 0, Math.PI / 2));
  // estandarte da gala pendurado na balaustrada (veludo vinho com franja e letras douradas)
  const b = vTex(`galaBanner-${c.copy.bannerA}`, 1024, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "#3a0710"); grd.addColorStop(1, "#5c0d18"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#d4ae5e"; g.lineWidth = 8; g.strokeRect(24, 24, w - 48, h - 48); g.lineWidth = 2; g.strokeRect(40, 40, w - 80, h - 80);
    g.fillStyle = "#e7c77d"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `600 ${Math.round(h * 0.2)}px 'Didot', 'Bodoni 72', Georgia, 'DejaVu Serif', serif`;
    g.fillText(c.copy.bannerA, w / 2, h * 0.42); g.font = `400 ${Math.round(h * 0.075)}px 'Didot', Georgia, serif`; g.fillText(c.copy.exhibitTitle + " · " + c.copy.exhibitSub, w / 2, h * 0.68);
  });
  const drape = vGeo("galBanner", () => { const g = new THREE.PlaneGeometry(2.6, 1.2, 24, 4), p = g.getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) p.setZ(i, 0.02 * Math.sin(p.getX(i) * 7) * (0.5 - p.getY(i) / 1.2)); g.translate(0, -0.6, 0); g.computeVertexNormals(); return g; });
  c.batch.add(ROOM, vMat("galBannerMat", () => new THREE.MeshPhysicalMaterial({ map: b, roughness: 0.75, sheen: 1, sheenColor: new THREE.Color("#ff8090"), sheenRoughness: 0.5, side: THREE.DoubleSide })), drape, mat(0, top + RAIL - 0.02, z1 + 0.06));
  c.batch.add(ROOM, V.brass, CYL(10), mat(0, top + RAIL - 0.02, z1 + 0.06, 0, 0.012, 2.8, 0.012, 0, Math.PI / 2));
  for (let k = 0; k < 40; k++) c.inst.add(ROOM, "vestibulo-fringe", BOX0(), V.giltBright, mat(-1.28 + k * (2.56 / 39), top + RAIL - 0.02 - 1.24, z1 + 0.06, 0, 0.012, 0.07, 0.006));
  void mul;
}
