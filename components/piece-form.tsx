"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { ApiError } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { CATEGORY_LABEL, label, useTaxonomy } from "@/lib/api/taxonomy";
import { Button, Chip, Field, Input, Select, Textarea } from "@/components/ui";

export interface PieceFormValue {
  draftId?: string | null; useDefaultImage: boolean; name: string; category: string; subcategory: string; sex: string; brandId?: string | null; brandName: string;
  color: string; material: string; size: string; market?: string; occasion: string[]; style: string[]; seals: string[]; price: string; visibility: string;
  tags: string; notes: string; condition: string; purchaseDate: string; purchaseLocation: string; sku: string; careInstructions: string; forSale: boolean;
}
export const EMPTY_PIECE: PieceFormValue = { draftId: null, useDefaultImage: false, name: "", category: "", subcategory: "", sex: "UNISSEX", brandName: "", color: "", material: "", size: "m", occasion: [], style: [], seals: [], price: "", visibility: "PRIVATE", tags: "", notes: "", condition: "", purchaseDate: "", purchaseLocation: "", sku: "", careInstructions: "", forSale: false };

export function toPayload(v: PieceFormValue) {
  return { ...v, price: v.price === "" ? null : Number(v.price), tags: v.tags.split(",").map((s) => s.trim()).filter(Boolean), brandId: v.brandId || null, purchaseDate: v.purchaseDate || null, condition: v.condition || null, market: v.market || null };
}

/** Formulário da peça (RF4/RF7) dirigido pela taxonomia oficial; até 2 ocasiões e 2 estilos; cor sempre com nome (acessível). */
export function PieceForm({ value, onChange, onSubmit, busy, error, submitLabel, prefilledNote }: {
  value: PieceFormValue; onChange: (v: PieceFormValue) => void; onSubmit: () => void; busy?: boolean; error?: ApiError | null; submitLabel: string; prefilledNote?: string;
}) {
  const { t } = useI18n(); const tax = useTaxonomy(); const err = error?.fields ?? {};
  const [brandQuery, setBrandQuery] = useState(value.brandName);
  useEffect(() => setBrandQuery(value.brandName), [value.brandName]);
  const set = <K extends keyof PieceFormValue>(k: K, v: PieceFormValue[K]) => onChange({ ...value, [k]: v });
  const toggleIn = (k: "occasion" | "style" | "seals", v: string, max: number) => {
    const cur = value[k]; if (cur.includes(v)) set(k, cur.filter((x) => x !== v)); else if (cur.length < max) set(k, [...cur, v]);
  };
  const occasions = value.category ? tax?.allowedOccasionsByCategory?.[value.category] ?? tax?.occasions ?? [] : tax?.occasions ?? [];
  const brands = (tax?.brands ?? []).filter((b) => b.name.toLowerCase().includes(brandQuery.toLowerCase())).slice(0, 6);
  function submit(e: FormEvent) { e.preventDefault(); onSubmit(); }
  return (
    <form onSubmit={submit} noValidate className="grid gap-x-4 sm:grid-cols-2">
      {prefilledNote && <p className="sm:col-span-2 mb-3 rounded-md bg-thread-soft p-3 type-body-sm">{prefilledNote}</p>}
      <Field label="Nome" id="name" required error={err.name} className="sm:col-span-2"><Input id="name" value={value.name} onChange={(e) => set("name", e.target.value)} required maxLength={80} /></Field>
      <Field label={t("common.category")} id="category" required error={err.category}>
        <Select id="category" value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value, subcategory: "", occasion: [] })}><option value="">—</option>{Object.keys(tax?.subcategories ?? {}).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>)}</Select>
      </Field>
      <Field label={t("common.subcategory")} id="subcategory" required error={err.subcategory}>
        <Select id="subcategory" value={value.subcategory} onChange={(e) => set("subcategory", e.target.value)} disabled={!value.category}><option value="">—</option>{(tax?.subcategories?.[value.category] ?? []).map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
      </Field>
      <Field label={t("common.color")} id="color" required error={err.color} hint={value.color ? `${label(value.color)}${tax?.colors?.[value.color] ? ` (${tax.colors[value.color]})` : ""}` : undefined}>
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-6 w-6 shrink-0 rounded-full border border-line-soft" style={{ background: tax?.colors?.[value.color] ?? "transparent" }} />
          <Select id="color" value={value.color} onChange={(e) => set("color", e.target.value)}><option value="">—</option>{Object.entries(tax?.colors ?? {}).map(([k]) => <option key={k} value={k}>{label(k)}</option>)}</Select>
        </div>
      </Field>
      <Field label={t("common.material")} id="material" required error={err.material}><Select id="material" value={value.material} onChange={(e) => set("material", e.target.value)}><option value="">—</option>{(tax?.materials ?? []).map((m) => <option key={m} value={m}>{label(m.toLowerCase())}</option>)}</Select></Field>
      <Field label="Sexo" id="sex" required error={err.sex}><Select id="sex" value={value.sex} onChange={(e) => set("sex", e.target.value)}>{(tax?.sexes ?? ["MASCULINO", "FEMININO", "UNISSEX"]).map((s) => <option key={s} value={s}>{label(s.toLowerCase())}</option>)}</Select></Field>
      <Field label={t("common.size")} id="size" required error={err.size}><Select id="size" value={value.size} onChange={(e) => set("size", e.target.value)}>{(tax?.sizes ?? ["m"]).map((s) => <option key={s} value={s}>{s.toUpperCase().replace("BR_", "BR ")}</option>)}</Select></Field>
      <Field label={t("common.brand")} id="brand" error={err.brandName} hint={value.brandId ? "Marca do catálogo" : "Digite para buscar no catálogo ou informe livremente"}>
        <Input id="brand" value={brandQuery} onChange={(e) => { setBrandQuery(e.target.value); onChange({ ...value, brandName: e.target.value, brandId: null }); }} list="brand-options" />
        <datalist id="brand-options">{brands.map((b) => <option key={b.id} value={b.name} />)}</datalist>
        {brands.length > 0 && brandQuery && !value.brandId && <div className="mt-1 flex flex-wrap gap-1">{brands.map((b) => <Chip key={b.id} onClick={() => { onChange({ ...value, brandName: b.name, brandId: b.id }); setBrandQuery(b.name); }}>{b.name}</Chip>)}</div>}
      </Field>
      <Field label={`${t("common.price")} (USD)`} id="price" required error={err.price}><Input id="price" type="number" step="0.01" min="0" inputMode="decimal" value={value.price} onChange={(e) => set("price", e.target.value)} /></Field>
      <Field label={`${t("common.occasion")} (até 2)`} error={err.occasion} className="sm:col-span-2"><div className="flex flex-wrap gap-1.5">{occasions.map((o) => <Chip key={o} active={value.occasion.includes(o)} onClick={() => toggleIn("occasion", o, 2)}>{label(o)}</Chip>)}</div></Field>
      <Field label={`${t("common.style")} (até 2)`} error={err.style} className="sm:col-span-2"><div className="flex flex-wrap gap-1.5">{(tax?.styles ?? []).map((s) => <Chip key={s} active={value.style.includes(s)} onClick={() => toggleIn("style", s, 2)}>{label(s)}</Chip>)}</div></Field>
      <Field label="Selos da peça" error={err.seals} className="sm:col-span-2"><div className="flex flex-wrap gap-1.5">{(tax?.pieceSeals ?? []).map((s) => <Chip key={s} active={value.seals.includes(s)} onClick={() => toggleIn("seals", s, 3)}>{label(s)}</Chip>)}</div></Field>
      <Field label={t("common.visibility")} id="visibility" error={err.visibility}><Select id="visibility" value={value.visibility} onChange={(e) => set("visibility", e.target.value)}><option value="PRIVATE">{t("common.private")}</option><option value="FOLLOWERS">{t("common.followers")}</option><option value="PUBLIC">{t("common.public")}</option></Select></Field>
      <Field label="Condição" id="condition" error={err.condition}><Select id="condition" value={value.condition} onChange={(e) => set("condition", e.target.value)}><option value="">—</option><option value="NEW">Nova</option><option value="LIKE_NEW">Como nova</option><option value="GOOD">Boa</option><option value="WORN">Usada</option></Select></Field>
      <Field label="Data de compra" id="purchaseDate"><Input id="purchaseDate" type="date" value={value.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} /></Field>
      <Field label="Local de compra" id="purchaseLocation"><Input id="purchaseLocation" value={value.purchaseLocation} onChange={(e) => set("purchaseLocation", e.target.value)} /></Field>
      <Field label="Tags (vírgula)" id="tags" className="sm:col-span-2"><Input id="tags" value={value.tags} onChange={(e) => set("tags", e.target.value)} placeholder="verão, viagem" /></Field>
      <Field label="Notas" id="notes" className="sm:col-span-2"><Textarea id="notes" value={value.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} /></Field>
      <label className="sm:col-span-2 mb-3 flex items-center gap-2 type-body"><input type="checkbox" checked={value.forSale} onChange={(e) => set("forSale", e.target.checked)} /> {t("common.forSale")}</label>
      {error && Object.keys(err).length === 0 && <p role="alert" className="error-text sm:col-span-2">{error.message}</p>}
      <div className="sm:col-span-2 flex justify-end gap-2"><Button type="submit" variant="primary" size="lg" loading={busy}>{submitLabel}</Button></div>
    </form>
  );
}
