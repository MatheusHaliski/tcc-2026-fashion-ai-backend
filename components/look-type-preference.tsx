"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import type { TipoLook } from "@/lib/api/types";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { ErrorState, Field, Select, Skeleton, Switch, useNotice } from "@/components/ui";

export type LookTypePreferenceData = { tipoLook: TipoLook | null };

/**
 * Perfil: botão "Tipo Look automático". Ligado, o tipo escolhido aqui entra sozinho nas novas peças e looks, e o
 * criador não pede mais esse campo; desligado (tipoLookId nulo), o criador volta a perguntar.
 */
export function LookTypePreference() {
  const { t } = useI18n();
  const notice = useNotice();
  const [busy, setBusy] = useState(false);
  const types = useApi<TipoLook[]>((signal) => api.get("/api/tipos-look", { signal }), []);
  const preference = useApi<LookTypePreferenceData>((signal) => api.get("/api/me/preferences/tipo-look", { signal }), []);

  async function save(id: string | null) {
    if (busy) return;
    setBusy(true);
    try {
      preference.setData(await api.put<LookTypePreferenceData>("/api/me/preferences/tipo-look", { tipoLookId: id }));
      notice.success(t("settings.saved"));
    } catch (error) {
      notice.fromError(error);
    } finally {
      setBusy(false);
    }
  }

  if (types.loading || preference.loading) return <Skeleton className="h-16" />;
  if (types.error || preference.error) return <ErrorState error={types.error || preference.error} onRetry={() => { types.reload(); preference.reload(); }} />;
  const current = preference.data?.tipoLook ?? null;
  const first = types.data?.[0]?.id ?? null;
  return (
    <div className="grid gap-2">
      <Switch id="auto-tipo-look" label={t("settings.autoLookType")} hint={t("settings.autoLookTypeHint")} checked={!!current}
        disabled={busy || (!current && !first)} onChange={(on) => void save(on ? first : null)} />
      {current && <Field id="default-tipo-look" label={t("settings.autoLookTypeChoose")}>
        <Select id="default-tipo-look" value={current.id} disabled={busy} onChange={(e) => void save(e.target.value)}>
          {(types.data ?? []).map((type) => <option key={type.id} value={type.id}>{type.nome}</option>)}
        </Select>
      </Field>}
    </div>
  );
}
