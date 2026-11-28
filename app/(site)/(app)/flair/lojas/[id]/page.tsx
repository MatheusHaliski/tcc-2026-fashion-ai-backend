"use client";

import Link from "next/link";
import { use, useState } from "react";
import { StoreInventoryManager } from "@/components/marketplace/store-inventory-manager";
import { StorePieces } from "@/components/marketplace/store-pieces";
import styles from "@/components/marketplace/marketplace.module.css";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { PhysicalStore } from "@/lib/marketplace/physical-store";

export default function PhysicalStorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [revision, setRevision] = useState(0);
  const { t } = useI18n();
  const { user } = useAuth();
  const store = useApi<PhysicalStore>(
    (signal) => api.get(`/api/marketplace/stores/${encodeURIComponent(id)}`, { signal }), [id],
  );
  if (store.loading) return <p role="status">{t("marketplace.loading")}</p>;
  if (store.error || !store.data) {
    return <button className="btn" onClick={store.reload}>{t("marketplace.reload")}</button>;
  }
  const shop = store.data;
  const address = [shop.address, shop.city, shop.region, shop.country].join(", ");
  return (
    <>
      <header className={styles.hero}>
        <Link href="/flair">{t("nav.flair")}</Link>
        <h1 className="type-h1">{shop.name}</h1>
        {shop.brandProfileSlug ? <Link href={`/brands/${shop.brandProfileSlug}?tab=lojas_fisicas`}>{shop.brand}</Link> : <p>{shop.brand}</p>}
        <p>{address}</p>
        {shop.floor && <p>{t("marketplace.floor", { floor: shop.floor })}</p>}
        <div className={styles.pagination}>
          <a className="btn btn-sm" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer">{t("marketplace.directions")}</a>
          {user && shop.brandProfileSlug && <Link href={`/marketplace-negotiations?store=${shop.id}`} className="btn btn-sm">{t("marketplace.neg_new")}</Link>}
          <a className="btn btn-sm" href={shop.sourceUrl} target="_blank" rel="noopener noreferrer">{t("marketplace.official_source")}</a>
        </div>
      </header>
      <StoreInventoryManager storeId={id} slug={shop.brandProfileSlug} onChange={() => setRevision((value) => value + 1)} />
      <StorePieces key={revision} storeId={id} />
    </>
  );
}
