"use client";
import { useMemo } from "react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useApi } from "@/lib/hooks/use-api";
import { toSealBadges, type SealBadge } from "@/components/scheme-card";

/** Approved brand/celebrity bonds returned by GET /api/pieces/seals, not garment attribute tags. */
export type PieceSealSource = NonNullable<Parameters<typeof toSealBadges>[0]>[number];
export const PIECE_SEALS_MAX_IDS = 60;

/**
 * Batch per list, including infinite feeds. Completed ids are reused while the list
 * remains mounted; appending a page fetches only missing ids, at most 60 per call.
 * The cache is in-memory and scoped to the current viewer (or anonymous request),
 * so another account never inherits private bonds from a previous session.
 */
export function usePieceSeals(pieces: readonly { id: string }[] | null | undefined, opts: { anonymous?: boolean } = {}): (id: string) => SealBadge[] {
  const { user } = useAuth();
  const scope = opts.anonymous ? "anonymous" : user?.id ?? "guest";
  const ids = [...new Set((pieces ?? []).map((p) => p.id).filter(Boolean))].join(",");
  const cache = useMemo(() => new Map<string, {badges:PieceSealSource[];at:number}>(), [scope]);
  useApi(async (signal) => {
    const wanted = ids ? ids.split(",") : [];
    const missing = wanted.filter((id) => !cache.has(id) || Date.now() - cache.get(id)!.at >= 60_000);
    const batches: string[][] = [];
    for (let i = 0; i < missing.length; i += PIECE_SEALS_MAX_IDS) batches.push(missing.slice(i, i + PIECE_SEALS_MAX_IDS));
    await Promise.all(batches.map(async (batch) => {
      try {
        const response = await api.get<{ items?: Record<string, PieceSealSource[]> }>(`/api/pieces/seals?ids=${batch.join(",")}`, {
          signal, ...(opts.anonymous ? { anonymous: true } : {}),
        });
        if (!signal.aborted) for (const id of batch) cache.set(id, {badges:response.items?.[id] ?? [],at:Date.now()});
      } catch (error) {
        if (signal.aborted || (error as Error).name === "AbortError") throw error;
        // One failed batch must not hide successfully loaded seals from other pages.
        // Failed ids remain missing and can be retried on the next list refresh.
      }
    }));
    // Bound a long-lived list without evicting the ids currently displayed.
    const visible = new Set(wanted);
    for (const id of cache.keys()) if (cache.size > 1200 && !visible.has(id)) cache.delete(id);
    return { ids, scope };
  }, [ids, scope], { enabled: !!ids, refreshInterval:60_000 });
  const visible = new Set(ids ? ids.split(",") : []);
  return (id: string) => visible.has(id) ? toSealBadges(cache.get(id)?.badges) : [];
}
