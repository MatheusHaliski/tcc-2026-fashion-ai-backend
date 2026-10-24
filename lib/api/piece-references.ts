import type { PieceView } from "./types";

type PieceReferences = Pick<PieceView, "condition" | "estadoConservacao" | "tipoLavagem" | "careInstructions">;
type Translate = (key: string) => string;
const LEGACY_CONDITION_KEYS: Record<string, string> = {
  NEW: "pieceReferences.condition.new",
  GOOD: "pieceReferences.condition.good",
  WORN: "pieceReferences.condition.worn",
  DAMAGED: "pieceReferences.condition.damaged",
};

/** Catalog names take precedence; legacy fields remain readable without inventing a reference. */
export function conservationLabel(piece: PieceReferences, t: Translate): string | null {
  const name = piece.estadoConservacao?.nome?.trim();
  if (name) return name;
  const condition = piece.condition?.trim();
  if (!condition) return null;
  const key = LEGACY_CONDITION_KEYS[condition.toUpperCase()];
  return key ? t(key) : condition;
}

/** Keep free-form care text when it adds information to the washing catalog entry. */
export function washingDetails(piece: PieceReferences): { washing: string | null; additionalCare: string | null } {
  const name = piece.tipoLavagem?.nome?.trim() || null;
  const care = piece.careInstructions?.trim() || null;
  return { washing: name || care, additionalCare: name && care && name !== care ? care : null };
}
