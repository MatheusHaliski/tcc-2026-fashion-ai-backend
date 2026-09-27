/*
 * Avatar 3D (RF40) / Provador — roupa que veste. Cada peça vira uma malha presa ao MESMO esqueleto do corpo:
 *
 *   1. molde — a partir da própria pele do avatar: os vértices da região que a peça cobre (tronco até a barra, braço
 *      até o punho da manga, pernas até a barra da calça, pés), afastados pela folga da peça ao longo da normal. Saia e
 *      a parte de baixo do vestido não seguem as pernas: são um tubo que desce da cintura, por fora do corpo;
 *   2. caimento — abaixo do busto, blusa, camisa, moletom e jaqueta caem retos do peito (não colam na cintura); a calça
 *      abre para a barra; a manga curta abre na boca;
 *   3. barras — a cobertura é um valor contínuo por vértice (alfa de vértice + alphaTest): barra, gola e punho saem em
 *      curva lisa, não em "escada" de triângulos;
 *   4. pesos — cada vértice da peça herda os pesos de pele do vértice do corpo de onde nasceu (o tubo da saia pesa no
 *      quadril e nas coxas): peça e corpo se movem juntos, sem atravessar;
 *   5. camadas — folga crescente: roupa íntima < legging < calça < camiseta < moletom < jaqueta < casaco; a parte de cima
 *      fica por fora da de baixo na cintura (sem "tuck");
 *   6. foto — a foto sem fundo da peça é projetada de frente, na pose em que o avatar é mostrado, alinhando gola↔alto
 *      da foto, barra↔pé da foto e largura do tronco↔largura do corpo da peça na foto; costas e laterais recebem a cor do
 *      tecido (a foto não mostra as costas — nada de estampa inventada).
 * A geometria é pura (testável em node); a textura precisa de canvas (navegador).
 */
import * as THREE from "three";
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";

export type GarmentKind =
  | "tee" | "tank" | "longsleeve" | "shirt" | "sweater" | "hoodie" | "jacket" | "coat" | "crop"
  | "dress" | "jumpsuit" | "skirt" | "pants" | "shorts" | "leggings" | "shoes" | "boots"
  | "baseTop" | "baseBottom";

export interface GarmentSpec {
  kind: GarmentKind;
  ease: number;          // folga base (m)
  hem: number;           // barra do tronco em h (0 = articulação do quadril, 1 = base do pescoço); NaN = não cobre o tronco
  neck: number;          // gola: até onde sobe no tronco (h), na frente um pouco mais baixo
  vneck: number;         // quanto a gola desce na frente (h)
  waist: number;         // cós: onde começa, para baixo (h); NaN = não é peça de baixo
  sleeve: number;        // manga: até onde desce no braço (0 = ombro, 1 = punho); 0 = sem manga
  leg: number;           // perna: até onde desce (0 = quadril, 1 = tornozelo); 0 = sem perna
  skirt: number;         // saia/vestido: comprimento abaixo da cintura (m); 0 = sem saia
  drape: number;         // 0–1: quanto cai reto do busto
  flare: number;         // abertura na barra (m por unidade de comprimento)
  layer: number;         // ordem de camada (maior = mais por fora)
}

const S = (kind: GarmentKind, o: Partial<GarmentSpec>): GarmentSpec => ({ kind, ease: 0.006, hem: NaN, neck: 1, vneck: 0.04, waist: NaN, sleeve: 0, leg: 0, skirt: 0, drape: 0, flare: 0, layer: 3, ...o });
export const SPECS: Record<GarmentKind, GarmentSpec> = {
  baseTop: S("baseTop", { ease: 0.0015, hem: 0.58, neck: 0.86, vneck: 0.02, layer: 0 }),
  baseBottom: S("baseBottom", { ease: 0.0015, waist: 0.1, leg: 0.07, layer: 0 }),
  leggings: S("leggings", { ease: 0.002, waist: 0.2, leg: 0.97, layer: 1 }),
  pants: S("pants", { ease: 0.009, waist: 0.18, leg: 0.985, flare: 0.03, layer: 2 }),
  shorts: S("shorts", { ease: 0.007, waist: 0.18, leg: 0.36, flare: 0.012, layer: 2 }),
  skirt: S("skirt", { ease: 0.008, waist: 0.2, skirt: 0.42, flare: 0.1, layer: 2 }),
  tank: S("tank", { ease: 0.005, hem: -0.03, neck: 0.9, vneck: 0.06, drape: 0.35, layer: 3 }),
  crop: S("crop", { ease: 0.005, hem: 0.45, neck: 0.95, sleeve: 0.28, drape: 0.2, layer: 3 }),
  tee: S("tee", { ease: 0.007, hem: -0.06, neck: 0.98, sleeve: 0.33, drape: 0.6, flare: 0.02, layer: 3 }),
  longsleeve: S("longsleeve", { ease: 0.007, hem: -0.06, neck: 0.98, sleeve: 0.96, drape: 0.6, layer: 3 }),
  shirt: S("shirt", { ease: 0.008, hem: -0.1, neck: 1.02, vneck: 0.07, sleeve: 0.96, drape: 0.7, layer: 3 }),
  sweater: S("sweater", { ease: 0.011, hem: -0.07, neck: 1.0, sleeve: 0.97, drape: 0.75, layer: 4 }),
  hoodie: S("hoodie", { ease: 0.014, hem: -0.08, neck: 1.03, sleeve: 0.97, drape: 0.8, layer: 4 }),
  jacket: S("jacket", { ease: 0.018, hem: -0.08, neck: 1.03, vneck: 0.12, sleeve: 0.98, drape: 0.85, layer: 5 }),
  coat: S("coat", { ease: 0.022, hem: -0.08, neck: 1.03, vneck: 0.14, sleeve: 0.99, drape: 0.9, skirt: 0.5, flare: 0.08, layer: 6 }),
  dress: S("dress", { ease: 0.006, hem: 0.36, neck: 0.9, vneck: 0.05, skirt: 0.5, flare: 0.14, drape: 0.2, layer: 3 }),
  jumpsuit: S("jumpsuit", { ease: 0.008, hem: -0.2, neck: 0.95, vneck: 0.06, waist: 1, leg: 0.97, flare: 0.01, drape: 0.3, layer: 3 }),
  shoes: S("shoes", { ease: 0.006, layer: 2 }),
  boots: S("boots", { ease: 0.007, layer: 2 }),
};

/** Tipo de molde pela subcategoria da peça (taxonomia do app); null = acessório (não é roupa de vestir). */
export function kindOf(p: { category?: string | null; subcategory?: string | null; slot?: string | null }): GarmentKind | null {
  const sub = (p.subcategory ?? "").toLowerCase(); const cat = (p.category ?? p.slot ?? "").toUpperCase();
  const is = (...k: string[]) => k.some((x) => sub.includes(x));
  if (is("legging")) return "leggings";
  if (is("skirt", "saia") && !is("short")) return "skirt";
  if (is("short", "bermuda")) return "shorts";
  if (is("pant", "jean", "trouser", "calca", "calça", "jogger", "chino", "cargo", "sweatpant")) return "pants";
  if (is("dress", "vestido")) return "dress";
  if (is("jumpsuit", "macac", "overall", "romper", "playsuit")) return "jumpsuit";
  if (is("boot", "bota", "coturno")) return "boots";
  if (is("sneaker", "tenis", "tênis", "shoe", "sapato", "loafer", "oxford", "derby", "mocass", "sandal", "sandál", "heel", "salto", "slipper", "chinelo", "flat", "sapatilha", "alpargata", "espadrille")) return "shoes";
  if (is("coat", "casaco", "parka", "trench", "overcoat")) return "coat";
  if (is("jacket", "jaqueta", "blazer", "windbreaker", "corta", "bomber", "cardigan", "kimono", "quimono", "vest", "colete")) return "jacket";
  if (is("hoodie", "capuz")) return "hoodie";
  if (is("sweater", "sueter", "suéter", "sweatshirt", "moletom", "pullover", "knit")) return "sweater";
  if (is("tank", "regata", "camisole", "bodysuit", "body")) return "tank";
  if (is("crop")) return "crop";
  if (is("shirt", "camisa", "blouse", "blusa")) return is("t_shirt", "tshirt", "t-shirt", "camiseta") ? "tee" : "shirt";
  if (is("long_sleeve", "manga_longa", "longsleeve")) return "longsleeve";
  if (is("tee", "camiseta", "polo", "top")) return "tee";
  if (cat === "UPPER" || cat === "TOP" || cat === "PARTE_SUPERIOR") return "tee";
  if (cat === "LOWER" || cat === "BOTTOM" || cat === "PARTE_INFERIOR") return "pants";
  if (cat === "SHOES" || cat === "FOOTWEAR" || cat === "CALCADOS") return "shoes";
  if (cat === "FULL_BODY" || cat === "CORPO_INTEIRO") return "dress";
  return null;
}
export const covers = (k: GarmentKind) => ({
  upper: !["pants", "shorts", "skirt", "leggings", "shoes", "boots", "baseBottom"].includes(k),
  lower: ["pants", "shorts", "skirt", "leggings", "dress", "jumpsuit", "baseBottom", "coat"].includes(k),
  feet: k === "shoes" || k === "boots",
});

// ================================================================== parametrização do corpo

export interface BodyParam {
  group: Uint8Array;          // 0 cabeça, 1 tronco, 2 braço, 3 perna, 4 pé, 5 mão
  side: Int8Array;            // +1 esquerdo da pessoa (x > 0), −1 direito
  h: Float32Array;            // altura no tronco: 0 = articulação do quadril, 1 = base do pescoço
  arm: Float32Array;          // ao longo do braço: 0 = ombro, 1 = punho
  leg: Float32Array;          // ao longo da perna: 0 = quadril, 1 = tornozelo
  hipY: number; neckY: number; ankleY: number; torsoZ: number;
}

export function bodyParam(a: BodyAsset, c: Composed): BodyParam {
  const nb = a.meta.counts.body; const names = a.meta.bones.map((b) => b.name.replace("mixamorig:", ""));
  const J = (n: string) => { const i = names.indexOf(n); return [c.joints[i * 3], c.joints[i * 3 + 1], c.joints[i * 3 + 2]]; };
  const grp = names.map((n) => (n === "Head" ? 0 : /Hand|Thumb|Index|Middle|Ring|Pinky/.test(n) ? 5 : /Arm/.test(n) ? 2 : /UpLeg|Leg$/.test(n) ? 3 : /Foot|Toe/.test(n) ? 4 : 1));
  const hipY = (J("LeftUpLeg")[1] + J("RightUpLeg")[1]) / 2, neckY = J("Neck")[1], ankleY = (J("LeftFoot")[1] + J("RightFoot")[1]) / 2;
  const out: BodyParam = { group: new Uint8Array(nb), side: new Int8Array(nb), h: new Float32Array(nb), arm: new Float32Array(nb), leg: new Float32Array(nb), hipY, neckY, ankleY, torsoZ: J("Spine1")[2] };
  const S0 = { L: J("LeftArm"), R: J("RightArm") }, W0 = { L: J("LeftHand"), R: J("RightHand") };
  for (let v = 0; v < nb; v++) {
    const x = c.body[v * 3], y = c.body[v * 3 + 1], z = c.body[v * 3 + 2];
    out.group[v] = grp[a.body.skinIndex[v * 4]]; out.side[v] = x >= 0 ? 1 : -1;
    out.h[v] = (y - hipY) / (neckY - hipY);
    const s = x >= 0 ? "L" : "R"; const Sp = S0[s], Wp = W0[s];
    const d = [Wp[0] - Sp[0], Wp[1] - Sp[1], Wp[2] - Sp[2]]; const L2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
    out.arm[v] = ((x - Sp[0]) * d[0] + (y - Sp[1]) * d[1] + (z - Sp[2]) * d[2]) / L2;
    out.leg[v] = (hipY - y) / (hipY - ankleY);
  }
  return out;
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Cobertura contínua (0–1) de um vértice do corpo por uma peça. Largura da transição ≈ 1,5–2 cm. */
function coverage(sp: GarmentSpec, P: BodyParam, v: number, z: number): number {
  const g = P.group[v], h = P.h[v], arm = P.arm[v], leg = P.leg[v];
  const dh = 0.03, da = 0.035, dl = 0.02;
  const front = z > P.torsoZ ? 1 : 0;
  const neckTop = sp.neck - sp.vneck * front;
  if (sp.kind === "shoes" || sp.kind === "boots") {
    if (g === 4) return 1;
    return g === 3 ? smooth(sp.kind === "boots" ? 0.72 : 0.955, sp.kind === "boots" ? 0.74 : 0.975, leg) : 0;
  }
  let c = 0;
  if (!Number.isNaN(sp.hem) && (g === 1 || g === 2 || g === 3)) {
    // tronco (e o alto das coxas quando a barra passa do quadril)
    const inTorso = smooth(sp.hem - dh, sp.hem + dh, h) * (1 - smooth(neckTop - dh, neckTop + dh, h));
    if (g === 1) c = Math.max(c, inTorso);
    if (g === 3 && sp.hem < 0) c = Math.max(c, inTorso * (1 - smooth(0.02, 0.06, leg)));
    if (g === 2) c = Math.max(c, sp.sleeve > 0 ? 1 - smooth(sp.sleeve - da, sp.sleeve + da, arm) : 1 - smooth(-0.06, 0.0, arm));
    if (g === 2 && sp.sleeve === 0) c *= inTorso;                             // regata: cava sem manga
  }
  if (!Number.isNaN(sp.waist)) {
    const below = 1 - smooth(sp.waist - dh, sp.waist + dh, h);
    if (g === 1) c = Math.max(c, below);
    if (g === 3 && sp.leg > 0) c = Math.max(c, 1 - smooth(sp.leg - dl, sp.leg + dl, leg));
  }
  return c;
}

export interface GarmentGeometry {
  spec: GarmentSpec;
  position: Float32Array; alpha: Float32Array; skinIndex: Uint16Array; skinWeight: Float32Array; index: Uint32Array;
  source: Int32Array;         // vértice do corpo de onde nasceu (−1 = tubo da saia)
}

/** Anel do corpo (raio máximo por ângulo) na altura y, só tronco e pernas, em volta do eixo (0, z0). */
function ring(c: Composed, P: BodyParam, y: number, z0: number, NA: number, band = 0.012): Float32Array {
  const r = new Float32Array(NA); const nb = P.h.length;
  for (let v = 0; v < nb; v++) {
    const g = P.group[v]; if (g !== 1 && g !== 3) continue;
    if (Math.abs(c.body[v * 3 + 1] - y) > band) continue;
    const x = c.body[v * 3], z = c.body[v * 3 + 2] - z0; const j = Math.round(((Math.atan2(x, z) + Math.PI) / (2 * Math.PI)) * NA) % NA;
    r[j] = Math.max(r[j], Math.hypot(x, z));
  }
  for (let j = 0; j < NA; j++) if (!r[j]) { let b = 0; for (let d = 1; d < NA / 2 && !b; d++) b = Math.max(r[(j + d) % NA], r[(j - d + NA) % NA]); r[j] = b; }
  // suaviza (o anel é o "casco" do corpo, sem reentrâncias entre as pernas)
  const out = new Float32Array(NA);
  for (let j = 0; j < NA; j++) { let m = 0; for (let d = -2; d <= 2; d++) m = Math.max(m, r[(j + d + NA) % NA]); out[j] = m; }
  return out;
}

/**
 * Geometria da peça em repouso (coordenadas do corpo, pose "A" do esqueleto). `normals` são as normais da malha base.
 * `under` = folga extra por vértice (underLayer) para passar por fora das peças já vestidas por baixo.
 */
export function coverageOf(c: Composed, P: BodyParam, sp: GarmentSpec): Float32Array {
  const nb = P.h.length; const cov = new Float32Array(nb);
  for (let v = 0; v < nb; v++) cov[v] = coverage(sp, P, v, c.body[v * 3 + 2]);
  return cov;
}

/** Folga extra por vértice para que uma peça passe por fora das que já estão vestidas por baixo. */
export function underLayer(c: Composed, P: BodyParam, below: GarmentSpec[]): Float32Array {
  const out = new Float32Array(P.h.length);
  for (const sp of below) {
    const cov = coverageOf(c, P, sp); const e = sp.ease + 0.004 + sp.flare * 0.3;
    for (let v = 0; v < out.length; v++) if (cov[v] > 0.02) out[v] = Math.max(out[v], e);
  }
  return out;
}

export function garmentGeometry(a: BodyAsset, c: Composed, normals: Float32Array, P: BodyParam, sp: GarmentSpec, under: Float32Array | null = null): GarmentGeometry | null {
  const nb = a.meta.counts.body; const cov = coverageOf(c, P, sp);
  const rv = a.body.renderVertex; const idx = a.body.index;
  const used = new Int32Array(nb).fill(-1); const tris: number[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    const p = rv[idx[t]], q = rv[idx[t + 1]], r = rv[idx[t + 2]];
    if (Math.max(cov[p], cov[q], cov[r]) > 0.02 && Math.min(cov[p], cov[q], cov[r]) >= 0 && (cov[p] + cov[q] + cov[r]) > 0.3) tris.push(p, q, r);
  }
  const skirtTop = sp.skirt > 0 ? (sp.kind === "dress" ? sp.hem : sp.kind === "coat" ? 0.0 : sp.waist) : NaN;
  const pos: number[] = [], al: number[] = [], si: number[] = [], sw: number[] = [], src: number[] = [];
  // caimento: anel do busto
  const NA = 64; const bustY = lerp(P.hipY, P.neckY, 0.72);
  const bust = sp.drape > 0 ? ring(c, P, bustY, P.torsoZ, NA, 0.015) : null;
  const add = (v: number) => {
    if (used[v] >= 0) return used[v];
    const i = pos.length / 3; used[v] = i;
    const g = P.group[v]; const h = P.h[v];
    let e = sp.ease + (under ? under[v] : 0);
    if (g === 2 && sp.sleeve > 0) e += sp.flare * smooth(sp.sleeve * 0.3, sp.sleeve, P.arm[v]) * (sp.sleeve < 0.6 ? 1 : 0.3) + 0.002;
    if (g === 3 && sp.leg > 0) e += sp.flare * Math.max(0, P.leg[v] - 0.4);
    if (sp.kind === "shoes" || sp.kind === "boots") e += 0.004 * smooth(-0.02, -0.12, c.body[v * 3 + 2] - (P.torsoZ + 0.05));   // biqueira
    let x = c.body[v * 3] + normals[v * 3] * e, y = c.body[v * 3 + 1] + normals[v * 3 + 1] * e, z = c.body[v * 3 + 2] + normals[v * 3 + 2] * e;
    // cai reto do busto (não cola na cintura nem na barriga)
    if (bust && (g === 1 || g === 3) && h < 0.72 && h > sp.hem - 0.1) {
      const zz = z - P.torsoZ; const r = Math.hypot(x, zz); const j = Math.round(((Math.atan2(x, zz) + Math.PI) / (2 * Math.PI)) * NA) % NA;
      const target = bust[j] * 0.965 + e; const k = sp.drape * smooth(0.72, 0.5, h) * (0.15 + 0.85 * Math.abs(zz) / r);   // cai reto na frente e atrás; dos lados, o braço encosta
      if (target > r && r > 1e-4) { const nr = lerp(r, target, k); x *= nr / r; z = P.torsoZ + (zz * nr) / r; }
    }
    if ((sp.kind === "shoes" || sp.kind === "boots") && c.body[v * 3 + 1] < 0.018) y = Math.min(y, -0.004 - 0.008 * smooth(0.018, 0.0, c.body[v * 3 + 1]));   // sola
    pos.push(x, y, z); al.push(cov[v]); src.push(v);
    for (let k = 0; k < 4; k++) { const w = a.body.skinWeight[v * 4 + k]; si.push(w ? a.body.skinIndex[v * 4 + k] : 0); sw.push(w / 255); }
    return i;
  };
  const index: number[] = [];
  for (let t = 0; t < tris.length; t += 3) {
    const [p, q, r] = [tris[t], tris[t + 1], tris[t + 2]];
    // a saia/vestido de baixo é o tubo: o molde não desce pelas pernas abaixo do começo da saia
    if (!Number.isNaN(skirtTop) && [p, q, r].every((v) => P.group[v] === 3 || P.h[v] < skirtTop - 0.02)) continue;
    index.push(add(p), add(q), add(r));
  }
  // ---- tubo da saia (saia, vestido, casaco longo)
  if (sp.skirt > 0) {
    const y0 = lerp(P.hipY, P.neckY, skirtTop), y1 = y0 - sp.skirt;
    const rows = Math.max(6, Math.ceil(sp.skirt / 0.012)); const base = pos.length / 3; const names = a.meta.bones.map((b) => b.name);
    const hips = names.indexOf("mixamorig:Hips"), upL = names.indexOf("mixamorig:LeftUpLeg"), upR = names.indexOf("mixamorig:RightUpLeg");
    let prev: Float32Array | null = null;
    for (let i = 0; i <= rows; i++) {
      const y = y0 - (sp.skirt * i) / rows; const t = i / rows;
      const body = ring(c, P, y, P.torsoZ, NA, 0.014);
      const rr = new Float32Array(NA);
      for (let j = 0; j < NA; j++) {
        let r = body[j] + sp.ease + 0.004 + sp.flare * t * t * 0.5 + sp.flare * t * 0.5;
        if (prev) r = Math.max(r, prev[j] - 0.002);                          // o tecido não entra de volta
        rr[j] = r;
        const phi = (j / NA) * 2 * Math.PI - Math.PI;
        pos.push(Math.sin(phi) * r, y, P.torsoZ + Math.cos(phi) * r);
        al.push(1 - smooth(0.93, 1.0, t) * 0.0); src.push(-1);
        const leg = Math.sin(phi) >= 0 ? upL : upR; const wl = 0.55 * smooth(0.1, 0.9, t) * Math.min(1, Math.abs(Math.sin(phi)) * 1.6);
        si.push(hips, leg, 0, 0); sw.push(1 - wl, wl, 0, 0);
      }
      prev = rr;
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < NA; j++) {
      const j2 = (j + 1) % NA; const p = base + i * NA + j, q = base + i * NA + j2, r = base + (i + 1) * NA + j, s2 = base + (i + 1) * NA + j2;
      index.push(p, r, q, q, r, s2);
    }
  }
  if (index.length < 30) return null;
  return { spec: sp, position: Float32Array.from(pos), alpha: Float32Array.from(al), skinIndex: Uint16Array.from(si), skinWeight: Float32Array.from(sw), index: Uint32Array.from(index), source: Int32Array.from(src) };
}

// ================================================================== pose de exibição (CPU) e textura

/** Posições de uma geometria presa ao esqueleto na pose atual dos ossos (skinning linear, como no shader). */
export function posedPositions(skeleton: THREE.Skeleton, bindMatrix: THREE.Matrix4, position: Float32Array, skinIndex: ArrayLike<number>, skinWeight: ArrayLike<number>): Float32Array {
  skeleton.bones.forEach((b) => b.updateMatrixWorld(true));
  const M = skeleton.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, skeleton.boneInverses[i]).multiply(bindMatrix));
  const out = new Float32Array(position.length); const p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let v = 0; v < position.length / 3; v++) {
    p.set(position[v * 3], position[v * 3 + 1], position[v * 3 + 2]); let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k++) { const w = skinWeight[v * 4 + k]; if (!w) continue; q.copy(p).applyMatrix4(M[skinIndex[v * 4 + k]]); x += w * q.x; y += w * q.y; z += w * q.z; }
    out[v * 3] = x; out[v * 3 + 1] = y; out[v * 3 + 2] = z;
  }
  return out;
}

export interface PhotoInfo { width: number; height: number; box: { x0: number; y0: number; x1: number; y1: number }; widthAt: (fy: number) => { x0: number; x1: number } | null }

/** Caixa da parte opaca da foto e a largura dela em cada altura (fração da caixa). */
export function photoInfo(img: CanvasImageSource & { width: number; height: number }): PhotoInfo | null {
  const W = 256, H = Math.max(1, Math.round((256 * img.height) / img.width));
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d", { willReadFrequently: true }); if (!g) return null;
  g.drawImage(img, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  const k = img.width / W;
  return {
    width: img.width, height: img.height, box: { x0: x0 * k, y0: y0 * k, x1: (x1 + 1) * k, y1: (y1 + 1) * k },
    widthAt: (fy) => {
      const y = Math.round(y0 + (y1 - y0) * fy); let a = -1, b = -1;
      for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 128) { if (a < 0) a = x; b = x; }
      return a < 0 ? null : { x0: a * k, x1: (b + 1) * k };
    },
  };
}

/**
 * Geometria final para desenhar: triângulos da frente (na pose de exibição) com UV na foto; os de trás e dos lados com
 * UV num canto de cor lisa do tecido (a textura é foto sobre fundo da cor do tecido). Vértices duplicados na divisa.
 */
export function texturedGeometry(gg: GarmentGeometry, posed: Float32Array, photo: PhotoInfo | null): THREE.BufferGeometry {
  const sp = gg.spec; const n = gg.index.length / 3;
  // referência na foto e no molde (pose de exibição)
  let map: ((x: number, y: number) => [number, number]) | null = null;
  if (photo && sp.kind !== "shoes" && sp.kind !== "boots") {
    let yTop = -Infinity, yBot = Infinity; const front: number[] = [];
    for (let v = 0; v < posed.length / 3; v++) if (gg.alpha[v] > 0.5) { const y = posed[v * 3 + 1]; yTop = Math.max(yTop, y); yBot = Math.min(yBot, y); front.push(v); }
    const fy = sp.kind === "pants" || sp.kind === "shorts" || sp.kind === "skirt" || sp.kind === "leggings" ? 0.12 : 0.62;
    const yRef = yTop - (yTop - yBot) * fy;
    let xl = Infinity, xr = -Infinity;
    for (const v of front) if (Math.abs(posed[v * 3 + 1] - yRef) < 0.012 && (gg.source[v] < 0 || true)) { xl = Math.min(xl, posed[v * 3]); xr = Math.max(xr, posed[v * 3]); }
    const pw = photo.widthAt(fy);
    if (Number.isFinite(xl) && pw && xr > xl) {
      const { box } = photo; const sx = (pw.x1 - pw.x0) / (xr - xl); const cxP = (pw.x0 + pw.x1) / 2, cxG = (xl + xr) / 2;
      const sy = (box.y1 - box.y0) / Math.max(0.05, yTop - yBot);
      map = (x, y) => [(cxP + (x - cxG) * sx) / photo.width, 1 - (box.y0 + (yTop - y) * sy) / photo.height];
    }
  }
  const pos: number[] = [], uv: number[] = [], col: number[] = [], si: number[] = [], sw: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const P = (v: number, o: THREE.Vector3) => o.set(posed[v * 3], posed[v * 3 + 1], posed[v * 3 + 2]);
  const cache = new Map<string, number>(); const index: number[] = [];
  for (let t = 0; t < n; t++) {
    const vs = [gg.index[t * 3], gg.index[t * 3 + 1], gg.index[t * 3 + 2]];
    P(vs[0], a); P(vs[1], b); P(vs[2], c); const nz = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize().z;
    const isFront = !!map && nz > 0.2;
    for (const v of vs) {
      const key = `${v}:${isFront ? 1 : 0}`; let i = cache.get(key);
      if (i === undefined) {
        i = pos.length / 3; cache.set(key, i);
        pos.push(gg.position[v * 3], gg.position[v * 3 + 1], gg.position[v * 3 + 2]);
        if (isFront && map) { const [u, w] = map(posed[v * 3], posed[v * 3 + 1]); uv.push(Math.min(0.999, Math.max(0.001, u)), Math.min(0.999, Math.max(0.001, w))); } else uv.push(0.0015, 0.9985);
        col.push(1, 1, 1, gg.alpha[v]);
        for (let k = 0; k < 4; k++) { si.push(gg.skinIndex[v * 4 + k]); sw.push(gg.skinWeight[v * 4 + k]); }
      }
      index.push(i);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(index); g.computeVertexNormals();
  return g;
}

/** Textura: fundo na cor do tecido (costas, laterais, onde a foto é transparente) e a foto por cima. */
export function garmentTexture(img: (CanvasImageSource & { width: number; height: number }) | null, fabric: string): THREE.CanvasTexture {
  const W = img ? Math.min(1024, img.width) : 16, H = img ? Math.round((W * img.height) / img.width) : 16;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d")!;
  g.fillStyle = fabric; g.fillRect(0, 0, W, H);
  if (img) { g.drawImage(img, 0, 0, W, H); g.fillStyle = fabric; g.fillRect(0, 0, 3, 3); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** Calçado: cor do cabedal (parte de cima da foto) e da sola (faixa de baixo), medianas dos pixels opacos. */
export function shoeColors(img: (CanvasImageSource & { width: number; height: number }) | null | undefined, fallback?: string | null): { upper: string; sole: string } {
  const base = fallback && /^#[0-9a-f]{6}$/i.test(fallback) ? fallback : "#5a5a5a";
  if (!img || typeof document === "undefined") return { upper: base, sole: "#e8e4dc" };
  const W = 64, H = Math.max(8, Math.round((64 * img.height) / img.width));
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d", { willReadFrequently: true }); if (!g) return { upper: base, sole: "#e8e4dc" };
  g.drawImage(img, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
  let y0 = H, y1 = -1; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 128) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (y1 < 0) return { upper: base, sole: "#e8e4dc" };
  const med = (ys: [number, number]) => { const ch: number[][] = [[], [], []];
    for (let y = ys[0]; y <= ys[1]; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; if (d[o + 3] > 200) for (let k = 0; k < 3; k++) ch[k].push(d[o + k]); }
    if (ch[0].length < 5) return null; return "#" + ch.map((a) => { const v = a.sort((p, q) => p - q)[a.length >> 1]; return v.toString(16).padStart(2, "0"); }).join(""); };
  const hgt = y1 - y0;
  return { upper: med([y0 + Math.round(hgt * 0.15), y0 + Math.round(hgt * 0.7)]) ?? base, sole: med([y1 - Math.max(1, Math.round(hgt * 0.12)), y1]) ?? "#e8e4dc" };
}

/** Cor do tecido: mediana dos pixels opacos do miolo da foto (sem bordas, sombras e recorte). */
export function fabricColor(img: (CanvasImageSource & { width: number; height: number }) | null | undefined, fallback?: string | null): string {
  const base = fallback && /^#[0-9a-f]{6}$/i.test(fallback) ? fallback : "#8a8a8a";
  if (!img || typeof document === "undefined") return base;
  try {
    const c = document.createElement("canvas"); c.width = 48; c.height = 48; const g = c.getContext("2d", { willReadFrequently: true }); if (!g) return base;
    g.drawImage(img, 0, 0, 48, 48); const d = g.getImageData(8, 8, 32, 32).data; const ch: number[][] = [[], [], []];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { ch[0].push(d[i]); ch[1].push(d[i + 1]); ch[2].push(d[i + 2]); }
    if (ch[0].length < 20) return base;
    const med = (arr: number[]) => { const v = [...arr].sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
    return "#" + ch.map((arr) => med(arr).toString(16).padStart(2, "0")).join("");
  } catch { return base; }
}

export function garmentMaterial(tex: THREE.Texture, sp: GarmentSpec): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    map: tex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: sp.kind === "jacket" || sp.kind === "coat" ? 0.7 : 0.85,
    sheen: 0.5, sheenRoughness: 0.8, sheenColor: new THREE.Color("#ffffff"), polygonOffset: true, polygonOffsetFactor: -sp.layer, polygonOffsetUnits: -sp.layer,
  });
  m.name = `roupa-${sp.kind}`;
  return m;
}
