"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { laundryApi } from "@/lib/laundry/api";
import type { LaundryBatch, LaundryGroup, LaundryPiece } from "@/lib/laundry/types";
import { Badge, Button, EmptyState, ErrorState, Field, Input, Select, SkeletonGrid, Switch, useToast } from "@/components/ui";
import { LaundryBatches, LaundryConflicts, PieceThumb } from "./laundry-batches";

function groupLabel(group: LaundryGroup, t: (key: string, params?: Record<string, unknown>) => string) {
  const [kind, value] = group.key.split(":", 2);
  return kind === "WASH" ? t("laundry.groupByInstruction", { value }) : t("laundry.groupByMaterial", { value });
}

/** RF-PESQ-03 — quadro de lavanderia: peças usadas, sugestão de lotes por instrução/composição declarada, lotes em lavagem. */
export function LaundryBoard() {
  const { t, fmtDate } = useI18n();
  const toast = useToast();
  const board = useApi((signal) => laundryApi.board(signal), []);
  const [selected, setSelected] = useState<string[]>([]);
  const [instructionCode, setInstructionCode] = useState("");
  const [instructions, setInstructions] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const data = board.data;
  const codes = useMemo(() => Array.from(new Set((data?.worn ?? []).map((piece) => piece.washCode).filter((code): code is string => !!code))), [data]);
  async function run(action: () => Promise<unknown>, message?: string) {
    if (busy) return; setBusy(true);
    try { await action(); board.reload(); if (message) toast.success(message); }
    catch (error) { toast.fromError(error); }
    finally { setBusy(false); }
  }
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function pickGroup(group: LaundryGroup) {
    setSelected(group.pieceIds);
    const [kind, value] = group.key.split(":", 2);
    setInstructionCode(kind === "WASH" ? value : "");
  }
  async function createBatch() {
    await run(async () => {
      await laundryApi.createBatch({ pieceIds: selected, instructionCode: instructionCode || null, instructions, confirmed });
      setSelected([]); setInstructions(""); setConfirmed(false);
    }, t("laundry.batchCreated"));
  }
  if (board.error) return <ErrorState error={board.error} onRetry={board.reload} />;
  if (!data) return <SkeletonGrid n={3} h="h-24" />;
  const missing = new Set(data.missingData);
  const row = (piece: LaundryPiece, action: React.ReactNode) => <li key={piece.id} className="list-row flex items-center gap-3">
    <PieceThumb piece={piece} />
    <span className="min-w-0 flex-1"><span className="block truncate type-body-sm font-medium">{piece.name}</span>
      <span className="block type-caption text-muted">{piece.washName ?? piece.material ?? t("laundry.missingData")}{piece.changedAt ? ` · ${fmtDate(piece.changedAt)}` : ""}{!piece.disponivel ? ` · ${t("common.unavailable")}` : ""}</span></span>
    {action}
  </li>;
  return <div className="grid gap-6">
    <LaundryConflicts conflicts={data.conflicts} />
    <section className="grid gap-3" aria-labelledby="laundry-worn">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="laundry-worn" className="type-h2">{t("laundry.wornTitle")}</h2><span className="type-caption text-muted">{t("laundry.cleanCount", { count: data.clean })}</span></div>
      <p className="type-body-sm text-muted">{t("laundry.wornHint")}</p>
      {data.suggestions.length > 0 && <div className="flex flex-wrap gap-2" role="group" aria-label={t("laundry.suggestions")}>{data.suggestions.map((group) => <Button key={group.key} size="sm" onClick={() => pickGroup(group)}>{groupLabel(group, t)} ({group.pieceIds.length})</Button>)}</div>}
      {data.worn.length === 0 ? <EmptyState title={t("laundry.noWorn")} hint={t("laundry.noWornHint")} /> : <ul className="grid gap-1">{data.worn.map((piece) => row(piece, <>
        {missing.has(piece.id) && <Badge tone="mark">{t("laundry.missingData")}</Badge>}
        <label className="flex items-center gap-2 type-body-sm"><input type="checkbox" checked={selected.includes(piece.id)} onChange={() => toggle(piece.id)} aria-label={t("laundry.selectPiece", { name: piece.name })} />{t("laundry.toBatch")}</label>
        <Button size="sm" disabled={busy} onClick={() => run(() => laundryApi.clean(piece.id))}>{t("laundry.markClean")}</Button>
      </>))}</ul>}
      {selected.length > 0 && <div className="surface grid gap-3 p-4" aria-label={t("laundry.newBatch")}>
        <h3 className="type-h3">{t("laundry.newBatch")} · {t("laundry.selectedCount", { count: selected.length })}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="laundry-code" label={t("laundry.instructionCode")}><Select id="laundry-code" value={instructionCode} onChange={(event) => setInstructionCode(event.target.value)}><option value="">{t("laundry.noInstructionCode")}</option>{codes.map((code) => <option key={code} value={code}>{code}</option>)}</Select></Field>
          <Field id="laundry-notes" label={t("laundry.instructions")}><Input id="laundry-notes" maxLength={1000} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></Field>
        </div>
        {selected.some((id) => missing.has(id)) && <p className="type-caption text-muted" role="note">{t("laundry.missingInBatch")}</p>}
        <Switch id="laundry-confirm" checked={confirmed} onChange={setConfirmed} label={t("laundry.confirmBatch")} hint={t("laundry.confirmHint")} />
        <div><Button variant="primary" loading={busy} disabled={!confirmed} onClick={createBatch}>{t("laundry.sendToWash")}</Button></div>
      </div>}
    </section>
    <section className="grid gap-3" aria-labelledby="laundry-batches">
      <h2 id="laundry-batches" className="type-h2">{t("laundry.batchesTitle")}</h2>
      <LaundryBatches batches={data.batches} busy={busy} onFinish={(batch: LaundryBatch, restore) => run(() => laundryApi.finishBatch(batch.id, { expectedVersion: batch.version, restoreAvailability: restore }), t("laundry.batchFinished"))} onCancel={(batch) => run(() => laundryApi.cancelBatch(batch.id, batch.version))} />
    </section>
  </div>;
}
