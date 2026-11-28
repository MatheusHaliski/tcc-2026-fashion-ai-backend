"use client";
/**
 * O resultado da sala com os dois lados lado a lado (pontos e estrelas, ou a soma, a vida e os gols dos turnos), o
 * desfecho para quem lê, a revanche (novo convite com a semente seguinte) e o histórico contra a mesma pessoa.
 */
import { useRouter } from "next/navigation";
import { Avatar, Badge, Button } from "@/components/ui";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { useSala } from "@/components/flair/multi/use-sala";
import { useApi } from "@/lib/hooks/use-api";
import { buscarHistorico } from "@/lib/flair/multi/api";
import { desfecho, outraPessoa, rotaDaSala } from "@/lib/flair/multi/filtros";
import type { PessoaDaSala, Sala } from "@/lib/flair/multi/types";

function Lado({ pessoa, pontos, estrelas, rotulo, venceu }: { pessoa: PessoaDaSala; pontos?: number; estrelas?: number; rotulo: string; venceu: boolean }) {
  return (
    <div className={venceu ? "fm-res-lado is-venceu" : "fm-res-lado"}>
      <Avatar src={pessoa.avatarUrl} name={pessoa.nome ?? pessoa.username} size={56} />
      <p className="type-label">{rotulo}</p>
      <p className="fm-res-pontos tabular">{pontos ?? 0}</p>
      {estrelas != null && <p className="type-caption" aria-label={`${estrelas}`}>{"★".repeat(estrelas)}</p>}
    </div>
  );
}

export function SalaResultado({ sala, acoes }: { sala: Sala; acoes: ReturnType<typeof useSala> }) {
  const tx = useNucleoText();
  const router = useRouter();
  const outra = outraPessoa(sala);
  const historico = useApi((signal) => buscarHistorico(outra.id, signal), [outra.id, sala.estado]);
  const fim = desfecho(sala);
  const r = sala.resultado ?? {};
  const eu = sala.voce === "DE" ? r.de : r.para;
  const ela = sala.voce === "DE" ? r.para : r.de;
  const minhaPessoa = sala.voce === "DE" ? sala.de : sala.para;
  async function jogarDeNovo() {
    const nova = await acoes.revanche.run();
    if (nova) router.push(rotaDaSala(nova.id));
  }
  const p = historico.data?.placar;
  return (
    <section className="fm-resultado surface" data-testid="fm-resultado" aria-live="polite">
      {fim && <p className="fm-res-titulo"><Badge tone={fim === "VITORIA" ? "thread" : fim === "DERROTA" ? "mark" : "chalk"}>{tx.t(`flair3d.multi.desfecho.${fim}`)}</Badge></p>}
      <div className="fm-res-lados">
        <Lado pessoa={minhaPessoa} pontos={eu?.pontos} estrelas={eu?.estrelas} rotulo={tx.t("flair3d.multi.voce")} venceu={fim === "VITORIA"} />
        <span className="fm-res-x" aria-hidden>×</span>
        <Lado pessoa={outra} pontos={ela?.pontos} estrelas={ela?.estrelas} rotulo={`@${outra.username}`} venceu={fim === "DERROTA"} />
      </div>
      <div className="fm-res-acoes">
        <Button variant="primary" loading={acoes.revanche.busy} onClick={() => void jogarDeNovo()} data-testid="fm-revanche">{tx.t("flair3d.multi.revanche")}</Button>
        {acoes.revanche.error && <p className="type-caption fm-erro" role="alert">{acoes.revanche.error.message}</p>}
      </div>
      {p && (
        <p className="type-caption fm-historico" data-testid="fm-historico">
          {tx.t("flair3d.multi.historico", { outro: outra.username, v: p.vitorias, d: p.derrotas, e: p.empates })}
        </p>
      )}
    </section>
  );
}
