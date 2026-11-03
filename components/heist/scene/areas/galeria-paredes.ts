/*
 * MET Gala Heist v2 — galeria (Z07): as paredes — rodapé, tecido pintado por seção, pilastras caneladas, arcos
 * cegos com legendas, molduras das portas, textos de parede em vinil, inscrição do friso, arte emoldurada e o nicho
 * do Aurora. Saiu de galeria.ts sem mudança.
 */
import * as THREE from "three";
import { CYL, geo } from "../interior-batch";
import { type RoomsCtx, A, PLANE, signMat } from "./kit";
import { type Fr, archFill, archRing, at, bx, langOf, lit, moldingGeo, once, plain } from "./galeria-kit";
import { GAL_COPY } from "./galeria-copy";
import { SECTION, auroraTex, clothWall, creditsAtlas, friezeText, graniteMat, wallTextAtlas } from "./galeria-tex";
import { artGeo, artMat, blackSteel, brass, bronze, laca, vidro } from "./galeria-props";
import { ROOM, WALLS, wf, runs, SKIRT, RAIL, CORNICE, CAPITAL, PBASE, FRAME, stoneMat, friezeMat } from "./galeria-planta";

/** Plano de tecido pintado (w × h) com a cor nos vértices e a trama em metros. */
function fieldGeo(w: number, h: number, color: string): THREE.BufferGeometry {
  return geo(`galeria-campo-${w.toFixed(3)}-${h.toFixed(3)}-${color}`, () => {
    const g = new THREE.PlaneGeometry(w, h), n = g.getAttribute("position").count, uv = g.getAttribute("uv") as THREE.BufferAttribute, col = new THREE.Color(color), a = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { uv.setXY(k, uv.getX(k) * w, uv.getY(k) * h); a[k * 3] = col.r; a[k * 3 + 1] = col.g; a[k * 3 + 2] = col.b; }
    g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g;
  });
}
/** Cópia de uma geometria com uma cor em todos os vértices (fundo dos arcos no material de tecido). */
function colored(key: string, src: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  return geo(`galeria-cor-${key}-${color}`, () => {
    const g = src.clone(), n = g.getAttribute("position").count, col = new THREE.Color(color), a = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { a[k * 3] = col.r; a[k * 3 + 1] = col.g; a[k * 3 + 2] = col.b; }
    g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g;
  });
}
/** Plano com uv num retângulo do atlas (u0, v0)–(u1, v1). */
function uvPlane(key: string, u0: number, v0: number, u1: number, v1: number): THREE.BufferGeometry {
  return geo(`galeria-uv-${key}`, () => { const g = new THREE.PlaneGeometry(1, 1), uv = g.getAttribute("uv") as THREE.BufferAttribute; for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0)); return g; });
}
/** Vinil recortado (letras com fundo transparente) sobre a parede, levemente aceso para ler na penumbra. */
function vinyl(key: string, t: THREE.Texture, ei = 0.32): THREE.MeshStandardMaterial {
  return once(`galeria-vinil-${key}-${t.uuid}`, () => new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.55, metalness: 0.1, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: ei, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
}

/** Rodapé, tecido das seções, pilastras, arcos, molduras das portas, trilho de quadros, friso e cornija. */
export function walls(c: RoomsCtx) {
  const q = c.q, stone = stoneMat(q), cloth = clothWall(q), gran = graniteMat(q), lang = langOf(c.copy), T = GAL_COPY[lang];
  const skirt = moldingGeo("galeria-rodape", SKIRT), rail = moldingGeo("galeria-trilho", RAIL), cornice = moldingGeo("galeria-cornija", CORNICE);
  for (const w of Object.values(WALLS)) {
    const F = wf(w);
    for (const [a, b] of runs(w)) c.batch.add(ROOM, gran, skirt, F((a + b) / 2, 0, 0, 0, b - a, 1, 1));
    c.batch.add(ROOM, brass(), rail, F(w.len / 2, 0, 0, 0, w.len, 1, 1));
    c.batch.add(ROOM, friezeMat(q), PLANE(), F(w.len / 2, 4.566, 0.004, 0, w.len, 0.468, 1));
    c.batch.add(ROOM, stone, cornice, F(w.len / 2, 0, 0, 0, w.len + 0.6, 1, 1), { cast: true });
    c.batch.add(ROOM, c.P.gold, CYL(8), F(w.len / 2, 4.875, 0.072, 0, 0.011, w.len, 0.011, 0, Math.PI / 2));
  }
  // tecido pintado por seção (cor nos vértices: uma chamada de desenho para as três cores)
  const fields: ["N" | "S" | "W" | "E", number, number, string, number, number][] = [
    ["N", 0, 8, SECTION.joias, 0.222, 4.3], ["N", 8, 16, SECTION.aurora, 0.222, 4.3], ["N", 16, 24, SECTION.atelie, 0.222, 4.3],
    ["S", 0, 10, SECTION.atelie, 0.222, 4.3], ["S", 14, 24, SECTION.joias, 0.222, 4.3], ["S", 10, 14, SECTION.aurora, 4.26, 4.3],
    ["W", 0, 7.5, SECTION.joias, 0.222, 4.3], ["W", 9.5, 15.5, SECTION.joias, 0.222, 4.3], ["W", 7.5, 9.5, SECTION.joias, 3.1, 4.3],
    ["E", 0, 6, SECTION.atelie, 0.222, 4.3], ["E", 8, 15.5, SECTION.atelie, 0.222, 4.3], ["E", 6, 8, SECTION.atelie, 2.92, 4.3],
  ];
  for (const [k, a, b, col, y0, y1] of fields) c.batch.add(ROOM, cloth, fieldGeo(b - a, y1 - y0, col), wf(WALLS[k])((a + b) / 2, (y0 + y1) / 2, 0.003, 0));
  // pilastras caneladas: base moldurada, fuste com cinco filetes, capitel
  const cap = moldingGeo("galeria-capitel", CAPITAL), pbase = moldingGeo("galeria-pbase", PBASE);
  const pil: ["N" | "S" | "W" | "E", number][] = [
    ["N", 0.25], ["N", 4], ["N", 8], ["N", 16], ["N", 20], ["N", 23.75], ["S", 0.25], ["S", 4], ["S", 8], ["S", 16], ["S", 20], ["S", 23.75],
    ["W", 0.25], ["W", 6.75], ["W", 10.25], ["W", 15.25], ["E", 0.25], ["E", 5.25], ["E", 8.75], ["E", 15.25],
  ];
  for (const [k, x] of pil) {
    const F = wf(WALLS[k]);
    c.batch.add(ROOM, stone, pbase, F(x, 0, 0, 0, 0.58, 1, 1));
    bx(c.batch, ROOM, stone, F(x, 0.41, 0, 0, 0.5, 3.63, 0.07), true);
    for (let f = -2; f <= 2; f++) bx(c.batch, ROOM, stone, F(x + f * 0.092, 0.47, 0.07, 0, 0.042, 3.5, 0.016));
    c.batch.add(ROOM, stone, cap, F(x, 0, 0, 0, 0.6, 1, 1));
  }
  // arcos cegos das vitrines de parede: anel de gesso, impostas, fecho, fundo de tecido mais escuro e a legenda em vinil
  const arch = archRing("galeria-arcoParede", 1.3, 0.2, 2.55, 0.14), fill = archFill("galeria-arcoParede", 1.3, 2.55), cap2 = creditsAtlas(q, lang);
  const arches: ["W" | "E", number, number][] = [["W", 12.5, 0], ["E", 3, 1], ["W", 3.5, 2], ["E", 12, 3]];
  for (const [k, x, i] of arches) {
    const F = wf(WALLS[k]), col = k === "W" ? "#24091b" : "#082519";
    c.batch.add(ROOM, stone, arch, F(x, 0, 0.015), { cast: true });
    c.batch.add(ROOM, cloth, colored("arco", fill, col), F(x, 0, 0.006));
    for (const s of [-1, 1]) bx(c.batch, ROOM, stone, F(x + s * 1.4, 2.47, 0.08, 0, 0.32, 0.12, 0.17));
    bx(c.batch, ROOM, stone, F(x, 3.72, 0.09, 0, 0.24, 0.34, 0.18));
    c.batch.add(ROOM, vinyl("legendas", cap2, 0.3), uvPlane(`legenda${i}`, 0.5, 1 - (i + 1) / 4, 1, 1 - i / 4), F(x, 3.2, 0.012, 0, 1.6, 0.4, 1));
    A(c, ROOM, ...at(F, x, 3.0, 0.6).toArray() as [number, number, number], "#ffd9b0", 1.8, 3);
  }
  // molduras das portas: vão do salão (gesso), Sala das Joias (bronze, com o leitor de cartão livre à direita), terraço
  {
    const F = wf(WALLS.S);
    for (const x of [9.8, 14.2]) bx(c.batch, ROOM, stone, F(x, 0.222, 0, 0, 0.28, 3.78, 0.07), true);
    bx(c.batch, ROOM, stone, F(12, 4.0, 0, 0, 4.68, 0.26, 0.09));
    bx(c.batch, ROOM, stone, F(12, 4.23, 0, 0, 4.86, 0.07, 0.13));
  }
  {
    const F = wf(WALLS.W), B = bronze();
    for (const x of [7.34, 9.66]) { bx(c.batch, ROOM, B, F(x, 0, 0, 0, 0.16, 2.88, 0.06), true); bx(c.batch, ROOM, B, F(x, 0, 0.06, 0, 0.1, 2.88, 0.012)); }
    bx(c.batch, ROOM, B, F(8.5, 2.88, 0, 0, 2.48, 0.2, 0.08));
    bx(c.batch, ROOM, B, F(8.5, 3.08, 0, 0, 2.62, 0.06, 0.12));
    c.batch.add(ROOM, signMat(c.copy.jewelRoom, "brass", c.copy.restricted, 0.2), PLANE(), F(8.5, 3.45, 0.012, 0, 1.8, 0.45, 1));
  }
  {
    const F = wf(WALLS.E);
    for (const x of [5.84, 8.16]) bx(c.batch, ROOM, stone, F(x, 0.222, 0, 0, 0.16, 2.458, 0.06), true);
    bx(c.batch, ROOM, stone, F(7, 2.68, 0, 0, 2.48, 0.2, 0.08));
    bx(c.batch, ROOM, stone, F(7, 2.88, 0, 0, 2.62, 0.06, 0.12));
    c.batch.add(ROOM, signMat(T.terrace, "gala", "", 0.45), PLANE(), F(7, 3.32, 0.012, 0, 1.5, 0.375, 1));
  }
  // textos de parede (vinil): seção III, introdução e seção I na parede norte; seção II e créditos na sul
  const tx = vinyl("textos", wallTextAtlas(q, lang)), cell = (i: number) => uvPlane(`texto${i}`, (i % 2) * 0.5, 0.5 - Math.floor(i / 2) * 0.5, (i % 2) * 0.5 + 0.5, 1 - Math.floor(i / 2) * 0.5);
  const N = wf(WALLS.N), S = wf(WALLS.S);
  c.batch.add(ROOM, tx, cell(3), N(2.125, 2.45, 0.008, 0, 2.7, 2.7, 1));
  c.batch.add(ROOM, tx, cell(0), N(18.0, 2.45, 0.008, 0, 2.7, 2.7, 1));
  c.batch.add(ROOM, tx, cell(1), N(21.875, 2.45, 0.008, 0, 2.7, 2.7, 1));
  c.batch.add(ROOM, tx, cell(2), S(6.0, 2.45, 0.008, 0, 2.7, 2.7, 1));
  c.batch.add(ROOM, vinyl("legendas", cap2, 0.3), uvPlane("creditos", 0, 0, 0.5, 1), S(18.0, 2.5, 0.008, 0, 2.6, 2.6, 1));
  // inscrição dourada no friso norte
  const fz = friezeText(q, c.copy);
  const gild = once(`galeria-friso-${fz.uuid}`, () => new THREE.MeshStandardMaterial({ map: fz, transparent: true, depthWrite: false, metalness: 0.7, roughness: 0.3, emissiveMap: fz, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.38, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  c.batch.add(ROOM, gild, PLANE(), N(12, 4.566, 0.008, 0, 20, 0.4, 1));
  // arte emoldurada: guaches de joia (moldura laqueada) a oeste, croquis (moldura dourada) a leste
  const W = wf(WALLS.W), E = wf(WALLS.E);
  framed(c, N, 5.25, 1.75, 4, laca()); framed(c, N, 6.75, 1.75, 5, laca());
  framed(c, W, 5.75, 1.75, 6, laca()); framed(c, W, 1.25, 1.75, 7, laca());
  framed(c, E, 9.75, 1.75, 2, c.P.gold); framed(c, E, 14.25, 1.75, 3, c.P.gold);
  // aviso "não toque" ao lado do vão
  c.batch.add(ROOM, signMat(T.handle, "gala", "", 0.35), PLANE(), S(8.95, 1.45, 0.006, 0, 1.0, 0.25, 1));
}
/** Quadro: arte do atlas (w × 1,5w), passe-partout, vidro e moldura de perfil nas quatro bordas. */
function framed(c: RoomsCtx, F: Fr, x: number, y: number, cell: number, frameM: THREE.Material, w = 0.5) {
  const h = w * 1.5, m = 0.07, W = w + 2 * m, Hh = h + 2 * m, prof = moldingGeo("galeria-moldura", FRAME);
  c.batch.add(ROOM, artMat(c.q), artGeo(cell), F(x, y, 0.016, 0, w, h, 1));
  c.batch.add(ROOM, plain("galeria-passepartout", "#ece5d6", { rough: 0.92 }), PLANE(), F(x, y, 0.012, 0, W, Hh, 1));
  bx(c.batch, ROOM, blackSteel(), F(x, y - Hh / 2, 0.004, 0, W, Hh, 0.008));
  c.batch.add(ROOM, vidro(), PLANE(), F(x, y, 0.028, 0, W, Hh, 1));
  c.batch.add(ROOM, frameM, prof, F(x, y + Hh / 2, 0, 0, W + 0.128, 1, 1));
  c.batch.add(ROOM, frameM, prof, F(x, y - Hh / 2, 0, 0, W + 0.128, 1, 1, 0, Math.PI));
  c.batch.add(ROOM, frameM, prof, F(x - W / 2, y, 0, 0, Hh, 1, 1, 0, Math.PI / 2));
  c.batch.add(ROOM, frameM, prof, F(x + W / 2, y, 0, 0, Hh, 1, 1, 0, -Math.PI / 2));
}

/** O nicho do Aurora no eixo norte: anel de gesso profundo, impostas, fecho, degrau de granito e o fundo "amanhecer". */
export function niche(c: RoomsCtx) {
  const q = c.q, F = wf(WALLS.N), x = 12, stone = stoneMat(q);
  c.batch.add(ROOM, stone, archRing("galeria-nicho", 1.45, 0.26, 2.55, 0.3, 0.02), F(x, 0, 0.02), { cast: true });
  for (const s of [-1, 1]) bx(c.batch, ROOM, stone, F(x + s * 1.58, 2.47, 0.16, 0, 0.36, 0.14, 0.36));
  bx(c.batch, ROOM, stone, F(x, 3.92, 0.17, 0, 0.3, 0.36, 0.38));
  bx(c.batch, ROOM, graniteMat(q), F(x, 0, 0.17, 0, 2.9, 0.12, 0.34));
  c.batch.add(ROOM, lit("galeria-auroraLuz", "#ffffff", 1.25, { map: auroraTex() }), archFill("galeria-nicho", 1.45, 2.55), F(x, 0, 0.009));
}
