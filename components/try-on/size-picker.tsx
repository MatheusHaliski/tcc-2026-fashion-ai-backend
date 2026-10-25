"use client";

import { Chip, cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import type { FitVerdict, SizeFit, SizeGrid, SizeOption } from "@/lib/tryon/sizes";
import { FitFeedback } from "./fit-feedback";

export interface SizePickerProps {
  grid: SizeGrid;
  options: SizeOption[];
  /** tamanho escolhido; sem escolha, o do avatar */
  chosen: string | null;
  /** tamanho do corpo do avatar (marcado com •); null sem corpo conhecido */
  natural: string | null;
  fit?: SizeFit | null;
  /** retorno por região (provador): substitui a linha simples de `fit` */
  feedback?: FitVerdict | null;
  /** a pessoa informou altura, peso ou medidas em Meu Avatar */
  personalized?: boolean;
  label: string;
  onPick: (size: string) => void;
}

/**
 * Tamanhos em um toque (sem formulário): PP…XG, 34…50 ou a numeração do calçado. O tamanho do corpo do avatar leva um
 * ponto e o nome acessível "tamanho do seu avatar"; a linha de estado diz como a peça fica no corpo (no corpo, justa,
 * folgada…). É um radiogroup: cada chip é um radio com aria-checked.
 */
export function SizePicker({ grid, options, chosen, natural, fit, feedback, personalized = true, label, onPick }: SizePickerProps) {
  const { t } = useI18n();
  const current = chosen ?? natural;
  return (
    <span className="size-picker">
      <span className="size-picker-chips" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const mine = option.label === natural;
          const name = [option.label, option.intl && option.intl !== option.label ? `(${option.intl})` : null, mine ? t("size.do_avatar") : null].filter(Boolean).join(" ");
          return (
            <Chip key={option.label} role="radio" aria-checked={current === option.label} active={current === option.label}
              className={cn("size-chip", mine && "is-mine")} title={name} onClick={() => onPick(option.label)}>
              <span aria-hidden>{option.label}</span><span className="sr-only">{name}</span>
            </Chip>
          );
        })}
      </span>
      {feedback && <FitFeedback grid={grid} feedback={feedback} natural={natural} personalized={personalized} />}
      {!feedback && fit && natural && (
        <span className={cn("size-fit", `is-${fit}`)} role="status" aria-live="polite">
          {t(`size.fit.${grid === "shoes" ? "pe" : "corpo"}.${fit}`, { natural })}
        </span>
      )}
    </span>
  );
}
