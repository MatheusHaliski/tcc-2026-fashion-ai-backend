"use client";
import { ReferenceSelectField, type ReferenceFieldProps } from "@/components/reference-select-field";

/**
 * Nível térmico do look (tabela niveis_termicos: Leve, Moderado, Intenso). O valor é o UUID da opção, gravado como FK
 * em schemes. "Não informado" (valor vazio) é a ausência de escolha, nunca um nível; carregando e erro com "Tentar de
 * novo" ficam no ReferenceSelectField e não se confundem com uma opção.
 */
export function LookNivelTermicoField(props: ReferenceFieldProps) {
  return <ReferenceSelectField {...props} id="nivelTermicoId" path="/api/opcoes/niveis-termicos"
    messages="lookReferences.nivelTermico" stateAttr="nivel-termico" />;
}
