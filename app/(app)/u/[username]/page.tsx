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
import { ProfileHeader } from "@/components/profile-header";
import { EditProfileButton } from "@/components/edit-profile";

interface Profile { user: UserCard; bio?: string | null; pronouns?: string | null; links?: { title: string; url: string }[]; coverUrl?: string | null; layout: "PESSOAL" | "INSTITUCIONAL"; self: boolean; relation: string; counters: { followers: number; following: number; published: number; pieces?: number; schemes?: number }; visibility: string; contentVisible: boolean; invite?: { message: string; action?: string }; }

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
      <ProfileHeader photoUrl={data.user.avatarUrl} username={data.user.username} displayName={data.user.displayName} verified={data.user.verified}
        category={[data.pronouns, data.user.country ? `Pessoal · ${data.user.country}` : "Pessoal"].filter(Boolean).join(" · ")} bio={data.bio} cover={data.coverUrl}
        link={data.links?.[0] ? { href: data.links[0].url, label: data.links[0].title || data.links[0].url.replace(/^https?:\/\//, "") } : null}
        counts={{ pieces: data.counters.pieces, schemes: data.counters.schemes, followers: data.counters.followers, following: data.counters.following }}
        onCounts={() => setConn(true)}
        actions={<>
          {!data.self && user && <><Button size="sm" variant={following ? "default" : "primary"} onClick={follow}><FaiIcon id="SOC-12" size={24} active={following} decorative />{following ? t("lookbook.unfollow") : data.relation === "PENDENTE" ? t("lookbook.requested") : t("lookbook.follow")}</Button><Button size="sm" variant="ghost" onClick={block}>{data.relation === "BLOQUEADO" ? "Desbloquear" : t("lookbook.block")}</Button></>}
          {data.self && <><EditProfileButton /><Link href="/explorer?tab=passarela" className="btn btn-sm">Passarela 3D</Link></>}
        </>} />
      {!data.contentVisible ? <Card><p className="type-body">{data.invite?.message ?? "Este perfil é privado."}</p></Card> : <LookbookTabs ownerId={data.user.id} />}
      <Dialog open={conn} onClose={() => setConn(false)} title="Conexões">
        {connections.loading ? <Skeleton className="h-32" /> : <div className="grid gap-4 sm:grid-cols-2">{(["followers", "following"] as const).map((k) => <div key={k}><p className="label">{t(`lookbook.${k}`)}</p><ul className="divide-y divide-line-soft">{(connections.data?.[k] ?? []).map((u) => <li key={u.id} className="flex items-center gap-2 py-1"><Avatar src={mediaUrl(u.avatarUrl)} name={u.displayName} size={28} /><Link href={`/u/${u.username}`} className="underline">@{u.username}</Link></li>)}</ul></div>)}</div>}
      </Dialog>
    </>
  );
}
