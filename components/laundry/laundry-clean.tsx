"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import type { LaundryPiece } from "@/lib/laundry/types";
import { Button } from "@/components/ui";

/**
 * Peças limpas, com o botão "Marcar como usada": o caminho que faltava para começar o ciclo na própria Lavanderia
 * (sem peça usada não dava para montar lote). As peças do Look do Dia entram em "Peças usadas" sozinhas.
 */
export function LaundryClean({ pieces, row, busy, onWorn }: {
  pieces: LaundryPiece[];
  row: (piece: LaundryPiece, action: ReactNode) => ReactNode;
  busy: boolean;
  onWorn: (piece: LaundryPiece) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="grid gap-3" aria-labelledby="laundry-clean">
      <h2 id="laundry-clean" className="type-h2">{t("laundry.cleanTitle")}</h2>
      <p className="type-body-sm text-muted">{t("laundry.cleanHint")}</p>
      {pieces.length === 0
        ? <p className="type-body-sm text-muted">{t("laundry.noClean")}</p>
        : <ul className="grid gap-1">{pieces.map((piece) => row(piece,
          <Button size="sm" disabled={busy} aria-label={t("laundry.markWornAria", { name: piece.name })} onClick={() => onWorn(piece)}>{t("laundry.markWorn")}</Button>))}</ul>}
    </section>
  );
}
