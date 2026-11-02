/*
 * MET Gala Heist v2 — Vestíbulo: o piso. Campo de granito polido em losangos (preto absoluto e branco salpicado, placas de
 * 60 cm na diagonal), faixa de borda junto às paredes (granito negro, filetes de mármore branco e de latão e a grega em
 * mármore), a rosácea embutida no centro (Ø 3,2 m: estrela de 16 pontas em mármores de quatro cores, meio a meio para
 * parecer em relevo, coroa de pedras alternadas, filetes de latão e o "V" do Museu Vesper), soleiras de mármore nas três
 * portas e os dois trechos do tapete vermelho (da rua à rosácea e da rosácea ao salão) com debrum e varões de latão.
 * O granito do campo está em vestibulo-granite.ts e os desenhos (faixa, rosácea, tapete) em vestibulo-floor-tex.ts;
 * aqui ficam as medidas, o material dos embutidos e a montagem.
 */
import * as THREE from "three";
import { BOX0, CYL, mat } from "../interior-batch";
import type { RoomsCtx } from "./kit";
import { ROOM, VM, X0, X1, Z0, Z1, hash2, vGeo, vMat, type VSurface } from "./vestibulo-kit";
import { bandSurface, carpetTexture, rosetteSurface } from "./vestibulo-floor-tex";

export { floorMaterial, graniteFieldSurface } from "./vestibulo-granite";
export { drawnSurface } from "./vestibulo-floor-tex";

/** Centro e raio da rosácea (sob o lustre, no meio da sala). */
export const ROSE = { x: 0, z: 19.25, r: 1.6 };
/** Largura da faixa de borda e o comprimento de uma repetição da grega. */
const BAND_W = 0.78, BAND_L = 1.56;
/** Metros por repetição do campo de losangos (placa de 60 cm na diagonal). */
export const FIELD_TILE: [number, number] = [0.8485, 0.8485];

/** Material de piso desenhado (cor, relevo, rugosidade/metal) com reflexo planar no "high". */
function inlayMaterial(key: string, sf: VSurface & { rm: THREE.Texture }): THREE.MeshStandardMaterial {
  return vMat(key, () => {
    const m = new THREE.MeshStandardMaterial({ map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.rm, metalnessMap: sf.rm, roughness: 1, metalness: 1, normalScale: new THREE.Vector2(0.7, 0.7),
      envMapIntensity: 1.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    m.userData.mirror = [0.85, 0.05];
    return m;
  });
}

/* ======================= montagem ======================= */
/** Retângulo horizontal com uv dado nos quatro cantos (a, b = cantos opostos em x/z). */
function flat(x0: number, z0: number, x1: number, z1: number, y: number, uv: [number, number][]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv.flat(), 2)); g.setIndex([0, 1, 2, 0, 2, 3]); return g;
}

export function buildFloor(c: RoomsCtx) {
  const V = VM(c.q), q = c.q;
  /* faixa de borda (onde a escadaria não cobre) */
  const band = inlayMaterial(`band-${q}`, bandSurface(q)), y = 0.0015, f = 2 / 3;      // f: fração da textura que é a faixa
  const runs: { x0: number; z0: number; x1: number; z1: number; along: "x" | "z"; inward: 1 | -1 }[] = [
    { x0: -3.9, z0: Z0, x1: 3.9, z1: Z0 + BAND_W, along: "x", inward: 1 },                     // norte (sob a galeria)
    { x0: X0 + BAND_W, z0: Z1 - BAND_W, x1: X1 - BAND_W, z1: Z1, along: "x", inward: -1 },     // sul
    { x0: X0, z0: 17.9, x1: X0 + BAND_W, z1: Z1 - BAND_W, along: "z", inward: 1 },             // oeste
    { x0: X1 - BAND_W, z0: 17.9, x1: X1, z1: Z1 - BAND_W, along: "z", inward: -1 },            // leste
  ];
  for (const r of runs) {
    const len = r.along === "x" ? r.x1 - r.x0 : r.z1 - r.z0, u1 = (len / BAND_L) * f;
    // v = 0 na parede, 1 no lado de dentro; u ao longo (a faixa repete: a textura é 2/3 faixa + 1/3 canto, então o uv
    // ao longo usa só a fração da faixa por repetição — a borda direita da faixa casa com a esquerda)
    const segs = Math.ceil(len / BAND_L);
    for (let k = 0; k < segs; k++) {
      const a = k * BAND_L, b = Math.min(len, a + BAND_L), ua = 0, ub = ((b - a) / BAND_L) * f;
      if (r.along === "x") {
        const xa = r.x0 + a, xb = r.x0 + b, zw = r.inward > 0 ? r.z0 : r.z1, zi = r.inward > 0 ? r.z1 : r.z0;
        c.batch.add(ROOM, band, flat(xa, Math.min(zw, zi), xb, Math.max(zw, zi), y, r.inward > 0 ? [[ua, 1], [ub, 1], [ub, 0], [ua, 0]] : [[ua, 0], [ub, 0], [ub, 1], [ua, 1]]), undefined, { receive: true });
      } else {
        const za = r.z0 + a, zb = r.z0 + b, xw = r.inward > 0 ? r.x0 : r.x1, xi = r.inward > 0 ? r.x1 : r.x0;
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute([xw, y, za, xw, y, zb, xi, y, zb, xi, y, za], 3));
        g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute([ua, 0, ub, 0, ub, 1, ua, 1], 2));
        g.setIndex(r.inward > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
        c.batch.add(ROOM, band, g, undefined, { receive: true });
      }
    }
    void u1;
  }
  // quadrados dos cantos sul (os do norte ficam sob a escadaria)
  for (const x of [X0, X1 - BAND_W]) c.batch.add(ROOM, band, flat(x, Z1 - BAND_W, x + BAND_W, Z1, y, [[f, 0], [1, 0], [1, 1], [f, 1]]), undefined, { receive: true });

  /* rosácea */
  const rose = inlayMaterial(`rosette-${q}`, rosetteSurface(q));
  c.batch.add(ROOM, rose, vGeo("roseDisc", () => new THREE.CircleGeometry(ROSE.r, 128).rotateX(-Math.PI / 2)), mat(ROSE.x, 0.0025, ROSE.z), { receive: true });

  /* soleiras de mármore nas três portas (1,2 cm, com a aresta da frente boleada) */
  for (const [x0, z0, x1, z1] of [[-2.02, 14.0, 2.02, 14.5], [-2.02, 24.0, 2.02, 24.5], [-8.5, 19.98, -8.0, 22.52]] as [number, number, number, number][]) {
    c.batch.add(ROOM, V.carrara, BOX0(), mat((x0 + x1) / 2, 0, (z0 + z1) / 2, 0, x1 - x0, 0.012, z1 - z0), { receive: true });
  }

  /* tapete vermelho: da rua até a rosácea e da rosácea até a porta do salão */
  const carpet = carpetTexture(q), cm = vMat(`carpetMat-${q}`, () => new THREE.MeshPhysicalMaterial({ map: carpet.map, normalMap: carpet.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95,
    sheen: 1, sheenColor: new THREE.Color("#ff6070"), sheenRoughness: 0.4, envMapIntensity: 0.5 }));
  const W = 2.6, T = 0.013;
  for (const [za, zb] of [[ROSE.z + ROSE.r - 0.38, 24.48], [14.3, ROSE.z - ROSE.r + 0.38]] as [number, number][]) {
    const L = zb - za, mid = (za + zb) / 2;
    // corpo com uv: u atravessado (0…1 = 2,6 m), v ao longo (1 repetição = 1,3 m)
    const g = new THREE.BoxGeometry(W, T, L, 1, 1, 1).translate(0, T / 2, 0), uv = g.getAttribute("uv") as THREE.BufferAttribute, pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / W + 0.5, pos.getZ(i) / 1.3);
    c.batch.add(ROOM, cm, g, mat(0, 0.001, mid), { receive: true });
    // debrum: fita de gorgorão dourado-escuro nas bordas compridas, um pouco mais alta
    for (const s of [-1, 1]) c.batch.add(ROOM, V.brassAged, BOX0(), mat(s * (W / 2 - 0.02), 0.001, mid, 0, 0.045, T + 0.003, L), { receive: true });
    // varões de latão nas pontas, presos por dois suportes
    for (const z of [za + 0.04, zb - 0.04]) {
      if (z > 24.3) continue;                                                    // a ponta da rua passa sob a porta
      c.batch.add(ROOM, V.brass, CYL(12), mat(0, 0.014, z, 0, 0.011, W + 0.12, 0.011, 0, Math.PI / 2));
      for (const s of [-1, 1]) {
        c.batch.add(ROOM, V.brass, vGeo("rodFinial", () => new THREE.SphereGeometry(0.022, 12, 8)), mat(s * (W / 2 + 0.07), 0.016, z));
        c.batch.add(ROOM, V.brass, BOX0(), mat(s * (W / 2 + 0.035), 0, z, 0, 0.03, 0.02, 0.03));
      }
    }
  }
  void hash2;
}
