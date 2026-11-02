/*
 * MET Gala Heist v2 — Vestíbulo: as paredes. Cantaria de calcário em fiadas de 60 cm com junta fina (a casca usa o
 * material daqui), lambri de mármore até 1,1 m (rodapé de nero, almofadas de Botticino emolduradas de nero, chapim de
 * Carrara), pilastras caneladas com pedestal e capitel dourado, a cimalha completa no alto (arquitrave, friso com filete
 * dourado, dentículos e cornija de 42 cm), os dois nichos da parede sul (fundo vermelho-pompeiano, luz rasante, estátua e
 * urna), o portal interno da porta da rua com a bandeira em leque acesa pela rua, placas de bronze, arandelas de bronze
 * com mangas de vela e cristais, e os cartazes da exposição em molduras douradas. Os nichos estão em vestibulo-niche.ts,
 * as placas, cartazes e pinturas em vestibulo-walls-art.ts e as ferramentas de colocar na parede em vestibulo-walls-kit.ts.
 */
import * as THREE from "three";
import { BOX0, CYL0, mat, mul } from "../interior-batch";
import type { Quality } from "../interior-tex";
import { type RoomsCtx, A, PLANE, washTexture } from "./kit";
import { ROOM, VH, VM, X0, X1, Z1, arcPts, fbm, frameGeo, hash2, lathe, mix, profileGeo, raisedPanel, smooth, vCopy, vGeo, vGlow, vMat, vSurface, vTex, vnoise, type Side, type VPalette } from "./vestibulo-kit";
import { at, run, wb } from "./vestibulo-walls-kit";
import { niche } from "./vestibulo-niche";
import { painting, plaque, poster } from "./vestibulo-walls-art";

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
