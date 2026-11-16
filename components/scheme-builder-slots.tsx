"use client";
import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { PieceHypeTag } from "@/components/hype/look-hype-preview";
import { mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * Marca do slot: o esquema não tem campo de marca — ao inserir a peça do guarda-roupa no slot, a marca (nome + logo
 * buscado na internet no RF4) vem da própria peça e não é editável aqui.
 */
export function SlotBrand({ piece }: { piece?: PieceView | null }) {
  const { t } = useI18n();
  if (!piece) return null;
  return piece.brandName
    ? <span className="slot-brand" title={t("schemeBuilder.marca_preenchida_automaticamente_pela")}><BrandLogo name={piece.brandName} src={piece.brandLogoUrl} size={22} /><span className="truncate">{piece.brandName}</span><span className="sr-only">{t("schemeBuilder.preenchida_pela_peca")}</span></span>
    : <span className="slot-brand text-muted" title={t("schemeBuilder.a_peca_nao_tem_marca")}>{t("schemeBuilder.sem_marca_na_peca")}</span>;
}

export function SchemeBuilderSlots({ selected, byId, slotLabels, onRemove, onMove }: {
  selected: { id: string; slot: string }[];
  byId: Map<string, PieceView>;
  slotLabels: Record<string, string>;
  onRemove: (id: string) => void;
  onMove: (id: string, targetId: string) => void;
}) {
  const { t } = useI18n();
  const [dragged, setDragged] = useState<string | null>(null);
  if (!selected.length) return null;
  return (
    <section className="surface mb-4 p-3" aria-label={t("schemeBuilder.slots_do_look")}>
      <p className="label">{t("schemeBuilder.slots_do_look_a_marca")}</p>
      <div className="grid gap-2">
        {selected.map((item, index) => {
          const piece = byId.get(item.id);
          const name = piece?.name ?? item.id;
          return <div key={item.id} draggable onDragStart={() => setDragged(item.id)} onDragEnd={() => setDragged(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (dragged) onMove(dragged, item.id); setDragged(null); }} className={`list-row flex min-w-0 items-center gap-2 ${dragged === item.id ? "opacity-50" : ""}`}>
            <span aria-hidden className="cursor-grab text-muted">⠿</span><span className="badge shrink-0">{slotLabels[item.slot] ?? item.slot}</span><img src={mediaUrl(piece?.thumbnailUrl ?? piece?.imageUrl)} alt="" className="h-9 w-9 shrink-0 rounded bg-surface-2 object-contain" />
            <span className="min-w-0 flex-1"><span className="block truncate type-body-sm">{name}</span><PieceHypeTag id={item.id} /><SlotBrand piece={piece} /></span>
            <span className="flex shrink-0 gap-1"><button type="button" className="btn btn-ghost btn-icon" disabled={index === 0} onClick={() => onMove(item.id, selected[index - 1].id)} aria-label={t("schemeBuilder.move_up", { name })}>↑</button><button type="button" className="btn btn-ghost btn-icon" disabled={index === selected.length - 1} onClick={() => onMove(item.id, selected[index + 1].id)} aria-label={t("schemeBuilder.move_down", { name })}>↓</button><button type="button" className="btn btn-ghost btn-icon" onClick={() => onRemove(item.id)} aria-label={t("schemeBuilder.remove_piece", { name })}>✕</button></span>
          </div>;
        })}
      </div>
      <p className="mt-2 type-caption text-muted">{t("schemeBuilder.reorder_help")} {t("schemeBuilder.uma_peca_por_tipo")}</p>
    </section>
  );
}
