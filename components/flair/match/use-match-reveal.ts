"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { NO_AURA, type AuraPermissions } from "@/lib/flair/match-stage";

/** Tempo de cada rodada no palco: clarão, cone, foto reacesa, Aura Hype, efeito e legenda cabem nele. */
export const ROUND_MS = 1800;

/** Movimento reduzido pelo sistema ou pela preferência do app (html[data-reduce-motion="true"]). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.dataset.reduceMotion === "true") return true;
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Revela as rodadas do confronto uma a uma: a primeira entra já, as outras a cada {@link ROUND_MS}. Com movimento
 * reduzido mostra tudo de uma vez. `key` reinicia a revelação (outra partida); `skip` mostra tudo na hora.
 */
export function useMatchReveal(total: number, key: unknown, stepMs = ROUND_MS) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(total);
      return;
    }
    setShown(Math.min(1, total));
    const h = setInterval(() => setShown((s) => {
      if (s >= total) {
        clearInterval(h);
        return s;
      }
      return s + 1;
    }), stepMs);
    return () => clearInterval(h);
  }, [total, key, stepMs]);
  const skip = useCallback(() => setShown(total), [total]);
  return { shown, done: total > 0 && shown >= total, skip };
}

interface AuraPermissionsView { currentTier?: string; auras?: Record<string, { allowed?: boolean } | undefined> }

/**
 * Permissões Loft das auras (GET /api/me/aura-permissions). Metamorfose e Impersonation só com `allowed` explícito;
 * carregando, sem sessão ou com erro o efeito é COMUM (fail closed). A Aura Hype não depende disto.
 */
export function useAuraPermissions(): AuraPermissions {
  const perms = useApi<AuraPermissionsView>((signal) => api.get("/api/me/aura-permissions", { signal }), []);
  if (perms.loading || perms.error || !perms.data) return NO_AURA;
  const auras = perms.data.auras ?? {};
  return { metamorphose: auras.AURA_METAMORPHOSE?.allowed === true, impersonation: auras.AURA_IMPERSONATION?.allowed === true };
}
