"use client";
/**
 * A vinheta do momento-chave na transmissão (lib/flair/esporte/momentos.ts): apito inicial, intervalo, ponto de cada
 * lado e apito final com o desfecho, nas palavras da modalidade ("Largada", "Fim do 1º set", "Cesta do seu time!").
 * Fica no alto do campo, fora da zona dos jogadores, e é lida pelo leitor de tela.
 */
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { desfechoDoPlacar, momentoDoLance } from "@/lib/flair/esporte/momentos";
import type { Jogada } from "@/lib/flair/esporte/types";

export function EsporteMomento({ modalidade, jogadas, fim }: { modalidade: string; jogadas: Jogada[]; fim: boolean }) {
  const tx = useNucleoText();
  const momento = momentoDoLance(jogadas, fim);
  if (!momento) return null;
  const atual = jogadas[jogadas.length - 1];
  const desfecho = tx.t(`flair3d.ui.result.resultado.${desfechoDoPlacar(atual?.placar)}`);
  const texto = tx.ou(`flair3d.esporte.momento.${modalidade}.${momento}`, tx.t(`flair3d.esporte.momento.${momento}`, { desfecho }), { desfecho });
  return (
    <p className={`fsp-momento is-${momento.toLowerCase()}`} role="status" data-testid="esporte-momento" data-momento={momento}>
      {texto}
    </p>
  );
}
