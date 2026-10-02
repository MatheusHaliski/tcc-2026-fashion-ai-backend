import type { SchemeView } from "@/lib/api/types";

/**
 * Anatomias da peça (seção C, docs/anatomias/anatomias_card_v19.html · "versão por modelo"): o Background Studio grava a
 * escolha em `background.pieces.anatomy` do look. A anatomia do card (seção A) decide onde as peças ficam; esta decide
 * como cada peça aparece dentro do card. Lógica pura, sem JSX, para os testes (vitest) e para o card.
 */
export const PIECE_ANATOMY_IDS = ["PECA_AMPLIADO", "PASSARELA", "ETIQUETA", "RAIO_X", "BENTO", "ESPECTRO", "CUSTO_POR_USO", "LEGO"] as const;
export type PieceAnatomyId = (typeof PIECE_ANATOMY_IDS)[number];
export const DEFAULT_PIECE_ANATOMY: PieceAnatomyId = "PECA_AMPLIADO";
export const isPieceAnatomy = (v: unknown): v is PieceAnatomyId => typeof v === "string" && (PIECE_ANATOMY_IDS as readonly string[]).includes(v);

/** Anatomia de peça gravada no look; ausente ou desconhecida cai na Peça ampliada (as linhas padrão do card). */
export function pieceAnatomyOf(s?: Pick<SchemeView, "background"> | null): PieceAnatomyId {
  const pieces = s?.background?.pieces;
  const anatomy = pieces && typeof pieces === "object" ? (pieces as { anatomy?: unknown }).anatomy : undefined;
  return isPieceAnatomy(anatomy) ? anatomy : DEFAULT_PIECE_ANATOMY;
}

/**
 * Anatomia de peça que o card realmente mostra: Custo por uso usa dado pessoal (usos de cada peça) e, como na anatomia do
 * card (effectiveAnatomy), só aparece para quem é dono do look; para os demais cai na Peça ampliada.
 */
export function effectivePieceAnatomy(s?: Pick<SchemeView, "background" | "viewer"> | null): PieceAnatomyId {
  const a = pieceAnatomyOf(s);
  return a === "CUSTO_POR_USO" && !s?.viewer?.canEdit ? DEFAULT_PIECE_ANATOMY : a;
}

/** Custo por uso de uma peça: preço ÷ usos, contando ao menos 1 uso (peça nunca usada custa o preço inteiro). */
export const costPerUse = (price?: number | null, wears?: number | null): number | null => (price == null ? null : price / Math.max(1, wears ?? 0));
