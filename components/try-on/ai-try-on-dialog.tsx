"use client";

import { useMemo } from "react";
import type { FittingItem } from "@/lib/tryon/fitting-room";
import { GpuLookDialog, isGpuCategory, type GpuPiece } from "@/components/try-on/gpu-look-dialog";

const gpuReady = (i: FittingItem) => i.source === "catalog" ? !!i.productId : !!i.pieceId;

/** Peças do provador que a prova com IA aceita: do guarda-roupa (pieceId) e das lojas (productId), nos tipos que o FASHN veste. */
export function aiCandidates(items: FittingItem[]): FittingItem[] {
  return items.filter((i) => gpuReady(i) && isGpuCategory(i.category));
}

/**
 * Prova com IA no Provador: o look que está no provador (ou uma peça dele) vestido na foto da própria pessoa, na GPU.
 * Entram peças das lojas e do guarda-roupa; da loja, só com foto de produto liberada para a GPU (o servidor confere).
 * Calçados e acessórios o modelo não veste.
 */
export function AiTryOnDialog({ open, onClose, items, onPickFromWardrobe }: {
  open: boolean; onClose: () => void; items: FittingItem[]; onPickFromWardrobe: () => void;
}) {
  const pieces = useMemo<GpuPiece[]>(() => items.filter(gpuReady)
    .map((i) => ({ id: i.source === "catalog" ? i.productId! : i.pieceId!, source: i.source, name: i.name, category: i.category })), [items]);
  return <GpuLookDialog open={open} onClose={onClose} pieces={pieces} onPickFromWardrobe={onPickFromWardrobe} />;
}
