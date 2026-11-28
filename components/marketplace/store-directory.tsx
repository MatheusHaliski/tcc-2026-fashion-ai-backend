"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { MarketplaceMap } from "@/lib/marketplace/types";
import type { PhysicalStore } from "@/lib/marketplace/physical-store";
import { ShoppingMap } from "./shopping-map";
import { StoreCard } from "./store-card";
import styles from "./marketplace.module.css";

export function StoreDirectory({ brandProfile }: { brandProfile?: string }) {
  const { t } = useI18n();
  const [filters, setFilters] = useState({ name: "", brand: "", region: "", map: "" });
  const [page, setPage] = useState(0);
  const update = (field: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(0);
  };
  const params = new URLSearchParams({ ...filters, page: String(page) });
  if (brandProfile) params.set("brandProfile", brandProfile);
  const query = params.toString();
  const maps = useApi<MarketplaceMap[]>((signal) => api.get("/api/marketplace/maps", { signal }), []);
  const directory = useApi<{ stores: PhysicalStore[]; hasNext: boolean }>(
    (signal) => api.get(`/api/marketplace/stores?${query}`, { signal }), [query],
  );
  const map = maps.data?.find((item) => item.slug === filters.map);
  const stores = directory.loading || directory.error ? [] : directory.data?.stores ?? [];

  return (
    <section className={styles.directory} aria-label={t("marketplace.physical_stores")}>
      <form className={styles.filters} onSubmit={(event) => event.preventDefault()}>
        {(["name", "brand", "region"] as const).filter((field) => !brandProfile || field !== "brand").map((field) => (
          <label key={field}>
            {t(`marketplace.filter_${field}`)}
            <input className="input" type="search" value={filters[field]} onChange={(event) => update(field, event.target.value)} />
          </label>
        ))}
        <label>
          {t("marketplace.filter_map")}
          <select className="input" value={filters.map} onChange={(event) => update("map", event.target.value)}>
            <option value="">{t("marketplace.all_maps")}</option>
            {maps.data?.map((item) => (
              <option key={item.slug} value={item.slug}>{item.name} · {t(`marketplace.kind_${item.kind}`)}</option>
            ))}
          </select>
        </label>
      </form>
      {maps.error && <p role="status">{t("marketplace.maps_error")}</p>}
      {map && <ShoppingMap key={map.slug} map={map} stores={stores} />}
      {directory.loading ? <p role="status">{t("marketplace.loading")}</p> : directory.error ? (
        <button className="btn" onClick={directory.reload}>{t("marketplace.reload")}</button>
      ) : stores.length === 0 ? <p role="status">{t("marketplace.empty_stores")}</p> : (
        <div className={styles.cards}>{stores.map((store) => <StoreCard key={store.id} store={store} />)}</div>
      )}
      {!directory.loading && !directory.error && (page > 0 || directory.data?.hasNext) && (
        <nav className={styles.pagination} aria-label={t("marketplace.physical_stores")}>
          <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("marketplace.previous")}</button>
          <button className="btn btn-sm" disabled={!directory.data?.hasNext} onClick={() => setPage(page + 1)}>{t("marketplace.next")}</button>
        </nav>
      )}
    </section>
  );
}
