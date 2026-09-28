"use client";
import { useState } from "react";
import Link from "next/link";
import { api, qs } from "@/lib/api/client";
import type { SchemeView } from "@/lib/api/types";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Chip, EmptyState, ErrorState, PageHeader, SkeletonGrid, Tabs } from "@/components/ui";
import { SchemeCard } from "@/components/scheme-card";
import { InfiniteSentinel, mergeById } from "@/components/infinite-sentinel";
import { OnboardingChecklist } from "@/components/onboarding";

type Feed = { items: SchemeView[]; nextCursor: string | null; chips: { label: string; key: string; value: string }[]; order?: string };

export default function FeedPage() {
  const { t } = useI18n(); const { user } = useAuth();
  const [tab, setTab] = useState<"feed" | "runway">("feed");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [pages, setPages] = useState<SchemeView[]>([]);
  const { data, loading, error, reload } = useApi<Feed>(async (signal) => {
    const r = await api.get<Feed>(tab === "runway" ? `/api/runway${qs({ cursor, size: 12 })}` : `/api/feed${qs({ cursor, size: 12, ...filters })}`, { signal, anonymous: !user });
    setPages((p) => (cursor ? mergeById(p, r.items) : r.items));
    return r;
  }, [tab, cursor, JSON.stringify(filters), !!user], { enabled: tab === "feed" || !!user });
  const toggle = (k: string, v: string) => { setCursor(null); setFilters((f) => (f[k] === v ? Object.fromEntries(Object.entries(f).filter(([x]) => x !== k)) : { ...f, [k]: v })); };
  return (
    <>
      <PageHeader title={t("feed.title")} kicker="RF8" lead={t("feed.lead")} />
      <OnboardingChecklist />
      <Tabs tabs={[{ id: "feed", label: t("feed.title") }, { id: "runway", label: t("feed.runway") }]} value={tab} onChange={(v) => { setTab(v); setCursor(null); }} />
      {tab === "runway" && !user && <EmptyState title={t("common.loginRequired")} action={<Link href="/login" className="btn btn-primary">{t("nav.login")}</Link>} />}
      {data?.chips?.length ? <div className="mb-4 flex flex-wrap gap-2">{data.chips.map((c) => <Chip key={c.key + c.value} active={filters[c.key] === c.value} onClick={() => toggle(c.key, c.value)}>{c.label}</Chip>)}</div> : null}
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && pages.length === 0 && <SkeletonGrid n={6} h="h-72" />}
      {!loading && !error && pages.length === 0 && (tab === "feed" || user) && <EmptyState title={t("feed.empty")} action={user ? <Link href="/schemes/new" className="btn btn-primary">{t("scheme.create")}</Link> : <Link href="/register" className="btn btn-primary">{t("nav.register")}</Link>} />}
      <div className="grid-looks">{pages.map((s) => <SchemeCard key={s.id} scheme={s} />)}</div>
      <InfiniteSentinel hasMore={!!data?.nextCursor} loading={loading} onMore={() => data?.nextCursor && setCursor(data.nextCursor)} label={t("common.more")} />
    </>
  );
}
