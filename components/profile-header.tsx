"use client";
import type { ReactNode } from "react";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";

export interface ProfileCounts { pieces?: number; schemes?: number; followers?: number; following?: number }

/**
 * Header de perfil no formato do Instagram (RF14 pessoal · RF22 marca/celebridade): fundo branco, foto de perfil
 * redonda com anel, @ e ações na primeira linha, contadores (peças, esquemas criados, seguidores, seguindo) na
 * segunda, e nome + categoria + bio embaixo. No celular a foto fica à esquerda dos contadores e o texto desce.
 * O branco é fixo (pedido do layout), inclusive no tema escuro; o texto usa tinta escura própria para manter contraste.
 */
export function ProfileHeader({ photoUrl, photo, username, displayName, verified, kindLabel, category, bio, link, counts, actions, onCounts, cover }: {
  photoUrl?: string | null; photo?: ReactNode; username: string; displayName: string; verified?: boolean; kindLabel?: string; category?: string | null;
  bio?: string | null; link?: { href: string; label: string } | null; counts: ProfileCounts; actions?: ReactNode;
  onCounts?: (which: "followers" | "following") => void; cover?: string | null;
}) {
  const { fmtNumber, t } = useI18n();
  const stat = (n: number | undefined, label: string, which?: "followers" | "following") => {
    const body = <><span className="block text-[17px] font-semibold tabular leading-tight text-[#111]">{fmtNumber(n ?? 0)}</span><span className="block text-[13px] text-[#555]">{label}</span></>;
    return which && onCounts
      ? <button type="button" onClick={() => onCounts(which)} className="rounded px-1 text-center hover:bg-[#f2f2f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2D55C9]">{body}</button>
      : <div className="px-1 text-center">{body}</div>;
  };
  const avatar = photo ?? (photoUrl
    ? <img src={mediaUrl(photoUrl)} alt={t("profileHeader.foto_de_perfil_de", { displayName })} className="h-full w-full rounded-full object-cover" />
    : <span aria-hidden className="flex h-full w-full items-center justify-center rounded-full bg-[#efefef] text-3xl font-semibold text-[#777]">{displayName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span>);
  return (
    <section aria-label={t("profileHeader.perfil_de", { displayName })} className="mb-4 overflow-hidden rounded-xl border border-[#dbdbdb] bg-white text-[#111]">
      {cover && <img src={mediaUrl(cover)} alt="" className="h-28 w-full object-cover sm:h-36" />}
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-3 p-4 sm:grid-cols-[auto_1fr] sm:gap-x-10 sm:p-6">
        {/* anel da foto (como o de stories), sem animação */}
        <div className="row-span-1 rounded-full p-[3px] sm:row-span-3" style={{ background: "conic-gradient(from 210deg, #F58529, #DD2A7B, #8134AF, #2D55C9, #F58529)" }}>
          <div className="rounded-full bg-white p-[3px]"><div className="h-[76px] w-[76px] sm:h-[140px] sm:w-[140px]">{avatar}</div></div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-normal text-[#111] sm:text-2xl">{username}</h1>
            {verified && <span title={t("profileHeader.verificado")} aria-label={t("profileHeader.verificado")} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0095F6] text-[11px] font-bold text-white">✓</span>}
            {kindLabel && <span className="rounded-full bg-[#efefef] px-2 py-0.5 text-[12px] text-[#333]">{kindLabel}</span>}
            <div className="hidden flex-wrap gap-2 sm:flex">{actions}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 sm:gap-x-8" role="list" aria-label={t("profileHeader.contadores_do_perfil")}>
            <div role="listitem">{stat(counts.pieces, "peças")}</div>
            <div role="listitem">{stat(counts.schemes, "esquemas")}</div>
            <div role="listitem">{stat(counts.followers, "seguidores", "followers")}</div>
            <div role="listitem">{stat(counts.following, "seguindo", "following")}</div>
          </div>
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
          <p className="text-[14px] font-semibold text-[#111]">{displayName}</p>
          {category && <p className="text-[14px] text-[#737373]">{category}</p>}
          {bio && <p className="whitespace-pre-line text-[14px] text-[#111]">{bio}</p>}
          {link && <a href={link.href} target="_blank" rel="noreferrer" className="text-[14px] font-semibold text-[#00376B] hover:underline">{link.label}</a>}
        </div>
        {actions && <div className="col-span-2 flex flex-wrap gap-2 sm:hidden">{actions}</div>}
      </div>
    </section>
  );
}
