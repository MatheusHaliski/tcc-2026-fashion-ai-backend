"use client";
import { PieceCard } from "@/components/piece-card";
import { PhotoFramingToggle } from "@/components/photo-framing-toggle";
import { PiecePreviewDialog } from "@/components/pieces/piece-preview-dialog";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import type { PhotoFraming } from "@/lib/photo-framing";

export function PieceCreationPreview({ piece, framing, onFramingChange, showPostPreview, sharedBy }: {
  piece: PieceView; framing: PhotoFraming; onFramingChange: (value: PhotoFraming) => void; showPostPreview: boolean; sharedBy?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="mt-4">
      <PiecePreviewDialog title={showPostPreview ? t("interactions.post_preview") : t("pieces.new.card_preview_title")}>
        <div className="card-preview">
          <PhotoFramingToggle className="mb-3" value={framing} onChange={onFramingChange} />
          <PieceCard piece={piece} href="#" extra={sharedBy ? <span className="caption">{t("feed.shared_by", { username: sharedBy })}</span> : undefined} />
        </div>
      </PiecePreviewDialog>
    </div>
  );
}
