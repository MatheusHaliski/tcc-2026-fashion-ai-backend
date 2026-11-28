"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { PhysicalStore } from "@/lib/marketplace/physical-store";
import { Field, Input, Select } from "@/components/ui";

export function BrandStorePicker({ value, onChange }: { value: PhysicalStore | null; onChange: (store: PhysicalStore | null) => void }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const result = useApi<{ stores: PhysicalStore[] }>(
    (signal) => api.get(`/api/me/marketplace/stores?name=${encodeURIComponent(search)}`, { signal }), [search],
  );
  const options = result.loading ? [] : result.data?.stores ?? [];
  return (
    <div className="grid gap-2">
      <Field id="maker-store-search" label={t("marketplace.filter_name")}>
        <Input id="maker-store-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
      </Field>
      <Field id="maker-store" label={t("marketplace.store_item")} hint={t("marketplace.store_item_hint")}>
        <Select id="maker-store" value={value?.id ?? ""} onChange={(event) => onChange(options.find((store) => store.id === event.target.value) ?? null)}>
          <option value="">{t("marketplace.no_store")}</option>
          {value && !options.some((store) => store.id === value.id) && <option value={value.id}>{value.name} · {value.city}</option>}
          {options.map((store) => <option key={store.id} value={store.id}>{store.name} · {store.city}</option>)}
        </Select>
      </Field>
    </div>
  );
}
