"use client";

import { useState } from "react";
import { BrandStoreImport } from "./brand-store-import";
import { StoreDirectory } from "./store-directory";
import { StorePieces } from "./store-pieces";
import styles from "./marketplace.module.css";

export function BrandMarketplaceFeed({ slug, manager }: { slug: string; manager: boolean }) {
  const [revision, setRevision] = useState(0);
  return (
    <div className={styles.directory}>
      {manager && <BrandStoreImport onImported={() => setRevision((value) => value + 1)} />}
      <StoreDirectory brandProfile={slug} key={revision} />
      <StorePieces brandProfile={slug} />
    </div>
  );
}
