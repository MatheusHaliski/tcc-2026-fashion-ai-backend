"use client";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { label } from "@/lib/api/taxonomy";
import { BrandLogo } from "@/components/brand-logo";

/** Real catalogue/wardrobe attributes remain visible even when the Hype tab is selected. */
export function CardFashionMeta({ styles, occasions, brands, colors }: {
 styles?: string[] | null; occasions?: string[] | null;
 brands?: { name: string; logoUrl?: string | null }[];
 colors?: { name: string; hex?: string | null }[];
}) {
 const { t }=useI18n();
 const unique=(values?: string[] | null)=>[...new Set((values??[]).map(value=>value.trim()).filter(Boolean))];
 const text=(values?: string[] | null, translate=true):ReactNode=>{
  const names=unique(values).map(value=>translate?label(value):value);if(!names.length)return "—";
  return <span title={names.join(" · ")} aria-label={names.join(" · ")}>{names.slice(0,2).join(" · ")}{names.length>2&&<span className="card-meta-more" aria-hidden> +{names.length-2}</span>}</span>;
 };
 const brandList=[...new Map((brands??[]).filter(b=>b.name?.trim()).map(b=>[b.name.trim().toLowerCase(),b])).values()];
 const colorList=[...new Map((colors??[]).filter(c=>c.name?.trim()).map(c=>[c.name.trim().toLowerCase(),c])).values()];
 return <dl className="card-fashion-meta">
  <div><dt>{t("common.brand")}</dt><dd>{brandList.length===1?<BrandLogo name={brandList[0].name} src={brandList[0].logoUrl} size={20} withName/>:text(brandList.map(b=>b.name),false)}</dd></div>
  <div><dt>{t("common.color")}</dt><dd>{colorList.length?<span className="card-meta-colors" title={colorList.map(c=>label(c.name)).join(" · ")}>
   {colorList.slice(0,2).map(c=><span key={c.name} className="pc-info-color">{c.hex&&/^#[\da-f]{6}$/i.test(c.hex)&&<i style={{background:c.hex}} aria-hidden/>}{label(c.name)}</span>)}
   {colorList.length>2&&<span className="card-meta-more" aria-label={colorList.map(c=>label(c.name)).join(" · ")}>+{colorList.length-2}</span>}
  </span>:"—"}</dd></div>
  <div><dt>{t("common.occasion")}</dt><dd>{text(occasions)}</dd></div>
  <div><dt>{t("common.style")}</dt><dd>{text(styles)}</dd></div>
 </dl>;
}
