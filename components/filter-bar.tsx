"use client";
import { useId, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Sheet, UiIcon, cn } from "@/components/ui";

/**
 * Barra de filtros única do app (Closet, Busca, Explorador, loja do quarto): busca + botão "Filtros (n)" que abre um
 * painel (de baixo no celular, lateral no desktop), atalhos em chips roláveis e os filtros ativos como chips
 * removíveis. Os filtros valem na hora; o botão do painel mostra quantos resultados sobram.
 */
export interface FilterOption { value: string; label: string; swatch?: string }
export interface FilterDef { key: string; label: string; options: FilterOption[]; /** vários valores ao mesmo tempo (valor = lista separada por vírgula) */ multi?: boolean }
export interface SortDef { value: string; options: FilterOption[]; onChange: (v: string) => void }

export function FilterBar({ search, onSearch, searchLabel, filters, values, onChange, sort, quick, resultCount, extra }: {
  search?: string; onSearch?: (v: string) => void; searchLabel?: string;
  filters: FilterDef[]; values: Record<string, string>; onChange: (key: string, value: string) => void;
  sort?: SortDef;
  /** atalhos sempre visíveis (ex.: estado da peça), um único valor por vez */
  quick?: FilterDef;
  resultCount?: number;
  extra?: ReactNode;
}) {
  const { t, fmtNumber } = useI18n();
  const [open, setOpen] = useState(false);
  const sortId = useId();
  const split = (v?: string) => (v ? v.split(",").filter(Boolean) : []);
  const active = filters.flatMap((f) => split(values[f.key]).map((v) => ({ f, v, opt: f.options.find((o) => o.value === v) })));
  const toggleMulti = (f: FilterDef, v: string) => { const cur = split(values[f.key]); onChange(f.key, (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(",")); };
  const removeOne = (f: FilterDef, v: string) => f.multi ? onChange(f.key, split(values[f.key]).filter((x) => x !== v).join(",")) : onChange(f.key, "");
  const clearAll = () => filters.forEach((f) => values[f.key] && onChange(f.key, ""));
  return (
    <div className="filter-bar-wrap">
      <div className="filter-bar">
        {onSearch && (
          <div className="filter-search">
            <UiIcon name="search" size={18} className="filter-search-icon" />
            <input type="search" className="input" value={search ?? ""} onChange={(e) => onSearch(e.target.value)} placeholder={(searchLabel ?? t("common.search")) + "…"} aria-label={searchLabel ?? t("common.search")} />
          </div>
        )}
        {filters.length > 0 && (
          <button type="button" className={cn("btn", active.length > 0 && "btn-primary")} aria-haspopup="dialog" onClick={() => setOpen(true)}>
            <UiIcon name="filter" size={18} />{t("filters.button")}{active.length > 0 && <span className="filter-count tabular">{active.length}</span>}
          </button>
        )}
        {sort && (
          <div className="filter-sort">
            <label htmlFor={sortId} className="sr-only">{t("filters.sortBy")}</label>
            <select id={sortId} className="input" value={sort.value} onChange={(e) => sort.onChange(e.target.value)}>
              {sort.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
        {extra}
      </div>
      {quick && (
        <div className="chip-scroll" role="group" aria-label={quick.label}>
          {quick.options.map((o) => <button key={o.value} type="button" className="chip" aria-pressed={(values[quick.key] ?? "") === o.value} onClick={() => onChange(quick.key, o.value)}>{o.label}</button>)}
        </div>
      )}
      {(active.length > 0 || resultCount !== undefined) && (
        <div className="filter-active" aria-live="polite">
          {resultCount !== undefined && <span className="type-body-sm text-muted tabular">{t("filters.results", { count: resultCount })}</span>}
          {active.map(({ f, v, opt }) => (
            <button key={`${f.key}:${v}`} type="button" className="chip chip-removable" onClick={() => removeOne(f, v)} aria-label={t("filters.remove", { name: `${f.label}: ${opt?.label ?? v}` })}>
              {opt?.swatch && <span className="piece-swatch" style={{ background: opt.swatch }} aria-hidden />}{opt?.label ?? v}<UiIcon name="close" size={14} />
            </button>
          ))}
          {active.length > 1 && <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>{t("filters.clear")}</button>}
        </div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={t("filters.title")}
        footer={<><Button onClick={clearAll} disabled={active.length === 0}>{t("filters.clear")}</Button><Button variant="primary" onClick={() => setOpen(false)}>{resultCount !== undefined ? t("filters.show", { count: resultCount, n: fmtNumber(resultCount) }) : t("filters.done")}</Button></>}>
        {filters.map((f) => (
          <fieldset key={f.key} className="filter-group">
            <legend className="label">{f.label}</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="chip" aria-pressed={!values[f.key]} onClick={() => onChange(f.key, "")}>{t("common.all")}</button>
              {f.options.map((o) => (
                <button key={o.value} type="button" className="chip" aria-pressed={f.multi ? split(values[f.key]).includes(o.value) : values[f.key] === o.value}
                  onClick={() => f.multi ? toggleMulti(f, o.value) : onChange(f.key, values[f.key] === o.value ? "" : o.value)}>
                  {o.swatch && <span className="piece-swatch" style={{ background: o.swatch }} aria-hidden />}{o.label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </Sheet>
    </div>
  );
}
