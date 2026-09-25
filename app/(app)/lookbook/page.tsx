"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { mediaUrl } from "@/lib/api/client";
import { RequireAuth } from "@/components/app-shell";
import { Avatar, PageHeader } from "@/components/ui";
import { LookbookTabs } from "@/components/lookbook-tabs";
import { FaiIcon } from "@/components/fai-icon";
import { EditProfileButton } from "@/components/edit-profile";

function Lookbook() {
  const { user, me } = useAuth(); const { t } = useI18n();
  if (!user) return null;
  return (
    <>
      <PageHeader kicker="RF6" title={t("nav.lookbook")} lead={me?.bio ?? undefined} actions={<><Link href={`/u/${user.username}`} className="btn btn-sm">{t("lookbook.ver_como_visitante")}</Link><Link href="/settings" className="btn btn-sm"><FaiIcon id="NAV-14" size={24} decorative />{t("nav.settings")}</Link></>} />
      {/* foto de perfil gerenciável também no Lookbook: abaixo da foto, "Editar perfil" com os campos do Instagram */}
      <div className="mb-4 flex items-center gap-4"><Avatar src={mediaUrl(user.avatarUrl)} name={user.displayName} size={72} /><div><p className="type-h2">{user.displayName}</p><p className="type-body text-muted">@{user.username}{me?.pronouns ? ` · ${me.pronouns}` : ""} · {user.profileType}</p><div className="mt-1"><EditProfileButton /></div></div></div>
      <LookbookTabs ownerId={user.id} initialTab={typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "cupons" ? "coupons" : "closet"} />
    </>
  );
}
export default function LookbookPage() { return <RequireAuth><Lookbook /></RequireAuth>; }
