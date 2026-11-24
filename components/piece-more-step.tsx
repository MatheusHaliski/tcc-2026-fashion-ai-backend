"use client";
import type { ReactNode } from "react";
import { MORE_STEP_MESSAGE_FIELDS, PieceAdditionalFields, PieceMoreDetails, type PieceFormValue } from "@/components/piece-form";
import { BrandHintNote, type PhotoPick } from "@/components/multi-piece-review";
import { Card } from "@/components/ui";
import { liveFieldErrors } from "@/lib/pieces/step-guard";

/**
 * Etapa "2 · Mais detalhes" do criador de peça: material, tamanho, marca, preço, referências (conservação, lavagem,
 * coleção, intensidade térmica, origem, corte), ocasião e estilo, seguidos de selos, visibilidade e venda. Tudo
 * aberto, sem seção recolhida.
 */
export function PieceMoreStep({ value, onChange, onDetails, fieldErrors, hint, problem, nav, autoSex }: {
  value: PieceFormValue;
  /** edição de um campo (limpa o aviso da etapa e os erros já resolvidos) */ onChange: (v: PieceFormValue) => void;
  /** selos, visibilidade e venda */ onDetails: (v: PieceFormValue) => void;
  fieldErrors: Record<string, string>;
  /** marca lida com incerteza na foto ("Usar {marca}"), só enquanto o campo Marca está vazio */ hint?: PhotoPick["hint"] | null;
  problem: string | null; nav: ReactNode;
  /** Tipo Look automático do perfil: esconde o campo no criador */ autoSex?: string | null;
}) {
  const useBrand = (brandName: string) => onChange({ ...value, brandName, brandId: null, brandLogoUrl: null, brandLogoWideUrl: null,
    brandDomain: null, brandEdgePx: null, brandSource: null, brandRef: null });
  return <Card>
    <div id="piece-form-fields" className="grid gap-x-4 sm:grid-cols-2">
      <PieceAdditionalFields value={value} onChange={onChange} fieldErrors={liveFieldErrors(fieldErrors, value)} autoSex={autoSex}
        afterBrand={hint && !value.brandName ? <BrandHintNote hint={hint} disabled={false} onUse={useBrand} /> : null} />
    </div>
    <PieceMoreDetails value={value} onChange={onDetails} error={null} />
    {Object.entries(fieldErrors).filter(([k]) => MORE_STEP_MESSAGE_FIELDS.includes(k)).map(([k, m]) => <p key={k} role="alert" className="error-text">{m}</p>)}
    {problem && <p role="alert" className="error-text mt-3" data-step-problem>{problem}</p>}
    {nav}
  </Card>;
}
