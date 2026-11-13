"use client";
/**
 * A ação da partida na tela de jogo: os passos saem do resultado do servidor, cada passo vai para a cena (fx-events) e
 * toca o som. Nas partidas em etapas (Dress Fighter, Fashion Sports) o servidor devolve EM_ACAO: a ação mostra o que já
 * veio e abre a janela do acionamento (carta Especial entre os rounds, troca de peça no intervalo); a resposta do
 * acionamento traz os passos seguintes, e a ação só termina quando a partida fecha (ENTREGUE).
 */
import { useCallback, useMemo } from "react";
import { useActionPlayback } from "@/components/flair/nucleos/use-action-playback";
import { janelaDoAcionamento, passosDaAcao, type PassoAcao } from "@/lib/flair/nucleos/action-fx";
import { emitirFx } from "@/lib/flair/nucleos/fx-events";
import { tocarFx, type FxPrefs } from "@/lib/flair/nucleos/fx-sound";
import { acionamentoDe, type Momento } from "@/lib/flair/nucleos/moments";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

export interface NucleoActionOptions {
  nucleo: NucleoCodigo;
  momento: Momento;
  /** última resposta do servidor (entrega ou acionamento) */
  resultado: NucleoResultado | null;
  automatico: boolean;
  reduzido: boolean;
  prefs: FxPrefs;
  onFim: () => void;
}

export function useNucleoAction(opts: NucleoActionOptions) {
  const { nucleo, momento, resultado, automatico, reduzido, prefs, onFim } = opts;
  const acionamento = acionamentoDe(nucleo);
  const passos = useMemo(() => (resultado ? passosDaAcao(resultado, automatico) : []), [resultado, automatico]);
  const emAcao = resultado?.status === "EM_ACAO";

  const onPasso = useCallback(
    (passo: PassoAcao, indice: number) => {
      emitirFx({ tipo: "acao-passo", nucleo, passo, indice, total: passos.length });
      const especial = passo.codigo === "ESPECIAL" || (passo.fonte === "especial" && passo.ok);
      tocarFx(especial ? "especial" : "passo", prefs.som);
    },
    [nucleo, passos.length, prefs.som],
  );

  const fim = useCallback(() => {
    if (resultado) emitirFx({ tipo: "acao-fim", nucleo, resultado: resultado.resultado, estrelas: resultado.estrelas });
    onFim();
  }, [nucleo, resultado, onFim]);

  const tocador = useActionPlayback({ ativo: momento === "ACAO", passos, reduzido, continua: emAcao, onPasso, onFim: fim });
  const mostrados = momento === "RESULTADO" ? passos.length : tocador.mostrados;

  const tipo = acionamento?.momento === "ACAO" && (acionamento.tipo === "ESPECIAL" || acionamento.tipo === "TROCA") ? acionamento.tipo : null;
  /** a janela abre quando o servidor espera o acionamento e tudo o que ele já mandou apareceu */
  const aberta = !!tipo && momento === "ACAO" && janelaDoAcionamento(resultado?.status, passos, tocador.mostrados);
  /** a carta Especial vale 1 por luta (evento ESPECIAL do servidor); a troca vale 1 por lance, até o apito */
  const usado = tipo === "ESPECIAL" && !!resultado?.eventos.some((e) => e.codigo === tipo);

  return { passos, mostrados, pular: tocador.pular, tipo, aberta, usado };
}
