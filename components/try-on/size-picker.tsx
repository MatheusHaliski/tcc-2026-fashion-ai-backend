"use client";

import { useState } from "react";
import { Chip, cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { digitalPassportApi, type SizeRow } from "@/lib/passport/digital";
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
  /** produto de loja: consulta disponibilidade, medidas cadastradas e representação 3D por tamanho */
  productId?: string | null;
  label: string;
  onPick: (size: string) => void;
}

/** Medidas cadastradas de um tamanho, com unidade, protocolo e origem (oficial × outro método). */
function Measurements({ row }: { row: SizeRow }) {
  const { t } = useI18n();
  if (row.measurements.length === 0) return null;
  return <ul className="size-measurements type-caption text-muted">{row.measurements.map((m, index) => <li key={index}>{m.region} {m.min ?? "—"}–{m.max ?? "—"} {m.unit} · {m.protocol} · {t(`sheet.measurementProvenance.${m.provenance}`)}{m.sourceName ? ` (${m.sourceName})` : ""}</li>)}</ul>;
}

/**
 * Tamanhos em um toque (sem formulário): PP…XG, 34…50 ou a numeração do calçado. O tamanho do corpo do avatar leva um
 * ponto e o nome acessível "tamanho do seu avatar"; a linha de estado diz como a peça fica no corpo. Com produto de
 * loja, tamanhos indisponíveis não podem ser escolhidos, e a representação 3D é dita como aproximação visual.
 */
export function SizePicker({ grid, options, chosen, natural, fit, feedback, personalized = true, productId, label, onPick }: SizePickerProps) {
  const { t } = useI18n();
  const [details, setDetails] = useState(false);
  const info = useApi((signal) => digitalPassportApi.productSizes(productId!, signal), [productId], { enabled: !!productId });
  const rows = new Map((info.data?.sizes ?? []).map((row) => [row.label, row]));
  const current = chosen ?? natural;
  const currentRow = current ? rows.get(current) : undefined;
  const has3d = info.data ? info.data.representation3d.kind !== "NONE" : null;
  return (
    <span className="size-picker">
      <span className="size-picker-chips" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const mine = option.label === natural;
          const row = rows.get(option.label);
          const unavailable = row?.availability === "UNAVAILABLE";
          const name = [option.label, option.intl && option.intl !== option.label ? `(${option.intl})` : null, mine ? t("size.do_avatar") : null, unavailable ? t("size.indisponivel") : null].filter(Boolean).join(" ");
          return (
            <Chip key={option.label} role="radio" aria-checked={current === option.label} active={current === option.label} blocked={unavailable} disabled={unavailable}
              className={cn("size-chip", mine && "is-mine")} title={name} onClick={() => !unavailable && onPick(option.label)}>
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
      {info.data && <span className="size-representation type-caption text-muted" role="note">
        {has3d ? (currentRow && currentRow.representation === "NONE" ? t("size.sem_3d_para_tamanho", { size: current ?? "" }) : t("size.aproximacao_visual", { size: current ?? "" })) : t("size.sem_representacao_3d")}
        {" · "}{t("size.nao_altera_avatar")}
        {info.data.measurementsKnown && <button type="button" className="underline" onClick={() => setDetails((value) => !value)}>{t(details ? "size.ocultar_medidas" : "size.ver_medidas")}</button>}
      </span>}
      {details && currentRow && <Measurements row={currentRow} />}
    </span>
  );
}
