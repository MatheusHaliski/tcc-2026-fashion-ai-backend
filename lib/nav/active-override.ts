"use client";
import { useSyncExternalStore } from "react";

/**
 * Sub-item do menu lateral aberto por uma tela sem trocar de rota: aparece recuado logo abaixo do item pai (que continua
 * visível). Não é link. Quem usava era o Meu Quarto, para o Espelho (o quarto saiu em 15/11/2026); o mecanismo fica para
 * outras telas. A tela que liga desliga ao sair (null = sem sub-item).
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
