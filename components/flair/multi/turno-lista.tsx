"use client";
/**
 * Os turnos já julgados pelo servidor, do ponto de vista de quem lê ("você" × a outra pessoa): na Batalha, o desafio e
 * as duas notas; no Dress Fighter, os dois golpes, o dano e a vida; no Fashion Sports, quem atacou e se foi gol.
 */
import { Badge } from "@/components/ui";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { outroLado } from "@/lib/flair/multi/filtros";
import type { Lado, TurnoJulgado } from "@/lib/flair/multi/types";

interface Props {
  jogo: string;
  voce: Lado;
  turnos: TurnoJulgado[];
  outro: string;
}

const chave = (l: Lado) => (l === "DE" ? "de" : "para");

function Detalhe({ jogo, lado }: { jogo: string; lado: Record<string, unknown> }) {
  const tx = useNucleoText();
  if (jogo === "BATALHA_LOOKS") return <b className="tabular">{String(lado.nota ?? 0)}</b>;
  if (jogo === "DRESS_FIGHTER") {
    return (
      <span>{tx.ou(`flair3d.ui.golpe.${String(lado.golpe)}`, String(lado.golpe))} · {tx.t("flair3d.multi.turno.dano", { n: Number(lado.dano ?? 0) })}
        {" · "}{tx.t("flair3d.multi.turno.vida", { n: Number(lado.vida ?? 0) })}</span>
    );
  }
  return <span className="tabular">{tx.t("flair3d.multi.turno.valor", { n: Number(lado.valor ?? 0) })}</span>;
}

export function TurnoLista({ jogo, voce, turnos, outro }: Props) {
  const tx = useNucleoText();
  if (!turnos.length) return null;
  const meu = chave(voce);
  const deles = chave(outroLado(voce));
  return (
    <ol className="fm-turnos" data-testid="fm-turnos-julgados">
      {turnos.map((t) => {
        const ganhei = t.vencedor === voce;
        const empate = t.vencedor === "EMPATE";
        return (
          <li key={t.turno} className="fm-turno">
            <p className="fm-turno-topo">
              <b>{tx.t("flair3d.multi.turno.n", { n: t.turno })}</b>
              {t.desafio && <span>{tx.ou(`flair3d.etapa.${t.desafio}.name`, t.desafio)}</span>}
              {t.atacante && <span className="text-muted">{t.atacante === voce ? tx.t("flair3d.multi.turno.voceAtaca") : tx.t("flair3d.multi.turno.outroAtaca", { outro })}</span>}
              {t.gol && <Badge tone="thread">{tx.t("flair3d.multi.turno.gol")}</Badge>}
              <Badge tone={empate ? "chalk" : ganhei ? "thread" : "mark"}>
                {empate ? tx.t("flair3d.multi.desfecho.EMPATE") : ganhei ? tx.t("flair3d.multi.turno.seu") : tx.t("flair3d.multi.turno.dela", { outro })}
              </Badge>
            </p>
            <div className="fm-turno-lados">
              <span><span className="text-muted">{tx.t("flair3d.multi.voce")}</span> <Detalhe jogo={jogo} lado={t[meu]} /></span>
              <span><span className="text-muted">@{outro}</span> <Detalhe jogo={jogo} lado={t[deles]} /></span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
