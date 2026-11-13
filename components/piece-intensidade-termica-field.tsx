"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { ReferenceOption } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Field, Select } from "@/components/ui";

/** Intensidade térmica (tabela intensidade_termica): o valor é o UUID da opção, gravado como FK na peça ou no look. */
export function PieceIntensidadeTermicaField({ value, selectedName, onChange, error, disabled = false, hint }: {
  value: string; selectedName?: string | null; onChange: (id: string) => void; error?: string; disabled?: boolean;
  /** texto de ajuda; null esconde (no look o contexto já explica) */ hint?: string | null;
}) {
  const { t } = useI18n();
  const [options, setOptions] = useState<ReferenceOption[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    api.get<ReferenceOption[]>("/api/intensidades-termicas", { signal: controller.signal, anonymous: true })
      .then(rows => { if (!controller.signal.aborted) { setOptions(rows); setStatus("ready"); } })
      .catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, [attempt]);
  const unavailable = !!value && !options.some(option => option.id === value);
  return <div data-intensidade-state={status} aria-busy={status === "loading"} className="sm:col-span-2">
    <Field id="intensidadeTermicaId" label={t("pieceReferences.intensidade.label")} error={error}>
      <Select id="intensidadeTermicaId" value={value} onChange={e => onChange(e.target.value)} error={!!error}
        disabled={disabled || status !== "ready" || options.length === 0} loading={status === "loading"}>
        <option value="">{t("pieceReferences.intensidade.unselected")}</option>
        {unavailable && <option value={value} disabled>{selectedName || t("pieceReferences.intensidade.unavailable")}</option>}
        {options.map(option => <option key={option.id} value={option.id}>{option.nome}</option>)}
      </Select>
      {status === "loading" && <p role="status" className="help">{t("common.loading")}</p>}
      {status === "error" && <div role="alert" className="mt-2 flex items-center gap-2">
        <span className="error-text">{t("pieceReferences.intensidade.loadError")}</span>
        <Button type="button" disabled={disabled} onClick={() => setAttempt(n => n + 1)}>{t("common.retry")}</Button>
      </div>}
      {status === "ready" && options.length === 0 && <p role="status" className="help">{t("pieceReferences.intensidade.empty")}</p>}
      {hint !== null && <p className="help">{hint ?? t("pieceReferences.intensidade.hint")}</p>}
    </Field>
  </div>;
}
