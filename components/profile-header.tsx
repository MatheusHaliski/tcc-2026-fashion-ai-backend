"use client";
import type { ReactNode } from "react";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";

import {ProfileLevelProgress,type LevelProgress} from "./profile-level-progress";

export interface ProfileCounts { pieces?: number; schemes?: number; followers?: number; following?: number }

/**
 * Header de perfil no formato do Instagram (RF14 pessoal · RF22 marca/celebridade): fundo branco, foto de perfil
 * redonda com anel, @ e ações na primeira linha, contadores (peças, esquemas criados, seguidores, seguindo) na
 * segunda, e nome + categoria + bio embaixo. No celular a foto fica à esquerda dos contadores e o texto desce.
 * A superfície e a tinta seguem os tokens do tema; o anel mantém a identidade visual.
 * `hype` (RF53 · Lote A1): o Hype agregado do criador ou da marca (HypeGroupBadge "header"), logo abaixo da categoria;
 * quando o agregado não tem base, o próprio componente não desenha nada.
 */
export function ProfileHeader({ photoUrl, photo, username, displayName, verified, kindLabel, category, bio, link, counts, actions, onCounts, cover, hype, levelProgress }: {
  photoUrl?: string | null; photo?: ReactNode; username: string; displayName: string; verified?: boolean; kindLabel?: string; category?: string | null;
  bio?: string | null; link?: { href: string; label: string } | null; counts: ProfileCounts; actions?: ReactNode;
  onCounts?: (which: "followers" | "following") => void; cover?: string | null; hype?: ReactNode; levelProgress?: LevelProgress | null;
}) {
  const { fmtNumber, t } = useI18n();
  const stat = (n: number | undefined, label: string, which?: "followers" | "following") => {
    const body = <><span className="block text-[17px] font-semibold tabular leading-tight text-ink">{fmtNumber(n ?? 0)}</span><span className="block text-[13px] text-muted">{label}</span></>;
    return which && onCounts
      ? <button type="button" onClick={() => onCounts(which)} className="rounded px-1 text-center hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">{body}</button>
      : <div className="px-1 text-center">{body}</div>;
  };
  const avatar = photo ?? (photoUrl
    ? <img src={mediaUrl(photoUrl)} alt={t("profileHeader.foto_de_perfil_de", { displayName })} className="h-full w-full rounded-full object-cover" />
    : <span aria-hidden className="flex h-full w-full items-center justify-center rounded-full bg-surface-2 text-3xl font-semibold text-muted">{displayName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span>);
  return (
    <section aria-label={t("profileHeader.perfil_de", { displayName })} className="mb-4 overflow-hidden rounded-xl border border-line-soft bg-surface text-ink">
      {cover && <img src={mediaUrl(cover)} alt="" className="h-28 w-full object-cover sm:h-36" />}
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-3 p-4 sm:grid-cols-[auto_1fr] sm:gap-x-10 sm:p-6">
        {/* anel da foto (como o de stories), sem animação */}
        <div className="row-span-1 rounded-full p-[3px] sm:row-span-3" style={{ background: "conic-gradient(from 210deg, #F58529, #DD2A7B, #8134AF, #2D55C9, #F58529)" }}>
          <div className="rounded-full bg-surface p-[3px]"><div className="h-[76px] w-[76px] sm:h-[140px] sm:w-[140px]">{avatar}</div></div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="type-h1 break-words text-ink">{username}</h1>
            {verified && <span title={t("profileHeader.verificado")} aria-label={t("profileHeader.verificado")} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0067ac] text-xs font-bold text-white">✓</span>}
            {kindLabel && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[12px] text-ink">{kindLabel}</span>}
            <div className="hidden flex-wrap gap-2 sm:flex">{actions}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 sm:gap-x-8" role="list" aria-label={t("profileHeader.contadores_do_perfil")}>
            <div role="listitem">{stat(counts.pieces, t("common.pieces"))}</div>
            <div role="listitem">{stat(counts.schemes, t("profileHeader.looks"))}</div>
            <div role="listitem">{stat(counts.followers, t("profileHeader.followers"), "followers")}</div>
            <div role="listitem">{stat(counts.following, t("profileHeader.following"), "following")}</div>
          </div>
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
          <p className="text-[14px] font-semibold text-ink">{displayName}</p>
          {category && <p className="text-[14px] text-muted">{category}</p>}
          {levelProgress&&<ProfileLevelProgress progress={levelProgress}/>}
          {hype && <div className="profile-header-hype">{hype}</div>}
          {bio && <p className="whitespace-pre-line text-[14px] text-ink">{bio}</p>}
          {link && <a href={link.href} target="_blank" rel="noreferrer" className="text-[14px] font-semibold text-ink underline">{link.label}</a>}
        </div>
        {actions && <div className="col-span-2 flex flex-wrap gap-2 sm:hidden">{actions}</div>}
      </div>
    </section>
  );
}
