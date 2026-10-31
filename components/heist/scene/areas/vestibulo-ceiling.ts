/*
 * MET Gala Heist v2 — Vestíbulo: o teto e o lustre. Caixotões profundos (9 × 5, vigas de 24 cm que descem 30 cm, dois
 * degraus de moldura em cada caixotão, fundo pintado com coroa de louros, rosácea dourada no centro e florões nos
 * cruzamentos); o bloco central de 3 × 3 vira o medalhão redondo (Ø 4,6 m, anéis em degrau com óvalos dourados e a
 * grande rosácea de onde desce o lustre). O lustre de cristal: canopla, corrente de elos, coroa, haste com taça de
 * cristal lapidado, 12 braços em voluta embaixo e 8 em cima, mangas de vela com chama, festões de contas e pingentes.
 */
import * as THREE from "three";
import { BOX0, CYL0, SPH, mat } from "../interior-batch";
import type { RoomsCtx } from "./kit";
import { A } from "./kit";
import { ROOM, VH, VM, X0, X1, Z0, Z1, frameGeo, lathe, vGeo, vMat, vTex, type VPalette } from "./vestibulo-kit";

/** Campo dos caixotões (dentro da cimalha, que avança 0,43 m) e a grade. */
const F = { x0: X0 + 0.43, x1: X1 - 0.43, z0: Z0 + 0.43, z1: Z1 - 0.43, nx: 9, nz: 5, beam: 0.24, drop: 0.3 };
/** Centro do lustre e do medalhão. */
export const CHANDELIER = { x: 0, z: (Z0 + Z1) / 2, y: 4.35 };
const MED_R = 2.3;

function cofferTexture(): THREE.Texture {
  return vTex("cofferBack", 512, 512, (g, w, h) => {
    g.fillStyle = "#e6d9bf"; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${150 + (k % 40)},${130 + (k % 30)},${100 + (k % 20)},0.035)`; g.beginPath(); g.arc((k * 97) % w, (k * 61) % h, 6 + (k % 9), 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = "#7d8f86"; g.lineWidth = 10; g.strokeRect(34, 34, w - 68, h - 68);
    g.strokeStyle = "#b28a45"; g.lineWidth = 3; g.strokeRect(52, 52, w - 104, h - 104);
    // coroa de louros pintada em volta da rosácea
    g.strokeStyle = "#6f7f62"; g.fillStyle = "#7d8e6d"; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2, w * 0.27, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2, x = w / 2 + Math.cos(a) * w * 0.27, y = h / 2 + Math.sin(a) * w * 0.27;
      for (const s of [-1, 1]) { g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2 + s * 0.55); g.beginPath(); g.ellipse(0, -10, 5, 12, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    }
  });
}
/** Rosácea dourada em relevo (pétalas em duas fileiras e o botão). */
function rosetteGeo(r: number): THREE.BufferGeometry {
  return vGeo(`ceilRosette${r}`, () => {
    const s = new THREE.Shape();
    for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2, rr = r * (0.78 + 0.22 * Math.abs(Math.cos(a * 4))); if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    const g = new THREE.ExtrudeGeometry(s, { depth: r * 0.12, bevelEnabled: true, bevelSize: r * 0.08, bevelThickness: r * 0.1, bevelSegments: 2, curveSegments: 8 });
    const bud = new THREE.SphereGeometry(r * 0.32, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(0, 0, r * 0.2);
    const out = [g.toNonIndexed(), bud.toNonIndexed()].map((x) => { const y = new THREE.BufferGeometry(); y.setAttribute("position", x.getAttribute("position")); y.setAttribute("normal", x.getAttribute("normal")); y.setAttribute("uv", x.getAttribute("uv")); return y; });
    const m = new THREE.BufferGeometry(), n = out.reduce((a, b) => a + b.getAttribute("position").count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0; for (const x of out) { pos.set(x.getAttribute("position").array as Float32Array, o * 3); nor.set(x.getAttribute("normal").array as Float32Array, o * 3); uv.set(x.getAttribute("uv").array as Float32Array, o * 2); o += x.getAttribute("position").count; }
    m.setAttribute("position", new THREE.BufferAttribute(pos, 3)); m.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); m.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    m.rotateX(Math.PI / 2);                                                       // de frente para baixo
    return m;
  });
}

export function buildCeiling(c: RoomsCtx) {
  const V = VM(c.q), top = VH;
  const px = (F.x1 - F.x0) / F.nx, pz = (F.z1 - F.z0) / F.nz, ow = px - F.beam, od = pz - F.beam;
  const inMed = (i: number, j: number) => i >= 3 && i <= 5 && j >= 1 && j <= 3;
  /* teto de fundo (gesso) com o furo do medalhão */
  const base = vGeo("ceilBase", () => {
    const s = new THREE.Shape(); s.moveTo(X0, Z0); s.lineTo(X1, Z0); s.lineTo(X1, Z1); s.lineTo(X0, Z1); s.closePath();
    const h = new THREE.Path(); h.absarc(CHANDELIER.x, CHANDELIER.z, MED_R, 0, Math.PI * 2, true); s.holes.push(h);
    return new THREE.ShapeGeometry(s, 48).rotateX(Math.PI / 2);                 // (x, z) do desenho → plano y = 0 virado para baixo
  });
  c.batch.add(ROOM, V.plaster, base, mat(0, top, 0));
  /* fundo pintado de cada caixotão (fora do medalhão) e os dois degraus de moldura */
  const back = vMat("cofferBackMat", () => new THREE.MeshStandardMaterial({ map: cofferTexture(), roughness: 0.85, envMapIntensity: 0.5 }));
  const step1 = frameGeo("cofStep1", ow, od, 0.08, 0.1, 0.012), step2 = frameGeo("cofStep2", ow - 0.16, od - 0.16, 0.06, 0.08, 0.01);
  for (let i = 0; i < F.nx; i++) for (let j = 0; j < F.nz; j++) {
    if (inMed(i, j)) continue;
    const x = F.x0 + (i + 0.5) * px, z = F.z0 + (j + 0.5) * pz;
    c.inst.add(ROOM, "vestibulo-cofferBack", vGeo("cofBackPlane", () => new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2)), back, mat(x, top - 0.002, z, 0, ow - 0.3, 1, od - 0.3));
    // os degraus descem do ponto de colocação (giro de +90° em x: a face chanfrada fica para baixo)
    c.inst.add(ROOM, "vestibulo-cofStep1", step1, V.plaster, mat(x, top - F.drop + 0.1, z, 0, 1, 1, 1, Math.PI / 2));
    c.inst.add(ROOM, "vestibulo-cofStep1g", frameGeo("cofStep1g", ow - 0.16, od - 0.16, 0.012, 0.11, 0.003), V.gilt, mat(x, top - F.drop + 0.105, z, 0, 1, 1, 1, Math.PI / 2));
    c.inst.add(ROOM, "vestibulo-cofStep2", step2, V.plasterShade, mat(x, top - F.drop + 0.18, z, 0, 1, 1, 1, Math.PI / 2));
    c.inst.add(ROOM, "vestibulo-cofRose", rosetteGeo(0.17), V.gilt, mat(x, top - 0.01, z));
  }
  /* vigas (as que cruzam o medalhão param na borda dele) com filetes dourados e florões nos cruzamentos */
  const beamX = (x: number, z0: number, z1: number) => { c.batch.add(ROOM, V.plaster, BOX0(), mat(x, top - F.drop, (z0 + z1) / 2, 0, F.beam, F.drop, z1 - z0), { cast: true }); for (const s of [-1, 1]) c.batch.add(ROOM, V.gilt, BOX0(), mat(x + s * (F.beam / 2 - 0.025), top - F.drop - 0.006, (z0 + z1) / 2, 0, 0.018, 0.008, z1 - z0)); };
  const beamZ = (z: number, x0: number, x1: number) => { c.batch.add(ROOM, V.plaster, BOX0(), mat((x0 + x1) / 2, top - F.drop, z, 0, x1 - x0, F.drop, F.beam), { cast: true }); for (const s of [-1, 1]) c.batch.add(ROOM, V.gilt, BOX0(), mat((x0 + x1) / 2, top - F.drop - 0.006, z + s * (F.beam / 2 - 0.025), 0, x1 - x0, 0.008, 0.018)); };
  for (let i = 0; i <= F.nx; i++) {
    const x = F.x0 + i * px;
    if (i >= 4 && i <= 5) { beamX(x, F.z0, F.z0 + pz); beamX(x, F.z1 - pz, F.z1); } else beamX(x, F.z0, F.z1);
  }
  for (let j = 0; j <= F.nz; j++) {
    const z = F.z0 + j * pz;
    if (j >= 2 && j <= 3) { beamZ(z, F.x0, F.x0 + 3 * px); beamZ(z, F.x1 - 3 * px, F.x1); } else beamZ(z, F.x0, F.x1);
  }
  for (let i = 0; i <= F.nx; i++) for (let j = 0; j <= F.nz; j++) {
    const x = F.x0 + i * px, z = F.z0 + j * pz;
    if (Math.hypot(x - CHANDELIER.x, z - CHANDELIER.z) < MED_R + 0.1) continue;
    c.inst.add(ROOM, "vestibulo-beamBoss", rosetteGeo(0.1), V.giltBright, mat(x, top - F.drop - 0.012, z));
  }
  /* o medalhão: anéis em degrau subindo até a cúpula rasa, óvalos dourados e a rosácea grande do lustre */
  const prof: [number, number][] = [[MED_R + 0.02, -F.drop], [MED_R, -F.drop], [MED_R, -0.18], [MED_R - 0.12, -0.18], [MED_R - 0.12, -0.05], [MED_R - 0.3, 0.02], [MED_R - 0.3, 0.12], [MED_R - 0.45, 0.14], [1.4, 0.26], [0.9, 0.34], [0.4, 0.38], [0, 0.39]];
  const ring = vGeo("medRing", () => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)).reverse(), 72));
  c.batch.add(ROOM, V.plaster, ring, mat(CHANDELIER.x, top, CHANDELIER.z));
  for (const [r, y] of [[MED_R - 0.01, -0.2], [MED_R - 0.13, -0.06], [MED_R - 0.31, 0.11]] as [number, number][]) c.batch.add(ROOM, V.gilt, vGeo(`medGilt${r}`, () => new THREE.TorusGeometry(r, 0.018, 6, 72).rotateX(Math.PI / 2)), mat(CHANDELIER.x, top + y, CHANDELIER.z));
  const ovals = 48;
  for (let k = 0; k < ovals; k++) { const a = (k / ovals) * Math.PI * 2, r = MED_R - 0.06; c.inst.add(ROOM, "vestibulo-medOval", vGeo("medOvalGeo", () => new THREE.SphereGeometry(1, 10, 6).scale(0.035, 0.05, 0.022)), V.gilt, mat(CHANDELIER.x + Math.cos(a) * r, top - 0.12, CHANDELIER.z + Math.sin(a) * r, -a)); }
  c.batch.add(ROOM, V.gilt, rosetteGeo(0.55), mat(CHANDELIER.x, top + 0.37, CHANDELIER.z));
  // cantos do bloco central: quartos de florão nos encontros com a grade
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.inst.add(ROOM, "vestibulo-medCorner", rosetteGeo(0.22), V.gilt, mat(CHANDELIER.x + sx * 1.95, top - 0.01, CHANDELIER.z + sz * 1.95));
  /* o lustre */
  chandelier(c, V);
}

/** Lustre de cristal (Ø 1,9 m): da rosácea do medalhão (6,89 m) até a bola de cristal (~3,4 m). */
function chandelier(c: RoomsCtx, V: VPalette) {
  const { x, z } = CHANDELIER, y = CHANDELIER.y, hi = c.q === "high";
  const cross = new THREE.Vector3();
  // canopla e corrente de elos alternados até a coroa
  c.batch.add(ROOM, V.gilt, lathe("chCanopy", [[0, 0], [0.22, 0], [0.2, -0.06], [0.1, -0.14], [0.03, -0.18], [0, -0.18]], 24), mat(x, VH + 0.36, z));
  const link = vGeo("chLink", () => new THREE.TorusGeometry(0.04, 0.009, 6, 14).scale(1, 1.6, 1));
  const chainTop = VH + 0.18, chainBot = y + 1.42;
  for (let k = 0, yy = chainTop - 0.06; yy > chainBot; k++, yy -= 0.1) c.inst.add(ROOM, "vestibulo-chLink", link, V.gilt, mat(x, yy, z, k % 2 ? Math.PI / 2 : 0));
  // coroa: anel, folhas de acanto e pontas
  c.batch.add(ROOM, V.gilt, vGeo("chCrownRing", () => new THREE.TorusGeometry(0.34, 0.02, 8, 48).rotateX(Math.PI / 2)), mat(x, y + 1.35, z));
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; c.inst.add(ROOM, "vestibulo-chSpire", vGeo("chSpireGeo", () => new THREE.ConeGeometry(0.025, 0.16, 8).translate(0, 0.08, 0)), V.giltBright, mat(x + Math.cos(a) * 0.34, y + 1.36, z + Math.sin(a) * 0.34)); }
  // haste: balaústre dourado com a taça de cristal lapidado e a bacia de baixo
  c.batch.add(ROOM, V.gilt, lathe("chStem", [[0.03, 1.36], [0.05, 1.3], [0.035, 1.18], [0.06, 1.08], [0.04, 0.96], [0.07, 0.7], [0.05, 0.55], [0.09, 0.45], [0.16, 0.28], [0.2, 0.2], [0.12, 0.06], [0.05, 0.0], [0, -0.02]], 24), mat(x, y, z));
  c.batch.add(ROOM, V.crystal, lathe("chCut", [[0.02, 0.62], [0.14, 0.68], [0.17, 0.78], [0.12, 0.88], [0.04, 0.92]], 12), mat(x, y, z));
  c.batch.add(ROOM, V.crystal, vGeo("chBall", () => new THREE.IcosahedronGeometry(0.09, 1)), mat(x, y - 0.35, z));
  c.batch.add(ROOM, V.gilt, CYL0(8), mat(x, y - 0.27, z, 0, 0.006, 0.27, 0.006));
  // braços em voluta (12 embaixo, 8 em cima): bobeche, manga de vela, chama, pingentes
  const armGeo = (rr: number, hh: number) => vGeo(`chArm${rr}-${hh}`, () => new THREE.TubeGeometry(new THREE.CubicBezierCurve3(new THREE.Vector3(0.12, 0.25, 0), new THREE.Vector3(rr * 0.55, -0.12, 0), new THREE.Vector3(rr * 1.05, -0.05, 0), new THREE.Vector3(rr, hh, 0)), 20, 0.014, 8, false));
  const tips: THREE.Vector3[] = [];
  for (const [n, rr, hh, y0, s] of [[12, 0.92, 0.12, 0.18, 1], [8, 0.55, 0.14, 0.7, 0.85]] as [number, number, number, number, number][]) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + (s < 1 ? Math.PI / n : 0), ca = Math.cos(a), sa = Math.sin(a);
      c.batch.add(ROOM, V.gilt, armGeo(rr, hh), mat(x, y + y0, z, -a, s, s, s));
      const tx = x + ca * rr * s, tz = z + sa * rr * s, ty = y + y0 + hh * s;
      c.inst.add(ROOM, "vestibulo-chBobeche", lathe("chBobecheGeo", [[0, 0], [0.06, 0.008], [0.07, 0.02], [0.03, 0.025], [0, 0.025]], 16), V.gilt, mat(tx, ty, tz));
      c.inst.add(ROOM, "vestibulo-chSleeve", CYL0(10), V.paper, mat(tx, ty + 0.02, tz, 0, 0.018, 0.16, 0.018));
      c.inst.add(ROOM, "vestibulo-chFlame", vGeo("chFlameGeo", () => new THREE.SphereGeometry(1, 10, 8).scale(0.6, 1.5, 0.6)), V.flameBulb, mat(tx, ty + 0.21, tz, 0, 0.026));
      tips.push(new THREE.Vector3(tx, ty - 0.005, tz));
      for (let d = 0; d < (hi ? 4 : 2); d++) { const b = a + (d / 4) * Math.PI * 2; c.inst.add(ROOM, "vestibulo-chDrop", vGeo("chDropGeo", () => new THREE.OctahedronGeometry(1, 0).scale(0.5, 1.6, 0.5)), V.crystal, mat(tx + Math.cos(b) * 0.06, ty - 0.05, tz + Math.sin(b) * 0.06, b, 0.018)); }
    }
  }
  // festões de contas entre as pontas dos braços de baixo e pingentes em prisma na bacia
  const bead = vGeo("chBeadGeo", () => new THREE.OctahedronGeometry(1, 0)), lower = tips.slice(0, 12), nb = hi ? 16 : 9;
  for (let k = 0; k < lower.length; k++) {
    const a = lower[k], b = lower[(k + 1) % lower.length];
    for (let i = 1; i < nb; i++) { const t = i / nb; cross.lerpVectors(a, b, t); cross.y -= Math.sin(Math.PI * t) * 0.16; c.inst.add(ROOM, "vestibulo-chBead", bead, V.crystal, mat(cross.x, cross.y, cross.z, t * 3, 0.013)); }
    // e um cordão da ponta até a haste (o "véu")
    for (let i = 1; i < (hi ? 10 : 6); i++) { const t = i / (hi ? 10 : 6), hx = x, hz = z, hy = y + 0.25; cross.set(a.x + (hx - a.x) * t, a.y + (hy - a.y) * t - Math.sin(Math.PI * t) * 0.1, a.z + (hz - a.z) * t); c.inst.add(ROOM, "vestibulo-chBead", bead, V.crystal, mat(cross.x, cross.y, cross.z, t * 2, 0.011)); }
  }
  for (let k = 0; k < (hi ? 24 : 12); k++) { const a = (k / (hi ? 24 : 12)) * Math.PI * 2; c.inst.add(ROOM, "vestibulo-chPrism", vGeo("chPrismGeo", () => new THREE.CylinderGeometry(0.012, 0.0, 0.2, 5).translate(0, -0.1, 0)), V.crystal, mat(x + Math.cos(a) * 0.19, y + 0.19, z + Math.sin(a) * 0.19, a)); }
  // luz do lustre: forte e quente (a sala inteira), mais um brilho baixo para o piso polido
  A(c, ROOM, x, y + 0.45, z, "#ffd9a6", 34, 13);
  A(c, ROOM, x, y - 0.4, z, "#ffcf98", 8, 6);
  void SPH; void F;
}
