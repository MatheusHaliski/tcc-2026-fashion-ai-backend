"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

/**
 * Permissão AURA_DYNAMIC (nível Studio) de quem vê, lida de GET /api/me/aura-permissions — a fonte única da regra é o
 * backend (docs/design/FAI_XP_NIVEIS_FLAIR.md). Um pedido por pessoa a cada 5 min, compartilhado por todos os cards
 * (cache de módulo). Falha fechada: sem conta, erro ou resposta sem a regra = sem efeito dinâmico.
 */
interface AuraPermissions { auras?: Record<string, { allowed?: boolean } | undefined> }
interface Entry { allowed: boolean; at: number; promise?: Promise<boolean> }

export const AURA_PERMISSIONS_TTL_MS = 5 * 60_000;
const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();

function load(userId: string): Promise<boolean> {
  const current = cache.get(userId);
  if (current?.promise) return current.promise;
  const promise = api.get<AuraPermissions>("/api/me/aura-permissions")
    .then((r) => r?.auras?.AURA_DYNAMIC?.allowed === true)
    .catch(() => false)
    .then((allowed) => {
      cache.set(userId, { allowed, at: Date.now() });
      listeners.forEach((l) => l());
      return allowed;
    });
  cache.set(userId, { allowed: current?.allowed ?? false, at: current?.at ?? 0, promise });
  return promise;
}

/** Valor conhecido agora (false até a resposta chegar). */
export function auraDynamicAllowed(userId: string | null | undefined): boolean {
  return !!userId && cache.get(userId)?.allowed === true;
}

/** Hook: true só depois que o servidor confirmar AURA_DYNAMIC para esta pessoa. */
export function useAuraDynamicAllowed(userId: string | null | undefined, enabled = true): boolean {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!enabled || !userId) return;
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    const entry = cache.get(userId);
    if (!entry || (!entry.promise && Date.now() - entry.at >= AURA_PERMISSIONS_TTL_MS)) void load(userId);
    return () => {
      listeners.delete(listener);
    };
  }, [enabled, userId]);
  return enabled && auraDynamicAllowed(userId);
}

/** Depois de subir de nível ou trocar de conta, a próxima leitura volta ao servidor. */
export function invalidateAuraPermissions() {
  cache.clear();
}

/** Só para testes. */
export function __resetAuraPermissions() {
  cache.clear();
  listeners.clear();
}
