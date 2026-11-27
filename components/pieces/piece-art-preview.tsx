"use client";
import { useState, type ReactNode } from "react";
import { CardPreviewModeToggle, type CardPreviewMode } from "@/components/card-preview-mode-toggle";
import { PieceCard } from "@/components/piece-card";
import { ExpandedPieceCard } from "@/components/expanded-card/expanded-piece-card";
import { PieceCardPreviewDialog } from "@/components/pieces/piece-card-preview-dialog";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";

export type PiecePreviewPlacement = "inline" | "dialog";

type PieceArtPreviewProps = {
  piece: PieceView;
  toolbar: ReactNode;
  placement: PiecePreviewPlacement;
};

/** O formato do card pode mudar tanto na prévia ao lado do editor quanto na prévia em diálogo. */
export function PieceArtPreview({ piece, toolbar, placement }: PieceArtPreviewProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<CardPreviewMode>("feed");
  const card = (
    <CardPreviewModeToggle mode={mode} onModeChange={setMode} feedLabel={t("pieceArt.previa_feed")} expandedLabel={t("pieceArt.previa_ampliado")}>
      {mode === "feed" ? <PieceCard piece={piece} mode="preview" /> : <ExpandedPieceCard piece={piece} context="preview" />}
    </CardPreviewModeToggle>
  );
  if (placement === "dialog") {
    return (
      <div className="pae-modal-trigger flex flex-wrap items-center gap-2">
        <PieceCardPreviewDialog title={t("pieces.new.card_preview_title")} mode={mode}>{card}</PieceCardPreviewDialog>
        {toolbar}
      </div>
    );
  }
  return (
    <aside className="pae-preview" aria-label={mode === "feed" ? t("pieceArt.previa_no_feed") : t("pieceArt.previa_ampliada")}>
      {toolbar}
      {card}
    </aside>
  );
}
