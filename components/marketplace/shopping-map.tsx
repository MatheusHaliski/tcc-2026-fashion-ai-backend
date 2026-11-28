import { useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { MarketplaceMap } from "@/lib/marketplace/types";
import type { MarketplacePiece } from "@/lib/marketplace/marketplace-piece";
import type { PhysicalStore } from "@/lib/marketplace/physical-store";
import { StorePieces } from "./store-pieces";
import styles from "./marketplace.module.css";

export function ShoppingMap({ map, stores }: { map: MarketplaceMap; stores: PhysicalStore[] }) {
  const { t } = useI18n();
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const selected = stores.find((store) => store.id === selectedId);
  const pins = map.imageUrl ? stores.filter((store) => store.mapX != null && store.mapY != null) : stores;
  const ids = pins.map((store) => store.id).join(",");
  const previews = useApi<{ storeId: string; piece: MarketplacePiece }[]>(
    (signal) => api.get(`/api/marketplace/maps/${encodeURIComponent(map.slug)}/highlights?stores=${encodeURIComponent(ids)}`, { signal }),
    [ids, map.slug], { enabled: !!ids },
  );
  const highlightsFor = (id: string) => previews.loading ? [] :
    (previews.data ?? []).filter((entry) => entry.storeId === id).map((entry) => entry.piece);

  return (
    <section className={styles.directory}>
      <div className={styles.pagination}>
        <button className="btn btn-sm" type="button" disabled={zoom <= 1} onClick={() => setZoom(zoom - 0.5)}>{t("marketplace.zoom_out")}</button>
        <button className="btn btn-sm" type="button" disabled={zoom >= 3} onClick={() => setZoom(zoom + 0.5)}>{t("marketplace.zoom_in")}</button>
      </div>
      {!map.imageUrl && <p className="type-body-sm text-muted">{t("marketplace.map_schematic")}</p>}
      <div className={styles.mapViewport} tabIndex={0} aria-label={map.name}>
        <figure className={styles.map} style={{ width: `${zoom * 100}%` }}>
          {map.imageUrl ? <img src={mediaUrl(map.imageUrl)} alt={map.name} /> :
            <div className={styles.schematic} aria-label={t("marketplace.map_schematic")}>
              {stores.map((store) => (
                <button key={store.id} type="button" className={styles.schematicStore}
                  aria-pressed={selectedId === store.id} onClick={() => setSelectedId(store.id)}>
                  <span>{store.name}</span>
                  {!selected && <StoreMapPreview pieces={highlightsFor(store.id)} />}
                </button>
              ))}
            </div>}
          {map.imageUrl && pins.map((store) => (
            <button
              type="button"
              className={styles.pin}
              key={store.id}
              style={{ left: `clamp(1.25rem, ${store.mapX! * 100}%, calc(100% - 1.25rem))`, top: `clamp(1.25rem, ${store.mapY! * 100}%, calc(100% - 1.25rem))` }}
              aria-pressed={selectedId === store.id}
              onClick={() => setSelectedId(store.id)}
            >
              <span>{store.name}</span>
              {!selected && <StoreMapPreview pieces={highlightsFor(store.id)} />}
            </button>
          ))}
        </figure>
      </div>
      {selected && (
        <section className={styles.directory} aria-label={selected.name}>
          <h2 className="type-h2">{selected.name}</h2>
          <p>{selected.address}</p>
          <Link href={`/flair/lojas/${selected.id}`}>{t("marketplace.explore_store")}</Link>
          <StorePieces storeId={selected.id} key={selected.id} />
        </section>
      )}
    </section>
  );
}

function StoreMapPreview({ pieces }: { pieces: MarketplacePiece[] }) {
  if (!pieces.length) return null;
  return (
    <span className={styles.pinPreviews}>
      {pieces.map((piece) => (
        <span className={styles.pinPreview} key={piece.id}>
          {piece.imageUrl && <img src={mediaUrl(piece.imageUrl)} alt="" />}
          <span>{piece.name}</span>
        </span>
      ))}
    </span>
  );
}
