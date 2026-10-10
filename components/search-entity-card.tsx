"use client";

import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";
import { HypeGroupBadge } from "@/components/hype/hype-group-badge";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";

/** Resultado de Marcas e Celebridades na busca (RF8): o que a API devolve por linha. */
export interface SearchEntity { id?: string; userId?: string; slug?: string; name?: string; logoUrl?: string | null; registered?: boolean; publicPieces?: number; avatarUrl?: string | null }

/**
 * Buscar → Marcas e Buscar → Celebridades no mesmo card de Buscar → Pessoas (`PublicProfileCard`): capa, avatar/logo,
 * nome e @, selos (tipo, verificada, só catálogo), contadores, sinal de Hype e a ação. Marca do catálogo sem perfil
 * leva às peças (filtro de marca) em vez de um perfil que não existe.
 */
export function SearchEntityCard({ kind, row, onSeePieces }: { kind: "MARCAS" | "CELEBRIDADES"; row: SearchEntity; onSeePieces?: (brand: string) => void }) {
  const { t, fmtNumber } = useI18n();
  const name = row.name ?? row.slug ?? "";
  const brand = kind === "MARCAS";
  const href = row.registered === false || !row.slug ? null : brand ? `/brands/${encodeURIComponent(row.slug)}` : `/u/${encodeURIComponent(row.slug)}`;
  const photo = mediaUrl(row.avatarUrl ?? row.logoUrl);
  const monogram = name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase();
  const avatar = brand
    ? <BrandLogo name={name} src={row.logoUrl} size={64} shape="square" />
    : photo ? <img src={photo} alt={t("profileHeader.foto_de_perfil_de", { displayName: name })} loading="lazy" />
      : <span className="institutional-profile-monogram" aria-hidden="true">{monogram}</span>;
  return (
    <article className="institutional-profile-card surface" aria-label={t("profileHeader.perfil_de", { displayName: name })}>
      <div className="institutional-profile-cover" aria-hidden="true" />
      <div className="institutional-profile-content">
        <header className="institutional-profile-heading">
          {href
            ? <Link href={href} className="institutional-profile-avatar-link" aria-label={t("profileHeader.perfil_de", { displayName: name })}><span className="institutional-profile-avatar">{avatar}</span></Link>
            : <span className="institutional-profile-avatar">{avatar}</span>}
          <div className="institutional-profile-identity">
            {href
              ? <Link href={href} className="institutional-profile-name-link"><h2 className="type-h3">{name}</h2><span className="institutional-profile-username">@{row.slug}</span></Link>
              : <div className="institutional-profile-name-link"><h2 className="type-h3">{name}</h2></div>}
            <div className="institutional-profile-badges">
              <Badge tone="chalk">{t(brand ? "search.kind_marca" : "search.kind_celebridade")}</Badge>
              {!brand && <Badge tone="thread"><span aria-hidden="true">✓</span>{t("profileHeader.verificado")}</Badge>}
              {brand && row.registered === false && <Badge>{t("search.marca_do_catalogo")}</Badge>}
            </div>
          </div>
        </header>
        {brand && <dl className="institutional-profile-stats" aria-label={t("profileHeader.contadores_do_perfil")}>
          <div><dt>{t("search.pecas_publicas")}</dt><dd className="tabular">{fmtNumber(row.publicPieces ?? 0)}</dd></div>
        </dl>}
        <div className="institutional-profile-signals">
          {/* o chip "Marca/Criador em alta" (agregado público, só a partir da faixa Em alta), como na lista anterior */}
          {brand ? <HypeGroupBadge type="BRAND" groupKey={row.name} /> : <HypeGroupBadge type="CREATOR" groupKey={row.userId} />}
        </div>
        <footer className="institutional-profile-actions">
          {row.registered === false
            ? <Button size="sm" onClick={() => onSeePieces?.(name)}>{t("search.ver_pecas")}<span aria-hidden="true">→</span></Button>
            : href ? <Link href={href} className="btn btn-sm">{t("search.abrir_perfil")}<span aria-hidden="true">→</span></Link> : null}
        </footer>
      </div>
    </article>
  );
}
