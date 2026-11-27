"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { SealDesign } from "@/components/seal-medallion";

/** Medalhão desenhado pelo emissor no editor de selos (GET /api/seals/art). */
export interface SealArt { name: string; owner: string; premium: boolean; tier: string; iconUrl?: string | null; design?: SealDesign | null }
export type SealArtTier = "PECA" | "LOOK";

const MAX_KEYS = 40;
/** undefined = ainda não pedido; null = emissor sem selo publicado (o card mostra o nome). */
const cache = new Map<string, SealArt | null>();
const waiting = new Map<SealArtTier, Set<string>>();
const listeners = new Set<() => void>();
let scheduled = false;

const cacheKey = (tier: SealArtTier, key: string) => `${tier}|${key}`;

/** Um pedido por tier para todos os cards montados no mesmo instante (o feed não faz um GET por card). */
function flush() {
  scheduled = false;
  for (const [tier, keys] of waiting) {
    const batch = [...keys].slice(0, MAX_KEYS);
    for (const key of batch) keys.delete(key);
    if (!batch.length) continue;
    const query = batch.map((key) => `keys=${encodeURIComponent(key)}`).join("&");
    api.get<{ items?: Record<string, SealArt> }>(`/api/seals/art?tier=${tier}&${query}`)
      .then((response) => { for (const key of batch) cache.set(cacheKey(tier, key), response.items?.[key] ?? null); })
      .catch(() => { for (const key of batch) cache.set(cacheKey(tier, key), null); })   // sem arte: o nome continua visível
      .finally(() => { listeners.forEach((notify) => notify()); if ((waiting.get(tier)?.size ?? 0) > 0) schedule(); });
  }
}
function schedule() { if (!scheduled) { scheduled = true; queueMicrotask(flush); } }

/** Arte dos selos escolhidos ("BRAND:Nome" / "CELEBRITY:Nome"): devolve a arte já conhecida de cada chave. */
export function useSealArt(keys: readonly string[], tier: SealArtTier): (key: string) => SealArt | null {
  const [, refresh] = useState(0);
  const wanted = keys.join("\n");
  useEffect(() => {
    const missing = (wanted ? wanted.split("\n") : []).filter((key) => !cache.has(cacheKey(tier, key)));
    if (!missing.length) return;
    const notify = () => refresh((n) => n + 1);
    listeners.add(notify);
    const queue = waiting.get(tier) ?? new Set<string>();
    waiting.set(tier, queue);
    missing.forEach((key) => queue.add(key));
    schedule();
    return () => { listeners.delete(notify); };
  }, [wanted, tier]);
  return (key) => cache.get(cacheKey(tier, key)) ?? null;
}

/** Só para testes: esquece a arte carregada. */
export function resetSealArtCache() { cache.clear(); waiting.clear(); }
