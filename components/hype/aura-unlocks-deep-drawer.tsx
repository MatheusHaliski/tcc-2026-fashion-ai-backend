"use client";
import { useState } from "react";
import type { HypeEntity } from "@/lib/hype/types";
import { useUnlocksDeepLink } from "@/lib/aura/use-unlocks-deep-link";
import { HypeAnalyticsDrawer } from "./hype-analytics-drawer";

/**
 * Circuito Aura — destino do aviso de marco em páginas sem o verso do card (peça ampliada): com "?destrava=<id>" no
 * endereço, abre a análise do Hype já no painel "O que este card destrava". Sem o parâmetro, não renderiza nada.
 */
export function AuraUnlocksDeepDrawer({ type, id, name }: { type: HypeEntity; id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const deep = useUnlocksDeepLink(id, () => setOpen(true));
  if (!deep) return null;
  return <HypeAnalyticsDrawer type={type} id={id} name={name} open={open} onClose={() => setOpen(false)} focusUnlocks />;
}
