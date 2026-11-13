"use client";
/**
 * Prévia da entrega durante a preparação (POST .../partidas/{id}/previa): depois de cada mudança no look, espera
 * PREVIA_MS sem outra mudança e pergunta ao servidor quanto o look vale agora. Só o servidor calcula; sem resposta (fora
 * do ar, partida já fechada), o placar volta a ficar em espera. Seleção vazia não pede prévia nem abre partida.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { previaPartida } from "@/lib/flair/nucleos/api";
import { temEscolha, toEntrega, type Selecao } from "@/lib/flair/nucleos/selection";
import type { AvatarTipo, NucleoPartida, NucleoResultado } from "@/lib/flair/nucleos/types";

/** Espera depois da última mudança antes de pedir a prévia, em ms. */
export const PREVIA_MS = 400;

export interface NucleoPreviewOptions {
  /** a partida aberta (nos núcleos sem deck, abre na primeira prévia); null quando não há partida para consultar */
  partida: (avatar: AvatarTipo) => Promise<NucleoPartida | null>;
}

export function useNucleoPreview(opts: NucleoPreviewOptions) {
  const [previa, setPrevia] = useState<NucleoResultado | null>(null);
  const ref = useRef(opts);
  ref.current = opts;
  const timer = useRef<number | null>(null);
  /** número do último pedido: resposta de pedido antigo é descartada */
  const pedido = useRef(0);

  const cancelar = useCallback(() => {
    pedido.current += 1;
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const limpar = useCallback(() => {
    cancelar();
    setPrevia(null);
  }, [cancelar]);

  const pedir = useCallback(
    (sel: Selecao, avatar: AvatarTipo) => {
      cancelar();
      if (!temEscolha(sel)) {
        setPrevia(null);
        return;
      }
      const numero = pedido.current;
      timer.current = window.setTimeout(async () => {
        timer.current = null;
        try {
          const partida = await ref.current.partida(avatar);
          if (!partida || numero !== pedido.current) return;
          const r = await previaPartida(partida.id, toEntrega(sel));
          if (numero === pedido.current) setPrevia(r);
        } catch {
          // a prévia é só um aviso: sem ela o placar fica em espera e a entrega segue valendo
          if (numero === pedido.current) setPrevia(null);
        }
      }, PREVIA_MS);
    },
    [cancelar],
  );

  useEffect(() => cancelar, [cancelar]);

  return { previa, pedir, cancelar, limpar };
}
