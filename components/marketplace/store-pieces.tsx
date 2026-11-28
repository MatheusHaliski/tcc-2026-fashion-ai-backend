"use client";

import Link from "next/link";
import { useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { MarketplacePiece } from "@/lib/marketplace/marketplace-piece";
import type { MarketplaceMap } from "@/lib/marketplace/types";
import type { PhysicalStore } from "@/lib/marketplace/physical-store";
import styles from "./marketplace.module.css";

export function StorePieces({ brandProfile, storeId, retail = false }: { brandProfile?: string; storeId?: string; retail?: boolean }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [map, setMap] = useState("");
  const [status, setStatus] = useState("");
  const [expiry, setExpiry] = useState("");
  const [region, setRegion] = useState("");
  const [store, setStore] = useState("");
  const [page, setPage] = useState(0);
  const params = new URLSearchParams({ status, expiry, name, brand, map, retail: String(retail), region: storeId ? "" : region, page: String(page) });
  if (brandProfile) params.set("brandProfile", brandProfile);
  if (storeId || store) params.set("store", storeId || store);
  const query = params.toString();
  const shopParams = new URLSearchParams({ brandProfile: brandProfile ?? "", region });
  const locations = useApi<{ stores: PhysicalStore[] }>(
    (signal) => api.get(`/api/marketplace/stores?${shopParams}`, { signal }), [brandProfile, region],
    { enabled: !!brandProfile && !storeId },
  );
  const maps = useApi<MarketplaceMap[]>((signal) => api.get("/api/marketplace/maps", { signal }), [], { enabled: retail });
  const products = useApi<{ pieces: MarketplacePiece[]; hasNext: boolean }>(
    (signal) => api.get(`/api/marketplace/pieces?${query}`, { signal }), [query],
  );

  return (
    <section className={styles.directory} aria-label={t("marketplace.pieces")}>
      <h2 className="type-h2">{t(retail ? "marketplace.retail_feed" : "marketplace.pieces")}</h2>
      <div className={styles.filters}>
        <label>
          {t("marketplace.filter_piece")}
          <input className="input" type="search" value={name} onChange={(event) => { setName(event.target.value); setPage(0); }} />
        </label>
        {retail && <>
          <label>
            {t("marketplace.filter_brand")}
            <input className="input" type="search" value={brand} onChange={(event) => { setBrand(event.target.value); setPage(0); }} />
          </label>
          <label>
            {t("marketplace.filter_map")}
            <select className="input" value={map} onChange={(event) => { setMap(event.target.value); setPage(0); }}>
              <option value="">{t("marketplace.all_maps")}</option>
              {maps.data?.map((area) => <option value={area.slug} key={area.slug}>{area.name}</option>)}
            </select>
          </label>
        </>}
        {!storeId && <>
          <label>
            {t("marketplace.filter_region")}
            <input className="input" type="search" value={region} onChange={(event) => {
              setRegion(event.target.value);
              setStore("");
              setPage(0);
            }} />
          </label>
          {brandProfile && <label>
            {t("marketplace.physical_stores")}
            <select className="input" value={store} onChange={(event) => { setStore(event.target.value); setPage(0); }}>
              <option value="">{t("marketplace.all_stores")}</option>
              {locations.data?.stores.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.city}</option>)}
            </select>
          </label>}
        </>}
        <label>
          {t("marketplace.filter_status")}
          <select className="input" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}>
            <option value="">{t("marketplace.all_status")}</option>
            <option value="SPECIAL">{t("marketplace.special")}</option>
            <option value="STANDARD">{t("marketplace.standard")}</option>
          </select>
        </label>
        {!retail && <label>
          {t("marketplace.expiry")}
          <select className="input" value={expiry} onChange={(event) => { setExpiry(event.target.value); setPage(0); }}>
            <option value="">{t("marketplace.all_status")}</option>
            <option value="ACTIVE">{t("marketplace.active_expiry")}</option>
            <option value="EXPIRED">{t("marketplace.expired")}</option>
          </select>
        </label>}
      </div>
      {products.loading ? <p role="status">{t("marketplace.loading")}</p> : products.error ? (
        <button className="btn" onClick={products.reload}>{t("marketplace.reload")}</button>
      ) : !products.data?.pieces.length ? <p>{t("marketplace.empty_pieces")}</p> : (
        <div className={styles.cards}>
          {products.data.pieces.map((piece) => (
            <Link key={piece.id} href={`/pieces/${piece.id}`} className={styles.store}>
              {piece.imageUrl && <img src={mediaUrl(piece.imageUrl)} alt="" className={styles.productImage} loading="lazy" />}
              <div className={styles.storeBody}>
                <h3>{piece.name}</h3>
                {!piece.forSale && <p>{t("marketplace.not_for_sale")}</p>}
                {piece.expiresAt && Date.parse(piece.expiresAt) <= Date.now() && <p>{t("marketplace.expired")}</p>}
                {piece.status === "SPECIAL" && <p className={styles.meta}>{t("marketplace.special")}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
      {!products.loading && !products.error && (page > 0 || products.data?.hasNext) && (
        <nav className={styles.pagination} aria-label={t("marketplace.pieces")}>
          <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("marketplace.previous")}</button>
          <button className="btn btn-sm" disabled={!products.data?.hasNext} onClick={() => setPage(page + 1)}>{t("marketplace.next")}</button>
        </nav>
      )}
    </section>
  );
}
