"use client";
import { FaiIcon } from "@/components/fai-icon";
import { Badge } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import type { FaiStoreItem } from "@/lib/fai-store/api";
import { StoreItemVisual } from "./store-item-visual";

/** Card da grade: foto, tipo, nome, descrição curta e preço em FAI Points. Clicar abre o card expandido. */
export function StoreItemCard({ item, onOpen }: { item: FaiStoreItem; onOpen: (item: FaiStoreItem) => void }) {
  const { t, fmtNumber } = useI18n();
  return (
    <li className="fai-store-cell">
      <button type="button" className="fai-store-card" onClick={() => onOpen(item)} aria-label={t("faiStore.open", { name: item.name })} data-type={item.type}>
        <span className="fai-store-photo"><StoreItemVisual item={item} /></span>
        <span className="fai-store-card-body">
          <span className="fai-store-card-kicker type-caption">{t(`faiStore.type.${item.type}`)}{item.creator ? ` · ${item.creator.name}` : ""}</span>
          <span className="fai-store-card-name type-h3">{item.name}</span>
          <span className="fai-store-card-desc type-body-sm text-muted">{item.description}</span>
          <span className="fai-store-card-foot">
            <span className="fai-store-price"><FaiIcon id="ACT-40" size={20} decorative /><b className="tabular">{fmtNumber(item.pricePoints)}</b></span>
            {item.owned ? <Badge tone="chalk">{t("faiStore.owned")}</Badge> : !item.affordable && <span className="type-caption text-muted">{t("faiStore.notEnough")}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}
