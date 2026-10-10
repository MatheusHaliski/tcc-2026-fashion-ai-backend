"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import type { MomentsCalendar, MomentsHome, MyMoments } from "@/lib/moments/types";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { MomentCard } from "@/components/moments/moment-shared";
import { MomentNowHero } from "@/components/moments/moment-now";
import { MomentCalendar } from "@/components/moments/moment-calendar";
import { GroupMomentsPanel } from "@/components/moments/flair-moments";
import { MomentsReplay } from "@/components/moments/moment-timeline";
import { GuideAuto, HowItWorks } from "@/components/guide/guide";

type Tab = "now" | "upcoming" | "calendar" | "mine" | "flair";
const TABS: Tab[] = ["now", "upcoming", "calendar", "mine", "flair"];

/**
 * MOMENTOS — o tempo da moda dentro do FashionAI (docs/momentos/MOMENTOS.md). Não é uma lista de missões: é
 * "o que está acontecendo agora?", "o que vem depois?", "como meu estilo interpreta este momento?", "o que meus amigos
 * estão fazendo?" e "o que eu já vivi?". Mobile em primeiro lugar: Agora · Próximos · Calendário · Meus · FLAIR.
 */
function MomentsInner() {
  const { t } = useI18n(); const { user } = useAuth(); const sp = useSearchParams();
  const initial = sp.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(initial && TABS.includes(initial) ? initial : "now");
  const home = useApi<MomentsHome>((signal) => api.get("/api/moments", { signal, anonymous: !user }), [!!user]);
  const year = new Date().getFullYear();
  const cal = useApi<MomentsCalendar>((signal) => api.get(`/api/moments/calendar?year=${year}&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`, { signal, anonymous: !user }), [year, !!user], { enabled: tab === "calendar" });
  const mine = useApi<MyMoments>((signal) => api.get("/api/me/moments", { signal }), [], { enabled: tab === "mine" && !!user });
  const [at, setAt] = useState(Date.now()); useEffect(() => { if (home.data) setAt(Date.now()); }, [home.data]);
  const h = home.data;
  const tabs = [{ id: "now" as Tab, label: t("moments.tab.now"), count: h?.active.length }, { id: "upcoming" as Tab, label: t("moments.tab.upcoming"), count: h?.upcoming.length }, { id: "calendar" as Tab, label: t("moments.tab.calendar") },
    ...(user ? [{ id: "mine" as Tab, label: t("moments.tab.mine") }, { id: "flair" as Tab, label: t("moments.tab.flair"), count: h?.group ? h.group.activeCount + h.group.upcomingCount : undefined }] : [])];
  return (
    <>
      <PageHeader title={t("nav.moments")} kicker={t("moments.kicker")} lead={h?.principle ?? t("moments.lead")} actions={<><HowItWorks id="moments.calendar" /><Link href="/challenges" className="btn btn-sm"><FaiIcon id="ACT-43" size={24} decorative />{t("moments.routine_challenges")}</Link></>} />
      <GuideAuto id="moments.calendar" />
      <Tabs tabs={tabs} value={tab} onChange={setTab} label={t("nav.moments")} />
      {home.error && tab !== "calendar" && <ErrorState error={home.error} onRetry={home.reload} />}
      {tab === "now" && (home.loading ? <Skeleton className="h-72" /> : h && (
        <div className="grid gap-4">
          {h.featured ? <MomentNowHero m={h.featured} receivedAt={at} /> : <EmptyState title={t("moments.now_empty")} hint={t("moments.now_empty_hint")} action={<button type="button" className="btn btn-primary" onClick={() => setTab("upcoming")}>{t("moments.tab.upcoming")}</button>} />}
          {h.active.filter((m) => m.id !== h.featured?.id).length > 0 && <section aria-labelledby="also-now"><h2 id="also-now" className="type-h3 mb-2">{t("moments.also_now")}</h2><div className="grid-looks">{h.active.filter((m) => m.id !== h.featured?.id).map((m) => <MomentCard key={m.id} m={m} receivedAt={at} />)}</div></section>}
          {h.upcoming.length > 0 && <section aria-labelledby="next-up"><div className="flex items-baseline justify-between"><h2 id="next-up" className="type-h3 mb-2">{t("moments.tab.upcoming")}</h2><button type="button" className="btn btn-ghost btn-sm" onClick={() => setTab("upcoming")}>{t("common.see")}</button></div><div className="grid-looks">{h.upcoming.slice(0, 3).map((m) => <MomentCard key={m.id} m={m} receivedAt={at} compact />)}</div></section>}
          {user && h.mine && <section className="grid gap-3 sm:grid-cols-3"><Card><p className="label">{t("moments.tab.mine")}</p><p className="type-body tabular">{t("moments.mine_summary", { participated: h.mine.participated, completed: h.mine.completed, points: h.mine.points })}</p><button type="button" className="btn btn-sm mt-2" onClick={() => setTab("mine")}>{t("common.see")}</button></Card>
            <Card><p className="label">{t("moments.tab.flair")}</p><p className="type-body">{h.group ? t("moments.group_summary", { name: h.group.name, active: h.group.activeCount, upcoming: h.group.upcomingCount }) : t("moments.flair.no_group")}</p><button type="button" className="btn btn-sm mt-2" onClick={() => setTab("flair")}>{t("common.see")}</button></Card>
            <Card><p className="label">{t("moments.tab.calendar")}</p><p className="type-body">{t("moments.calendar_teaser")}</p><button type="button" className="btn btn-sm mt-2" onClick={() => setTab("calendar")}>{t("common.see")}</button></Card></section>}
        </div>
      ))}
      {tab === "upcoming" && (home.loading ? <Skeleton className="h-48" /> : h && (h.upcoming.length === 0 ? <EmptyState title={t("moments.upcoming_empty")} hint={t("moments.upcoming_empty_hint")} /> : <div className="grid-looks">{h.upcoming.map((m) => <MomentCard key={m.id} m={m} receivedAt={at} />)}</div>))}
      {tab === "calendar" && (cal.error ? <ErrorState error={cal.error} onRetry={cal.reload} /> : cal.loading || !cal.data ? <Skeleton className="h-96" /> : <MomentCalendar data={cal.data} receivedAt={at} />)}
      {tab === "mine" && user && (mine.error ? <ErrorState error={mine.error} onRetry={mine.reload} /> : mine.loading || !mine.data ? <Skeleton className="h-64" /> : (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2"><Badge tone="thread">{t("moments.mine_badges", { n: mine.data.badges.length })}</Badge><Badge>{t("moments.mine_points", { n: mine.data.summary.points })}</Badge><Link href="/lookbook?tab=moments" className="btn btn-sm">{t("moments.see_timeline")}</Link></div>
          <MomentsReplay />
          <Section title={t("moments.mine_active")} items={mine.data.active} at={at} empty={t("moments.mine_active_empty")} />
          <Section title={t("moments.mine_saved")} items={mine.data.saved} at={at} empty={t("moments.mine_saved_empty")} />
          <Section title={t("moments.mine_completed")} items={mine.data.completed} at={at} empty={t("moments.mine_completed_empty")} />
        </div>
      ))}
      {tab === "flair" && user && (home.loading ? <Skeleton className="h-48" /> : <GroupMomentsPanel group={h?.group ?? null} />)}
    </>
  );
}

function Section({ title, items, at, empty }: { title: string; items: MyMoments["active"]; at: number; empty: string }) {
  return <section><h2 className="type-h3 mb-2">{title}</h2>{items.length === 0 ? <p className="type-body-sm text-muted">{empty}</p> : <div className="grid-looks">{items.map((m) => <MomentCard key={m.id} m={m} receivedAt={at} />)}</div>}</section>;
}

export default function MomentsPage() { return <RequireAuth><Suspense><MomentsInner /></Suspense></RequireAuth>; }
