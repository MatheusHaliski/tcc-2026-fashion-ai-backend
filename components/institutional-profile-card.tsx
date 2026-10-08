"use client";

import { useState } from "react";
import Link from "next/link";
import { HypeGroupBadge } from "@/components/hype/hype-group-badge";
import { Badge } from "@/components/ui";
import { mediaUrl } from "@/lib/api/client";
import type { InstitutionalProfileSummary } from "@/lib/api/institutional";
import { label } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";

export interface InstitutionalProfileCardProps {
  profile: InstitutionalProfileSummary;
  kind: "brands" | "celebrities";
}

function externalStore(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

/** Cabeçalho institucional no feed; os links de perfil, loja e Hype permanecem independentes. */
export function InstitutionalProfileCard({ profile, kind }: InstitutionalProfileCardProps) {
  const { t, fmtNumber, intl } = useI18n();
  const celebrity = kind === "celebrities";
  const kindLabel = t(celebrity ? "auth.profileCelebrity" : "auth.profileBrand");
  const username = profile.username ?? profile.user?.username ?? "";
  const name = [profile.name, profile.brandName, profile.stageName, username].find((value) => value?.trim()) ?? kindLabel;
  const profileKey = profile.slug ?? profile.username ?? profile.user?.username ?? profile.userId ?? profile.id ?? "";
  const profileHref = `/brands/${encodeURIComponent(profileKey)}`;
  const category = profile.category ?? profile.fashionCategory;
  const categories = category ? [label(category)] : (profile.areas ?? []).map((area) => label(area));
  const hashtag = profile.officialHashtag?.trim().replace(/^#+/, "");
  const visibility = profile.visibility
    ?? (profile.privateAccount === true ? "PRIVATE" : profile.privateAccount === false ? "PUBLIC" : null);
  const visibilityLabel = visibility === "FOLLOWERS"
    ? t("institutionalProfile.visibility.FOLLOWERS")
    : visibility === "PRIVATE" ? t("common.private") : visibility === "PUBLIC" ? t("common.public") : null;
  const store = externalStore(profile.storeUrl);
  const avatarCandidates = Array.from(new Set([
    profile.userAvatarUrl,
    profile.user?.avatarUrl,
    ...(celebrity
      ? [profile.avatarUrl, profile.officialPhotoUrl, profile.logoUrl]
      : [profile.logoUrl, profile.avatarUrl, profile.officialPhotoUrl]),
  ].map((value) => mediaUrl(value)).filter((value): value is string => !!value)));
  const [failedAvatars, setFailedAvatars] = useState<string[]>([]);
  const photo = avatarCandidates.find((value) => !failedAvatars.includes(value));
  const cover = mediaUrl(profile.coverUrl);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase();
  const country = profile.country && /^[A-Z]{2}$/i.test(profile.country)
    ? new Intl.DisplayNames([intl], { type: "region" }).of(profile.country.toUpperCase()) ?? profile.country
    : profile.country;
  const counts = [
    { label: t("common.pieces"), value: profile.pieces },
    { label: t("profileHeader.looks"), value: profile.schemes },
    { label: t("profileHeader.followers"), value: profile.followers },
    { label: t("profileHeader.following"), value: profile.following },
  ];
  const statusKey: Record<string, string> = {
    APROVADO: "issuerReview.status.APROVADO", APPROVED: "issuerReview.status.APROVADO",
    PENDENTE: "issuerReview.status.PENDENTE", PENDING: "issuerReview.status.PENDENTE",
    RECUSADO: "issuerReview.status.RECUSADO", REJECTED: "issuerReview.status.RECUSADO",
    SUSPENSO: "issuerReview.status.SUSPENSO", SUSPENDED: "issuerReview.status.SUSPENSO",
    AJUSTES: "issuerReview.status.AJUSTES",
  };
  const status = profile.status ? statusKey[profile.status.toUpperCase()]
    ? t(statusKey[profile.status.toUpperCase()]) : label(profile.status) : null;

  return (
    <article className="institutional-profile-card surface" aria-label={t("profileHeader.perfil_de", { displayName: name })}>
      <div className="institutional-profile-cover" aria-hidden="true">
        {cover && cover !== failedCover && <img src={cover} alt="" loading="lazy" onError={() => setFailedCover(cover)} />}
      </div>
      <div className="institutional-profile-content">
        <header className="institutional-profile-heading">
          <Link href={profileHref} className="institutional-profile-avatar-link" aria-label={t("profileHeader.perfil_de", { displayName: name })}>
            <span className="institutional-profile-avatar">
              {photo ? (
                <img src={photo} alt={t("profileHeader.foto_de_perfil_de", { displayName: name })} className={!celebrity && photo === mediaUrl(profile.logoUrl) ? "is-logo" : undefined} loading="lazy" onError={() => setFailedAvatars((current) => [...current, photo])} />
              ) : <span aria-hidden="true" className="institutional-profile-monogram">{initials}</span>}
            </span>
          </Link>
          <div className="institutional-profile-identity">
            <Link href={profileHref} className="institutional-profile-name-link">
              <h2 className="type-h3">{name}</h2>
              {username && <span className="institutional-profile-username">@{username}</span>}
            </Link>
            <div className="institutional-profile-badges">
              <Badge tone="chalk">{kindLabel}</Badge>
              {profile.verified && <Badge tone="thread"><span aria-hidden="true">✓</span>{t("profileHeader.verificado")}</Badge>}
              {visibilityLabel && <span title={t("common.visibility")}><Badge>{visibilityLabel}</Badge></span>}
              {status && <span className="institutional-profile-status">{t("common.status")}: {status}</span>}
            </div>
          </div>
        </header>

        <dl className="institutional-profile-stats" aria-label={t("profileHeader.contadores_do_perfil")}>
          {counts.map((count) => (
            <div key={count.label}>
              <dt>{count.label}</dt>
              <dd className="tabular">{fmtNumber(count.value)}</dd>
            </div>
          ))}
        </dl>

        {(categories.length > 0 || hashtag || country) && (
          <div className="institutional-profile-category type-body-sm">
            {categories.length > 0 && <span>{categories.join(" · ")}</span>}
            {hashtag && <span className="institutional-profile-hashtag">#{hashtag}</span>}
            {country && <span title={t("auth.country")}>{country}</span>}
          </div>
        )}
        {profile.bio && <p className="institutional-profile-bio type-body-sm">{profile.bio}</p>}

        <div className="institutional-profile-signals">
          {profile.activeSeals != null
            ? <Badge tone="thread">{t("brands.slug.selos_ativos", { count: profile.activeSeals })}</Badge>
            : profile.seals != null && <span className="type-caption text-muted">{t("brands.selos", { seals: profile.seals })}</span>}
          {profile.affinity != null && <span className="institutional-profile-affinity type-caption">{t("brands.afinidade_2", { Math: Math.round(profile.affinity) })}</span>}
          <HypeGroupBadge type={celebrity ? "CREATOR" : "BRAND"} group={profile.hype ?? null} variant="header" />
        </div>

        <footer className="institutional-profile-actions">
          <Link href={profileHref} className="btn btn-sm">{t("common.ver_perfil")}<span aria-hidden="true">→</span></Link>
          {store && (
            <a href={store.href} target="_blank" rel="noopener noreferrer" className="institutional-profile-store-link">
              <span>{t("catalog.loja_oficial")}</span>
              <span className="type-caption">{store.hostname.replace(/^www\./, "")}</span>
              <span aria-hidden="true">↗</span>
            </a>
          )}
        </footer>
      </div>
    </article>
  );
}
