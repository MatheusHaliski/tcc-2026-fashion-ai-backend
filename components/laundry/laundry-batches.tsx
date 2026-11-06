"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { mediaUrl } from "@/lib/api/client";
import type { LaundryBatch, LaundryConflict, LaundryPiece } from "@/lib/laundry/types";
import { Badge, Button, Switch } from "@/components/ui";

export function PieceThumb({ piece }: { piece: LaundryPiece }) {
  const url = mediaUrl(piece.thumbnailUrl);
  return <span className="h-10 w-10 shrink-0 overflow-hidden rounded bg-surface-2" aria-hidden>{url && <img src={url} alt="" className="h-full w-full object-cover" />}</span>;
}

/** Lotes em lavagem: concluir (com ou sem restaurar a disponibilidade) ou cancelar; as peças voltam a "usada". */
export function LaundryBatches({ batches, busy, onFinish, onCancel }: { batches: LaundryBatch[]; busy: boolean; onFinish: (batch: LaundryBatch, restore: boolean) => void; onCancel: (batch: LaundryBatch) => void }) {
  const { t, fmtDate } = useI18n();
  const [restore, setRestore] = useState<Record<string, boolean>>({});
  if (batches.length === 0) return <p className="type-body-sm text-muted">{t("laundry.noBatches")}</p>;
  return <ul className="grid gap-3">{batches.map((batch) => <li key={batch.id} className="surface grid gap-2 p-4">
    <div className="flex flex-wrap items-center gap-2"><Badge tone="thread">{t("laundry.washing")}</Badge><span className="type-caption text-muted">{t("laundry.startedAt", { date: fmtDate(batch.startedAt) })}</span>{batch.instructionCode && <Badge tone="chalk">{batch.instructionCode}</Badge>}</div>
    {batch.instructions && <p className="type-body-sm">{batch.instructions}</p>}
    <ul className="flex flex-wrap gap-2">{batch.pieces.map((piece) => <li key={piece.id} className="flex items-center gap-2 type-body-sm"><PieceThumb piece={piece} />{piece.name}</li>)}</ul>
    <Switch id={`restore-${batch.id}`} checked={restore[batch.id] ?? true} onChange={(value) => setRestore((current) => ({ ...current, [batch.id]: value }))} label={t("laundry.restoreAvailability")} hint={t("laundry.restoreHint")} />
    <div className="flex gap-2"><Button size="sm" variant="primary" disabled={busy} onClick={() => onFinish(batch, restore[batch.id] ?? true)}>{t("laundry.finish")}</Button><Button size="sm" disabled={busy} onClick={() => onCancel(batch)}>{t("laundry.cancelBatch")}</Button></div>
  </li>)}</ul>;
}

/** Looks planejados que usam peça ainda em lavagem (RF-PESQ-03 CA4). */
export function LaundryConflicts({ conflicts }: { conflicts: LaundryConflict[] }) {
  const { t, fmtDate } = useI18n();
  if (conflicts.length === 0) return null;
  return <section className="surface grid gap-1 p-4" role="status" aria-live="polite">
    <h2 className="type-h3">{t("laundry.conflictsTitle")}</h2>
    <ul className="grid gap-1 type-body-sm">{conflicts.map((conflict) => <li key={`${conflict.day}-${conflict.pieceId}`}>{t("laundry.conflict", { date: fmtDate(conflict.day), piece: conflict.pieceName ?? "", event: conflict.eventLabel ?? t("laundry.plannedLook") })}</li>)}</ul>
  </section>;
}
