"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { storeApi } from "@/lib/store/api";
import { variantLabel, type StoreVariant, type VariantForm } from "@/lib/store/types";
import { Button, Chip, Dialog, Field, Input, Select, Skeleton, useToast } from "@/components/ui";

/** RF-PESQ-01 — escolha explícita de cor e tamanho no resgate; esgotado e "sem informação" são estados distintos. */
export function VariantPicker({ listingId, value, onChange }: { listingId: string; value: string | null; onChange: (variant: StoreVariant | null, required: boolean) => void }) {
  const { t } = useI18n();
  const checkout = useApi((signal) => storeApi.checkout(listingId, signal), [listingId]);
  if (checkout.loading || !checkout.data) return <Skeleton className="h-16" />;
  if (checkout.error) return <p role="alert">{checkout.error.message}</p>;
  if (checkout.data.variantInfo === "MISSING") return <p className="type-body-sm text-muted" role="note">{t("physicalStore.variant.missing")}</p>;
  return <fieldset className="grid gap-2">
    <legend className="type-h3">{t("physicalStore.variant.title")}</legend>
    <p className="type-body-sm text-muted">{t("physicalStore.variant.choose")}</p>
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("physicalStore.variant.title")}>
      {checkout.data.variants.map((variant) => {
        const soldOut = variant.availability !== "AVAILABLE";
        return <Chip key={variant.id} role="radio" aria-checked={value === variant.id} active={value === variant.id} blocked={soldOut} disabled={soldOut}
          title={soldOut ? t("physicalStore.variant.soldOut") : t("physicalStore.variant.available")}
          onClick={() => !soldOut && onChange(variant, true)}>
          {variantLabel(variant, t("physicalStore.variant.noColor"))}{soldOut && <span className="ml-1 type-caption">· {t("physicalStore.variant.soldOut")}</span>}
        </Chip>;
      })}
    </div>
    {!value && <p className="type-caption text-muted" role="status">{t("physicalStore.variant.required")}</p>}
  </fieldset>;
}

const EMPTY: VariantForm = { catalogVariantId: null, sku: "", colorName: "", sizeLabel: "", stockQuantity: 0, active: true };

/** Cadastro de variantes pelo emissor da oferta: cor × tamanho com estoque próprio, vinculada ou não ao catálogo. */
export function SellerVariantManager({ listingId, name, catalogVariants, open, onClose }: {
  listingId: string; name: string; catalogVariants: { id: string; colorName?: string | null; color?: string | null; sku?: string | null }[]; open: boolean; onClose: () => void;
}) {
  const { t, fmtNumber } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState<VariantForm>(EMPTY);
  const [editing, setEditing] = useState<StoreVariant | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = useApi((signal) => storeApi.variants(listingId, signal), [listingId], { enabled: open });
  const set = (patch: Partial<VariantForm>) => setForm((current) => ({ ...current, ...patch }));
  function beginEdit(variant: StoreVariant) {
    setEditing(variant);
    setForm({ catalogVariantId: variant.catalogVariantId, sku: variant.sku ?? "", colorName: variant.colorName ?? "", sizeLabel: variant.sizeLabel, stockQuantity: variant.stock ?? 0, active: variant.active ?? true, expectedVersion: variant.version });
  }
  async function save() {
    if (busy || !form.sizeLabel.trim()) return;
    setBusy(true);
    try {
      if (editing) await storeApi.updateVariant(listingId, editing.id, form); else await storeApi.createVariant(listingId, form);
      toast.success(t("common.saved")); setEditing(null); setForm(EMPTY); rows.reload();
    } catch (error) { toast.fromError(error); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onClose={() => !busy && onClose()} title={t("physicalStore.variant.manageTitle", { name })} size="lg">
    <p className="type-body-sm text-muted">{t("physicalStore.variant.manageHint")}</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <Field label={t("physicalStore.variant.catalogVariant")}>
        <Select value={form.catalogVariantId ?? ""} onChange={(event) => set({ catalogVariantId: event.target.value || null })}>
          <option value="">{t("physicalStore.variant.none")}</option>
          {catalogVariants.map((variant) => <option key={variant.id} value={variant.id}>{variant.colorName ?? variant.color ?? variant.id}{variant.sku ? ` · ${variant.sku}` : ""}</option>)}
        </Select>
      </Field>
      <Field label={t("physicalStore.variant.color")}><Input maxLength={120} value={form.colorName} onChange={(event) => set({ colorName: event.target.value })} /></Field>
      <Field label={t("physicalStore.variant.size")} required><Input maxLength={40} required value={form.sizeLabel} onChange={(event) => set({ sizeLabel: event.target.value })} /></Field>
      <Field label={t("physicalStore.variant.sku")}><Input maxLength={80} value={form.sku} onChange={(event) => set({ sku: event.target.value })} /></Field>
      <Field label={t("physicalStore.variant.stock")}><Input type="number" min={0} max={1000000} value={String(form.stockQuantity)} onChange={(event) => set({ stockQuantity: Number(event.target.value) })} /></Field>
    </div>
    <div className="mt-3 flex gap-2">
      <Button variant="primary" loading={busy} disabled={!form.sizeLabel.trim()} onClick={save}>{editing ? t("common.save") : t("physicalStore.variant.add")}</Button>
      {editing && <Button disabled={busy} onClick={() => { setEditing(null); setForm(EMPTY); }}>{t("common.cancel")}</Button>}
    </div>
    <ul className="mt-4 grid gap-2">
      {rows.loading && !rows.data ? <Skeleton className="h-12" /> : (rows.data ?? []).length === 0 ? <li className="type-body-sm text-muted">{t("physicalStore.variant.empty")}</li>
        : rows.data!.map((variant) => <li key={variant.id} className="list-row flex flex-wrap items-center justify-between gap-2">
          <span>{variantLabel(variant, t("physicalStore.variant.noColor"))} · {t("physicalStore.variant.stock")}: {fmtNumber(variant.stock ?? 0)}{(variant.reserved ?? 0) > 0 ? ` · ${t("physicalStore.variant.reserved", { count: variant.reserved })}` : ""}{variant.active === false ? ` · ${t("physicalStore.variant.inactive")}` : ""}</span>
          <Button size="sm" onClick={() => beginEdit(variant)}>{t("common.edit")}</Button>
        </li>)}
    </ul>
  </Dialog>;
}
