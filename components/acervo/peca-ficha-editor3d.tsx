"use client";
/**
 * ACERVO — aba "Editor 3D" da ficha. Mostra a situação do modelo 3D da peça (aprovado, vitrine ou em quarentena), o
 * que a personalização guarda e leva ao editor da peça (/pieces/{id}/editor-3d), que já existe. O ACERVO não tem um
 * editor próprio: a personalização é a mesma, por pessoa, e nunca altera o modelo original, as medidas oficiais, os
 * tamanhos comerciais ou o passaporte.
 */
import Link from "next/link";
import { ErrorState, Skeleton } from "@/components/ui";
import { PieceEditorBadges } from "@/components/piece3d/piece-editor-toolbar";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { customizationApi } from "@/lib/piece3d/customization";

export function PecaFichaEditor3d({ pieceId }: { pieceId: string }) {
  const { t, fmtDateTime } = useI18n();
  const consulta = useApi((signal) => customizationApi.get(pieceId, signal), [pieceId]);
  if (consulta.error) return <ErrorState error={consulta.error} onRetry={consulta.reload} />;
  const info = consulta.data;
  if (!info) return <Skeleton className="h-32" />;
  const temModelo = info.modelAvailable && !!info.baseModelUrl;

  return (
    <section className="acv-editor3d" aria-label={t("acervo.integracoes.editor3d")} data-testid="acervo-editor3d">
      {!temModelo && <p className="acv-ficha-aviso" role="status">{t("editor3d.noModel")}</p>}
      {temModelo && <PieceEditorBadges info={info} />}
      {temModelo && !info.tryOnApproved && <p className="acv-dica">{t("sheet.notApprovedForTryOn")}</p>}
      {temModelo && (
        <ul className="acv-editor3d-lista">
          <li>{t(info.savedAt ? "acervo.editor3d.salva" : "acervo.editor3d.semPersonalizacao", { data: info.savedAt ? fmtDateTime(info.savedAt) : "" })}</li>
          <li>{t("acervo.editor3d.original")}</li>
          <li><span className="acv-selo">{t("acervo.editor3d.ajusteVisual")}</span> {t("editor3d.scaleNote")}</li>
        </ul>
      )}
      {temModelo && (
        <Link href={`/pieces/${encodeURIComponent(pieceId)}/editor-3d`} className="btn btn-primary btn-sm">
          {t(info.editable ? "sheet.openEditor" : "acervo.editor3d.verModelo")}
        </Link>
      )}
    </section>
  );
}
