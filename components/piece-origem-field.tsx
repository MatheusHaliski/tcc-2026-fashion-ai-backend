"use client";
import { ReferenceSelectField, type ReferenceFieldProps } from "@/components/reference-select-field";

/** Origem da peça (tabela origem): o valor é o UUID da opção, nunca o nome. */
export function PieceOrigemField(props: ReferenceFieldProps) {
  return <ReferenceSelectField {...props} id="origemId" path="/api/origens" messages="pieceReferences.origem" stateAttr="origem" />;
}
