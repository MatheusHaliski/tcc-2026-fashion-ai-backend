"use client";
import { ReferenceSelectField, type ReferenceFieldProps } from "@/components/reference-select-field";

export function CortesField(props: ReferenceFieldProps) {
  return <ReferenceSelectField {...props} id="cortesId" path="/api/cortes" messages="pieceReferences.cortes" stateAttr="cortes" />;
}
