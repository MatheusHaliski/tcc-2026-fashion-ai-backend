"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui";
import { StorePieces } from "@/components/marketplace/store-pieces";
import { StoreDirectory } from "@/components/marketplace/store-directory";
import styles from "@/components/marketplace/marketplace.module.css";
import { useI18n } from "@/lib/i18n/i18n";

export default function FlairMarketplacePage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"directory" | "products">("directory");
  return (
    <>
      <header className={styles.hero}>
        <h1 className="type-h1">{t("nav.flair")}</h1>
        <p className="type-body text-muted">{t("marketplace.description")}</p>
      </header>
      <Tabs tabs={[{ id: "directory", label: t("marketplace.physical_stores") }, { id: "products", label: t("marketplace.retail_feed") }]}
        value={tab} onChange={setTab} />
      {tab === "directory" ? <StoreDirectory /> : <StorePieces retail />}
    </>
  );
}
