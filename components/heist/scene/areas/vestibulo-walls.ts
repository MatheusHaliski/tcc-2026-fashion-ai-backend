/*
 * MET Gala Heist v2 — Vestíbulo: as paredes. Cantaria de calcário em fiadas de 60 cm com junta fina (a casca usa o
 * material daqui), lambri de mármore até 1,1 m (rodapé de nero, almofadas de Botticino emolduradas de nero, chapim de
 * Carrara), pilastras caneladas com pedestal e capitel dourado, a cimalha completa no alto (arquitrave, friso com filete
 * dourado, dentículos e cornija de 42 cm), os dois nichos da parede sul (fundo vermelho-pompeiano, luz rasante, estátua e
 * urna), o portal interno da porta da rua com a bandeira em leque acesa pela rua, placas de bronze, arandelas de bronze
 * com mangas de vela e cristais, e os cartazes da exposição em molduras douradas.
 */
import * as THREE from "three";
import { BOX0, CYL, CYL0, SPH, mat, mul } from "../interior-batch";
import { statueGeometry } from "../interior-dress";
import { roseGeometry } from "../interior-hall";
import type { Quality } from "../interior-tex";
import { type RoomsCtx, A, PLANE, exhibitPoster, washTexture } from "./kit";
import { ROOM, VH, VM, X0, X1, Z1, arcPts, archFrameGeo, fbm, frameGeo, hash2, lathe, mix, onWall, profileGeo, raisedPanel, smooth, vCopy, vGeo, vGlow, vMat, vSolid, vSurface, vTex, vnoise, type Side, type VPalette } from "./vestibulo-kit";

/* ======================= cantaria (material das paredes da casca) ======================= */
/** Blocos de 1,2 × 0,6 m em amarração (repetição de 2,4 × 1,2 m), junta de 3 mm, fósseis e poros, face apicoada fina. */
export function wallMaterial(q: Quality): THREE.MeshStandardMaterial {
  return vMat(`ashlar-${q}`, () => {
    const n = q === "high" ? 1024 : 512;
    const sf = vSurface(`ashlar${n}`, n, n / 2, (u, v, o) => {
      const rows = 2, row = Math.floor(v * rows), lv = v * rows % 1, off = row % 2 ? 0.25 : 0, x = ((u + off) % 1) * 2, lu = x % 1;
      const jv = Math.min(lv, 1 - lv) * 0.6, ju = Math.min(lu, 1 - lu) * 1.2;                // distância à junta em metros
      const blk = row * 5 + Math.floor(x), tone = hash2(blk, 11, 31), nn = fbm(u, v, 8, 541, 5), tool = vnoise(u * 900, v * 450, 900, 543);
      const fos = vnoise(u * 120, v * 60, 120, 545), pit = vnoise(u * 500, v * 250, 500, 547) > 0.93;
      let r = 0.82 + 0.05 * tone + 0.05 * (nn - 0.5), g = 0.76 + 0.045 * tone + 0.045 * (nn - 0.5), b = 0.64 + 0.04 * tone + 0.04 * (nn - 0.5), h = 0.5 + 0.04 * tool + 0.06 * nn;
      if (fos > 0.8) { const k = smooth(0.8, 0.86, fos) * 0.25; r = mix(r, 0.62, k); g = mix(g, 0.56, k); b = mix(b, 0.45, k); }
      if (pit) { r *= 0.86; g *= 0.86; b *= 0.86; h -= 0.1; }
      const jd = Math.min(jv, ju);
      if (jd < 0.0016) { r = 0.9; g = 0.86; b = 0.78; h = 0.3; }                         // junta de argamassa clara, rebaixada
      else if (jd < 0.004) h -= 0.08 * (1 - jd / 0.004);                                  // aresta do bloco quebrada
      o[0] = r; o[1] = g; o[2] = b; o[3] = h; o[4] = jd < 0.0016 ? 0.92 : 0.72 + 0.12 * nn;
    }, 1.0);
    return new THREE.MeshStandardMaterial({ map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, roughness: 1, vertexColors: true, envMapIntensity: 0.65, shadowSide: THREE.DoubleSide });
  });
}
/** Metros por repetição da cantaria (u, v). */
export const WALL_TILE: [number, number] = [2.4, 1.2];

/* ======================= peças na parede ======================= */
const at = (w: Side, s: number, y: number, off = 0) => onWall(w, s, y, off);
/** Caixa saindo da parede: centro em `s`, base em `y`, de `off` até `off + d` para dentro da sala. */
function wb(c: RoomsCtx, m: THREE.Material, w: Side, s: number, y: number, off: number, sx: number, sy: number, d: number, cast = false) {
  c.batch.add(ROOM, m, BOX0(), mul(at(w, s, y, off + d / 2), mat(0, 0, 0, 0, sx, sy, d)), { cast });
}
/** Perfil corrido na parede de s0 a s1 (pts: saliência, altura relativa a y). */
function run(c: RoomsCtx, m: THREE.Material, w: Side, s0: number, s1: number, y: number, key: string, pts: [number, number][], cast = false) {
  c.batch.add(ROOM, m, profileGeo(key, pts, Math.abs(s1 - s0)), at(w, (s0 + s1) / 2, y), { cast });
}

/** Lambri de mármore de 0 a 1,1 m num trecho livre [a, b] da parede. */
function wainscot(c: RoomsCtx, V: VPalette, w: Side, a: number, b: number) {
  const len = b - a, mid = (a + b) / 2;
  run(c, V.nero, w, a, b, 0, "plinth", [[0.035, 0], [0.035, 0.15], ...arcPts(0.035, 0.15, 0.05, 0.19, true, 3), [0.03, 0.19], [0.03, 0.2]]);
  wb(c, V.botticino, w, mid, 0.2, 0, len, 0.8, 0.02);
  // chapim (capitel do lambri): filete, gola e o bocel de Carrara
  run(c, V.carrara, w, a, b, 1.0, "dado", [[0.03, 0], [0.04, 0.02], ...arcPts(0.04, 0.02, 0.065, 0.06, false, 4), [0.07, 0.07], [0.07, 0.09], [0.04, 0.1]]);
  const n = Math.max(1, Math.round(len / 0.95)), pw = len / n;
  for (let k = 0; k < n; k++) {
    const s = a + (k + 0.5) * pw;
    c.batch.add(ROOM, V.nero, frameGeo("wsFrame", pw - 0.1, 0.66, 0.045, 0.012), mul(at(w, s, 0.6, 0.02), mat(0, 0, 0)));
    c.batch.add(ROOM, V.botticino, raisedPanel("wsPanel", pw - 0.22, 0.54, 0.022, 0.012), mul(at(w, s, 0.6, 0.02), mat(0, 0, 0)));
  }
}

/** Pilastra canelada: pedestal (0–1,1 m), fuste com caneluras (1,1–5,25 m) e capitel com folhas e volutas douradas. */
function pilaster(c: RoomsCtx, V: VPalette, w: Side, s: number, top = 5.6, width = 0.55) {
  const capH = 0.48, shaftTop = top - capH;
  // pedestal: base, dado e cornija do pedestal
  wb(c, V.nero, w, s, 0, 0, width + 0.14, 0.2, 0.15);
  wb(c, V.stoneMold, w, s, 0.2, 0, width + 0.08, 0.78, 0.12, true);
  c.batch.add(ROOM, V.carrara, profileGeo("pedCap", [[0.12, 0], [0.15, 0.03], [0.15, 0.08], [0.13, 0.12]], width + 0.16), at(w, s, 0.98));
  c.batch.add(ROOM, V.nero, frameGeo("pedPanel", width - 0.08, 0.5, 0.03, 0.012), mul(at(w, s, 0.6, 0.12), mat(0, 0, 0)));
  // base ática e fuste
  c.batch.add(ROOM, V.stoneMold, profileGeo("pilBase", [[0.1, 0], [0.1, 0.05], ...arcPts(0.1, 0.05, 0.08, 0.12, true, 3), [0.085, 0.14]], width + 0.06), at(w, s, 1.1));
  wb(c, V.stoneMold, w, s, 1.24, 0, width, shaftTop - 1.24, 0.08, true);
  const reeds = 5, rw = (width - 0.12) / reeds;
  for (let k = 0; k < reeds; k++) {
    const x = -width / 2 + 0.06 + (k + 0.5) * rw;
    c.inst.add(ROOM, "vestibulo-reed", vGeo("reedGeo", () => new THREE.CylinderGeometry(1, 1, 1, 10, 1, false, -Math.PI / 2, Math.PI).translate(0, 0.5, 0)), V.stoneMold, mul(at(w, s, 1.36, 0.08), mat(x, 0, 0, 0, rw * 0.42, shaftTop - 1.48, rw * 0.3)));
  }
  // capitel: colarinho dourado, campana, duas fileiras de folhas, volutas e o ábaco
  wb(c, V.gilt, w, s, shaftTop, 0, width + 0.02, 0.04, 0.095);
  c.batch.add(ROOM, V.stoneMold, profileGeo(`pilBell-${width}`, [[0.08, 0], [0.09, 0.12], [0.12, 0.26], [0.17, 0.34], [0.17, 0.4]], width + 0.04), at(w, s, shaftTop + 0.04));
  const leaf = vGeo("acanthus", () => new THREE.SphereGeometry(1, 8, 6, 0, Math.PI, 0, Math.PI / 2).scale(0.07, 0.19, 0.04));
  for (const [row, n, y, z] of [[0, 4, 0.06, 0.1], [1, 3, 0.16, 0.13]] as [number, number, number, number][]) for (let k = 0; k < n; k++) {
    const x = -width / 2 + 0.06 + (k + (row ? 1 : 0.5)) * ((width - 0.12) / (n + (row ? 1 : 0)));
    c.inst.add(ROOM, "vestibulo-acanthus", leaf, V.gilt, mul(at(w, s, shaftTop + y, z), mat(x, 0, 0, 0, 1, 1, 1, 0.35)));
  }
  for (const sx of [-1, 1]) c.inst.add(ROOM, "vestibulo-volute", vGeo("voluteGeo", () => new THREE.TorusGeometry(0.045, 0.014, 6, 16)), V.gilt, mul(at(w, s, shaftTop + 0.31, 0.15), mat(sx * (width / 2 - 0.01), 0, 0)));
  wb(c, V.stoneMold, w, s, top - 0.06, 0, width + 0.16, 0.06, 0.2);
  c.inst.add(ROOM, "vestibulo-capRose", vGeo("capRoseGeo", () => new THREE.SphereGeometry(0.035, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2)), V.giltBright, mul(at(w, s, top - 0.03, 0.2), mat(0, 0, 0)));
}

/**
 * Cimalha corrida no alto das quatro paredes (5,6–6,2 m: arquitrave, friso com filete dourado, dentículos e cornija) e,
 * acima dela, a sanca: o quarto de cana côncavo que sobe até o teto a 0,68 m da parede, com o filete dourado na borda.
 */
function cornice(c: RoomsCtx, V: VPalette) {
  const y0 = 5.6, pts: [number, number][] = [[0.045, 0], [0.045, 0.08], [0.07, 0.08], [0.07, 0.19], [0.03, 0.2], [0.03, 0.36], ...arcPts(0.03, 0.36, 0.16, 0.46, false, 5), [0.2, 0.47], [0.2, 0.52], [0.33, 0.53], [0.33, 0.58], ...arcPts(0.33, 0.58, 0.38, 0.62, true, 3), ...arcPts(0.38, 0.62, 0.68, 0.9, false, 8)];
  for (const [w, s0, s1] of [["N", X0, X1], ["S", X0, X1], ["W", 14.5, Z1], ["E", 14.5, Z1]] as [Side, number, number][]) {
    run(c, V.stoneMold, w, s0, s1, y0, `cornice-${w}`, pts, true);
    run(c, V.gilt, w, s0, s1, y0 + 0.255, `corniceGilt-${w}`, [[0.04, 0], [0.05, 0.015], [0.04, 0.03]]);
    run(c, V.gilt, w, s0, s1, y0 + 0.885, `coveGilt-${w}`, [[0.66, 0], [0.7, 0.008], [0.7, 0.015], [0.66, 0.015]]);
    const len = Math.abs(s1 - s0), n = Math.floor(len / 0.11);
    for (let k = 0; k < n; k++) c.inst.add(ROOM, "vestibulo-dentil", BOX0(), V.stoneMold, mul(at(w, Math.min(s0, s1) + (k + 0.5) * (len / n), y0 + 0.43, 0.1), mat(0, 0, 0, 0, 0.055, 0.08, 0.2)));
  }
}

/** Nicho com arco: moldura saliente, fundo côncavo vermelho-pompeiano, prateleira em consola e luz rasante de baixo. */
function niche(c: RoomsCtx, V: VPalette, w: Side, s: number, content: "statue" | "urn") {
  const r = 0.55, sill = 1.25, spring = 3.15, depth = 0.32;
  const red = vSolid("nicheRed", "#6b1e18", { rough: 0.8, env: 0.4, side: THREE.DoubleSide });
  c.batch.add(ROOM, V.stoneMold, archFrameGeo("niche", r, 0.17, spring - sill, depth, 0), mul(at(w, s, sill, 0), mat(0, 0, 0)), { cast: true });
  // fundo: meio cilindro e quarto de esfera achatados (cabem nos 32 cm da moldura), vistos por dentro
  c.batch.add(ROOM, red, vGeo("nicheApse", () => new THREE.CylinderGeometry(r, r, spring - sill, 28, 1, true, Math.PI / 2, Math.PI).scale(1, 1, depth / r).translate(0, (spring - sill) / 2, depth)), mul(at(w, s, sill, 0), mat(0, 0, 0)), { receive: true });
  c.batch.add(ROOM, red, vGeo("nicheDome", () => new THREE.SphereGeometry(r, 28, 10, Math.PI, Math.PI, 0, Math.PI / 2).scale(1, 1, depth / r).translate(0, 0, depth)), mul(at(w, s, spring, 0), mat(0, 0, 0)));
  // filete dourado no arranque do arco, fecho (aduela) e a prateleira com consola
  c.batch.add(ROOM, V.gilt, vGeo("nicheImpost", () => new THREE.TorusGeometry(r, 0.012, 6, 32, Math.PI)), mul(at(w, s, spring, depth - 0.01), mat(0, 0, 0)));
  wb(c, V.giltBright, w, s, spring + r + 0.02, depth - 0.02, 0.16, 0.22, 0.06);
  c.batch.add(ROOM, V.carrara, profileGeo("nicheSill", [[0.4, 0], [0.42, 0.03], [0.42, 0.09], [0.38, 0.12]], 1.3), at(w, s, sill - 0.12));
  for (const sx of [-0.35, 0.35]) c.batch.add(ROOM, V.stoneMold, profileGeo("nicheCorbel", [[0.02, 0], [0.12, 0.08], [0.2, 0.22], [0.3, 0.27]], 0.12), at(w, s + sx * (w === "S" || w === "W" ? -1 : 1), sill - 0.39));
  // luz rasante: fita escondida na prateleira e a mancha de luz subindo pelo fundo
  c.inst.add(ROOM, "vestibulo-nicheLed", BOX0(), vGlow("nicheLed", "#ffcf8a", 2.4), mul(at(w, s, sill + 0.005, depth - 0.06), mat(0, 0, 0, 0, 0.9, 0.01, 0.015)));
  c.batch.add(ROOM, vGlow("nicheWash", "#ffb46a", 0.7, { additive: true, map: nicheWashTexture() }), PLANE(), mul(at(w, s, sill + 1.0, 0.03), mat(0, 0, 0, 0, 1.05, 2.0, 1)));
  const p = new THREE.Vector3(0, sill + 0.6, depth + 0.25).applyMatrix4(at(w, s, 0));
  A(c, ROOM, p.x, p.y, p.z, "#ffcf9a", 1.8, 2.6);
  if (content === "statue") {
    const marble = vSolid("statueMarble", "#f0ebe2", { rough: 0.34, env: 0.9 });
    c.batch.add(ROOM, V.nero, BOX0(), mul(at(w, s, sill, 0.17), mat(0, 0, 0, 0, 0.34, 0.12, 0.26)));
    c.batch.add(ROOM, marble, statueGeometry(1), mul(at(w, s, sill + 0.12, 0.17), mat(0, 0, 0, 0.35, 0.82)), { cast: true });
  } else {
    // urna de Botticino com rosas brancas e folhagem
    c.batch.add(ROOM, V.botticino, lathe("nicheUrn", [[0, 0], [0.11, 0], [0.12, 0.03], [0.07, 0.07], [0.07, 0.12], [0.16, 0.22], [0.2, 0.36], [0.19, 0.46], [0.15, 0.52], [0.18, 0.56], [0.18, 0.58], [0, 0.58]], 28), mul(at(w, s, sill, 0.17), mat(0, 0, 0)), { cast: true });
    c.batch.add(ROOM, V.gilt, vGeo("urnBand", () => new THREE.TorusGeometry(0.2, 0.008, 6, 32).rotateX(Math.PI / 2)), mul(at(w, s, sill + 0.36, 0.17), mat(0, 0, 0)));
    const rose = roseGeometry(c.q), roseMat = vSolid("roseWhite", "#ffffff", { rough: 0.7, side: THREE.DoubleSide, env: 0.4 });
    let seed = 13; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let k = 0; k < 26; k++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.22, y = sill + 0.6 + rnd() * 0.32 + (0.22 - rr) * 0.5;
      c.inst.add(ROOM, "vestibulo-rose", rose, roseMat, mul(at(w, s, y, 0.17), mat(Math.cos(a) * rr, 0, Math.sin(a) * rr * 0.6, a, 0.075 + rnd() * 0.02)), new THREE.Color(k % 5 ? "#f6f1e6" : "#efd9df"));
    }
    const leaf = vGeo("nicheLeaf", () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.05, 0.12, 0, 0.26); sh.quadraticCurveTo(-0.05, 0.12, 0, 0); return new THREE.ShapeGeometry(sh, 3); });
    const lm = vSolid("leafGreen", "#2c4f2a", { rough: 0.7, side: THREE.DoubleSide, env: 0.3 });
    for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; c.inst.add(ROOM, "vestibulo-nicheLeaf", leaf, lm, mul(at(w, s, sill + 0.55, 0.17), mat(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.1, -a + Math.PI / 2, 1, 1, 1, 0.9 + (k % 3) * 0.15))); }
  }
}
function nicheWashTexture(): THREE.Texture {
  return vTex("nicheWash", 128, 256, (g, w, h) => {
    const v = g.createLinearGradient(0, h, 0, 0); v.addColorStop(0, "rgba(255,255,255,0.95)"); v.addColorStop(0.35, "rgba(255,255,255,0.45)"); v.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = v; g.fillRect(0, 0, w, h);
    const e = g.createLinearGradient(0, 0, w, 0); e.addColorStop(0, "rgba(0,0,0,1)"); e.addColorStop(0.25, "rgba(0,0,0,0)"); e.addColorStop(0.75, "rgba(0,0,0,0)"); e.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out"; g.fillStyle = e; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "source-over";
  }, false);
}

/** Arandela de bronze: espelho recortado, dois braços em voluta, arandelas (pratinhos), mangas de vela, chamas e cristais. */
export function sconceV(c: RoomsCtx, V: VPalette, w: Side, s: number, y: number) {
  const base = at(w, s, y, 0);
  c.batch.add(ROOM, V.bronze, lathe("sconcePlate", [[0, 0], [0.07, 0], [0.085, 0.01], [0.07, 0.02], [0, 0.025]], 20), mul(base, mat(0, 0, 0, 0, 1, 1, 1, Math.PI / 2)));
  c.batch.add(ROOM, V.gilt, lathe("sconceStem", [[0, -0.16], [0.025, -0.15], [0.02, -0.05], [0.035, 0], [0.02, 0.06], [0.03, 0.14], [0, 0.16]], 12), mul(base, mat(0, 0, 0.05)));
  const arm = (sx: number) => vGeo(`sconceArm${sx}`, () => {
    const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(0, 0, 0.05), new THREE.Vector3(sx * 0.05, -0.1, 0.12), new THREE.Vector3(sx * 0.2, -0.06, 0.2), new THREE.Vector3(sx * 0.2, 0.08, 0.17));
    return new THREE.TubeGeometry(curve, 16, 0.011, 8, false);
  });
  for (const sx of [-1, 1]) {
    c.batch.add(ROOM, V.gilt, arm(sx), base);
    const px = sx * 0.2;
    c.batch.add(ROOM, V.gilt, lathe("bobeche", [[0, 0], [0.045, 0.005], [0.05, 0.015], [0.02, 0.02], [0, 0.02]], 16), mul(base, mat(px, 0.08, 0.17)));
    c.inst.add(ROOM, "vestibulo-candleSleeve", CYL0(10), V.paper, mul(base, mat(px, 0.1, 0.17, 0, 0.016, 0.13, 0.016)));
    c.inst.add(ROOM, "vestibulo-flameBulb", vGeo("flameBulbGeo", () => new THREE.SphereGeometry(1, 10, 8).scale(0.6, 1.5, 0.6)), V.flameBulb, mul(base, mat(px, 0.255, 0.17, 0, 0.022)));
    if (c.q === "high") for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; c.inst.add(ROOM, "vestibulo-sconceDrop", vGeo("dropGeo", () => new THREE.OctahedronGeometry(1, 0).scale(0.5, 1.4, 0.5)), V.crystal, mul(base, mat(px + Math.cos(a) * 0.045, 0.05, 0.17 + Math.sin(a) * 0.045, a, 0.012))); }
  }
  const p = new THREE.Vector3(0, 0.3, 0.3).applyMatrix4(base);
  A(c, ROOM, p.x, p.y, p.z, "#ffc27a", 3.4, 4.2, { flicker: 0.35 });
  c.batch.add(ROOM, vGlow("sconceWashV", "#ffb46a", 0.5, { additive: true, map: washTexture() }), PLANE(), mul(base, mat(0, 0.25, 0.012, 0, 1.3, 1.5, 1)));
}

/** Placa de bronze com letras em relevo (texto desenhado com sombra e brilho; relevo pelo mapa de normais). */
function plaque(c: RoomsCtx, V: VPalette, w: Side, s: number, y: number, lines: string[], wid = 0.62, hei = 0.3) {
  const key = `plaque-${lines.join("|")}`;
  const t = vTex(key, 1024, Math.round(1024 * hei / wid), (g, W, H) => {
    const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, "#8a6a34"); grd.addColorStop(0.45, "#c9a55a"); grd.addColorStop(1, "#7a5a2a"); g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#5c4219"; g.lineWidth = W * 0.012; g.strokeRect(W * 0.03, H * 0.06, W * 0.94, H * 0.88);
    g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach((ln, i) => {
      const sz = i === 0 ? H * 0.24 : H * 0.13, yy = H * (lines.length === 1 ? 0.5 : 0.36 + i * 0.3);
      g.font = `600 ${Math.round(sz)}px 'Didot', 'Bodoni 72', Georgia, 'DejaVu Serif', serif`;
      g.fillStyle = "#3e2c10"; g.fillText(ln, W / 2 + 3, yy + 3); g.fillStyle = "#f0d58f"; g.fillText(ln, W / 2, yy);
    });
  });
  const m = vMat(`plaqueMat-${key}`, () => new THREE.MeshStandardMaterial({ map: t, metalness: 0.85, roughness: 0.32, envMapIntensity: 1.2 }));
  c.batch.add(ROOM, V.bronzeDark, BOX0(), mul(at(w, s, y - hei / 2 - 0.015, 0.006), mat(0, 0, 0, 0, wid + 0.03, hei + 0.03, 0.012)));
  c.batch.add(ROOM, m, PLANE(), mul(at(w, s, y, 0.0185), mat(0, 0, 0, 0, wid, hei, 1)));
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.inst.add(ROOM, "vestibulo-rivet", SPH(8), V.brass, mul(at(w, s + dx * (wid / 2 - 0.025) * (w === "S" || w === "W" ? -1 : 1), y + dy * (hei / 2 - 0.025), 0.02), mat(0, 0, 0, 0, 0.008)));
}

/** Cartaz da exposição numa moldura dourada entalhada (frisos, cantoneiras e o passe-partout). */
function poster(c: RoomsCtx, V: VPalette, w: Side, s: number, y: number, k: number, wid: number, hei: number) {
  const t = exhibitPoster(c.copy, k);
  c.batch.add(ROOM, V.gilt, frameGeo("posterFrame", wid + 0.3, hei + 0.3, 0.12, 0.06, 0.02), mul(at(w, s, y, 0.0), mat(0, 0, 0)), { cast: true });
  c.batch.add(ROOM, V.giltBright, frameGeo("posterFrameIn", wid + 0.08, hei + 0.08, 0.025, 0.07, 0.006), mul(at(w, s, y, 0.0), mat(0, 0, 0)));
  c.batch.add(ROOM, V.paper, PLANE(), mul(at(w, s, y, 0.012), mat(0, 0, 0, 0, wid + 0.1, hei + 0.1, 1)));
  c.batch.add(ROOM, vMat(`posterMat-${k}-${c.copy.exhibitTitle}`, () => new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.08 })), PLANE(), mul(at(w, s, y, 0.016), mat(0, 0, 0, 0, wid, hei, 1)));
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.inst.add(ROOM, "vestibulo-frameCorner", vGeo("frameCornerGeo", () => new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2)), V.giltBright, mul(at(w, s + dx * (wid / 2 + 0.09), y + dy * (hei / 2 + 0.09), 0.06), mat(0, 0, 0)));
  // luz de quadro em latão por cima
  c.batch.add(ROOM, V.brass, CYL(12), mul(at(w, s, y + hei / 2 + 0.28, 0.2), mat(0, 0, 0, 0, 0.035, Math.min(0.9, wid * 0.8), 0.035, 0, Math.PI / 2)));
  c.batch.add(ROOM, V.brass, CYL(8), mul(at(w, s, y + hei / 2 + 0.22, 0.1), mat(0, 0, 0, 0, 0.012, 0.22, 0.012, Math.PI / 2 - 0.5)));
  c.inst.add(ROOM, "vestibulo-pictureLamp", BOX0(), V.ledWarm, mul(at(w, s, y + hei / 2 + 0.245, 0.2), mat(0, 0, 0, 0, Math.min(0.85, wid * 0.75), 0.006, 0.02)));
  const p = new THREE.Vector3(0, y + hei / 2 - 0.1, 0.5).applyMatrix4(at(w, s, 0));
  A(c, ROOM, p.x, p.y, p.z, "#ffe2b8", 1.6, 2.4);
}

/** Pintura a óleo (fictícia) desenhada: retrato de uma dama de vestido de gala ou paisagem com templete ao pôr do sol. */
function paintingTexture(kind: "portrait" | "landscape"): THREE.Texture {
  return vTex(`painting-${kind}`, 512, 704, (g, w, h) => {
    const R = (k: number) => { const x = Math.sin(k * 12.9898) * 43758.5453; return x - Math.floor(x); };
    if (kind === "portrait") {
      const bg = g.createRadialGradient(w * 0.55, h * 0.35, 20, w * 0.5, h * 0.5, h * 0.75); bg.addColorStop(0, "#5a4a2e"); bg.addColorStop(0.5, "#2b2416"); bg.addColorStop(1, "#0d0b07"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      // cortina vermelha à esquerda
      for (let x = 0; x < w * 0.32; x += 2) { const f = 0.5 + 0.5 * Math.sin(x * 0.09); g.fillStyle = `rgba(${90 + f * 70},${12 + f * 10},${16 + f * 8},0.9)`; g.fillRect(x, 0, 2, h * (0.92 - 0.25 * Math.max(0, (x - w * 0.18) / (w * 0.14)))); }
      // a dama: vestido de cetim azul-petróleo, colo, braços, rosto e o coque
      const gown = g.createLinearGradient(w * 0.3, h * 0.4, w * 0.75, h); gown.addColorStop(0, "#3f8a92"); gown.addColorStop(0.5, "#1d4e58"); gown.addColorStop(1, "#0c262c");
      g.fillStyle = gown; g.beginPath(); g.moveTo(w * 0.43, h * 0.42); g.quadraticCurveTo(w * 0.52, h * 0.4, w * 0.61, h * 0.42); g.lineTo(w * 0.63, h * 0.55); g.bezierCurveTo(w * 0.78, h * 0.72, w * 0.86, h * 0.9, w * 0.9, h); g.lineTo(w * 0.18, h); g.bezierCurveTo(w * 0.24, h * 0.86, w * 0.33, h * 0.7, w * 0.42, h * 0.55); g.closePath(); g.fill();
      g.strokeStyle = "rgba(200,240,240,0.18)"; g.lineWidth = 3; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(w * (0.46 + k * 0.02), h * 0.56); g.quadraticCurveTo(w * (0.4 + k * 0.06), h * 0.8, w * (0.3 + k * 0.08), h); g.stroke(); }
      g.fillStyle = "#e6c2a4"; g.beginPath(); g.ellipse(w * 0.52, h * 0.38, w * 0.1, h * 0.05, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(w * 0.43, h * 0.42); g.quadraticCurveTo(w * 0.36, h * 0.5, w * 0.4, h * 0.6); g.lineTo(w * 0.44, h * 0.6); g.quadraticCurveTo(w * 0.42, h * 0.5, w * 0.46, h * 0.44); g.fill();
      g.beginPath(); g.ellipse(w * 0.53, h * 0.27, w * 0.055, h * 0.05, 0.1, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#2a1a10"; g.beginPath(); g.ellipse(w * 0.535, h * 0.225, w * 0.06, h * 0.035, 0.1, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(w * 0.56, h * 0.2, w * 0.03, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#f2efe6"; for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(w * (0.47 + k * 0.008), h * (0.35 + Math.sin(k * 0.45) * 0.012 + 0.012), 2.4, 0, Math.PI * 2); g.fill(); }
    } else {
      const sky = g.createLinearGradient(0, 0, 0, h * 0.6); sky.addColorStop(0, "#2b3550"); sky.addColorStop(0.55, "#c98a4a"); sky.addColorStop(1, "#f2c27a"); g.fillStyle = sky; g.fillRect(0, 0, w, h * 0.6);
      const lake = g.createLinearGradient(0, h * 0.6, 0, h); lake.addColorStop(0, "#c08a52"); lake.addColorStop(1, "#1b2230"); g.fillStyle = lake; g.fillRect(0, h * 0.6, w, h * 0.4);
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${20 + (k % 5) * 6},${32 + (k % 7) * 5},${18},0.9)`; g.beginPath(); g.ellipse(R(k) * w, h * (0.52 + R(k + 50) * 0.08), 30 + R(k + 9) * 40, 40 + R(k + 3) * 60, 0, 0, Math.PI * 2); g.fill(); }
      // templete clássico na margem: base, colunas, cornija e cúpula
      g.fillStyle = "#e9dcc2"; g.fillRect(w * 0.55, h * 0.5, w * 0.22, h * 0.02); for (let k = 0; k < 5; k++) g.fillRect(w * (0.565 + k * 0.045), h * 0.39, w * 0.014, h * 0.11); g.fillRect(w * 0.55, h * 0.375, w * 0.22, h * 0.018);
      g.beginPath(); g.arc(w * 0.66, h * 0.375, w * 0.1, Math.PI, 0); g.fill();
      g.fillStyle = "rgba(233,220,194,0.35)"; g.fillRect(w * 0.55, h * 0.62, w * 0.22, h * 0.12);
    }
    // pinceladas, verniz amarelado e craquelê
    for (let k = 0; k < 900; k++) { g.strokeStyle = `rgba(${R(k) > 0.5 ? 255 : 0},${R(k) > 0.5 ? 240 : 0},${R(k) > 0.5 ? 200 : 0},0.035)`; g.lineWidth = 2 + R(k + 7) * 4; const x = R(k + 1) * w, y = R(k + 2) * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R(k + 3) - 0.5) * 30, y + (R(k + 4) - 0.5) * 30); g.stroke(); }
    const vn = g.createRadialGradient(w / 2, h * 0.4, 30, w / 2, h / 2, h * 0.8); vn.addColorStop(0, "rgba(255,220,140,0.08)"); vn.addColorStop(1, "rgba(30,15,0,0.35)"); g.fillStyle = vn; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(20,12,4,0.25)"; g.lineWidth = 1; for (let k = 0; k < 160; k++) { let x = R(k + 11) * w, y = R(k + 12) * h; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 4; i++) { x += (R(k * 7 + i) - 0.5) * 40; y += (R(k * 5 + i) - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  });
}
/** Quadro a óleo em moldura dourada larga entalhada, com luz de quadro em latão. */
function painting(c: RoomsCtx, V: VPalette, w: Side, s: number, y: number, kind: "portrait" | "landscape", wid: number, hei: number) {
  const t = paintingTexture(kind);
  c.batch.add(ROOM, V.gilt, frameGeo("paintFrame", wid + 0.36, hei + 0.36, 0.18, 0.09, 0.03), mul(at(w, s, y, 0), mat(0, 0, 0)), { cast: true });
  c.batch.add(ROOM, V.giltBright, frameGeo("paintFrameIn", wid + 0.04, hei + 0.04, 0.03, 0.1, 0.008), mul(at(w, s, y, 0), mat(0, 0, 0)));
  c.batch.add(ROOM, vMat(`paintMat-${kind}`, () => new THREE.MeshStandardMaterial({ map: t, roughness: 0.38, envMapIntensity: 0.6 })), PLANE(), mul(at(w, s, y, 0.03), mat(0, 0, 0, 0, wid, hei, 1)));
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.inst.add(ROOM, "vestibulo-frameCorner", vGeo("frameCornerGeo", () => new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2)), V.giltBright, mul(at(w, s + dx * (wid / 2 + 0.12), y + dy * (hei / 2 + 0.12), 0.09), mat(0, 0, 0, 0, 1.3)));
  c.batch.add(ROOM, V.brass, CYL(12), mul(at(w, s, y + hei / 2 + 0.36, 0.26), mat(0, 0, 0, 0, 0.04, wid * 0.7, 0.04, 0, Math.PI / 2)));
  c.batch.add(ROOM, V.brass, CYL(8), mul(at(w, s, y + hei / 2 + 0.28, 0.13), mat(0, 0, 0, 0, 0.012, 0.28, 0.012, Math.PI / 2 - 0.5)));
  c.inst.add(ROOM, "vestibulo-pictureLamp", BOX0(), V.ledWarm, mul(at(w, s, y + hei / 2 + 0.32, 0.26), mat(0, 0, 0, 0, wid * 0.66, 0.006, 0.02)));
  const p = new THREE.Vector3(0, y + hei / 2 - 0.2, 0.6).applyMatrix4(at(w, s, 0));
  A(c, ROOM, p.x, p.y, p.z, "#ffe0b0", 2.2, 3.2);
}

/** Portal interno da porta da rua: guarnição com blocos de base e a bandeira em leque (acesa pela rua) sobre a porta. */
function frontPortal(c: RoomsCtx, V: VPalette) {
  const w: Side = "S";
  // guarnição de pedra (arquitrave com perfil: filete, faixa, gola e o contracordão) em volta do vão de 4 × 4,2 m
  const arch: [number, number][] = [[0.03, 0], [0.03, 0.08], [0.05, 0.1], [0.05, 0.2], ...arcPts(0.05, 0.2, 0.09, 0.26, true, 3), [0.09, 0.3]];
  for (const sx of [-1, 1]) {
    // jamba: o perfil corre na vertical (gira 90° no plano da parede) e cresce para fora do vão
    c.batch.add(ROOM, V.stoneMold, profileGeo("portalJamb", arch, 3.9), mul(at(w, sx * 2.0, 2.25, 0), mat(0, 0, 0, 0, 1, 1, 1, 0, sx > 0 ? Math.PI / 2 : -Math.PI / 2)), { cast: true });
    wb(c, V.nero, w, sx * 2.15, 0, 0, 0.34, 0.3, 0.11);
  }
  run(c, V.stoneMold, w, -2.3, 2.3, 4.2, "portalHead", arch, true);
  // bandeira em leque sobre a porta: segmento de arco de 4 m × 1,05 m, vidro fosco aceso, raios de bronze, arquivolta e fecho
  const base = 4.5, half = 2.0, rise = 1.05, R = (half * half + rise * rise) / (2 * rise), yc = rise - R, a0 = Math.asin(half / R);
  const fan = vGeo("fanGlass", () => { const sh = new THREE.Shape(); sh.moveTo(-half, 0); sh.absarc(0, yc, R, Math.PI / 2 + a0, Math.PI / 2 - a0, true); sh.lineTo(-half, 0); return new THREE.ShapeGeometry(sh, 40); });
  const glassM = vMat("fanGlassMat", () => new THREE.MeshStandardMaterial({ color: "#cfd8e6", emissive: new THREE.Color("#b9c8e8"), emissiveIntensity: 0.6, roughness: 0.35, metalness: 0, emissiveMap: fanTexture(), map: fanTexture() }));
  c.batch.add(ROOM, glassM, fan, at(w, 0, base, 0.02));
  for (let k = 1; k < 14; k++) {
    const phi = -Math.PI / 2 + (k / 14) * Math.PI, cp = Math.cos(phi), L = -yc * cp + Math.sqrt((yc * cp) ** 2 - yc * yc + R * R) - 0.02;
    c.batch.add(ROOM, V.bronze, BOX0(), mul(at(w, 0, base, 0.035), mat(0, 0, 0, 0, 0.032, L, 0.025, 0, -phi)));
  }
  for (const rr of [0.55, 0.85]) c.batch.add(ROOM, V.bronze, vGeo(`fanRing${rr}`, () => new THREE.TorusGeometry(rr, 0.014, 6, 40, Math.PI)), at(w, 0, base, 0.035));
  c.batch.add(ROOM, V.bronze, vGeo("fanHub", () => new THREE.CylinderGeometry(0.3, 0.3, 0.04, 32, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2)), at(w, 0, base, 0.04));
  c.batch.add(ROOM, V.bronze, BOX0(), mul(at(w, 0, base - 0.03, 0.035), mat(0, 0, 0, 0, 4.1, 0.06, 0.05)));
  c.batch.add(ROOM, V.stoneMold, vGeo("fanArchivolt", () => {
    const sh = new THREE.Shape(), r2 = R + 0.16, b2 = Math.asin(Math.min(1, (half + 0.12) / r2));
    sh.moveTo(-half - 0.12, 0); sh.absarc(0, yc, r2, Math.PI / 2 + b2, Math.PI / 2 - b2, true); sh.lineTo(half, 0); sh.absarc(0, yc, R, Math.PI / 2 - a0, Math.PI / 2 + a0, false); sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1, curveSegments: 40 });
  }), at(w, 0, base, 0), { cast: true });
  wb(c, V.giltBright, w, 0, base + rise - 0.06, 0.08, 0.22, 0.26, 0.06);
  // a luz da rua entrando pela porta e pela bandeira (fria) e o forro do vão
  A(c, ROOM, 0, 2.6, 23.2, "#cdd8ff", 4, 7);
  c.batch.add(ROOM, V.stoneMold, BOX0(), mat(0, 4.2, 24.25, 0, 4.0, 0.06, 0.5));
}
/** Vidro da bandeira: raios mais claros a partir do centro de baixo (a luz da rua chegando). */
function fanTexture(): THREE.Texture {
  return vTex("fanTex", 512, 256, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h, 10, w / 2, h, w * 0.6); grd.addColorStop(0, "#ffffff"); grd.addColorStop(0.6, "#b9c4d6"); grd.addColorStop(1, "#6d7890"); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(255,255,255,${0.04 + (k % 5) * 0.01})`; g.fillRect((k * 131) % w, (k * 71) % h, 2, 2); }
  });
}

/* ======================= montagem ======================= */
export function buildWalls(c: RoomsCtx) {
  const V = VM(c.q), tx = vCopy(c.copy);
  /* lambri nos trechos livres de cada parede */
  for (const [w, a, b] of [["N", -3.9, -2.3], ["N", 2.3, 3.9], ["S", X0, -2.32], ["S", 2.32, X1], ["W", 17.9, 19.75], ["W", 22.75, Z1], ["E", 17.9, 19.45], ["E", 23.55, Z1]] as [Side, number, number][]) wainscot(c, V, w, a, b);
  /* pilastras */
  for (const x of [-7.55, -2.78, 2.78, 7.55]) pilaster(c, V, "S", x);
  pilaster(c, V, "W", 18.82); pilaster(c, V, "E", 18.72);
  /* cimalha */
  cornice(c, V);
  /* nichos da parede sul: estátua (oeste) e urna com rosas (leste) */
  niche(c, V, "S", -5.2, "statue"); niche(c, V, "S", 5.2, "urn");
  /* portal da porta da rua */
  frontPortal(c, V);
  /* placas de bronze: salão (dos dois lados da porta), doca e funcionários (perto da porta lateral), fundação */
  plaque(c, V, "N", -3.38, 2.0, [tx.hall], 0.86, 0.24);
  plaque(c, V, "N", 3.38, 2.0, [tx.hall], 0.86, 0.24);
  plaque(c, V, "W", 23.38, 1.62, [tx.dock, tx.staff], 0.56, 0.3);
  plaque(c, V, "N", 0, 5.5, [tx.founded], 1.7, 0.17);
  /* arandelas em pares: ladeando a porta da rua, a porta lateral e a porta do salão (sob a galeria) */
  for (const x of [-3.62, 3.62]) sconceV(c, V, "S", x, 2.75);
  for (const z of [19.36, 23.15]) sconceV(c, V, "W", z, 2.75);
  for (const x of [-3.38, 3.38]) sconceV(c, V, "N", x, 3.0);
  sconceV(c, V, "E", 23.75, 2.75);
  /* pinturas a óleo sobre as curvas das escadas (paredes oeste e leste, acima do corrimão) */
  painting(c, V, "W", 16.15, 4.38, "portrait", 1.35, 1.85);
  painting(c, V, "E", 16.15, 4.38, "landscape", 1.35, 1.85);
  /* cartazes da exposição no alto das paredes laterais */
  poster(c, V, "W", 21.25, 4.4, 0, 1.15, 1.6);
  poster(c, V, "E", 21.5, 4.3, 1, 1.15, 1.6);
  void VH; void smooth; void fbm;
}
