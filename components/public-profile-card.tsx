"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { HypeGroupBadge } from "@/components/hype/hype-group-badge";
import { mediaUrl } from "@/lib/api/client";
import { publicProfileLinks, type PublicProfileSummary } from "@/lib/api/public-profiles";
import { useI18n } from "@/lib/i18n/i18n";

/** Mesma hierarquia visual do feed de marcas, com os dados públicos do perfil pessoal. */
export function PublicProfileCard({ profile }: { profile: PublicProfileSummary }) {
  const { t, fmtNumber, intl } = useI18n();
  const href = `/u/${encodeURIComponent(profile.username)}`;
  const name = profile.displayName || profile.username;
  const photo = mediaUrl(profile.avatarUrl);
  const cover = mediaUrl(profile.coverUrl);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const visibility = profile.visibility ?? (profile.privateAccount ? "PRIVATE" : "PUBLIC");
  const visibilityLabel = visibility === "FOLLOWERS" ? t("institutionalProfile.visibility.FOLLOWERS")
    : t(visibility === "PRIVATE" ? "common.private" : "common.public");
  const country = profile.country && /^[A-Z]{2}$/i.test(profile.country)
    ? new Intl.DisplayNames([intl], { type: "region" }).of(profile.country.toUpperCase()) ?? profile.country : profile.country;
  const counts = [
    { label: t("common.pieces"), value: profile.counters?.pieces },
    { label: t("profileHeader.looks"), value: profile.counters?.schemes },
    { label: t("profileHeader.followers"), value: profile.counters?.followers },
    { label: t("profileHeader.following"), value: profile.counters?.following },
  ];
  const links = publicProfileLinks(profile.links);
  return (
    <article className="institutional-profile-card surface" aria-label={t("profileHeader.perfil_de", { displayName: name })}>
      <div className="institutional-profile-cover" aria-hidden="true">
        {cover && cover !== failedCover && <img src={cover} alt="" loading="lazy" onError={() => setFailedCover(cover)} />}
      </div>
      <div className="institutional-profile-content">
        <header className="institutional-profile-heading">
          <Link href={href} className="institutional-profile-avatar-link" aria-label={t("profileHeader.perfil_de", { displayName: name })}>
            <span className="institutional-profile-avatar">
              {photo && photo !== failedPhoto
                ? <img src={photo} alt={t("profileHeader.foto_de_perfil_de", { displayName: name })} loading="lazy" onError={() => setFailedPhoto(photo)} />
                : <span className="institutional-profile-monogram" aria-hidden="true">{name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase()}</span>}
            </span>
          </Link>
          <div className="institutional-profile-identity">
            <Link href={href} className="institutional-profile-name-link"><h2 className="type-h3">{name}</h2><span className="institutional-profile-username">@{profile.username}</span></Link>
            <div className="institutional-profile-badges">
              <Badge tone="chalk">{t("publicProfile.kind")}</Badge>
              {profile.verified && <Badge tone="thread"><span aria-hidden="true">✓</span>{t("profileHeader.verificado")}</Badge>}
              <span title={t("common.visibility")}><Badge>{visibilityLabel}</Badge></span>
              {profile.relation === "ACEITO" && <Badge>{t("publicProfile.following")}</Badge>}
              {profile.relation === "PENDENTE" && <Badge>{t("publicProfile.requested")}</Badge>}
            </div>
          </div>
        </header>
        <dl className="institutional-profile-stats" aria-label={t("profileHeader.contadores_do_perfil")}>
          {counts.map((count) => <div key={count.label}><dt>{count.label}</dt><dd className="tabular">{fmtNumber(count.value)}</dd></div>)}
        </dl>
        {(profile.pronouns || country) && <div className="institutional-profile-category type-body-sm">
          {profile.pronouns && <span>{profile.pronouns}</span>}{country && <span title={t("auth.country")}>{country}</span>}
        </div>}
        {profile.bio && <p className="institutional-profile-bio type-body-sm">{profile.bio}</p>}
        {links.length > 0 && <div className="flex flex-wrap gap-3">
          {links.map((link, index) => <a key={`${link.href}-${index}`} href={link.href} target="_blank" rel="noopener noreferrer" className="institutional-profile-store-link"><span>{link.title}</span><span aria-hidden="true">↗</span></a>)}
        </div>}
        <div className="institutional-profile-signals"><HypeGroupBadge type="CREATOR" groupKey={profile.id} variant="header" /></div>
        {profile.contentVisible === false && <p className="type-body-sm text-muted">{t("publicProfile.restricted")}</p>}
        <footer className="institutional-profile-actions"><Link href={href} className="btn btn-sm">{t("common.ver_perfil")}<span aria-hidden="true">→</span></Link></footer>
      </div>
    </article>
  );
}
