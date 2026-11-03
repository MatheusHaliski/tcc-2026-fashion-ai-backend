/*
 * MET Gala Heist v2 — o Grande Salão como o hall neoclássico de um museu de avenida em noite de gala: três cúpulas rasas
 * com caixotões e óculo iluminado sobre a nave, colunata com entablamento, arcos sobre pilares nas quatro paredes (com
 * leques de vidro sobre as portas e lavagem de luz rosa por dentro), galeria contínua no segundo nível com balaustrada,
 * janelas em arco no alto, estandartes da Gala Lumière, castiçais dourados, arandelas e dois lustres de cristal.
 *
 * No centro, a instalação floral da gala: o balcão redondo coberto de rosas e, sobre ele, uma coroa de rosas de quase
 * sete metros (nervuras floridas que se abrem e se fecham num remate dourado), fios de pérolas, castiçais acesos sobre
 * as rosas e pétalas caídas no terrazzo. Tudo instanciado: ~1 000 rosas num punhado de chamadas de desenho.
 *
 * Aqui fica a montagem do salão (buildHall); os arcos (interior-hall-arches), a rosa, o castiçal e o lustre
 * (interior-hall-ornaments), os estandartes, o cartaz e os caixotões (interior-hall-textures) e a instalação floral
 * (interior-hall-floral) ficam nos arquivos ao lado.
 */
import * as THREE from "three";
import { Batch, BOX0, CYL, CYL0, Instances, geo, mat, mul } from "./interior-batch";
import { M, fabric, glow } from "./interior-mats";
import type { Quality } from "./interior-tex";
import type { InteriorCopy } from "./interior-copy";
import { ARCHES, PILASTERS, archDrapeMaterial, archFillGeo, archFrameGeo, fanlightTexture, pleatedArchGeo } from "./interior-hall-arches";
import { candelabra, chandelier } from "./interior-hall-ornaments";
import { bannerTexture, domeTexture, posterTexture } from "./interior-hall-textures";

export { candelabra, chandelier, roseGeometry } from "./interior-hall-ornaments";
export { buildFloral } from "./interior-hall-floral";

export type WallSide = "N" | "S" | "W" | "E";
/** Matriz de um ponto na parede do salão: s ao longo da parede (x no norte/sul, z no leste/oeste), y, afastado `off` da face. */
export function hallWall(w: WallSide, s: number, y: number, off = 0): THREE.Matrix4 {
  switch (w) {
    case "N": return mat(s, y, -6 + off, 0);
    case "S": return mat(s, y, 14 - off, Math.PI);
    case "W": return mat(-12 + off, y, s, Math.PI / 2);
    case "E": return mat(12 - off, y, s, -Math.PI / 2);
  }
}
export const HALL_H = 9.5, BALC_Y = 5.0;
const BALC_T = 0.4, BALC_D = 1.2;
export const DOMES: { x: number; z: number; r: number; rise: number }[] = [{ x: -8.25, z: 4.5, r: 3, rise: 1.4 }, { x: 0, z: 4.5, r: 4, rise: 1.8 }, { x: 8.25, z: 4.5, r: 3, rise: 1.4 }];


export interface HallOut { flames: THREE.Vector3[]; chandeliers: THREE.Vector3[]; screen?: THREE.Mesh }

/** Arquitetura e decoração do Grande Salão (o que não tem colisão). Os móveis (colunas, mesas, palcos) vêm de interior-props. */
export function buildHall(q: Quality, copy: InteriorCopy, batch: Batch, inst: Instances, group: THREE.Group): HallOut {
  const P = M(q), room = "salao", flames: THREE.Vector3[] = [], chandeliers: THREE.Vector3[] = [];
  const stone = P.limestone, trim = P.stone;

  /* teto plano com caixotões, recortado nas cúpulas */
  const inDome = (x: number, z: number, pad: number) => DOMES.some((d) => Math.hypot(x - d.x, z - d.z) < d.r + pad);
  {
    const pos: number[] = [], uv: number[] = [];
    for (let z = -6; z < 14 - 1e-6; z += 0.5) {
      let start: number | null = null;
      for (let x = -12; x <= 12 + 1e-6; x += 0.5) {
        const keep = x < 12 - 1e-6 && !inDome(x + 0.25, z + 0.25, -0.05);
        if (keep && start === null) start = x;
        if (!keep && start !== null) { const x0 = start, x1 = x, z0 = z, z1 = z + 0.5; pos.push(x0, HALL_H, z0, x1, HALL_H, z0, x1, HALL_H, z1, x0, HALL_H, z0, x1, HALL_H, z1, x0, HALL_H, z1); for (const [a, b] of [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]]) uv.push(a / 2, b / 2); start = null; }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    batch.add(room, P.plasterPlain, g, undefined, { cast: true });
    // vigas dos caixotões a cada 2 m (fora das cúpulas)
    for (let x = -12; x <= 12; x += 2) for (let z = -6; z < 14; z += 2) {
      if (x > -12 && x < 12 && !inDome(x, z + 1, 0.6)) batch.add(room, P.plasterPlain, BOX0(), mat(x, HALL_H - 0.32, z + 1, 0, 0.26, 0.32, 2));
      if (z > -6 && !inDome(x + 1, z, 0.6) && x < 12) batch.add(room, P.plasterPlain, BOX0(), mat(x + 1, HALL_H - 0.32, z, 0, 2, 0.32, 0.26));
    }
  }
  /* cúpulas: calota rasa com caixotões, anel de moldura, sanca iluminada e o óculo */
  const domeMat = new THREE.MeshStandardMaterial({ map: domeTexture(), roughness: 0.85, side: THREE.BackSide, envMapIntensity: 0.6 });
  for (const d of DOMES) {
    const R = (d.r * d.r + d.rise * d.rise) / (2 * d.rise), th = Math.asin(d.r / R);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 10, 0, Math.PI * 2, 0, th), domeMat);
    cap.position.set(d.x, HALL_H + d.rise - R, d.z); cap.name = "dome"; group.add(cap);
    batch.add(room, trim, geo(`domeRing${d.r}`, () => new THREE.TorusGeometry(d.r, 0.2, 8, 64).rotateX(Math.PI / 2)), mat(d.x, HALL_H - 0.12, d.z));
    batch.add(room, P.plasterPlain, geo(`domeAnnulus${d.r}`, () => new THREE.RingGeometry(d.r - 0.42, d.r + 0.55, 64, 1).rotateX(Math.PI / 2)), mat(d.x, HALL_H - 0.01, d.z));
    batch.add(room, P.gold, geo(`domeGold${d.r}`, () => new THREE.TorusGeometry(d.r - 0.28, 0.05, 6, 64).rotateX(Math.PI / 2)), mat(d.x, HALL_H - 0.2, d.z));
    batch.add(room, glow("cove", "#ffd7a0", 1.6), geo(`cove${d.r}`, () => new THREE.TorusGeometry(d.r + 0.05, 0.035, 6, 64).rotateX(Math.PI / 2)), mat(d.x, HALL_H - 0.33, d.z));
    batch.add(room, glow("oculusNight", "#6f8fd0", 1.15), geo(`oculus${d.r}`, () => new THREE.CircleGeometry(d.r * 0.2, 32).rotateX(Math.PI / 2)), mat(d.x, HALL_H + d.rise - 0.04, d.z));
  }
  /* galeria do segundo nível: laje, entablamento, balaustrada e luzes embutidas no forro */
  const bands: [number, number, number, number, WallSide][] = [[-12, -6, 12, -6 + BALC_D, "N"], [-12, 14 - BALC_D, 12, 14, "S"], [-12, -6 + BALC_D, -12 + BALC_D, 14 - BALC_D, "W"], [12 - BALC_D, -6 + BALC_D, 12, 14 - BALC_D, "E"]];
  const baluster = geo("baluster", () => new THREE.LatheGeometry([[0.05, 0], [0.05, 0.06], [0.035, 0.1], [0.06, 0.32], [0.03, 0.55], [0.045, 0.62], [0.045, 0.66]].map(([x, y]) => new THREE.Vector2(x, y)), 10));
  for (const [x0, z0, x1, z1, w] of bands) {
    batch.add(room, trim, BOX0(), mat((x0 + x1) / 2, BALC_Y, (z0 + z1) / 2, 0, x1 - x0, BALC_T, z1 - z0), { cast: true });
    // borda interna (entablamento) e balaústres ao longo dela
    const alongX = w === "N" || w === "S", edge = w === "N" ? z1 : w === "S" ? z0 : w === "W" ? x1 : x0, dir = w === "N" || w === "W" ? 1 : -1;
    const a0 = alongX ? -12 + BALC_D : -6 + BALC_D, a1 = alongX ? 12 - BALC_D : 14 - BALC_D, len = a1 - a0, mid = (a0 + a1) / 2;
    const at = (along: number, y: number, out: number, sx: number, sy: number, sz: number) => alongX ? mat(along, y, edge + dir * out, 0, sx, sy, sz) : mat(edge + dir * out, y, along, 0, sz, sy, sx);
    batch.add(room, trim, BOX0(), at(mid, BALC_Y - 0.35, 0.04, len + 0.1, 0.35, 0.12));              // arquitrave
    batch.add(room, P.gold, BOX0(), at(mid, BALC_Y - 0.12, 0.11, len + 0.1, 0.04, 0.03));
    batch.add(room, trim, BOX0(), at(mid, BALC_Y + BALC_T - 0.08, 0.1, len + 0.3, 0.14, 0.22));      // cornija
    batch.add(room, trim, BOX0(), at(mid, BALC_Y + BALC_T, -0.12, len, 0.12, 0.2));                  // rodapé da balaustrada
    batch.add(room, trim, BOX0(), at(mid, BALC_Y + BALC_T + 0.78, -0.12, len, 0.1, 0.24));           // corrimão
    for (let a = a0 + 0.15; a < a1; a += 0.3) inst.add(room, "baluster", baluster, trim, at(a, BALC_Y + BALC_T + 0.12, -0.12, 1, 1, 1));
    for (let a = a0 + 1; a < a1; a += 2) inst.add(room, "downlight", geo("dl", () => new THREE.CircleGeometry(0.07, 12).rotateX(Math.PI / 2)), P.bulbWarm, at(a, BALC_Y - 0.36, -0.6, 1, 1, 1));
  }
  /* colunata: entablamento sobre as colunas (z −1 e z 10), do muro ao muro */
  for (const z of [-1, 10]) {
    batch.add(room, trim, BOX0(), mat(0, BALC_Y, z, 0, 24, 0.75, 1.05), { cast: true });
    batch.add(room, P.gold, BOX0(), mat(0, BALC_Y + 0.2, z, 0, 24.02, 0.05, 1.08));
    batch.add(room, trim, BOX0(), mat(0, BALC_Y + 0.66, z, 0, 24.1, 0.16, 1.25));
  }
  /* arcos, tímpanos, lavagem de luz e pilastras */
  const fan = new THREE.MeshStandardMaterial({ map: fanlightTexture(), emissiveMap: fanlightTexture(), emissive: new THREE.Color("#ffb46a"), emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.2 });
  const drape = archDrapeMaterial();
  const niche = fabric("hallDrape", "#2a1240", q, { rough: 0.8, sheen: "#9a6ad8" });
  for (const a of ARCHES) {
    const base = hallWall(a.wall, a.s, 0, 0.005);
    batch.add(room, trim, archFrameGeo(a.r, a.spring, 0.32, 0.14), base, { cast: true });
    batch.add(room, P.gold, geo(`keystone`, () => new THREE.BoxGeometry(0.34, 0.5, 0.2)), mul(base, mat(0, a.spring + a.r + 0.12, 0.1)));
    if (a.door) batch.add(room, fan, archFillGeo(a.r, a.spring, a.door), mul(base, mat(0, 0, 0.012)));
    else if (a.panel) {
      // fundo de veludo e, na frente, a cortina pregueada que o refletor do pé ilumina (luz nas cristas, sombra nos vales)
      batch.add(room, niche, archFillGeo(a.r, a.spring, 0), mul(base, mat(0, 0, 0.01)));
      batch.add(room, drape, pleatedArchGeo(a.r - 0.03, a.spring, 0.09, 0.2), mul(base, mat(0, 0, 0.02)));
      inst.add(room, "uplight", BOX0(), P.ledAmber, mul(base, mat(0, 0, 0.25, 0, 0.5, 0.06, 0.12)));
    }
  }
  for (const [w, list] of Object.entries(PILASTERS) as [WallSide, number[]][]) for (const s of list) {
    const b = hallWall(w, s, 0, 0);
    batch.add(room, trim, BOX0(), mul(b, mat(0, 0, 0.07, 0, 0.72, BALC_Y - 0.35, 0.14)));
    batch.add(room, trim, BOX0(), mul(b, mat(0, 0, 0.1, 0, 0.86, 0.32, 0.2)));                       // base
    batch.add(room, P.gold, BOX0(), mul(b, mat(0, BALC_Y - 0.65, 0.12, 0, 0.84, 0.3, 0.16)));       // capitel
    // arandela de duas velas (a da pilastra atrás do painel do DJ fica escondida pelo veludo: não vai)
    if (w === "E" && s === 3.8) continue;
    batch.add(room, P.gold, BOX0(), mul(b, mat(0, 2.9, 0.2, 0, 0.06, 0.28, 0.16)));
    for (const dx of [-0.16, 0.16]) {
      batch.add(room, P.gold, CYL0(10), mul(b, mat(dx, 3.05, 0.3, 0, 0.04, 0.05, 0.04)));
      inst.add(room, "candle", CYL0(8), P.candle, mul(b, mat(dx, 3.1, 0.3, 0, 0.018, 0.18, 0.018)));
      inst.add(room, "sconceBulb", geo("flameGeo", () => new THREE.SphereGeometry(1, 6, 5).scale(0.5, 1.4, 0.5)), P.flame, mul(b, mat(dx, 3.32, 0.3, 0, 0.026)));
    }
  }
  /* nível de cima: janelas em arco (noite lá fora) sobre cada arco e a cornija do teto */
  for (const a of ARCHES) {
    const b = hallWall(a.wall, a.s, 0, 0.005), r = Math.min(1.5, a.r * 0.6);
    batch.add(room, P.windowNight, archFillGeo(r, 6.7, 6.0), mul(b, mat(0, 0, 0.01)));
    batch.add(room, trim, archFrameGeo(r, 6.7, 0.18, 0.1), mul(b, mat(0, 6.0, 0.005, 0, 1, 1, 1)));
  }
  for (const w of ["N", "S", "W", "E"] as WallSide[]) {
    const len = w === "N" || w === "S" ? 24 : 20, mid = w === "N" || w === "S" ? 0 : 4;
    batch.add(room, trim, BOX0(), mul(hallWall(w, mid, 0, 0), mat(0, HALL_H - 0.5, 0.1, 0, len, 0.18, 0.2)));
    batch.add(room, P.gold, BOX0(), mul(hallWall(w, mid, 0, 0), mat(0, HALL_H - 0.6, 0.1, 0, len, 0.04, 0.14)));
  }
  /* estandartes da gala no nível de cima (norte e sul) */
  const banA = new THREE.MeshStandardMaterial({ map: bannerTexture(copy, "a"), roughness: 0.75, side: THREE.DoubleSide });
  const banB = new THREE.MeshStandardMaterial({ map: bannerTexture(copy, "b"), roughness: 0.75, side: THREE.DoubleSide });
  const banGeo = geo("banner", () => new THREE.PlaneGeometry(2.1, 2.7, 1, 6));
  for (const [w, s, m] of [["N", -8, banA], ["N", 0, banB], ["N", 6.2, banA], ["S", -8, banB], ["S", 0, banA], ["S", 8, banB], ["W", 2.5, banB], ["E", -1, banA]] as [WallSide, number, THREE.Material][]) {
    batch.add(room, m, banGeo, mul(hallWall(w, s, 0, 0), mat(0, 7.95, 1.2 + 0.05, 0)));
    batch.add(room, P.gold, CYL(8), mul(hallWall(w, s, 0, 0), mat(0, 9.32, 1.25, 0, 0.025, 2.3, 0.025, 0, Math.PI / 2)));
  }
  /* o cartaz-pista na parede oeste (z 7), com moldura de latão e luz de quadro */
  {
    const b = hallWall("W", 7, 0, 0);
    batch.add(room, P.brass, BOX0(), mul(b, mat(0, 0.86, 0.03, 0, 1.36, 1.98, 0.05)));
    batch.add(room, new THREE.MeshStandardMaterial({ map: posterTexture(copy), roughness: 0.35, emissiveMap: posterTexture(copy), emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.18 }), PLANE_(), mul(b, mat(0, 1.85, 0.065, 0, 1.24, 1.86, 1)));
    batch.add(room, P.brass, BOX0(), mul(b, mat(0, 2.95, 0.16, 0, 0.5, 0.05, 0.2)));
    inst.add(room, "picLight", BOX0(), P.bulbWarm, mul(b, mat(0, 2.92, 0.24, 0, 0.42, 0.02, 0.05)));
  }
  /* lustres de cristal sob as cúpulas laterais */
  for (const d of [DOMES[0], DOMES[2]]) chandelier(room, d.x, 6.9, d.z, HALL_H + d.rise - 0.1, q, P, batch, inst, chandeliers);
  /* castiçais altos junto às pilastras (afastados 0,45 m da parede); os dos cantos sul, o do sofá e o do aparador saíram
   * (no lugar deles ficaram o aparador dos garçons, a mesa de doces e o vaso) */
  for (const [w, s] of [["N", -11.3], ["N", -4], ["S", -4], ["S", 4]] as [WallSide, number][]) {
    const b = mul(hallWall(w, s, 0, 0), mat(0, 0, 0.62));
    batch.add(room, P.gold, CYL0(12), mul(b, mat(0, 0, 0, 0, 0.16, 0.06, 0.16)));
    candelabra(room, b, 1.9, P, batch, inst, flames);
  }
  return { flames, chandeliers };
}
const PLANE_ = () => geo("plane", () => new THREE.PlaneGeometry(1, 1));
