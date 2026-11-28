import { usePieceCommerceCells } from "@/components/pieces/piece-commerce-cells";
import { CatalogSaveButton } from "./catalog-save-button";
import { CatalogPhoto } from "@/components/catalog/catalog-photo";
import { PieceCardFrame } from "@/components/pieces/piece-card-frame";
import { BrandLogo } from "@/components/brand-logo";
import { Dialog } from "@/components/ui";
import type { CatalogProduct } from "@/lib/api/catalog";
import { subcategoryLabel } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";

export function CatalogPieceDetails({ product, onClose, onSavedChange }: { product: CatalogProduct; onClose: () => void; onSavedChange?: (saved: boolean) => void }) {
  const { t, fmtNumber } = useI18n();
  const info = product.commerce;
  const commerce = usePieceCommerceCells(product);
  return (
    <Dialog open title={product.productName} onClose={onClose} footer={<CatalogSaveButton id={product.id} onChange={onSavedChange} />}>
      <PieceCardFrame className="pc">
        <div className="pc-media">
          <CatalogPhoto image={product.catalogImage} fallbackUrl={product.imageUrl}
            category={product.category} subcategory={product.subcategory} color={product.color}
            colorHex={product.colorHex} alt={product.productName} framing="WHOLE" />
        </div>
        <div className="pc-id">
          <BrandLogo name={product.brand?.name} src={product.brand?.logoUrl} size={24} withName />
          <p>{subcategoryLabel(product.subcategory)}</p>
          {product.description && <p>{product.description}</p>}
          {info && <dl className="c-facts">
            <div><dt>{t("marketplace.tries")}</dt><dd>{fmtNumber(info.tryOnCount)}</dd></div>
            <div><dt>{t("marketplace.views")}</dt><dd>{fmtNumber(info.viewCount)}</dd></div>
            {info.salesCount != null && <div><dt>{t("marketplace.sales")}</dt><dd>{fmtNumber(info.salesCount)}</dd></div>}
            {commerce.expiry && <div><dt>{t("marketplace.expiry")}</dt><dd>{commerce.expiry}</dd></div>}
            {commerce.deal && <div><dt>{t("marketplace.piece_deal")}</dt><dd>{commerce.deal}</dd></div>}
          </dl>}
        </div>
      </PieceCardFrame>
    </Dialog>
  );
}
