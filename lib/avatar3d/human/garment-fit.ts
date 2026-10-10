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

export type FitClass = "justa" | "regular" | "oversized" | "estruturada" | "fluida";

export interface FitPiece { name?: string | null; category?: string | null; subcategory?: string | null; slot?: string | null; variation?: string | null; attributes?: Record<string, string[]> | null }

/** Variação de modelagem da taxonomia → classe de caimento. */
export const VARIATION_FIT: Record<string, FitClass> = {
  SKINNY: "justa", EXTRA_SLIM: "justa", SLIM: "justa", MUSCLE_FIT: "justa",
  REGULAR: "regular", STRAIGHT: "regular", BOOTCUT: "regular", ATHLETIC_FIT: "regular",
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
  const v = (p.variation ?? "").toUpperCase();
  if (VARIATION_FIT[v]) return VARIATION_FIT[v];
  const sub = (p.subcategory ?? "").toLowerCase();
  if (SUB_FIT[sub]) return SUB_FIT[sub];
  const k = kindOf(p); return k ? KIND_FIT[k] : "regular";
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const first = (p: FitPiece, dim: string) => (p.attributes?.[dim] ?? [])[0]?.toUpperCase() ?? null;

/** Comprimento da saia/vestido (m abaixo do início) pela dimensão LENGTH. */
const SKIRT_LEN: Record<string, number> = { MICRO: 0.24, MINI: 0.32, MID_THIGH: 0.38, KNEE: 0.5, MIDI: 0.66, MAXI: 0.88, FLOOR_LENGTH: 0.95, ANKLE_LENGTH: 0.88 };
/** Comprimento da perna (0 quadril → 1 tornozelo) pela dimensão LENGTH. */
const LEG_LEN: Record<string, number> = { MICRO: 0.18, MINI: 0.24, MID_THIGH: 0.32, KNEE: 0.5, CAPRI: 0.72, PEDAL_PUSHER: 0.66, ANKLE_LENGTH: 0.93, FULL_LENGTH: 0.985 };
/** Manga (0 ombro → 1 punho) pela dimensão SLEEVE_LENGTH. */
const SLEEVE_LEN: Record<string, number> = { SLEEVELESS: 0, SHORT_SLEEVE: 0.33, ELBOW_SLEEVE: 0.5, THREE_QUARTER_SLEEVE: 0.72, LONG_SLEEVE: 0.96 };
/** Início do cano da bota (0 quadril → 1 tornozelo) pela dimensão SHAFT_HEIGHT ou pela subcategoria. */
const SHAFT: Record<string, number> = { ANKLE: 0.86, MID_TOP: 0.86, HIGH_TOP: 0.82, QUARTER: 0.88, CREW: 0.8, MID_CALF: 0.72, KNEE_HIGH: 0.55, OVER_THE_KNEE: 0.42, THIGH_HIGH: 0.25 };
const SHAFT_SUB: Record<string, number> = { ankle_boots: 0.86, combat_boots: 0.8, boots: 0.72, long_boots: 0.56 };

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
  // jogger e calça de moletom: punho na barra (afunila no tornozelo) — não é uma calça reta
  const sub = (p.subcategory ?? "").toLowerCase();
  if (sub === "jogger_pants" || sub === "sweatpants") { sp.legColumn = 0.6; sp.flare = 0; }
  // comprimentos declarados (dimensões da taxonomia)
  const len = first(p, "LENGTH"), sleeve = first(p, "SLEEVE_LENGTH"), shaft = first(p, "SHAFT_HEIGHT");
  if (len && base.skirt > 0 && SKIRT_LEN[len] !== undefined) sp.skirt = SKIRT_LEN[len];
  if (len && legged && LEG_LEN[len] !== undefined) sp.leg = LEG_LEN[len];
  if (len === "CROPPED" && !Number.isNaN(base.hem)) sp.hem = Math.max(base.hem, 0.45);
  if (len === "LONGLINE" && !Number.isNaN(base.hem)) sp.hem = Math.min(base.hem, -0.16);
  if (sleeve && SLEEVE_LEN[sleeve] !== undefined && !Number.isNaN(base.hem)) sp.sleeve = SLEEVE_LEN[sleeve];
  if (k === "boots") sp.shaft = (shaft ? SHAFT[shaft] : undefined) ?? SHAFT_SUB[sub] ?? base.shaft;
  sp.ease = clamp(sp.ease, 0.0015, 0.05);
  return sp;
}
