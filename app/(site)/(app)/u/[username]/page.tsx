"use client";
import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import type { UserCard } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { ActionMenu, Avatar, Button, Dialog, EmptyState, ErrorState, Skeleton, useToast } from "@/components/ui";
import { LookbookTabs, type TabId } from "@/components/lookbook-tabs";
import { FaiIcon } from "@/components/fai-icon";
import { ProfileHeader } from "@/components/profile-header";
import { EditProfileButton } from "@/components/edit-profile";

interface Profile { user: UserCard; bio?: string | null; pronouns?: string | null; links?: { title: string; url: string }[]; coverUrl?: string | null; layout: "PESSOAL" | "INSTITUCIONAL"; self: boolean; relation: string; counters: { followers: number; following: number; published: number; pieces?: number; schemes?: number }; visibility: string; contentVisible: boolean; invite?: { message: string; action?: string }; }

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const username = encodeURIComponent(use(params).username);   /* vai direto para caminhos da API */ const { t } = useI18n(); const initialTab = useSearchParams().get("tab"); const { user } = useAuth(); const toast = useToast();
  const { data, loading, error, reload } = useApi<Profile>((signal) => api.get(`/api/profiles/${encodeURIComponent(username)}`, { signal, anonymous: !user }), [username, !!user]);
  const [conn, setConn] = useState(false); const [confirmBlock, setConfirmBlock] = useState(false);
  const connections = useApi<{ followers: UserCard[]; following: UserCard[] }>((signal) => api.get(`/api/users/${data?.user.id}/connections`, { signal, anonymous: !user }), [data?.user.id], { enabled: conn && !!data });
  async function follow() { if (!data) return; try { if (data.relation === "ACEITO" || data.relation === "PENDENTE") await api.delete(`/api/users/${data.user.id}/followers/me`); else await api.post(`/api/users/${data.user.id}/followers`); reload(); } catch (e) { toast.fromError(e); } }
  async function block() { if (!data) return; try { await api.put(`/api/users/${data.user.id}/block`, { blocked: data.relation !== "BLOQUEADO" }); reload(); } catch (e) { toast.fromError(e); } }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-64" />;
  // Marca e celebridade têm página oficial própria: vai direto para ela, sem tela intermediária.
  if (data.layout === "INSTITUCIONAL") return <InstitutionalRedirect slug={data.user.username} />;
  const following = data.relation === "ACEITO";
  return (
    <>
      <ProfileHeader photoUrl={data.user.avatarUrl} username={data.user.username} displayName={data.user.displayName} verified={data.user.verified}
        category={[data.pronouns, t("profile.type.PESSOAL"), data.user.country].filter(Boolean).join(" · ")} bio={data.bio} cover={data.coverUrl}
        link={data.links?.[0] ? { href: data.links[0].url, label: data.links[0].title || data.links[0].url.replace(/^https?:\/\//, "") } : null}
        counts={{ pieces: data.counters.pieces, schemes: data.counters.schemes, followers: data.counters.followers, following: data.counters.following }}
        onCounts={() => setConn(true)}
        actions={<>
          {!data.self && user && <>
            <Button size="sm" variant={following || data.relation === "PENDENTE" ? "default" : "primary"} onClick={follow} aria-pressed={following}>{following ? t("lookbook.unfollow") : data.relation === "PENDENTE" ? t("lookbook.requested") : t("lookbook.follow")}</Button>
            <ActionMenu label={t("common.moreOptions")} items={[
              { label: data.relation === "BLOQUEADO" ? t("u.username.desbloquear") : t("profile.blockUser", { username: data.user.username }), danger: data.relation !== "BLOQUEADO", onSelect: () => data.relation === "BLOQUEADO" ? block() : setConfirmBlock(true) },
              { label: t("profile.copyLink"), onSelect: () => { navigator.clipboard?.writeText(window.location.href).then(() => toast.success(t("common.copied"))).catch(() => undefined); } },
            ]} />
          </>}
          {data.self && <><EditProfileButton /><Link href="/settings" className="btn btn-sm">{t("nav.settings")}</Link><Link href="/explorer?tab=passarela" className="btn btn-sm">{t("common.passarela_3d")}</Link></>}
        </>} />
      {!data.contentVisible
        ? <EmptyState title={t("profile.privateTitle")} hint={data.invite?.message ?? t("u.username.este_perfil_e_privado")} action={user && !data.self && data.relation !== "PENDENTE" ? <Button variant="primary" onClick={follow}>{t("profile.requestFollow")}</Button> : !user ? <Link href="/login" className="btn btn-primary">{t("nav.login")}</Link> : undefined} />
        : <LookbookTabs ownerId={data.user.id} initialTab={profileTab(initialTab, data.self)} initialSaved={initialTab === "saved_pieces" ? "pieces" : "looks"} />}
      {data && data.self && (initialTab === "cupons" || initialTab === "coupons") && <CouponsRedirect />}
      <Dialog open={confirmBlock} onClose={() => setConfirmBlock(false)} title={t("profile.blockTitle", { username: data.user.username })}
        footer={<><Button onClick={() => setConfirmBlock(false)}>{t("common.cancel")}</Button><Button variant="danger" onClick={() => { setConfirmBlock(false); block(); }}>{t("lookbook.block")}</Button></>}>
        <p className="type-body">{t("profile.blockBody")}</p>
      </Dialog>
      <Dialog open={conn} onClose={() => setConn(false)} title={t("u.username.conexoes")}>
        {connections.loading ? <Skeleton className="h-32" /> : <div className="grid gap-4 sm:grid-cols-2">{(["followers", "following"] as const).map((k) => <div key={k}><p className="label">{t(`lookbook.${k}`)}</p><ul className="fai-list">{(connections.data?.[k] ?? []).map((u) => <li key={u.id} className="flex items-center gap-2 py-1"><Avatar src={mediaUrl(u.avatarUrl)} name={u.displayName} size={28} /><Link href={`/u/${u.username}`} className="underline">@{u.username}</Link></li>)}</ul></div>)}</div>}
      </Dialog>
    </>
  );
}

function InstitutionalRedirect({ slug }: { slug: string }) {
  const router = useRouter(); const { t } = useI18n();
  useEffect(() => { router.replace(`/brands/${slug}`); }, [router, slug]);
  return <p className="type-body text-muted" role="status">{t("common.loading")}</p>;
}

/**
 * Aba pedida na URL (?tab=): as públicas para todos; as do dono só para o dono. Ids antigos continuam valendo:
 * saved_looks/saved_pieces → Salvos; cupons/coupons → /coupons (a aba duplicava a página de cupons e saiu do Lookbook).
 */
function profileTab(tab: string | null, self: boolean): TabId {
  const t = tab === "saved_looks" || tab === "saved_pieces" ? "saved" : tab;
  if (t === "closet" || t === "looks" || t === "groups") return t;
  if (self && (t === "dna" || t === "saved" || t === "daily" || t === "capsule" || t === "insights")) return t;
  return "closet";
}
function CouponsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/coupons"); }, [router]);
  return null;
}
