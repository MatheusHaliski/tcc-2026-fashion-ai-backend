"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { PiecePreviewDialog } from "@/components/pieces/piece-preview-dialog";
import { CardPreviewModeToggle } from "@/components/card-preview-mode-toggle";
import { SchemeCard } from "@/components/scheme-card";
import { LookHypePreview } from "@/components/hype/look-hype-preview";
import { InsightStrip } from "@/components/insights/insight-strip";
import type { SchemeView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * Prévia ao vivo do look no criador: em telas largas fica num painel lateral fixo ao lado de TODAS as etapas, para a
 * pessoa ver na hora o efeito de layout, cor do container, aura, borda e cor dos textos; em telas estreitas
 * ({@code inDialog}), abre num modal pelo botão "Ver prévia do card".
 */
export function SchemeBuilderPreview({ draft, canClear, undo, onClear, schemeId, inDialog = false }: {
  draft: SchemeView;
  /** há arte ou layout com arte própria para limpar */
  canClear: boolean;
  undo: { canUndo: boolean; undo: () => void };
  onClear: () => void;
  schemeId: string | null;
  inDialog?: boolean;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const pieceIds = draft.items.map((item) => item.wardrobeItemId);
  const body = (
    <>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="label mb-0">{t("scheme.card")}</p>
        <span className="flex gap-1">
          <Button size="sm" title={t("backgroundStudio.desfazer_dica")} disabled={!undo.canUndo} onClick={undo.undo}>{t("backgroundStudio.desfazer")}</Button>
          <Button size="sm" title={t("backgroundStudio.limpar_arte_dica")} disabled={!canClear} onClick={onClear}>{t("backgroundStudio.limpar_arte")}</Button>
        </span>
      </div>
      <CardPreviewModeToggle expanded={expanded} onToggle={() => setExpanded((current) => !current)} feedLabel={t("pieceArt.previa_feed")} expandedLabel={t("pieceArt.previa_ampliado")}>
        <SchemeCard scheme={draft} href="#" expanded={expanded} />
      </CardPreviewModeToggle>
      <LookHypePreview pieceIds={pieceIds} occasion={draft.occasion} style={draft.style} schemeId={schemeId} />
      <InsightStrip context="LOOK_EDITOR" params={{ pieces: [...pieceIds].sort().join(",") }} collapsible className="mt-3" />
    </>
  );
  if (inDialog) {
    return <PiecePreviewDialog title={t("scheme.card")}><div aria-label={t("common.pre_visualizacao")} className="card-preview">{body}</div></PiecePreviewDialog>;
  }
  return <aside aria-label={t("common.pre_visualizacao")} className="card-preview scheme-builder-aside hidden lg:block">{body}</aside>;
}
