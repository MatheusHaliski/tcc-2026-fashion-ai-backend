"use client";
import { ReferenceSelectField, type ReferenceFieldProps } from "@/components/reference-select-field";

/** Values are database UUIDs, never labels or the default legacy GOOD enum. */
export function PieceConservationField(props: ReferenceFieldProps) {
  return <ReferenceSelectField {...props} id="estadoConservacaoId" path="/api/opcoes/estados-conservacao"
    messages="pieceReferences.condition" stateAttr="conservation" />;
}
