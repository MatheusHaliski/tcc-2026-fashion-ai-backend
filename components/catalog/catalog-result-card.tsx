"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/auth/session";
import type { CatalogProduct, CatalogVariant, MatchReason } from "@/lib/api/catalog";
import { label, useTaxonomy, subcategoryLabel } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import { Badge, Button, cn } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";
import { hasUsableCatalogPreview, useCatalogPreview } from "./use-catalog-preview";
import { DefaultGarmentPhoto } from "./default-garment-photo";
import { CatalogPhoto, photoAspect } from "@/components/catalog/catalog-photo";
import { usePhotoFraming } from "@/lib/photo-framing";
import { CatalogModel3d } from "./catalog-model3d";

const ProductFitDialog = dynamic(() => import("@/components/fit/ProductFitDialog").then(module => module.ProductFitDialog), { ssr: false });

type T = (k: string, v?: Record<string, unknown>) => string;

function reasonLabel(r: MatchReason, t: T): string {
  switch (r.facet) {
    case "pattern": return t(`catalog.design.pattern.${r.value}`);
    case "placement": return t(`catalog.design.placement.${r.value}`);
    case "size": return t(`catalog.design.size.${r.value}`);
    case "sides": return r.value.includes("+") ? t("catalog.design.sides.both") : t(`catalog.design.sides.${r.value}`);
    case "baseColor": return t("catalog.design.base_color", { cor: label(r.value).toLowerCase() });
    case "printColor": return t("catalog.design.print_color", { cor: label(r.value).toLowerCase() });
    default: return label(r.value);
  }
}

/** Card de resultado: foto oficial dominante (ou a ilustração da categoria), marca, nome, modelo, cor, tipo e fonte. */
export function CatalogResultCard({ product: original, onPick, pickLabel, selectedVariant: controlledVariant, onVariantChange, busy, disabled }: {
  product: CatalogProduct;
  onPick: (variant: CatalogVariant | null, prepared: CatalogProduct, prepare: () => CatalogProduct | Promise<CatalogProduct>) => void; busy?: boolean; disabled?: boolean;
  pickLabel?: string;
  selectedVariant?: CatalogVariant | null;
  onVariantChange?: (variant: CatalogVariant) => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [fitOpen, setFitOpen] = useState(false);
  const tax = useTaxonomy();
  const [localVariant, setLocalVariant] = useState<CatalogVariant | null>(original.selectedVariant ?? null);
  const variant = controlledVariant === undefined ? localVariant : controlledVariant;
  const requestProduct = useMemo(() => variant ? { ...original, selectedVariant: variant } : original, [original, variant]);
  const preview = useCatalogPreview(requestProduct);
  const p = preview.product;
  const setVariant = (next: CatalogVariant) => {
    if (controlledVariant === undefined) setLocalVariant(next);
    onVariantChange?.(next);
  };
  const img = p.catalogImage?.url ?? p.imageUrl;
  const [framing] = usePhotoFraming();
  const source = p.source?.domain && p.source.domain !== "null" ? p.source.domain : t("catalog.fonte_fashionai");
  return (
    <article ref={preview.ref} className="catalog-card surface" aria-busy={preview.pending}>
      <div className="catalog-card-media" style={{ aspectRatio: framing === "WHOLE" ? "3 / 4" : photoAspect(p.catalogImage?.aspect) }}>
        {!hasUsableCatalogPreview(p) || preview.failed || !img
          ? <><DefaultGarmentPhoto category={p.category} subcategory={p.subcategory} color={variant?.color ?? p.color} colorHex={variant?.color ? undefined : p.colorHex} framing={framing} alt={t("catalog.defaultIllustration")}/>{preview.failed && <button type="button" className="btn btn-sm catalog-photo-retry" onClick={preview.retry}>{t("common.retry")}</button>}</>
          : <CatalogPhoto requiredFrame onRetry={preview.retry} framing={framing} image={p.catalogImage} category={p.category} subcategory={p.subcategory} color={variant?.color ?? p.color} colorHex={variant?.color ? undefined : p.colorHex} alt={`${p.brand?.name ?? ""} ${p.productName}`}/>}

        {typeof p.matchPercent === "number" && <Badge tone="thread" className="catalog-card-match">{t("catalog.compativel", { pct: p.matchPercent })}</Badge>}
        {p.ingestionStatus === "DISCOVERED" && <Badge tone="chalk" className="catalog-card-new">{t("catalog.loja_oficial")}</Badge>}
      </div>
      <div className="catalog-card-body">
        <p className="flex items-center gap-1.5 type-caption text-muted"><BrandLogo name={p.brand?.name} src={p.brand?.logoUrl} size={18} />{p.brand?.name}</p>
        <h3 className="type-h3 leading-tight">{p.productName}</h3>
        <p className="type-body-sm text-muted">{[p.modelName && p.modelName !== p.productName ? p.modelName : null, subcategoryLabel(p.subcategory)].filter(Boolean).join(" · ")}</p>
        {p.description && <p className="catalog-card-desc type-caption text-muted">{p.description}</p>}
        {(p.matchScore?.reasons?.length ?? 0) > 0 && (
          <ul className="catalog-reasons" aria-label={t("catalog.design.por_que_esta")}>
            {p.matchScore!.reasons!.slice(0, 5).map((r) => (
              <li key={`${r.facet}:${r.value}`} className={cn("catalog-reason", r.ok ? "is-ok" : "is-miss")}>
                <span aria-hidden>{r.ok ? "✓" : "✗"}</span><span className="sr-only">{r.ok ? t("catalog.design.tem") : t("catalog.design.nao_tem")}</span>{reasonLabel(r, t)}
              </li>
            ))}
          </ul>
        )}
        {(p.variants?.length ?? 0) > 1 ? (
          <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label={t("common.color")}>
            {p.variants!.map((v) => <button key={v.id} type="button" className={cn("catalog-swatch", (variant?.id ?? p.selectedVariant?.id) === v.id && "is-active")} title={v.colorName ?? v.color ?? v.key} aria-label={v.colorName ?? v.color ?? v.key} aria-pressed={(variant?.id ?? null) === v.id} onClick={() => setVariant(v)} disabled={disabled || busy} style={{ background: tax?.colors?.[v.color ?? ""] ?? "var(--surface-3)" }} />)}
          </div>
        ) : p.colorName ? <p className="mt-1 flex items-center gap-1.5 type-body-sm"><span className="h-3 w-3 rounded-full border border-line-soft" style={{ background: p.colorHex ?? undefined }} />{p.colorName}</p> : null}
        <p className="mt-1 type-caption text-faint">{t("catalog.fonte", { fonte: source })}</p>
        {user && <Button size="sm" className="mt-2 self-start" onClick={() => setFitOpen(true)}>{t("size.botao")}</Button>}
        {p.model3dUrl && <CatalogModel3d url={p.model3dUrl} name={p.productName} />}
        <Button variant="primary" size="sm" className="mt-2 self-start" onClick={() => onPick(variant, p, preview.prepare)} loading={busy} disabled={disabled}>{busy ? t("catalog.verificando_foto") : pickLabel ?? t("catalog.e_esta")}</Button>
      </div>
      {fitOpen && <ProductFitDialog product={p} open onClose={() => setFitOpen(false)} />}
    </article>
  );
}
