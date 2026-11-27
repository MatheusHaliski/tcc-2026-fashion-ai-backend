"use client";
/** Uma pessoa na busca de adversários: avatar, nome, nível FLAIR, estilo, lugar, se está ativa, se tem deck, relação e status. */
import { Avatar, Badge, Button, UiIcon } from "@/components/ui";
import type { Adversario } from "@/lib/flair/multi/types";
import { useI18n } from "@/lib/i18n/i18n";

interface Props {
  pessoa: Adversario;
  escolhida: boolean;
  ocupado: boolean;
  rotuloAcao: string;
  onEscolher: () => void;
}

export function ItemAdversario({ pessoa: a, escolhida, ocupado, rotuloAcao, onEscolher }: Props) {
  const { t } = useI18n();
  const lugar = [a.cidade, a.pais].filter(Boolean).join(" · ");
  return (
    <li className="fm-item" data-testid={`fm-pessoa-${a.username}`}>
      <Avatar src={a.avatarUrl} name={a.nome ?? a.username} size={44} />
      <div className="fm-item-texto">
        <p className="fm-item-nome">
          <b>{a.nome ?? a.username}</b> <span className="text-muted">@{a.username}</span>
          {a.ativo && <span className="fm-ativo" title={t("flair3d.multi.ativa")}><span className="sr-only">{t("flair3d.multi.ativa")}</span></span>}
        </p>
        <p className="fm-item-meta">
          <Badge tone="thread">{t(`flair3d.multi.nivel.${a.nivel}`)}</Badge>
          {a.estilo && <Badge>{t(`flair3d.multi.estilo.${a.estilo}`)}</Badge>}
          {lugar && <span className="type-caption text-muted">{lugar}</span>}
          {a.relacao !== "NENHUMA" && <span className="type-caption">{t(`flair3d.multi.relacao.item.${a.relacao}`)}</span>}
          {a.temDeck === true && <span className="type-caption fm-deck-ok"><UiIcon name="check" size={14} />{t("flair3d.multi.temDeck")}</span>}
          {a.temDeck === false && <span className="type-caption text-muted">{t("flair3d.multi.semDeck")}</span>}
        </p>
        {a.status !== "DISPONIVEL" && <p className="type-caption fm-status">{t(`flair3d.multi.status.${a.status}`)}</p>}
        {!a.convidavel && a.motivo && <p className="type-caption text-muted">{t(`flair3d.multi.motivo.${a.motivo}`)}</p>}
      </div>
      <Button size="sm" variant={escolhida ? "default" : "primary"} disabled={!a.convidavel || escolhida} loading={ocupado} onClick={onEscolher}
        aria-label={`${rotuloAcao} @${a.username}`}>
        {escolhida ? t("flair3d.multi.escolhida") : rotuloAcao}
      </Button>
    </li>
  );
}
