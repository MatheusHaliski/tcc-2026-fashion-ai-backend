"use client";
import { useState, type ReactNode } from "react";
import { CardPreviewModeToggle } from "@/components/card-preview-mode-toggle";
import { PieceCard } from "@/components/piece-card";
import { ExpandedPieceCard } from "@/components/expanded-card/expanded-piece-card";
import { PiecePreviewDialog } from "@/components/pieces/piece-preview-dialog";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";

export function PieceArtPreview({ piece, toolbar, inDialog = false }: {
  piece: PieceView; toolbar: ReactNode; inDialog?: boolean;
}) {
  const { t } = useI18n();
  const [view, setView] = useState<"feed" | "expanded">("feed");
  const content = (
    <aside className={inDialog ? "grid gap-2" : "pae-preview"} aria-label={view === "feed" ? t("pieceArt.previa_no_feed") : t("pieceArt.previa_ampliada")}>
      {toolbar}
      <CardPreviewModeToggle expanded={view === "expanded"} onToggle={() => setView(current => current === "feed" ? "expanded" : "feed")} feedLabel={t("pieceArt.previa_feed")} expandedLabel={t("pieceArt.previa_ampliado")}>
        {view === "feed"
          ? <div className="pae-preview-card"><PieceCard piece={piece} href="#" /></div>
          : <div className="pae-expanded-card" aria-label={t("pieceArt.previa_ampliada")}><ExpandedPieceCard piece={piece} preview /></div>}
      </CardPreviewModeToggle>
      <p className="type-caption text-muted">{t("pieceArt.camadas_legenda")}</p>
    </aside>
  );
  return inDialog
    ? <div className="pae-modal-trigger"><PiecePreviewDialog title={t("pieces.new.card_preview_title")}>{content}</PiecePreviewDialog></div>
    : content;
}
