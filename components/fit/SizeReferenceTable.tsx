"use client";
import { cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { referenceRows, type BodyMeasures, type SizeGrid } from "@/lib/tryon/sizes";

const COLUMNS: Record<SizeGrid, (keyof BodyMeasures)[]> = { letter: ["chest", "waist", "hip"], numeric: ["waist", "hip"], shoes: ["foot"] };

/** Grade de referência do sistema (somente leitura): o que cada tamanho veste, em cm, para o corpo do sexo indicado. */
export function SizeReferenceTable({ grid, sex, highlight }: { grid: SizeGrid; sex: "FEMININO" | "MASCULINO"; highlight?: string | null }) {
  const { t } = useI18n();
  const rows = referenceRows(grid, sex), columns = COLUMNS[grid];
  return <details>
    <summary className="type-body cursor-pointer">{t("size.tabela")}</summary>
    <div className="overflow-x-auto mt-2">
      <table className="w-full type-body-sm tabular">
        <caption className="type-caption text-muted text-left">{t("size.tabela_de", { sexo: t(sex === "FEMININO" ? "common.feminino" : "common.masculino") })}</caption>
        <thead><tr><th scope="col" className="text-left">{t("size.col.size")}</th>{columns.map((c) => <th key={c} scope="col" className="text-left">{t(`size.col.${c}`)}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.label} className={cn(row.label === highlight && "font-semibold")}>
          <th scope="row" className="text-left">{row.label}{row.intl && row.intl !== row.label ? ` (${row.intl})` : ""}</th>
          {columns.map((c) => <td key={c}>{row.values[c] ?? "—"}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </details>;
}
