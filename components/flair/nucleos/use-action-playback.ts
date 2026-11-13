"use client";
/**
 * A ação da partida passo a passo: cada passo do resultado do servidor aparece a cada PASSO_MS (até 2 s por efeito),
 * publica o evento para a cena e toca o som. Com "reduzir movimento", não há passo a passo: vai direto ao placar.
 * `pausado` segura a ação enquanto a janela de um acionamento está aberta.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { PASSO_MS, type PassoAcao } from "@/lib/flair/nucleos/action-fx";

export interface ActionPlaybackOptions {
  ativo: boolean;
  passos: PassoAcao[];
  reduzido: boolean;
  pausado?: boolean;
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
  const { ativo, reduzido, pausado = false } = opts;
  const total = opts.passos.length;

  useEffect(() => {
    if (!ativo) {
      setMostrados(0);
      return;
    }
    if (reduzido) {
      setMostrados(total);
      ref.current.onFim();
    }
  }, [ativo, reduzido, total]);

  useEffect(() => {
    if (!ativo || reduzido || pausado) return;
    const fim = mostrados >= total;
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
  }, [ativo, reduzido, pausado, mostrados, total]);

  const pular = useCallback(() => {
    setMostrados(ref.current.passos.length);
    ref.current.onFim();
  }, []);

  return { mostrados, total, pular };
}
