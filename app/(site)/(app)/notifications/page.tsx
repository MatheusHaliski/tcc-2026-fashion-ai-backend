"use client";
import { useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import type { UserCard } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Avatar, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, Switch, Tabs, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

const CATEGORY_ICON: Record<string, string> = { ACHIEVEMENT: "ACT-39", SOCIAL: "SOC-12", SECURITY: "ACT-04", SYSTEM: "NAV-14" };

interface Notification { id: string; type: string; category: string; actor?: UserCard | null; resourceType?: string; resourceId?: string; title: string; body: string; payload?: Record<string, unknown>; read: boolean; createdAt: string; }
interface Inbox { unread: number; items: Notification[]; groups?: Record<string, Notification[]>; }
interface Pref { type: string; enabled: boolean; category?: string; label?: string; }
/** Destino de "Ver": o link que o servidor mandou no payload (caminho interno) ou o recurso da notificação. */
const payloadHref = (n: Notification) => (typeof n.payload?.href === "string" && n.payload.href.startsWith("/") && !n.payload.href.startsWith("//") ? n.payload.href : null);
const hrefFor = (n: Notification) => n.resourceType === "COUPON_RIGHT" ? String(n.payload?.href ?? `/coupons?right=${n.resourceId}`) : payloadHref(n) ? payloadHref(n) : n.resourceType === "SCHEME" ? `/schemes/${n.resourceId}` : n.resourceType === "PIECE" ? `/pieces/${n.resourceId}` : n.resourceType === "CHALLENGE" ? `/challenges/${n.resourceId}` : n.resourceType === "USER" && n.actor ? `/u/${n.actor.username}` : null;

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
  const catLabel = (c: string) => { const k = `notifications.category.${c}`; const v = t(k); return v === k ? c.charAt(0) + c.slice(1).toLowerCase() : v; };
  async function markMany(ids: string[]) { try { await api.post("/api/notifications/read", { ids }); reload(); } catch (e) { toast.fromError(e); } }
  // Conquistas do mesmo dia viram um item só ("7 novas conquistas"), para não soterrar o que é pessoal.
  type Row = { kind: "one"; item: Notification } | { kind: "group"; key: string; items: Notification[] };
  const grouped: Row[] = [];
  for (const n of items) {
    const day = n.createdAt.slice(0, 10);
    const last = grouped[grouped.length - 1];
    if (n.category === "ACHIEVEMENT" && last?.kind === "group" && last.key === `ach-${day}`) last.items.push(n);
    else if (n.category === "ACHIEVEMENT") grouped.push({ kind: "group", key: `ach-${day}`, items: [n] });
    else grouped.push({ kind: "one", item: n });
  }
  for (let i = 0; i < grouped.length; i++) { const g = grouped[i]; if (g.kind === "group" && g.items.length === 1) grouped[i] = { kind: "one", item: g.items[0] }; }
  return (
    <>
      <PageHeader title={t("nav.notifications")} lead={data ? t("notifications.nao_lidas", { unread: data.unread }) : undefined} actions={<Button size="sm" onClick={markAll}>{t("notifications.marcar_todas_como_lidas")}</Button>} />
      <Tabs tabs={[{ id: "inbox", label: t("notifications.caixa_de_entrada"), count: data?.unread }, { id: "prefs", label: t("settings.notifications") }]} value={tab} onChange={setTab} />
      {tab === "inbox" && (
        <>
          <div className="chip-scroll mb-3" role="group" aria-label={t("notifications.filterLabel")}>{["ALL", ...cats].map((c) => <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c === "ALL" ? t("common.all") : catLabel(c)}</button>)}</div>
          {error && <ErrorState error={error} onRetry={reload} />}
          {loading && <Skeleton className="h-64" />}
          {!loading && items.length === 0 && <EmptyState title={t("common.empty")} />}
          <ul className="fai-list surface">{grouped.map((g) => g.kind === "group" ? (
            <li key={g.key} className={`p-3 ${g.items.some((n) => !n.read) ? "bg-thread-soft/40" : ""}`}>
              <details>
                <summary className="notif-summary">
                  <span className="notif-icon"><FaiIcon id="ACT-39" size={28} decorative /></span>
                  <span className="min-w-0 flex-1"><b>{t("notifications.achievementsGroup", { count: g.items.length })}</b><span className="block type-caption text-muted">{relative(g.items[0].createdAt)} · {g.items.slice(0, 2).map((n) => n.title).join(" · ")}{g.items.length > 2 ? "…" : ""}</span></span>
                </summary>
                <ul className="fai-list mt-2 pl-12">{g.items.map((n) => <li key={n.id} className="type-body-sm"><b>{n.title}</b> <span className="text-muted">{n.body}</span></li>)}</ul>
                {g.items.some((n) => !n.read) && <button type="button" className="btn btn-sm btn-ghost mt-2 ml-10" onClick={() => markMany(g.items.filter((n) => !n.read).map((n) => n.id))}>{t("notifications.marcar_como_lida")}</button>}
              </details>
            </li>
          ) : (() => { const n = g.item; const href = hrefFor(n); return (
            <li key={n.id} className={`flex items-start gap-3 p-3 ${n.read ? "" : "bg-thread-soft/40"}`}>
              {n.actor ? <Avatar src={mediaUrl(n.actor.avatarUrl)} name={n.actor.displayName} size={40} /> : <span className="notif-icon"><FaiIcon id={CATEGORY_ICON[n.category] ?? "ACT-03"} size={28} decorative /></span>}
              <div className="min-w-0 flex-1"><p className="type-body"><b>{n.title}</b></p><p className="type-body-sm text-muted">{n.body}</p>
                <p className="mt-0.5 type-caption text-muted">{relative(n.createdAt)} · {catLabel(n.category)}{!n.read && <span className="sr-only"> · {t("notifications.unread")}</span>}</p>
                <div className="mt-1 flex gap-3 type-body-sm">{href && <Link href={href} className="font-semibold underline" onClick={() => !n.read && markOne(n.id)}>{t("common.see")}</Link>}{!n.read && <button type="button" className="underline" onClick={() => markOne(n.id)}>{t("notifications.marcar_como_lida")}</button>}</div></div>
            </li>); })())}</ul>
        </>
      )}
      {tab === "prefs" && (
        <Card>
          {prefs.loading && <Skeleton className="h-40" />}
          {prefs.data && (
            <>
              <Switch checked={prefs.data.some((p) => p.enabled)} onChange={master} label={t("notifications.todas_as_notificacoes")} />
              <ul className="fai-list">{prefs.data.map((p) => <li key={p.type}><Switch checked={p.enabled} onChange={() => togglePref(p)} label={`${p.label ?? p.type.replace(/_/g, " ").toLowerCase()}${p.category ? ` · ${catLabel(p.category)}` : ""}`} /></li>)}</ul>
            </>
          )}
        </Card>
      )}
    </>
  );
}
export default function NotificationsPage() { return <RequireAuth><Inbox /></RequireAuth>; }
