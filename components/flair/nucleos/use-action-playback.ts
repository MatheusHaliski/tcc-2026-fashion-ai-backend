"use client";
/**
 * A ação da partida passo a passo: cada passo do resultado do servidor aparece a cada PASSO_MS (até 2 s por efeito),
 * publica o evento para a cena e toca o som. Com "reduzir movimento", não há passo a passo: vai direto ao placar.
 * `continua` diz que a partida ainda espera um acionamento (EM_ACAO): os passos que já vieram aparecem e a ação para
 * ali, sem terminar, até a próxima resposta do servidor trazer os passos seguintes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { PASSO_MS, type PassoAcao } from "@/lib/flair/nucleos/action-fx";

export interface ActionPlaybackOptions {
  ativo: boolean;
  passos: PassoAcao[];
  reduzido: boolean;
  /** a partida continua depois destes passos (mais passos vêm com o acionamento) */
  continua?: boolean;
  onPasso?: (passo: PassoAcao, indice: number) => void;
  onFim: () => void;
}

/** Espera antes do primeiro passo, em ms (a cena troca de momento antes de a primeira peça agir). */
export const ESPERA_INICIAL_MS = 150;

export function useActionPlayback(opts: ActionPlaybackOptions) {
  /** quantos passos já apareceram */
  const [mostrados, setMostrados] = useState(0);
  const ref = useRef(opts);
  ref.current = opts;
  const { ativo, reduzido, continua = false } = opts;
  const total = opts.passos.length;

  useEffect(() => {
    if (!ativo) {
      setMostrados(0);
      return;
    }
    if (reduzido) {
      setMostrados(total);
      if (!continua) ref.current.onFim();
    }
  }, [ativo, reduzido, total, continua]);

  useEffect(() => {
    if (!ativo || reduzido) return;
    const fim = mostrados >= total;
    if (fim && continua) return;
    const espera = mostrados === 0 ? ESPERA_INICIAL_MS : PASSO_MS;
    const timer = window.setTimeout(() => {
      if (fim) {
        ref.current.onFim();
        return;
      }
      const passo = ref.current.passos[mostrados];
      if (passo) ref.current.onPasso?.(passo, mostrados);
      setMostrados(mostrados + 1);
    }, espera);
    return () => window.clearTimeout(timer);
  }, [ativo, reduzido, continua, mostrados, total]);

  const pular = useCallback(() => {
    setMostrados(ref.current.passos.length);
    if (!ref.current.continua) ref.current.onFim();
  }, []);

  return { mostrados, total, pular };
}
