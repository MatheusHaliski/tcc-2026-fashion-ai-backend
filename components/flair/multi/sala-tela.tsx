"use client";
/**
 * A sala multiplayer (/flair/3d/sala/[id]): as duas pessoas, o convite (aceitar, recusar, cancelar, prazo), o jogo no
 * modo da sala (por turnos aqui mesmo; mesma semente na tela do jogo) e o resultado com revanche e histórico. O
 * estado vem do servidor a cada 2 s.
 */
import Link from "next/link";
import { Avatar, Button, EmptyState, ErrorState, PageHeader, Skeleton, UiIcon } from "@/components/ui";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { SalaAssincrona } from "@/components/flair/multi/sala-assincrona";
import { SalaResultado } from "@/components/flair/multi/sala-resultado";
import { SalaTurnos } from "@/components/flair/multi/sala-turnos";
import { TurnoLista } from "@/components/flair/multi/turno-lista";
import { useNomeDoJogo } from "@/components/flair/multi/use-nome-do-jogo";
import { useSala } from "@/components/flair/multi/use-sala";
import { outraPessoa } from "@/lib/flair/multi/filtros";
import type { Sala } from "@/lib/flair/multi/types";

function Convite({ sala, acoes }: { sala: Sala; acoes: ReturnType<typeof useSala> }) {
  const tx = useNucleoText();
  const outra = outraPessoa(sala).username;
  const prazo = new Date(sala.prazo).toLocaleString();
  if (sala.voce === "PARA") {
    return (
      <section className="fm-convite surface" data-testid="fm-convite">
        <p className="type-body">{tx.t("flair3d.multi.convite.recebido", { outro: outra, prazo })}</p>
        <div className="fm-acoes">
          <Button variant="primary" loading={acoes.responder.busy} onClick={() => void acoes.responder.run("aceitar")} data-testid="fm-aceitar">{tx.t("flair3d.multi.aceitar")}</Button>
          <Button disabled={acoes.responder.busy} onClick={() => void acoes.responder.run("recusar")}>{tx.t("flair3d.multi.recusar")}</Button>
        </div>
      </section>
    );
  }
  return (
    <section className="fm-convite surface" data-testid="fm-convite">
      <p className="type-body">{tx.t("flair3d.multi.convite.esperando", { outro: outra, prazo })}</p>
      <Button size="sm" loading={acoes.responder.busy} onClick={() => void acoes.responder.run("cancelar")}>{tx.t("flair3d.multi.cancelar")}</Button>
    </section>
  );
}

export function SalaTela({ id }: { id: string }) {
  const tx = useNucleoText();
  const nome = useNomeDoJogo();
  const acoes = useSala(id);
  const sala = acoes.sala;
  if (acoes.carregando) return <Skeleton className="h-64" />;
  if (!sala) {
    return acoes.erro?.status === 404
      ? <EmptyState title={tx.t("flair3d.multi.salaNaoEncontrada")} action={<Link href="/flair/3d" className="btn btn-sm">{tx.t("flair3d.ui.back")}</Link>} />
      : <ErrorState error={acoes.erro} onRetry={acoes.recarregar} />;
  }
  const de = sala.de;
  const para = sala.para;
  let corpo;
  if (sala.estado === "CONVIDADO") corpo = <Convite sala={sala} acoes={acoes} />;
  else if (sala.estado === "JOGANDO") corpo = sala.modo === "TURNOS" ? <SalaTurnos sala={sala} acoes={acoes} /> : <SalaAssincrona sala={sala} />;
  else if (sala.estado === "FECHADO") {
    corpo = (
      <>
        <SalaResultado sala={sala} acoes={acoes} />
        {sala.turnos && <TurnoLista jogo={sala.jogo} voce={sala.voce} turnos={sala.turnos.julgados} outro={outraPessoa(sala).username} />}
      </>
    );
  } else corpo = <p className="type-body fm-encerrada" data-testid="fm-encerrada">{tx.t(`flair3d.multi.estado.${sala.estado}`)}</p>;
  return (
    <div className="fm-sala" data-testid="fm-sala" data-estado={sala.estado}>
      <div className="flair-section-head">
        <Link href="/flair/3d" className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{tx.t("flair3d.ui.back")}</Link>
        <PageHeader title={nome(sala.jogo)} kicker={tx.t(`flair3d.multi.modo.${sala.modo}`)} />
      </div>
      <div className="fm-sala-pessoas" aria-label={tx.t("flair3d.multi.pessoasDaSala")}>
        <span className="fm-pessoa"><Avatar src={de.avatarUrl} name={de.nome ?? de.username} size={40} />@{de.username}{sala.voce === "DE" && <em>{tx.t("flair3d.multi.voceEntre")}</em>}</span>
        <span className="fm-res-x" aria-hidden>×</span>
        <span className="fm-pessoa"><Avatar src={para.avatarUrl} name={para.nome ?? para.username} size={40} />@{para.username}{sala.voce === "PARA" && <em>{tx.t("flair3d.multi.voceEntre")}</em>}</span>
      </div>
      {corpo}
    </div>
  );
}
