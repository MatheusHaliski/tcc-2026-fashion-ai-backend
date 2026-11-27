"use client";
/**
 * A caixa do multiplayer no hub do FLAIR 3D: "Jogar contra alguém", convites recebidos (aceitar ou recusar), enviados
 * (cancelar), salas em jogo (com o aviso de quando é a sua vez) e as últimas fechadas. Sem convites, só o botão.
 */
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, Badge, Button, useToast } from "@/components/ui";
import { ConvidarDialog } from "@/components/flair/multi/convidar-dialog";
import { useNomeDoJogo } from "@/components/flair/multi/use-nome-do-jogo";
import { useApi } from "@/lib/hooks/use-api";
import { buscarCaixa, responderConvite, type AcaoDoConvite } from "@/lib/flair/multi/api";
import { desfecho, outraPessoa, rotaDaSala } from "@/lib/flair/multi/filtros";
import type { Sala } from "@/lib/flair/multi/types";
import { useI18n } from "@/lib/i18n/i18n";

const ATUALIZA_MS = 10000;

function LinhaDaSala({ sala, acoes }: { sala: Sala; acoes?: ReactNode }) {
  const { t } = useI18n();
  const nome = useNomeDoJogo();
  const outra = outraPessoa(sala);
  const fim = desfecho(sala);
  return (
    <li className="fm-sala-linha" data-testid={`fm-sala-${sala.id}`}>
      <Avatar src={outra.avatarUrl} name={outra.nome ?? outra.username} size={36} />
      <Link href={rotaDaSala(sala.id)} className="fm-sala-link">
        <b>@{outra.username}</b> · {nome(sala.jogo)} <span className="text-muted">· {t(`flair3d.multi.modo.${sala.modo}`)}</span>
      </Link>
      {fim && <Badge tone={fim === "VITORIA" ? "thread" : fim === "DERROTA" ? "mark" : "chalk"}>{t(`flair3d.multi.desfecho.${fim}`)}</Badge>}
      {acoes}
    </li>
  );
}

export function CaixaMulti() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const caixa = useApi((signal) => buscarCaixa(signal), [], { refreshInterval: ATUALIZA_MS });
  const [convidando, setConvidando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  async function responder(sala: Sala, acao: AcaoDoConvite) {
    setOcupado(sala.id);
    try {
      await responderConvite(sala.id, acao);
      if (acao === "aceitar") router.push(rotaDaSala(sala.id));
      else caixa.reload();
    } catch (e) {
      toast.fromError(e);
    } finally {
      setOcupado(null);
    }
  }
  const c = caixa.data;
  const grupo = (titulo: string, salas: Sala[] | undefined, acoes?: (s: Sala) => ReactNode) =>
    salas?.length ? (
      <div className="fm-caixa-grupo">
        <h3 className="type-label">{titulo}</h3>
        <ul>{salas.map((s) => <LinhaDaSala key={s.id} sala={s} acoes={acoes?.(s)} />)}</ul>
      </div>
    ) : null;
  return (
    <section className="fm-caixa surface" aria-label={t("flair3d.multi.titulo")} data-testid="fm-caixa">
      <div className="fm-caixa-topo">
        <div>
          <h2 className="type-title">{t("flair3d.multi.titulo")}</h2>
          <p className="type-caption text-muted">{t("flair3d.multi.lead")}</p>
        </div>
        <Button variant="primary" onClick={() => setConvidando(true)} data-testid="fm-jogar-contra">{t("flair3d.multi.jogarContraAlguem")}</Button>
      </div>
      {grupo(t("flair3d.multi.recebidos"), c?.recebidos, (s) => (
        <span className="fm-acoes">
          <Button size="sm" variant="primary" loading={ocupado === s.id} onClick={() => void responder(s, "aceitar")}>{t("flair3d.multi.aceitar")}</Button>
          <Button size="sm" disabled={ocupado === s.id} onClick={() => void responder(s, "recusar")}>{t("flair3d.multi.recusar")}</Button>
        </span>
      ))}
      {grupo(t("flair3d.multi.ativas"), c?.ativas)}
      {grupo(t("flair3d.multi.enviados"), c?.enviados, (s) => (
        <Button size="sm" loading={ocupado === s.id} onClick={() => void responder(s, "cancelar")}>{t("flair3d.multi.cancelar")}</Button>
      ))}
      {grupo(t("flair3d.multi.recentes"), c?.recentes)}
      {convidando && <ConvidarDialog onClose={() => setConvidando(false)} />}
    </section>
  );
}
