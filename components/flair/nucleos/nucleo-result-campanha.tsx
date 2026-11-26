"use client";
/**
 * A campanha dentro do resultado: quando a partida fecha, a tela pede a campanha de novo ao servidor e mostra a frase de
 * transição desta partida (a rodada, os pontos e as estrelas que o servidor gravou, e a rodada que falta vencer) ou o
 * fecho da história, com as estrelas do jogo. Embaixo, o que foi salvo e quando. Sem resposta do servidor, nada aparece.
 */
import { NucleoCampanha } from "@/components/flair/nucleos/nucleo-campanha";
import { NucleoSalvo } from "@/components/flair/nucleos/nucleo-salvo";
import { useNucleoProgresso } from "@/components/flair/nucleos/use-nucleo-progresso";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

interface Props {
  codigo: string;
  /** a partida fechou (ENTREGUE): só então o resultado entra na campanha */
  fechou: boolean;
}

export function NucleoResultCampanha({ codigo, fechou }: Props) {
  const { progresso } = useNucleoProgresso(codigo as NucleoCodigo, fechou);
  if (!fechou) return null;
  return (
    <>
      {progresso && progresso.ultima && <NucleoCampanha progresso={progresso} compacta />}
      <NucleoSalvo />
    </>
  );
}
