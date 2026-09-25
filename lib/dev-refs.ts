"use client";
import { useEffect, useSyncExternalStore } from "react";

/**
 * Modo apresentação: mostra os códigos de requisito (RF/HU/CA) nas telas, para rastrear cada tela até a
 * especificação do TCC. Fica desligado para o usuário comum. Liga com `?rf=1` em qualquer URL (ou em
 * Configurações → Aparência) e desliga com `?rf=0`. A escolha fica só neste navegador.
 */
const KEY = "fai.devrefs";
const EVENT = "fai:devrefs";

/** Texto formado só por códigos de requisito, como "RF7 · RF31" ou "RF10 · CA08–CA16". */
export const REQUIREMENT_CODE = /^\s*(?:(?:RF|RNF|HU|CA)\d+(?:\.CA\d+)?(?:[–-]CA\d+)?\s*(?:·\s*)?)+$/;

function read(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function setDevRefs(on: boolean) {
  try { if (on) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch { /* armazenamento bloqueado */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

export function useDevRefs(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

/** Lê `?rf=1` / `?rf=0` da URL uma vez por carregamento. */
export function useDevRefsFromUrl() {
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("rf");
    if (v === "1") setDevRefs(true);
    else if (v === "0") setDevRefs(false);
  }, []);
}
