"use client";

import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { storeApi } from "@/lib/store/api";
import { variantLabel, type StoreOrder } from "@/lib/store/types";
import { Badge, EmptyState, ErrorState, SkeletonGrid } from "@/components/ui";
import { ReturnRequest } from "./store-returns";

/** RF-PESQ-01/02 — resgates da pessoa: a variante gravada no pedido e o acesso ao pós-venda. */
export function StoreOrders() {
  const { t, fmtDate, fmtNumber } = useI18n();
  const orders = useApi((signal) => storeApi.myOrders(signal), []);
  if (orders.error) return <ErrorState error={orders.error} onRetry={orders.reload} />;
  if (orders.loading && !orders.data) return <SkeletonGrid n={2} h="h-24" />;
  const rows = orders.data ?? [];
  return <section className="grid gap-3" aria-labelledby="store-orders-title">
    <h2 id="store-orders-title" className="type-h2">{t("physicalStore.orders.title")}</h2>
    {rows.length === 0 ? <EmptyState title={t("physicalStore.orders.empty")} /> : <ul className="grid gap-3">{rows.map((order: StoreOrder) => <li key={order.id} className="surface grid gap-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b>{order.product.productName}</b>
        <Badge tone="thread">{t(`physicalStore.status.${order.status}`)}</Badge>
      </div>
      <p className="type-caption text-muted">{t("physicalStore.orders.placed", { date: fmtDate(order.createdAt) })} · {fmtNumber(order.pricePoints)} {t("nav.points")}</p>
      <p className="type-body-sm"><span className="text-muted">{t("physicalStore.variant.chosen")}: </span>{order.variant ? variantLabel(order.variant, t("physicalStore.variant.noColor")) : t("physicalStore.variant.notRecorded")}</p>
      {order.trackingUrl && <a className="type-body-sm underline" href={order.trackingUrl} target="_blank" rel="noreferrer noopener">{t("physicalStore.trackingCode")}: {order.trackingCode}</a>}
      <ReturnRequest order={order} onChanged={orders.reload} />
    </li>)}</ul>}
  </section>;
}
