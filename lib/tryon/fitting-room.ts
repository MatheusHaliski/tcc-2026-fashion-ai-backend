/*
 * Provador virtual de lojas (RF18 + RF47): o que está sendo provado e o AMBIENTE do provador.
 *
 * O provador prova peças de várias marcas ao mesmo tempo — do catálogo de lojas oficiais e, se a pessoa quiser, do próprio
 * guarda-roupa — e o cenário 3D acompanha: a marca da última peça escolhida vira o destaque (parede do logo, letreiro, cor
 * da luz, padrão da parede); as outras marcas vestidas aparecem nos painéis laterais. Tudo aqui é puro (sem React/three),
 * para o motor de ambiente ser testável e o mesmo para a cena, a legenda e a acessibilidade.
 */

export type FittingSlot = "upper_piece" | "lower_piece" | "shoes_piece" | "accessory_piece";
export const FITTING_SLOTS: FittingSlot[] = ["upper_piece", "lower_piece", "shoes_piece", "accessory_piece"];
/** Forma de vestir no corpo (mesmos nomes do backend: SchemeSlot / LocalSchemeComposer.slotOf). */
export type Wear = "TOP" | "OUTERWEAR" | "BOTTOM" | "FULL_BODY" | "SHOES" | "ACCESSORY";
const OUTERWEAR = new Set(["jacket", "coat", "parka", "blazer", "windbreaker", "cardigan", "kimono"]);

export interface FittingBrand { name: string; slug?: string | null; logoUrl?: string | null }
/** Uma peça no provador: produto de loja (catálogo) ou peça do próprio guarda-roupa. */
export interface FittingItem {
  key: string;                                  // "c:<productId>" | "w:<pieceId>"
  source: "catalog" | "wardrobe";
  slot: FittingSlot;
  wear: Wear;
  name: string;
  brand: FittingBrand | null;
  category: string;
  subcategory?: string | null;
  imageUrl?: string | null;
  colorHex?: string | null;
  colorName?: string | null;
  productId?: string;
  variantId?: string | null;
  pieceId?: string;
  officialUrl?: string | null;
  sourceDomain?: string | null;
  addedAt: number;                              // ordem de escolha: a mais recente define a marca em destaque
}

/** Forma de vestir pela categoria gravada (nunca pelo nome): o mesmo critério do backend. */
export function wearOf(category: string, subcategory?: string | null): Wear {
  switch (category) {
    case "upper_piece": return subcategory && OUTERWEAR.has(subcategory) ? "OUTERWEAR" : "TOP";
    case "lower_piece": return "BOTTOM";
    case "shoes_piece": return "SHOES";
    case "full_body_piece": return "FULL_BODY";
    default: return "ACCESSORY";
  }
}
/** Lugar no corpo: a peça inteira (vestido, macacão) ocupa a parte de cima e cobre a de baixo. */
export function slotOf(category: string): FittingSlot {
  if (category === "lower_piece") return "lower_piece";
  if (category === "shoes_piece") return "shoes_piece";
  if (category === "upper_piece" || category === "full_body_piece") return "upper_piece";
  return "accessory_piece";
}

/** Vestir: a nova peça toma o lugar dela; a peça inteira tira a parte de baixo do corpo (mas não do histórico da prova). */
export function wearItem(items: FittingItem[], item: FittingItem): FittingItem[] {
  return [...items.filter((i) => i.slot !== item.slot), item];
}
export function removeSlot(items: FittingItem[], slot: FittingSlot): FittingItem[] { return items.filter((i) => i.slot !== slot); }
/** O que aparece no corpo: com peça inteira vestida, a parte de baixo fica guardada. */
export function visibleItems(items: FittingItem[]): FittingItem[] {
  const full = items.some((i) => i.wear === "FULL_BODY");
  return full ? items.filter((i) => i.slot !== "lower_piece") : items;
}

// ───────────────────────────── ambiente por marca

export type RoomStyle = "arena" | "heritage" | "gallery" | "street" | "boutique" | "atelier";
export type WallMotif = "plain" | "stripes" | "checker" | "denim" | "court" | "grid" | "chevron";
export interface BrandEnvironment {
  key: string;                                  // slug normalizado (ou "neutral")
  name: string;                                 // nome exibido no letreiro
  logoUrl: string | null;
  style: RoomStyle;
  motif: WallMotif;
  wall: string;                                 // cor das paredes
  floor: string;                                // cor do piso
  accent: string;                               // luz de destaque, faixas, letreiro
  ink: string;                                  // cor do texto sobre a parede
  curated: boolean;                             // tema escolhido à mão (true) ou derivado do nome (false)
}

/**
 * Temas escolhidos à mão para as marcas semeadas no catálogo. São CORES e ESTILOS de ambiente (inspirados na loja física),
 * não reproduções de identidade visual: o logo só entra pela URL que o catálogo guarda para a marca; sem ela, o letreiro
 * mostra o nome escrito.
 */
const CURATED: Record<string, Omit<BrandEnvironment, "key" | "name" | "logoUrl" | "curated">> = {
  nike: { style: "arena", motif: "court", wall: "#16181C", floor: "#2A2D33", accent: "#F26A1B", ink: "#FFFFFF" },
  adidas: { style: "arena", motif: "stripes", wall: "#F2F2F0", floor: "#1E1F22", accent: "#1F4FD8", ink: "#111111" },
  lacoste: { style: "boutique", motif: "plain", wall: "#F6F4EE", floor: "#D9D2C4", accent: "#0B6B3A", ink: "#123524" },
  levis: { style: "heritage", motif: "denim", wall: "#2C3E5C", floor: "#6B4A32", accent: "#C8102E", ink: "#F4EEE3" },
  puma: { style: "arena", motif: "chevron", wall: "#101010", floor: "#262626", accent: "#E11D2E", ink: "#FFFFFF" },
  "new-balance": { style: "atelier", motif: "grid", wall: "#C9CBCF", floor: "#5B5F66", accent: "#CF2E2E", ink: "#1C1E22" },
  vans: { style: "street", motif: "checker", wall: "#1A1A1A", floor: "#3A3A3A", accent: "#D7263D", ink: "#FFFFFF" },
  converse: { style: "street", motif: "plain", wall: "#EDEAE3", floor: "#2B2B2B", accent: "#111111", ink: "#111111" },
  uniqlo: { style: "gallery", motif: "grid", wall: "#FFFFFF", floor: "#E7E3DC", accent: "#E60012", ink: "#1A1A1A" },
  zara: { style: "gallery", motif: "plain", wall: "#EAE4DA", floor: "#CFC6B8", accent: "#1A1A1A", ink: "#1A1A1A" },
};

export const NEUTRAL_ENVIRONMENT: BrandEnvironment = {
  key: "neutral", name: "FashionAI", logoUrl: null, style: "atelier", motif: "plain",
  wall: "#EFECE7", floor: "#D9D3CA", accent: "#C6275E", ink: "#2D2438", curated: true,
};

/** "Levi's" → "levis", "New Balance" → "new-balance" (o mesmo slug do catálogo). */
export function brandKey(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’`]/g, "").replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hsl(h: number, s: number, l: number): string {
  s /= 100; l /= 100; const k = (n: number) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, "0");
  return `#${f(0)}${f(8)}${f(4)}`;
}
const STYLES: RoomStyle[] = ["arena", "heritage", "gallery", "street", "boutique", "atelier"];
const MOTIFS: WallMotif[] = ["plain", "stripes", "grid", "chevron", "court", "plain"];

/** Ambiente de uma marca: o tema escolhido à mão, ou um derivado do nome (estável — a mesma marca, o mesmo provador). */
export function environmentFor(brand: FittingBrand): BrandEnvironment {
  // marca só com slug (sem nome) vira o próprio slug no letreiro: nunca um nome indefinido na cena
  if (!brand.name?.trim()) brand = { ...brand, name: brand.slug ?? "" };
  const key = brand.slug ? brandKey(brand.slug) : brandKey(brand.name);
  const curated = CURATED[key];
  if (curated) return { key, name: brand.name, logoUrl: brand.logoUrl ?? null, curated: true, ...curated };
  const h = hash(key || brand.name); const hue = h % 360; const dark = (h >>> 9) % 3 === 0;
  return {
    key: key || "brand", name: brand.name, logoUrl: brand.logoUrl ?? null, curated: false,
    style: STYLES[(h >>> 3) % STYLES.length], motif: MOTIFS[(h >>> 6) % MOTIFS.length],
    wall: dark ? hsl(hue, 14, 14) : hsl(hue, 16, 93), floor: dark ? hsl(hue, 10, 24) : hsl(hue, 12, 78),
    accent: hsl((hue + 180) % 360, 70, dark ? 58 : 44), ink: dark ? "#FFFFFF" : "#1A1A1A",
  };
}

export type EnvironmentMode = "auto" | "neutral" | { pinned: string };
export interface ResolvedEnvironment {
  kind: "neutral" | "brand" | "multibrand";
  featured: BrandEnvironment;                   // a parede do logo, o letreiro e a luz
  others: BrandEnvironment[];                   // painéis laterais (até 3), da escolha mais recente para a mais antiga
  brands: BrandEnvironment[];                   // todas as marcas vestidas, sem repetição
}

/**
 * Motor de ambiente: a marca da peça escolhida por último é o destaque; as demais marcas vestidas viram painéis laterais.
 * "Fixar" uma marca (pinned) mantém o destaque nela enquanto a pessoa continua provando; "neutral" desliga o tema.
 */
export function resolveEnvironment(items: FittingItem[], mode: EnvironmentMode = "auto"): ResolvedEnvironment {
  const ordered = [...items].filter((i) => i.brand?.name?.trim()).sort((a, b) => b.addedAt - a.addedAt);
  const brands: BrandEnvironment[] = [];
  for (const i of ordered) { const env = environmentFor(i.brand!); if (!brands.some((b) => b.key === env.key)) brands.push(env); }
  if (mode === "neutral" || !brands.length) return { kind: "neutral", featured: NEUTRAL_ENVIRONMENT, others: [], brands };
  const pinned = typeof mode === "object" ? brands.find((b) => b.key === mode.pinned) : undefined;
  const featured = pinned ?? brands[0];
  const others = brands.filter((b) => b.key !== featured.key).slice(0, 3);
  return { kind: others.length ? "multibrand" : "brand", featured, others, brands };
}

// ───────────────────────────── luz e compartilhamento

export type LightMode = "store" | "daylight" | "night";

/** Link da prova: "c.<produto>.<variante|->" para lojas e "w.<peça>" para o guarda-roupa, separados por vírgula. */
export function encodeTryOn(items: FittingItem[]): string {
  return [...items].sort((a, b) => a.addedAt - b.addedAt).map((i) => i.source === "catalog" ? `c.${i.productId}.${i.variantId ?? "-"}` : `w.${i.pieceId}`).join(",");
}
export interface TryOnRef { source: "catalog" | "wardrobe"; id: string; variantId: string | null }
export function decodeTryOn(raw: string | null | undefined): TryOnRef[] {
  if (!raw) return [];
  return raw.split(",").slice(0, 8).flatMap((part): TryOnRef[] => {
    const [kind, id, variant] = part.split(".");
    if (!id || !/^[0-9a-zA-Z-]{1,64}$/.test(id)) return [];
    if (kind === "c") return [{ source: "catalog", id, variantId: variant && variant !== "-" && /^[0-9a-zA-Z-]{1,64}$/.test(variant) ? variant : null }];
    if (kind === "w") return [{ source: "wardrobe", id, variantId: null }];
    return [];
  });
}
