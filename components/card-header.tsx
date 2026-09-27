"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import type { UserCard } from "@/lib/api/types";
import { mediaUrl } from "@/lib/api/client";
import { Avatar } from "@/components/ui";

/** Nome de quem publicou, como aparece em todos os cards: perfil de marca pelo nome; pessoa pelo @usuário. */
export function ownerLabel(owner?: Pick<UserCard, "username" | "displayName" | "profileType"> | null): string {
  if (!owner) return "";
  return owner.profileType === "MARCA" ? owner.displayName : `@${owner.username}`;
}

/**
 * Cabeçalho compacto do contrato visual dos cards (peça, look e detalhe): avatar 24 px, quem publicou (link para o
 * perfil), uma linha secundária opcional (visibilidade, data) e, à direita, o que o contexto pedir (menu, fechar).
 */
export function CardHeader({ owner, sub, trailing, linked = true, className = "" }: {
  owner?: UserCard | null; sub?: ReactNode; trailing?: ReactNode;
  /** false na prévia (o card ainda não foi publicado: o nome não leva a lugar nenhum) */
  linked?: boolean; className?: string;
}) {
  const name = <b>{ownerLabel(owner)}</b>;
  return (
    <div className={`c-header ${className}`}>
      <span className="c-avatar"><Avatar src={mediaUrl(owner?.avatarUrl)} name={owner?.displayName} size={24} /></span>
      <span className="c-who">
        {/* sem link (prévia), o mesmo invólucro: a altura do cabeçalho é idêntica à do card publicado */}
        {owner?.username && linked ? <Link href={`/u/${owner.username}`} className="c-who-link">{name}</Link> : <span className="c-who-link">{name}</span>}
        {sub ? <span>{sub}</span> : null}
      </span>
      {trailing}
    </div>
  );
}
