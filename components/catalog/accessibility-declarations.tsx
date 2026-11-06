"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { accessibilityApi, type Declaration, type Tri } from "@/lib/catalog/accessibility";
import { Button, Field, Select, Textarea, useToast } from "@/components/ui";
import { AccessibilityFacts } from "./accessibility-facts";

const TRI: Tri[] = ["UNKNOWN", "TRUE", "FALSE"];
const CLOSURES = ["UNKNOWN", "NONE", "ZIPPER", "BUTTONS", "MAGNETIC", "VELCRO", "ELASTIC", "HOOKS"];
const OPENINGS = ["UNKNOWN", "FRONT", "BACK", "SIDE", "SHOULDER", "NONE"];
const CONTACTS = ["UNKNOWN", "SOFT", "NEUTRAL", "TEXTURED"];
const SOURCES: Declaration["declarationSource"][] = ["BRAND_SPEC", "PHYSICAL_SAMPLE", "SUPPLIER_SHEET"];
const EMPTY: Declaration = { declarationSource: "BRAND_SPEC", closureType: "UNKNOWN", openingPosition: "UNKNOWN", magneticClosure: "UNKNOWN", taglessLabel: "UNKNOWN", flatSeams: "UNKNOWN", fabricContact: "UNKNOWN", oneHandDressing: "UNKNOWN", notes: "" };

function Choice({ id, label, value, options, prefix, onChange }: { id: string; label: string; value: string; options: string[]; prefix: string; onChange: (value: string) => void }) {
  const { t } = useI18n();
  return <Field id={id} label={label}><Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{t(`accessibility.${prefix}.${option}`)}</option>)}</Select></Field>;
}

/** Marca declara atributos estruturados e a origem; a revisão editorial é da equipe. Nada é inferido de foto. */
export function AccessibilityDeclarations() {
  const { t } = useI18n(); const toast = useToast();
  const products = useApi((signal) => api.get<{ id: string; productName: string }[]>("/api/physical-store/products?category=CLOTHING", { signal }), []);
  const mine = useApi((signal) => accessibilityApi.mine(signal), []);
  const [productId, setProductId] = useState("");
  const [form, setForm] = useState<Declaration>(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Declaration>) => setForm((current) => ({ ...current, ...patch }));
  async function save() {
    if (busy || !productId) return; setBusy(true);
    try { await accessibilityApi.declare(productId, form); toast.success(t("common.saved")); mine.reload(); }
    catch (error) { toast.fromError(error); } finally { setBusy(false); }
  }
  return <section className="grid gap-3" aria-labelledby="acc-decl-title">
    <h2 id="acc-decl-title" className="type-h2">{t("accessibility.declareTitle")}</h2>
    <p className="type-body-sm text-muted">{t("accessibility.declareHint")}</p>
    <div className="grid gap-2 sm:grid-cols-3">
      <Field id="acc-product" label={t("physicalStore.catalogProduct")}><Select id="acc-product" value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">{t("physicalStore.chooseProduct")}</option>{(products.data ?? []).map((product) => <option key={product.id} value={product.id}>{product.productName}</option>)}</Select></Field>
      <Choice id="acc-source" label={t("accessibility.sourceLabel")} value={form.declarationSource} options={SOURCES} prefix="source" onChange={(value) => set({ declarationSource: value as Declaration["declarationSource"] })} />
      <Choice id="acc-closure" label={t("accessibility.closureLabel")} value={form.closureType} options={CLOSURES} prefix="closure" onChange={(value) => set({ closureType: value })} />
      <Choice id="acc-opening" label={t("accessibility.openingLabel")} value={form.openingPosition} options={OPENINGS} prefix="opening" onChange={(value) => set({ openingPosition: value })} />
      <Choice id="acc-magnetic" label={t("accessibility.filter.magneticClosure")} value={form.magneticClosure} options={TRI} prefix="tri" onChange={(value) => set({ magneticClosure: value as Tri })} />
      <Choice id="acc-tagless" label={t("accessibility.filter.taglessLabel")} value={form.taglessLabel} options={TRI} prefix="tri" onChange={(value) => set({ taglessLabel: value as Tri })} />
      <Choice id="acc-seams" label={t("accessibility.filter.flatSeams")} value={form.flatSeams} options={TRI} prefix="tri" onChange={(value) => set({ flatSeams: value as Tri })} />
      <Choice id="acc-contact" label={t("accessibility.contactLabel")} value={form.fabricContact} options={CONTACTS} prefix="contact" onChange={(value) => set({ fabricContact: value })} />
      <Choice id="acc-onehand" label={t("accessibility.filter.oneHandDressing")} value={form.oneHandDressing} options={TRI} prefix="tri" onChange={(value) => set({ oneHandDressing: value as Tri })} />
    </div>
    <Field id="acc-notes" label={t("accessibility.notesLabel")} hint={t("accessibility.notesHint")}><Textarea id="acc-notes" maxLength={1000} value={form.notes} onChange={(event) => set({ notes: event.target.value })} /></Field>
    <div><Button variant="primary" loading={busy} disabled={!productId} onClick={save}>{t("accessibility.declare")}</Button></div>
    {(mine.data ?? []).length > 0 && <ul className="grid gap-2">{mine.data!.map((info) => <li key={info.productId} className="surface p-3"><AccessibilityFacts info={info} /></li>)}</ul>}
  </section>;
}
