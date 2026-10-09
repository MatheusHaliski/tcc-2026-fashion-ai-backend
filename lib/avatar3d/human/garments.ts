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
 *   5. camadas — folga crescente: legging < calça < camiseta < moletom < jaqueta < casaco; a parte de cima
 *      fica por fora da de baixo na cintura (sem "tuck");
 *   6. foto — a foto sem fundo da peça é projetada de frente, na pose em que o avatar é mostrado, alinhando gola↔alto
 *      da foto, barra↔pé da foto e largura do tronco↔largura do corpo da peça na foto; costas e laterais recebem a cor do
 *      tecido (a foto não mostra as costas — nada de estampa inventada).
 * A geometria é pura (testável em node); a textura precisa de canvas (navegador).
 */
import * as THREE from "three";
import { fabricRows, fabricTile } from "./garment-photo";
import { baseNormals } from "./three-human";
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";

export type GarmentKind =
  | "tee" | "tank" | "longsleeve" | "shirt" | "sweater" | "hoodie" | "jacket" | "coat" | "crop"
  | "dress" | "jumpsuit" | "skirt" | "pants" | "shorts" | "leggings" | "shoes" | "boots";

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
  leggings: S("leggings", { ease: 0.002, waist: 0.2, leg: 0.97, layer: 1 }),
  pants: S("pants", { ease: 0.009, waist: 0.18, leg: 0.985, flare: 0.03, layer: 2 }),
  shorts: S("shorts", { ease: 0.007, waist: 0.18, leg: 0.36, flare: 0.012, layer: 2 }),
  skirt: S("skirt", { ease: 0.008, waist: 0.2, skirt: 0.42, flare: 0.1, layer: 2 }),
  tank: S("tank", { ease: 0.005, hem: -0.03, neck: 0.9, vneck: 0.14, drape: 0.35, layer: 3 }),
  crop: S("crop", { ease: 0.005, hem: 0.45, neck: 0.95, vneck: 0.09, sleeve: 0.28, drape: 0.2, layer: 3 }),
  tee: S("tee", { ease: 0.007, hem: -0.06, neck: 0.98, vneck: 0.09, sleeve: 0.33, drape: 0.6, flare: 0.02, layer: 3 }),
  longsleeve: S("longsleeve", { ease: 0.007, hem: -0.06, neck: 0.98, vneck: 0.09, sleeve: 0.96, drape: 0.6, layer: 3 }),
  shirt: S("shirt", { ease: 0.008, hem: -0.1, neck: 1.02, vneck: 0.11, sleeve: 0.96, drape: 0.7, layer: 3 }),
  sweater: S("sweater", { ease: 0.011, hem: -0.07, neck: 1.0, vneck: 0.08, sleeve: 0.97, drape: 0.75, layer: 4 }),
  hoodie: S("hoodie", { ease: 0.014, hem: -0.08, neck: 1.03, vneck: 0.07, sleeve: 0.97, drape: 0.8, layer: 4 }),
  jacket: S("jacket", { ease: 0.018, hem: -0.08, neck: 1.03, vneck: 0.12, sleeve: 0.98, drape: 0.85, layer: 5 }),
  coat: S("coat", { ease: 0.022, hem: -0.08, neck: 1.03, vneck: 0.14, sleeve: 0.99, drape: 0.9, skirt: 0.5, flare: 0.08, layer: 6 }),
  dress: S("dress", { ease: 0.006, hem: 0.36, neck: 0.9, vneck: 0.1, skirt: 0.5, flare: 0.14, drape: 0.2, layer: 3 }),
  jumpsuit: S("jumpsuit", { ease: 0.008, hem: -0.2, neck: 0.95, vneck: 0.1, waist: 1, leg: 0.97, flare: 0.01, drape: 0.3, layer: 3 }),
  shoes: S("shoes", { ease: 0.008, layer: 2 }),
  boots: S("boots", { ease: 0.009, layer: 2 }),
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
  // subcategoria desconhecida: pela categoria gravada ("upper_piece"…) ou pelo lugar no look ("upper", "outer_layer"…)
  const cats = [cat, (p.slot ?? "").toUpperCase()].map((c) => c.replace(/_PIECE$/, ""));
  const any = (...k: string[]) => cats.some((c) => k.includes(c));
  if (any("OUTER_LAYER", "OUTERWEAR")) return "jacket";
  if (any("FULL_BODY", "CORPO_INTEIRO", "DRESS")) return "dress";
  if (any("UPPER", "TOP", "PARTE_SUPERIOR")) return "tee";
  if (any("LOWER", "BOTTOM", "PARTE_INFERIOR")) return "pants";
  if (any("SHOES", "FOOTWEAR", "CALCADOS")) return "shoes";
  return null;
}

/**
 * Afastamento dos braços (graus) na pose de exibição para o look: saia rodada pede as mãos por fora dela, e camadas
 * grossas no tronco (jaqueta sobre camiseta, casaco sobre suéter) pedem o braço mais aberto — como numa pessoa de
 * casaco, o braço não "entra" na lateral do tronco. Espessura na axila = folga da peça + a maior das de baixo.
 */
export function armOutFor(specs: GarmentSpec[]): number {
  let out = 10; let under = 0;
  for (const sp of [...specs].sort((a, b) => a.layer - b.layer)) {
    if (sp.skirt > 0) out = Math.max(out, 15);
    if (Number.isNaN(sp.hem)) continue;                                  // não cobre o tronco
    const thick = sp.ease + under;
    out = Math.max(out, Math.min(18, 10 + (thick - 0.012) * 350));
    under = Math.max(under, sp.ease + 0.004 + sp.flare * 0.3);
  }
  return Math.round(out * 10) / 10;
}

// ================================================================== parametrização do corpo

export interface BodyParam {
  group: Uint8Array;          // 0 cabeça, 1 tronco, 2 braço, 3 perna, 4 pé, 5 mão
  side: Int8Array;            // +1 esquerdo da pessoa (x > 0), −1 direito
  h: Float32Array;            // altura no tronco: 0 = articulação do quadril, 1 = base do pescoço
  arm: Float32Array;          // ao longo do braço: 0 = ombro, 1 = punho
  leg: Float32Array;          // ao longo da perna: 0 = quadril, 1 = tornozelo
  hipY: number; neckY: number; ankleY: number; torsoZ: number;
  neckZ: number;              // eixo do pescoço (z da articulação Neck): centro do decote e da gola
  /** ombro e punho (articulações) de cada lado: eixo do braço, para punhos e barras de manga */
  shoulder?: { L: number[]; R: number[] }; wrist?: { L: number[]; R: number[] };
}

export function bodyParam(a: BodyAsset, c: Composed): BodyParam {
  const nb = a.meta.counts.body; const names = a.meta.bones.map((b) => b.name.replace("mixamorig:", ""));
  const J = (n: string) => { const i = names.indexOf(n); return [c.joints[i * 3], c.joints[i * 3 + 1], c.joints[i * 3 + 2]]; };
  const grp = names.map((n) => (n === "Head" ? 0 : /Hand|Thumb|Index|Middle|Ring|Pinky/.test(n) ? 5 : /Arm/.test(n) ? 2 : /UpLeg|Leg$/.test(n) ? 3 : /Foot|Toe/.test(n) ? 4 : 1));
  const hipY = (J("LeftUpLeg")[1] + J("RightUpLeg")[1]) / 2, neckY = J("Neck")[1], ankleY = (J("LeftFoot")[1] + J("RightFoot")[1]) / 2;
  const out: BodyParam = { group: new Uint8Array(nb), side: new Int8Array(nb), h: new Float32Array(nb), arm: new Float32Array(nb), leg: new Float32Array(nb), hipY, neckY, ankleY, torsoZ: J("Spine1")[2], neckZ: J("Neck")[2] };
  const S0 = { L: J("LeftArm"), R: J("RightArm") }, W0 = { L: J("LeftHand"), R: J("RightHand") };
  out.shoulder = S0; out.wrist = W0;
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
/**
 * Altura (h) do decote no ângulo em volta do pescoço: na nuca `neck`, na frente `neck − vneck`, com transição suave
 * pelos lados (antes era um degrau em z = tronco, que deixava a borda torta dos lados e alta demais na frente).
 */
export function necklineH(sp: GarmentSpec, x: number, dz: number): number {
  const r = Math.hypot(x, dz) || 1;
  const front = smooth(-0.2, 0.75, dz / r);                // 0 atrás · 1 na frente
  return sp.neck - sp.vneck * Math.pow(front, 1.4);
}

function coverage(sp: GarmentSpec, P: BodyParam, v: number, x: number, z: number): number {
  const g = P.group[v], h = P.h[v], arm = P.arm[v], leg = P.leg[v];
  const dh = 0.03, da = 0.035, dl = 0.02;
  const neckTop = necklineH(sp, x, z - P.neckZ);
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
 * Raio do casco convexo do tronco por ângulo na altura y (função suporte: max r_k·cos(θ_k − θ_j)). Peça solta passa
 * por cima do vão entre os seios e das reentrâncias, como o tecido de verdade, em vez de desenhar o corpo.
 */
function hullRing(c: Composed, P: BodyParam, y: number, z0: number, NA: number): Float32Array {
  const r = ring(c, P, y, z0, NA, 0.012); const out = new Float32Array(NA);
  for (let j = 0; j < NA; j++) { let m = r[j]; for (let d = -NA / 4; d <= NA / 4; d++) { const k = (j + d + NA) % NA; m = Math.max(m, r[k] * Math.cos((d * 2 * Math.PI) / NA)); } out[j] = m; }
  return out;
}

/**
 * Geometria da peça em repouso (coordenadas do corpo, pose "A" do esqueleto). `normals` são as normais da malha base.
 * `under` = folga extra por vértice (underLayer) para passar por fora das peças já vestidas por baixo.
 */
export function coverageOf(c: Composed, P: BodyParam, sp: GarmentSpec): Float32Array {
  const nb = P.h.length; const cov = new Float32Array(nb);
  for (let v = 0; v < nb; v++) cov[v] = coverage(sp, P, v, c.body[v * 3], c.body[v * 3 + 2]);
  return cov;
}

/** Tubo de saia/vestido/casaco longo: raio (em volta do eixo (0, torsoZ)) por linha e por ângulo. */
export interface SkirtTube { y0: number; len: number; r: Float32Array[] }
const TUBE_NA = 64;

function skirtTop(sp: GarmentSpec): number { return sp.kind === "dress" ? sp.hem : sp.kind === "coat" ? 0.0 : sp.waist; }

/** Anéis do tubo da saia de uma peça (os mesmos que `garmentGeometry` usa para montá-la). */
function skirtTube(c: Composed, P: BodyParam, sp: GarmentSpec, under: UnderLayer | null): SkirtTube {
  const y0 = lerp(P.hipY, P.neckY, skirtTop(sp)); const rows = Math.max(6, Math.ceil(sp.skirt / 0.012));
  const r: Float32Array[] = []; let prev: Float32Array | null = null;
  for (let i = 0; i <= rows; i++) {
    const y = y0 - (sp.skirt * i) / rows; const t = i / rows;
    const body = ring(c, P, y, P.torsoZ, TUBE_NA, 0.014); const rr = new Float32Array(TUBE_NA);
    for (let j = 0; j < TUBE_NA; j++) {
      let v = body[j] + sp.ease + 0.004 + sp.flare * t * t * 0.5 + sp.flare * t * 0.5;
      if (under) for (const tb of under.tubes) { const R = tubeRadius(tb, y, j); if (R > 0) v = Math.max(v, R + 0.005); }   // por fora do tubo de baixo
      if (prev) v = Math.max(v, prev[j] - 0.002);                          // o tecido não entra de volta
      rr[j] = v;
    }
    r.push(rr); prev = rr;
  }
  return { y0, len: sp.skirt, r };
}

/** Raio do tubo na altura y e no ângulo j (0 fora do comprimento do tubo). */
export function tubeRadius(tb: SkirtTube, y: number, j: number): number {
  const f = ((tb.y0 - y) / tb.len) * (tb.r.length - 1);
  if (f < 0 || f > tb.r.length - 1 + 1.5) return 0;
  const i = Math.min(tb.r.length - 1, Math.floor(f)), k = Math.min(tb.r.length - 1, i + 1), w = Math.min(1, f - i);
  return lerp(tb.r[i][j], tb.r[k][j], w);
}

/**
 * O que já está vestido por baixo: folga extra por vértice do corpo (para passar por fora das peças coladas ao corpo) e
 * os tubos das saias — a peça de cima que desce sobre uma saia passa por fora do tubo NA ALTURA em que está (o tubo
 * abre para baixo), em vez de afastar a cintura inteira pelo tamanho da barra.
 */
export interface UnderLayer { ease: Float32Array; tubes: SkirtTube[] }

export function underLayer(c: Composed, P: BodyParam, below: GarmentSpec[]): UnderLayer {
  const out = new Float32Array(P.h.length); const tubes: SkirtTube[] = []; let acc: UnderLayer | null = null;
  for (const sp of [...below].sort((a, b) => a.layer - b.layer)) {
    const cov = coverageOf(c, P, sp);
    const e = sp.ease + 0.004 + (sp.skirt > 0 ? 0 : sp.flare * 0.3);     // o alargamento da saia está no tubo
    for (let v = 0; v < out.length; v++) if (cov[v] > 0.02) out[v] += e;
    if (sp.skirt > 0) { tubes.push(skirtTube(c, P, sp, acc)); }
    acc = { ease: out, tubes };
  }
  return { ease: out, tubes };
}

export function garmentGeometry(a: BodyAsset, c: Composed, normals: Float32Array, P: BodyParam, sp: GarmentSpec, under: UnderLayer | null = null): GarmentGeometry | null {
  const nb = a.meta.counts.body; const cov = coverageOf(c, P, sp);
  const rv = a.body.renderVertex; const idx = a.body.index;
  const used = new Int32Array(nb).fill(-1); const tris: number[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    const p = rv[idx[t]], q = rv[idx[t + 1]], r = rv[idx[t + 2]];
    if (Math.max(cov[p], cov[q], cov[r]) > 0.02 && Math.min(cov[p], cov[q], cov[r]) >= 0 && (cov[p] + cov[q] + cov[r]) > 0.3) tris.push(p, q, r);
  }
  // Below the hip a shirt is a single fabric envelope, not two copied thigh meshes.
  // The latter split at the crotch and created dangling, independently skinned scraps.
  const shortHem = sp.skirt === 0 && Number.isFinite(sp.hem) && sp.hem < 0;
  const tubeSpec = shortHem ? { ...sp, skirt: (0.07 - sp.hem) * (P.neckY - P.hipY), waist: 0.07 } : sp;
  const top = shortHem ? 0.02 : sp.skirt > 0 ? skirtTop(sp) : NaN;
  const pos: number[] = [], al: number[] = [], si: number[] = [], sw: number[] = [], src: number[] = [];
  // caimento: anel do busto
  const NA = 64; const bustY = lerp(P.hipY, P.neckY, 0.72);
  const bust = sp.drape > 0 ? ring(c, P, bustY, P.torsoZ, NA, 0.015) : null;
  // peito das peças soltas: casco convexo em algumas alturas (interpolado)
  const CH = [0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9];
  const chest = sp.drape >= 0.5 && !Number.isNaN(sp.hem) ? CH.map((hh) => hullRing(c, P, lerp(P.hipY, P.neckY, hh), P.torsoZ, NA)) : null;
  // e em pé: envelope convexo na vertical (por ângulo) — o tecido vai reto do alto do peito até a linha do busto, sem
  // desenhar a ponta do seio
  if (chest) for (let j = 0; j < NA; j++) {
    const r = CH.map((_, i) => chest[i][j]);
    for (let i = 1; i < CH.length - 1; i++) for (let a2 = 0; a2 < i; a2++) for (let b2 = i + 1; b2 < CH.length; b2++) {
      const t = (CH[i] - CH[a2]) / (CH[b2] - CH[a2]); chest[i][j] = Math.max(chest[i][j], r[a2] + (r[b2] - r[a2]) * t);
    }
  }
  const add = (v: number) => {
    if (used[v] >= 0) return used[v];
    const i = pos.length / 3; used[v] = i;
    const g = P.group[v]; const h = P.h[v];
    let e = sp.ease + (under ? under.ease[v] : 0);
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
    // peito: o tecido passa reto por cima do vão entre os seios (frente), sem desenhar o corpo
    if (chest && g === 1 && h >= CH[0] && h < CH[CH.length - 1]) {
      const zz = z - P.torsoZ; const r = Math.hypot(x, zz);
      if (zz > 0 && r > 1e-4) {
        const j = Math.round(((Math.atan2(x, zz) + Math.PI) / (2 * Math.PI)) * NA) % NA;
        const f = ((h - CH[0]) / (CH[1] - CH[0])); const i0 = Math.min(CH.length - 2, Math.floor(f)); const w = f - i0;
        const R = lerp(chest[i0][j], chest[i0 + 1][j], w) + e * 0.9;
        const k = smooth(CH[CH.length - 1], CH[CH.length - 1] - 0.08, h) * smooth(0.1, 0.6, zz / r) * sp.drape;
        if (R > r) { const nr = lerp(r, R, k); x *= nr / r; z = P.torsoZ + (zz * nr) / r; }
      }
    }
    // por fora da saia que está por baixo, na altura do vértice (tronco e alto das coxas)
    if (under?.tubes.length && (g === 1 || g === 3)) {
      const zz = z - P.torsoZ; const r = Math.hypot(x, zz); const j = Math.round(((Math.atan2(x, zz) + Math.PI) / (2 * Math.PI)) * NA) % NA;
      let target = 0; for (const tb of under.tubes) target = Math.max(target, tubeRadius(tb, y, j));
      target += 0.004 + sp.ease * 0.5;
      if (target > r && r > 1e-4) { x *= target / r; z = P.torsoZ + (zz * target) / r; }
    }
    if ((sp.kind === "shoes" || sp.kind === "boots") && c.body[v * 3 + 1] < 0.018) y = Math.min(y, -0.004 - 0.008 * smooth(0.018, 0.0, c.body[v * 3 + 1]));   // sola
    pos.push(x, y, z); al.push(cov[v]); src.push(v);
    for (let k = 0; k < 4; k++) { const w = a.body.skinWeight[v * 4 + k]; si.push(w ? a.body.skinIndex[v * 4 + k] : 0); sw.push(w / 255); }
    return i;
  };
  const index: number[] = [];
  for (let t = 0; t < tris.length; t += 3) {
    const [p, q, r] = [tris[t], tris[t + 1], tris[t + 2]];
    if (shortHem && [p, q, r].some((v) => P.group[v] !== 2 && P.h[v] < 0)) continue;
    // a saia/vestido de baixo é o tubo: o molde não desce pelas pernas abaixo do começo da saia
    if (!Number.isNaN(top) && [p, q, r].every((v) => P.group[v] === 3 || P.h[v] < top - 0.02)) continue;
    index.push(add(p), add(q), add(r));
  }
  // ---- tubo da saia (saia, vestido, casaco longo)
  if (sp.skirt > 0 || shortHem) {
    const tube = skirtTube(c, P, shortHem ? { ...tubeSpec, kind: "skirt" } : tubeSpec, under); const rows = tube.r.length - 1;
    const base = pos.length / 3; const names = a.meta.bones.map((b) => b.name);
    const hips = names.indexOf("mixamorig:Hips"), upL = names.indexOf("mixamorig:LeftUpLeg"), upR = names.indexOf("mixamorig:RightUpLeg");
    for (let i = 0; i <= rows; i++) {
      const y = tube.y0 - (tube.len * i) / rows; const t = i / rows;
      for (let j = 0; j < TUBE_NA; j++) {
        const r = tube.r[i][j]; const phi = (j / TUBE_NA) * 2 * Math.PI - Math.PI;
        pos.push(Math.sin(phi) * r, y, P.torsoZ + Math.cos(phi) * r);
        al.push(1); src.push(-1);
        const leg = Math.sin(phi) >= 0 ? upL : upR; const wl = shortHem ? 0 : 0.55 * smooth(0.1, 0.9, t) * Math.min(1, Math.abs(Math.sin(phi)) * 1.6);
        si.push(hips, leg, 0, 0); sw.push(1 - wl, wl, 0, 0);
      }
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < TUBE_NA; j++) {
      const j2 = (j + 1) % TUBE_NA; const p = base + i * TUBE_NA + j, q = base + i * TUBE_NA + j2, r = base + (i + 1) * TUBE_NA + j, s2 = base + (i + 1) * TUBE_NA + j2;
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

export interface PhotoInfo {
  width: number; height: number; box: { x0: number; y0: number; x1: number; y1: number }; widthAt: (fy: number) => { x0: number; x1: number } | null;
  /** fim da gola da frente no centro da foto (fração da altura da caixa), quando a gola difere do tecido; senão null */
  collarRow: number | null;
}

/** Caixa da parte opaca da foto e a largura dela em cada altura (fração da caixa). */
export function photoInfo(img: CanvasImageSource & { width: number; height: number }): PhotoInfo | null {
  const W = 256, H = Math.max(1, Math.round((256 * img.height) / img.width));
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d", { willReadFrequently: true }); if (!g) return null;
  g.drawImage(img, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  const k = img.width / W;
  // gola: nas colunas do centro, de cima para baixo nos primeiros 22% da peça, as linhas que diferem do tecido do
  // meio da peça (ribana, forro da nuca à mostra) — a última linha seguida delas é o fim da gola da frente
  const px = (x: number, y: number) => { const o = (y * W + x) * 4; return d[o + 3] > 128 ? [d[o], d[o + 1], d[o + 2]] : null; };
  const cx0 = Math.round(x0 + (x1 - x0) * 0.45), cx1 = Math.round(x0 + (x1 - x0) * 0.55);
  const body: number[][] = []; for (let y = Math.round(y0 + (y1 - y0) * 0.35); y < y0 + (y1 - y0) * 0.6; y++) for (let x = cx0; x <= cx1; x++) { const p = px(x, y); if (p) body.push(p); }
  let collarRow: number | null = null;
  if (body.length > 10) {
    const med = [0, 1, 2].map((i) => body.map((p) => p[i]).sort((a, b) => a - b)[body.length >> 1]);
    let last = -1, gap = 0;
    for (let y = y0; y < y0 + (y1 - y0) * 0.22; y++) {
      let diff = 0, cnt = 0;
      for (let x = cx0; x <= cx1; x++) { const p = px(x, y); if (!p) { diff++; cnt++; continue; } cnt++; if (Math.hypot(p[0] - med[0], p[1] - med[1], p[2] - med[2]) > 55) diff++; }
      if (cnt && diff / cnt > 0.5) { last = y; gap = 0; } else if (last >= 0 && ++gap > 2) break;
    }
    if (last > y0) collarRow = (last + 1 - y0) / Math.max(1, y1 - y0);
  }
  return {
    collarRow,
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
export function texturedGeometry(gg: GarmentGeometry, posed: Float32Array, photo: PhotoInfo | null, noPhoto?: (v: number) => boolean,
  visibleAlpha: Float32Array = gg.alpha): THREE.BufferGeometry {
  const sp = gg.spec; const n = gg.index.length / 3;
  // referência na foto e no molde (pose de exibição)
  let map: ((x: number, y: number) => [number, number]) | null = null;
  let photoScaleX = 1, photoScaleY = 1;
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (let v = 0; v < gg.position.length / 3; v++) {
    xMin = Math.min(xMin, gg.position[v * 3]); xMax = Math.max(xMax, gg.position[v * 3]);
    yMin = Math.min(yMin, gg.position[v * 3 + 1]); yMax = Math.max(yMax, gg.position[v * 3 + 1]);
  }
  if (photo && sp.kind !== "shoes" && sp.kind !== "boots") {
    let yTop = -Infinity, yBot = Infinity; const front: number[] = [];
    for (let v = 0; v < posed.length / 3; v++) if (gg.alpha[v] > 0.5 && !noPhoto?.(v)) { const y = posed[v * 3 + 1]; yTop = Math.max(yTop, y); yBot = Math.min(yBot, y); front.push(v); }
    const fy = sp.kind === "pants" || sp.kind === "shorts" || sp.kind === "skirt" || sp.kind === "leggings" ? 0.12 : 0.62;
    const yRef = yTop - (yTop - yBot) * fy;
    let xl = Infinity, xr = -Infinity;
    for (const v of front) if (Math.abs(posed[v * 3 + 1] - yRef) < 0.012) { xl = Math.min(xl, posed[v * 3]); xr = Math.max(xr, posed[v * 3]); }
    const pw = photo.widthAt(fy);
    if (Number.isFinite(xl) && pw && xr > xl) {
      const { box } = photo; const sx = (pw.x1 - pw.x0) / (xr - xl); const cxP = (pw.x0 + pw.x1) / 2, cxG = (xl + xr) / 2;
      photoScaleX = sx;
      const bh = box.y1 - box.y0;
      // peça de cima com gola: o fim da gola da foto (collarRow) vai para a borda do decote 3D na frente — sem isso a
      // gola da foto caía abaixo da borda, com tecido "sobrando" entre ela e o pescoço. A barra continua na barra.
      let yFront = -Infinity;
      if (HAS_COLLAR_BAND.has(sp.kind) && photo.collarRow !== null) {
        const mid = front.filter((v) => Math.abs(posed[v * 3]) < 0.025);
        if (mid.length) {
          let z0 = Infinity, z1 = -Infinity; for (const v of mid) { z0 = Math.min(z0, posed[v * 3 + 2]); z1 = Math.max(z1, posed[v * 3 + 2]); }
          for (const v of mid) if (posed[v * 3 + 2] > (z0 + z1) / 2) yFront = Math.max(yFront, posed[v * 3 + 1]);
        }
      }
      if (Number.isFinite(yFront) && yFront - yBot > 0.1) {
        const yRib = yFront - 0.016; const rowRib = box.y0 + bh * photo.collarRow!;   // fim da faixa 3D (collarBand)
        const sy = (box.y1 - rowRib) / (yRib - yBot);
        photoScaleY = sy;
        map = (x, y) => [(cxP + (x - cxG) * sx) / photo.width, 1 - (box.y1 - (y - yBot) * sy) / photo.height];
      } else {
        const sy = bh / Math.max(0.05, yTop - yBot);
        photoScaleY = sy;
        map = (x, y) => [(cxP + (x - cxG) * sx) / photo.width, 1 - (box.y0 + (yTop - y) * sy) / photo.height];
      }
    }
  }
  const pos: number[] = [], uv: number[] = [], col: number[] = [], si: number[] = [], sw: number[] = [];
  const fabricUv: number[] = [], photoWeight: number[] = [];
  const normals = baseNormals(posed, gg.index, Uint32Array.from({ length: posed.length / 3 }, (_, i) => i));
  const cache = new Map<string, number>(); const index: number[] = [];
  for (let t = 0; t < n; t++) {
    const vs = [gg.index[t * 3], gg.index[t * 3 + 1], gg.index[t * 3 + 2]];
    // manga: a foto plana mostra a manga aberta para o lado; projetada de frente no braço caído viraria um retalho —
    // a manga fica no tecido (cor e trama), com a barra/punho próprios
    const isFront = !!map;
    for (const v of vs) {
      const key = `${v}:${isFront ? 1 : 0}`; let i = cache.get(key);
      if (i === undefined) {
        i = pos.length / 3; cache.set(key, i);
        pos.push(gg.position[v * 3], gg.position[v * 3 + 1], gg.position[v * 3 + 2]);
        const blend = isFront && !noPhoto?.(v) ? Math.min(1, Math.max(0, (normals[v * 3 + 2] - 0.05) / 0.7)) : 0;
        if (blend > 0 && map) {
          const [u, w] = map(posed[v * 3], posed[v * 3 + 1]);
          uv.push(0.5 * Math.min(0.999, Math.max(0.001, u)), Math.min(0.999, Math.max(0.001, w)));
        } else {
          // Separate fabric panel for sleeves, sides and back. It spans the rest mesh, never one flat-color pixel.
          uv.push(0.501 + 0.498 * (gg.position[v * 3] - xMin) / Math.max(0.01, xMax - xMin),
            0.001 + 0.998 * (gg.position[v * 3 + 1] - yMin) / Math.max(0.01, yMax - yMin));
        }
        fabricUv.push(0.501 + 0.498 * (gg.position[v * 3] - xMin) / Math.max(0.01, xMax - xMin),
          0.001 + 0.998 * (gg.position[v * 3 + 1] - yMin) / Math.max(0.01, yMax - yMin));
        photoWeight.push(blend * blend * (3 - 2 * blend));
        col.push(1, 1, 1, visibleAlpha[v]);
        for (let k = 0; k < 4; k++) { si.push(gg.skinIndex[v * 4 + k]); sw.push(gg.skinWeight[v * 4 + k]); }
      }
      index.push(i);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("fabricUv", new THREE.Float32BufferAttribute(fabricUv, 2));
  g.setAttribute("photoWeight", new THREE.Float32BufferAttribute(photoWeight, 1));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(index); g.computeVertexNormals();
  g.userData.fabricMapping = { width: Math.max(0.01, xMax - xMin), height: Math.max(0.01, yMax - yMin), photoScaleX, photoScaleY };
  return g;
}

/** Textura: fundo na cor do tecido (costas, laterais, onde a foto é transparente) e a foto por cima. */
export function garmentTexture(img: (CanvasImageSource & { width: number; height: number }) | null, fabric: string,
  mapping?: { width: number; height: number; photoScaleX: number; photoScaleY: number }): THREE.CanvasTexture {
  const W = img ? Math.min(1024, img.width) : 16, H = img ? Math.round((W * img.height) / img.width) : 16;
  const cv = document.createElement("canvas"); cv.width = W * 2; cv.height = H; const g = cv.getContext("2d")!;
  g.fillStyle = fabric; g.fillRect(0, 0, W * 2, H);
  if (img) {
    const source = document.createElement("canvas"); source.width = img.width; source.height = img.height;
    const sg = source.getContext("2d", { willReadFrequently: true })!; sg.drawImage(img, 0, 0);
    const raster = sg.getImageData(0, 0, source.width, source.height);
    const tile = fabricTile(raster);
    if (!tile) {
      const rows = fabricRows(raster);
      if (rows.length) {
        // A front photo of denim contains a wash gradient; carry that fabric tone around the leg.
        const gradient = g.createLinearGradient(0, 0, 0, H);
        for (const row of rows) gradient.addColorStop(row.y / img.height, `rgb(${row.rgb.join(",")})`);
        g.fillStyle = gradient; g.fillRect(0, 0, W, H);
        const back = g.createLinearGradient(0, 0, 0, H);
        const photoHeight = mapping ? mapping.height * mapping.photoScaleY : img.height;
        const first = rows[0].y, last = rows[rows.length - 1].y;
        for (const row of rows) back.addColorStop(Math.min(1, Math.max(0, (row.y - first) / Math.max(1, Math.min(photoHeight, last - first)))), `rgb(${row.rgb.join(",")})`);
        g.fillStyle = back; g.fillRect(W, 0, W, H);
      }
    }
    if (tile) {
      const sample = document.createElement("canvas"); sample.width = tile.width; sample.height = tile.height;
      sample.getContext("2d")!.drawImage(source, tile.x, tile.y, tile.width, tile.height, 0, 0, tile.width, tile.height);
      const pattern = g.createPattern(sample, "repeat");
      if (pattern) {
        const fill = (x: number, sx: number, sy: number) => {
          g.save(); g.translate(x, 0); g.scale(sx, sy); g.fillStyle = pattern; g.fillRect(0, 0, W / sx, H / sy); g.restore();
        };
        fill(0, W / img.width, H / img.height);
        fill(W, mapping ? W / (mapping.width * mapping.photoScaleX) : W / img.width,
          mapping ? H / (mapping.height * mapping.photoScaleY) : H / img.height);
      }
    }
    g.drawImage(img, 0, 0, W, H);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/**
 * Calçado: cor do cabedal (a cor dominante da faixa do meio da foto, por matiz — a mediana por canal misturava cabedal,
 * cadarço e detalhes num cinza) e da sola (a dominante da faixa de baixo).
 */
export function shoeColors(img: (CanvasImageSource & { width: number; height: number }) | null | undefined, fallback?: string | null): { upper: string; sole: string; accent?: string | null } {
  const base = fallback && /^#[0-9a-f]{6}$/i.test(fallback) ? fallback : "#5a5a5a";
  if (!img || typeof document === "undefined") return { upper: base, sole: "#e8e4dc" };
  const W = 96, H = Math.max(8, Math.round((96 * img.height) / img.width));
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d", { willReadFrequently: true }); if (!g) return { upper: base, sole: "#e8e4dc" };
  g.drawImage(img, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
  let y0 = H, y1 = -1; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 128) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (y1 < 0) return { upper: base, sole: "#e8e4dc" };
  const hgt = y1 - y0;
  // cabedal: a faixa lateral (abaixo do cadarço, acima da sola); detalhe: a segunda cor dessa faixa ou da de cima
  const up = dominants(d, W, [y0 + Math.round(hgt * 0.35), y0 + Math.round(hgt * 0.75)], false);
  const top = dominants(d, W, [y0, y0 + Math.round(hgt * 0.35)], false);
  const upper = up[0] ?? base;
  const accent = [...up.slice(1), ...top].find((c2) => colorDist(c2, upper) > 90) ?? null;
  return { upper, sole: dominants(d, W, [y1 - Math.max(1, Math.round(hgt * 0.14)), y1], true)[0] ?? "#e8e4dc", accent };
}

function colorDist(a: string, b: string): number {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** Cores dominantes numa faixa de linhas (da mais frequente para a menos): caixas de matiz/luminância por contagem. */
function dominants(d: Uint8ClampedArray, W: number, ys: [number, number], allowNeutral: boolean): string[] {
  const bins = new Map<number, { w: number; r: number; g: number; b: number }>();
  for (let y = ys[0]; y <= ys[1]; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4; if (d[o + 3] < 200) continue;
    const r = d[o], gg = d[o + 1], b = d[o + 2]; const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); const sat = mx ? (mx - mn) / mx : 0; const l = (mx + mn) / 510;
    if (!allowNeutral && (l > 0.9 || l < 0.08)) continue;              // fundo branco, sombra e contorno
    let hue = 0; if (mx !== mn) { hue = mx === r ? ((gg - b) / (mx - mn)) % 6 : mx === gg ? (b - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4; }
    const key = sat < 0.15 ? 100 + Math.min(4, Math.floor(l * 5)) : Math.floor(((hue + 6) % 6) * 2);
    const e = bins.get(key) ?? { w: 0, r: 0, g: 0, b: 0 };
    e.w += 1; e.r += r; e.g += gg; e.b += b; bins.set(key, e);
  }
  return [...bins.values()].filter((e) => e.w >= 3).sort((p, q) => q.w - p.w)
    .map((e) => "#" + [e.r, e.g, e.b].map((v) => Math.round(v / e.w).toString(16).padStart(2, "0")).join(""));
}

/**
 * Cores dos acabamentos na foto: barra (faixa de baixo, no centro) e manga (pontas laterais do alto da peça, onde a
 * manga termina na foto plana). Quando o acabamento é do mesmo tecido, null (a faixa sai no tecido um pouco mais escuro).
 */
export function trimColors(img: (CanvasImageSource & { width: number; height: number }) | null | undefined, fabric: string): { hem: string | null; cuff: string | null } {
  if (!img || typeof document === "undefined") return { hem: null, cuff: null };
  try {
    const W = 128, H = Math.max(8, Math.round((128 * img.height) / img.width));
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d", { willReadFrequently: true }); if (!g) return { hem: null, cuff: null };
    g.drawImage(img, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 < 0) return { hem: null, cuff: null };
    const f = new THREE.Color(fabric); const fr = [f.r * 255, f.g * 255, f.b * 255];
    const med = (xs: [number, number], ys: [number, number]) => {
      const px: number[][] = [];
      for (let y = Math.max(0, Math.floor(ys[0])); y <= Math.min(H - 1, Math.ceil(ys[1])); y++) for (let x = Math.max(0, Math.floor(xs[0])); x <= Math.min(W - 1, Math.ceil(xs[1])); x++) {
        const o = (y * W + x) * 4; if (d[o + 3] > 200) px.push([d[o], d[o + 1], d[o + 2]]);
      }
      if (px.length < 4) return null;
      const m = [0, 1, 2].map((i) => px.map((p) => p[i]).sort((a, b) => a - b)[px.length >> 1]);
      return Math.hypot(m[0] - fr[0], m[1] - fr[1], m[2] - fr[2]) < 45 ? null : "#" + m.map((v) => v.toString(16).padStart(2, "0")).join("");
    };
    const bw = x1 - x0, bh = y1 - y0;
    // barra: as 3 últimas linhas no centro; manga: as pontas das laterais na faixa de cima (onde a manga termina)
    let hem = null as string | null; for (let k = 1; k <= 3 && !hem; k++) hem = med([x0 + bw * 0.3, x0 + bw * 0.7], [y1 - k * 1.2, y1 - (k - 1) * 1.2]);
    const cuffL = med([x0, x0 + bw * 0.04], [y0 + bh * 0.05, y0 + bh * 0.45]); const cuffR = med([x1 - bw * 0.04, x1], [y0 + bh * 0.05, y0 + bh * 0.45]);
    return { hem, cuff: cuffL ?? cuffR };
  } catch { return { hem: null, cuff: null }; }
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
    sheen: sp.kind === "jacket" || sp.kind === "coat" ? 0.15 : 0.35, sheenRoughness: 0.8, sheenColor: new THREE.Color("#ffffff"), polygonOffset: true, polygonOffsetFactor: -sp.layer, polygonOffsetUnits: -sp.layer,
  });
  m.name = `roupa-${sp.kind}`;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
      attribute vec2 fabricUv; attribute float photoWeight;
      varying vec2 vGarmentFabricUv; varying float vGarmentPhotoWeight;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vGarmentFabricUv = fabricUv; vGarmentPhotoWeight = photoWeight;`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
      varying vec2 vGarmentFabricUv; varying float vGarmentPhotoWeight;`)
      .replace("#include <map_fragment>", `#ifdef USE_MAP
        vec4 garmentPhoto = texture2D(map, vMapUv);
        vec4 garmentFabric = texture2D(map, vGarmentFabricUv);
        diffuseColor *= mix(garmentFabric, garmentPhoto, clamp(vGarmentPhotoWeight, 0.0, 1.0));
      #endif`);
  };
  m.customProgramCacheKey = () => "garment-fabric-blend-v1";
  return m;
}

// ================================================================== gola (ribana) em volta do pescoço inteiro

/** Peças com gola de malha/ribana contornando o decote (jaqueta e casaco são abertos na frente: sem faixa). */
export const HAS_COLLAR_BAND: ReadonlySet<GarmentKind> = new Set(["tee", "longsleeve", "tank", "crop", "sweater", "hoodie", "shirt", "dress", "jumpsuit"]);

export interface CollarBand { position: Float32Array; skinIndex: Uint16Array; skinWeight: Float32Array; index: Uint32Array }

/**
 * Gola 3D: uma faixa fechada que dá a volta inteira no decote (frente, lados e nuca), na borda da peça, com espessura —
 * de fora e de dentro ela é gola, nunca o tecido do corpo "preenchendo" o que a foto da frente não cobre. Seção: anel
 * externo em cima e embaixo, anel interno embaixo e em cima; pesos de pele interpolados e suaves
 * no perímetro acompanham o pescoço e o tronco sem separar as bordas da faixa.
 */
export function collarBand(a: BodyAsset, c: Composed, P: BodyParam, sp: GarmentSpec, under: UnderLayer | null = null): CollarBand | null {
  if (!HAS_COLLAR_BAND.has(sp.kind) || Number.isNaN(sp.hem)) return null;
  const NA = 72, nb = P.h.length, span = P.neckY - P.hipY;
  const band = sp.kind === "shirt" ? 0.026 : sp.kind === "hoodie" || sp.kind === "sweater" ? 0.02 : 0.016;
  const phiOf = (x: number, dz: number) => Math.atan2(x, dz);
  const yN = (phi: number) => P.hipY + necklineH(sp, Math.sin(phi), Math.cos(phi)) * span;
  // raio do corpo na altura do decote, por ângulo (só tronco/pescoço), e o vértice do corpo mais próximo (pesos)
  // raio: o da superfície na altura do decote — os vértices mais próximos dessa altura em cada ângulo (a mediana deles);
  // o maior raio pegava o alto do ombro (quase horizontal) e abria a gola para fora do pescoço
  const rAt = new Float32Array(NA), easeAt = new Float32Array(NA);
  const bins: { dy: number; r: number; e: number }[][] = Array.from({ length: NA }, () => []);
  const cand: number[] = [];
  for (let v = 0; v < nb; v++) {
    if (P.group[v] !== 1 || P.h[v] < 0.7 || P.h[v] > 1.12) continue;
    cand.push(v);
    const x = c.body[v * 3], y = c.body[v * 3 + 1], dz = c.body[v * 3 + 2] - P.neckZ;
    const phi = phiOf(x, dz); const dy = Math.abs(y - yN(phi)); if (dy > 0.015) continue;
    const j = Math.round(((phi + Math.PI) / (2 * Math.PI)) * NA) % NA;
    bins[j].push({ dy, r: Math.hypot(x, dz), e: under ? under.ease[v] : 0 });
  }
  for (let j = 0; j < NA; j++) {
    const b = bins[j].sort((p, q) => p.dy - q.dy).slice(0, 4); if (!b.length) continue;
    const rs = b.map((x) => x.r).sort((p, q) => p - q); rAt[j] = rs[rs.length >> 1]; easeAt[j] = Math.max(...b.map((x) => x.e));
  }
  if (!rAt.some((r) => r > 0)) return null;
  // Interpolate between measured bins on the closed curve. Never use a bin
  // filled earlier in this loop as a new measurement: that creates plateaus.
  const measured = rAt.slice(), measuredEase = easeAt.slice();
  for (let j = 0; j < NA; j++) if (!measured[j]) {
    let left = 1, right = 1;
    while (!measured[(j - left + NA) % NA]) left++;
    while (!measured[(j + right) % NA]) right++;
    const l = (j - left + NA) % NA, r = (j + right) % NA;
    rAt[j] = lerp(measured[l], measured[r], left / (left + right));
    easeAt[j] = lerp(measuredEase[l], measuredEase[r], left / (left + right));
  }
  // Periodic smoothing includes the seam and preserves the anatomical oval.
  let sm = rAt;
  for (let pass = 0; pass < 12; pass++) sm = Float32Array.from(sm, (_, j) =>
    (sm[(j + NA - 1) % NA] + 2 * sm[j] + sm[(j + 1) % NA]) / 4);
  const pos: number[] = [], si: number[] = [], sw: number[] = [];
  // Blend nearby body influences instead of copying one vertex's bones.
  // All four cross-section rings share the same influences at an angle, so
  // tilting the head cannot pull their edges apart into spikes.
  const influences = Array.from({ length: NA }, (_, j) => {
    const phi = j / NA * 2 * Math.PI - Math.PI;
    const r = sm[j] + sp.ease + easeAt[j];
    const x = Math.sin(phi) * r, z = P.neckZ + Math.cos(phi) * r, y = yN(phi);
    const near = cand.map(v => ({ v, d: (c.body[v * 3] - x) ** 2 + (c.body[v * 3 + 1] - y) ** 2 + (c.body[v * 3 + 2] - z) ** 2 }))
      .sort((a, b) => a.d - b.d).slice(0, 8);
    const weights = new Map<number, number>();
    let total = 0;
    for (const { v, d } of near) {
      const proximity = 1 / Math.max(d, 0.000025); total += proximity;
      for (let k = 0; k < 4; k++) {
        const bone = a.body.skinIndex[v * 4 + k], w = a.body.skinWeight[v * 4 + k] / 255;
        if (w) weights.set(bone, (weights.get(bone) ?? 0) + proximity * w);
      }
    }
    for (const [bone, w] of weights) weights.set(bone, w / total);
    return weights;
  });
  let smoothInfluences = influences;
  for (let pass = 0; pass < 6; pass++) smoothInfluences = smoothInfluences.map((_, j) => {
    const blend = new Map<number, number>();
    for (const [offset, factor] of [[-1, .25], [0, .5], [1, .25]])
      for (const [bone, weight] of smoothInfluences[(j + offset + NA) % NA])
        blend.set(bone, (blend.get(bone) ?? 0) + weight * factor);
    return blend;
  });
  // A consistent set of four bones prevents a fifth influence popping in and
  // out when neighbouring samples have almost equal weights.
  const boneTotals = new Map<number, number>();
  for (const weights of smoothInfluences) for (const [bone, weight] of weights)
    boneTotals.set(bone, (boneTotals.get(bone) ?? 0) + weight);
  const bones = [...boneTotals].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([bone]) => bone);
  const weightsAt = smoothInfluences.map(blend => {
    const top = bones.map(bone => [bone, blend.get(bone) ?? 0]);
    const total = top.reduce((sum, [, w]) => sum + w, 0) || 1;
    return top.map(([bone, w]) => [bone, w / total]);
  });
  // 4 anéis: externo-cima, externo-baixo, interno-baixo, interno-cima
  // a borda do tecido (alfa por vértice) é serrilhada: a faixa sobe 9 mm acima dela e fica 6 mm por fora para cobri-la
  const rings: [number, number][] = [[0.006, 0.009], [0.006, -band], [-0.0015, -band], [-0.0015, 0.009]];
  for (const [dr, dy] of rings) for (let j = 0; j < NA; j++) {
    const phi = (j / NA) * 2 * Math.PI - Math.PI; const r = sm[j] + sp.ease + easeAt[j] + dr;
    const x = Math.sin(phi) * r, z = P.neckZ + Math.cos(phi) * r, y = yN(phi) + dy;
    pos.push(x, y, z);
    for (let k = 0; k < 4; k++) { si.push(weightsAt[j][k]?.[0] ?? 0); sw.push(weightsAt[j][k]?.[1] ?? 0); }
  }
  const idx: number[] = [];
  for (let ring = 0; ring < 4; ring++) {
    const r0 = ring * NA, r1 = ((ring + 1) % 4) * NA;
    for (let j = 0; j < NA; j++) { const j2 = (j + 1) % NA; idx.push(r0 + j, r1 + j, r0 + j2, r0 + j2, r1 + j, r1 + j2); }
  }
  const w = Float32Array.from(sw);
  for (let i = 0; i < w.length; i += 4) { const s0 = w[i] + w[i + 1] + w[i + 2] + w[i + 3] || 1; for (let k = 0; k < 4; k++) w[i + k] /= s0; }
  return { position: Float32Array.from(pos), skinIndex: Uint16Array.from(si), skinWeight: w, index: Uint32Array.from(idx) };
}

/**
 * Cor da gola: na foto, a faixa logo acima do fim da gola da frente (PhotoInfo.collarRow), no centro — a ribana da
 * frente (na camiseta padrão, a laranja). Sem gola distinta na foto, o próprio tecido um pouco mais escuro (a ribana
 * é mais densa).
 */
export function ribColor(img: (CanvasImageSource & { width: number; height: number }) | null | undefined, fabric: string): string {
  const darker = () => { const f = new THREE.Color(fabric); f.multiplyScalar(0.86); return `#${f.getHexString()}`; };
  if (!img || typeof document === "undefined") return darker();
  try {
    const info = photoInfo(img); if (!info || info.collarRow === null) return darker();
    const W = 256, H = Math.max(8, Math.round((256 * img.height) / img.width));
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d", { willReadFrequently: true }); if (!g) return darker();
    g.drawImage(img, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
    const k = W / img.width; const bx0 = info.box.x0 * k, bx1 = info.box.x1 * k, by0 = info.box.y0 * k, bh = (info.box.y1 - info.box.y0) * k;
    const yEnd = by0 + bh * info.collarRow, yStart = Math.max(by0, yEnd - bh * 0.03);
    const px: number[][] = [];
    for (let y = Math.floor(yStart); y < yEnd; y++) for (let x = Math.floor(bx0 + (bx1 - bx0) * 0.4); x < bx0 + (bx1 - bx0) * 0.6; x++) {
      const o = (y * W + x) * 4; if (d[o + 3] > 200) px.push([d[o], d[o + 1], d[o + 2]]);
    }
    if (px.length < 6) return darker();
    const med = [0, 1, 2].map((i) => px.map((p) => p[i]).sort((a, b) => a - b)[px.length >> 1]);
    const f = new THREE.Color(fabric);
    if (Math.hypot(med[0] - f.r * 255, med[1] - f.g * 255, med[2] - f.b * 255) < 40) return darker();
    return "#" + med.map((v) => v.toString(16).padStart(2, "0")).join("");
  } catch { return darker(); }
}
