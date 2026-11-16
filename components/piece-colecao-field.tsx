"use client";
import { ReferenceSelectField, type ReferenceFieldProps } from "@/components/reference-select-field";

/** Coleção (tabela colecao): o valor é o UUID da opção, gravado como FK na peça ou no look. */
export function PieceColecaoField(props: ReferenceFieldProps) {
  return <ReferenceSelectField {...props} id="colecaoId" path="/api/colecoes" messages="pieceReferences.colecao" stateAttr="colecao" />;
}
