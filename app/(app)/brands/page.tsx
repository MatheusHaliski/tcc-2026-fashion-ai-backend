"use client";
import { useState } from "react";
import Link from "next/link";
import { api, mediaUrl, qs } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { Avatar, Chip, EmptyState, ErrorState, Input, PageHeader, SkeletonGrid, Tabs } from "@/components/ui";

interface Card { id?: string; slug?: string; name?: string; brandName?: string; stageName?: string; logoUrl?: string; officialPhotoUrl?: string; category?: string; fashionCategory?: string; affinity?: number; followers?: number; seals?: number; areas?: string[]; user?: { username: string; avatarUrl?: string }; verified?: boolean; }
interface Feed { brands?: Card[]; celebrities?: Card[]; orders: string[]; order: string; empty?: string; }

export default function BrandsPage() {
  const { t } = useI18n(); const { user } = useAuth();
  const [tab, setTab] = useState<"brands" | "celebrities">("brands"); const [term, setTerm] = useState(""); const [order, setOrder] = useState("");
  const { data, loading, error, reload } = useApi<Feed>((signal) => api.get(`/api/${tab}${qs({ term, order })}`, { signal, anonymous: !user }), [tab, term, order, !!user]);
  const list = (tab === "brands" ? data?.brands : data?.celebrities) ?? [];
  return (
    <>
      <PageHeader title={t("nav.brands")} kicker="RF14 · RF22" lead="Marcas e celebridades validadas. Ordene por afinidade com o seu DNA de Estilo." />
      <Tabs tabs={[{ id: "brands", label: "Marcas" }, { id: "celebrities", label: "Celebridades" }]} value={tab} onChange={setTab} />
      <div className="mb-4 flex flex-wrap gap-2"><Input aria-label={t("common.search")} placeholder={t("common.search") + "…"} value={term} onChange={(e) => setTerm(e.target.value)} className="max-w-xs" />{(data?.orders ?? ["AFINIDADE", "RECENTES"]).map((o) => <Chip key={o} active={(order || data?.order) === o} onClick={() => setOrder(o)}>{o === "AFINIDADE" ? "Afinidade" : "Recentes"}</Chip>)}</div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <SkeletonGrid n={6} h="h-40" />}
      {!loading && list.length === 0 && <EmptyState title={data?.empty ?? t("common.empty")} />}
      <div className="grid-cards">{list.map((c, i) => { const slug = c.slug ?? c.user?.username ?? c.id ?? ""; const name = c.name ?? c.brandName ?? c.stageName ?? ""; return (
        <Link key={slug + i} href={`/brands/${slug}`} className="surface flex flex-col items-center gap-2 p-4 text-center hover:bg-surface-2">
          <Avatar src={mediaUrl(c.logoUrl ?? c.officialPhotoUrl ?? c.user?.avatarUrl)} name={name} size={64} />
          <p className="type-h3">{name}{c.verified && " ✓"}</p>
          <p className="type-caption text-muted">{c.category ?? c.fashionCategory ?? (c.areas ?? []).join(", ")}</p>
          <p className="type-data text-faint tabular">{c.followers != null ? `${c.followers} seguidores` : ""}{c.seals != null ? ` · ${c.seals} selos` : ""}{c.affinity != null ? ` · afinidade ${Math.round(c.affinity * 100)}%` : ""}</p>
        </Link>); })}</div>
    </>
  );
}
