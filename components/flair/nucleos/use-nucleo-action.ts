"use client";
/**
 * A ação da partida na tela de jogo: os passos saem do resultado do servidor, cada passo vai para a cena (fx-events) e
 * toca o som, e a janela do acionamento do jogo (carta Especial entre os rounds, troca de peça no intervalo) abre só
 * pelos eventos do servidor. A ação só espera pela pessoa quando o acionamento pode mesmo ser feito (`podeAcionar`).
 */
import { useCallback, useMemo, useState } from "react";
import { useActionPlayback } from "@/components/flair/nucleos/use-action-playback";
import { janelaDoAcionamento, passosDaAcao, type PassoAcao } from "@/lib/flair/nucleos/action-fx";
import { emitirFx } from "@/lib/flair/nucleos/fx-events";
import { tocarFx, type FxPrefs } from "@/lib/flair/nucleos/fx-sound";
import { acionamentoDe, type Momento } from "@/lib/flair/nucleos/moments";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

export interface NucleoActionOptions {
  nucleo: NucleoCodigo;
  momento: Momento;
  resultado: NucleoResultado | null;
  automatico: boolean;
  reduzido: boolean;
  prefs: FxPrefs;
  /** o servidor aceita o acionamento nesta partida */
  podeAcionar: boolean;
  onFim: () => void;
}

export function useNucleoAction(opts: NucleoActionOptions) {
  const { nucleo, momento, resultado, automatico, reduzido, prefs, podeAcionar, onFim } = opts;
  const acionamento = acionamentoDe(nucleo);
  const passos = useMemo(() => (resultado ? passosDaAcao(resultado, automatico) : []), [resultado, automatico]);
  const [usado, setUsado] = useState(false);
  /** ponto da ação em que a pessoa escolheu seguir sem acionar */
  const [dispensada, setDispensada] = useState<number | null>(null);
  const [mostradosAgora, setMostradosAgora] = useState(0);

  const tipo = acionamento?.momento === "ACAO" ? acionamento.tipo : null;
  const aberta = !!tipo && momento === "ACAO" && janelaDoAcionamento(tipo, passos, mostradosAgora);
  const pausado = aberta && podeAcionar && !usado && dispensada !== mostradosAgora;

  const onPasso = useCallback(
    (passo: PassoAcao, indice: number) => {
      setMostradosAgora(indice + 1);
      emitirFx({ tipo: "acao-passo", nucleo, passo, indice, total: passos.length });
      tocarFx(passo.fonte === "especial" && passo.ok ? "especial" : "passo", prefs.som);
    },
    [nucleo, passos.length, prefs.som],
  );

  const fim = useCallback(() => {
    if (resultado) emitirFx({ tipo: "acao-fim", nucleo, resultado: resultado.resultado, estrelas: resultado.estrelas });
    setMostradosAgora(0);
    setDispensada(null);
    onFim();
  }, [nucleo, resultado, onFim]);

  const tocador = useActionPlayback({ ativo: momento === "ACAO", passos, reduzido, pausado, onPasso, onFim: fim });
  const mostrados = momento === "RESULTADO" ? passos.length : tocador.mostrados;

  const seguir = useCallback(() => setDispensada(mostradosAgora), [mostradosAgora]);
  const marcarUsado = useCallback(() => setUsado(true), []);

  return { passos, mostrados, pular: tocador.pular, tipo, aberta, usado, seguir, marcarUsado };
}
