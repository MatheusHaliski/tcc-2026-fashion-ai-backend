"use client";
import { useSyncExternalStore } from "react";

/**
 * Item do menu lateral aceso por uma tela, quando o que a pessoa vê é outra aba sem trocar de rota: no Meu Quarto, ao
 * chegar no espelho a prova abre dentro do quarto e o menu passa para "Espelho"; ao voltar, para "Meu Quarto". A tela
 * que liga a troca desliga ao sair (null = o menu volta a seguir a rota).
 */
let current: string | null = null;
const listeners = new Set<() => void>();

export function setNavActiveOverride(href: string | null) {
  if (current === href) return;
  current = href;
  listeners.forEach((l) => l());
}

export function useNavActiveOverride(): string | null {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => current, () => null);
}
