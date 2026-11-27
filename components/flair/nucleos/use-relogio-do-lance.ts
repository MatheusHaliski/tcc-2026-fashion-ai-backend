"use client";
/**
 * O relógio do lance do Dress Fighter: com a janela da carta aberta, a pessoa tem {@link JANELA_DO_LANCE_S} segundos
 * para escolher o golpe; quem hesita segue sem carta (a lutadora só se defende). Assim a leitura do golpe da oponente
 * vira decisão sob pressão, não consulta de tabela. Com "reduzir movimento" o relógio não corre (acessibilidade).
 */
import { useEffect, useRef, useState } from "react";

export const JANELA_DO_LANCE_S = 8;

export function useRelogioDoLance(ativo: boolean, reduzido: boolean, onFim: () => void): number | null {
  const [resta, setResta] = useState(JANELA_DO_LANCE_S);
  const fim = useRef(onFim);
  fim.current = onFim;
  useEffect(() => {
    setResta(JANELA_DO_LANCE_S);
    if (!ativo || reduzido) return;
    const timer = window.setInterval(() => setResta((r) => r - 1), 1000);
    return () => window.clearInterval(timer);
  }, [ativo, reduzido]);
  useEffect(() => {
    if (ativo && !reduzido && resta <= 0) fim.current();
  }, [ativo, reduzido, resta]);
  return ativo && !reduzido ? Math.max(0, resta) : null;
}
