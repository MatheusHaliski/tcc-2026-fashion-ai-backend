import type { PieceView } from "@/lib/api/types";

type Translate = (key: string, vars?: Record<string, unknown>) => string;
export type PieceFlag = "favorite" | "disponivel" | "forSale" | "forDonation";

/** Retorno de cada marcação do menu da peça (antes só o item do menu mudava, sem aviso). */
export function flagMessage(field: PieceFlag, piece: PieceView, t: Translate): string {
  const on = !!piece[field];
  return t(`pieceDetail.flag.${field}.${on ? "on" : "off"}`, { name: piece.name });
}
