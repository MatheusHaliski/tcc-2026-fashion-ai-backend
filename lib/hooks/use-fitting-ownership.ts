"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useToast } from "@/components/ui";
import type { FittingItem } from "@/lib/tryon/fitting-room";

/** "Já tenho esta peça": guarda a peça da loja no guarda-roupa, uma inclusão por vez, e lembra a peça criada. */
export function useFittingOwnership(onOwned: () => void) {
  const { t } = useI18n();
  const toast = useToast();
  const [owned, setOwned] = useState<Record<string, string>>({});
  const [busyOwn, setBusyOwn] = useState<string | null>(null);

  /** Guarda a peça da loja no guarda-roupa; devolve se guardou (a linha do provador só pede o 3D da peça guardada). */
  async function ownIt(item: FittingItem): Promise<string | false> {
    if (!item.productId || busyOwn) return false;
    setBusyOwn(item.key);
    try {
      const piece = await api.post<PieceView>("/api/pieces/from-catalog", {
        productId: item.productId, variantId: item.variantId ?? null, visibility: "PRIVATE",
      });
      setOwned((current) => ({ ...current, [item.key]: piece.id }));
      toast.success(t("tryOn.adicionada_ao_guarda_roupa", { name: item.name }));
      onOwned();
      return piece.id;
    } catch (error) {
      // o Provador não tem formulário: "Corrija os campos destacados" não aponta nada — mostra o que o servidor recusou
      const fields = error instanceof ApiError && error.code === "FORMULARIO_INVALIDO" ? Object.values(error.fields).filter((v) => typeof v === "string") : [];
      if (fields.length) toast.error(t("tryOn.nao_deu_para_guardar", { name: item.name, reason: fields.join(" · ") }));
      else toast.fromError(error);
      return false;
    } finally {
      setBusyOwn(null);
    }
  }

  return { owned, busyOwn, ownIt };
}
