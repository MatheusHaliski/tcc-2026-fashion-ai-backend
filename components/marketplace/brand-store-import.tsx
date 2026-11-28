"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { Card, Button, Field, Input, useToast } from "@/components/ui";

const example = [{ externalId: "loja-01", name: "", address: "", city: "", region: "", country: "BR" }];

export function BrandStoreImport({ onImported }: { onImported: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function importStores() {
    if (!file || busy) return;
    setBusy(true);
    try {
      const rows: unknown = JSON.parse(await file.text());
      if (!Array.isArray(rows) || !rows.length || rows.length > 2000) {
        toast.error(t("marketplace.import_invalid"));
        return;
      }
      const result = await api.post<{ processed: number }>("/api/me/marketplace/stores/import", rows);
      toast.success(t("marketplace.import_done", { n: result.processed }));
      onImported();
    } catch (error) {
      if (error instanceof SyntaxError) toast.error(t("marketplace.import_invalid"));
      else toast.fromError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4">
      <h2 className="type-h3 mb-2">{t("marketplace.import_stores")}</h2>
      <Field id="store-import-file" label={t("marketplace.import_file")} hint={t("marketplace.import_hint")}>
        <Input type="file" id="store-import-file" accept=".json,application/json" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </Field>
      <details className="my-3">
        <summary>{t("marketplace.import_example")}</summary>
        <pre className="overflow-auto">{JSON.stringify(example, null, 2)}</pre>
      </details>
      <Button size="sm" loading={busy} disabled={!file} onClick={importStores}>{t("marketplace.import_stores")}</Button>
    </Card>
  );
}
