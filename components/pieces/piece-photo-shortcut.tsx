"use client";
import { Badge, Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";

/** Criador de peça (modo catálogo): atalho para a aba Fotografar — a foto é opcional. */
export function PiecePhotoShortcut({ onPhotos }: { onPhotos: () => void }) {
  const { t } = useI18n();
  return (
    <section className="creator-section" aria-labelledby="piece-photo-label">
      <div className="mb-2 flex flex-wrap items-center gap-2"><h2 id="piece-photo-label" className="type-h3">{t("pieces.new.foto_opcional")}</h2><Badge tone="chalk">{t("common.optional")}</Badge></div>
      <p className="mb-2 type-body-sm text-muted">{t("pieces.new.prefere_fotografar")}</p>
      <Button size="sm" onClick={onPhotos}>{t("pieces.new.modo_fotos")}</Button>
    </section>
  );
}
