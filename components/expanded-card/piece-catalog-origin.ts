import type { PieceView } from "@/lib/api/types";

type T = (key: string, vars?: Record<string, unknown>) => string;

/**
 * Exercício 20 · origem da peça no catálogo, como o servidor confirmou: SKU e cor da MESMA variante guardada na peça.
 * Peça que não veio do catálogo não mostra a linha; sem variante, só informa que a referência é o produto.
 */
export function pieceCatalogOrigin(piece: Pick<PieceView, "catalogProductId" | "catalogVariantId" | "sku" | "color">, colorLabel: (color: string) => string, t: T): string | null {
  if (!piece.catalogProductId) return null;
  if (!piece.catalogVariantId) return t("pieceDetail.catalogo_produto");
  const cor = colorLabel(piece.color);
  return piece.sku ? t("pieceDetail.catalogo_sku_cor", { sku: piece.sku, cor }) : t("pieceDetail.catalogo_sem_sku", { cor });
}
