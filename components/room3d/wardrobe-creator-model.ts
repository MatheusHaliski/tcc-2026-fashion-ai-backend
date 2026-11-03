import { tr } from "@/lib/i18n/i18n";
import type { BlockFinish } from "@/components/room3d/wardrobe-preview";

/*
 * Modelo do criador de guarda-roupa 3D (RF39, wardrobe-creator.tsx) e da loja do quarto: os tipos da API do criador,
 * as tabelas de disponibilidade e de blocos, o formulário vazio e as funções puras de nível, data e acabamento.
 */

export interface CreatorBlock { slotType: string; moldId: string; widthCm: number; label: string; basePrice: number; minLevel: string; materials: string[]; }
export interface CreatorMaterial { code: string; label: string; roughness: number; metalness: number; priceFactor: number; minLevel: string; colors: string[]; }
export interface Options { blocks: CreatorBlock[]; materials: CreatorMaterial[]; colors: Record<string, string>; levels: string[]; identity: { name: string; logoUrl?: string | null; slug?: string | null; kind: string }; seals: { id: string; name: string; availableFrom: string; availableUntil: string }[]; currency: string; }
export interface StoreItem {
  sku: string; name: string; kind: "COMPONENT" | "WARDROBE"; description?: string | null; moldId: string; slotType: string; blockLabel: string; widthCm?: number; material?: string | null; materialLabel?: string | null;
  colorName?: string | null; finish?: BlockFinish & { colorName?: string; texture?: string; creator?: string; sealId?: string }; bundle?: { slotType: string; moldId: string; material: string; colorName: string; finish: BlockFinish }[];
  rarity?: string; pricePoints: number; requiredLevel: string; stock?: number | null; stockLeft?: number | null; sold: number; perUserLimit?: number | null; availableFrom?: string | null; availableUntil?: string | null;
  availability: "DISPONIVEL" | "EM_BREVE" | "EXPIRADO" | "ESGOTADO" | "INATIVO"; requiresSeal: boolean; active: boolean; labelText?: string | null; logoUrl?: string | null; artUrl?: string | null;
  seal?: { id: string; name: string } | null; creator?: { name: string; logoUrl?: string | null; slug?: string | null; kind: string } | null;
  ownedCount?: number; blocker?: string | null; levelOk?: boolean; affordable?: boolean; owned?: boolean; compatibleModules?: string[];
}
export interface Mine { identity: Options["identity"]; items: StoreItem[]; stats: { items: number; sold: number; points: number }; }
export interface Part { moldId: string; material: string; colorName: string; color: string; }
export interface Form { kind: "COMPONENT" | "WARDROBE"; name: string; description: string; labelText: string; logoUrl: string; artUrl: string; sealId: string; pricePoints: string; requiredLevel: string; stock: string; perUserLimit: string; availableFrom: string; availableUntil: string; requiresSeal: boolean; active: boolean; }

export const AVAILABILITY: Record<string, { label: string; tone?: "mark" | "thread" | "chalk" }> = {
  DISPONIVEL: { get label() { return tr("room3d.wardrobeCreator.a_venda"); }, tone: "thread" }, EM_BREVE: { get label() { return tr("room3d.wardrobeCreator.em_breve"); }, tone: "chalk" }, EXPIRADO: { label: "expirado", tone: "mark" }, ESGOTADO: { label: "esgotado", tone: "mark" }, INATIVO: { get label() { return tr("room3d.wardrobeCreator.fora_da_loja"); } },
};
/** Blocos da pré-visualização: o FAI Origem e os móveis à parte (sapateira, vitrine, porta-joias, ilha). */
export const SLOT_LABELS: Record<string, string> = { get MIRROR() { return tr("room3d.wardrobeCreator.espelho"); }, get DOOR() { return tr("room3d.wardrobeCreator.portas"); }, get DRAWER() { return tr("room3d.wardrobeCreator.gavetas"); }, get HANDLE() { return tr("common.puxadores"); }, get TOP() { return tr("common.maleiro"); }, get BASE() { return tr("common.base"); }, get HANGER() { return tr("common.cabides"); }, get LOGO() { return tr("common.placa_de_logo"); }, LIGHT: "LED", get RUG() { return tr("common.tapete"); }, get SHOE_RACK() { return tr("room3d.roomScene.sapateira"); }, get BAG_DISPLAY() { return tr("room3d.roomScene.vitrine_de_bolsas"); }, get JEWELRY() { return tr("common.porta_joias"); }, get ISLAND() { return tr("common.ilha_central"); } };
export const PREVIEW_SLOTS = ["DOOR", "DRAWER", "HANDLE", "TOP", "BASE", "HANGER", "LOGO", "LIGHT", "RUG", "SHOE_RACK", "BAG_DISPLAY", "JEWELRY", "ISLAND"];
export const LV = ["ESTREIA", "STUDIO", "LOFT"];
export const higher = (a: string, b: string) => (LV.indexOf(a) >= LV.indexOf(b) ? a : b);
export const empty: Form = { kind: "WARDROBE", name: "", description: "", labelText: "", logoUrl: "", artUrl: "", sealId: "", pricePoints: "", requiredLevel: "ESTREIA", stock: "", perUserLimit: "", availableFrom: "", availableUntil: "", requiresSeal: false, active: true };
export const local = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

/** Acabamento de uma parte (material + cor), no formato que a cena 3D e a loja usam. */
export function finishOf(m: CreatorMaterial | undefined, p: Part): BlockFinish {
  return { color: p.color, roughness: m?.roughness, metalness: m?.metalness, material: m?.code };
}
