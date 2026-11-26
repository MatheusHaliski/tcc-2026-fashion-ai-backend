"use client";
import { FaiIcon } from "@/components/fai-icon";
import { Badge, Button, Dialog } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import type { FaiStoreItem } from "@/lib/fai-store/api";
import { StoreItemVisual } from "./store-item-visual";

/**
 * Card de loja expandido: foto grande, tipo, quem assina, descrição, preço, saldo e o botão de comprar. A recusa do
 * servidor (saldo insuficiente, item já possuído) aparece aqui mesmo, sem fechar o card.
 */
export function StoreItemDialog({ item, balance, busy, error, onBuy, onClose }: {
  item: FaiStoreItem | null; balance: number; busy: boolean; error: string | null; onBuy: () => void; onClose: () => void;
}) {
  const { t, fmtNumber } = useI18n();
  if (!item) return null;
  const missing = Math.max(0, item.pricePoints - balance);
  const footer = item.owned
    ? <Button onClick={onClose}>{t("common.close")}</Button>
    : <><Button disabled={busy} onClick={onClose}>{t("common.cancel")}</Button>
      <Button variant="primary" loading={busy} disabled={busy || missing > 0} onClick={onBuy}>{t("faiStore.buyFor", { price: fmtNumber(item.pricePoints) })}</Button></>;
  return (
    <Dialog open onClose={() => !busy && onClose()} title={item.name} footer={footer} size="lg">
      <div className="fai-store-expanded" data-type={item.type}>
        <div className="fai-store-expanded-photo"><StoreItemVisual item={item} /></div>
        <div className="fai-store-expanded-info">
          <p className="type-caption text-muted">{t(`faiStore.type.${item.type}`)}</p>
          {item.creator && <p className="type-body-sm">{t(`faiStore.creator.${item.creator.kind}`, { name: item.creator.name })}{item.creator.demo ? ` · ${t("faiStore.creator.demo")}` : ""}</p>}
          <p className="type-body">{item.description}</p>
          {item.product?.colorName && <p className="type-body-sm text-muted">{item.product.colorName}</p>}
          <p className="fai-store-price fai-store-price-lg"><FaiIcon id="ACT-40" size={24} decorative /><b className="tabular">{fmtNumber(item.pricePoints)}</b><span className="type-caption text-muted">{t("nav.points")}</span></p>
          {item.owned
            ? <Badge tone="chalk">{t("faiStore.owned")}</Badge>
            : <p className="type-body-sm text-muted">{missing > 0 ? t("faiStore.missing", { missing: fmtNumber(missing), balance: fmtNumber(balance) }) : t("faiStore.balanceAfter", { balance: fmtNumber(balance - item.pricePoints) })}</p>}
          <p className="type-caption text-muted">{t("faiStore.onlyInApp")}</p>
          {error && <p role="alert" className="fai-store-error type-body-sm">{error}</p>}
        </div>
      </div>
    </Dialog>
  );
}
