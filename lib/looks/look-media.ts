import { mediaUrl, thumbSrcSet, thumbUrl } from "@/lib/api/client";
import type { SchemeItemView, SchemeView } from "@/lib/api/types";
import { informedPrice } from "@/lib/api/piece-price";
import { isWithoutPhoto, pieceImageUrl } from "@/lib/pieces/piece-image";

/**
 * Imagens e preço de um look a partir das peças: a mesma fonte de cor das miniaturas de peça (peça sem foto aparece
 * na cor do cadastro, não na ilustração azul da categoria) e o total só com os preços informados (sem "R$ 0,00").
 */
function itemInput(it: SchemeItemView | undefined) {
  if (!it) return null;
  const p = it.piece;
  return { ...p, imageUrl: p?.imageUrl ?? (it.imageUrl as string | undefined) ?? null, thumbnailUrl: p?.thumbnailUrl ?? null };
}

/** Preço de uma peça do look que vale mostrar (zero gravado pelo cadastro = sem preço). */
export const lookPiecePrice = informedPrice;

/** Miniatura de uma peça do look. */
export function lookItemImage(it: SchemeItemView, size: 320 | 640 = 320): string | undefined {
  return pieceImageUrl(itemInput(it) ?? {}, size);
}

/** Capa do look: a composição/foto do look ou, sem ela, a imagem da primeira peça (na cor cadastrada se não tiver foto). */
export function lookCover(s: SchemeView): { src?: string; srcSet?: string } {
  if (s.coverImageUrl) return { src: mediaUrl(s.coverImageUrl) };
  const first = itemInput(s.items?.[0]);
  if (!first) return {};
  const photo = !isWithoutPhoto(first);
  if (!photo) return { src: pieceImageUrl(first, 640) };
  return { src: thumbUrl(first.imageUrl ?? first.thumbnailUrl, 640), srcSet: thumbSrcSet(first.imageUrl) };
}

/** Total do look: o do servidor quando informado; senão a soma das peças com preço; nenhuma com preço → nulo ("—"). */
export function lookTotal(totalPrice: number | null | undefined, prices: (number | null | undefined)[]): number | null {
  const informed = informedPrice(totalPrice);
  if (informed != null) return informed;
  const known = prices.map(informedPrice).filter((v): v is number => v != null);
  return known.length ? known.reduce((a, v) => a + v, 0) : null;
}
