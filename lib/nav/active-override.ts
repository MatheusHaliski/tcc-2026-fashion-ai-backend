"use client";
import { useSyncExternalStore } from "react";

/**
 * Sub-item do menu lateral aberto por uma tela sem trocar de rota: no Meu Quarto, quando a prova do espelho está à vista,
 * aparece "Espelho" recuado logo abaixo de "Meu Quarto" (que continua visível como pai). Não é link — chega-se ao
 * espelho andando até ele. A tela que liga desliga ao sair (null = sem sub-item).
 */
export interface NavSub { parent: string; key: string; icon: string }
let current: NavSub | null = null;
const listeners = new Set<() => void>();

export function setNavSub(sub: NavSub | null) {
  if (current === sub || (current && sub && current.parent === sub.parent && current.key === sub.key && current.icon === sub.icon)) return;
  current = sub;
  listeners.forEach((l) => l());
}

export function useNavSub(): NavSub | null {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => current, () => null);
}
