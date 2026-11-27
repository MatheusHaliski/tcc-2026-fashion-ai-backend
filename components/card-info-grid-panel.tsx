"use client";
/**
 * Background Studio › grade de informações do card do feed: quais células aparecem (o padrão é o mínimo), em quantas
 * colunas, com que estilo de célula, com ou sem rótulo, alinhamento e densidade. Vale para o card de peça e o de look;
 * a escolha é gravada na arte do card (background.infoGrid) e a prévia ao lado muda na hora.
 */
import { Chip } from "@/components/ui";
import { OptionStrip } from "@/components/option-strip";
import { useI18n } from "@/lib/i18n/i18n";
import {
  INFO_CELLS, INFO_COLUMNS, INFO_FIELD_LABEL, INFO_FIELDS, infoGridView, toggleInfoField, type InfoGridConfig, type InfoGridKind,
} from "@/lib/cards/info-grid";

export function CardInfoGridPanel({ kind, value, onChange }: {
  kind: InfoGridKind; value: InfoGridConfig | null | undefined; onChange: (next: InfoGridConfig | null) => void;
}) {
  const { t } = useI18n();
  const view = infoGridView(value, kind);
  const set = (patch: InfoGridConfig) => onChange({ ...(value ?? {}), ...patch });
  return (
    <div className="grid gap-3" data-info-grid-panel={kind}>
      <OptionStrip kind="row" title={t("infoGrid.campos")} hint={<p className="type-caption text-muted">{t("infoGrid.campos_dica")}</p>}>
        {INFO_FIELDS[kind].map((f) => (
          <Chip key={f} active={view.fields.includes(f)} onClick={() => set({ fields: toggleInfoField(view, kind, f) })}>{t(INFO_FIELD_LABEL[f])}</Chip>
        ))}
        <Chip active={!value} onClick={() => onChange(null)}>{t("infoGrid.padrao")}</Chip>
      </OptionStrip>
      <OptionStrip kind="row" title={t("infoGrid.colunas")}>
        {INFO_COLUMNS.map((n) => <Chip key={n} active={view.columns === n} onClick={() => set({ columns: n })}>{t("infoGrid.n_colunas", { count: n })}</Chip>)}
      </OptionStrip>
      <OptionStrip kind="row" title={t("infoGrid.celulas")}>
        {INFO_CELLS.map((c) => <Chip key={c} active={view.cells === c} onClick={() => set({ cells: c })}>{t(`infoGrid.celula.${c}`)}</Chip>)}
      </OptionStrip>
      <OptionStrip kind="row" title={t("infoGrid.rotulos")}>
        <Chip active={view.labels} onClick={() => set({ labels: true })}>{t("infoGrid.com_rotulo")}</Chip>
        <Chip active={!view.labels} onClick={() => set({ labels: false })}>{t("infoGrid.so_valor")}</Chip>
      </OptionStrip>
      <OptionStrip kind="row" title={t("infoGrid.alinhamento")}>
        <Chip active={view.align === "start"} onClick={() => set({ align: "start" })}>{t("infoGrid.alinhar.start")}</Chip>
        <Chip active={view.align === "center"} onClick={() => set({ align: "center" })}>{t("infoGrid.alinhar.center")}</Chip>
      </OptionStrip>
      <OptionStrip kind="row" title={t("infoGrid.densidade")}>
        <Chip active={view.density === "normal"} onClick={() => set({ density: "normal" })}>{t("infoGrid.densidade_normal")}</Chip>
        <Chip active={view.density === "compact"} onClick={() => set({ density: "compact" })}>{t("infoGrid.densidade_compacta")}</Chip>
      </OptionStrip>
    </div>
  );
}
