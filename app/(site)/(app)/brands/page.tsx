"use client";
import { useState } from "react";
import Link from "next/link";
import { api, mediaUrl, qs } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { label } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { Avatar, Chip, EmptyState, ErrorState, Input, PageHeader, SkeletonGrid, Tabs } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";
import { HypeGroupBadge } from "@/components/hype/hype-group-badge";
import type { HypeGroupSummary } from "@/lib/hype/types";

/** affinity: 0–100 (RF24.CA06); hype (RF53 · P2-05): o agregado público da marca (BRAND) ou da celebridade (CREATOR), ou nulo */
interface Card { id?: string; slug?: string; name?: string; brandName?: string; stageName?: string; logoUrl?: string; officialPhotoUrl?: string; category?: string; fashionCategory?: string; affinity?: number; followers?: number; seals?: number; areas?: string[]; user?: { username: string; avatarUrl?: string }; verified?: boolean; hype?: HypeGroupSummary | null; }
interface Feed { brands?: Card[]; celebrities?: Card[]; orders: string[]; order: string; empty?: string; }
const ORDER_LABEL: Record<string, string> = { AFINIDADE: "brands.afinidade", RECENTES: "brands.recentes", EM_ALTA: "hypeBrands.order_hot" };

export default function BrandsPage() {
  const { t } = useI18n(); const { user } = useAuth();
  const [tab, setTab] = useState<"brands" | "celebrities">("brands"); const [term, setTerm] = useState(""); const [order, setOrder] = useState("");
  const { data, loading, error, reload } = useApi<Feed>((signal) => api.get(`/api/${tab}${qs({ term, order })}`, { signal, anonymous: !user }), [tab, term, order, !!user]);
  const list = (tab === "brands" ? data?.brands : data?.celebrities) ?? [];
  return (
    <>
      <PageHeader title={t("nav.brands")} kicker={t("brands.rf14_rf22")} lead={t("brands.marcas_e_celebridades_validadas_ordene")} />
      <Tabs tabs={[{ id: "brands", label: t("nav.brands") }, { id: "celebrities", label: t("common.celebridades") }]} value={tab} onChange={setTab} />
      <div className="mb-4 flex flex-wrap gap-2"><Input aria-label={t("common.search")} placeholder={t("common.search") + "…"} value={term} onChange={(e) => setTerm(e.target.value)} className="max-w-xs" />{(data?.orders ?? ["AFINIDADE", "RECENTES", "EM_ALTA"]).map((o) => <Chip key={o} active={(order || data?.order) === o} onClick={() => setOrder(o)} title={o === "EM_ALTA" ? t("hypeBrands.order_hot_hint") : undefined}>{t(ORDER_LABEL[o] ?? "brands.recentes")}</Chip>)}</div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <SkeletonGrid n={6} h="h-40" />}
      {!loading && list.length === 0 && <EmptyState title={data?.empty ?? t("common.empty")} />}
      <div className="grid-cards">{list.map((c, i) => { const slug = c.slug ?? c.user?.username ?? c.id ?? ""; const name = c.name ?? c.brandName ?? c.stageName ?? ""; return (
        <Link key={slug + i} href={`/brands/${slug}`} className="surface flex flex-col items-center gap-2 p-4 text-center hover:bg-surface-2">
          {tab === "brands" ? <BrandLogo name={name} src={c.logoUrl} size={64} /> : <Avatar src={mediaUrl(c.officialPhotoUrl ?? c.user?.avatarUrl)} name={name} size={64} />}
          <p className="type-h3">{name}{c.verified && " ✓"}</p>
          <p className="type-caption text-muted">{c.category || c.fashionCategory ? label(c.category ?? c.fashionCategory) : (c.areas ?? []).map((a: string) => label(a)).join(", ")}</p>
          <p className="type-data text-faint tabular">{c.followers != null ? t("brands.seguidores", { followers: c.followers }) : ""}{c.seals != null ? t("brands.selos", { seals: c.seals }) : ""}{c.affinity != null ? t("brands.afinidade_2", { Math: Math.round(c.affinity) }) : ""}</p>
          <span className="brand-card-hype"><HypeGroupBadge type={tab === "brands" ? "BRAND" : "CREATOR"} group={c.hype ?? null} /></span>
        </Link>); })}</div>
    </>
  );
}
