"use client";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { BrandLogo } from "@/components/brand-logo";
import { Input, cn } from "@/components/ui";

/** Marca do catálogo (brands + apelidos). `alias` = o apelido que casou com o texto digitado ("PRL" → Ralph Lauren). */
export interface CatalogBrand { id: string; name: string; slug: string; logoUrl?: string | null; country?: string | null; alias?: string | null; products?: number }

/**
 * RF47 · Autocomplete pesquisável de marca (GET /api/catalog/brands?q=). A entidade Brand é reutilizada: escolher da
 * lista evita marcas duplicadas; texto livre continua permitido (marca ainda desconhecida vira "não encontrada no
 * catálogo", nunca criada em silêncio).
 */
export function BrandAutocomplete({ value, onChange, id, placeholder, autoFocus, maxLength }: {
  value: string; onChange: (name: string, brand: CatalogBrand | null) => void; id?: string; placeholder?: string; autoFocus?: boolean; maxLength?: number;
}) {
  const { t } = useI18n();
  const listId = useId();
  const [options, setOptions] = useState<CatalogBrand[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const seq = useRef(0);
  const picked = useRef<string | null>(null);
  useEffect(() => {
    const term = value.trim();
    if (term.length < 1 || picked.current === term) { setOptions([]); return; }
    const n = ++seq.current;
    const ctl = new AbortController();
    const h = setTimeout(async () => {
      try {
        const r = await api.get<{ brands: CatalogBrand[] }>(`/api/catalog/brands?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        if (n === seq.current) { setOptions(r.brands ?? []); setActive(0); }
      } catch { /* sem sugestões: texto livre segue valendo */ }
    }, 280);
    return () => { clearTimeout(h); ctl.abort(); };
  }, [value]);
  const pick = (b: CatalogBrand) => { picked.current = b.name; onChange(b.name, b); setOptions([]); setOpen(false); };
  return (
    <div className="relative">
      <Input id={id} value={value} autoFocus={autoFocus} maxLength={maxLength} placeholder={placeholder ?? t("catalog.brand_placeholder")} autoComplete="off"
        role="combobox" aria-expanded={open && options.length > 0} aria-controls={listId} aria-autocomplete="list"
        onChange={(e) => { picked.current = null; setOptions([]); setOpen(true); onChange(e.target.value, null); }}
        onFocus={() => options.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open || !options.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          if (e.key === "Enter") { e.preventDefault(); pick(options[active]); }
          if (e.key === "Escape") setOpen(false);
        }} />
      {open && options.length > 0 && (
        <ul id={listId} role="listbox" className="brand-ac-list">
          {options.map((b, i) => (
            <li key={b.id} role="option" aria-selected={i === active} className={cn("brand-ac-item", i === active && "is-active")}
              onMouseDown={(e) => { e.preventDefault(); pick(b); }}>
              <BrandLogo name={b.name} src={b.logoUrl} size={26} shape="square" />
              <span className="min-w-0 flex-1 truncate">{b.name}{b.alias && b.alias.toLowerCase() !== b.name.toLowerCase() && <span className="text-muted"> · {b.alias}</span>}</span>
              {typeof b.products === "number" && b.products > 0 && <span className="type-caption text-muted tabular">{t("catalog.n_produtos", { count: b.products })}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
