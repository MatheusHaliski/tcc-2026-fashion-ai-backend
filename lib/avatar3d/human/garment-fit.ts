import { lowerProfile, lowerVariantFit, applyLowerVariation } from "./lowerwear";
import { upperProfile, upperVariantFit, applyUpperVariation } from "./upperwear";
/*
 * Caimento por classe (PROVADOR-3D): a mesma família de molde muda de folga, queda e comprimento conforme a modelagem
 * declarada da peça — sem inventar: a classe vem da VARIAÇÃO da taxonomia (SKINNY, STRAIGHT, OVERSIZED, WIDE_LEG…), e os
 * comprimentos das dimensões LENGTH, SLEEVE_LENGTH e SHAFT_HEIGHT. Sem dado, o padrão da subcategoria.
 *
 *   justa       acompanha o corpo (legging, skinny, slim, body, regata)
 *   regular     camiseta cai reta do busto; calça reta do joelho para baixo
 *   oversized   folga maior, ombro caído (manga um pouco mais longa), barra mais baixa
 *   estruturada blazer, casaco, colete, alfaiataria: queda reta e um pouco mais de folga
 *   fluida      saia, vestido, pantalona, flare: tecido solto e barra aberta
 *
 * Nada aqui altera o corpo da pessoa: só a roupa muda para caber (nunca o contrário).
 */
import { SPECS, kindOf, specOf, type GarmentKind, type GarmentSpec } from "./garments";
import { SIZE_RADIAL, gridOf, type SizeRegions } from "@/lib/tryon/sizes";
import { LEG_LEN, NECKLINE, RISE, SHAFT, SHAFT_SUB, SKIRT_LEN, SLEEVE_LEN, first, necklineOf, riseOf, sleeveLengthOf } from "./garment-dimensions";
export { necklineOf, riseOf, sleeveLengthOf } from "./garment-dimensions";

export type FitClass = "justa" | "regular" | "oversized" | "estruturada" | "fluida";

export interface FitPiece { name?: string | null; category?: string | null; subcategory?: string | null; slot?: string | null; material?: string | null; variation?: string | null; attributes?: Record<string, string[]> | null;
  /** tamanho escolhido menos o tamanho do corpo do avatar, em tamanhos da grade (lib/tryon/sizes.ts); sem escolha, 0 */
  sizeSteps?: number | null;
  /** a mesma diferença por região do corpo (peito, cintura, quadril, comprimento, pé); sem ela, a do total em tudo */
  sizeRegions?: SizeRegions | null }

/** Variação de modelagem da taxonomia → classe de caimento. */
export const VARIATION_FIT: Record<string, FitClass> = {
  SKINNY: "justa", EXTRA_SLIM: "justa", SLIM: "justa", MUSCLE_FIT: "justa",
  REGULAR: "regular", STRAIGHT: "regular", BOOTCUT: "regular", ATHLETIC_FIT: "regular",
  TAPERED: "regular", RELAXED: "regular", PENCIL: "justa", A_LINE: "fluida",
  LOOSE: "oversized", BAGGY: "oversized", OVERSIZED: "oversized",
  WIDE_LEG: "fluida", FLARE: "fluida", FIT_AND_FLARE: "fluida",
};

/** Classe padrão de cada molde (sem variação declarada). */
export const KIND_FIT: Record<GarmentKind, FitClass> = {
  tee: "regular", tank: "justa", crop: "justa", longsleeve: "regular", shirt: "regular", sweater: "regular", hoodie: "oversized",
  jacket: "estruturada", coat: "estruturada", vest: "estruturada", dress: "fluida", jumpsuit: "regular", romper: "regular",
  skirt: "fluida", pants: "regular", culottes: "fluida", shorts: "regular", bermuda: "regular", leggings: "justa", shoes: "regular", boots: "regular",
};

/** Subcategorias com classe própria quando a variação não diz. */
const SUB_FIT: Record<string, FitClass> = { bodysuit: "justa", kimono: "fluida", windbreaker: "oversized", parka: "estruturada", blazer: "estruturada", tailored_pants: "estruturada", cargo_pants: "oversized", sweatshirt: "oversized" };

export function fitClassOf(p: FitPiece): FitClass {
  const upperFit = upperVariantFit(p); if (upperFit) return upperFit;
  const lowerFit = lowerVariantFit(p); if (lowerFit) return lowerFit;
  const v = lowerSilhouetteOf(p) ?? (p.variation ?? "").toUpperCase();
  if (VARIATION_FIT[v]) return VARIATION_FIT[v];
  // Catalogue items often have no variation column; use explicit model words, never brand stereotypes.
  const name = (p.name ?? "").toLowerCase();
  if (/\b(skinny|slim[ -]?fit|extra[ -]?slim|muscle[ -]?fit)\b/.test(name)) return "justa";
  if (/\b(wide[ -]?leg|flare|pantalona)\b/.test(name)) return "fluida";
  if (/\b(oversized|baggy|loose[ -]?fit)\b/.test(name)) return "oversized";
  if (/\b(regular[ -]?fit|straight)\b/.test(name)) return "regular";
  const sub = (p.subcategory ?? "").toLowerCase();
  if (upperProfile(p)) return upperProfile(p).fit;
  if (lowerProfile(p)) return lowerProfile(p).fit;
  if (SUB_FIT[sub]) return SUB_FIT[sub];
  const k = kindOf(p); return k ? KIND_FIT[k] : "regular";
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Explicit catalogue variation wins over names, including a conflicting or unknown code. */
export function lowerSilhouetteOf(p: FitPiece): string | null {
  if (p.variation?.trim()) return p.variation.trim().toUpperCase();
  const name = (p.name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  for (const [pattern, code] of [
    [/\bboot[ -]?cut\b/, "BOOTCUT"], [/\bflare\b/, "FLARE"],
    [/\bwide[ -]?leg\b|\bpantalona\b/, "WIDE_LEG"], [/\btapered\b|\bafunilad[ao]\b/, "TAPERED"],
    [/\brelaxed(?:[ -]?fit)?\b/, "RELAXED"], [/\b(saia lapis|pencil skirt)\b/, "PENCIL"],
    [/\b(evase|a[ -]?line)\b/, "A_LINE"],
  ] as const) if (pattern.test(name)) return code;
  return null;
}

/** Parametric silhouettes, not measured manufacturer patterns or physical cloth simulation. */
function applyLowerSilhouette(sp: GarmentSpec, p: FitPiece): void {
  const raw = lowerSilhouetteOf(p);
  const shape = raw ? ({ PALAZZO: "WIDE_LEG", BELL_BOTTOM: "FLARE", CIGARETTE: "TAPERED", GAUCHO: "WIDE_LEG" } as Record<string, string>)[raw] ?? raw : null;
  if (sp.kind === "pants" || sp.kind === "culottes" || sp.kind === "leggings") {
    if (shape === "BOOTCUT" || shape === "FLARE") {
      sp.legColumn = 1;
      sp.legFlareStart = .52;
      sp.flare = shape === "BOOTCUT" ? .04 : .075;
    } else if (shape === "WIDE_LEG") {
      sp.legColumn = 1.5; sp.legFlareStart = .18; sp.flare = .06;
    } else if (shape === "TAPERED") {
      sp.legColumn = .25; sp.flare = 0;
    } else if (shape === "RELAXED") {
      sp.ease *= 1.3; sp.legColumn = 1.12;
    }
  }
  if (sp.kind === "skirt") {
    if (shape === "PENCIL") { sp.flare = 0; sp.ease = .006; }
    else if (shape === "STRAIGHT") sp.flare = .012;
    else if (shape === "A_LINE") sp.flare = .17;
  }
}

/**
 * Molde da peça: o da subcategoria ajustado pela classe de caimento e pelos comprimentos declarados.
 * null = acessório (sem molde no corpo).
 */
/** Só laboratório/auditoria: "antes" reproduz o molde anterior (sem classe de caimento e sem perna em coluna). */
let FIT_MODE: "antes" | "depois" = "depois";
export function setFitMode(mode: "antes" | "depois") { FIT_MODE = mode; }

export function specFor(p: FitPiece): GarmentSpec | null {
  const k = kindOf(p); if (!k) return null;
  if (FIT_MODE === "antes") return { ...SPECS[k], legColumn: 0, bustFall: 0.965 };
  // base: o molde da subcategoria com as construções próprias (calça cargo, blazer) de specOf
  const base = specOf({ ...p, name: p.name ?? undefined }) ?? SPECS[k]; const fit = fitClassOf(p);
  const sp: GarmentSpec = { ...base };
  const legged = base.leg > 0, draped = base.drape > 0;
  switch (fit) {
    case "justa":
      sp.ease = base.ease * 0.7; sp.drape = base.drape * 0.5; sp.bustFall = 0.93; sp.legColumn = 0; sp.flare = base.flare * 0.6; break;
    case "regular":
      sp.ease = base.ease * (legged ? 1.25 : 1); if (draped) sp.drape = Math.max(base.drape, 0.85); sp.bustFall = 0.985; break;
    case "oversized":
      sp.ease = base.ease * 2; if (draped || !Number.isNaN(base.hem)) sp.drape = 1; sp.bustFall = 1.03; sp.flare = base.flare * 1.3;
      if (legged) sp.legColumn = Math.max(base.legColumn, 1.15);
      if (base.sleeve > 0 && base.sleeve < 0.9) sp.sleeve = base.sleeve + 0.06;      // ombro caído: a manga desce mais
      if (!Number.isNaN(base.hem)) sp.hem = base.hem - 0.05;
      break;
    case "estruturada":
      // blazer já vem com a folga de alfaiataria de specOf (justo no corpo); casaco e colete ganham +15%
      sp.ease = /blazer/.test(`${p.subcategory ?? ""} ${p.name ?? ""}`.toLowerCase()) ? base.ease : base.ease * 1.15; if (draped) sp.drape = Math.max(base.drape, 0.9); sp.bustFall = 1; if (legged) sp.legColumn = Math.max(base.legColumn, 1); break;
    case "fluida":
      sp.ease = base.ease * 1.2; if (draped) sp.drape = 1; sp.bustFall = 1; sp.flare = base.flare * 1.5; if (legged) sp.legColumn = Math.max(base.legColumn, 1.3); break;
  }
  applyLowerSilhouette(sp, p);
  applyUpperVariation(sp, p);
  // Cuffs depend on the declared variation, not every sweatpant sharing one taper.
  const sub = (p.subcategory ?? "").toLowerCase();
  applyLowerVariation(sp, p);
  // comprimentos declarados (dimensões da taxonomia)
  const len = first(p, "LENGTH"), sleeve = sleeveLengthOf(p), shaft = first(p, "SHAFT_HEIGHT");
  if (len && base.skirt > 0 && SKIRT_LEN[len] !== undefined) sp.skirt = SKIRT_LEN[len];
  if (len && legged && LEG_LEN[len] !== undefined) sp.leg = LEG_LEN[len];
  if (sp.liningLeg && len && SKIRT_LEN[len] !== undefined) sp.liningLeg = Math.min(sp.liningLeg, .26);
  if (len === "CROPPED" && !Number.isNaN(base.hem)) { sp.hem = Math.max(base.hem, 0.45); sp.skirt = 0; }
  if (len === "LONGLINE" && !Number.isNaN(base.hem)) sp.hem = Math.min(base.hem, -0.16);
  if (sleeve && SLEEVE_LEN[sleeve] !== undefined && !Number.isNaN(base.hem)) sp.sleeve = SLEEVE_LEN[sleeve];
  if (k === "boots") sp.shaft = (shaft ? SHAFT[shaft] : undefined) ?? SHAFT_SUB[sub] ?? base.shaft;
  // decote (peças de cima e vestidos): dimensão NECKLINE ou o nome da peça
  const neckline = !Number.isNaN(base.hem) ? necklineOf(p) : null;
  if (neckline) Object.assign(sp, NECKLINE[neckline]);
  // Jumpsuits have a neckline too, but RISE must never truncate their upper body.
  const rise = riseOf(p);
  if (rise && Number.isNaN(base.hem) && Number.isFinite(base.waist)) sp.waist = RISE[rise];
  const closure = first(p, "CLOSURE");
  if (upperProfile(p) && closure) sp.frontOpening = 0;
  if (k === "shirt" && closure) {
    // A zipper, tie or pullover must not acquire seven synthetic shirt buttons.
    sp.placket = ["BUTTON", "SNAP", "SINGLE_BREASTED"].includes(closure);
    if (!sp.placket) sp.placketLength = undefined;
  }
  sp.fabric = (p.material ?? first(p, "MATERIAL"))?.toUpperCase() ?? undefined;
  if (["jeans", "denim_shorts"].includes(sub) && (!sp.fabric || ["COTTON", "DENIM"].includes(sp.fabric))) sp.weave = "denim";
  applySize(sp, p);
  sp.ease = clamp(sp.ease, 0.0015, 0.05);
  return sp;
}

/**
 * Tamanho escolhido × corpo do avatar (lib/tryon/sizes.ts), região por região. A folga de cada região é o passo da grade
 * em perímetro (letras 6 cm ≈ 0,95 cm de raio; numeração 4 cm ≈ 0,64 cm; calçado ≈ 1,5 mm por número) vezes a diferença
 * de tamanhos ali: a parte comum a todas as regiões entra na folga da peça; o que uma região tem a mais (o peito sobra
 * enquanto a cintura fecha) vai para `sizeEase`, aplicado vértice a vértice no molde. O comprimento alonga ou encurta
 * barra, manga e perna. O mínimo de folga (0,15 cm, o clamp de specFor) é o "não fecha": a peça cola no corpo — e o
 * relevo do tamanho (garments.ts → sizeRelief) desenha a tensão, as pregas do que sobra e a barra acumulada.
 */
export function applySize(sp: GarmentSpec, p: FitPiece): void {
  const steps = p.sizeSteps; if (steps == null || !Number.isFinite(steps)) return;
  // no tamanho do corpo em todas as regiões: o molde fica como está
  if (!steps && !Object.values(p.sizeRegions ?? {}).some((x) => x && Number.isFinite(x))) return;
  const shoe = sp.kind === "shoes" || sp.kind === "boots";
  const grid = gridOf(p.category ?? (shoe ? "shoes_piece" : null), p.subcategory)
    ?? (shoe ? "shoes" : sp.leg > 0 && Number.isNaN(sp.hem) ? "numeric" : "letter");
  const R = SIZE_RADIAL[grid], r = p.sizeRegions ?? {};
  sp.sizeSteps = steps;
  if (grid === "shoes") { sp.ease += R * (r.foot ?? steps); return; }
  const chest = r.chest ?? r.waist ?? steps, waist = r.waist ?? r.chest ?? r.hip ?? steps, hip = r.hip ?? r.waist ?? steps;
  const length = r.length ?? steps, common = Math.min(chest, waist, hip);
  sp.ease += R * common;
  sp.sizeEase = { chest: R * (chest - common), waist: R * (waist - common), hip: R * (hip - common) };
  sp.sizeFold = { chest, waist, hip, length };
  if (!Number.isNaN(sp.hem)) sp.hem -= 0.02 * length;                                  // maior: barra mais baixa
  if (sp.sleeve > 0) sp.sleeve = clamp(sp.sleeve + 0.015 * length, 0.1, 1);            // manga mais longa, até o punho
  if (sp.leg > 0) sp.leg = clamp(sp.leg + 0.012 * length, 0.2, 1);                     // perna até o chão no máximo
  if (sp.skirt > 0) sp.skirt = Math.max(0.05, sp.skirt + 0.01 * length);
  if (chest > 0) sp.bustFall = Math.min(1.06, sp.bustFall + 0.01 * chest);             // sobra tecido: cai mais reto
  if (chest < 0) sp.drape = Math.max(0, sp.drape * (1 + 0.3 * chest));                  // apertado: o tecido cola no busto
}
