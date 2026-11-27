"use client";
import { PieceCard } from "@/components/piece-card";
import { PhotoFramingToggle } from "@/components/photo-framing-toggle";
import { PiecePreviewDialog } from "@/components/pieces/piece-preview-dialog";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import type { PhotoFraming } from "@/lib/photo-framing";

/**
 * Prévia ao vivo do card no criador de peça. Em telas largas ({@code aside}) fica num painel fixo à direita de todas as
 * etapas, para a pessoa ver o card mudar enquanto preenche; em telas estreitas abre num modal pelo botão.
 */
export function PieceCreationPreview({ piece, framing, onFramingChange, showPostPreview, sharedBy, aside = false }: {
  piece: PieceView; framing: PhotoFraming; onFramingChange: (value: PhotoFraming) => void; showPostPreview: boolean; sharedBy?: string; aside?: boolean;
}) {
  const { t } = useI18n();
  const title = showPostPreview ? t("interactions.post_preview") : t("pieces.new.card_preview_title");
  const body = (
    <div className="card-preview">
      <PhotoFramingToggle className="mb-3" value={framing} onChange={onFramingChange} />
      <PieceCard piece={piece} mode="preview" extra={sharedBy ? <span className="caption">{t("feed.shared_by", { username: sharedBy })}</span> : undefined} />
    </div>
  );
  if (aside) return <aside className="piece-create-aside" aria-label={title}><p className="label">{title}</p>{body}</aside>;
  return <div className="mt-4"><PiecePreviewDialog title={title}>{body}</PiecePreviewDialog></div>;
}
