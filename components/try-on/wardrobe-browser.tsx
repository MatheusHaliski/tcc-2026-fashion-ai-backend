"use client";

import Link from "next/link";
import { Card, cn } from "@/components/ui";
import { mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { FITTING_SLOTS, type FittingItem, type FittingSlot } from "@/lib/tryon/fitting-room";
import type { Entry } from "@/lib/tryon/fitting-room-model";

export interface WardrobeBrowserProps {
  pieces: Record<FittingSlot, Entry[]>;
  needsReview?: { piece: PieceView }[];
  items: FittingItem[];
  slotNames: Record<FittingSlot, string>;
  onRemove: (slot: FittingSlot) => void;
  onTryOnEntry: (entry: Entry) => void;
}

/** Arara do guarda-roupa; as ações de vestir pertencem ao coordenador do provador. */
export function WardrobeBrowser({
  pieces, needsReview, items, slotNames, onRemove, onTryOnEntry,
}: WardrobeBrowserProps) {
  const { t } = useI18n();
  const wardrobeCount = FITTING_SLOTS.reduce((count, slot) => count + (pieces?.[slot]?.length ?? 0), 0);

  return (
    <Card>
      <p className="mb-3 type-caption text-muted">{t("tryOn.combinar_guarda_roupa_dica")}</p>
      {!!needsReview?.length && (
        <div role="status" className="mb-3">
          <p>{t("tryOn.category_review")}</p>
          {needsReview.map(({ piece }) => (
            <Link key={piece.id} href={`/pieces/${piece.id}`} className="block underline">
              {piece.name}
            </Link>
          ))}
        </div>
      )}

      {wardrobeCount === 0 ? (
        <p className="type-body-sm">
          {t("tryOn.guarda_roupa_vazio")}{" "}
          <Link href="/pieces/new" className="underline">{t("common.cadastrar_peca")}</Link>
        </p>
      ) : FITTING_SLOTS.map((slot) => {
        const entries = pieces?.[slot] ?? [];
        if (!entries.length) return null;

        return (
          <section key={slot} className="mb-3" aria-label={t("tryOn.guarda_roupa_lugar", { slot: slotNames[slot] })}>
            <h3 className="type-body-sm font-medium mb-1.5">
              {slotNames[slot]} <span className="type-caption text-muted">· {entries.length}</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {entries.map((entry) => {
                const worn = items.some((item) => item.key === `w:${entry.piece.id}`);
                return (
                  <button
                    key={entry.piece.id}
                    type="button"
                    aria-pressed={worn}
                    onClick={() => worn ? onRemove(slot) : onTryOnEntry(entry)}
                    className={cn("tryon-rack-item", worn && "is-worn")}
                  >
                    <img
                      src={mediaUrl(entry.piece.thumbnailUrl ?? entry.piece.imageUrl) ?? undefined}
                      alt=""
                      className="aspect-square w-full object-contain"
                      draggable={false}
                    />
                    <span className="block truncate type-caption">{entry.piece.name}</span>
                    {worn && <span className="tryon-worn-flag">{t("tryOn.vestida")}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </Card>
  );
}
