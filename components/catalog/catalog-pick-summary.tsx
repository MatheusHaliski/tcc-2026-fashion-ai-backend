"use client";
import Link from "next/link";
import { Button } from "@/components/ui";
import { CatalogPhoto } from "@/components/catalog/catalog-photo";
import type { CatalogProduct, CatalogVariant } from "@/lib/api/catalog";
import { useI18n } from "@/lib/i18n/i18n";
import type { PhotoFraming } from "@/lib/photo-framing";

/** Produto do catálogo escolhido na busca (RF47): a peça é criada por referência a ele. */
export interface CatalogPick {
  product: CatalogProduct;
  variant: CatalogVariant | null;
}

/** Resumo do produto escolhido no criador de peça, com "Remover referência". */
export function CatalogPickSummary({ pick, image, fallback, framing, onClear }: {
  pick: CatalogPick; image: string | null; fallback: string; framing: PhotoFraming; onClear: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="catalog-pick" role="status">
      <span className="catalog-pick-art" aria-hidden>
        {pick.product.catalogImage
          ? <CatalogPhoto framing={framing} image={pick.product.catalogImage} fallbackUrl={image} alt="" />
          : <img src={image ?? fallback} alt="" />}
      </span>
      <div className="min-w-0">
        <p className="type-caption text-muted">{t("catalog.peca_do_catalogo")}</p>
        <p className="type-body font-medium truncate">{pick.product.brand?.name} · {pick.product.productName}{pick.variant?.colorName ? ` — ${pick.variant.colorName}` : ""}</p>
        <p className="type-caption text-faint">{image ? t("catalog.foto_oficial_nota") : t("catalog.sem_foto_oficial_nota")}</p>
      </div>
      <Button size="sm" variant="ghost" onClick={onClear}>{t("catalog.remover_referencia")}</Button>
    </div>
  );
}

/** RF54 — veio do "É minha" do FashionAI Lens: o que a leitura viu já está no formulário, para conferir. */
export function LensPrefillNote({ scan }: { scan?: string | null }) {
  const { t } = useI18n();
  return (
    <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-thread-soft p-3 type-body-sm" role="note" data-prefill="lens">
      <b>{t("pieceForm.lens.veio")}</b><span>{t("pieceForm.lens.dica")}</span>
      {scan && <Link className="underline" href={`/lens/${scan}`}>{t("pieceForm.lens.voltar")}</Link>}
    </p>
  );
}
