import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import type { PhysicalStore } from "@/lib/marketplace/physical-store";
import styles from "./marketplace.module.css";

export function StoreCard({ store }: { store: PhysicalStore }) {
  const { t } = useI18n();
  return (
    <article className={styles.store}>
      <Link href={`/flair/lojas/${store.id}`} className={styles.storeImage} tabIndex={-1} aria-hidden="true">
        {store.imageUrl ? <img src={mediaUrl(store.imageUrl)} alt="" loading="lazy" /> :
          <BrandLogo name={store.brand} src={store.brandLogoUrl ?? undefined} size={86} />}
      </Link>
      <div className={styles.storeBody}>
        <p className={styles.meta}>{store.brand} · {store.city}, {store.region}</p>
        <h3>{store.name}</h3>
        <p>{store.address}</p>
        {store.floor && <p>{t("marketplace.floor", { floor: store.floor })}</p>}
        <Link className="btn btn-sm" href={`/flair/lojas/${store.id}`}>{t("marketplace.explore_store")}</Link>
      </div>
    </article>
  );
}
