"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import type { TipoLook } from "@/lib/api/types";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { ErrorState, Field, Select, Skeleton, useNotice } from "@/components/ui";

type Preference = { tipoLook: TipoLook | null };

export function LookTypePreference() {
  const { t } = useI18n();
  const notice = useNotice();
  const [busy, setBusy] = useState(false);
  const types = useApi<TipoLook[]>((signal) => api.get("/api/tipos-look", { signal }), []);
  const preference = useApi<Preference>((signal) => api.get("/api/me/preferences/tipo-look", { signal }), []);

  async function save(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      preference.setData(await api.put<Preference>("/api/me/preferences/tipo-look", { tipoLookId: id || null }));
      notice.success(t("settings.saved"));
    } catch (error) {
      notice.fromError(error);
    } finally {
      setBusy(false);
    }
  }

  if (types.loading || preference.loading) return <Skeleton className="h-16" />;
  if (types.error || preference.error) return <ErrorState error={types.error || preference.error} onRetry={() => { types.reload(); preference.reload(); }} />;
  return (
    <Field id="default-tipo-look" label={t("settings.autoLookType")} hint={t("settings.autoLookTypeHint")}>
      <Select id="default-tipo-look" value={preference.data?.tipoLook?.id ?? ""} disabled={busy} onChange={(e) => void save(e.target.value)}>
        <option value="">{t("settings.autoLookTypeOff")}</option>
        {(types.data ?? []).map((type) => <option key={type.id} value={type.id}>{type.nome}</option>)}
      </Select>
    </Field>
  );
}
