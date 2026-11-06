"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth/session";
import { ProductChartSizes } from "./ProductChartSizes";
import { Dialog } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { gridOf, readMySizes, writeMySize } from "@/lib/tryon/sizes";
import { SizePicker } from "@/components/try-on/size-picker";
import { GRIDS } from "@/lib/tryon/sizes";
import { SizeReferenceTable } from "./SizeReferenceTable";

export interface FitProduct { id: string; productName?: string | null; category?: string | null; subcategory?: string | null; gender?: string | null }

/** Authenticated viewers see the product chart when valid; reference sizing stays explicitly separate. */
export function ProductFitDialog({ product, open, onClose }: { product: FitProduct; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const fallback = <ReferenceSizes key={product.id} product={product} />;
  return <Dialog open={open} onClose={onClose} title={t("size.dialog_titulo", { name: product.productName ?? "" })} size="lg">
    {open && (user ? <ProductChartSizes key={product.id} productId={product.id} fallback={fallback} /> : fallback)}
  </Dialog>;
}

function ReferenceSizes({ product }: { product: FitProduct }) {
  const { t } = useI18n();
  const grid = gridOf(product.category, product.subcategory);
  const [mine, setMine] = useState(() => (grid ? readMySizes()[grid] ?? null : null));
  const sex = product.gender === "FEMININO" ? "FEMININO" : "MASCULINO";
  return <>
    <p className="type-caption">{t("size.productChart.reference")}</p>
    {!grid ? <p className="type-body" role="status">{t("size.sem_grade")}</p> : <div className="grid gap-4">
      <p className="type-body text-muted">{t("size.dialog_lead")}</p>
      <SizePicker grid={grid} options={GRIDS[grid]} chosen={mine} natural={null} label={t("size.meu_tamanho")}
        onPick={(label) => { writeMySize(grid, label); setMine(label); }} />
      {mine && <p className="type-body-sm" role="status">{t("size.salvo", { size: mine })}</p>}
      <SizeReferenceTable grid={grid} sex={sex} highlight={mine} />
    </div>}
  </>;
}
