"use client";
import { useEffect, useMemo, useState } from "react";
import { api, qs } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import type { UserCard } from "@/lib/api/types";
import type { PublicProfileSummary } from "@/lib/api/public-profiles";

/** Recorte da rede FAI na busca de adversários: toda a rede, quem eu sigo, quem me segue ou os mútuos. */
export type NetworkFilter = "all" | "following" | "followers" | "mutual";
export const NETWORK_FILTERS: NetworkFilter[] = ["all", "following", "followers", "mutual"];
export type NetworkPerson = UserCard & Pick<PublicProfileSummary, "relation" | "counters">;

const DEBOUNCE_MS = 250;
const matches = (p: UserCard, q: string) => !q || p.username.toLowerCase().includes(q) || (p.displayName ?? "").toLowerCase().includes(q);

/**
 * Pessoas da rede FAI para convidar: "toda a rede" usa a busca de pessoas do app (GET /api/search?tab=PESSOAS, que já
 * respeita privacidade e bloqueio); os recortes da minha rede usam as conexões (GET /api/users/{eu}/connections) e
 * filtram pelo termo no navegador. Nunca lista a própria pessoa. O termo espera {@link DEBOUNCE_MS} antes de buscar.
 */
export function useFaiNetwork(query: string, filter: NetworkFilter) {
  const { user } = useAuth();
  const [term, setTerm] = useState(query.trim());
  useEffect(() => { const h = setTimeout(() => setTerm(query.trim()), DEBOUNCE_MS); return () => clearTimeout(h); }, [query]);
  const search = useApi<{ results?: NetworkPerson[] }>((signal) => api.get(`/api/search${qs({ tab: "PESSOAS", q: term, size: 12 })}`, { signal }),
    [term], { enabled: filter === "all" });
  const mineId = user?.id ?? "";
  const network = useApi<{ followers: UserCard[]; following: UserCard[] }>((signal) => api.get(`/api/users/${mineId}/connections`, { signal }),
    [mineId], { enabled: filter !== "all" && !!mineId });
  const people = useMemo<NetworkPerson[]>(() => {
    const q = term.toLowerCase().replace(/^@/, "");
    let list: NetworkPerson[];
    if (filter === "all") list = search.data?.results ?? [];
    else {
      const followers = network.data?.followers ?? [], following = network.data?.following ?? [];
      const followerIds = new Set(followers.map((p) => p.id));
      list = filter === "followers" ? followers : filter === "following" ? following : following.filter((p) => followerIds.has(p.id));
      list = list.filter((p) => matches(p, q));
    }
    return list.filter((p) => p.id !== mineId && p.username !== user?.username).slice(0, 12);
  }, [filter, search.data, network.data, term, mineId, user?.username]);
  const source = filter === "all" ? search : network;
  return { people, loading: source.loading, error: source.error, reload: source.reload };
}
