/*
 * MET Gala Heist v2 — as cartas FLAIR do deck viram recursos da partida, cada uma pelo que a peça é:
 *
 *  - roupa e calçado (parte de cima, de baixo, corpo inteiro, calçados): VESTIR. A jogadora troca de roupa (abaixa e se
 *    troca, de preferência escondida) e a peça muda o disfarce: vestido de festa/estilo de gala = convidada; peça casual
 *    lá dentro chama atenção. Salto faz barulho, corre menos e não escala; tênis e bota escalam a escada de incêndio.
 *  - óculos: VISÃO (seguranças, lasers e a combinação da vitrine através das paredes por alguns segundos).
 *  - joias: GRAMPO (abre o teclado da doca, o cofre da segurança e a trava da vitrine sem o código).
 *  - bolsas e carteiras: MUNIÇÃO (pentes escondidos — recarregam a pistola).
 *  - cinto: COLDRE com faca.
 *  - relógio: CRONÔMETRO (o tempo desacelera: lasers e seguranças mais lentos).
 *  - lenço: CURATIVO (recupera vida).
 *  - chapéu, boné, gorro: CAPUZ (o rosto coberto: reconhecem só mais de perto).
 *  - o que não tem uso próprio: só TROCA.
 *
 * Toda carta também vale créditos no REVENDEDOR (estande da rua e o balcão do bar): ele negocia roupa por kit médico,
 * munição, faca, pistola, uniforme de garçom, convite. O valor vem da raridade, da força da marca (CLOUT) e do Hype
 * público; armas exigem pelo menos uma peça cara ("só troco a pistola por peça de grife"). Usar ou trocar uma carta vale só
 * para esta partida: a peça continua na coleção.
 */
import type { Look3dPiece } from "@/components/three/common";
import type { CardTier, CardUse, HeistCard, ItemId, VendorOffer } from "./types";

/** O que o jogo precisa da carta (o mesmo formato do FlairCard de /api/flair/decks). */
export interface DeckCard {
  id: string; name: string; category: string; subcategory: string; imageUrl?: string | null; colorHex?: string | null; brandName?: string | null;
  styles?: string[]; occasions?: string[]; material?: string | null; stats?: Record<string, number>; rarity: string; power?: number;
  hype?: { score?: number | null } | null;
}

export function tierOf(rarity: string): CardTier {
  const r = rarity.toUpperCase();
  if (/COLLAB|SPECIAL|ESPECIAL|LEGEND|ICON/.test(r)) return "ESPECIAL";
  if (r === "LIMITED" || r === "RARE") return "OURO";
  if (r === "PREMIUM") return "PRATA";
  return "BRONZE";
}
const TIER_VALUE: Record<CardTier, number> = { BRONZE: 18, PRATA: 32, OURO: 52, ESPECIAL: 80 };
export const TIER_RANK: Record<CardTier, number> = { BRONZE: 0, PRATA: 1, OURO: 2, ESPECIAL: 3 };

/** Valor de revenda (créditos): raridade + força da marca + Hype público + grife. ~18 a ~114. */
export function cardValue(c: DeckCard): number {
  const clout = c.stats?.CLOUT ?? 50, hype = c.hype?.score ?? 0;
  return Math.round(TIER_VALUE[tierOf(c.rarity)] + (clout / 100) * 20 + (Math.max(0, Math.min(100, hype)) / 100) * 10 + (c.brandName ? 4 : 0));
}

const has = (s: string, ...k: string[]) => k.some((x) => s.includes(x));
const GALA_OCCASIONS = ["party", "formal", "wedding", "ceremony", "night_out", "gala", "cocktail"];
const GALA_STYLES = ["glam", "luxury", "chic", "tailored", "romantic", "elegant", "classic", "avant_garde"];

/** Para que serve a carta na partida (pelo tipo da peça). */
export function useOf(c: DeckCard): { use: CardUse; slot?: HeistCard["slot"]; dress?: HeistCard["dress"]; shoes?: HeistCard["shoes"] } {
  const cat = (c.category ?? "").toLowerCase(), sub = (c.subcategory ?? "").toLowerCase();
  if (cat.startsWith("accessory")) {
    if (has(sub, "glass", "oculos", "óculos")) return { use: "VISION" };
    if (has(sub, "necklace", "earring", "ring", "bracelet", "brooch", "jewel", "colar", "brinco", "anel", "pulseira")) return { use: "PICK" };
    if (has(sub, "bag", "clutch", "tote", "wallet", "backpack", "bolsa", "carteira", "mochila", "pochete")) return { use: "AMMO" };
    if (has(sub, "belt", "cinto")) return { use: "KNIFE" };
    if (has(sub, "watch", "relogio", "relógio")) return { use: "TIME" };
    if (has(sub, "scarf", "lenco", "lenço", "bandana")) return { use: "BANDAGE" };
    if (has(sub, "hat", "cap", "beanie", "bone", "boné", "gorro", "chapeu", "chapéu", "beret", "boina")) return { use: "HOOD" };
    return { use: "TRADE" };
  }
  const styles = (c.styles ?? []).map((s) => s.toLowerCase()), occ = (c.occasions ?? []).map((s) => s.toLowerCase());
  const gala = occ.some((o) => GALA_OCCASIONS.includes(o)) || styles.some((s) => GALA_STYLES.includes(s)) || has(sub, "dress", "gown", "blazer", "tailored", "heels", "suit");
  if (cat.startsWith("shoes")) {
    const shoes = has(sub, "heel", "pump", "stiletto", "salto", "scarpin") ? "heels" : has(sub, "sneaker", "tenis", "tênis", "running", "training", "skate", "basketball") ? "sneakers" : has(sub, "boot", "bota", "coturno") ? "boots" : "flat";
    return { use: "WEAR", slot: "SHOES", shoes, dress: gala ? "gala" : "casual" };
  }
  const slot = cat.startsWith("full") ? "FULL" : cat.startsWith("lower") ? "BOTTOM" : "TOP";
  return { use: "WEAR", slot, dress: gala ? "gala" : "casual" };
}

export function toHeistCard(c: DeckCard): HeistCard {
  const u = useOf(c);
  return { id: c.id, name: c.name, tier: tierOf(c.rarity), value: cardValue(c), use: u.use, slot: u.slot, dress: u.dress, shoes: u.shoes, category: c.category, subcategory: c.subcategory, imageUrl: c.imageUrl ?? null, colorHex: c.colorHex ?? null, brandName: c.brandName ?? null, rarity: c.rarity };
}

/** Kit inicial (decks com menos de 4 cartas): garante um curativo, munição e um grampo — a missão sempre tem saída. */
export const STARTER: HeistCard[] = [
  { id: "starter-scarf", name: "starter.scarf", tier: "BRONZE", value: 14, use: "BANDAGE", category: "accessory_piece", subcategory: "scarf", rarity: "STANDARD", colorHex: "#8a1f2c", starter: true },
  { id: "starter-clutch", name: "starter.clutch", tier: "BRONZE", value: 16, use: "AMMO", category: "accessory_piece", subcategory: "clutch", rarity: "STANDARD", colorHex: "#111114", starter: true },
  { id: "starter-earrings", name: "starter.earrings", tier: "BRONZE", value: 15, use: "PICK", category: "accessory_piece", subcategory: "earrings", rarity: "STANDARD", colorHex: "#d9d4c6", starter: true },
];
export const MAX_DECK = 8;

/** Cartas da partida: até 8 do deck escolhido (as mais valiosas primeiro) + o kit inicial se o deck for curto. */
export function matchCards(deck: DeckCard[]): HeistCard[] {
  const cards = [...deck].map(toHeistCard).sort((a, b) => b.value - a.value).slice(0, MAX_DECK);
  return cards.length < 4 ? [...cards, ...STARTER] : cards;
}

/** Quantos usos a carta dá (Visão e Cronômetro sobem com a raridade) e o tamanho do efeito. */
export function charges(c: HeistCard): number { return c.use === "VISION" || c.use === "TIME" ? 1 + (TIER_RANK[c.tier] >= 2 ? 1 : 0) : 1; }
export function effectSize(c: HeistCard): number {
  const k = TIER_RANK[c.tier];
  switch (c.use) {
    case "BANDAGE": return [25, 35, 50, 70][k];        // pontos de vida
    case "AMMO": return [12, 18, 24, 32][k];          // balas
    case "VISION": return [8, 10, 12, 15][k];         // segundos
    case "TIME": return [4, 5, 6, 8][k];              // segundos
    default: return 0;
  }
}

/** A peça da carta vestida no corpo (o provador monta o molde pela subcategoria e a foto da carta). */
export function pieceOf(c: HeistCard): Look3dPiece {
  const slot = c.slot === "FULL" ? "full" : c.slot === "BOTTOM" ? "lower" : c.slot === "SHOES" ? "shoes" : "upper";
  const cat = c.slot === "FULL" ? "FULL_BODY" : c.slot === "BOTTOM" ? "LOWER" : c.slot === "SHOES" ? "SHOES" : "UPPER";
  return { id: `card-${c.id}`, name: c.name, slot, category: cat, subcategory: c.subcategory, imageUrl: c.imageUrl ?? null, colorHex: c.colorHex ?? null };
}

/* ---------- revendedor ---------- */
export type OfferLock = { kind: "ok" } | { kind: "stock" } | { kind: "credits"; missing: number } | { kind: "piece"; need: number; best: number; given: number };
/**
 * Pode comprar? `credits`: o que a jogadora já tem com este revendedor; `bestGiven`: a peça mais cara que ela já entregou a
 * ele nesta partida; `bestOwned`: a peça mais cara que ainda pode entregar. Arma com `minPiece` fica BLOQUEADA quando nem
 * as peças que ela tem chegam lá — o painel mostra o motivo com os números.
 */
export function offerLock(o: VendorOffer, credits: number, bestGiven: number, bestOwned: number): OfferLock {
  if (o.stock <= 0) return { kind: "stock" };
  if (o.minPiece && bestGiven < o.minPiece) return { kind: "piece", need: o.minPiece, best: bestOwned, given: bestGiven };
  if (credits < o.price) return { kind: "credits", missing: o.price - credits };
  return { kind: "ok" };
}
/** A oferta ainda pode ser destravada com as cartas que sobraram? (para separar "bloqueada" de "falta entregar"). */
export function reachable(o: VendorOffer, credits: number, bestGiven: number, owned: HeistCard[]): boolean {
  const total = credits + owned.reduce((s, c) => s + c.value, 0);
  const best = Math.max(bestGiven, ...owned.map((c) => c.value), 0);
  return o.stock > 0 && total >= o.price && (!o.minPiece || best >= o.minPiece);
}

/** Cura dos itens e o que cada compra entrega. */
export const ITEM_HEAL: Partial<Record<ItemId, number>> = { medkit: 50, medkitXL: 100 };
export const AMMO_PACK = 20;
export const MAG_SIZE: Record<"pistol" | "pistolS" | "guardPistol", number> = { pistol: 10, pistolS: 12, guardPistol: 8 };
/** Dano por tiro (a pistola comum define a "vida implícita": 3 tiros na rua, 9 na Sala das Joias). */
export const SHOT_DAMAGE: Record<"pistol" | "pistolS" | "guardPistol", number> = { pistol: 34, pistolS: 42, guardPistol: 34 };
export const KNIFE_DAMAGE = 52, FIST_DAMAGE = 16;
/** Vida do segurança pelo nível da sala: o número de tiros da pistola comum. */
export const guardHp = (tier: number) => 34 * tier - 2;
