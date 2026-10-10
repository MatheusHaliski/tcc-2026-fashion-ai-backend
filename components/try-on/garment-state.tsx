"use client";

import { Badge } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import type { FittingItem } from "@/lib/tryon/fitting-room";
import { toLook3d } from "@/lib/tryon/fitting-room-model";
import { garmentContract, type PhotoState, type TryOnState } from "@/lib/tryon/garment-asset";

const STATE_TONE: Record<TryOnState, "thread" | "chalk" | "mark" | undefined> = { APROVADA: "thread", ESTIMADA: "chalk", PROCESSANDO: undefined, SEM_3D: undefined, ERRO: "mark" };

/**
 * Estado da peça no 3D (contrato da vestimenta, lib/tryon/garment-asset.ts): aprovada, estimada, carregando, sem 3D ou
 * erro — e o porquê, mais as limitações conhecidas da subcategoria. `photo` vem da cena (lib/tryon/garment-status.ts).
 */
export function GarmentState({ item, photo }: { item: FittingItem; photo?: PhotoState }) {
  const { t } = useI18n();
  const c = garmentContract(toLook3d(item), photo ?? (item.imageUrl || item.processedUrl ? "carregando" : "sem-foto"));
  const st = c.validation.state;
  return (
    <div className="mt-0.5 grid gap-0.5">
      <p className="flex flex-wrap items-center gap-1.5 type-caption"><Badge tone={STATE_TONE[st]}>{t(`tryOn.estado.${st}`)}</Badge><span className="text-muted">{t(`tryOn.motivo.${c.validation.reason}`)}</span></p>
      {c.compatibility.restrictions.map((r) => <p key={r} className="type-caption text-muted">{t(`tryOn.limite.${r}`)}</p>)}
    </div>
  );
}
