import type { PieceView } from "@/lib/api/types";
import type { CatalogProduct, CatalogVariant } from "@/lib/api/catalog";
import { label } from "@/lib/api/taxonomy";
import type { Avatar3dRef, Look3dPiece } from "@/components/three/common";
import type { SceneProduct } from "@/lib/scene3d/scene";
import {
  slotOf,
  wearOf,
  type FittingItem,
  type FittingSlot,
} from "@/lib/tryon/fitting-room";

/** Apresentação do manequim; não restringe o gênero de quem usa o provador. */
export type Sex = "MASCULINO" | "FEMININO" | "UNISEX";

export interface Entry {
  piece: PieceView;
  slot: FittingSlot;
  wear: string;
}

/** Resposta da API do provador, incluindo o guarda-roupa e o avatar disponíveis. */
export interface State {
  mannequin: {
    sex: Sex;
    build: string;
    skinTone?: string | null;
  };
  sex: Sex;
  pieces: Record<FittingSlot, Entry[]>;
  avatar?: Avatar3dRef | null;
  needsReview?: { piece: PieceView }[];
}

export interface Store {
  brandId: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  catalogProducts: number;
  categories: string[];
}

export interface SavedTry {
  id: string;
  title: string;
  items: FittingItem[];
  createdAt: number;
}

export type Tab = "stores" | "wardrobe" | "saved";

const WEAR3D: Record<string, string> = {
  TOP: "upper",
  OUTERWEAR: "outer_layer",
  BOTTOM: "lower",
  FULL_BODY: "dress",
  SHOES: "shoes",
  ACCESSORY: "accessory",
};

let clock = 0;

/** Conserva a ordem de escolha utilizada pelo motor de ambiente do provador. */
export const nextTick = () => Math.max(Date.now(), ++clock);

/** Valor de apresentação enviado à preferência do provador. */
export function toDatabaseTipoLook(value: Sex): "masculino" | "feminino" | "unisex" {
  return value === "FEMININO" ? "feminino" : value === "MASCULINO" ? "masculino" : "unisex";
}

/** Adapta um produto e sua variante para a peça que pode ser vestida na cena. */
export function fromCatalog(
  p: CatalogProduct,
  variant: CatalogVariant | null,
  colors: Record<string, string> | undefined
): FittingItem | null {
  const color = variant?.color ?? p.color ?? null;
  const slot = slotOf(p.category);

  if (!slot) return null;

  return {
    key: `c:${p.id}`,
    source: "catalog",
    slot,
    wear: wearOf(p.category, p.subcategory),
    name: p.productName,
    brand: p.brand
      ? {
          name: p.brand.name,
          slug: p.brand.slug,
          logoUrl: p.brand.logoUrl ?? null,
        }
      : null,
    category: p.category,
    subcategory: p.subcategory,
    imageUrl: p.imageUrl ?? null,
    colorHex: (color && colors?.[color]) || p.colorHex || null,
    colorName:
      variant?.colorName ??
      p.colorName ??
      (color ? label(color) : null),
    productId: p.id,
    variantId: variant?.id ?? null,
    processedUrl: processedImageOf(p),
    officialUrl:
      p.source?.productUrl && p.source.productUrl !== "null"
        ? p.source.productUrl
        : null,
    sourceDomain:
      p.source?.domain && p.source.domain !== "null"
        ? p.source.domain
        : null,
    addedAt: nextTick(),
  };
}

/** Adapta uma entrada do guarda-roupa para o mesmo contrato usado pelo catálogo. */
export function fromWardrobe(e: Entry): FittingItem {
  const p = e.piece;

  return {
    key: `w:${p.id}`,
    source: "wardrobe",
    slot: e.slot,
    wear:
      (e.wear as FittingItem["wear"]) ??
      wearOf(p.category, p.subcategory),
    name: p.name,
    brand: p.brandName
      ? {
          name: p.brandName,
          logoUrl: p.brandLogoUrl ?? null,
        }
      : null,
    category: p.category,
    subcategory: p.subcategory,
    imageUrl: p.imageUrl ?? p.thumbnailUrl ?? null,
    colorHex: p.colorHex ?? null,
    colorName: p.color ? label(p.color) : null,
    pieceId: p.id,
    addedAt: nextTick(),
    model3dUrl: p.model3dUrl ?? null,
    model3dStatus: p.model3dStatus ?? null,
    // a foto do guarda-roupa já é nossa (mesma origem); variação e atributos dão a classe de caimento e os comprimentos
    processedUrl: p.imageUrl ?? null,
    variation: (p as { variation?: string | null }).variation ?? null,
    attributes: (p as { attributes?: Record<string, string[]> | null }).attributes ?? null,
  };
}

/** Foto do catálogo que o 3D consegue ler: a processada no nosso armazenamento (servida por /media com CORS). A externa
 * (site da marca) normalmente não libera CORS: a textura falharia e a peça viraria uma casca lisa "pintada". */
export function processedImageOf(p: CatalogProduct): string | null {
  const ci = (p as { catalogImage?: { mode?: string; url?: string | null } }).catalogImage;
  if (ci?.mode === "PROCESSED" && ci.url) return ci.url;
  const imgs = ((p as { images?: { primary?: boolean; processedUrl?: string | null }[] }).images ?? []);
  const img = imgs.find((x) => x.primary && x.processedUrl) ?? imgs.find((x) => x.processedUrl);
  return img?.processedUrl ?? null;
}

export const toSceneProduct = (p: CatalogProduct): SceneProduct => ({
  id: p.id,
  name: p.productName,
  imageUrl: p.imageUrl ?? null,
  category: p.category,
  subcategory: p.subcategory,
  brand: p.brand
    ? {
        name: p.brand.name,
        slug: p.brand.slug,
        logoUrl: p.brand.logoUrl ?? null,
      }
    : null,
});

export const toLook3d = (i: FittingItem): Look3dPiece => ({
  id: i.key,
  name: i.name,
  slot: WEAR3D[i.wear] ?? "accessory",
  category: i.category,
  subcategory: i.subcategory ?? undefined,
  imageUrl: i.imageUrl,
  studioUrl: i.processedUrl ?? null,
  variation: i.variation ?? null,
  attributes: i.attributes ?? null,
  colorHex: i.colorHex,
  model3dUrl: i.model3dUrl,
  model3dStatus: i.model3dStatus,
  defaultImage: !i.imageUrl,
});
