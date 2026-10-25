"use client";
import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { toSealBadges, type SealBadge } from "@/components/scheme-card";
import { PIECE_SEALS_MAX_IDS, type PieceSealSource } from "./use-piece-seals";

/**
 * Selos aprovados de uma peça para o card que a tela não abasteceu (ranking Hype, tendências, Lens, Copilot, vitrine…).
 * Os cards do mesmo "tick" viram UMA requisição a /api/pieces/seals (até 60 ids); o cache é de módulo, com TTL, e a chave
 * leva o leitor, para outra conta nunca herdar vínculos privados. As listas que já usam usePieceSeals passam `seals` e
 * não caem aqui.
 */
const TTL_MS = 60_000;
const MAX_ENTRIES = 1200;
const EMPTY: SealBadge[] = [];
const entries = new Map<string, { badges: SealBadge[]; at: number; loading: boolean }>();
const listeners = new Map<string, Set<() => void>>();
const pending = new Map<string, Set<string>>();
let timer: ReturnType<typeof setTimeout> | null = null;

const keyOf = (scope: string, id: string) => `${scope}|${id}`;
const emit = (key: string) => listeners.get(key)?.forEach((l) => l());

function put(key: string, badges: SealBadge[], loading: boolean) {
  entries.set(key, { badges, at: Date.now(), loading });
  if (entries.size > MAX_ENTRIES) for (const k of entries.keys()) { if (entries.size <= MAX_ENTRIES) break; if (!listeners.get(k)?.size) entries.delete(k); }
  emit(key);
}

async function flush() {
  timer = null;
  const work = [...pending.entries()];
  pending.clear();
  for (const [scope, set] of work) {
    const ids = [...set];
    for (let i = 0; i < ids.length; i += PIECE_SEALS_MAX_IDS) {
      const chunk = ids.slice(i, i + PIECE_SEALS_MAX_IDS);
      try {
        const r = await api.get<{ items?: Record<string, PieceSealSource[]> }>(`/api/pieces/seals?ids=${chunk.join(",")}`);
        chunk.forEach((id) => put(keyOf(scope, id), toSealBadges(r.items?.[id]), false));
      } catch {
        // falha não apaga o que já estava na tela; o próximo pedido (após o TTL) tenta de novo
        chunk.forEach((id) => { const k = keyOf(scope, id); put(k, entries.get(k)?.badges ?? EMPTY, false); });
      }
    }
  }
}

/** IDs de prévia (criador, rascunho) e de exemplo (tutoriais) nunca vão à API. */
export const isPersistedPieceId = (id?: string | null) => !!id && !/^(preview|draft|demo-|tmp)/.test(id);

function request(scope: string, id: string) {
  const key = keyOf(scope, id);
  const e = entries.get(key);
  if (e && (e.loading || Date.now() - e.at < TTL_MS)) return;
  put(key, e?.badges ?? EMPTY, true);
  if (!pending.has(scope)) pending.set(scope, new Set());
  pending.get(scope)!.add(id);
  if (!timer) timer = setTimeout(flush, 0);
}

/** `enabled` falso (a tela já passou os selos, ou é prévia) não pede nada e devolve lista vazia. */
export function usePieceSealsFor(id: string | null | undefined, enabled: boolean): SealBadge[] {
  const { user } = useAuth();
  const scope = user?.id ?? "guest";
  const key = enabled && id ? keyOf(scope, id) : null;
  useEffect(() => { if (key && id) request(scope, id); }, [key, scope, id]);
  return useSyncExternalStore(
    (cb) => {
      if (!key) return () => {};
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(cb);
      return () => { listeners.get(key)?.delete(cb); };
    },
    () => (key ? entries.get(key)?.badges ?? EMPTY : EMPTY),
    () => EMPTY,
  );
}

/** Testes: zera o cache entre casos. */
export function __resetPieceSealsStore() { entries.clear(); pending.clear(); if (timer) { clearTimeout(timer); timer = null; } }
