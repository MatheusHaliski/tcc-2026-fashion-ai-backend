"use client";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Dialog, Field, Input, useToast } from "@/components/ui";

const FIELDS = ["title", "description", "occasion", "style", "season", "mood", "visibility"] as const;
type EditableField = typeof FIELDS[number];
interface FieldChange { field: EditableField; current?: unknown; proposed: string | string[]; reason?: string }
interface Improvement { changes: FieldChange[]; message?: string; explanation?: string }

function readImprovement(value: unknown): Improvement {
  const result = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const changes = (Array.isArray(result.changes) ? result.changes : []).filter((v): v is FieldChange => {
    if (!v || typeof v !== "object" || !FIELDS.includes(v.field)) return false;
    if (v.field === "occasion" || v.field === "style") return Array.isArray(v.proposed) && v.proposed.length <= 3 && v.proposed.every((x: unknown) => typeof x === "string" && x.trim());
    return typeof v.proposed === "string" && !!v.proposed.trim();
  });
  return { changes, message: typeof result.message === "string" ? result.message : undefined, explanation: typeof result.explanation === "string" ? result.explanation : undefined };
}
const displayValue = (value: unknown): string => value == null || value === "" ? "—" : Array.isArray(value) ? value.join(", ") || "—" : String(value);

/** The API returns changes, but apply accepts only { editableField: proposedValue }. */
export function SchemeImprovementDialog({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n(); const toast = useToast();
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState<Improvement | null>(null);
  const [selected, setSelected] = useState<Partial<Record<EditableField, number>>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const formId = useId(), instructionId = useId();
  useEffect(() => () => request.current?.abort(), []);
  const selectedCount = Object.keys(selected).length;
  async function generate() {
    if (!instruction.trim() || busy) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(null);
    try {
      const next = await api.post<unknown>(`/api/schemes/${id}/improvements`, { instruction: instruction.trim() }, { signal: controller.signal });
      if (!controller.signal.aborted) { setResult(readImprovement(next)); setSelected({}); }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : t("scheme.improvement.error")); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function apply() {
    if (!result || !selectedCount || busy) return;
    const accepted = Object.fromEntries(Object.entries(selected).map(([field, index]) => [field, result.changes[index!].proposed]));
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(null);
    try {
      await api.post(`/api/schemes/${id}/improvements/apply`, accepted, { signal: controller.signal });
      if (!controller.signal.aborted) { toast.success(t("common.saved")); onSaved(); onClose(); }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : t("scheme.improvement.error")); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <Dialog open onClose={onClose} title={t("scheme.improve")} footer={result ? <>
    <Button disabled={busy} onClick={() => { setResult(null); setSelected({}); setError(null); }}>{t("scheme.improvement.revise")}</Button>
    <Button variant="primary" onClick={apply} loading={busy} disabled={!selectedCount}>{t("dashboard.apply")}</Button>
  </> : <Button variant="primary" type="submit" form={formId} loading={busy} disabled={!instruction.trim()}>{t("scheme.generate")}</Button>}>
    {error && <p role="alert" className="type-body mb-3">{error}</p>}
    {!result ? <form id={formId} onSubmit={e => { e.preventDefault(); void generate(); }}>
      <Field label={t("scheme.instruction")} id={instructionId}><Input id={instructionId} maxLength={500} value={instruction} onChange={e => setInstruction(e.target.value)} placeholder={t("scheme.improvement.instructionPlaceholder")} disabled={busy} /></Field>
    </form> : <div className="type-body">
      {(result.message || result.explanation) && <p className="mb-3 text-muted">{result.message || result.explanation}</p>}
      {!result.changes.length ? <p role="status">{t("scheme.improvement.empty")}</p> : <fieldset disabled={busy} className="grid gap-3">
        <legend className="type-body mb-3">{t("scheme.improvement.select")}</legend>
        {result.changes.map((change, index) => <label key={`${change.field}-${index}`} className="list-row flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1" checked={selected[change.field] === index} onChange={e => setSelected(previous => {
            const next = { ...previous }; if (e.target.checked) next[change.field] = index; else delete next[change.field]; return next;
          })} />
          <span className="min-w-0 flex-1"><b>{t(`scheme.improvement.field.${change.field}`)}</b>
            <span className="block type-caption text-muted">{t("scheme.improvement.current")}: {displayValue(change.current)}</span>
            <span className="block">{t("scheme.improvement.proposed")}: {displayValue(change.proposed)}</span>
            {typeof change.reason === "string" && change.reason && <span className="block type-caption text-muted">{change.reason}</span>}
          </span>
        </label>)}
      </fieldset>}
    </div>}
  </Dialog>;
}
