"use client";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { label } from "@/lib/api/taxonomy";
import { BrandLogo } from "@/components/brand-logo";
import { CardOccasionIcons } from "@/components/card-meta-icons";

export interface FashionMetaSource {
  styles?: string[] | null; occasions?: string[] | null;
  brands?: { name: string; logoUrl?: string | null }[];
  colors?: { name: string; hex?: string | null }[];
}

const unique = (values?: string[] | null) => [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];

/**
 * O conteúdo das células marca, cor, ocasião e estilo (null = sem valor). Ícone onde há um que diga o mesmo — logos
 * das marcas, amostras de cor, ícones FAI de ocasião — e texto só quando necessário: uma marca só, uma cor só, estilo.
 */
export function fashionMetaCells({ styles, occasions, brands, colors }: FashionMetaSource): Record<"brand" | "color" | "occasion" | "style", ReactNode> {
  const brandList = [...new Map((brands ?? []).filter((b) => b.name?.trim()).map((b) => [b.name.trim().toLowerCase(), b])).values()];
  const colorList = [...new Map((colors ?? []).filter((c) => c.name?.trim()).map((c) => [c.name.trim().toLowerCase(), c])).values()];
  const styleNames = unique(styles).map((value) => label(value));
  const occasionList = unique(occasions);
  const brandNames = brandList.map((b) => b.name).join(" · ");
  const colorNames = colorList.map((c) => label(c.name)).join(" · ");
  return {
    brand: brandList.length === 1 ? <BrandLogo name={brandList[0].name} src={brandList[0].logoUrl} size={20} withName />
      : brandList.length ? (
        <span className="card-meta-brands" title={brandNames} aria-label={brandNames}>
          {brandList.slice(0, 4).map((b) => <BrandLogo key={b.name} name={b.name} src={b.logoUrl} size={20} title={b.name} />)}
          {brandList.length > 4 && <span className="card-meta-more" aria-hidden>+{brandList.length - 4}</span>}
        </span>
      ) : null,
    color: colorList.length ? (
      <span className="card-meta-colors" title={colorNames}>
        {colorList.slice(0, 5).map((c) => {
          const hex = c.hex && /^#[\da-f]{6}$/i.test(c.hex) ? c.hex : null;
          return (
            <span key={c.name} className="pc-info-color" title={label(c.name)}>
              {hex && <i style={{ background: hex }} role="img" aria-label={label(c.name)} />}{(colorList.length === 1 || !hex) && label(c.name)}
            </span>
          );
        })}
        {colorList.length > 5 && <span className="card-meta-more" aria-label={colorNames}>+{colorList.length - 5}</span>}
      </span>
    ) : null,
    occasion: occasionList.length ? <CardOccasionIcons values={occasionList} /> : null,
    style: styleNames.length ? (
      <span title={styleNames.join(" · ")} aria-label={styleNames.join(" · ")}>
        {styleNames.slice(0, 2).join(" · ")}{styleNames.length > 2 && <span className="card-meta-more" aria-hidden> +{styleNames.length - 2}</span>}
      </span>
    ) : null,
  };
}

/** As quatro células fixas (card ampliado e prévias): marca, cor, ocasião e estilo. */
export function CardFashionMeta(source: FashionMetaSource) {
  const { t } = useI18n();
  const cells = fashionMetaCells(source);
  return (
    <dl className="card-fashion-meta">
      <div><dt>{t("common.brand")}</dt><dd>{cells.brand ?? "—"}</dd></div>
      <div><dt>{t("common.color")}</dt><dd>{cells.color ?? "—"}</dd></div>
      <div><dt>{t("common.occasion")}</dt><dd>{cells.occasion ?? "—"}</dd></div>
      <div><dt>{t("common.style")}</dt><dd>{cells.style ?? "—"}</dd></div>
    </dl>
  );
}
