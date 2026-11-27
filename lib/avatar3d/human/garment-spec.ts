/*
 * Avatar 3D (RF40) / Provador — tipos de molde (GarmentKind), parâmetros de cada molde (SPECS) e a leitura da
 * peça do catálogo para o molde (kindOf/specOf), mais a abertura dos braços que as camadas pedem (armOutFor).
 */
import { lowerProfile } from "./lowerwear";
import { upperProfile } from "./upperwear";

export type GarmentKind =
  | "tee" | "tank" | "longsleeve" | "shirt" | "sweater" | "hoodie" | "jacket" | "coat" | "crop" | "vest"
  | "dress" | "jumpsuit" | "romper" | "skirt" | "pants" | "culottes" | "shorts" | "bermuda" | "leggings" | "shoes" | "boots";

export interface GarmentSpec {
  kind: GarmentKind;
  construction?: "cargo";
  weave?: "denim";
  frontOpening?: number;
  sleeveEase?: number;
  hemFlare?: number;
  ribbed?: boolean;
  legCuff?: boolean;
  liningLeg?: number;
  placket?: boolean;
  placketLength?: number;
  fabric?: string;
  ease: number;
  hem: number;
  neck: number;
  vneck: number;
  neckShape?: "round" | "v" | "square" | "boat";
  waist: number;
  sleeve: number;
  leg: number;
  skirt: number;
  drape: number;
  legFlareStart?: number;
  flare: number;
  layer: number;
  legColumn: number;
  bustFall: number;
  shaft: number;
  sizeSteps?: number;
  sizeEase?: { chest: number; waist: number; hip: number };
  sizeFold?: { chest: number; waist: number; hip: number; length: number };
}

export const SLEEVE_EASE_FLOOR = 0.010;
export function sleeveEase(sp: GarmentSpec): number {
  return Math.min(sp.ease, Math.max(SLEEVE_EASE_FLOOR, sp.ease * 0.6));
}

export function legFlareOffset(sp: GarmentSpec, leg: number): number {
  const start = sp.legFlareStart;
  const opening = start === undefined ? Math.max(0, leg - .4)
    : Math.max(0, Math.min(1, (leg - start) / Math.max(.05, sp.leg - start)));
  return sp.flare * opening;
}

const S = (kind: GarmentKind, o: Partial<GarmentSpec>): GarmentSpec => ({ kind, ease: 0.006, hem: NaN, neck: 1, vneck: 0.04, waist: NaN, sleeve: 0, leg: 0, skirt: 0, drape: 0, flare: 0, layer: 3, legColumn: 0, bustFall: 0.965, shaft: 0.72, ...o });
export const SPECS: Record<GarmentKind, GarmentSpec> = {
  leggings: S("leggings", { ease: 0.002, waist: 0.2, leg: 0.97, layer: 1 }),
  pants: S("pants", { ease: 0.009, waist: 0.18, leg: 0.985, flare: 0.03, layer: 2, legColumn: 1 }),
  culottes: S("culottes", { ease: 0.012, waist: 0.18, leg: 0.74, flare: 0.08, layer: 2, legColumn: 1.3 }),
  shorts: S("shorts", { ease: 0.007, waist: 0.18, leg: 0.36, flare: 0.012, layer: 2 }),
  bermuda: S("bermuda", { ease: 0.009, waist: 0.18, leg: 0.5, flare: 0.015, layer: 2, legColumn: 1 }),
  skirt: S("skirt", { ease: 0.008, waist: 0.2, skirt: 0.42, flare: 0.1, layer: 2 }),
  tank: S("tank", { ease: 0.005, hem: -0.03, neck: 1.03, vneck: 0.24, drape: 0.35, layer: 3 }),
  crop: S("crop", { ease: 0.005, hem: 0.45, neck: 0.95, vneck: 0.09, sleeve: 0.28, drape: 0.2, layer: 3 }),
  tee: S("tee", { ease: 0.007, hem: -0.06, neck: 0.98, vneck: 0.09, sleeve: 0.33, drape: 0.6, flare: 0.02, layer: 3 }),
  longsleeve: S("longsleeve", { ease: 0.007, hem: -0.06, neck: 0.98, vneck: 0.09, sleeve: 0.96, drape: 0.6, layer: 3 }),
  shirt: S("shirt", { ease: 0.010, hem: -0.1, neck: 1.02, vneck: 0.11, sleeve: 0.96, drape: 0.7, layer: 4, frontOpening: 0.02 }),
  sweater: S("sweater", { ease: 0.012, hem: -0.07, neck: 1.0, vneck: 0.08, sleeve: 0.97, drape: 0.75, layer: 4 }),
  hoodie: S("hoodie", { ease: 0.015, hem: -0.08, neck: 1.03, vneck: 0.12, sleeve: 0.97, drape: 0.8, layer: 4, neckShape: "v" }),
  jacket: S("jacket", { ease: 0.022, hem: -0.08, neck: 1.03, vneck: 0.14, sleeve: 0.98, drape: 0.85, layer: 5, frontOpening: 0.04 }),
  vest: S("vest", { ease: 0.016, hem: -0.06, neck: 1.0, vneck: 0.18, drape: 0.85, layer: 5 }),
  coat: S("coat", { ease: 0.026, hem: -0.08, neck: 1.03, vneck: 0.16, sleeve: 0.99, drape: 0.9, skirt: 0.5, flare: 0.08, layer: 6, frontOpening: 0.05 }),
  dress: S("dress", { ease: 0.006, hem: 0.36, neck: 1.03, vneck: 0.23, skirt: 0.5, flare: 0.14, drape: 0.2, layer: 3 }),
  jumpsuit: S("jumpsuit", { ease: 0.008, hem: -0.2, neck: 0.95, vneck: 0.1, waist: 1, leg: 0.97, flare: 0.01, drape: 0.3, layer: 3, legColumn: 1 }),
  romper: S("romper", { ease: 0.008, hem: -0.2, neck: 0.95, vneck: 0.1, waist: 1, leg: 0.34, flare: 0.012, drape: 0.3, layer: 3 }),
  shoes: S("shoes", { ease: 0.008, layer: 2 }),
  boots: S("boots", { ease: 0.009, layer: 2 }),
};

const BAG_WORDS: ReadonlySet<string> = new Set(["bag", "bolsa", "backpack", "mochila", "clutch", "pochete", "purse", "tote", "wallet", "carteira", "necessaire"]);

export function kindOf(p: { category?: string | null; subcategory?: string | null; slot?: string | null }): GarmentKind | null {
  const sub = (p.subcategory ?? "").toLowerCase();
  if (SUBCATEGORY_KINDS[sub]) return SUBCATEGORY_KINDS[sub];
  const is = (...k: string[]) => k.some((x) => sub.includes(x));
  const words = sub.split(/[^a-zà-ú]+/);
  if (words.some((w) => BAG_WORDS.has(w) || w.endsWith("bag"))) return null;
  if (is("legging")) return "leggings";
  if (is("skort", "short_saia", "short-saia")) return "skirt";
  if (is("skirt", "saia") && !is("short")) return "skirt";
  if (is("bermuda")) return "bermuda";
  if (is("short")) return "shorts";
  if (is("culotte", "pantacourt", "pantalona_curta")) return "culottes";
  if (is("pant", "jean", "trouser", "calca", "calça", "jogger", "chino", "cargo", "sweatpant")) return "pants";
  if (is("dress", "vestido")) return "dress";
  if (is("romper", "playsuit", "macaquinho")) return "romper";
  if (is("jumpsuit", "macac", "overall", "jardineira", "matching_set", "conjunto")) return "jumpsuit";
  if (is("boot", "bota", "coturno")) return "boots";
  if (is("sneaker", "tenis", "tênis", "shoe", "sapato", "loafer", "oxford", "derby", "mocass", "sandal", "sandál", "heel", "salto", "slipper", "chinelo", "flat", "sapatilha", "alpargata", "espadrille")) return "shoes";
  if (is("coat", "casaco", "parka", "trench", "overcoat")) return "coat";
  if (is("vest", "colete") && !is("vestido")) return "vest";
  if (is("jacket", "jaqueta", "blazer", "windbreaker", "corta", "bomber", "cardigan", "kimono", "quimono")) return "jacket";
  if (is("hoodie", "capuz")) return "hoodie";
  if (is("sweater", "sueter", "suéter", "sweatshirt", "moletom", "pullover", "knit")) return "sweater";
  if (is("tank", "regata", "camisole", "bodysuit") || sub === "body") return "tank";
  if (is("crop")) return "crop";
  if (is("polo")) return "tee";
  if (is("shirt", "camisa", "blouse", "blusa")) return is("t_shirt", "tshirt", "t-shirt", "camiseta") ? "tee" : "shirt";
  if (is("long_sleeve", "manga_longa", "longsleeve")) return "longsleeve";
  if (is("tee", "camiseta", "polo", "top")) return "tee";
  const slot = (p.slot ?? "").toUpperCase();
  if (["OUTER_LAYER", "OUTERWEAR"].includes(slot)) return "jacket";
  const pick = (c: string): GarmentKind | null => {
    const k = c.replace(/_PIECE$/, "");
    if (["OUTER_LAYER", "OUTERWEAR"].includes(k)) return "jacket";
    if (["FULL_BODY", "CORPO_INTEIRO", "DRESS", "FULL"].includes(k)) return "dress";
    if (["UPPER", "TOP", "PARTE_SUPERIOR"].includes(k)) return "tee";
    if (["LOWER", "BOTTOM", "PARTE_INFERIOR"].includes(k)) return "pants";
    if (["SHOES", "FOOTWEAR", "CALCADOS"].includes(k)) return "shoes";
    return null;
  };
  return pick((p.category ?? "").toUpperCase()) ?? pick(slot) ?? null;
}

export const SUBCATEGORY_KINDS: Readonly<Record<string, GarmentKind>> = {
  t_shirt: "tee", shirt: "shirt", blouse: "shirt", tank_top: "tank", top: "tank", crop_top: "crop",
  polo_shirt: "shirt", bodysuit: "tank", sweater: "sweater", sweatshirt: "sweater", hoodie: "hoodie",
  cardigan: "jacket", vest: "vest", blazer: "jacket", jacket: "jacket", coat: "coat", parka: "coat",
  windbreaker: "jacket", kimono: "jacket", jeans: "pants", tailored_pants: "pants", casual_pants: "pants",
  chino_pants: "pants", cargo_pants: "pants", jogger_pants: "pants", sweatpants: "pants", leggings: "leggings",
  culottes: "culottes", shorts: "shorts", bermuda_shorts: "bermuda", denim_shorts: "shorts", skirt: "skirt", skort: "skirt",
  dress: "dress", jumpsuit: "jumpsuit", romper: "romper", matching_set: "jumpsuit", overalls: "jumpsuit",
  casual_sneakers: "shoes", running_shoes: "shoes", training_shoes: "shoes", basketball_shoes: "shoes",
  skate_shoes: "shoes", high_top_sneakers: "shoes", loafers: "shoes", moccasins: "shoes", oxford_shoes: "shoes",
  derby_shoes: "shoes", boots: "boots", ankle_boots: "boots", long_boots: "boots", combat_boots: "boots",
  sandals: "shoes", flip_flops: "shoes", heels: "shoes", flats: "shoes", espadrilles: "shoes",
};

export function specOf(p: { name?: string; category?: string | null; subcategory?: string | null; slot?: string | null }): GarmentSpec | null {
  const kind = kindOf(p);
  if (!kind) return null;
  const sub = (p.subcategory ?? "").toLowerCase();
  const upper = upperProfile(p);
  if (upper) {
    const spec = { ...SPECS[kind], ...upper.spec };
    if (/long[ _-]?sleeve|manga[ _-]?longa/i.test(p.name ?? "")) spec.sleeve = .96;
    return spec;
  }
  if (sub === "overalls") return { ...SPECS.jumpsuit, neck: 1.03, vneck: .3 };
  const description = `${p.subcategory ?? ""} ${p.name ?? ""}`.toLowerCase();
  const lower = lowerProfile(p);
  if (lower) {
    const spec = { ...SPECS[kind], ...lower.spec };
    if (spec.construction === "cargo" && /loose|relaxed|wide|larga|ampla/.test(description)) {
      spec.ease = .026; spec.flare = .045;
    }
    return spec;
  }
  if (kind === "pants" && /cargo/.test(description)) {
    const loose = /loose|relaxed|wide|larga|ampla/.test(description);
    return { ...SPECS.pants, construction: "cargo", ease: loose ? .026 : .019, waist: .29, flare: loose ? .045 : .032 };
  }
  const base = kind === "jacket" && /blazer/.test(description) ? { ...SPECS[kind], ease: .022, drape: .5, frontOpening: 0.05 } : SPECS[kind];
  return !Number.isNaN(base.hem) && /long[ _-]?sleeve|manga[ _-]?longa/.test(description) ? { ...base, sleeve: .96 } : base;
}

export function armOutFor(specs: GarmentSpec[]): number {
  let out = 10; let under = 0;
  for (const sp of [...specs].sort((a, b) => a.layer - b.layer)) {
    if (sp.skirt > 0) out = Math.max(out, 15);
    if (Number.isNaN(sp.hem)) continue;
    const thick = sp.ease + under + (sp.sleeveEase ?? 0) * .5;
    out = Math.max(out, Math.min(22, 10 + (thick - 0.012) * 350));
    under = Math.max(under, sp.ease + 0.004 + sp.flare * 0.3);
  }
  return Math.round(out * 10) / 10;
}
