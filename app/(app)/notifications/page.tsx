"use client";
import { useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import type { UserCard } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Avatar, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, Switch, Tabs, useToast } from "@/components/ui";

interface Notification { id: string; type: string; category: string; actor?: UserCard | null; resourceType?: string; resourceId?: string; title: string; body: string; payload?: Record<string, unknown>; read: boolean; createdAt: string; }
interface Inbox { unread: number; items: Notification[]; groups?: Record<string, Notification[]>; }
interface Pref { type: string; enabled: boolean; category?: string; label?: string; }
const hrefFor = (n: Notification) => n.resourceType === "COUPON_RIGHT" ? String(n.payload?.href ?? `/coupons?right=${n.resourceId}`) : n.resourceType === "SCHEME" ? `/schemes/${n.resourceId}` : n.resourceType === "PIECE" ? `/pieces/${n.resourceId}` : n.resourceType === "CHALLENGE" ? `/challenges/${n.resourceId}` : n.resourceType === "USER" && n.actor ? `/u/${n.actor.username}` : null;

function Inbox() {
  const { t, relative } = useI18n(); const toast = useToast(); const [tab, setTab] = useState<"inbox" | "prefs">("inbox"); const [cat, setCat] = useState("ALL");
  const { data, loading, error, reload } = useApi<Inbox>((signal) => api.get("/api/notifications", { signal }), []);
  const prefs = useApi<Pref[]>((signal) => api.get("/api/notifications/preferences", { signal }), [], { enabled: tab === "prefs" });
  async function markAll() { try { await api.post("/api/notifications/read-all"); reload(); } catch (e) { toast.fromError(e); } }
  async function markOne(id: string) { try { await api.post("/api/notifications/read", { ids: [id] }); reload(); } catch (e) { toast.fromError(e); } }
  async function togglePref(p: Pref) { try { prefs.setData(await api.put<Pref[]>("/api/notifications/preferences", { changes: { [p.type]: !p.enabled } })); } catch (e) { toast.fromError(e); } }
  async function master(v: boolean) { try { prefs.setData(await api.put<Pref[]>("/api/notifications/preferences", { changes: {}, master: v })); } catch (e) { toast.fromError(e); } }
  const items = (data?.items ?? []).filter((n) => cat === "ALL" || n.category === cat);
  const cats = Array.from(new Set((data?.items ?? []).map((n) => n.category)));
  return (
    <>
      <PageHeader title={t("nav.notifications")} lead={data ? `${data.unread} não lidas` : undefined} actions={<Button size="sm" onClick={markAll}>Marcar todas como lidas</Button>} />
      <Tabs tabs={[{ id: "inbox", label: "Caixa de entrada", count: data?.unread }, { id: "prefs", label: t("settings.notifications") }]} value={tab} onChange={setTab} />
      {tab === "inbox" && (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">{["ALL", ...cats].map((c) => <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c === "ALL" ? t("common.all") : c}</button>)}</div>
          {error && <ErrorState error={error} onRetry={reload} />}
          {loading && <Skeleton className="h-64" />}
          {!loading && items.length === 0 && <EmptyState title={t("common.empty")} />}
          <ul className="surface divide-y divide-line-soft">{items.map((n) => { const href = hrefFor(n); return (
            <li key={n.id} className={`flex items-start gap-3 p-3 ${n.read ? "" : "bg-thread-soft/40"}`}>
              <Avatar src={mediaUrl(n.actor?.avatarUrl)} name={n.actor?.displayName ?? n.category} size={36} />
              <div className="min-w-0 flex-1"><p className="type-body"><b>{n.title}</b> <span className="type-caption text-faint">· {relative(n.createdAt)} · {n.category}</span></p><p className="type-body-sm text-muted">{n.body}</p>
                <div className="mt-1 flex gap-2 type-caption">{href && <Link href={href} className="underline" onClick={() => !n.read && markOne(n.id)}>{t("common.see")}</Link>}{!n.read && <button type="button" className="underline" onClick={() => markOne(n.id)}>marcar como lida</button>}</div></div>
            </li>); })}</ul>
        </>
      )}
      {tab === "prefs" && (
        <Card>
          {prefs.loading && <Skeleton className="h-40" />}
          {prefs.data && (
            <>
              <Switch checked={prefs.data.some((p) => p.enabled)} onChange={master} label="Todas as notificações" />
              <ul className="divide-y divide-line-soft">{prefs.data.map((p) => <li key={p.type}><Switch checked={p.enabled} onChange={() => togglePref(p)} label={`${p.label ?? p.type.replace(/_/g, " ").toLowerCase()}${p.category ? ` · ${p.category}` : ""}`} /></li>)}</ul>
            </>
          )}
        </Card>
      )}
    </>
  );
}
export default function NotificationsPage() { return <RequireAuth><Inbox /></RequireAuth>; }
