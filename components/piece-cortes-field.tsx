"use client";
import { ReferenceSelectField, type ReferenceFieldProps } from "@/components/reference-select-field";

/** Corte da peça (tabela cortes): o valor é o UUID da opção, nunca o nome. */
export function PieceCorteField(props: ReferenceFieldProps) {
  return <ReferenceSelectField {...props} id="corteId" path="/api/cortes" messages="pieceReferences.corte" stateAttr="corte" />;
}
