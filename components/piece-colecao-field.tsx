"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { ReferenceOption } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Field, Select } from "@/components/ui";

/** Values are database UUIDs, never labels or the default legacy GOOD enum. */
export function PieceColecaoField({ value, selectedName, onChange, error, disabled = false }: {
  value: string; selectedName?: string | null; onChange: (id: string) => void; error?: string; disabled?: boolean;
}) {
  const { t } = useI18n();
  const [options, setOptions] = useState<ReferenceOption[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    api.get<ReferenceOption[]>("/api/colecoes", { signal: controller.signal, anonymous: true })
  .then(rows => { if (!controller.signal.aborted) { setOptions(rows); setStatus("ready"); } })
  .catch(() => { if (!controller.signal.aborted) setStatus("error"); });
      .catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, [attempt]);
  const unavailable = !!value && !options.some(option => option.id === value);
  return <div data-colecao-state={status} aria-busy={status === "loading"} className="sm:col-span-2">
    <Field id="colecaoId" label={t("pieceReferences.colecao.label")} error={error}>
      <Select id="colecaoId" value={value} onChange={e => onChange(e.target.value)} error={!!error}
        disabled={disabled || status !== "ready" || options.length === 0} loading={status === "loading"}>
        <option value="">{t("pieceReferences.colecao.unselected")}</option>
        {unavailable && <option value={value} disabled>{selectedName || t("pieceReferences.colecao.unavailable")}</option>}
        {options.map(option => <option key={option.id} value={option.id}>{option.nome}</option>)}
      </Select>
      {status === "loading" && <p role="status" className="help">{t("common.loading")}</p>}
      {status === "error" && <div role="alert" className="mt-2 flex items-center gap-2">
        <span className="error-text">{t("pieceReferences.colecao.loadError")}</span>
        <Button type="button" disabled={disabled} onClick={() => setAttempt(n => n + 1)}>{t("common.retry")}</Button>
      </div>}
      {status === "ready" && options.length === 0 && <p role="status" className="help">{t("pieceReferences.colecao.empty")}</p>}
      <p className="help">{t("pieceReferences.colecao.hint")}</p>
    </Field>
  </div>;
}
