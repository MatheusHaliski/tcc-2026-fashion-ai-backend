"use client";
import { useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import type { UserCard } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { Avatar, Button, Card, useToast } from "@/components/ui";

interface FollowRequest { id: string; user: UserCard; at: string }

/**
 * Pedidos para seguir (perfil Seguidores ou Privado): aceitar ou recusar. Sem esta lista os pedidos ficavam pendentes
 * para sempre — o servidor já tinha as rotas, a tela não. Com o perfil Privado, aceitar não abre o conteúdo: o aviso
 * diz isso e leva às configurações.
 */
export function FollowRequests({ onChange }: { onChange?: () => void }) {
  const { t, relative } = useI18n(); const toast = useToast(); const { me } = useAuth();
  const { data, reload } = useApi<FollowRequest[]>((signal) => api.get("/api/me/follow-requests", { signal }), []);
  const [busy, setBusy] = useState<string | null>(null);
  async function respond(r: FollowRequest, accept: boolean) {
    setBusy(r.id);
    try {
      await api.post(`/api/follow-requests/${r.id}`, { accept });
      toast.success(t(accept ? "followRequests.aceito" : "followRequests.recusado", { username: r.user.username }));
      reload(); onChange?.();
    } catch (e) { toast.fromError(e); } finally { setBusy(null); }
  }
  if (!data || data.length === 0) return null;
  const privateProfile = me?.profileVisibility === "PRIVATE";
  return (
    <Card>
      <h2 id="follow-requests" className="type-h3">{t("followRequests.titulo", { count: data.length })}</h2>
      {privateProfile && <p role="note" className="type-caption text-muted">{t("followRequests.perfil_privado")} <Link href="/settings" className="underline">{t("profileNotice.mudar")}</Link></p>}
      <ul className="fai-list mt-2" aria-labelledby="follow-requests">{data.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
          <Avatar src={mediaUrl(r.user.avatarUrl)} name={r.user.displayName} size={36} />
          <span className="min-w-0 flex-1"><Link href={`/u/${r.user.username}`} className="font-semibold underline">@{r.user.username}</Link><span className="block type-caption text-muted">{relative(r.at)}</span></span>
          <Button size="sm" variant="primary" disabled={busy === r.id} onClick={() => respond(r, true)} aria-label={t("followRequests.aceitar_de", { username: r.user.username })}>{t("followRequests.aceitar")}</Button>
          <Button size="sm" disabled={busy === r.id} onClick={() => respond(r, false)} aria-label={t("followRequests.recusar_de", { username: r.user.username })}>{t("followRequests.recusar")}</Button>
        </li>
      ))}</ul>
    </Card>
  );
}

/** Aviso nos criadores quando o perfil não é público: "publicado" não quer dizer "visto por todo mundo". */
export function ProfileVisibilityNotice() {
  const { t } = useI18n(); const { me } = useAuth();
  const visibility = me?.profileVisibility;
  if (visibility !== "PRIVATE" && visibility !== "FOLLOWERS") return null;
  return <p role="note" className="after-save-detail type-caption">{t(`profileNotice.${visibility}`)} <Link href="/settings" className="underline">{t("profileNotice.mudar")}</Link></p>;
}
