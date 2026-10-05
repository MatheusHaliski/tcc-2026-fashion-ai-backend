"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api/client";
import type { HypeGroups, HypeGroupSummary, HypeRankGroup } from "./types";

/**
 * Lote A1 — Hype agregado de marcas e criadores para os chips (busca, perfis, /brands). Como o `useHypeSummary`: cada
 * chip pede a própria chave, os pedidos do mesmo "tick" viram UMA requisição (`/api/hype/groups`, até 50 chaves) e cada
 * chip assina só a própria entrada (`useSyncExternalStore`). O backend lê a tabela gravada pelo job (GET nunca
 * recalcula) e só usa itens públicos elegíveis; chave ausente da resposta (bloqueio ou sem dado) = nada no chip.
 */
interface Entry { group?: HypeGroupSummary; loading: boolean; error: boolean; at: number }

const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 400;
/** Nomes de marca deixam a URL longa: lotes menores que os 100 do backend. */
const BATCH = 50;
const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const pending: Record<HypeRankGroup, Set<string>> = { BRAND: new Set(), CREATOR: new Set() };
let timer: ReturnType<typeof setTimeout> | null = null;

/** Chave do agregado como o backend normaliza: marca = nome em minúsculas sem espaços nas pontas; criador = id. */
export const hypeGroupKey = (raw: string) => raw.trim().toLowerCase();
const keyOf = (type: HypeRankGroup, key: string) => `${type}:${hypeGroupKey(key)}`;
/** Sem dado nenhum (chave fora da resposta): insuficiente — o chip não aparece, nunca vira 0. */
const missing = (key: string): HypeGroupSummary => ({ key, sufficient: false, value: null, level: null, rank: null, items: 0, pieces: 0, looks: 0 });

function emit(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

function put(key: string, entry: Entry) {
  entries.set(key, entry);
  if (entries.size > MAX_ENTRIES) {
    for (const k of entries.keys()) {
      if (entries.size <= MAX_ENTRIES) break;
      if (!listeners.get(k)?.size) entries.delete(k);
    }
  }
  emit(key);
}

async function flush() {
  timer = null;
  for (const type of ["BRAND", "CREATOR"] as HypeRankGroup[]) {
    const keys = [...pending[type]];
    pending[type].clear();
    for (let i = 0; i < keys.length; i += BATCH) {
      const chunk = keys.slice(i, i + BATCH);
      try {
        const r = await api.get<HypeGroups>(`/api/hype/groups?type=${type}&keys=${chunk.map(encodeURIComponent).join(",")}`);
        const now = Date.now();
        chunk.forEach((k) => put(keyOf(type, k), { group: r.items?.[k] ?? missing(k), loading: false, error: false, at: now }));
      } catch {
        const now = Date.now();
        chunk.forEach((k) => { const old = entries.get(keyOf(type, k)); put(keyOf(type, k), { group: old?.group, loading: false, error: true, at: now }); });
      }
    }
  }
}

/** Pede o agregado de uma marca/pessoa (entra no próximo lote; respeita o TTL e pedidos em andamento). */
export function requestHypeGroup(type: HypeRankGroup, raw: string) {
  const k = hypeGroupKey(raw);
  if (!k) return;
  const key = keyOf(type, k);
  const e = entries.get(key);
  if (e && (e.loading || Date.now() - e.at < TTL_MS)) return;
  put(key, { group: e?.group, loading: true, error: false, at: e?.at ?? 0 });
  pending[type].add(k);
  if (!timer) timer = setTimeout(flush, 0);
}

/** Respostas que já trazem o agregado (feeds de /brands) alimentam o cache — o chip não pede de novo. */
export function primeHypeGroups(type: HypeRankGroup, items: Record<string, HypeGroupSummary | null | undefined>) {
  const now = Date.now();
  Object.entries(items).forEach(([k, group]) => { if (group) put(keyOf(type, k), { group, loading: false, error: false, at: now }); });
}

/** Só para testes: zera o cache e os lotes pendentes. */
export function __resetHypeGroupStore() {
  entries.clear();
  pending.BRAND.clear();
  pending.CREATOR.clear();
  if (timer) clearTimeout(timer);
  timer = null;
}

export function useHypeGroup(type: HypeRankGroup, raw: string | null | undefined, enabled = true) {
  const key = raw && hypeGroupKey(raw) ? keyOf(type, raw) : "";
  const subscribe = useCallback((cb: () => void) => {
    if (!key) return () => undefined;
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(cb);
    return () => { set!.delete(cb); if (!set!.size) listeners.delete(key); };
  }, [key]);
  const entry = useSyncExternalStore(subscribe, () => (key ? entries.get(key) : undefined), () => undefined);
  useEffect(() => { if (enabled && raw) requestHypeGroup(type, raw); }, [type, raw, enabled]);
  return { group: entry?.group, loading: entry ? entry.loading && !entry.group : enabled && !!key, error: !!entry?.error && !entry?.group };
}
