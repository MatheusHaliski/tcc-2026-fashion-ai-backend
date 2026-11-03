/*
 * MET Gala Heist v2 — galeria (Z07): o teto em caixotões (vigas, bossas, rosetas, lanternim, difusores e
 * detectores) e os spots de museu nos trilhos. Saiu de galeria.ts sem mudança.
 */
import * as THREE from "three";
import { CYL, CYL0, SPH, geo, mat } from "../interior-batch";
import { type RoomsCtx, lightCone } from "./kit";
import { bx, lathe, lit, plain } from "./galeria-kit";
import { laylightMat } from "./galeria-tex";
import { blackSteel, bronze } from "./galeria-props";
import { ROOM, H, stoneMat } from "./galeria-planta";

/** Teto em caixotões: vigas com degrau e cordão dourado, bossas, molduras dos caixotões, rosetas, lanternim, difusores. */
export function ceiling(c: RoomsCtx) {
  const q = c.q, pl = stoneMat(q), gold = c.P.gold, XB = [-8, -4, 0, 4, 8], ZB = [-18.125, -14.25, -10.375];
  for (const x of XB) {
    bx(c.batch, ROOM, pl, mat(x, 5.1, -14.25, 0, 0.36, 0.4, 15.5), true);
    for (const s of [-1, 1]) { bx(c.batch, ROOM, pl, mat(x + s * 0.193, 5.36, -14.25, 0, 0.026, 0.05, 15.5)); c.batch.add(ROOM, gold, CYL(8), mat(x + s * 0.172, 5.112, -14.25, 0, 0.011, 15.5, 0.011, Math.PI / 2)); }
  }
  for (const z of ZB) {
    bx(c.batch, ROOM, pl, mat(0, 5.1, z, 0, 24, 0.4, 0.36), true);
    for (const s of [-1, 1]) { bx(c.batch, ROOM, pl, mat(0, 5.36, z + s * 0.193, 0, 24, 0.05, 0.026)); c.batch.add(ROOM, gold, CYL(8), mat(0, 5.112, z + s * 0.172, 0, 0.011, 24, 0.011, 0, Math.PI / 2)); }
    // trilho eletrificado preto sob a viga (os spots penduram dele)
    bx(c.batch, ROOM, blackSteel(), mat(0, 5.062, z, 0, 23, 0.038, 0.04));
  }
  for (const x of XB) for (const z of ZB) c.batch.add(ROOM, gold, lathe("galeria-bossa", [[0, -0.065], [0.03, -0.06], [0.07, -0.04], [0.11, -0.025], [0.13, 0], [0, 0]], 20), mat(x, 5.1, z));
  // caixotões (entre vigas e a cornija): moldura em degrau, roseta ou lanternim, difusor ou detector
  const xs = [-12, -8, -4, 0, 4, 8, 12], zs = [-22, -18.125, -14.25, -10.375, -6.5];
  const rose = lathe("galeria-roseta", [[0, -0.082], [0.03, -0.08], [0.08, -0.068], [0.14, -0.05], [0.22, -0.035], [0.28, -0.02], [0.3, 0], [0, 0]], 28);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
    const x0 = xs[i] + (i === 0 ? 0.3 : 0.18), x1 = xs[i + 1] - (i === 5 ? 0.3 : 0.18), z0 = zs[j] + (j === 0 ? 0.3 : 0.18), z1 = zs[j + 1] - (j === 3 ? 0.3 : 0.18);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    bx(c.batch, ROOM, pl, mat(cx, H - 0.07, z0 + 0.05, 0, w, 0.07, 0.1)); bx(c.batch, ROOM, pl, mat(cx, H - 0.07, z1 - 0.05, 0, w, 0.07, 0.1));
    bx(c.batch, ROOM, pl, mat(x0 + 0.05, H - 0.07, cz, 0, 0.1, 0.07, d - 0.2)); bx(c.batch, ROOM, pl, mat(x1 - 0.05, H - 0.07, cz, 0, 0.1, 0.07, d - 0.2));
    const lay = (i === 2 || i === 3) && (j === 1 || j === 2);
    if (lay) {
      // lanternim: vidro fosco aceso e a grelha de bronze em 5 × 5
      c.batch.add(ROOM, laylightMat(), geo("galeria-planeDown", () => new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2)), mat(cx, H - 0.03, cz, 0, w - 0.2, 1, d - 0.2));
      for (let k = 1; k < 5; k++) { bx(c.batch, ROOM, bronze(), mat(x0 + 0.1 + k * (w - 0.2) / 5, H - 0.06, cz, 0, 0.03, 0.03, d - 0.2)); bx(c.batch, ROOM, bronze(), mat(cx, H - 0.06, z0 + 0.1 + k * (d - 0.2) / 5, 0, w - 0.2, 0.03, 0.03)); }
      for (const [a, b2, sx, sz] of [[cx, z0 + 0.1, w - 0.2, 0.05], [cx, z1 - 0.1, w - 0.2, 0.05], [x0 + 0.1, cz, 0.05, d - 0.2], [x1 - 0.1, cz, 0.05, d - 0.2]] as [number, number, number, number][]) bx(c.batch, ROOM, bronze(), mat(a, H - 0.075, b2, 0, sx, 0.045, sz));
      continue;
    }
    c.batch.add(ROOM, pl, rose, mat(cx, H, cz));
    c.inst.add(ROOM, "galeria-bossaRoseta", SPH(10), gold, mat(cx, H - 0.085, cz, 0, 0.035));
    if ((i + j) % 3 === 0) {
      // difusor de climatização quadrado (anéis concêntricos)
      for (let r = 0; r < 3; r++) bx(c.batch, ROOM, plain("galeria-metalBranco", "#dcdad4", { metal: 0.3, rough: 0.5 }), mat(cx + w * 0.28, H - 0.02 - r * 0.012, cz, 0, 0.5 - r * 0.14, 0.012, 0.5 - r * 0.14));
    } else if ((i + j) % 3 === 1) {
      // detector de fumaça com o LED de vigília
      c.batch.add(ROOM, plain("galeria-plastico", "#e8e6e0", { rough: 0.5 }), CYL0(20), mat(cx - w * 0.28, H - 0.04, cz, 0, 0.065, 0.04, 0.065));
      c.inst.add(ROOM, "galeria-ledVermelho", SPH(6), lit("galeria-ledVermelhoLuz", "#ff2a2a", 2.4), mat(cx - w * 0.28 + 0.03, H - 0.042, cz, 0, 0.005));
    }
  }
  spots(c);
}

/** Spots de museu nos trilhos: suporte (adaptador, haste, garfo), corpo com aletas mirando o alvo, lente acesa. */
interface Spot { x: number; z: number; t: [number, number, number]; cone?: number }
const SPOTS: Spot[] = [
  // Aurora (quatro, dois de frente e dois de trás)
  { x: -1.2, z: -14.25, t: [0, 1.5, -17], cone: 0.5 }, { x: 1.2, z: -14.25, t: [0, 1.5, -17], cone: 0.5 }, { x: -1.0, z: -18.125, t: [0, 1.6, -16.6] }, { x: 1.0, z: -18.125, t: [0, 1.6, -16.6] },
  // coluna de veludo e tule carmim
  { x: -6.0, z: -10.375, t: [-6.5, 1.3, -14.5], cone: 0.45 }, { x: -7.0, z: -18.125, t: [-6.5, 1.4, -14.5] }, { x: 6.0, z: -10.375, t: [6.5, 1.3, -14.5], cone: 0.45 }, { x: 7.0, z: -18.125, t: [6.5, 1.4, -14.5] },
  // vitrines de parede
  { x: -9.8, z: -18.125, t: [-11, 1.5, -19] }, { x: 9.8, z: -18.125, t: [11, 1.5, -19] }, { x: -9.8, z: -10.375, t: [-11, 1.5, -10] }, { x: 9.8, z: -10.375, t: [11, 1.5, -10] },
  // estátuas, vestidos-escultura, vitrine de joia, mesa de croquis
  { x: -3.5, z: -18.125, t: [-3.5, 1.9, -20.5], cone: 0.4 }, { x: 3.5, z: -18.125, t: [3.5, 1.9, -20.5], cone: 0.4 }, { x: -9.0, z: -10.375, t: [-9, 1.3, -7.6] }, { x: 9.0, z: -10.375, t: [9, 1.3, -7.6] },
  { x: -5.6, z: -18.125, t: [-6.5, 1.3, -19] }, { x: 6.4, z: -14.25, t: [6.5, 0.85, -10] },
  // textos e quadros (lavagem de parede)
  { x: -10.0, z: -18.125, t: [-9.9, 2.6, -22] }, { x: -6.0, z: -18.125, t: [-6, 1.8, -22] }, { x: 6.0, z: -18.125, t: [6, 2.6, -22] }, { x: 9.9, z: -18.125, t: [9.9, 2.6, -22] },
  { x: 6.0, z: -10.375, t: [6, 2.6, -6.5] }, { x: -6.0, z: -10.375, t: [-6, 2.6, -6.5] }, { x: -10.6, z: -14.25, t: [-12, 1.8, -12.25] }, { x: 10.6, z: -14.25, t: [12, 1.8, -12.25] },
];
function spots(c: RoomsCtx) {
  const yoke = geo("galeria-spotSuporte", () => {
    const parts = [new THREE.BoxGeometry(0.045, 0.04, 0.09).translate(0, -0.02, 0), new THREE.CylinderGeometry(0.008, 0.008, 0.07, 8).translate(0, -0.075, 0), new THREE.BoxGeometry(0.12, 0.012, 0.022).translate(0, -0.11, 0),
      new THREE.BoxGeometry(0.008, 0.07, 0.022).translate(-0.056, -0.145, 0), new THREE.BoxGeometry(0.008, 0.07, 0.022).translate(0.056, -0.145, 0)];
    return mergeParts(parts);
  });
  const body = geo("galeria-spotCorpo", () => {
    const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.044, 0.04, 0.17, 18).rotateX(Math.PI / 2), new THREE.CylinderGeometry(0.048, 0.048, 0.02, 18).rotateX(Math.PI / 2).translate(0, 0, -0.08)];
    for (let k = 0; k < 4; k++) parts.push(new THREE.TorusGeometry(0.045, 0.005, 4, 18).translate(0, 0, 0.02 + k * 0.016));
    return mergeParts(parts);
  });
  const lens = geo("galeria-spotLente", () => new THREE.CircleGeometry(0.034, 18).rotateY(Math.PI).translate(0, 0, -0.091));
  const K = blackSteel(), glowM = lit("galeria-lenteSpot", "#fff4dc", 3.2), UP = new THREE.Vector3(0, 1, 0);
  for (const s of SPOTS) {
    const pivot = new THREE.Vector3(s.x, 5.062 - 0.145, s.z), tgt = new THREE.Vector3(...s.t), d = tgt.clone().sub(pivot);
    c.inst.add(ROOM, "galeria-spotSuporte", yoke, K, mat(s.x, 5.062, s.z, Math.atan2(-d.x, -d.z)));
    const m = new THREE.Matrix4().lookAt(pivot, tgt, UP).setPosition(pivot);
    c.inst.add(ROOM, "galeria-spotCorpo", body, K, m);
    c.inst.add(ROOM, "galeria-spotLente", lens, glowM, m);
    if (s.cone) lightCone(c, ROOM, pivot.clone().add(d.clone().normalize().multiplyScalar(0.1)), tgt, s.cone, "#fff1dc", 0.06);
  }
}
function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [];
  for (const p of parts) { const g = p.index ? p.toNonIndexed() : p; g.computeVertexNormals(); pos.push(...(g.getAttribute("position").array as Float32Array)); nor.push(...(g.getAttribute("normal").array as Float32Array)); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2)); return g;
}
