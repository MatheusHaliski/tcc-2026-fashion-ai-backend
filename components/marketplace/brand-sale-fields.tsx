"use client";

import { Field, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import type { PhysicalStore } from "@/lib/marketplace/physical-store";
import { BrandStorePicker } from "./brand-store-picker";

export type BrandSalePlacement = { store: PhysicalStore | null; expiresOn: string };

export function BrandSaleFields({ value, onChange }: {
  value: BrandSalePlacement;
  onChange: (value: BrandSalePlacement) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3">
      <BrandStorePicker value={value.store} onChange={(store) => onChange({ ...value, store })} />
      <Field id="brand-sale-expiry" label={t("marketplace.expiry")} hint={t("marketplace.brand_sale_expiry_hint")}>
        <Input id="brand-sale-expiry" type="date" value={value.expiresOn}
          onChange={(event) => onChange({ ...value, expiresOn: event.target.value })} />
      </Field>
    </div>
  );
}
