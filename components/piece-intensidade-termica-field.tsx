"use client";
import { ReferenceSelectField, type ReferenceFieldProps } from "@/components/reference-select-field";

/** Intensidade térmica (tabela intensidade_termica): o valor é o UUID da opção, gravado como FK na peça ou no look. */
export function PieceIntensidadeTermicaField(props: ReferenceFieldProps) {
  return <ReferenceSelectField {...props} id="intensidadeTermicaId" path="/api/intensidades-termicas"
    messages="pieceReferences.intensidade" stateAttr="intensidade" />;
}
