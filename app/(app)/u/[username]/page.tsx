"use client";
import { use, useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import type { UserCard } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { Avatar, Button, Card, Dialog, ErrorState, Skeleton, useToast } from "@/components/ui";
import { LookbookTabs } from "@/components/lookbook-tabs";
import { FaiIcon } from "@/components/fai-icon";

interface Profile { user: UserCard; bio?: string | null; coverUrl?: string | null; layout: "PESSOAL" | "INSTITUCIONAL"; self: boolean; relation: string; counters: { followers: number; following: number; published: number }; visibility: string; contentVisible: boolean; invite?: { message: string; action?: string }; }

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params); const { t } = useI18n(); const { user } = useAuth(); const toast = useToast();
  const { data, loading, error, reload } = useApi<Profile>((signal) => api.get(`/api/profiles/${encodeURIComponent(username)}`, { signal, anonymous: !user }), [username, !!user]);
  const [conn, setConn] = useState(false);
  const connections = useApi<{ followers: UserCard[]; following: UserCard[] }>((signal) => api.get(`/api/users/${data?.user.id}/connections`, { signal, anonymous: !user }), [data?.user.id], { enabled: conn && !!data });
  async function follow() { if (!data) return; try { if (data.relation === "ACEITO" || data.relation === "PENDENTE") await api.delete(`/api/users/${data.user.id}/followers/me`); else await api.post(`/api/users/${data.user.id}/followers`); reload(); } catch (e) { toast.fromError(e); } }
  async function block() { if (!data) return; try { await api.put(`/api/users/${data.user.id}/block`, { blocked: data.relation !== "BLOQUEADO" }); reload(); } catch (e) { toast.fromError(e); } }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-64" />;
  if (data.layout === "INSTITUCIONAL") return <Card><p className="type-body">Perfil institucional. <Link className="underline" href={`/brands/${data.user.username}`}>Abrir página da marca/celebridade →</Link></p></Card>;
  const following = data.relation === "ACEITO";
  return (
    <>
      {data.coverUrl && <img src={mediaUrl(data.coverUrl)} alt="" className="mb-4 h-40 w-full rounded-lg object-cover" />}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Avatar src={mediaUrl(data.user.avatarUrl)} name={data.user.displayName} size={72} />
        <div className="min-w-0 flex-1"><h1 className="type-display">{data.user.displayName}{data.user.verified && " ✓"}</h1><p className="type-body text-muted">@{data.user.username}{data.user.country ? ` · ${data.user.country}` : ""}</p>{data.bio && <p className="type-body mt-1">{data.bio}</p>}
          <p className="mt-1 type-body-sm tabular"><button type="button" className="underline" onClick={() => setConn(true)}>{data.counters.followers} {t("lookbook.followers")}</button> · <button type="button" className="underline" onClick={() => setConn(true)}>{data.counters.following} {t("lookbook.following")}</button> · {data.counters.published} {t("common.looks")}</p></div>
        {!data.self && user && <div className="flex gap-2"><Button variant={following ? "default" : "primary"} onClick={follow}><FaiIcon id="SOC-12" size={24} active={following} decorative />{following ? t("lookbook.unfollow") : data.relation === "PENDENTE" ? t("lookbook.requested") : t("lookbook.follow")}</Button><Button variant="ghost" onClick={block}>{data.relation === "BLOQUEADO" ? "Desbloquear" : t("lookbook.block")}</Button></div>}
        {data.self && <Link href="/settings" className="btn">{t("common.edit")}</Link>}
      </div>
      {!data.contentVisible ? <Card><p className="type-body">{data.invite?.message ?? "Este perfil é privado."}</p></Card> : <LookbookTabs ownerId={data.user.id} />}
      <Dialog open={conn} onClose={() => setConn(false)} title="Conexões">
        {connections.loading ? <Skeleton className="h-32" /> : <div className="grid gap-4 sm:grid-cols-2">{(["followers", "following"] as const).map((k) => <div key={k}><p className="label">{t(`lookbook.${k}`)}</p><ul className="divide-y divide-line-soft">{(connections.data?.[k] ?? []).map((u) => <li key={u.id} className="flex items-center gap-2 py-1"><Avatar src={mediaUrl(u.avatarUrl)} name={u.displayName} size={28} /><Link href={`/u/${u.username}`} className="underline">@{u.username}</Link></li>)}</ul></div>)}</div>}
      </Dialog>
    </>
  );
}
