"use client";
import Link from "next/link";
import { api, qs } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Avatar } from "@/components/ui";
import type { PublicProfileSummary } from "@/lib/api/public-profiles";
interface Brand { slug?: string; userId?: string; name: string; logoUrl?: string | null }
/** Discovery uses the same visibility and test-account policy as search. No synthetic profiles or counters. */
export function FeedDiscovery() {
  const { user } = useAuth(); const { t } = useI18n();
  const people = useApi<{ results: PublicProfileSummary[] }>(signal => api.get(`/api/search${qs({ tab: "PESSOAS", size: 6 })}`, { signal, anonymous: !user }), [user?.id]);
  const brands = useApi<{ results: Brand[] }>(signal => api.get(`/api/search${qs({ tab: "MARCAS", size: 6 })}`, { signal, anonymous: !user }), [user?.id]);
  const persons = (people.data?.results ?? []).filter(p => p.id !== user?.id && p.relation !== "BLOQUEADO").slice(0, 6);
  const labels = (brands.data?.results ?? []).filter(b => b.slug || b.userId).slice(0, 6);
  if (!persons.length && !labels.length) return null;
  return <aside className="surface p-4 mb-4" aria-label={t("discovery.title")}>
    <h2 className="type-h2">{t("discovery.title")}</h2>
    <div className="grid gap-4 md:grid-cols-2 mt-3">
      {persons.length > 0 && <section><h3 className="type-h3 mb-2">{t("discovery.people")}</h3><ul className="grid gap-2">{persons.map(p => <li key={p.id}><Link className="flex items-center gap-3 rounded p-2 hover:bg-surface-2 min-h-11" href={`/u/${encodeURIComponent(p.username)}`}><Avatar src={p.avatarUrl} name={p.displayName || p.username} size={36} /><span className="min-w-0"><span className="block truncate font-semibold">{p.displayName || p.username}</span><span className="type-caption text-muted">@{p.username}</span></span></Link></li>)}</ul><Link className="btn btn-ghost mt-2" href="/search?tab=PESSOAS">{t("discovery.morePeople")}</Link></section>}
      {labels.length > 0 && <section><h3 className="type-h3 mb-2">{t("discovery.brands")}</h3><ul className="grid gap-2">{labels.map(b => <li key={b.slug ?? b.userId}><Link className="flex items-center gap-3 rounded p-2 hover:bg-surface-2 min-h-11" href={`/brands/${encodeURIComponent(b.slug ?? b.userId!)}`}><Avatar src={b.logoUrl} name={b.name} size={36} /><span className="truncate font-semibold">{b.name}</span></Link></li>)}</ul><Link className="btn btn-ghost mt-2" href="/search?tab=MARCAS">{t("discovery.moreBrands")}</Link></section>}
    </div>
  </aside>;
}
