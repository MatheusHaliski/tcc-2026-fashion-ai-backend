"use client";
import { useState } from "react";
import { Dialog } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { gridOf, readMySizes, writeMySize } from "@/lib/tryon/sizes";
import { SizePicker } from "@/components/try-on/size-picker";
import { GRIDS } from "@/lib/tryon/sizes";
import { SizeReferenceTable } from "./SizeReferenceTable";

export interface FitProduct { id: string; productName?: string | null; category?: string | null; subcategory?: string | null; gender?: string | null }

/**
 * Tamanho da peça em um toque (sem formulário de medidas nem tabela por produto): a grade do sistema para a categoria
 * (PP…XG, 34…50 ou a numeração do calçado). A escolha vira "meu tamanho" dessa grade — o provador veste as próximas
 * peças nele — e a tabela de referência mostra o que cada tamanho veste, em cm.
 */
export function ProductFitDialog({ product, open, onClose }: { product: FitProduct; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const grid = gridOf(product.category, product.subcategory);
  const [mine, setMine] = useState(() => (grid ? readMySizes()[grid] ?? null : null));
  const sex = product.gender === "FEMININO" ? "FEMININO" : "MASCULINO";
  return <Dialog open={open} onClose={onClose} title={t("size.dialog_titulo", { name: product.productName ?? "" })} size="lg">
    {!grid ? <p className="type-body" role="status">{t("size.sem_grade")}</p> : <div className="grid gap-4">
      <p className="type-body text-muted">{t("size.dialog_lead")}</p>
      <SizePicker grid={grid} options={GRIDS[grid]} chosen={mine} natural={null} label={t("size.meu_tamanho")}
        onPick={(label) => { writeMySize(grid, label); setMine(label); }} />
      {mine && <p className="type-body-sm" role="status">{t("size.salvo", { size: mine })}</p>}
      <SizeReferenceTable grid={grid} sex={sex} highlight={mine} />
    </div>}
  </Dialog>;
}
