"use client";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { catalogApi, type CatalogProduct, type CatalogVariant } from "@/lib/api/catalog";
import type { PieceView } from "@/lib/api/types";
import { label, useTaxonomy } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Dialog, Field, Input, Select, Switch, Textarea, cn } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";
import { GarmentGlyph } from "@/components/capture/garment-glyphs";

const CONDITIONS = ["NEW", "GOOD", "WORN", "DAMAGED"] as const;
const ILLUSTRATION: Record<string, "tshirt" | "pants_back" | "sneaker_side" | "bag" | "dress"> = { upper_piece: "tshirt", lower_piece: "pants_back", shoes_piece: "sneaker_side", accessory_piece: "bag", full_body_piece: "dress" };

/**
 * RF47 · "Confirme sua peça": a foto oficial grande e os dados do PRODUTO (do catálogo: marca, nome, modelo, categoria,
 * subcategoria, cor, material, código, fonte) separados dos dados da MINHA PEÇA (tamanho, estado, preço pago, data da
 * compra, favorito, à venda, visibilidade, observações). A seleção é da pessoa ("Parece ser esta?"); o produto entra
 * no guarda-roupa por referência (POST /api/pieces/from-catalog).
 */
export function ConfirmPieceDialog({ product, variant: initialVariant, open, onClose, onCreated }: {
  product: CatalogProduct | null; variant: CatalogVariant | null; open: boolean; onClose: () => void; onCreated: (piece: PieceView) => void;
}) {
  const { t } = useI18n();
  const tax = useTaxonomy();
  const [full, setFull] = useState<CatalogProduct | null>(null);
  const [variant, setVariant] = useState<CatalogVariant | null>(initialVariant);
  const [form, setForm] = useState({ size: "", condition: "GOOD", price: "", purchaseDate: "", favorite: false, forSale: false, visibility: "PRIVATE", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open || !product) return;
    setFull(null); setVariant(initialVariant); setError(null);
    catalogApi.product(product.id).then(setFull).catch(() => setFull(product));
  }, [open, product?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open || !product) return null;
  const p = full ?? product;
  const images = p.images?.length ? p.images : p.imageUrl ? [{ id: "primary", url: p.imageUrl, type: "PACKSHOT", primary: true, provenance: p.imageSource! }] : [];
  const variants = p.variants ?? [];
  const chosenColor = variant?.color ?? p.color ?? null;
  const sizes = sizesFor(p.category, tax?.sizes ?? []);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  async function submit() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const piece = await catalogApi.addToWardrobe({
        productId: p.id, variantId: variant?.id ?? null, size: form.size || null, condition: form.condition || null,
        price: form.price === "" ? null : Number(form.price), purchaseDate: form.purchaseDate || null, favorite: form.favorite,
        forSale: form.forSale, visibility: form.visibility, notes: form.notes || null, color: chosenColor,
      });
      onCreated(piece);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("catalog.erro_adicionar"));
    } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onClose={onClose} title={t("catalog.confirme_sua_peca")} size="xl"
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>{t("common.back")}</Button><Button variant="primary" onClick={submit} loading={busy}>{t("catalog.adicionar_ao_guarda_roupa")}</Button></>}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div>
          <div className="catalog-hero">
            {images[0] ? <img src={images[0].url} alt={`${p.brand?.name ?? ""} ${p.productName}`} /> : <GarmentGlyph id={ILLUSTRATION[p.category] ?? "generic"} size={200} animated={false} numbered={false} className="text-muted" />}
          </div>
          {images.length > 1 && <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t("catalog.outras_fotos")}>{images.slice(1, 6).map((i) => <li key={i.id}><img src={i.url} alt={t("catalog.outra_foto_do_produto")} className="h-14 w-14 rounded object-cover border border-line-soft" loading="lazy" /></li>)}</ul>}
          {images[0]?.provenance && <p className="mt-2 type-caption text-faint">{t("catalog.proveniencia", { dominio: images[0].provenance.sourceDomain, data: images[0].provenance.retrievedAt?.slice(0, 10) ?? "" })}</p>}
          {!images.length && <p className="mt-2 type-caption text-muted">{t("catalog.sem_foto_oficial")}</p>}
        </div>
        <div className="min-w-0">
          <p className="label">{t("catalog.informacoes_do_produto")}</p>
          <div className="flex items-center gap-2"><BrandLogo name={p.brand?.name} src={p.brand?.logoUrl} size={28} shape="square" /><h3 className="type-h2 leading-tight">{p.productName}</h3></div>
          <dl className="c-facts mt-2">
            {([[t("common.brand"), p.brand?.name], [t("catalog.modelo"), p.modelName], [t("common.category"), label(p.category)], [t("common.subcategory"), label(p.subcategory)],
              [t("common.color"), variant?.colorName ?? p.colorName ?? (chosenColor ? label(chosenColor) : null)], [t("common.material"), p.material ? label(p.material.toLowerCase()) : null],
              [t("catalog.codigo_sku"), variant?.code ?? variant?.sku ?? p.productCode ?? p.sku], [t("catalog.colecao"), p.collection],
              [t("catalog.fonte_label"), p.source?.domain && p.source.domain !== "null" ? p.source.domain : t("catalog.fonte_fashionai")]] as [string, string | null | undefined][])
              .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {variants.length > 1 && (
            <div className="mt-3">
              <p className="label">{t("catalog.qual_cor_e_a_sua")}</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("catalog.qual_cor_e_a_sua")}>
                {variants.map((v) => <button key={v.id} type="button" className={cn("chip", variant?.id === v.id && "is-active")} aria-pressed={variant?.id === v.id} onClick={() => setVariant(v)}><span className="h-3 w-3 rounded-full border border-line-soft" style={{ background: tax?.colors?.[v.color ?? ""] ?? "var(--surface-3)" }} />{v.colorName ?? (v.color ? label(v.color) : v.key)}</button>)}
              </div>
            </div>
          )}
          <p className="label mt-4">{t("catalog.informacoes_da_minha_peca")}</p>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Field label={t("common.size")} id="cp-size"><Select id="cp-size" value={form.size} onChange={(e) => set("size", e.target.value)}><option value="">—</option>{sizes.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></Field>
            <Field label={t("catalog.estado")} id="cp-cond"><Select id="cp-cond" value={form.condition} onChange={(e) => set("condition", e.target.value)}>{CONDITIONS.map((c) => <option key={c} value={c}>{t(`catalog.condition.${c}`)}</option>)}</Select></Field>
            <Field label={t("catalog.preco_pago")} id="cp-price"><Input id="cp-price" type="number" inputMode="decimal" min={0} step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} /></Field>
            <Field label={t("catalog.data_da_compra")} id="cp-date"><Input id="cp-date" type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} /></Field>
            <Field label={t("common.visibility")} id="cp-vis"><Select id="cp-vis" value={form.visibility} onChange={(e) => set("visibility", e.target.value)}><option value="PRIVATE">{t("common.private")}</option><option value="FOLLOWERS">{t("common.followers")}</option><option value="PUBLIC">{t("common.public")}</option></Select></Field>
            <div className="grid content-end gap-1 pb-3"><Switch checked={form.favorite} onChange={(v) => set("favorite", v)} label={t("common.favorite")} /><Switch checked={form.forSale} onChange={(v) => set("forSale", v)} label={t("common.forSale")} /></div>
          </div>
          <Field label={t("catalog.observacoes")} id="cp-notes"><Textarea id="cp-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          {error && <p role="alert" className="error-text">{error}</p>}
          <p className="type-caption text-faint">{t("catalog.foto_propria_depois")}</p>
        </div>
      </div>
    </Dialog>
  );
}

/** Tamanhos coerentes com a categoria: calçado numera; acessório é tamanho único ou letras; roupa, letras e numeração BR. */
export function sizesFor(category: string, sizes: string[]) {
  if (category === "shoes_piece") return sizes.filter((s) => s.startsWith("shoe_"));
  if (category === "accessory_piece") return ["one_size", ...sizes.filter((s) => /^(xs|s|m|l|xl|xxl)$/.test(s))];
  return sizes.filter((s) => !s.startsWith("shoe_") && s !== "one_size");
}
