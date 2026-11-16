"use client";
import { ReferenceSelectField, type ReferenceFieldProps } from "@/components/reference-select-field";

/** Tipo de lavagem (tabela TipoLavagem): o valor é o UUID da opção, gravado como FK na peça. */
export function TipoLavagemField(props: ReferenceFieldProps) {
  return <ReferenceSelectField {...props} id="tipoLavagemId" path="/api/tipos-lavagem" messages="pieceReferences.tipoLavagem" stateAttr="washing" />;
}
