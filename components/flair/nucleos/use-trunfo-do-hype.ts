"use client";
/**
 * O trunfo do Hype da partida (rodada 8g): chama o Hype de uma carta do deck uma vez por partida. O estado vem do
 * servidor (a resposta da chamada, ou o AURA_NA_PARTIDA da última prévia, que já diz se ele foi chamado); a recusa
 * aparece pelo código. Cada toque leva um identificador: repetido, o servidor devolve o mesmo.
 */
import { useCallback, useState } from "react";
import { ApiError } from "@/lib/api/client";
import type { TrunfoNaPartida } from "@/lib/flair/nucleos/aura-na-partida";
import { chamarHype } from "@/lib/flair/recursos/api";

function novoPedido(): string {
  const c = globalThis.crypto as Crypto | undefined;
  return c?.randomUUID ? c.randomUUID() : `hype-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

export interface TrunfoNaTela {
  trunfo: TrunfoNaPartida | null;
  ocupado: boolean;
  /** o código da recusa do servidor (HYPE_JA_CHAMADO, HYPE_SEM_FORCA...) */
  erro: string | null;
  chamar: (cardId: string) => void;
}

export function useTrunfoDoHype(partida: string | null | undefined, doServidor: TrunfoNaPartida | null): TrunfoNaTela {
  const [chamado, setChamado] = useState<TrunfoNaPartida | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const chamar = useCallback((cardId: string) => {
    if (!partida || ocupado) return;
    setOcupado(true);
    setErro(null);
    chamarHype(partida, cardId, novoPedido()).then(
      (r) => setChamado(r.hype),
      (e: unknown) => setErro(e instanceof ApiError ? e.code : "ERRO"),
    ).finally(() => setOcupado(false));
  }, [partida, ocupado]);
  return { trunfo: chamado ?? doServidor, ocupado, erro, chamar };
}
