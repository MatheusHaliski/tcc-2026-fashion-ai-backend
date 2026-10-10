"use client";

import { Badge } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { useI18n } from "@/lib/i18n/i18n";
import type { FittingItem } from "@/lib/tryon/fitting-room";
import { toLook3d } from "@/lib/tryon/fitting-room-model";
import { garmentContract, type PhotoState, type TryOnState } from "@/lib/tryon/garment-asset";

const STATE_TONE: Record<TryOnState, "thread" | "chalk" | "mark" | undefined> = { APROVADA: "thread", ESTIMADA: "chalk", PROCESSANDO: undefined, SEM_3D: undefined, ERRO: "mark" };
const STATE_ICON: Record<TryOnState, string> = { APROVADA: "ACT-20", ESTIMADA: "NAV-07", PROCESSANDO: "ACT-21", SEM_3D: "NAV-07", ERRO: "ACT-21" };

/**
 * Estado da peça no 3D (contrato da vestimenta, lib/tryon/garment-asset.ts): aprovada, estimada, carregando, sem 3D ou
 * erro — e o porquê, mais as limitações conhecidas da subcategoria. `photo` vem da cena (lib/tryon/garment-status.ts).
 * Texto em corpo normal com ícone (nada de legenda miúda na linha do slot).
 */
export function GarmentState({ item, photo }: { item: FittingItem; photo?: PhotoState }) {
  const { t } = useI18n();
  const c = garmentContract(toLook3d(item), photo ?? (item.imageUrl || item.processedUrl ? "carregando" : "sem-foto"));
  const st = c.validation.state;
  return (
    <div className="grid gap-1">
      <p className="fitting-slot-state"><FaiIcon id={STATE_ICON[st]} size={24} decorative /><Badge tone={STATE_TONE[st]}>{t(`tryOn.estado.${st}`)}</Badge><span>{t(`tryOn.motivo.${c.validation.reason}`)}</span></p>
      {c.compatibility.restrictions.map((r) => <p key={r} className="fitting-slot-state text-muted"><FaiIcon id="NAV-07" size={24} decorative /><span>{t(`tryOn.limite.${r}`)}</span></p>)}
    </div>
  );
}
