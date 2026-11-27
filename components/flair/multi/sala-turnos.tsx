"use client";
/**
 * A sala por turnos em jogo: primeiro o deck (o mesmo montador do jogo solo, com as regras do jogo), depois o lance de
 * cada turno. O lance fica selado até a outra pessoa lançar; o servidor julga e a lista de turnos mostra os dois lados.
 * Na Batalha de Looks, o desafio da vez aparece antes do lance (a pessoa convidada no lugar do look da casa).
 */
import { useMemo } from "react";
import { Badge, Skeleton } from "@/components/ui";
import type { FlairCollection } from "@/components/flair/flair-collection";
import { NucleoDeck } from "@/components/flair/nucleos/nucleo-deck";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { LancePicker } from "@/components/flair/multi/lance-picker";
import { TurnoLista } from "@/components/flair/multi/turno-lista";
import type { useSala } from "@/components/flair/multi/use-sala";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { buscarNucleo } from "@/lib/flair/nucleos/api";
import { isNucleoCodigo, mesclarDefinicao } from "@/lib/flair/nucleos/registry";
import { definicaoDaRodada } from "@/lib/flair/nucleos/rodadas";
import { outraPessoa } from "@/lib/flair/multi/filtros";
import { cartasDoTurnoAnterior, placarDeQuemLe } from "@/lib/flair/multi/lance";
import type { Sala } from "@/lib/flair/multi/types";

interface Props {
  sala: Sala;
  acoes: ReturnType<typeof useSala>;
}

export function SalaTurnos({ sala, acoes }: Props) {
  const tx = useNucleoText();
  const codigo = isNucleoCodigo(sala.jogo) ? sala.jogo : "BATALHA_LOOKS";
  const def = useApi((signal) => buscarNucleo(codigo, signal), [codigo]);
  const definicao = useMemo(() => definicaoDaRodada(mesclarDefinicao(codigo, def.data), sala.rodada ?? null), [codigo, def.data, sala.rodada]);
  const banco = useApi<FlairCollection>((signal) => api.get("/api/me/flair/cards", { signal }), []);
  const t = sala.turnos;
  const outra = outraPessoa(sala).username;
  const meuDeck = useMemo(() => (banco.data?.cards ?? []).filter((c) => t?.meuDeck.includes(c.id)), [banco.data, t?.meuDeck]);
  if (!t || (banco.loading && !banco.data)) return <Skeleton className="h-40" />;
  if (!t.meuDeck.length) {
    return (
      <div className="fm-deck" data-testid="fm-deck-da-sala">
        <p className="type-body">{tx.t("flair3d.multi.deck.escolha")}</p>
        {definicao.deck && (
          <NucleoDeck codigo={codigo} regras={definicao.deck} cartas={banco.data?.cards ?? []} entrando={acoes.deck.busy} erro={acoes.deck.error}
            rodada={sala.rodada} regrasDaRodada={definicao.objetivo.regras.map((r) => r.codigo)} onEntrar={(deck) => void acoes.deck.run(deck)} />
        )}
      </div>
    );
  }
  const placar = placarDeQuemLe(t, sala.voce);
  const desafio = t.desafios?.[t.vez - 1];
  return (
    <div className="fm-sala-turnos">
      <div className="fm-placar" data-testid="fm-placar" aria-live="polite">
        <span>{tx.t("flair3d.multi.voce")} <b className="tabular">{placar.meu}</b></span>
        <span className="text-muted">{tx.t(`flair3d.multi.placar.${sala.jogo}`)}</span>
        <span><b className="tabular">{placar.outro}</b> @{outra}</span>
      </div>
      {!t.encerrado && (
        <section className="fm-vez surface" aria-label={tx.t("flair3d.multi.turno.n", { n: t.vez })}>
          <p className="fm-vez-topo">
            <b>{tx.t("flair3d.multi.turno.deTotal", { n: t.vez, total: t.total })}</b>
            {t.outroLancou && <Badge tone="thread">{tx.t("flair3d.multi.turno.outroLancou", { outro: outra })}</Badge>}
            {!t.deckDoOutroPronto && <span className="type-caption text-muted">{tx.t("flair3d.multi.deck.esperandoOutro", { outro: outra })}</span>}
          </p>
          {desafio && (
            <p className="fm-desafio" data-testid="fm-desafio">
              <b>{tx.ou(`flair3d.etapa.${desafio}.name`, desafio)}</b> <span className="text-muted">{tx.ou(`flair3d.etapa.${desafio}.text`, "")}</span>
            </p>
          )}
          {t.esperando
            ? <p className="type-body fm-selado" data-testid="fm-selado">{tx.t("flair3d.multi.turno.selado", { outro: outra })}</p>
            : <LancePicker key={t.vez} turnos={t} cartas={meuDeck} anteriores={cartasDoTurnoAnterior(t, sala.voce)} enviando={acoes.lance.busy}
                onLancar={(cartas) => void acoes.lance.run(t.vez, cartas)} />}
          {acoes.lance.error && <p className="type-caption fm-erro" role="alert">{acoes.lance.error.message}</p>}
        </section>
      )}
      <TurnoLista jogo={sala.jogo} voce={sala.voce} turnos={t.julgados} outro={outra} />
    </div>
  );
}
