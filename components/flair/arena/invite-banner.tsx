"use client";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n";

/** Quem chegou por um convite da rede FAI (?rival=…&alvo=…): lembra quem convidou e o placar a superar. */
export function useInvite(): { rival: string | null; target: number | null } {
  const sp = useSearchParams();
  const rival = (sp?.get("rival") ?? "").replace(/^@/, "").trim();
  const alvo = Number(sp?.get("alvo"));
  return { rival: /^[\w.-]{1,40}$/.test(rival) ? rival : null, target: Number.isFinite(alvo) && alvo > 0 ? Math.round(alvo) : null };
}

export function InviteBanner() {
  const { t } = useI18n();
  const { rival, target } = useInvite();
  if (!rival) return null;
  return <p className="mode-banner" role="status">{target != null ? t("flair.arena.convite_alvo", { user: rival, n: target }) : t("flair.arena.convite_de", { user: rival })}</p>;
}
