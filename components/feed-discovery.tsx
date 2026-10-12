"use client";
import Link from "next/link";
import { api, qs } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Avatar, ErrorState, SkeletonGrid } from "@/components/ui";
import type { PublicProfileSummary } from "@/lib/api/public-profiles";
import type { SearchEntity } from "@/components/search-entity-card";
type Kind = "PESSOAS" | "CELEBRIDADES" | "MARCAS";
type Result = { items?: (PublicProfileSummary | SearchEntity)[]; results?: (PublicProfileSummary | SearchEntity)[] };
/** Selected discovery panel, using the same paged API response and visibility policy as Search. */
export function FeedDiscovery({ kind }: { kind?: Kind } = {}) {
  const { user } = useAuth(); const { t } = useI18n();
  const request = useApi<{ people: PublicProfileSummary[]; entities: SearchEntity[] }>(async signal => {
    const fetch = async (tab: Kind) => { const r = await api.get<Result>(`/api/search${qs({ tab, size: kind ? 24 : 6 })}`, { signal, anonymous: !user }); return r.items ?? r.results ?? []; };
    if (kind === "CELEBRIDADES" || kind === "MARCAS") return { people: [], entities: await fetch(kind) as SearchEntity[] };
    const [people, entities] = await Promise.all([fetch("PESSOAS"), kind ? Promise.resolve([]) : fetch("MARCAS")]);
    return { people: people as PublicProfileSummary[], entities: entities as SearchEntity[] };
  }, [user?.id, kind]);
  const persons = (request.data?.people ?? []).filter(p => p.id !== user?.id && p.relation !== "BLOQUEADO");
  const entities = request.data?.entities ?? [];
  if (request.loading) return <SkeletonGrid n={6} h="h-24" />;
  if (request.error) return <ErrorState error={request.error} onRetry={request.reload} />;
  if (!persons.length && !entities.length) return kind ? <p className="surface p-4" role="status">{t("discovery.empty")}</p> : null;
  return <aside className="surface p-4 mb-4" aria-label={t("discovery.title")}>
    <h2 className="type-h2">{t(kind === "CELEBRIDADES" ? "discovery.celebrities" : kind === "MARCAS" ? "discovery.brands" : kind === "PESSOAS" ? "discovery.people" : "discovery.title")}</h2>
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-3">
      {persons.map(p => <li key={p.id}><Link className="flex items-center gap-3 rounded border border-line-soft p-3 min-h-11" href={`/u/${encodeURIComponent(p.username)}`}><Avatar src={p.avatarUrl} name={p.displayName || p.username} size={36} /><span className="min-w-0"><span className="block truncate font-semibold">{p.displayName || p.username}</span><span className="type-caption text-muted">@{p.username}</span></span></Link></li>)}
      {entities.map((b, i) => {
        const name = b.name ?? b.slug ?? "";
        const href = b.registered === false || !b.slug ? `/search${qs({ tab: kind === "CELEBRIDADES" ? "CELEBRIDADES" : "ACERVO", q: name })}` : `${kind === "CELEBRIDADES" ? "/u" : "/brands"}/${encodeURIComponent(b.slug)}`;
        return <li key={b.id ?? b.userId ?? b.slug ?? i}><Link className="flex items-center gap-3 rounded border border-line-soft p-3 min-h-11" href={href}><Avatar src={b.avatarUrl ?? b.logoUrl} name={name} size={36} /><span className="truncate font-semibold">{name}</span></Link></li>;
      })}
    </ul>
    <Link className="btn btn-ghost mt-3" href={`/search?tab=${kind ?? "PESSOAS"}`}>{t(kind === "MARCAS" ? "discovery.moreBrands" : "discovery.morePeople")}</Link>
  </aside>;
}
