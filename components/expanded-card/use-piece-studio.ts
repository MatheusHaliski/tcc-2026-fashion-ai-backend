"use client";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useToast } from "@/components/ui";
import { studioVersion } from "@/components/edit-image";

/**
 * Foto de estúdio da peça na página ampliada: gerar a versão de estúdio e aprovar ou descartar a que espera revisão.
 * Com uma foto aprovada no ar, a nova versão espera a aprovação (nada troca no feed sozinho).
 */
export function usePieceStudio(id: string, setPiece: (piece: PieceView) => void) {
  const { t } = useI18n();
  const toast = useToast();
  const [studioBusy, setStudioBusy] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState(false);

  async function studioShot(backdrop: string) {
    setStudioBusy(true);
    try {
      const np = await api.post<PieceView>(`/api/pieces/${id}/studio?backdrop=${encodeURIComponent(backdrop)}`);
      setPiece(np);
      if (studioVersion(np).pending) toast.info(t("editImage.nova_para_revisar"));
      else toast.success(t("pieces.id.foto_de_estudio_pronta"));
    } catch (e) {
      toast.fromError(e);
    } finally {
      setStudioBusy(false);
    }
  }

  async function decideStudio(approve: boolean) {
    setApprovalBusy(true);
    try {
      setPiece(approve ? await api.post<PieceView>(`/api/pieces/${id}/studio/approve`) : await api.delete<PieceView>(`/api/pieces/${id}/studio/pending`));
      toast.success(approve ? t("editImage.aprovada_ok") : t("editImage.descartada_ok"));
    } catch (e) {
      toast.fromError(e);
    } finally {
      setApprovalBusy(false);
    }
  }

  return { studioBusy, approvalBusy, studioShot, decideStudio };
}
