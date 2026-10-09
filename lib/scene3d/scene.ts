/*
 * Motor de cenas 3D de loja (plano mestre, seção 9.2): CONTEXTO → RESOLVEDOR → PERFIL DE CENA.
 *
 * O mesmo motor serve o provador (a Busca Catalogada escolhe a loja, a zona e o produto em destaque), a mini loja das
 * Coleções e o mini palco das Eras. Tudo aqui é puro (sem React/three) para ser testável; os componentes 3D só leem o
 * perfil — nenhum `if (marca === …)` fora daqui.
 *
 *  - Marca → contexto da loja (paleta, sinalização, padrão de parede) pelo `environmentFor` já usado no provador; sem
 *    marca, a loja neutra multimarca FashionAI.
 *  - Categoria → zona da loja (arara, mesa de jeans, parede de calçados, vitrine de acessórios).
 *  - Subcategoria → refina a zona (tênis, botas, salão de sapatos; jeans; casacos…).
 *  - Produto escolhido → Hero Product no pedestal ao lado do avatar.
 * Regras determinísticas: nada de IA para decidir a zona.
 */
import { NEUTRAL_ENVIRONMENT, environmentFor, resolveEnvironment, type BrandEnvironment, type FittingBrand, type FittingItem } from "@/lib/tryon/fitting-room";

export type ZoneKind = "SHOE_WALL" | "GARMENT_RACK" | "DENIM_TABLE" | "VITRINE";
export type HeroDisplay = "PEDESTAL" | "VITRINE";
export type CameraPreset = "FULL" | "SHOES" | "DETAIL";
export interface ZoneProfile {
  key: string;            // chave i18n `scene3d.zone.<key>` (placa da zona)
  kind: ZoneKind;
  hero: HeroDisplay;
  camera: CameraPreset;
}
export interface SceneProduct {
  id: string;
  name: string;
  imageUrl?: string | null;
  category?: string | null;
  subcategory?: string | null;
  brand?: FittingBrand | null;
  price?: string | null;   // já formatado por quem chama (moeda e idioma)
}
export interface SceneContext {
  brand?: FittingBrand | null;
  category?: string | null;
  subcategory?: string | null;
  product?: SceneProduct | null;
  results?: SceneProduct[];   // resultados da busca, na ordem
  worn?: FittingItem[];       // o que está vestido (só decide a marca quando a busca está vazia)
}
export type SceneKind = "neutral" | "brand" | "zone" | "brand-zone";
export interface StoreScene {
  kind: SceneKind;
  brand: BrandEnvironment;
  /** marcas vestidas além da principal (painéis laterais), como no provador de antes */
  others: BrandEnvironment[];
  zone: ZoneProfile | null;
  hero: SceneProduct | null;
  /** produtos para os expositores da zona: só os da categoria da zona, sem o hero, no máximo `MAX_DISPLAY` */
  display: SceneProduct[];
}
export const MAX_DISPLAY = 12;

const SNEAKERS = new Set(["casual_sneakers", "high_top_sneakers", "running_shoes", "skate_shoes", "training_shoes", "sneakers", "basketball_shoes"]);
const BOOTS = new Set(["ankle_boots", "boots", "knee_boots", "combat_boots"]);
const FORMAL = new Set(["loafers", "oxford", "derby", "moccasins", "heels", "flats"]);
const SANDALS = new Set(["flip_flops", "sandals", "espadrilles", "slides"]);
const DENIM = new Set(["jeans", "denim_shorts", "denim_skirt", "denim_jacket"]);
const OUTERWEAR = new Set(["jacket", "coat", "parka", "blazer", "windbreaker", "cardigan", "kimono"]);
const BAGS = new Set(["backpack", "crossbody_bag", "tote_bag", "clutch", "handbag"]);
const JEWELRY = new Set(["watch", "necklace", "bracelet", "earrings", "ring", "sunglasses", "glasses"]);

/** Zona da loja pela categoria e subcategoria (regra fixa; subcategoria desconhecida cai na zona da categoria). */
export function zoneFor(category?: string | null, subcategory?: string | null): ZoneProfile | null {
  const sub = (subcategory ?? "").toLowerCase();
  switch (category) {
    case "shoes_piece":
      if (SNEAKERS.has(sub)) return { key: "sneakers", kind: "SHOE_WALL", hero: "PEDESTAL", camera: "SHOES" };
      if (BOOTS.has(sub)) return { key: "boots", kind: "SHOE_WALL", hero: "PEDESTAL", camera: "SHOES" };
      if (FORMAL.has(sub)) return { key: "shoe_salon", kind: "SHOE_WALL", hero: "PEDESTAL", camera: "SHOES" };
      if (SANDALS.has(sub)) return { key: "sandals", kind: "SHOE_WALL", hero: "PEDESTAL", camera: "SHOES" };
      return { key: "shoes", kind: "SHOE_WALL", hero: "PEDESTAL", camera: "SHOES" };
    case "lower_piece":
      if (DENIM.has(sub)) return { key: "denim", kind: "DENIM_TABLE", hero: "PEDESTAL", camera: "FULL" };
      return { key: "bottoms", kind: "GARMENT_RACK", hero: "PEDESTAL", camera: "FULL" };
    case "upper_piece":
      if (DENIM.has(sub)) return { key: "denim", kind: "DENIM_TABLE", hero: "PEDESTAL", camera: "FULL" };
      if (OUTERWEAR.has(sub)) return { key: "outerwear", kind: "GARMENT_RACK", hero: "PEDESTAL", camera: "FULL" };
      return { key: "tops", kind: "GARMENT_RACK", hero: "PEDESTAL", camera: "FULL" };
    case "full_body_piece":
      return { key: "dresses", kind: "GARMENT_RACK", hero: "PEDESTAL", camera: "FULL" };
    case "accessory_piece":
      if (BAGS.has(sub)) return { key: "bags", kind: "VITRINE", hero: "VITRINE", camera: "DETAIL" };
      if (JEWELRY.has(sub)) return { key: "jewelry", kind: "VITRINE", hero: "VITRINE", camera: "DETAIL" };
      return { key: "accessories", kind: "VITRINE", hero: "VITRINE", camera: "DETAIL" };
    default:
      return null;
  }
}

/**
 * Perfil da cena a partir do contexto da busca. A busca manda; sem marca na busca, a marca do produto escolhido; busca
 * sem marca (só categoria), a loja multimarca; busca vazia, a marca da última peça vestida (o comportamento antigo); sem
 * nada vestido, a loja neutra.
 */
export function resolveScene(ctx: SceneContext): StoreScene {
  const category = ctx.category || ctx.product?.category || null;
  const subcategory = ctx.subcategory || (ctx.category && ctx.product?.category !== ctx.category ? null : ctx.product?.subcategory) || null;
  const zone = zoneFor(category, subcategory);
  const brandIn = ctx.brand?.name?.trim() ? ctx.brand : ctx.product?.brand?.name?.trim() ? ctx.product.brand : null;
  // busca com categoria ou produto e sem marca: loja multimarca da categoria; só a busca vazia herda a marca vestida
  const searching = !!(category || ctx.product || ctx.results?.length);
  let brand: BrandEnvironment; let others: BrandEnvironment[] = [];
  if (brandIn) brand = environmentFor(brandIn);
  else if (searching) brand = NEUTRAL_ENVIRONMENT;
  else {
    const env = resolveEnvironment(ctx.worn ?? []);
    brand = env.featured; others = env.others;
  }
  const branded = brand.key !== NEUTRAL_ENVIRONMENT.key;
  const hero = ctx.product ?? null;
  const pool = (ctx.results ?? []).filter((p) => p.id !== hero?.id && (!zone || zoneFor(p.category, p.subcategory)?.kind === zone.kind));
  const kind: SceneKind = zone ? (branded ? "brand-zone" : "zone") : branded ? "brand" : "neutral";
  return { kind, brand, others: brandIn ? [] : others, zone, hero, display: pool.slice(0, MAX_DISPLAY) };
}

// ───────────────────────────── mini palco (Eras) — plano 9.4

export interface ArtistStageInput {
  name: string;
  era?: string | null;
  /** cores das eras (ou a paleta aprovada do perfil) */
  colors: string[];
  logoUrl?: string | null;    // só logo aprovado pelo examinador
  seals?: string[];           // imagens dos selos do perfil (já aprovados)
  effects?: Partial<StageEffects>;
}
export interface StageEffects { confetti: boolean; fireworks: boolean; haze: boolean; lightsticks: boolean }
export interface ArtistStage {
  name: string;
  era: string | null;
  palette: [string, string, string];   // primária, secundária, destaque
  curtain: string;
  logoUrl: string | null;
  seals: string[];
  effects: StageEffects;
}

const hexOk = (c: string) => /^#[0-9a-f]{6}$/i.test(c);
function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)]; return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/** Palco do artista por regras a partir do perfil (opção "d" do estudo: regras + editor + curadoria). */
export function resolveArtistStage(input: ArtistStageInput): ArtistStage {
  const cs = input.colors.filter(hexOk);
  const primary = cs[0] ?? "#C6275E", secondary = cs[1] ?? "#2D55C9", accent = cs[2] ?? "#F2C94C";
  return {
    name: input.name.trim() || "FashionAI",
    era: input.era?.trim() || null,
    palette: [primary, secondary, accent],
    curtain: mixHex(primary, "#000000", 0.55),
    logoUrl: input.logoUrl ?? null,
    seals: (input.seals ?? []).slice(0, 4),
    effects: { confetti: true, fireworks: true, haze: true, lightsticks: true, ...input.effects },
  };
}
