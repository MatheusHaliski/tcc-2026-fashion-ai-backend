"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { Card, Button, Field, Input, Select, useToast } from "@/components/ui";
import { StoreSalesPanel } from "./store-sales-panel";

export function StoreInventoryManager({ storeId, slug, onChange }: {
  storeId: string;
  slug: string | null;
  onChange: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const profile = useApi<{ header?: { userId?: string }; user?: { id?: string } }>(
    (signal) => api.get(`/api/institutional/${encodeURIComponent(slug ?? "")}`, { signal }),
    [slug, user?.id], { enabled: !!slug && user?.profileType === "MARCA" },
  );
  const owner = !!user && (profile.data?.header?.userId ?? profile.data?.user?.id) === user.id;
  const pieces = useApi<{ items: PieceView[] }>(
    (signal) => api.get(`/api/me/closet?size=60&q=${encodeURIComponent(search)}`, { signal }),
    [search], { enabled: owner },
  );

  async function save(listed: boolean) {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await api.put(`/api/me/marketplace/stores/${storeId}/pieces/${selected}`, { listed });
      onChange();
      toast.success(t("common.saved"));
    } catch (error) {
      toast.fromError(error);
    } finally {
      setBusy(false);
    }
  }

  if (!owner) return null;
  return (
    <>
    <Card className="mb-4 grid gap-3">
      <h2 className="type-h3">{t("marketplace.manage_inventory")}</h2>
      <Field id="market-inventory-search" label={t("common.search")}>
        <Input id="market-inventory-search" type="search" value={search} onChange={(event) => {
          setSearch(event.target.value);
          setSelected("");
        }} />
      </Field>
      <Field id="market-inventory-piece" label={t("marketplace.neg_piece")}>
        <Select id="market-inventory-piece" value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">{t("marketplace.neg_choose")}</option>
          {!pieces.loading && pieces.data?.items.filter((piece) => piece.visibility === "PUBLIC" && piece.moderationStatus === "APPROVED")
            .map((piece) => <option value={piece.id} key={piece.id}>{piece.name}</option>)}
        </Select>
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" disabled={!selected || busy} onClick={() => void save(true)}>{t("marketplace.inventory_add")}</Button>
        <Button size="sm" disabled={!selected || busy} onClick={() => void save(false)}>{t("marketplace.inventory_remove")}</Button>
      </div>
    </Card>
    <StoreSalesPanel storeId={storeId} onSale={onChange} />
    </>
  );
}
