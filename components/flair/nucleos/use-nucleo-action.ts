"use client";
/**
 * A ação da partida na tela de jogo: os passos saem do resultado do servidor, cada passo vai para a cena (fx-events) e
 * toca o som. Nas partidas em etapas (Dress Fighter, Fashion Sports) o servidor devolve EM_ACAO: a ação mostra o que já
 * veio e abre a janela do acionamento (a carta do lance na luta, troca de peça no intervalo); a resposta do
 * acionamento traz os passos seguintes, e a ação só termina quando a partida fecha (ENTREGUE).
 */
import { DESFILE_JOGAVEL } from "@/lib/flair/nucleos/movimento/desfile";
import { useCallback, useMemo } from "react";
import { useActionPlayback } from "@/components/flair/nucleos/use-action-playback";
import { LANCE_MS, PASSOS_DO_ESPORTE } from "@/components/flair/esporte/use-esporte";
import { janelaDoAcionamento, passosDaAcao, valorDoEvento, type PassoAcao } from "@/lib/flair/nucleos/action-fx";
import { emitirFx } from "@/lib/flair/nucleos/fx-events";
import { estadoDaLuta, PASSOS_DA_LUTA } from "@/lib/flair/nucleos/luta";
import { tocarFx, type FxPrefs } from "@/lib/flair/nucleos/fx-sound";
import { acionamentoDe, type Momento } from "@/lib/flair/nucleos/moments";
import { passoDaCena } from "@/lib/flair/nucleos/scene/ritmo";
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
  /** jogo jogado por cartas (Fashion Sports): só os lances viram passo, e cada um fica mais tempo na tela */
  const porCartas = acionamento?.tipo === "CARTA";
  const lanceALance = acionamento?.tipo === "LANCE";
  const so = porCartas ? PASSOS_DO_ESPORTE : lanceALance ? PASSOS_DA_LUTA : undefined;
  const passos = useMemo(() => (resultado ? passosDaAcao(resultado, automatico, so) : []), [resultado, automatico, so]);
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

  // cada passo dura a sua parte da sequência da cena: a cena acaba junto com a ação
  const passoMs = useMemo(() => (porCartas ? LANCE_MS : resultado ? passoDaCena(nucleo, resultado, passos.length) : undefined), [porCartas, resultado, nucleo, passos.length]);
  const tocador = useActionPlayback({ ativo: momento === "ACAO", passos, reduzido, continua: emAcao, onPasso, onFim: fim, passoMs, segura: DESFILE_JOGAVEL.has(nucleo) && !reduzido });
  const mostrados = momento === "RESULTADO" ? passos.length : tocador.mostrados;

  const naAcao = acionamento?.momento === "ACAO" ? acionamento.tipo : null;
  const tipo = naAcao === "ESPECIAL" || naAcao === "TROCA" || naAcao === "MERCADO" || naAcao === "JOGADA" || naAcao === "LANCE" ? naAcao : null;
  /** a janela abre quando o servidor espera o acionamento e tudo o que ele já mandou apareceu */
  const aberta = (!!tipo || porCartas) && momento === "ACAO" && janelaDoAcionamento(resultado?.status, passos, tocador.mostrados) && !valorDoEvento(resultado, "EXECUCAO_PEDIDA");
  /** a carta Especial vale 1 por luta (evento ESPECIAL do servidor); a troca vale 1 por lance, até o apito */
  const usado = (tipo === "ESPECIAL" || tipo === "JOGADA") && !!resultado?.eventos.some((e) => e.codigo === (tipo === "JOGADA" ? "JOGADA_DE_CENA" : tipo));
  /** a jogada de cena: a cor que a cena pede agora (o servidor sorteia) */
  const pedido = valorDoEvento(resultado, "PEDIDO_DE_CENA") as { familia?: string; acao?: string } | undefined;

  /** a luta do Dress Fighter: as duas vidas e a leitura do próximo golpe da oponente */
  const luta = lanceALance ? estadoDaLuta(resultado) : null;

  return { passos, mostrados, pular: tocador.pular, tipo, aberta, usado, pedido, luta };
}
