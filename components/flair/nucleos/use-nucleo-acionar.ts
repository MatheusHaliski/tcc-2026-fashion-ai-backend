"use client";
/**
 * O acionamento da pessoa durante a ação (a carta Especial, a troca, o passo do Detective, a execução no percurso):
 * publica o efeito para a cena, manda o pedido ao servidor e lembra que uma carta já foi acionada até o servidor
 * confirmar (resultado novo) ou recusar (erro). Saiu de nucleo-game.tsx, que só compõe.
 */
import { useCallback, useEffect, useState } from "react";
import type { ApiError } from "@/lib/api/client";
import type { AcionamentoPedido } from "@/components/flair/nucleos/nucleo-trigger";
import { emitirFx } from "@/lib/flair/nucleos/fx-events";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

export function useNucleoAcionar(codigo: NucleoCodigo, onAcionar: ((pedido: AcionamentoPedido) => void) | undefined, erro: ApiError | null | undefined,
  resultado: NucleoResultado | null) {
  /** a pessoa já acionou uma carta nesta partida (vale até o servidor confirmar ou recusar) */
  const [acionou, setAcionou] = useState(false);
  useEffect(() => {
    setAcionou(false);
  }, [erro, resultado]);
  const acionar = useCallback((pedido: AcionamentoPedido) => {
    emitirFx({ tipo: "acionamento", nucleo: codigo, acionamento: pedido.tipo, cardId: pedido.cardId });
    if (pedido.cardId) setAcionou(true);
    onAcionar?.(pedido);
  }, [codigo, onAcionar]);
  return { acionou, acionar };
}
