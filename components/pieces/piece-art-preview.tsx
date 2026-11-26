"use client";
import { useState, type ReactNode } from "react";
import { CardPreviewModeToggle } from "@/components/card-preview-mode-toggle";
import { PieceCard } from "@/components/piece-card";
import { ExpandedPieceCard } from "@/components/expanded-card/expanded-piece-card";
import { PieceCardPreviewDialog } from "@/components/pieces/piece-card-preview-dialog";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * Prévia do card no editor de arte: o card do Feed ou o Ampliado (ExpandedPieceCard, o mesmo do modal do feed/closet),
 * trocados pelo botão no canto superior esquerdo do card. Sem invólucro: o card fica direto na prévia. Em modal
 * ({@code inDialog}), "Desfazer"/"Limpar arte" ficam ao lado do botão que abre a prévia e o modal mostra só o card.
 */
export function PieceArtPreview({ piece, toolbar, inDialog = false }: {
  piece: PieceView; toolbar: ReactNode; inDialog?: boolean;
}) {
  const { t } = useI18n();
  const [view, setView] = useState<"feed" | "expanded">("feed");
  const card = (
    <CardPreviewModeToggle expanded={view === "expanded"} onToggle={() => setView(current => current === "feed" ? "expanded" : "feed")} feedLabel={t("pieceArt.previa_feed")} expandedLabel={t("pieceArt.previa_ampliado")}>
      {view === "feed" ? <PieceCard piece={piece} href="#" /> : <ExpandedPieceCard piece={piece} preview />}
    </CardPreviewModeToggle>
  );
  if (inDialog) {
    return (
      <div className="pae-modal-trigger flex flex-wrap items-center gap-2">
        <PieceCardPreviewDialog title={t("pieces.new.card_preview_title")} wide={view === "expanded"}>{card}</PieceCardPreviewDialog>
        {toolbar}
      </div>
    );
  }
  return (
    <aside className="pae-preview" aria-label={view === "feed" ? t("pieceArt.previa_no_feed") : t("pieceArt.previa_ampliada")}>
      {toolbar}
      {card}
    </aside>
  );
}
