"use client";

import { useMemo } from "react";
import type { FittingItem } from "@/lib/tryon/fitting-room";
import { GpuLookDialog, isGpuCategory, type GpuPiece } from "@/components/try-on/gpu-look-dialog";

/** Peças do provador que a prova com IA aceita: só do próprio guarda-roupa (a rota exige pieceId da pessoa). */
export function aiCandidates(items: FittingItem[]): FittingItem[] {
  return items.filter((i) => i.source === "wardrobe" && !!i.pieceId && isGpuCategory(i.category));
}

/**
 * Prova com IA no Provador: o look que está no provador (ou uma peça dele) vestido na foto da própria pessoa, na GPU.
 * Peças da loja ainda não entram (a rota exige peça do guarda-roupa); calçados e acessórios o modelo não veste.
 */
export function AiTryOnDialog({ open, onClose, items, onPickFromWardrobe }: {
  open: boolean; onClose: () => void; items: FittingItem[]; onPickFromWardrobe: () => void;
}) {
  const pieces = useMemo<GpuPiece[]>(() => items.filter((i) => i.source === "wardrobe" && !!i.pieceId)
    .map((i) => ({ pieceId: i.pieceId!, name: i.name, category: i.category })), [items]);
  return <GpuLookDialog open={open} onClose={onClose} pieces={pieces} onPickFromWardrobe={onPickFromWardrobe} />;
}
